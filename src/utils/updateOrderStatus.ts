import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction'

export const updateOrderStatus = async (orderId: string, newStatus: string) => {
  const { data, status } = await invokeEdgeFunction('orders-update-status', {
    orderId,
    newStatus,
    id: orderId,
    status: newStatus
  })

  if (status >= 400) {
    throw new Error(String(data?.error || `http_${status}`))
  }

  if (!data?.ok || !data?.order) {
    const detailsMsg = data?.details?.message ? `: ${data.details.message}` : ''
    throw new Error(`${data?.error || 'edge_function_error'}${detailsMsg}`)
  }

  return data.order
}
