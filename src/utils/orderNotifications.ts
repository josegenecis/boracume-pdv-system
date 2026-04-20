import { supabase } from '@/integrations/supabase/client';

export async function notifyOrderCreatedById(orderId: string | null | undefined) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) {
    return { ok: false, skipped: true };
  }

  const { data, error } = await supabase.functions.invoke('whatsapp-order-created', {
    body: { orderId: normalizedOrderId }
  });

  if (error) {
    throw error;
  }

  return data;
}
