import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction'

export const updateOrderStatus = async (
  orderId: string,
  newStatus: string,
  options?: {
    ifoodCancellationCode?: string
    ifoodCancellationReason?: string
  }
) => {
  const operationId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  let result = await invokeEdgeFunction('orders-update-status', {
    orderId,
    newStatus,
    id: orderId,
    status: newStatus,
    operationId,
    ...options,
  })

  // A atualização no servidor é idempotente. Uma nova tentativa cobre quedas
  // momentâneas de rede sem executar o aceite duas vezes.
  if (result.status >= 500) {
    result = await invokeEdgeFunction('orders-update-status', {
      orderId,
      newStatus,
      id: orderId,
      status: newStatus,
      operationId,
      ...options,
    })
  }

  const { data, status } = result

  if (status >= 400) {
    throw new Error(String(data?.error || `http_${status}`))
  }

  if (!data?.ok || !data?.order) {
    const detailsMsg = data?.details?.message ? `: ${data.details.message}` : ''
    throw new Error(`${data?.error || 'edge_function_error'}${detailsMsg}`)
  }

  return {
    ...data.order,
    __operation: {
      whatsapp: data.whatsapp || null,
      deliveryOffer: data.deliveryOffer || null,
      idempotent: Boolean(data.idempotent),
      operationId: data.operationId || operationId,
    },
  }
}
