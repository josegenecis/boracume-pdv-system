// deno-lint-ignore-file no-explicit-any
import { buildMenuShareUrl, buildPhoneCandidates, buildTrackShareUrl, fillTemplate, loadRestaurantContext, normalizePhone, sendRestaurantWhatsApp } from './restaurant-whatsapp.ts';

function getEnv(name: string, fallback = '') {
  return String(Deno.env.get(name) || fallback).trim();
}

function toTextFromHistoryItem(item: any) {
  return String(item?.content || '').trim();
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

export async function logWhatsAppBotStep(supabase: any, restaurantId: string, actionType: string, description: string, metadata: Record<string, unknown> = {}) {
  const userId = String(restaurantId || '').trim();
  if (!supabase || !userId) return;
  await supabase.from('agent_activity_logs').insert({
    user_id: userId,
    action_type: actionType,
    description,
    metadata: {
      channel: 'whatsapp_bot',
      ...metadata
    }
  });
}

async function callOpenAiBot(payload: {
  supabase?: any;
  message: string;
  restaurantId: string;
  customerPhone: string;
  instance: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const SUPABASE_URL = getEnv('SUPABASE_URL');
  const BORACUME_INTERNAL_KEY = getEnv('BORACUME_INTERNAL_KEY', getEnv('BOT_WEBHOOK_SECRET'));
  if (!SUPABASE_URL || !BORACUME_INTERNAL_KEY) {
    await logWhatsAppBotStep(payload.supabase, payload.restaurantId, 'whatsapp_bot_openai_env_missing', 'OpenAI bot sem ambiente interno configurado', {
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasInternalKey: Boolean(BORACUME_INTERNAL_KEY)
    });
    return '';
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/evolution-bot-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-boracume-key': BORACUME_INTERNAL_KEY
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  await logWhatsAppBotStep(payload.supabase, payload.restaurantId, response.ok ? 'whatsapp_bot_openai_ok' : 'whatsapp_bot_openai_error', response.ok ? 'OpenAI respondeu para o bot' : 'OpenAI não respondeu com sucesso para o bot', {
    status: response.status,
    instance: payload.instance,
    customerPhone: payload.customerPhone,
    hasMessage: Boolean(String(data?.message || '').trim()),
    error: String(data?.error || data?.details || '')
  });
  return String(data?.message || '').trim();
}

export async function sendEvolutionText(restaurantId: string, instanceName: string, phone: string, text: string) {
  const EVOLUTION_BASE_URL = getEnv('EVOLUTION_BASE_URL');
  const EVOLUTION_API_KEY = getEnv('EVOLUTION_API_KEY');
  const fallbackRestaurantId = String(restaurantId || '').trim();
  const instance = String(instanceName || '').trim();
  const number = normalizePhone(phone);
  const message = String(text || '').trim();

  if (!number || !message) {
    return { ok: false, skipped: true };
  }

  if (EVOLUTION_BASE_URL && EVOLUTION_API_KEY && instance) {
    const response = await fetch(`${EVOLUTION_BASE_URL.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number,
        text: message,
        delay: 400,
        linkPreview: true
      })
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return { ok: true, status: response.status, data, transport: 'evolution-sendText' };
    }
    return { ok: false, status: response.status, data, transport: 'evolution-sendText' };
  }

  if (!fallbackRestaurantId) {
    return { ok: false, error: 'missing_restaurant_id' };
  }

  const legacy = await sendRestaurantWhatsApp(fallbackRestaurantId, number, message);
  return { ...legacy, transport: 'legacy-send-text' };
}

export async function processRestaurantBotMessage(params: {
  supabase: any;
  restaurantId: string;
  instanceName: string;
  customerPhone: string;
  text: string;
}) {
  const supabase = params.supabase;
  const restaurantId = String(params.restaurantId || '').trim();
  const customerPhone = normalizePhone(params.customerPhone);
  const text = String(params.text || '').trim();
  const instanceName = String(params.instanceName || '').trim();

  if (!restaurantId || !customerPhone || !text) {
    return { ok: false, skipped: true, reason: 'missing_input' };
  }

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_received', 'Mensagem recebida para processamento do bot', {
    instanceName,
    customerPhone,
    textPreview: text.slice(0, 120)
  });

  const phoneCandidates = buildPhoneCandidates(customerPhone);
  const [{ data: existingCustomer }, { data: context }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, updated_at')
      .eq('user_id', restaurantId)
      .in('phone', phoneCandidates)
      .maybeSingle(),
    loadRestaurantContext(supabase, restaurantId)
  ]);

  const customerName = String(existingCustomer?.name || 'Cliente WhatsApp');

  if (!existingCustomer) {
    await supabase.from('customers').insert({
      user_id: restaurantId,
      name: customerName,
      phone: customerPhone
    });
  }

  const { data: existingConversation } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', restaurantId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();

  let conversationId = String(existingConversation?.id || '');
  if (!conversationId) {
    const { data: createdConversation, error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: restaurantId,
        customer_phone: customerPhone,
        customer_name: customerName,
        status: 'open'
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    conversationId = String(createdConversation?.id || '');
  }

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: text,
    sender: 'customer',
    message_type: 'text',
    delivered: true
  });

  const [{ data: history }, { data: lastOrder }, { data: lastBotMessage }] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('sender, content, sent_at')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .limit(20),
    supabase
      .from('orders')
      .select('id, order_number, status, created_at')
      .eq('user_id', restaurantId)
      .in('customer_phone', phoneCandidates)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('whatsapp_messages')
      .select('id, content, sent_at')
      .eq('conversation_id', conversationId)
      .eq('sender', 'bot')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const explicitMenuIntent = wantsMenuLink(text);
  const greetingIntent = isGreeting(text);
  const trackIntent = wantsOrderTracking(text);
  const customerHasNoOrder = !lastOrder;
  const recentBotReplyMinutes = minutesSince(lastBotMessage?.sent_at);
  const canRepeatMenuReply = explicitMenuIntent ? recentBotReplyMinutes > 2 : recentBotReplyMinutes > 20;

  let replyText = '';
  let replyStrategy = 'fallback';

  if (trackIntent && lastOrder?.id) {
    replyStrategy = 'order_tracking';
    replyText = fillTemplate(
      `📦 ${context.restaurantName}: acompanhe seu pedido #{order_number} aqui: {track_link}`,
      {
        restaurant_name: context.restaurantName,
        order_number: String(lastOrder.order_number || ''),
        track_link: buildTrackShareUrl(String(lastOrder.id), restaurantId, String(lastOrder.order_number || '')),
        menu_link: buildMenuShareUrl(restaurantId),
        customer_name: customerName
      }
    );
  } else if ((explicitMenuIntent || (greetingIntent && customerHasNoOrder)) && canRepeatMenuReply) {
    replyStrategy = 'menu_auto_reply';
    replyText = fillTemplate(context.autoResponses.welcome || '', {
      restaurant_name: context.restaurantName,
      menu_link: buildMenuShareUrl(restaurantId),
      customer_name: customerName,
      order_number: '',
      track_link: ''
    });
  } else {
    replyStrategy = 'openai';
    replyText = await callOpenAiBot({
      supabase,
      message: text,
      restaurantId,
      customerPhone,
      instance: instanceName,
      conversationHistory: (history || [])
        .map((item: any) => ({
          role: item?.sender === 'customer' ? 'user' : 'assistant',
          content: toTextFromHistoryItem(item)
        }))
        .filter((item: any) => item.content)
    });
  }

  if (!replyText) {
    replyStrategy = 'welcome_fallback';
    replyText = fillTemplate(context.autoResponses.welcome || '', {
      restaurant_name: context.restaurantName,
      menu_link: buildMenuShareUrl(restaurantId),
      customer_name: customerName,
      order_number: '',
      track_link: ''
    }) || `Olá! 👋 Bem-vindo ao ${context.restaurantName}. Aqui está nosso cardápio: ${buildMenuShareUrl(restaurantId)}`;
  }

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_reply_built', 'Resposta do bot montada', {
    instanceName,
    customerPhone,
    replyStrategy,
    replyPreview: replyText.slice(0, 160),
    hasOrder: Boolean(lastOrder?.id),
    greetingIntent,
    explicitMenuIntent,
    trackIntent
  });

  const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, replyText);
  if (!sendResult?.ok) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_send_error', 'Falha ao enviar resposta do bot no WhatsApp', {
      instanceName,
      customerPhone,
      transport: sendResult?.transport || 'unknown',
      status: sendResult?.status || null,
      details: sendResult?.data || sendResult?.error || null
    });
    return { ok: false, error: 'send_failed', details: sendResult };
  }

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_sent', 'Resposta do bot enviada no WhatsApp', {
    instanceName,
    customerPhone,
    transport: sendResult?.transport || 'unknown',
    status: sendResult?.status || null
  });

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: replyText,
    sender: 'bot',
    message_type: 'text',
    delivered: true
  });

  await supabase
    .from('customers')
    .update({ updated_at: new Date().toISOString() })
    .eq('user_id', restaurantId)
    .in('phone', phoneCandidates);

  return { ok: true, replyText, conversationId };
}
