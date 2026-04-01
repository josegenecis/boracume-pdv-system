import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractPhoneFromRemoteJid } from "../_shared/restaurant-whatsapp.ts";
import { logWhatsAppBotStep, processRestaurantBotMessage } from "../_shared/whatsapp-bot.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toTextFromMessage(message: any) {
  if (!message || typeof message !== 'object') return '';
  return String(
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  ).trim();
}

function pickIncomingMessages(body: any) {
  return [
    ...(Array.isArray(body?.data?.messages) ? body.data.messages : []),
    ...(Array.isArray(body?.messages) ? body.messages : []),
    ...(body?.data?.message ? [{ key: body?.data?.key, message: body?.data?.message, data: body?.data }] : []),
    ...(body?.message ? [{ key: body?.key, message: body?.message, data: body }] : []),
    ...(body?.data?.key ? [body.data] : []),
    ...(body?.key ? [body] : [])
  ];
}

function normalizeInstanceKey(value: unknown) {
  return String(value || '').trim();
}

function restaurantIdFromToken(value: unknown) {
  const token = String(value || '').trim();
  const raw = token.startsWith('token_') ? token.slice(6) : '';
  if (!/^[a-f0-9]{32}$/i.test(raw)) return '';
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    const instanceName = normalizeInstanceKey(
      body.instance ||
      body.instanceName ||
      body.data?.instance ||
      body.data?.instanceName ||
      body.name ||
      body.data?.name
    );
    const event = body.event;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let instanceRow: { restaurant_id: string; instance_name?: string } | null = null;

    if (instanceName) {
      const { data } = await supabaseClient
        .from('whatsapp_instances')
        .select('restaurant_id, instance_name')
        .eq('instance_name', instanceName)
        .maybeSingle();
      instanceRow = data;
    }

    if (!instanceRow && instanceName) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('restaurant_name', instanceName)
        .maybeSingle();

      if (profile?.id) {
        instanceRow = { restaurant_id: profile.id, instance_name: instanceName };
      }
    }

    if (!instanceRow) {
      const tokenRestaurantId = restaurantIdFromToken(body.token || body.data?.token || body.apikey || body.data?.apikey);
      if (tokenRestaurantId) {
        instanceRow = { restaurant_id: tokenRestaurantId, instance_name: instanceName || undefined };
      }
    }

    if (!instanceRow && isUuid(instanceName)) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', instanceName)
        .maybeSingle();
      if (profile?.id) {
        instanceRow = { restaurant_id: profile.id, instance_name: instanceName || undefined };
      }
    }

    if (!instanceName && !instanceRow) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    if (event === 'CONNECTION_UPDATE') {
      const state = body.data?.state || body.data?.connection;
      let newStatus = 'disconnected';
      if (state === 'open' || state === 'connected') newStatus = 'connected';
      else if (state === 'connecting') newStatus = 'connecting';

      await supabaseClient
        .from('whatsapp_instances')
        .update({ status: newStatus })
        .eq('instance_name', instanceName);
    }

    if (['MESSAGES_UPSERT', 'MESSAGE', 'MESSAGES_UPDATE'].includes(String(event || '').toUpperCase()) && instanceRow?.restaurant_id) {
      await logWhatsAppBotStep(supabaseClient, instanceRow.restaurant_id, 'whatsapp_webhook_received', 'Webhook evogo recebido', {
        provider: 'evogo',
        event: String(event || ''),
        instanceName: instanceRow.instance_name || instanceName
      });

      const candidates = pickIncomingMessages(body);

      const incoming = candidates.find((item: any) => {
        const key = item?.key || item?.data?.key || {};
        const remoteJid = String(key?.remoteJid || '');
        return !key?.fromMe && remoteJid && !remoteJid.includes('@g.us') && !remoteJid.includes('status@broadcast');
      });

      if (incoming) {
        const key = incoming?.key || incoming?.data?.key || {};
        const message = incoming?.message || incoming?.data?.message || {};
        const remoteJid = String(key?.remoteJid || '');
        const text = toTextFromMessage(message);
        const phone = extractPhoneFromRemoteJid(remoteJid);

        if (phone && text) {
          const result = await processRestaurantBotMessage({
            supabase: supabaseClient,
            restaurantId: instanceRow.restaurant_id,
            instanceName: instanceRow.instance_name || instanceName,
            customerPhone: phone,
            text
          });
          await logWhatsAppBotStep(supabaseClient, instanceRow.restaurant_id, result.ok ? 'whatsapp_webhook_processed' : 'whatsapp_webhook_error', result.ok ? 'Webhook evogo processado com sucesso' : 'Webhook evogo falhou ao processar', {
            provider: 'evogo',
            event: String(event || ''),
            instanceName: instanceRow.instance_name || instanceName,
            customerPhone: phone,
            error: result.error || null,
            details: result.details || null
          });
        }
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook Error:", error);
    // Always return 200 for webhooks so EvoGo doesn't retry infinitely
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
