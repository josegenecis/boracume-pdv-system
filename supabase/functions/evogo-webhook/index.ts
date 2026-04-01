import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractPhoneFromRemoteJid } from "../_shared/restaurant-whatsapp.ts";
import { logWhatsAppBotStep, processRestaurantBotMessage } from "../_shared/whatsapp-bot.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toTextFromMessage(message: any) {
  if (typeof message === 'string') return message.trim();
  if (!message || typeof message !== 'object') return '';
  return String(
    message?.Text ||
    message?.Content ||
    message?.Conversation ||
    message?.text ||
    message?.content ||
    message?.conversation ||
    message?.extendedTextMessage?.Text ||
    message?.extendedTextMessage?.text ||
    message?.ExtendedTextMessage?.text ||
    message?.ExtendedTextMessage?.Text ||
    message?.imageMessage?.Caption ||
    message?.imageMessage?.caption ||
    message?.ImageMessage?.caption ||
    message?.ImageMessage?.Caption ||
    message?.videoMessage?.Caption ||
    message?.videoMessage?.caption ||
    message?.VideoMessage?.caption ||
    message?.VideoMessage?.Caption ||
    message?.documentMessage?.Caption ||
    message?.documentMessage?.caption ||
    message?.DocumentMessage?.caption ||
    message?.DocumentMessage?.Caption ||
    message?.buttonsResponseMessage?.SelectedDisplayText ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.ButtonsResponseMessage?.selectedDisplayText ||
    message?.ButtonsResponseMessage?.SelectedDisplayText ||
    message?.listResponseMessage?.Title ||
    message?.listResponseMessage?.title ||
    message?.ListResponseMessage?.title ||
    message?.ListResponseMessage?.Title ||
    message?.templateButtonReplyMessage?.SelectedDisplayText ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  ).trim();
}

function pickIncomingMessages(body: any) {
  return [
    ...(Array.isArray(body?.data?.messages) ? body.data.messages : []),
    ...(Array.isArray(body?.messages) ? body.messages : []),
    ...(body?.data?.message ? [{ key: body?.data?.key, message: body?.data?.message, data: body?.data }] : []),
    ...(body?.data?.Message ? [{ key: body?.data?.key, message: body?.data?.Message, data: body?.data }] : []),
    ...(body?.message ? [{ key: body?.key, message: body?.message, data: body }] : []),
    ...(body?.Message ? [{ key: body?.key, message: body?.Message, data: body }] : []),
    ...(body?.data && typeof body.data === 'object' ? [body.data] : []),
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

function normalizeLookupKey(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

serve(async (req) => {
  const debugMode = new URL(req.url).searchParams.get('debug') === '1';
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
    const rawEvent = String(body?.event || body?.type || '').trim();
    const event = rawEvent.toUpperCase().replace(/[.\-\s]+/g, '_');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      if (debugMode) {
        return new Response(JSON.stringify({ success: false, error: 'supabase_env_missing', hasSupabaseUrl: Boolean(supabaseUrl), hasServiceRoleKey: Boolean(supabaseServiceRoleKey) }), { status: 500, headers: corsHeaders });
      }
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

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

    if (!instanceRow && instanceName) {
      const normalizedInstance = normalizeLookupKey(instanceName);
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, restaurant_name')
        .limit(2000);
      const matchedProfile = (profiles || []).find((profile: any) => normalizeLookupKey(profile?.restaurant_name) === normalizedInstance);
      if (matchedProfile?.id) {
        instanceRow = { restaurant_id: matchedProfile.id, instance_name: instanceName };
        await supabaseClient
          .from('whatsapp_instances')
          .upsert(
            { restaurant_id: matchedProfile.id, instance_name: instanceName, status: 'connected' },
            { onConflict: 'instance_name' }
          );
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

    let lastResult: any = { success: true, ignored: true };

    if (instanceRow?.restaurant_id) {
      await logWhatsAppBotStep(supabaseClient, instanceRow.restaurant_id, 'whatsapp_webhook_received', 'Webhook evogo recebido', {
        provider: 'evogo',
        event,
        rawEvent,
        instanceName: instanceRow.instance_name || instanceName
      });

      const candidates = pickIncomingMessages(body);

      const incomingMessages = candidates.filter((item: any) => {
        const key = item?.key || item?.data?.key || {};
        const remoteJid = String(
          key?.remoteJid ||
          item?.remoteJid ||
          item?.data?.remoteJid ||
          item?.Info?.Chat ||
          item?.data?.Info?.Chat ||
          ''
        );
        const fromMe = Boolean(key?.fromMe ?? item?.fromMe ?? item?.data?.fromMe ?? item?.Info?.IsFromMe ?? item?.data?.Info?.IsFromMe);
        return !fromMe && remoteJid && !remoteJid.includes('@g.us') && !remoteJid.includes('status@broadcast');
      });

      if (incomingMessages.length > 0) {
        const primaryIncoming = incomingMessages[0];
        const key = primaryIncoming?.key || primaryIncoming?.data?.key || {};
        const remoteJid = String(
          key?.remoteJid ||
          primaryIncoming?.remoteJid ||
          primaryIncoming?.data?.remoteJid ||
          primaryIncoming?.Info?.Chat ||
          primaryIncoming?.data?.Info?.Chat ||
          ''
        );
        const text = Array.from(new Set(incomingMessages
          .map((incoming: any) => {
            const message =
              incoming?.message ||
              incoming?.Message ||
              incoming?.data?.message ||
              incoming?.data?.Message ||
              incoming?.text ||
              incoming?.Text ||
              incoming?.data?.text ||
              incoming?.data?.Text ||
              incoming?.data ||
              {};
            return toTextFromMessage(message);
          })
          .filter(Boolean)))
          .join('\n');
        const phone = extractPhoneFromRemoteJid(remoteJid);

        if (phone && text) {
          const result = await processRestaurantBotMessage({
            supabase: supabaseClient,
            restaurantId: instanceRow.restaurant_id,
            instanceName: instanceRow.instance_name || instanceName,
            customerPhone: phone,
            text
          });
          lastResult = result;
          await logWhatsAppBotStep(supabaseClient, instanceRow.restaurant_id, result.ok ? 'whatsapp_webhook_processed' : 'whatsapp_webhook_error', result.ok ? 'Webhook evogo processado com sucesso' : 'Webhook evogo falhou ao processar', {
            provider: 'evogo',
            event,
            rawEvent,
            instanceName: instanceRow.instance_name || instanceName,
            customerPhone: phone,
            error: result.error || null,
            details: result.details || null
          });
        }
      }
    }

    if (debugMode) {
      return new Response(JSON.stringify({
        success: Boolean(lastResult?.ok ?? true),
        event,
        rawEvent,
        instanceName,
        hasInstanceRow: Boolean(instanceRow?.restaurant_id),
        restaurantId: instanceRow?.restaurant_id || null,
        result: lastResult
      }), { status: lastResult?.ok === false ? 502 : 200, headers: corsHeaders });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook Error:", error);
    if (debugMode) {
      return new Response(JSON.stringify({ success: false, error: String((error as Error)?.message || error || 'unknown_error') }), { status: 500, headers: corsHeaders });
    }
    // Always return 200 for webhooks so EvoGo doesn't retry infinitely
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
