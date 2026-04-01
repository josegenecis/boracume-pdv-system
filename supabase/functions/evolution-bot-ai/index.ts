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

function pickText(body: any): string {
  const direct = [
    body?.message,
    body?.text,
    body?.content,
    body?.prompt,
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
    body?.customer?.phone,
    body?.data?.phone,
    body?.data?.number
  ].find((item) => typeof item === 'string' && item.trim());

  if (explicit) return normalizePhone(String(explicit));

  const remoteJid =
    body?.remoteJid ||
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const BORACUME_INTERNAL_KEY = getEnv('BORACUME_INTERNAL_KEY');
    const internalKeyHeader = req.headers.get('x-boracume-key') || '';
    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    if (BORACUME_INTERNAL_KEY && internalKeyHeader !== BORACUME_INTERNAL_KEY && bearerToken !== BORACUME_INTERNAL_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');
    const OPENAI_MODEL = getEnv('OPENAI_MODEL', 'gpt-5.4-mini') || 'gpt-5.4-mini';
    const EVOLUTION_API_KEY = getEnv('EVOLUTION_API_KEY');
    const EVOLUTION_BASE_URL = getEnv('EVOLUTION_BASE_URL');
    const SUPABASE_URL = getEnv('SUPABASE_URL');
    const SERVICE_ROLE_KEY = getEnv('SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY não configurada' }, 500);
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: 'Supabase não configurado' }, 500);
    if (!EVOLUTION_API_KEY || !EVOLUTION_BASE_URL) return json({ error: 'Evolution não configurado' }, 500);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'JSON inválido' }, 400);

    const message = pickText(body);
    const customerPhone = pickPhone(body);
    const phoneCandidates = buildPhoneCandidates(customerPhone);
    const instanceName = pickInstanceName(body);
    let restaurantId = String(body?.restaurantId || body?.userId || body?.restaurant_id || '').trim();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (!restaurantId && instanceName) {
      const { data: instanceRow } = await supabase
        .from('whatsapp_instances')
        .select('restaurant_id, instance_name')
        .eq('instance_name', instanceName)
        .maybeSingle();
      restaurantId = String(instanceRow?.restaurant_id || '').trim();
    }

    if (!restaurantId && body?.restaurantName) {
      const { data: profileByName } = await supabase
        .from('profiles')
        .select('id')
        .eq('restaurant_name', String(body.restaurantName).trim())
        .maybeSingle();
      restaurantId = String(profileByName?.id || '').trim();
    }

    if (!restaurantId) {
      restaurantId = parseRestaurantIdFromToken(body?.token || body?.apikey || body?.data?.token || body?.data?.apikey);
    }

    if (!restaurantId) return json({ error: 'Restaurante não identificado' }, 400);
    if (!message) return json({ error: 'Mensagem não encontrada' }, 400);

    const [
      profileResult,
      settingsResult,
      customerResult,
      ordersResult,
      productsResult
    ] = await Promise.all([
      supabase.from('profiles').select('id, restaurant_name').eq('id', restaurantId).maybeSingle(),
      supabase.from('whatsapp_settings').select('enabled, ai_enabled, default_message, auto_responses').eq('user_id', restaurantId).maybeSingle(),
      phoneCandidates.length
        ? supabase.from('customers').select('id, name, phone, updated_at').eq('user_id', restaurantId).in('phone', phoneCandidates).maybeSingle()
        : Promise.resolve({ data: null }),
      phoneCandidates.length
        ? supabase
            .from('orders')
            .select('id, order_number, status, created_at, customer_name, customer_phone')
            .eq('user_id', restaurantId)
            .in('customer_phone', phoneCandidates)
            .order('created_at', { ascending: false })
            .limit(3)
        : Promise.resolve({ data: [] }),
      supabase
        .from('products')
        .select('name, price, category, available')
        .eq('user_id', restaurantId)
        .eq('available', true)
        .order('updated_at', { ascending: false })
        .limit(12)
    ]);

    const restaurantName = String(profileResult?.data?.restaurant_name || body?.restaurantName || 'BoraCumê').trim();
    const customerName = String(body?.customerName || customerResult?.data?.name || 'Cliente').trim();
    const systemPrompt = buildSystemPrompt({
      restaurantName,
      customerName,
      customerPhone,
      latestOrders: Array.isArray(ordersResult?.data) ? ordersResult.data : [],
      menuHighlights: Array.isArray(productsResult?.data) ? productsResult.data : [],
      whatsappEnabled: settingsResult?.data?.enabled !== false,
      defaultMessage: String(settingsResult?.data?.default_message || '').trim(),
      autoResponses: settingsResult?.data?.auto_responses || {}
    });

    const history = normalizeHistory(body?.conversationHistory || body?.history || []);
    const input = [
      ...history,
      {
        role: 'user',
        content: [{ type: 'input_text', text: buildUserPrompt(message, restaurantName) }]
      }
    ];

    const openAIResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: systemPrompt,
        input,
        max_output_tokens: 350
      })
    });

    const openAIData = await openAIResp.json().catch(() => null);
    if (!openAIResp.ok) {
      return json({
        error: 'Falha ao consultar OpenAI',
        details: String(openAIData?.error?.message || openAIData?.message || openAIResp.statusText || 'unknown_error')
      }, 502);
    }

    const finalMessage = extractResponseText(openAIData) || `Olá! Sou o assistente do ${restaurantName}. Como posso ajudar?`;
    return json({ message: finalMessage });
  } catch (error) {
    return json({ error: String((error as Error)?.message || error || 'unknown_error') }, 500);
  }
});
