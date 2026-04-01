// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-evolution-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function json(res: any, status = 200) {
  return new Response(JSON.stringify(res), { status, headers: corsHeaders });
}

function toTextFromMessage(msg: any): string {
  if (!msg || typeof msg !== 'object') return '';
  if (typeof msg.conversation === 'string') return msg.conversation;
  if (msg.extendedTextMessage?.text) return String(msg.extendedTextMessage.text);
  if (msg.imageMessage?.caption) return String(msg.imageMessage.caption);
  if (msg.videoMessage?.caption) return String(msg.videoMessage.caption);
  if (msg.documentMessage?.caption) return String(msg.documentMessage.caption);
  if (msg.buttonsResponseMessage?.selectedDisplayText) return String(msg.buttonsResponseMessage.selectedDisplayText);
  if (msg.listResponseMessage?.title) return String(msg.listResponseMessage.title);
  return '';
}

function normalizeNumber(remoteJid: string): string {
  const digits = String(remoteJid || '').split('@')[0].replace(/\D/g, '');
  return digits;
}

function pickInstanceName(body: any): string {
  const fromBody = String(body?.instance || body?.instanceName || body?.data?.instance || body?.data?.instanceName || '').trim();
  if (fromBody) return fromBody;
  // @ts-ignore
  return String(Deno.env.get('EVOLUTION_DEFAULT_INSTANCE') || '').trim();
}

function getUserIdForInstance(instance: string): string {
  // @ts-ignore
  const mapRaw = Deno.env.get('EVOLUTION_INSTANCE_USER_MAP') || '';
  // @ts-ignore
  const fallback = Deno.env.get('EVOLUTION_DEFAULT_USER_ID') || '';
  if (mapRaw) {
    try {
      const parsed = JSON.parse(mapRaw);
      const v = parsed?.[instance];
      if (typeof v === 'string' && v.trim()) return v.trim();
    } catch {}
  }
  return String(fallback || '').trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Method Not Allowed' }, 405);

  // @ts-ignore
  const EVOLUTION_WEBHOOK_SECRET = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
  const headerToken = req.headers.get('x-evolution-token') || '';
  const urlToken = new URL(req.url).searchParams.get('token') || '';
  const token = headerToken || urlToken;
  if (EVOLUTION_WEBHOOK_SECRET && token !== EVOLUTION_WEBHOOK_SECRET) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  // @ts-ignore
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  // @ts-ignore
  const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // @ts-ignore
  const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL') || '';
  // @ts-ignore
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
  // @ts-ignore
  const BORACUME_INTERNAL_KEY = Deno.env.get('BORACUME_INTERNAL_KEY') || Deno.env.get('BOT_WEBHOOK_SECRET') || '';

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ success: false, error: 'Supabase env missing' }, 500);
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY) return json({ success: false, error: 'Evolution env missing' }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const event = String(body?.event || body?.type || '').trim().toUpperCase().replace(/[.\-\s]+/g, '_');
  if (event && event !== 'MESSAGES_UPSERT') {
    return json({ success: true, ignored: true });
  }

  const instance = pickInstanceName(body);
  const userId = getUserIdForInstance(instance);
  if (!userId) return json({ success: false, error: 'User not mapped for instance' }, 400);

  const data = body?.data || body;
  const fromMe = Boolean(data?.key?.fromMe);
  if (fromMe) return json({ success: true, ignored: true });

  const remoteJid = String(data?.key?.remoteJid || '');
  if (!remoteJid || remoteJid.includes('@g.us')) return json({ success: true, ignored: true });

  const customerPhone = normalizeNumber(remoteJid);
  const text = toTextFromMessage(data?.message);
  if (!customerPhone || !text) return json({ success: true, ignored: true });

  const { data: convo } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();

  let conversationId = convo?.id as string | undefined;
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from('whatsapp_conversations')
      .insert({ user_id: userId, customer_phone: customerPhone, status: 'open' })
      .select('id')
      .single();
    if (error) return json({ success: false, error: error.message }, 500);
    conversationId = created.id;
  }

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: text,
    sender: 'customer',
    message_type: 'text',
    delivered: true
  });

  const { data: history } = await supabase
    .from('whatsapp_messages')
    .select('sender, content, sent_at')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
    .limit(20);

  const conversationHistory = (history || []).map((m: any) => ({
    role: m.sender === 'customer' ? 'user' : 'assistant',
    content: String(m.content || '')
  }));

  const aiResp = await fetch(`${SUPABASE_URL}/functions/v1/evolution-bot-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-boracume-key': BORACUME_INTERNAL_KEY
    },
    body: JSON.stringify({
      message: text,
      restaurantId: userId,
      customerPhone,
      instance,
      conversationHistory
    })
  });

  const aiData = await aiResp.json().catch(() => null);
  const replyText = String(aiData?.message || aiData?.error || 'Certo.');

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content: replyText,
    sender: 'bot',
    message_type: 'text',
    delivered: true
  });

  const sendResp = await fetch(`${EVOLUTION_BASE_URL.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_API_KEY
    },
    body: JSON.stringify({
      number: customerPhone,
      text: replyText,
      delay: 400,
      linkPreview: true
    })
  });

  if (!sendResp.ok) {
    const errText = await sendResp.text();
    return json({ success: false, error: 'Failed to send message', details: errText }, 502);
  }

  return json({ success: true });
});
