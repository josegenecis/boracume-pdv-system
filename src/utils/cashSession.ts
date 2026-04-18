import { supabase } from '@/integrations/supabase/client';

export async function getOpenCashRegisterSession(userId?: string | null) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) return null;

  const { data, error } = await supabase
    .from('cash_register_sessions' as any)
    .select('id, opened_at, initial_amount, status')
    .eq('user_id', safeUserId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}
