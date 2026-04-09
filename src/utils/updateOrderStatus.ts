import { supabase } from '@/integrations/supabase/client'

export const updateOrderStatus = async (orderId: string, newStatus: string) => {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token || ''

  const { data, error } = await supabase.functions.invoke('orders-update-status', {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: { orderId, newStatus, id: orderId, status: newStatus }
  })

  if (error) throw error
  if (!data?.ok || !data?.order) {
    const detailsMsg = data?.details?.message ? `: ${data.details.message}` : ''
    throw new Error(`${data?.error || 'edge_function_error'}${detailsMsg}`)
  }

  return data.order
}
