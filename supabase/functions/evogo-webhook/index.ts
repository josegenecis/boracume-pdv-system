import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { autoReplyWithMenu, extractPhoneFromRemoteJid } from "../_shared/restaurant-whatsapp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    const instanceName = body.instance || body.instanceName || body.data?.instance || body.data?.instanceName;
    const event = body.event;

    if (!instanceName) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: instanceRow } = await supabaseClient
      .from('whatsapp_instances')
      .select('restaurant_id, instance_name')
      .eq('instance_name', instanceName)
      .maybeSingle();

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

    if (event === 'MESSAGES_UPSERT' && instanceRow?.restaurant_id) {
      const candidates = [
        ...(Array.isArray(body?.data?.messages) ? body.data.messages : []),
        ...(Array.isArray(body?.messages) ? body.messages : []),
        ...(body?.data?.key ? [body.data] : []),
        ...(body?.key ? [body] : [])
      ];

      const incoming = candidates.find((item: any) => {
        const key = item?.key || item?.data?.key || {};
        const remoteJid = String(key?.remoteJid || '');
        return !key?.fromMe && remoteJid && !remoteJid.includes('@g.us') && !remoteJid.includes('status@broadcast');
      });

      if (incoming) {
        const key = incoming?.key || incoming?.data?.key || {};
        const message = incoming?.message || incoming?.data?.message || {};
        const remoteJid = String(key?.remoteJid || '');
        const text =
          message?.conversation ||
          message?.extendedTextMessage?.text ||
          message?.imageMessage?.caption ||
          '';

        const phone = extractPhoneFromRemoteJid(remoteJid);
        if (phone) {
          const { data: existingCustomer } = await supabaseClient
            .from('customers')
            .select('id')
            .eq('user_id', instanceRow.restaurant_id)
            .eq('phone', phone)
            .maybeSingle();

          if (!existingCustomer) {
            await supabaseClient
              .from('customers')
              .insert({
                user_id: instanceRow.restaurant_id,
                name: 'Cliente WhatsApp',
                phone
              });
          }

          const shouldAutoReply = !existingCustomer || /(oi|olá|ola|menu|card[aá]pio|pedido|quero|boa tarde|bom dia|boa noite)/i.test(String(text || ''));
          if (shouldAutoReply) {
            await autoReplyWithMenu(supabaseClient, instanceRow.restaurant_id, phone);
          }
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
