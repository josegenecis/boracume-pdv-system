import type { PopAiConversationStatus, PopAiCustomer, PopAiMessageRole, PopAiSettings } from './types.ts';

function normalizePhone(phone: string) {
  return String(phone || '').replace(/\D/g, '');
}

function buildPhoneCandidates(phone: string) {
  const digits = normalizePhone(phone);
  const candidates = new Set<string>([digits, `+${digits}`]);
  if (digits.startsWith('55')) {
    candidates.add(digits.slice(2));
    candidates.add(`+${digits.slice(2)}`);
  }
  return Array.from(candidates).filter(Boolean);
}

export async function getOrCreatePopAiSettings(supabase: any, restaurantId: string): Promise<PopAiSettings> {
  const { data, error } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!error && data) return data as PopAiSettings;

  const payload = {
    restaurant_id: restaurantId,
    enabled: true,
    assistant_name: 'POP AI',
    tone: 'simples',
    human_transfer_message: 'Vou chamar alguém da equipe para te ajudar.',
    upsell_enabled: true,
    max_history_messages: 30
  };

  const created = await supabase
    .from('ai_settings')
    .upsert(payload, { onConflict: 'restaurant_id' })
    .select('*')
    .single();

  if (created.error) {
    return payload as PopAiSettings;
  }

  return created.data as PopAiSettings;
}

export async function getOrCreatePopAiCustomer(
  supabase: any,
  restaurantId: string,
  phone: string,
  fallbackName = 'Cliente WhatsApp'
): Promise<PopAiCustomer | null> {
  const normalizedPhone = normalizePhone(phone);
  const phoneCandidates = buildPhoneCandidates(normalizedPhone);

  const existing = await supabase
    .from('customers')
    .select('id, name, phone, total_orders, average_ticket, last_order_at, last_order_id, preferences, tags')
    .eq('user_id', restaurantId)
    .in('phone', phoneCandidates)
    .maybeSingle();

  let customer = existing.data;
  if (!customer && !existing.error) {
    const created = await supabase
      .from('customers')
      .insert({
        user_id: restaurantId,
        name: fallbackName,
        phone: normalizedPhone,
        last_interaction_at: new Date().toISOString(),
        tags: ['whatsapp']
      })
      .select('id, name, phone, total_orders, average_ticket, last_order_at, last_order_id, preferences, tags')
      .single();
    customer = created.data;
  }

  if (!customer) return null;

  const orders = await supabase
    .from('orders')
    .select('id, total, created_at')
    .eq('user_id', restaurantId)
    .in('customer_phone', phoneCandidates)
    .order('created_at', { ascending: false })
    .limit(200);

  const totalOrders = Array.isArray(orders.data) ? orders.data.length : Number(customer.total_orders || 0);
  const sum = Array.isArray(orders.data)
    ? orders.data.reduce((acc: number, order: any) => acc + Number(order?.total || 0), 0)
    : 0;
  const lastOrder = Array.isArray(orders.data) ? orders.data[0] : null;
  const averageTicket = totalOrders > 0 ? Number((sum / totalOrders).toFixed(2)) : Number(customer.average_ticket || 0);
  const tags = Array.from(new Set([...(customer.tags || []), 'whatsapp', totalOrders > 0 ? 'cliente_com_pedido' : 'lead_whatsapp'].filter(Boolean)));

  await supabase
    .from('customers')
    .update({
      last_interaction_at: new Date().toISOString(),
      total_orders: totalOrders,
      average_ticket: averageTicket,
      last_order_at: lastOrder?.created_at || customer.last_order_at || null,
      last_order_id: lastOrder?.id || customer.last_order_id || null,
      tags
    })
    .eq('id', customer.id);

  return {
    ...customer,
    total_orders: totalOrders,
    average_ticket: averageTicket,
    last_order_at: lastOrder?.created_at || customer.last_order_at || null,
    last_order_id: lastOrder?.id || customer.last_order_id || null,
    tags
  };
}

export async function upsertPopAiConversation(
  supabase: any,
  restaurantId: string,
  customerId: string | null,
  phone: string,
  aiEnabled = true
) {
  const payload = {
    restaurant_id: restaurantId,
    customer_id: customerId,
    phone: normalizePhone(phone),
    ai_enabled: aiEnabled,
    last_message_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('ai_conversations')
    .upsert(payload, { onConflict: 'restaurant_id,phone' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function savePopAiMessage(
  supabase: any,
  conversation: any,
  role: PopAiMessageRole,
  message: string,
  metadata: Record<string, unknown> = {}
) {
  if (!conversation?.id || !message) return;
  await supabase.from('ai_messages').insert({
    conversation_id: conversation.id,
    restaurant_id: conversation.restaurant_id,
    customer_id: conversation.customer_id || null,
    role,
    message,
    channel: 'whatsapp',
    metadata
  });
}

export async function getConversationHistory(supabase: any, conversationId: string, limit = 30) {
  const { data } = await supabase
    .from('ai_messages')
    .select('role, message, created_at, metadata')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).reverse();
}

export async function updatePopAiConversationStatus(
  supabase: any,
  conversationId: string,
  status: PopAiConversationStatus,
  metadata: Record<string, unknown> = {}
) {
  await supabase
    .from('ai_conversations')
    .update({
      status,
      metadata,
      last_message_at: new Date().toISOString()
    })
    .eq('id', conversationId);
}

export async function syncLegacyConversationAiState(
  supabase: any,
  legacyConversationId: string | null | undefined,
  aiConversationId: string,
  status: PopAiConversationStatus
) {
  if (!legacyConversationId) return;
  await supabase
    .from('whatsapp_conversations')
    .update({
      ai_conversation_id: aiConversationId,
      ai_status: status,
      human_required: status === 'human_required' || status === 'human_active',
      updated_at: new Date().toISOString()
    })
    .eq('id', legacyConversationId);
}

export async function logPopAiAction(
  supabase: any,
  restaurantId: string,
  conversationId: string | null,
  action: string,
  input?: unknown,
  output?: unknown,
  error?: unknown
) {
  await supabase.from('ai_logs').insert({
    restaurant_id: restaurantId,
    conversation_id: conversationId,
    action,
    input: input ?? null,
    output: output ?? null,
    error: error ? String((error as any)?.message || error) : null
  });
}
