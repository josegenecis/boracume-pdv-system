import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction'

export const updateOrderStatus = async (
  orderId: string,
  newStatus: string,
  options?: {
    ifoodCancellationCode?: string
    ifoodCancellationReason?: string
    financialCancellation?: {
      reason: string
      adminPin: string
      refundRequested?: boolean
    }
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
    const friendlyMessages: Record<string, string> = {
      cancellation_reason_required: 'Informe o motivo do cancelamento.',
      admin_pin_required: 'Informe a senha/PIN do administrador.',
      invalid_admin_pin: 'Senha/PIN inválido ou operador sem permissão de administrador.',
      open_cash_required: 'Abra o caixa antes de cancelar uma venda.',
      historical_sale_cancellation_blocked:
        'Esta venda pertence a um caixa anterior e não pode mais ser cancelada pela operação diária.',
      cancellation_audit_failed:
        'O cancelamento não foi concluído porque o histórico de auditoria não pôde ser registrado.',
      fiscal_cancellation_failed:
        data?.details?.message || 'O cancelamento fiscal não foi confirmado pela SEFAZ. A venda não foi cancelada.',
    }
    throw new Error(friendlyMessages[String(data?.error || '')] || `${data?.error || 'edge_function_error'}${detailsMsg}`)
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
