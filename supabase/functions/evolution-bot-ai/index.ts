// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { buildPhoneCandidates, extractPhoneFromRemoteJid, normalizePhone } from '../_shared/restaurant-whatsapp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-boracume-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function getEnv(name: string, fallback = '') {
  return String(Deno.env.get(name) || fallback).trim();
}

function userMessage(message: string, status = 200) {
  return new Response(JSON.stringify({ message }), { status, headers: corsHeaders });
}

function parseRestaurantIdFromToken(value: unknown) {
  const token = String(value || '').trim();
  const raw = token.startsWith('token_') ? token.slice(6) : '';
  if (!/^[a-f0-9]{32}$/i.test(raw)) return '';
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function pickInstanceName(body: any) {
  return String(
    body?.instance ||
    body?.instanceName ||
    body?.data?.instance ||
    body?.data?.instanceName ||
    body?.bot?.instance ||
    body?.session?.instance ||
    ''
  ).trim();
}

function pickApiKey(req: Request, body: any) {
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  return String(
    body?.apiKey ||
    body?.inputs?.apiKey ||
    body?.data?.apiKey ||
    body?.data?.apikey ||
    req.headers.get('apikey') ||
    req.headers.get('x-api-key') ||
    req.headers.get('x-boracume-key') ||
    bearerToken ||
    ''
  ).trim();
}

function pickText(body: any): string {
  const direct = [
    body?.message,
    body?.text,
    body?.content,
    body?.prompt,
    body?.inputs?.message,
    body?.inputs?.text,
    body?.inputs?.content,
    body?.data?.text,
    body?.data?.message,
    body?.messageData?.text
  ].find((item) => typeof item === 'string' && item.trim());
  if (typeof direct === 'string') return direct.trim();

  const msg = body?.data?.message || body?.messageData || body?.messagePayload;
  if (!msg || typeof msg !== 'object') return '';
  if (typeof msg.conversation === 'string') return msg.conversation.trim();
  if (msg.extendedTextMessage?.text) return String(msg.extendedTextMessage.text).trim();
  if (msg.imageMessage?.caption) return String(msg.imageMessage.caption).trim();
  if (msg.videoMessage?.caption) return String(msg.videoMessage.caption).trim();
  if (msg.documentMessage?.caption) return String(msg.documentMessage.caption).trim();
  if (msg.buttonsResponseMessage?.selectedDisplayText) return String(msg.buttonsResponseMessage.selectedDisplayText).trim();
  if (msg.listResponseMessage?.title) return String(msg.listResponseMessage.title).trim();
  return '';
}

function pickPhone(body: any) {
  const explicit = [
    body?.customerPhone,
    body?.phone,
    body?.number,
    body?.inputs?.remoteJid,
    body?.inputs?.number,
    body?.customer?.phone,
    body?.data?.phone,
    body?.data?.number
  ].find((item) => typeof item === 'string' && item.trim());

  if (explicit) return normalizePhone(String(explicit));

  const remoteJid =
    body?.remoteJid ||
    body?.inputs?.remoteJid ||
    body?.data?.remoteJid ||
    body?.data?.key?.remoteJid ||
    body?.messageData?.key?.remoteJid ||
    '';

  return extractPhoneFromRemoteJid(remoteJid);
}

function normalizeHistory(history: any[]) {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => {
      const role = item?.role === 'assistant' ? 'assistant' : 'user';
      const content = String(item?.content || '').trim();
      if (!content) return null;
      return {
        role,
        content: [{ type: 'input_text', text: content }]
      };
    })
    .filter(Boolean);
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const texts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      const text = content?.text || content?.value || '';
      if (typeof text === 'string' && text.trim()) texts.push(text.trim());
    }
  }

  return texts.join('\n').trim();
}

function buildSystemPrompt(context: {
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  latestOrders: any[];
  menuHighlights: any[];
  whatsappEnabled: boolean;
  defaultMessage: string;
  autoResponses: any;
}) {
  const ordersText = context.latestOrders.length
    ? context.latestOrders
        .map((order) => `- Pedido #${order.order_number || 'sem número'} | status: ${order.status || 'desconhecido'} | criado em: ${order.created_at || '-'} | cliente: ${order.customer_name || context.customerName}`)
        .join('\n')
    : '- Nenhum pedido encontrado para este cliente';

  const menuText = context.menuHighlights.length
    ? context.menuHighlights
        .map((product) => `- ${product.name} | ${product.category || 'Sem categoria'} | R$ ${Number(product.price || 0).toFixed(2)}`)
        .join('\n')
    : '- Cardápio não carregado';

  const autoResponsesText = JSON.stringify(context.autoResponses || {});

  return [
    'Você é o assistente oficial do BoraCumê para atendimento de restaurante no WhatsApp.',
    'Responda em português do Brasil, de forma humana, objetiva, cordial e natural.',
    'Priorize ajudar o cliente com cardápio, pedido, acompanhamento, dúvidas e orientação de compra.',
    'Nunca invente pedidos, produtos, preços ou políticas que não estejam no contexto.',
    'Se faltar dado essencial, responda de forma útil e honesta, sem mencionar detalhes técnicos.',
    'Não mencione OpenAI, modelo, prompt, JSON, contexto interno ou Supabase.',
    'Retorne somente o texto final que deve ser enviado ao WhatsApp.',
    '',
    `Restaurante: ${context.restaurantName}`,
    `Cliente: ${context.customerName}`,
    `Telefone do cliente: ${context.customerPhone}`,
    `WhatsApp habilitado: ${context.whatsappEnabled ? 'sim' : 'não'}`,
    `Mensagem padrão do restaurante: ${context.defaultMessage || 'não definida'}`,
    `Auto responses configuradas: ${autoResponsesText}`,
    '',
    'Últimos pedidos do cliente:',
    ordersText,
    '',
    'Produtos em destaque do cardápio:',
    menuText
  ].join('\n');
}

function buildUserPrompt(message: string, restaurantName: string) {
  return [
    `Mensagem recebida no WhatsApp do restaurante ${restaurantName}:`,
    message
  ].join('\n');
}

async function transcribeAudioIfPossible(apiKey: string, media: any) {
  const base64 = String(media?.base64 || '').trim();
  if (!apiKey || !base64 || String(media?.type || '') !== 'audio') return '';
  const mimeType = String(media?.mimeType || 'audio/ogg');
  const ext = mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'ogg';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append('model', getEnv('OPENAI_TRANSCRIPTION_MODEL', 'gpt-4o-mini-transcribe'));
  form.append('file', new Blob([bytes], { type: mimeType }), `audio.${ext}`);
  form.append('language', 'pt');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return '';
  return String(data?.text || '').trim();
}

async function openAiAssistantReply(params: {
  apiKey: string;
  model: string;
  system: string;
  userPrompt: string;
  history: any[];
  media?: any;
}) {
  const content: any[] = [{ type: 'text', text: params.userPrompt }];
  const media = params.media || null;
  const mediaType = String(media?.type || '');
  const mimeType = String(media?.mimeType || 'image/jpeg');
  const base64 = String(media?.base64 || '').trim();
  const url = String(media?.url || '').trim();

  if (mediaType === 'image' && (base64 || /^https?:\/\//i.test(url))) {
    content.push({
      type: 'image_url',
      image_url: {
        url: base64 ? `data:${mimeType};base64,${base64}` : url
      }
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.35,
      messages: [
        { role: 'system', content: params.system },
        ...params.history.map((item: any) => ({
          role: item?.role === 'assistant' ? 'assistant' : 'user',
          content: String(item?.content || '')
        })).filter((item: any) => item.content),
        { role: 'user', content }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Falha ao consultar IA');
  }
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return userMessage('Método não permitido', 405);

  try {
    const body = await req.json().catch(() => null);
    const safeBody = body && typeof body === 'object' ? body : {};
    const receivedKey = pickApiKey(req, safeBody);
    console.log('Headers recebidos:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    console.log('Body recebido:', JSON.stringify(safeBody));

    const message = pickText(safeBody);
    const customerPhone = pickPhone(safeBody);
    const instanceName = pickInstanceName(safeBody);
    const restaurantId = String(safeBody?.restaurantId || safeBody?.userId || safeBody?.inputs?.restaurantId || '').trim();
    const internalKey = getEnv('BORACUME_INTERNAL_KEY', getEnv('BOT_WEBHOOK_SECRET'));
    const openAiKey = getEnv('OPENAI_API_KEY');
    const openAiModel = getEnv('OPENAI_BOT_MODEL', getEnv('OPENAI_MODEL', 'gpt-4.1-mini'));
    console.log('instanceName:', instanceName);
    console.log('customerPhone:', customerPhone);
    console.log('message:', message);
    console.log('receivedKey:', receivedKey ? 'present' : 'missing');
    if (internalKey && receivedKey !== internalKey) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (!restaurantId || !customerPhone) {
      return json({ message: '' });
    }
    if (!openAiKey) {
      return json({ message: '' });
    }

    const SUPABASE_URL = getEnv('SUPABASE_URL');
    const SERVICE_ROLE_KEY = getEnv('SERVICE_ROLE_KEY', getEnv('SUPABASE_SERVICE_ROLE_KEY'));
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ message: '' });
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const phoneCandidates = buildPhoneCandidates(customerPhone);
    const [profileResult, settingsResult, customerResult, ordersResult, productsResult] = await Promise.all([
      supabase.from('profiles').select('restaurant_name').eq('id', restaurantId).maybeSingle(),
      supabase.from('whatsapp_settings').select('enabled, default_message, auto_responses').eq('user_id', restaurantId).maybeSingle(),
      supabase.from('customers').select('name').eq('user_id', restaurantId).in('phone', phoneCandidates).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('orders').select('order_number,status,created_at,customer_name').eq('user_id', restaurantId).in('customer_phone', phoneCandidates).order('created_at', { ascending: false }).limit(5),
      supabase.from('products').select('name,category,price,description,available').eq('user_id', restaurantId).eq('available', true).order('updated_at', { ascending: false }).limit(80)
    ]);

    const restaurantName = String(profileResult?.data?.restaurant_name || 'restaurante').trim();
    const customerName = String(customerResult?.data?.name || 'cliente').trim();
    const media = safeBody?.media || null;
    let effectiveMessage = message;
    const transcription = await transcribeAudioIfPossible(openAiKey, media).catch(() => '');
    if (transcription) effectiveMessage = transcription;
    if (!effectiveMessage && media?.type === 'image') effectiveMessage = String(media?.caption || 'Cliente enviou uma imagem. Analise a imagem e ajude no atendimento.').trim();

    const system = buildSystemPrompt({
      restaurantName,
      customerName,
      customerPhone,
      latestOrders: Array.isArray(ordersResult?.data) ? ordersResult.data : [],
      menuHighlights: Array.isArray(productsResult?.data) ? productsResult.data : [],
      whatsappEnabled: settingsResult?.data?.enabled !== false,
      defaultMessage: String(settingsResult?.data?.default_message || ''),
      autoResponses: settingsResult?.data?.auto_responses || {}
    }) + '\n\nSe a mensagem indicar pedido complexo, ajude a coletar dados sem inventar itens. Seja curto e profissional.';

    const reply = await openAiAssistantReply({
      apiKey: openAiKey,
      model: openAiModel,
      system,
      userPrompt: buildUserPrompt(effectiveMessage, restaurantName),
      history: Array.isArray(safeBody?.conversationHistory) ? safeBody.conversationHistory : [],
      media
    });

    return json({ message: reply, transcription });
  } catch (error) {
    console.error('Erro na function:', error);
    return json({ message: 'Erro interno no bot' });
  }
});
