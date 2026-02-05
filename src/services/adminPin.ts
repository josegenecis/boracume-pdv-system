import { supabase } from '@/integrations/supabase/client'

export const verifyAdminPin = async (params: { restaurantUserId: string; pin: string }) => {
  const { data, error } = await supabase
    .from('waiters' as any)
    .select('id, role, permissions')
    .eq('user_id', params.restaurantUserId)
    .eq('active', true)
    .eq('pin', params.pin)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return { ok: false }
  const role = (data as any).role || 'cashier'
  const perms = (data as any).permissions || {}
  const isAdmin = role === 'admin' || perms?.admin === true
  return { ok: isAdmin, waiterId: (data as any).id as string }
}

