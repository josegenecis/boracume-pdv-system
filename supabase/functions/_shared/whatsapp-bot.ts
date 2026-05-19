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

function wantsOpeningHours(text: string) {
  return /(que horas (fecha|abre)|hor[aá]rio|horario de funcionamento|voc[eê]s abrem|voc[eê]s fecham|at[eé] que horas|qual o hor[aá]rio)/i.test(text);
}

function wantsPromotions(text: string) {
  return /(promo[cç][aã]o|promo|desconto|oferta|ofertas|tem combo|tem combos|tem alguma promo|alguma promo[cç][aã]o)/i.test(text);
}

function buildOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'recebido',
    preparing: 'em preparo',
    ready: 'pronto',
    in_delivery: 'saiu para entrega',
    delivered: 'entregue',
    completed: 'finalizado',
    cancelled: 'cancelado'
  };
  return labels[String(status || '').trim()] || String(status || 'em andamento');
}

function buildOpeningHoursReply(restaurantName: string, openingHours: string, restaurantId: string) {
  return openingHours
    ? `🕒 O horário de funcionamento do ${restaurantName} é: ${openingHours}`
    : `🕒 Ainda não encontrei o horário de funcionamento cadastrado do ${restaurantName}. Se preferir, posso te enviar o cardápio: ${buildMenuShareUrl(restaurantId)}`;
}

function buildPromotionsReply(restaurantName: string, restaurantId: string, products: any[]) {
  const promoProducts = (products || []).filter((product: any) => {
    const discount = Number(product?.discount_percentage || 0);
    const price = Number(product?.price || 0);
    const originalPrice = Number(product?.original_price || 0);
    return discount > 0 || (originalPrice > 0 && originalPrice > price) || Boolean(product?.is_highlight);
  }).slice(0, 3);

  if (promoProducts.length === 0) {
    return `✨ No momento não encontrei promoções ativas no ${restaurantName}, mas posso te enviar o cardápio completo: ${buildMenuShareUrl(restaurantId)}`;
  }

  const lines = promoProducts.map((product: any) => {
    const name = String(product?.name || 'Item').trim();
    const price = Number(product?.price || 0).toFixed(2);
    const originalPrice = Number(product?.original_price || 0);
    const discount = Number(product?.discount_percentage || 0);
    if (discount > 0) {
      return `- ${name}: R$ ${price} (${discount}% OFF)`;
    }
    if (originalPrice > 0 && originalPrice > Number(product?.price || 0)) {
      return `- ${name}: de R$ ${originalPrice.toFixed(2)} por R$ ${price}`;
    }
    return `- ${name}: R$ ${price}`;
  });

  return `✨ Hoje no ${restaurantName} encontrei estas opções em destaque:\n${lines.join('\n')}\n\n📋 Cardápio completo: ${buildMenuShareUrl(restaurantId)}`;
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
  let primaryFailure: any = null;

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
    primaryFailure = { ok: false, status: response.status, data, transport: 'evolution-sendText' };
  }

  if (!fallbackRestaurantId) {
    return primaryFailure || { ok: false, error: 'missing_restaurant_id' };
  }

  const legacy = await sendRestaurantWhatsApp(fallbackRestaurantId, number, message);
  if (legacy?.ok) {
    return { ...legacy, transport: 'legacy-send-text', fallbackFrom: primaryFailure?.transport || null };
  }

  return {
    ...legacy,
    transport: 'legacy-send-text',
    primaryFailure
  };
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
  const [existingCustomerResult, context] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, updated_at')
      .eq('user_id', restaurantId)
      .in('phone', phoneCandidates)
      .maybeSingle(),
    loadRestaurantContext(supabase, restaurantId)
  ]);

  const existingCustomer = existingCustomerResult?.data;

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
    .select('id, status')
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

  if (String(existingConversation?.status || '').toLowerCase() === 'bot_paused') {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_paused', 'Bot pausado por atendimento humano', {
      instanceName,
      customerPhone,
      conversationId
    });
    return { ok: true, skipped: true, reason: 'bot_paused', conversationId };
  }

  const [{ data: history }, { data: lastOrder }, { data: lastBotMessage }, { data: productsData }] = await Promise.all([
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
      .maybeSingle(),
    supabase
      .from('products')
      .select('name, price, original_price, discount_percentage, is_highlight, available')
      .eq('user_id', restaurantId)
      .eq('available', true)
      .order('updated_at', { ascending: false })
      .limit(12)
  ]);

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('opening_hours')
    .eq('id', restaurantId)
    .maybeSingle();

  const explicitMenuIntent = wantsMenuLink(text);
  const greetingIntent = isGreeting(text);
  const trackIntent = wantsOrderTracking(text);
  const openingHoursIntent = wantsOpeningHours(text);
  const promotionsIntent = wantsPromotions(text);
  const customerHasNoOrder = !lastOrder;
  const recentBotReplyMinutes = minutesSince(lastBotMessage?.sent_at);
  const canRepeatMenuReply = explicitMenuIntent ? recentBotReplyMinutes > 2 : recentBotReplyMinutes > 20;

  let replyText = '';
  let replyStrategy = 'fallback';
  const deterministicReplies: string[] = [];

  if (trackIntent && lastOrder?.id) {
    deterministicReplies.push(fillTemplate(
      `📦 ${context.restaurantName}: acompanhe seu pedido #{order_number} aqui: {track_link}`,
      {
        restaurant_name: context.restaurantName,
        order_number: String(lastOrder.order_number || ''),
        track_link: buildTrackShareUrl(String(lastOrder.id), restaurantId, String(lastOrder.order_number || '')),
        menu_link: buildMenuShareUrl(restaurantId),
        customer_name: customerName
      }
    ));
    replyStrategy = openingHoursIntent ? 'multi_intent_tracking_hours' : 'order_tracking';
  } else if (trackIntent) {
    deterministicReplies.push(`📦 Não encontrei um pedido recente para este número no ${context.restaurantName}. Se quiser, me envie o nome usado no pedido ou peça o cardápio: ${buildMenuShareUrl(restaurantId)}`);
    replyStrategy = openingHoursIntent ? 'multi_intent_tracking_not_found_hours' : 'order_tracking_not_found';
  } else if (lastOrder?.id && /(status|situa[cç][aã]o|andamento).*(pedido)|pedido.*(status|situa[cç][aã]o|andamento)/i.test(text)) {
    deterministicReplies.push(`📦 Seu pedido #${String(lastOrder.order_number || '')} está ${buildOrderStatusLabel(String(lastOrder.status || ''))}. Acompanhe aqui: ${buildTrackShareUrl(String(lastOrder.id), restaurantId, String(lastOrder.order_number || ''))}`);
    replyStrategy = openingHoursIntent ? 'multi_intent_order_status_hours' : 'order_status_summary';
  }

  if (openingHoursIntent) {
    const openingHours = String(profileRow?.opening_hours || '').trim();
    deterministicReplies.push(buildOpeningHoursReply(context.restaurantName, openingHours, restaurantId));
    if (!trackIntent && replyStrategy === 'fallback') {
      replyStrategy = 'opening_hours';
    }
  }

  if (promotionsIntent) {
    deterministicReplies.push(buildPromotionsReply(context.restaurantName, restaurantId, Array.isArray(productsData) ? productsData : []));
    if (replyStrategy === 'fallback') {
      replyStrategy = 'promotions';
    } else {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  }

  if ((explicitMenuIntent || (greetingIntent && customerHasNoOrder)) && canRepeatMenuReply) {
    deterministicReplies.push(
      fillTemplate(context.autoResponses.welcome || '', {
        restaurant_name: context.restaurantName,
        menu_link: buildMenuShareUrl(restaurantId),
        customer_name: customerName,
        order_number: '',
        track_link: ''
      }) || `Olá! 👋 Bem-vindo ao ${context.restaurantName}. Aqui está nosso cardápio: ${buildMenuShareUrl(restaurantId)}`
    );
    if (replyStrategy === 'fallback') {
      replyStrategy = 'menu_auto_reply';
    } else {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  }

  if (deterministicReplies.length > 0) {
    replyText = Array.from(new Set(deterministicReplies.filter(Boolean))).join('\n\n');
  } else {
    replyStrategy = 'openai';
    try {
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
    } catch (error: any) {
      await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_openai_exception', 'Falha ao consultar resposta aberta do bot', {
        instanceName,
        customerPhone,
        error: String(error?.message || error || 'unknown_error')
      });
      replyText = '';
    }
  }

  if (!replyText) {
    replyStrategy = 'generic_fallback';
    replyText = `Olá! 👋 Sou o assistente do ${context.restaurantName}. Posso te ajudar com cardápio, promoções, horário de funcionamento e status do pedido. Se quiser, já te envio o cardápio: ${buildMenuShareUrl(restaurantId)}`;
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
