// deno-lint-ignore-file no-explicit-any
import { buildMenuShareUrl, buildPhoneCandidates, buildTrackShareUrl, fillTemplate, loadRestaurantContext, normalizePhone, sendRestaurantWhatsApp } from './restaurant-whatsapp.ts';

function getEnv(name: string, fallback = '') {
  return String(Deno.env.get(name) || fallback).trim();
}

function toTextFromHistoryItem(item: any) {
  return String(item?.content || '').trim();
}

function isGreeting(text: string) {
  return /^(oi+|ol[áa]+|opa+|bom dia|boa tarde|boa noite|e ai|e aí)\b/i.test(text.trim());
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

function isThanks(text: string) {
  return /(obrigad[oa]?|valeu+|agrade[cç]o|tmj|show|perfeito|maravilha|blz|beleza)\b/i.test(text.trim());
}

function normalizeIntentText(text: string) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isLowSignalMessage(text: string) {
  const value = normalizeIntentText(text).replace(/[!?.\s]+$/g, '');
  if (!value) return true;
  return /^(ok|okay|certo|ta|t[aá]|ta bom|t[aá] bom|beleza|blz|show|sim|nao|não|obg|obrigado|obrigada|valeu|vlw|👍|👌)$/.test(value);
}

function wantsHumanAttendance(text: string) {
  const value = normalizeIntentText(text);
  return /(atendente|humano|pessoa|falar com alguem|falar com alguém|responsavel|responsável|gerente|dono|suporte|me liga|ligar|telefone)/i.test(value);
}

function isComplaintOrProblem(text: string) {
  const value = normalizeIntentText(text);
  return /(reclama|problema|errado|atras|atrasado|demora|demorando|frio|faltou|faltando|cance|cancelar|ruim|horrivel|péssimo|pessimo|devolu|estorno|reembolso)/i.test(value);
}

function isMarketingOptOut(text: string) {
  const value = normalizeIntentText(text);
  return /^(sair|parar|cancelar ofertas|remover|nao quero|nao receber|sem ofertas)\b/.test(value);
}

function getLocalDayKey(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function isSameLocalDay(value?: string | null) {
  const key = getLocalDayKey(value);
  return Boolean(key && key === getLocalDayKey());
}

function ensureMenuLink(text: string, menuLink: string) {
  const message = String(text || '').trim();
  const normalizedLink = String(menuLink || '').trim();
  if (!normalizedLink) return message;
  if (!message) return `📋 Confira nosso cardápio: ${normalizedLink}`;
  if (message.includes(normalizedLink)) return message;
  return `${message}\n\n📋 Cardápio: ${normalizedLink}`;
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

function formatBRL(value: unknown) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function findMentionedProducts(text: string, products: any[]) {
  const normalizedText = normalizeIntentText(text);
  if (!normalizedText || !Array.isArray(products)) return [];

  const tokens = normalizedText
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ''))
    .filter((token) => token.length >= 3);

  return products
    .map((product: any) => {
      const name = String(product?.name || '').trim();
      const normalizedName = normalizeIntentText(name);
      if (!name || !normalizedName) return null;
      const direct = normalizedText.includes(normalizedName);
      const nameTokens = normalizedName.split(/\s+/).filter((token) => token.length >= 3);
      const score = direct
        ? 100
        : nameTokens.filter((token) => tokens.includes(token)).length;
      return score > 0 ? { product, score } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3)
    .map((item: any) => item.product);
}

function wantsProductInfo(text: string) {
  const value = normalizeIntentText(text);
  return /(tem|voces tem|vocês tem|quanto|preco|preço|valor|vende|disponivel|disponível|serve|cardapio|cardápio)/i.test(value);
}

function buildProductInfoReply(restaurantId: string, products: any[]) {
  const lines = products.map((product: any) => `- ${String(product?.name || 'Produto').trim()}: ${formatBRL(product?.price)}`);
  return `${products.length === 1 ? 'Temos sim:' : 'Encontrei essas opções:'}\n${lines.join('\n')}\n\nPara pedir, acesse o cardápio: ${buildMenuShareUrl(restaurantId)}`;
}

function minutesSince(dateString?: string | null) {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY;
  return (Date.now() - time) / 60000;
}

function buildTemporaryPauseStatus(minutes = 5) {
  return `bot_paused_until:${new Date(Date.now() + minutes * 60000).toISOString()}`;
}

function getPauseState(status: unknown) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'bot_paused') return { paused: true, expired: false, reason: 'manual' };
  if (!value.startsWith('bot_paused_until:')) return { paused: false, expired: false, reason: '' };

  const rawDate = value.slice('bot_paused_until:'.length);
  const until = new Date(rawDate).getTime();
  if (!Number.isFinite(until)) return { paused: false, expired: true, reason: 'invalid_until' };

  return {
    paused: until > Date.now(),
    expired: until <= Date.now(),
    reason: 'temporary',
    until: new Date(until).toISOString()
  };
}

export async function pauseRestaurantBotForConversation(params: {
  supabase: any;
  restaurantId: string;
  customerPhone: string;
  customerName?: string;
  reason?: string;
}) {
  const supabase = params.supabase;
  const restaurantId = String(params.restaurantId || '').trim();
  const customerPhone = normalizePhone(params.customerPhone);
  const customerName = String(params.customerName || 'Cliente WhatsApp').trim() || 'Cliente WhatsApp';

  if (!restaurantId || !customerPhone) {
    return { ok: false, skipped: true, reason: 'missing_input' };
  }

  const { data: existingConversation, error: findError } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', restaurantId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();

  if (findError) return { ok: false, error: findError.message };

  let conversationId = String(existingConversation?.id || '');
  if (!conversationId) {
    const { data: createdConversation, error: createError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        user_id: restaurantId,
        customer_phone: customerPhone,
        customer_name: customerName,
        status: buildTemporaryPauseStatus(5)
      })
      .select('id')
      .single();

    if (createError) return { ok: false, error: createError.message };
    conversationId = String(createdConversation?.id || '');
  }

  const fullPausePayload = {
    status: buildTemporaryPauseStatus(5),
    bot_paused: true,
    bot_paused_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let { error: updateError } = await supabase
    .from('whatsapp_conversations')
    .update(fullPausePayload)
    .eq('id', conversationId)
    .eq('user_id', restaurantId);

  if (updateError && String(updateError.message || '').includes('bot_paused')) {
    const fallbackResult = await supabase
      .from('whatsapp_conversations')
      .update({
        status: buildTemporaryPauseStatus(5),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('user_id', restaurantId);
    updateError = fallbackResult.error;
  }

  if (updateError) return { ok: false, error: updateError.message };

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_paused_by_outgoing', 'Bot pausado por mensagem enviada pelo restaurante', {
    customerPhone,
    conversationId,
    reason: params.reason || 'outgoing_message'
  });

  return { ok: true, conversationId };
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
  const message = String(data?.message || '').trim();
  if (/^teste ok\b/i.test(message)) return '';
  return message;
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

  const recentDuplicateCutoff = new Date(Date.now() - 30 * 1000).toISOString();
  const { data: recentDuplicateMessage } = await supabase
    .from('whatsapp_messages')
    .select('id, sent_at')
    .eq('conversation_id', conversationId)
    .eq('sender', 'customer')
    .eq('content', text)
    .gte('sent_at', recentDuplicateCutoff)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentDuplicateMessage?.id) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_duplicate_silent', 'Mensagem duplicada recebida por outro webhook; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId,
      duplicateMessageId: recentDuplicateMessage.id,
      textPreview: text.slice(0, 120)
    });
    return { ok: true, skipped: true, reason: 'duplicate_recent_message', conversationId };
  }

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: text,
    sender: 'customer',
    message_type: 'text',
    delivered: true
  });

  if (isMarketingOptOut(text)) {
    await supabase
      .from('whatsapp_marketing_optouts')
      .upsert({
        user_id: restaurantId,
        customer_phone: customerPhone,
        reason: 'customer_message'
      }, { onConflict: 'user_id,customer_phone' });

    await supabase
      .from('whatsapp_marketing_recipients')
      .update({
        status: 'opted_out',
        last_error: 'Cliente solicitou sair das ofertas.'
      })
      .eq('user_id', restaurantId)
      .eq('customer_phone', customerPhone)
      .eq('status', 'queued');

    const optOutReply = `Pronto. Não vou enviar novas ofertas por aqui. Se precisar falar com o ${context.restaurantName}, é só mandar mensagem.`;
    const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, optOutReply);
    if (sendResult?.ok) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        content: optOutReply,
        sender: 'bot',
        message_type: 'text',
        delivered: true
      });
    }

    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_marketing_optout', 'Cliente saiu das ofertas automáticas', {
      instanceName,
      customerPhone,
      conversationId,
      sendOk: Boolean(sendResult?.ok)
    });

    return { ok: true, skipped: true, reason: 'marketing_optout', conversationId };
  }

  const pauseState = getPauseState(existingConversation?.status);
  if (pauseState.expired) {
    const resumePayload = {
      status: 'active',
      bot_paused: false,
      bot_paused_at: null,
      bot_paused_by: null,
      updated_at: new Date().toISOString()
    };

    const resumeResult = await supabase
      .from('whatsapp_conversations')
      .update(resumePayload)
      .eq('id', conversationId);

    if (resumeResult.error && String(resumeResult.error.message || '').includes('bot_paused')) {
      await supabase
        .from('whatsapp_conversations')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }
  }

  if (pauseState.paused) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_paused', 'Bot pausado por atendimento humano', {
      instanceName,
      customerPhone,
      conversationId,
      pauseState
    });
    return { ok: true, skipped: true, reason: 'bot_paused', conversationId };
  }

  const menuLinkNeedle = `/share/menu/${restaurantId}`;

  const [{ data: history }, { data: lastOrder }, { data: lastBotMessage }, { data: lastMenuMessage }, { data: productsData }] = await Promise.all([
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
      .from('whatsapp_messages')
      .select('id, sent_at')
      .eq('conversation_id', conversationId)
      .eq('sender', 'bot')
      .ilike('content', `%${menuLinkNeedle}%`)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('products')
      .select('name, price, original_price, discount_percentage, is_highlight, available')
      .eq('user_id', restaurantId)
      .eq('available', true)
      .order('updated_at', { ascending: false })
      .limit(80)
  ]);

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('opening_hours')
    .eq('id', restaurantId)
    .maybeSingle();

  const explicitMenuIntent = wantsMenuLink(text);
  const greetingIntent = isGreeting(text);
  const thanksIntent = isThanks(text);
  const trackIntent = wantsOrderTracking(text);
  const openingHoursIntent = wantsOpeningHours(text);
  const promotionsIntent = wantsPromotions(text);
  const productMatches = findMentionedProducts(text, Array.isArray(productsData) ? productsData : []);
  const productInfoIntent = wantsProductInfo(text) && productMatches.length > 0;
  const lowSignalIntent = isLowSignalMessage(text) || thanksIntent;
  const humanIntent = wantsHumanAttendance(text);
  const problemIntent = isComplaintOrProblem(text);
  const customerMessageCount = (history || []).filter((item: any) => item?.sender === 'customer').length;
  const isFirstConversationTouch = customerMessageCount <= 1 && !lastBotMessage?.id;
  const recentBotReplyMinutes = minutesSince(lastBotMessage?.sent_at);
  const menuWasSentToday = Boolean(lastMenuMessage?.id && isSameLocalDay(lastMenuMessage?.sent_at));
  const canRepeatMenuReply = explicitMenuIntent
    ? recentBotReplyMinutes > 2
    : (!menuWasSentToday && (isFirstConversationTouch || greetingIntent || recentBotReplyMinutes > 20));
  const menuLink = buildMenuShareUrl(restaurantId);

  if (lowSignalIntent && !explicitMenuIntent && !trackIntent && !openingHoursIntent && !promotionsIntent && !humanIntent && !problemIntent) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_low_signal_silent', 'Mensagem curta/agradecimento; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId,
      textPreview: text.slice(0, 120)
    });
    return { ok: true, skipped: true, reason: 'low_signal', conversationId };
  }

  if (humanIntent || problemIntent) {
    const pauseUntil = new Date(Date.now() + 60 * 60000).toISOString();
    const pausePayload = {
      status: `bot_paused_until:${pauseUntil}`,
      bot_paused: true,
      bot_paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const pauseUpdate = await supabase
      .from('whatsapp_conversations')
      .update(pausePayload)
      .eq('id', conversationId);

    if (pauseUpdate.error && String(pauseUpdate.error.message || '').includes('bot_paused')) {
      await supabase
        .from('whatsapp_conversations')
        .update({ status: `bot_paused_until:${pauseUntil}`, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    const handoffText = problemIntent
      ? `Entendi. Vou deixar um atendente do ${context.restaurantName} assumir por aqui para te ajudar melhor.`
      : `Claro. Vou chamar um atendente do ${context.restaurantName} para continuar por aqui.`;

    const sendResult = await sendEvolutionText(restaurantId, instanceName, customerPhone, handoffText);
    if (sendResult?.ok) {
      await supabase.from('whatsapp_messages').insert({
        conversation_id: conversationId,
        content: handoffText,
        sender: 'bot',
        message_type: 'text',
        delivered: true
      });
    }

    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_handoff_paused', 'Bot pausado por pedido de atendente ou problema', {
      instanceName,
      customerPhone,
      conversationId,
      humanIntent,
      problemIntent,
      pauseUntil,
      sendOk: Boolean(sendResult?.ok)
    });

    return { ok: true, skipped: false, reason: 'handoff_paused', replyText: handoffText, conversationId };
  }

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
    } else if (replyStrategy !== 'fallback' && replyStrategy !== 'opening_hours') {
      replyStrategy = `multi_intent_${replyStrategy}`;
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

  if (productInfoIntent) {
    deterministicReplies.push(buildProductInfoReply(restaurantId, productMatches));
    if (replyStrategy === 'fallback') {
      replyStrategy = 'product_info';
    } else {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  }

  if ((explicitMenuIntent || greetingIntent || isFirstConversationTouch) && canRepeatMenuReply) {
    const menuTemplate = explicitMenuIntent ? (context.autoResponses.menu_link || '') : (context.autoResponses.welcome || '');
    const renderedMenuReply = fillTemplate(menuTemplate, {
      restaurant_name: context.restaurantName,
      menu_link: menuLink,
      customer_name: customerName,
      order_number: '',
      track_link: ''
    });

    deterministicReplies.push(
      ensureMenuLink(
        renderedMenuReply || (explicitMenuIntent
          ? `📋 Confira nosso cardápio: ${menuLink}`
          : `Olá! 👋 Bem-vindo ao ${context.restaurantName}. Aqui está nosso cardápio: ${menuLink}`),
        menuLink
      )
    );
    if (replyStrategy === 'fallback') {
      replyStrategy = 'menu_auto_reply';
    } else {
      replyStrategy = `multi_intent_${replyStrategy}`;
    }
  } else if (explicitMenuIntent && !canRepeatMenuReply && deterministicReplies.length === 0) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_menu_repeat_silent', 'Pedido de cardapio repetido em curto intervalo; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId,
      recentBotReplyMinutes
    });
    return { ok: true, skipped: true, reason: 'menu_recently_sent', conversationId };
  }

  if (deterministicReplies.length > 0) {
    replyText = Array.from(new Set(deterministicReplies.filter(Boolean))).join('\n\n');
  } else if (!explicitMenuIntent && greetingIntent && menuWasSentToday) {
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_menu_daily_silent', 'Cardapio automatico ja enviado hoje; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId
    });
    return { ok: true, skipped: true, reason: 'menu_sent_today', conversationId };
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
    await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_no_reply_silent', 'Nenhuma intenção acionável; resposta suprimida', {
      instanceName,
      customerPhone,
      conversationId,
      greetingIntent,
      explicitMenuIntent,
      trackIntent,
      openingHoursIntent,
      promotionsIntent
    });
    return { ok: true, skipped: true, reason: 'no_actionable_intent', conversationId };
  }

  await logWhatsAppBotStep(supabase, restaurantId, 'whatsapp_bot_reply_built', 'Resposta do bot montada', {
    instanceName,
    customerPhone,
    replyStrategy,
    replyPreview: replyText.slice(0, 160),
    hasOrder: Boolean(lastOrder?.id),
    isFirstConversationTouch,
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
