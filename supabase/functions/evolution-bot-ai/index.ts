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
    console.log('instanceName:', instanceName);
    console.log('customerPhone:', customerPhone);
    console.log('message:', message);
    console.log('receivedKey:', receivedKey ? 'present' : 'missing');
    return json({ message: 'Teste OK do BoraCume bot' });
  } catch (error) {
    console.error('Erro na function:', error);
    return json({ message: 'Erro interno no bot' });
  }
});
