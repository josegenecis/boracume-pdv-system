import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { autoReplyWithMenu, buildMenuShareUrl, buildPhoneCandidates, buildTrackShareUrl, extractPhoneFromRemoteJid, fillTemplate, loadRestaurantContext, sendRestaurantWhatsApp } from "../_shared/restaurant-whatsapp.ts";

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

function isGreeting(text: string) {
  return /^(oi+|ol[áa]+|opa+|bom dia|boa tarde|boa noite|e ai|e aí|menu|card[aá]pio|link)\b/i.test(text.trim());
}

function wantsMenuLink(text: string) {
  return /(link|card[aá]pio|cat[aá]logo|menu|me envia|me manda|manda o link|envia o link|quero pedir|fazer pedido|fazer um pedido|como pedir|me passa o link)/i.test(text);
}

function wantsOrderTracking(text: string) {
  return /(acompanh|rastre|status do pedido|meu pedido|onde.*pedido|pedido.*andamento|pedido.*status)/i.test(text);
}

function minutesSince(dateString?: string | null) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / 60000;
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
          const phoneCandidates = buildPhoneCandidates(phone);
          const { data: existingCustomer } = await supabaseClient
            .from('customers')
            .select('id, name, updated_at')
            .eq('user_id', instanceRow.restaurant_id)
            .in('phone', phoneCandidates)
            .maybeSingle();

          if (!existingCustomer) {
            await supabaseClient
              .from('customers')
              .insert({
                user_id: instanceRow.restaurant_id,
                name: 'Cliente WhatsApp',
                phone
              })
              .select('id, name, updated_at')
              .single();
          }

          const { data: conversation } = await supabaseClient
            .from('whatsapp_conversations')
            .select('id, updated_at')
            .eq('user_id', instanceRow.restaurant_id)
            .eq('customer_phone', phone)
            .maybeSingle();

          let conversationId = conversation?.id || null;
          if (!conversationId) {
            const { data: createdConversation } = await supabaseClient
              .from('whatsapp_conversations')
              .insert({
                user_id: instanceRow.restaurant_id,
                customer_phone: phone,
                customer_name: existingCustomer?.name || 'Cliente WhatsApp',
                status: 'open'
              })
              .select('id')
              .single();
            conversationId = createdConversation?.id || null;
          }

          if (conversationId) {
            await supabaseClient.from('whatsapp_messages').insert({
              conversation_id: conversationId,
              content: text,
              sender: 'customer',
              message_type: 'text',
              delivered: true
            });
          }

          const { data: lastOrder } = await supabaseClient
            .from('orders')
            .select('id, order_number, status, created_at')
            .eq('user_id', instanceRow.restaurant_id)
            .in('customer_phone', phoneCandidates)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: lastBotMessage } = conversationId
            ? await supabaseClient
                .from('whatsapp_messages')
                .select('id, content, sent_at')
                .eq('conversation_id', conversationId)
                .eq('sender', 'bot')
                .order('sent_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            : { data: null };

          const explicitMenuIntent = wantsMenuLink(text);
          const greetingIntent = isGreeting(text);
          const trackIntent = wantsOrderTracking(text);
          const customerHasNoOrder = !lastOrder;
          const recentBotReplyMinutes = minutesSince(lastBotMessage?.sent_at);
          const canRepeatMenuReply = explicitMenuIntent ? recentBotReplyMinutes > 2 : recentBotReplyMinutes > 20;

          if (trackIntent && lastOrder?.id) {
            const context = await loadRestaurantContext(supabaseClient, instanceRow.restaurant_id);
            const trackLink = buildTrackShareUrl(lastOrder.id, instanceRow.restaurant_id, String(lastOrder.order_number || ''));
            const replyText = fillTemplate(
              `📦 ${context.restaurantName}: acompanhe seu pedido #{order_number} aqui: {track_link}`,
              {
                restaurant_name: context.restaurantName,
                order_number: String(lastOrder.order_number || ''),
                track_link: trackLink,
                menu_link: '',
                customer_name: existingCustomer?.name || 'Cliente'
              }
            );

            const sendResult = await sendRestaurantWhatsApp(instanceRow.restaurant_id, phone, replyText);
            if (sendResult?.ok && conversationId) {
              await supabaseClient.from('whatsapp_messages').insert({
                conversation_id: conversationId,
                content: replyText,
                sender: 'bot',
                message_type: 'text',
                delivered: true
              });
            }
          } else if ((explicitMenuIntent || (greetingIntent && customerHasNoOrder)) && canRepeatMenuReply) {
            const sendResult = await autoReplyWithMenu(supabaseClient, instanceRow.restaurant_id, phone, existingCustomer?.name || 'Cliente');
            if (sendResult?.ok) {
              await supabaseClient
                .from('customers')
                .update({ updated_at: new Date().toISOString() })
                .eq('user_id', instanceRow.restaurant_id)
                .in('phone', phoneCandidates);

              if (conversationId) {
                const context = await loadRestaurantContext(supabaseClient, instanceRow.restaurant_id);
                const replyText = fillTemplate(context.autoResponses.welcome || '', {
                  restaurant_name: context.restaurantName,
                  menu_link: buildMenuShareUrl(instanceRow.restaurant_id),
                  customer_name: existingCustomer?.name || 'Cliente',
                  order_number: '',
                  track_link: ''
                });
                await supabaseClient.from('whatsapp_messages').insert({
                  conversation_id: conversationId,
                  content: replyText,
                  sender: 'bot',
                  message_type: 'text',
                  delivered: true
                });
              }
            }
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
