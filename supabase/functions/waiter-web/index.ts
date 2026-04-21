import { corsHeaders, fail, getWaiterSession, ok } from '../_shared/waiter-web.ts'

const EPSILON = 0.009

type KitchenStatus = 'idle' | 'sent' | 'preparing' | 'ready' | 'delivered'
type AccountStatus = 'open' | 'preparing' | 'ready' | 'check_requested' | 'partially_paid' | 'paid'
type TableStatus = 'free' | 'occupied' | 'preparing' | 'ready' | 'check_requested' | 'partially_paid'

const minutesSince = (value: string) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
const normalizeAmount = (value: unknown) => Number(value || 0)
const isEffectivelyZero = (value: number) => Math.abs(value) <= EPSILON

const orderStatusLabel: Record<string, string> = {
  pending: 'enviado',
  accepted: 'aceito',
  preparing: 'em preparo',
  ready: 'pronto',
  in_delivery: 'entregue no balcao',
  delivered: 'finalizado',
  completed: 'finalizado',
  cancelled: 'cancelado',
}

const buildOptionsMap = (rows: any[]) => {
  const map = new Map<string, any[]>()

  rows.forEach((row) => {
    const current = map.get(row.order_item_id) ?? []
    current.push({
      id: row.id,
      orderItemId: row.order_item_id,
      optionName: row.option_name,
      price: normalizeAmount(row.price),
      quantity: Math.max(1, Number(row.quantity || 1)),
    })
    map.set(row.order_item_id, current)
  })

  return map
}

const buildItemTotal = (row: any, options: any[]) => {
  const unitPrice = normalizeAmount(row.unit_price ?? row.price)
  const quantity = Math.max(1, Number(row.quantity || 1))
  const optionsTotal = options.reduce((sum, option) => sum + normalizeAmount(option.price) * Math.max(1, Number(option.quantity || 1)), 0)
  return unitPrice * quantity + optionsTotal
}

const buildProductVariationGroups = (productId: string, specificRows: any[], linkRows: any[], globalRows: any[]) => {
  const directGroups = specificRows
    .filter((row) => row.product_id === productId)
    .map((row) => ({
      id: row.id,
      name: String(row.name),
      required: Boolean(row.required),
      maxSelections: Math.max(1, Number(row.max_selections ?? 1)),
      options: Array.isArray(row.options)
        ? row.options.map((option: any, index: number) => ({
            id: `${row.id}-${index}-${option.name}`,
            name: String(option.name),
            price: normalizeAmount(option.price),
          }))
        : [],
    }))

  const links = linkRows.filter((row) => row.product_id === productId)
  const globalGroups = links
    .map((link) => {
      const globalRow = globalRows.find((row) => row.id === link.global_variation_id)
      if (!globalRow) return null

      return {
        id: String(globalRow.id),
        name: String(globalRow.name),
        required: Boolean(link.required ?? globalRow.required),
        maxSelections: Math.max(1, Number(link.max_selections ?? globalRow.max_selections ?? 1)),
        options: Array.isArray(globalRow.options)
          ? globalRow.options.map((option: any, index: number) => ({
              id: `${globalRow.id}-${index}-${option.name}`,
              name: String(option.name),
              price: normalizeAmount(option.price),
            }))
          : [],
      }
    })
    .filter(Boolean)

  return [...directGroups, ...globalGroups]
}

const mapTableRecordStatus = (status?: string | null): TableStatus => {
  if (status === 'payment_pending') return 'check_requested'
  if (status === 'serving') return 'preparing'
  if (status === 'occupied' || status === 'reserved') return 'occupied'
  return 'free'
}

const mapOrderToKitchenStatus = (status?: string | null): KitchenStatus => {
  if (status === 'ready') return 'ready'
  if (status === 'preparing') return 'preparing'
  if (status === 'delivered' || status === 'completed' || status === 'in_delivery') return 'delivered'
  if (status === 'cancelled') return 'idle'
  return 'sent'
}

const mapOrderItemStatus = (itemStatus?: string | null, orderStatus?: string | null) => {
  if (itemStatus === 'draft') return 'draft'
  if (itemStatus === 'cancelled') return 'cancelled'
  if (orderStatus === 'preparing') return 'preparing'
  if (orderStatus === 'ready') return 'ready'
  if (orderStatus === 'delivered' || orderStatus === 'completed' || orderStatus === 'in_delivery') return 'delivered'
  if (orderStatus === 'cancelled') return 'cancelled'
  return 'sent'
}

const pickKitchenStatus = (statuses: KitchenStatus[]): KitchenStatus => {
  if (statuses.includes('ready')) return 'ready'
  if (statuses.includes('preparing')) return 'preparing'
  if (statuses.includes('sent')) return 'sent'
  if (statuses.includes('delivered')) return 'delivered'
  return 'idle'
}

const deriveAccountStatus = ({
  total,
  paidTotal,
  dueAmount,
  kitchenStatus,
  sessionStatus,
}: {
  total: number
  paidTotal: number
  dueAmount: number
  kitchenStatus: KitchenStatus
  sessionStatus: string
}): AccountStatus => {
  if (!isEffectivelyZero(total) && isEffectivelyZero(dueAmount)) return 'paid'
  if (paidTotal > EPSILON) return 'partially_paid'
  if (sessionStatus === 'payment_pending') return 'check_requested'
  if (kitchenStatus === 'ready') return 'ready'
  if (kitchenStatus === 'preparing' || kitchenStatus === 'sent') return 'preparing'
  return 'open'
}

const deriveTableStatus = ({
  hasSession,
  total,
  paidTotal,
  dueAmount,
  kitchenStatus,
  sessionStatus,
}: {
  hasSession: boolean
  total: number
  paidTotal: number
  dueAmount: number
  kitchenStatus: KitchenStatus
  sessionStatus: string
}): TableStatus => {
  if (!hasSession) return 'free'
  if (!isEffectivelyZero(total) && isEffectivelyZero(dueAmount)) return 'free'
  if (paidTotal > EPSILON) return 'partially_paid'
  if (sessionStatus === 'payment_pending') return 'check_requested'
  if (kitchenStatus === 'ready') return 'ready'
  if (kitchenStatus === 'preparing' || kitchenStatus === 'sent') return 'preparing'
  return 'occupied'
}

async function requireOpenCashSession(supabase: any, restaurantId: string) {
  const { data, error } = await supabase
    .from('cash_register_sessions')
    .select('id')
    .eq('user_id', restaurantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  if (!data?.id) {
    return fail('Abra o caixa antes de operar mesas.', 400)
  }

  return null
}

async function listTransferTables(supabase: any, restaurantId: string, currentSessionId?: string) {
  const { data: tableRows, error: tableError } = await supabase
    .from('tables')
    .select('*')
    .eq('user_id', restaurantId)
    .order('table_number')

  if (tableError) throw tableError

  const { data: sessionRows, error: sessionError } = await supabase
    .from('table_sessions')
    .select('id, table_id, status')
    .eq('user_id', restaurantId)
    .in('status', ['open', 'serving', 'payment_pending'])

  if (sessionError) throw sessionError

  const sessionByTableId = new Map<string, any>()
  ;(sessionRows ?? []).forEach((row: any) => {
    sessionByTableId.set(row.table_id, row)
  })

  return (tableRows ?? []).map((row: any) => {
    const session = sessionByTableId.get(row.id)
    const isCurrentSession = Boolean(session?.id && currentSessionId && session.id === currentSessionId)

    return {
      id: row.id,
      number: Number(row.table_number),
      location: row.location,
      capacity: Number(row.capacity ?? 0),
      status: isCurrentSession ? 'current' : session ? 'occupied' : 'free',
      sessionId: session?.id ?? null,
      canReceiveTableTransfer: !session || isCurrentSession,
      canReceiveAccountTransfer: !session || session.id !== currentSessionId,
    }
  })
}

async function getNextAccountNumber(supabase: any, sessionId: string) {
  const { data, error } = await supabase
    .from('table_accounts')
    .select('account_number')
    .eq('session_id', sessionId)
    .order('account_number', { ascending: false })
    .limit(1)

  if (error) throw error

  return Number(data?.[0]?.account_number ?? 0) + 1
}

async function getSessionSnapshot(supabase: any, sessionId: string) {
  const { data: sessionRow, error: sessionError } = await supabase
    .from('table_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError) throw sessionError

  const { data: tableRow, error: tableError } = await supabase
    .from('tables')
    .select('*')
    .eq('id', sessionRow.table_id)
    .single()

  if (tableError) throw tableError

  const { data: accountRows, error: accountError } = await supabase
    .from('table_accounts')
    .select('*')
    .eq('session_id', sessionId)
    .order('account_number')

  if (accountError) throw accountError

  const accountIds = (accountRows ?? []).map((row: any) => row.id)

  const { data: itemRows, error: itemError } = accountIds.length
    ? await supabase
        .from('order_items')
        .select('*')
        .in('account_id', accountIds)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true })
    : { data: [], error: null }

  if (itemError) throw itemError

  const itemIds = (itemRows ?? []).map((row: any) => row.id)

  const { data: optionRows, error: optionError } = itemIds.length
    ? await supabase
        .from('order_item_options')
        .select('*')
        .in('order_item_id', itemIds)
    : { data: [], error: null }

  if (optionError) throw optionError

  const { data: paymentRows, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (paymentError) throw paymentError

  const { data: orderRows, error: orderError } = await supabase
    .from('orders')
    .select('id, session_id, account_id, table_id, order_number, status, created_at, updated_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (orderError) throw orderError

  return {
    sessionRow,
    tableRow,
    accountRows: accountRows ?? [],
    itemRows: itemRows ?? [],
    optionRows: optionRows ?? [],
    paymentRows: paymentRows ?? [],
    orderRows: orderRows ?? [],
  }
}

function buildSessionMetrics(snapshot: Awaited<ReturnType<typeof getSessionSnapshot>>) {
  const optionsMap = buildOptionsMap(snapshot.optionRows)
  const ordersById = new Map<string, any>()
  const ordersByAccount = new Map<string, any[]>()
  const itemsByAccount = new Map<string, any[]>()
  const paymentsByAccount = new Map<string, any[]>()
  const paidAmountByAccount = new Map<string, number>()
  const orderTicketsByAccount = new Map<string, any[]>()

  snapshot.orderRows.forEach((row: any) => {
    ordersById.set(row.id, row)
    if (!row.account_id) return
    const current = ordersByAccount.get(row.account_id) ?? []
    current.push(row)
    ordersByAccount.set(row.account_id, current)
  })

  snapshot.paymentRows.forEach((row: any) => {
    if (!row.account_id) return
    const current = paymentsByAccount.get(row.account_id) ?? []
    current.push(row)
    paymentsByAccount.set(row.account_id, current)
    paidAmountByAccount.set(row.account_id, (paidAmountByAccount.get(row.account_id) ?? 0) + normalizeAmount(row.amount))
  })

  const items = snapshot.itemRows.map((row: any) => {
    const options = optionsMap.get(row.id) ?? []
    const order = row.order_id ? ordersById.get(row.order_id) : null
    const status = mapOrderItemStatus(row.status, order?.status)
    const kitchenStatus = status === 'draft' || status === 'cancelled' ? 'idle' : mapOrderToKitchenStatus(order?.status)

    const item = {
      id: row.id,
      sessionId: row.session_id,
      accountId: row.account_id,
      orderId: row.order_id ?? null,
      orderStatus: order?.status ?? null,
      productId: row.product_id,
      productName: row.product_name,
      quantity: Math.max(1, Number(row.quantity || 1)),
      unitPrice: normalizeAmount(row.unit_price ?? row.price),
      totalPrice: buildItemTotal(row, options),
      notes: row.notes || '',
      status,
      kitchenStatus,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      options,
    }

    const current = itemsByAccount.get(row.account_id) ?? []
    current.push(item)
    itemsByAccount.set(row.account_id, current)

    return item
  })

  const accounts = snapshot.accountRows.map((row: any) => {
    const accountItems = itemsByAccount.get(row.id) ?? []
    const accountOrders = ordersByAccount.get(row.id) ?? []
    const accountPayments = paymentsByAccount.get(row.id) ?? []
    const total = normalizeAmount(row.total)
    const paidTotal = normalizeAmount(paidAmountByAccount.get(row.id))
    const dueAmount = Math.max(total - paidTotal, 0)
    const draftCount = accountItems.filter((item) => item.status === 'draft').length
    const sentCount = accountItems.filter((item) => ['sent', 'preparing', 'ready', 'delivered'].includes(item.status)).length
    const readyCount = accountItems.filter((item) => item.status === 'ready').length
    const deliveredCount = accountItems.filter((item) => item.status === 'delivered').length
    const kitchenStatus = pickKitchenStatus(accountItems.map((item) => item.kitchenStatus).filter(Boolean))
    const status = deriveAccountStatus({
      total,
      paidTotal,
      dueAmount,
      kitchenStatus,
      sessionStatus: String(snapshot.sessionRow.status || 'open'),
    })

    const tickets = accountOrders.map((order: any) => {
      const relatedItems = accountItems.filter((item) => item.orderId === order.id)
      return {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        itemCount: relatedItems.length,
      }
    })

    orderTicketsByAccount.set(row.id, tickets)

    return {
      id: row.id,
      sessionId: row.session_id,
      name: row.name || `Conta ${row.account_number ?? 1}`,
      notes: '',
      accountNumber: Number(row.account_number ?? 0),
      total,
      paidTotal,
      dueAmount,
      status,
      kitchenStatus,
      itemCount: accountItems.length,
      draftCount,
      sentCount,
      readyCount,
      deliveredCount,
      payments: accountPayments.map((payment: any) => ({
        id: payment.id,
        sessionId: payment.session_id,
        accountId: payment.account_id,
        method: payment.method,
        amount: normalizeAmount(payment.amount),
        createdAt: payment.created_at,
      })),
      tickets,
      items: accountItems,
    }
  })

  const total = accounts.reduce((sum: number, account: any) => sum + account.total, 0)
  const paidTotal = accounts.reduce((sum: number, account: any) => sum + account.paidTotal, 0)
  const dueAmount = Math.max(total - paidTotal, 0)
  const itemCount = accounts.reduce((sum: number, account: any) => sum + account.itemCount, 0)
  const sentItemsCount = accounts.reduce((sum: number, account: any) => sum + account.sentCount, 0)
  const readyItemsCount = accounts.reduce((sum: number, account: any) => sum + account.readyCount, 0)
  const deliveredItemsCount = accounts.reduce((sum: number, account: any) => sum + account.deliveredCount, 0)
  const kitchenStatus = pickKitchenStatus(accounts.map((account: any) => account.kitchenStatus).filter(Boolean))
  const tableStatus = deriveTableStatus({
    hasSession: true,
    total,
    paidTotal,
    dueAmount,
    kitchenStatus,
    sessionStatus: String(snapshot.sessionRow.status || 'open'),
  })

  const history = [
    ...items.map((item: any) => ({
      id: `item-${item.id}`,
      type: 'item',
      label: `${item.quantity}x ${item.productName}`,
      timestamp: item.sentAt ?? item.createdAt,
      amount: item.totalPrice,
    })),
    ...snapshot.paymentRows.map((payment: any) => ({
      id: `payment-${payment.id}`,
      type: 'payment',
      label: `Pagamento ${String(payment.method).toUpperCase()}`,
      timestamp: payment.created_at,
      amount: normalizeAmount(payment.amount),
    })),
    ...snapshot.orderRows.map((order: any) => ({
      id: `order-${order.id}`,
      type: 'status',
      label: `Pedido ${order.order_number || ''} ${orderStatusLabel[String(order.status || '').toLowerCase()] || 'atualizado'}`.trim(),
      timestamp: order.updated_at || order.created_at,
    })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())

  return {
    accounts,
    total,
    paidTotal,
    dueAmount,
    itemCount,
    sentItemsCount,
    readyItemsCount,
    deliveredItemsCount,
    kitchenStatus,
    tableStatus,
    history,
  }
}

async function refreshAccountTotal(supabase: any, accountId: string) {
  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select('id, quantity, unit_price, price, status')
    .eq('account_id', accountId)
    .neq('status', 'cancelled')

  if (itemError) throw itemError

  const itemIds = (itemRows ?? []).map((row: any) => row.id)
  const { data: optionRows, error: optionError } = itemIds.length
    ? await supabase
        .from('order_item_options')
        .select('*')
        .in('order_item_id', itemIds)
    : { data: [], error: null }

  if (optionError) throw optionError

  const optionsMap = buildOptionsMap(optionRows ?? [])
  const total = (itemRows ?? []).reduce((sum: number, row: any) => {
    const options = optionsMap.get(row.id) ?? []
    return sum + buildItemTotal(row, options)
  }, 0)

  const { error: updateError } = await supabase
    .from('table_accounts')
    .update({ total })
    .eq('id', accountId)

  if (updateError) throw updateError
}

async function refreshAccountTotals(supabase: any, accountIds: string[]) {
  for (const accountId of accountIds) {
    await refreshAccountTotal(supabase, accountId)
  }
}

async function refreshSessionStatus(supabase: any, sessionId: string) {
  const snapshot = await getSessionSnapshot(supabase, sessionId)
  const metrics = buildSessionMetrics(snapshot)

  const accountUpdates = snapshot.accountRows.map((row: any) => {
    const account = metrics.accounts.find((item: any) => item.id === row.id)
    const nextStatus = account?.status === 'paid' ? 'paid' : 'open'

    return supabase
      .from('table_accounts')
      .update({
        status: nextStatus,
        paid_at: nextStatus === 'paid' ? row.paid_at || new Date().toISOString() : null,
      })
      .eq('id', row.id)
  })

  for (const request of accountUpdates) {
    const { error } = await request
    if (error) throw error
  }

  let nextSessionStatus = 'open'
  let nextTableStatus = 'occupied'

  if (snapshot.accountRows.length === 0 || (metrics.total > 0 && isEffectivelyZero(metrics.dueAmount))) {
    nextSessionStatus = 'closed'
    nextTableStatus = 'available'
  } else if (String(snapshot.sessionRow.status) === 'payment_pending') {
    nextSessionStatus = 'payment_pending'
    nextTableStatus = 'payment_pending'
  } else if (metrics.kitchenStatus === 'ready' || metrics.kitchenStatus === 'preparing' || metrics.kitchenStatus === 'sent') {
    nextSessionStatus = 'serving'
    nextTableStatus = 'serving'
  }

  const { error: updateSessionError } = await supabase
    .from('table_sessions')
    .update({
      status: nextSessionStatus,
      closed_at: nextSessionStatus === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', sessionId)

  if (updateSessionError) throw updateSessionError

  const { error: updateTableError } = await supabase
    .from('tables')
    .update({ status: nextTableStatus })
    .eq('id', snapshot.sessionRow.table_id)

  if (updateTableError) throw updateTableError

  return {
    ...metrics,
    sessionStatus: nextSessionStatus,
  }
}

async function buildSessionResponse(supabase: any, restaurantId: string, sessionId: string) {
  const snapshot = await getSessionSnapshot(supabase, sessionId)
  const metrics = buildSessionMetrics(snapshot)
  const tableChoices = await listTransferTables(supabase, restaurantId, sessionId)

  return {
    id: snapshot.sessionRow.id,
    tableId: snapshot.sessionRow.table_id,
    tableNumber: Number(snapshot.tableRow.table_number),
    tableLabel: snapshot.tableRow.location ? `Mesa ${snapshot.tableRow.table_number} - ${snapshot.tableRow.location}` : `Mesa ${snapshot.tableRow.table_number}`,
    openedAt: snapshot.sessionRow.opened_at,
    closedAt: snapshot.sessionRow.closed_at,
    guestCount: Math.max(1, Number((snapshot.sessionRow.guest_count ?? metrics.accounts.length) || 1)),
    status: snapshot.sessionRow.status,
    notes: '',
    total: metrics.total,
    paidTotal: metrics.paidTotal,
    dueAmount: metrics.dueAmount,
    itemCount: metrics.itemCount,
    sentItemsCount: metrics.sentItemsCount,
    readyItemsCount: metrics.readyItemsCount,
    accountCount: metrics.accounts.length,
    accounts: metrics.accounts,
    history: metrics.history,
    tableChoices,
  }
}

async function listRestaurantTables(supabase: any, restaurantId: string) {
  const { data: tableRows, error: tableError } = await supabase
    .from('tables')
    .select('*')
    .eq('user_id', restaurantId)
    .order('table_number')

  if (tableError) throw tableError

  const { data: sessionRows, error: sessionError } = await supabase
    .from('table_sessions')
    .select('id, table_id, opened_at, status')
    .eq('user_id', restaurantId)
    .in('status', ['open', 'serving', 'payment_pending'])
    .order('opened_at', { ascending: false })

  if (sessionError) throw sessionError

  const activeSessions = sessionRows ?? []
  const latestSessionByTable = new Map<string, any>()
  activeSessions.forEach((row: any) => {
    if (!latestSessionByTable.has(row.table_id)) latestSessionByTable.set(row.table_id, row)
  })

  const sessionIds = activeSessions.map((row: any) => row.id)

  const { data: accountRows, error: accountError } = sessionIds.length
    ? await supabase
        .from('table_accounts')
        .select('id, session_id, total, status')
        .in('session_id', sessionIds)
    : { data: [], error: null }

  if (accountError) throw accountError

  const { data: paymentRows, error: paymentError } = sessionIds.length
    ? await supabase
        .from('payments')
        .select('session_id, account_id, amount')
        .in('session_id', sessionIds)
    : { data: [], error: null }

  if (paymentError) throw paymentError

  const { data: orderRows, error: orderError } = sessionIds.length
    ? await supabase
        .from('orders')
        .select('id, session_id, account_id, status')
        .in('session_id', sessionIds)
    : { data: [], error: null }

  if (orderError) throw orderError

  const { data: itemRows, error: itemError } = sessionIds.length
    ? await supabase
        .from('order_items')
        .select('id, session_id, account_id, status, order_id')
        .in('session_id', sessionIds)
        .neq('status', 'cancelled')
    : { data: [], error: null }

  if (itemError) throw itemError

  const legacyAccountsResult = await supabase
    .from('table_accounts')
    .select('id, table_id, total, status, updated_at, session_id')
    .eq('user_id', restaurantId)
    .order('updated_at', { ascending: false })

  const legacyRows = legacyAccountsResult.error ? [] : (legacyAccountsResult.data ?? [])

  const ordersById = new Map<string, any>()
  ;(orderRows ?? []).forEach((row: any) => ordersById.set(row.id, row))

  const accountsBySession = new Map<string, any[]>()
  ;(accountRows ?? []).forEach((row: any) => {
    const current = accountsBySession.get(row.session_id) ?? []
    current.push(row)
    accountsBySession.set(row.session_id, current)
  })

  const paymentsBySession = new Map<string, any[]>()
  ;(paymentRows ?? []).forEach((row: any) => {
    const current = paymentsBySession.get(row.session_id) ?? []
    current.push(row)
    paymentsBySession.set(row.session_id, current)
  })

  const itemsBySession = new Map<string, any[]>()
  ;(itemRows ?? []).forEach((row: any) => {
    const current = itemsBySession.get(row.session_id) ?? []
    current.push(row)
    itemsBySession.set(row.session_id, current)
  })

  const legacyTotalsByTable = new Map<string, number>()
  const legacyAccountCountByTable = new Map<string, number>()
  legacyRows.forEach((row: any) => {
    if (row.session_id) return
    const status = String(row.status || '').toLowerCase()
    if (status === 'closed' || status === 'paid') return
    legacyTotalsByTable.set(row.table_id, (legacyTotalsByTable.get(row.table_id) ?? 0) + normalizeAmount(row.total))
    legacyAccountCountByTable.set(row.table_id, (legacyAccountCountByTable.get(row.table_id) ?? 0) + 1)
  })

  return (tableRows ?? []).map((row: any) => {
    const session = latestSessionByTable.get(row.id)

    if (!session) {
      return {
        id: row.id,
        number: Number(row.table_number),
        label: row.location ? `Mesa ${row.table_number} - ${row.location}` : `Mesa ${row.table_number}`,
        capacity: Number(row.capacity ?? 0),
        location: row.location,
        status: legacyTotalsByTable.get(row.id) ? 'occupied' : mapTableRecordStatus(row.status),
        total: legacyTotalsByTable.get(row.id) ?? 0,
        paidTotal: 0,
        dueAmount: legacyTotalsByTable.get(row.id) ?? 0,
        openMinutes: 0,
        sessionId: null,
        accountCount: legacyAccountCountByTable.get(row.id) ?? 0,
        itemCount: 0,
        sentItemsCount: 0,
        readyItemsCount: 0,
        notes: '',
      }
    }

    const sessionAccounts = accountsBySession.get(session.id) ?? []
    const sessionPayments = paymentsBySession.get(session.id) ?? []
    const sessionItems = itemsBySession.get(session.id) ?? []
    const rawPaidByAccount = new Map<string, number>()

    sessionPayments.forEach((payment: any) => {
      if (!payment.account_id) return
      rawPaidByAccount.set(payment.account_id, (rawPaidByAccount.get(payment.account_id) ?? 0) + normalizeAmount(payment.amount))
    })

    const total = sessionAccounts.reduce((sum: number, account: any) => sum + normalizeAmount(account.total), 0)
    const paidTotal = Array.from(rawPaidByAccount.values()).reduce((sum, amount) => sum + amount, 0)
    const dueAmount = Math.max(total - paidTotal, 0)
    const kitchenStatuses = sessionItems.map((item: any) => mapOrderToKitchenStatus(ordersById.get(item.order_id)?.status))
    const kitchenStatus = pickKitchenStatus(kitchenStatuses.filter(Boolean))
    const itemCount = sessionItems.length
    const sentItemsCount = sessionItems.filter((item: any) => mapOrderItemStatus(item.status, ordersById.get(item.order_id)?.status) !== 'draft').length
    const readyItemsCount = sessionItems.filter((item: any) => mapOrderItemStatus(item.status, ordersById.get(item.order_id)?.status) === 'ready').length

    return {
      id: row.id,
      number: Number(row.table_number),
      label: row.location ? `Mesa ${row.table_number} - ${row.location}` : `Mesa ${row.table_number}`,
      capacity: Number(row.capacity ?? 0),
      location: row.location,
      status: deriveTableStatus({
        hasSession: true,
        total,
        paidTotal,
        dueAmount,
        kitchenStatus,
        sessionStatus: String(session.status || 'open'),
      }),
      total,
      paidTotal,
      dueAmount,
      openMinutes: session.opened_at ? minutesSince(session.opened_at) : 0,
      sessionId: session.id,
      accountCount: sessionAccounts.length,
      itemCount,
      sentItemsCount,
      readyItemsCount,
      notes: '',
    }
  })
}

async function listCatalog(supabase: any, restaurantId: string) {
  const { data: categoryRows, error: categoryError } = await supabase
    .from('product_categories')
    .select('*')
    .eq('user_id', restaurantId)
    .order('display_order', { ascending: true })

  if (categoryError) throw categoryError

  const { data: productRows, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', restaurantId)
    .eq('show_in_pdv', true)
    .order('name', { ascending: true })

  if (productError) throw productError

  const productIds = (productRows ?? []).map((row: any) => row.id)

  const { data: specificRows, error: specificError } = productIds.length
    ? await supabase
        .from('product_variations')
        .select('*')
        .in('product_id', productIds)
    : { data: [], error: null }

  if (specificError) throw specificError

  const { data: linkRows, error: linkError } = productIds.length
    ? await supabase
        .from('product_global_variation_links')
        .select('*')
        .in('product_id', productIds)
    : { data: [], error: null }

  if (linkError) throw linkError

  const globalIds = (linkRows ?? []).map((row: any) => row.global_variation_id)
  const { data: globalRows, error: globalError } = globalIds.length
    ? await supabase
        .from('global_variations')
        .select('*')
        .in('id', globalIds)
    : { data: [], error: null }

  if (globalError) throw globalError

  const products = (productRows ?? []).map((row: any) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    price: normalizeAmount(row.price),
    featured: Boolean(row.featured ?? row.is_featured),
    sendToKds: Boolean(row.send_to_kds ?? true),
    variations: buildProductVariationGroups(row.id, specificRows ?? [], linkRows ?? [], globalRows ?? []),
  }))

  const categories = (categoryRows ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    products: products.filter((product: any) => product.categoryId === row.id),
  }))

  const favorites = {
    id: 'favorites',
    name: 'Destaques',
    products: products.filter((product: any) => product.featured),
  }

  return favorites.products.length ? [favorites, ...categories] : categories
}

async function ensureTableIsFree(supabase: any, tableId: string, restaurantId: string, ignoreSessionId?: string) {
  const { data, error } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('user_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'serving', 'payment_pending'])

  if (error) throw error

  const blocking = (data ?? []).find((row: any) => row.id !== ignoreSessionId)
  if (blocking?.id) return false
  return true
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const waiterSession = await getWaiterSession(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    const supabase = waiterSession.supabase

    if (action === 'bootstrap') {
      const tables = await listRestaurantTables(supabase, waiterSession.profile.restaurantId)
      return ok({ profile: waiterSession.profile, tables })
    }

    if (action === 'create_table') {
      const tableNumber = Math.max(1, Number(body?.tableNumber || 0))
      const capacity = Math.max(0, Number(body?.capacity || 0))
      const location = String(body?.location || '').trim() || null

      if (!tableNumber) return fail('Informe o numero da mesa.', 400)

      const { data: existing, error: existingError } = await supabase
        .from('tables')
        .select('id')
        .eq('user_id', waiterSession.profile.restaurantId)
        .eq('table_number', tableNumber)
        .maybeSingle()

      if (existingError) throw existingError
      if (existing?.id) return fail('Ja existe uma mesa com este numero.', 400)

      const { data: tableRow, error: tableError } = await supabase
        .from('tables')
        .insert({
          user_id: waiterSession.profile.restaurantId,
          table_number: tableNumber,
          capacity: capacity || null,
          location,
          status: 'available',
        })
        .select('id, table_number, capacity, location')
        .single()

      if (tableError) throw tableError

      return ok({
        table: {
          id: tableRow.id,
          number: Number(tableRow.table_number),
          capacity: Number(tableRow.capacity ?? 0),
          location: tableRow.location,
        },
      })
    }

    if (action === 'open_session') {
      const cashGuard = await requireOpenCashSession(supabase, waiterSession.profile.restaurantId)
      if (cashGuard) return cashGuard

      const tableId = String(body?.tableId || '')
      const tableNumber = Math.max(1, Number(body?.tableNumber || 0))
      const guestCount = Math.max(1, Number(body?.guestCount || 1))

      if (!tableId || !tableNumber) return fail('Mesa invalida.', 400)

      const existing = await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', tableId)
        .eq('user_id', waiterSession.profile.restaurantId)
        .in('status', ['open', 'serving', 'payment_pending'])
        .maybeSingle()

      if (existing.error) throw existing.error
      if (existing.data?.id) return ok({ sessionId: existing.data.id })

      const { data: sessionRow, error: sessionError } = await supabase
        .from('table_sessions')
        .insert({
          user_id: waiterSession.profile.restaurantId,
          table_id: tableId,
          status: 'open',
          guest_count: guestCount,
          opened_at: new Date().toISOString(),
          opened_by_waiter_id: waiterSession.profile.id,
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError

      const accountsToInsert = Array.from({ length: guestCount }, (_, index) => ({
        user_id: waiterSession.profile.restaurantId,
        session_id: sessionRow.id,
        table_id: null,
        account_number: index + 1,
        name: `Conta ${index + 1}`,
        total: 0,
        status: 'open',
        opened_by_waiter_id: waiterSession.profile.id,
        opened_at: new Date().toISOString(),
        items: [],
      }))

      const { error: accountError } = await supabase.from('table_accounts').insert(accountsToInsert)
      if (accountError) throw accountError

      const { error: tableError } = await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId)
      if (tableError) throw tableError

      return ok({ sessionId: sessionRow.id })
    }

    if (action === 'session_details') {
      const sessionId = String(body?.sessionId || '')
      if (!sessionId) return fail('Sessao invalida.', 400)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'update_session_note') {
      const sessionId = String(body?.sessionId || '')
      if (!sessionId) return fail('Sessao invalida.', 400)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'request_check') {
      const sessionId = String(body?.sessionId || '')
      if (!sessionId) return fail('Sessao invalida.', 400)

      const snapshot = await getSessionSnapshot(supabase, sessionId)
      const metrics = buildSessionMetrics(snapshot)
      if (isEffectivelyZero(metrics.dueAmount)) return fail('Nao ha saldo pendente nesta mesa.', 400)

      const { error: sessionError } = await supabase
        .from('table_sessions')
        .update({ status: 'payment_pending' })
        .eq('id', sessionId)

      if (sessionError) throw sessionError

      const { error: tableError } = await supabase
        .from('tables')
        .update({ status: 'payment_pending' })
        .eq('id', snapshot.sessionRow.table_id)

      if (tableError) throw tableError

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'release_table') {
      const sessionId = String(body?.sessionId || '')
      if (!sessionId) return fail('Sessao invalida.', 400)

      const snapshot = await getSessionSnapshot(supabase, sessionId)
      const metrics = buildSessionMetrics(snapshot)
      if (!isEffectivelyZero(metrics.dueAmount)) return fail('A mesa ainda possui saldo pendente.', 400)

      const { error: sessionError } = await supabase
        .from('table_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (sessionError) throw sessionError

      const { error: tableError } = await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', snapshot.sessionRow.table_id)

      if (tableError) throw tableError

      return ok({ ok: true })
    }

    if (action === 'transfer_table') {
      const sessionId = String(body?.sessionId || '')
      const targetTableId = String(body?.targetTableId || '')
      if (!sessionId || !targetTableId) return fail('Informe a mesa de destino.', 400)

      const snapshot = await getSessionSnapshot(supabase, sessionId)
      if (snapshot.sessionRow.table_id === targetTableId) return fail('A mesa ja esta selecionada.', 400)

      const targetIsFree = await ensureTableIsFree(supabase, targetTableId, waiterSession.profile.restaurantId, sessionId)
      if (!targetIsFree) return fail('A mesa de destino ja esta ocupada.', 400)

      const previousTableId = snapshot.sessionRow.table_id

      const { error: sessionError } = await supabase
        .from('table_sessions')
        .update({ table_id: targetTableId })
        .eq('id', sessionId)

      if (sessionError) throw sessionError

      const { error: ordersError } = await supabase
        .from('orders')
        .update({ table_id: targetTableId })
        .eq('session_id', sessionId)

      if (ordersError) throw ordersError

      const { error: previousTableError } = await supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', previousTableId)

      if (previousTableError) throw previousTableError

      const { error: nextTableError } = await supabase
        .from('tables')
        .update({ status: snapshot.sessionRow.status === 'payment_pending' ? 'payment_pending' : 'occupied' })
        .eq('id', targetTableId)

      if (nextTableError) throw nextTableError

      await refreshSessionStatus(supabase, sessionId)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'create_account') {
      const sessionId = String(body?.sessionId || '')
      const name = String(body?.name || '').trim()
      if (!sessionId || !name) return fail('Informe o nome da comanda.', 400)

      const nextNumber = await getNextAccountNumber(supabase, sessionId)
      const { error } = await supabase.from('table_accounts').insert({
        user_id: waiterSession.profile.restaurantId,
        session_id: sessionId,
        table_id: null,
        account_number: nextNumber,
        name,
        total: 0,
        status: 'open',
        opened_by_waiter_id: waiterSession.profile.id,
        opened_at: new Date().toISOString(),
        items: [],
      })

      if (error) throw error

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'rename_account') {
      const accountId = String(body?.accountId || '')
      const name = String(body?.name || '').trim()
      if (!accountId || !name) return fail('Informe um nome valido.', 400)

      const { data: accountRow, error: accountError } = await supabase
        .from('table_accounts')
        .select('id, session_id')
        .eq('id', accountId)
        .single()

      if (accountError) throw accountError

      const { error } = await supabase
        .from('table_accounts')
        .update({ name })
        .eq('id', accountId)

      if (error) throw error

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, accountRow.session_id)
      return ok({ session })
    }

    if (action === 'remove_account') {
      const accountId = String(body?.accountId || '')
      if (!accountId) return fail('Comanda invalida.', 400)

      const { data: accountRow, error: accountError } = await supabase
        .from('table_accounts')
        .select('id, session_id')
        .eq('id', accountId)
        .single()

      if (accountError) throw accountError

      const { data: data, error } = await supabase
        .from('order_items')
        .select('id')
        .eq('account_id', accountId)
        .limit(1)

      if (error) throw error
      if ((data ?? []).length > 0) return fail('So e possivel remover comanda vazia.', 400)

      const { error: paymentError } = await supabase
        .from('payments')
        .select('id')
        .eq('account_id', accountId)
        .limit(1)

      if (paymentError) throw paymentError

      const { error: deleteError } = await supabase.from('table_accounts').delete().eq('id', accountId)
      if (deleteError) throw deleteError

      await refreshSessionStatus(supabase, accountRow.session_id)
      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, accountRow.session_id)
      return ok({ session })
    }

    if (action === 'merge_accounts') {
      const sourceAccountId = String(body?.sourceAccountId || '')
      const targetAccountId = String(body?.targetAccountId || '')
      if (!sourceAccountId || !targetAccountId || sourceAccountId === targetAccountId) {
        return fail('Selecione duas comandas diferentes.', 400)
      }

      const { data: accountRows, error: accountError } = await supabase
        .from('table_accounts')
        .select('id, session_id')
        .in('id', [sourceAccountId, targetAccountId])

      if (accountError) throw accountError

      if ((accountRows ?? []).length !== 2) return fail('Comandas nao encontradas.', 404)

      const [sourceAccount, targetAccount] = [sourceAccountId, targetAccountId].map((id) =>
        (accountRows ?? []).find((row: any) => row.id === id),
      )

      if (!sourceAccount || !targetAccount) return fail('Comandas nao encontradas.', 404)
      if (sourceAccount.session_id !== targetAccount.session_id) return fail('So e possivel juntar comandas da mesma mesa.', 400)

      const { error: itemError } = await supabase
        .from('order_items')
        .update({ account_id: targetAccountId })
        .eq('account_id', sourceAccountId)

      if (itemError) throw itemError

      const { error: paymentError } = await supabase
        .from('payments')
        .update({ account_id: targetAccountId })
        .eq('account_id', sourceAccountId)

      if (paymentError) throw paymentError

      const { error: orderError } = await supabase
        .from('orders')
        .update({ account_id: targetAccountId })
        .eq('account_id', sourceAccountId)

      if (orderError) throw orderError

      const { error: deleteError } = await supabase
        .from('table_accounts')
        .delete()
        .eq('id', sourceAccountId)

      if (deleteError) throw deleteError

      await refreshAccountTotals(supabase, [targetAccountId])
      await refreshSessionStatus(supabase, sourceAccount.session_id)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sourceAccount.session_id)
      return ok({ session })
    }

    if (action === 'transfer_account') {
      const accountId = String(body?.accountId || '')
      const targetTableId = String(body?.targetTableId || '')
      if (!accountId || !targetTableId) return fail('Informe a comanda e a mesa de destino.', 400)

      const { data: accountRow, error: accountError } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('id', accountId)
        .single()

      if (accountError) throw accountError

      const sourceSessionId = String(accountRow.session_id || '')
      if (!sourceSessionId) return fail('Comanda invalida.', 400)

      const sourceSnapshot = await getSessionSnapshot(supabase, sourceSessionId)
      if (sourceSnapshot.sessionRow.table_id === targetTableId) return fail('A comanda ja esta nesta mesa.', 400)

      let targetSessionId = ''
      const { data: targetSessionRow, error: targetSessionError } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('user_id', waiterSession.profile.restaurantId)
        .eq('table_id', targetTableId)
        .in('status', ['open', 'serving', 'payment_pending'])
        .maybeSingle()

      if (targetSessionError) throw targetSessionError

      if (targetSessionRow?.id) {
        targetSessionId = targetSessionRow.id
      } else {
        const { data: createdSession, error: createSessionError } = await supabase
          .from('table_sessions')
          .insert({
            user_id: waiterSession.profile.restaurantId,
            table_id: targetTableId,
            status: 'open',
            guest_count: 1,
            opened_at: new Date().toISOString(),
            opened_by_waiter_id: waiterSession.profile.id,
          })
          .select('id')
          .single()

        if (createSessionError) throw createSessionError

        targetSessionId = createdSession.id

        const { error: targetTableError } = await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', targetTableId)

        if (targetTableError) throw targetTableError
      }

      const nextAccountNumber = await getNextAccountNumber(supabase, targetSessionId)

      const { error: accountUpdateError } = await supabase
        .from('table_accounts')
        .update({
          session_id: targetSessionId,
          account_number: nextAccountNumber,
        })
        .eq('id', accountId)

      if (accountUpdateError) throw accountUpdateError

      const { error: itemUpdateError } = await supabase
        .from('order_items')
        .update({ session_id: targetSessionId })
        .eq('account_id', accountId)

      if (itemUpdateError) throw itemUpdateError

      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ session_id: targetSessionId })
        .eq('account_id', accountId)

      if (paymentUpdateError) throw paymentUpdateError

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ session_id: targetSessionId, table_id: targetTableId, account_id: accountId })
        .eq('account_id', accountId)

      if (orderUpdateError) throw orderUpdateError

      await refreshAccountTotals(supabase, [accountId])
      await refreshSessionStatus(supabase, sourceSessionId)
      await refreshSessionStatus(supabase, targetSessionId)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sourceSessionId)
      return ok({ session, transferredSessionId: targetSessionId })
    }

    if (action === 'move_item') {
      const itemId = String(body?.itemId || '')
      const targetAccountId = String(body?.targetAccountId || '')
      const moveQuantity = Math.max(1, Number(body?.quantity || 1))

      if (!itemId || !targetAccountId) return fail('Informe o item e a comanda de destino.', 400)

      const { data: itemRow, error: itemError } = await supabase
        .from('order_items')
        .select('*')
        .eq('id', itemId)
        .single()

      if (itemError) throw itemError
      if (itemRow.status !== 'draft') return fail('So e possivel mover itens ainda nao enviados.', 400)

      const { data: accountRows, error: accountError } = await supabase
        .from('table_accounts')
        .select('id, session_id')
        .in('id', [itemRow.account_id, targetAccountId])

      if (accountError) throw accountError
      if ((accountRows ?? []).length !== 2) return fail('Comanda de origem ou destino nao encontrada.', 404)

      const sourceAccount = (accountRows ?? []).find((row: any) => row.id === itemRow.account_id)
      const targetAccount = (accountRows ?? []).find((row: any) => row.id === targetAccountId)
      if (!sourceAccount || !targetAccount) return fail('Comanda de origem ou destino nao encontrada.', 404)
      if (sourceAccount.session_id !== targetAccount.session_id) return fail('So e possivel mover itens dentro da mesma mesa.', 400)

      const { data: optionRows, error: optionError } = await supabase
        .from('order_item_options')
        .select('*')
        .eq('order_item_id', itemId)

      if (optionError) throw optionError

      const sourceQuantity = Math.max(1, Number(itemRow.quantity || 1))
      const quantityToMove = Math.min(sourceQuantity, moveQuantity)

      if (quantityToMove >= sourceQuantity) {
        const { error: moveError } = await supabase
          .from('order_items')
          .update({ account_id: targetAccountId })
          .eq('id', itemId)

        if (moveError) throw moveError
      } else {
        const { data: duplicatedItem, error: duplicateError } = await supabase
          .from('order_items')
          .insert({
            session_id: itemRow.session_id,
            account_id: targetAccountId,
            product_id: itemRow.product_id,
            product_name: itemRow.product_name,
            quantity: quantityToMove,
            unit_price: normalizeAmount(itemRow.unit_price ?? itemRow.price),
            notes: itemRow.notes || '',
            status: 'draft',
          })
          .select('id')
          .single()

        if (duplicateError) throw duplicateError

        if ((optionRows ?? []).length) {
          const { error: insertOptionsError } = await supabase
            .from('order_item_options')
            .insert(
              (optionRows ?? []).map((option: any) => ({
                order_item_id: duplicatedItem.id,
                option_name: option.option_name,
                price: normalizeAmount(option.price),
                quantity: Math.max(1, Number(option.quantity || 1)),
              })),
            )

          if (insertOptionsError) throw insertOptionsError
        }

        const { error: reduceError } = await supabase
          .from('order_items')
          .update({ quantity: sourceQuantity - quantityToMove })
          .eq('id', itemId)

        if (reduceError) throw reduceError
      }

      await refreshAccountTotals(supabase, [itemRow.account_id, targetAccountId])
      await refreshSessionStatus(supabase, itemRow.session_id)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, itemRow.session_id)
      return ok({ session })
    }

    if (action === 'catalog') {
      const categories = await listCatalog(supabase, waiterSession.profile.restaurantId)
      return ok({ categories })
    }

    if (action === 'add_item') {
      const cashGuard = await requireOpenCashSession(supabase, waiterSession.profile.restaurantId)
      if (cashGuard) return cashGuard

      const sessionId = String(body?.sessionId || '')
      const accountId = String(body?.accountId || '')
      const productId = String(body?.productId || '')
      const quantity = Math.max(1, Number(body?.quantity || 1))
      const notes = String(body?.notes || '')
      const selectedOptions = Array.isArray(body?.selectedOptions) ? body.selectedOptions : []

      if (!sessionId || !accountId || !productId) return fail('Dados do item invalidos.', 400)

      const { data: productRow, error: productError } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('id', productId)
        .eq('user_id', waiterSession.profile.restaurantId)
        .single()

      if (productError) throw productError

      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          session_id: sessionId,
          account_id: accountId,
          product_id: productRow.id,
          product_name: productRow.name,
          quantity,
          unit_price: normalizeAmount(productRow.price),
          notes,
          status: 'draft',
        })

      if (itemError) throw itemError

      const { data: createdRows, error: createdRowsError } = await supabase
        .from('order_items')
        .select('id')
        .eq('session_id', sessionId)
        .eq('account_id', accountId)
        .eq('product_id', productId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)

      if (createdRowsError) throw createdRowsError
      const itemId = createdRows?.[0]?.id

      if (itemId && selectedOptions.length) {
        const { error: optionError } = await supabase
          .from('order_item_options')
          .insert(
            selectedOptions.map((option: any) => ({
              order_item_id: itemId,
              option_name: String(option.name || option.optionName || ''),
              price: normalizeAmount(option.price),
              quantity: Math.max(1, Number(option.quantity || 1)),
            })),
          )

        if (optionError) throw optionError
      }

      await refreshAccountTotal(supabase, accountId)
      await refreshSessionStatus(supabase, sessionId)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'update_draft_item') {
      const itemId = String(body?.itemId || '')
      const quantity = Math.max(1, Number(body?.quantity || 1))
      const notes = String(body?.notes || '')
      const selectedOptions = Array.isArray(body?.selectedOptions) ? body.selectedOptions : []

      if (!itemId) return fail('Item invalido.', 400)

      const { data: itemRow, error: itemError } = await supabase
        .from('order_items')
        .select('id, session_id, account_id, status')
        .eq('id', itemId)
        .single()

      if (itemError) throw itemError
      if (itemRow.status !== 'draft') return fail('So e possivel editar itens ainda nao enviados.', 400)

      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          quantity,
          notes,
        })
        .eq('id', itemId)

      if (updateError) throw updateError

      const { error: deleteOptionsError } = await supabase
        .from('order_item_options')
        .delete()
        .eq('order_item_id', itemId)

      if (deleteOptionsError) throw deleteOptionsError

      if (selectedOptions.length) {
        const { error: insertOptionsError } = await supabase
          .from('order_item_options')
          .insert(
            selectedOptions.map((option: any) => ({
              order_item_id: itemId,
              option_name: String(option.name || option.optionName || ''),
              price: normalizeAmount(option.price),
              quantity: Math.max(1, Number(option.quantity || 1)),
            })),
          )

        if (insertOptionsError) throw insertOptionsError
      }

      await refreshAccountTotal(supabase, itemRow.account_id)
      await refreshSessionStatus(supabase, itemRow.session_id)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, itemRow.session_id)
      return ok({ session })
    }

    if (action === 'cancel_draft_item') {
      const itemId = String(body?.itemId || '')
      const accountId = String(body?.accountId || '')
      const sessionId = String(body?.sessionId || '')
      if (!itemId || !accountId || !sessionId) return fail('Item invalido.', 400)

      const { data: row, error: rowError } = await supabase
        .from('order_items')
        .select('id, status')
        .eq('id', itemId)
        .maybeSingle()

      if (rowError) throw rowError
      if (!row) return fail('Item nao encontrado.', 404)
      if (row.status !== 'draft') return fail('So e possivel cancelar itens que ainda nao foram enviados.', 400)

      const { error: updateError } = await supabase
        .from('order_items')
        .update({ status: 'cancelled' })
        .eq('id', itemId)

      if (updateError) throw updateError

      await refreshAccountTotal(supabase, accountId)
      await refreshSessionStatus(supabase, sessionId)

      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'send_account') {
      const sessionId = String(body?.sessionId || '')
      const accountId = String(body?.accountId || '')
      if (!sessionId || !accountId) return fail('Comanda invalida.', 400)

      const draftRows = await supabase
        .from('order_items')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'draft')
        .order('created_at', { ascending: true })

      if (draftRows.error) throw draftRows.error
      if (!draftRows.data?.length) return fail('Nenhum item pendente para enviar.', 400)

      const { data: accountRow, error: accountError } = await supabase
        .from('table_accounts')
        .select('id, name, session_id')
        .eq('id', accountId)
        .single()

      if (accountError) throw accountError

      const { data: sessionRow, error: sessionError } = await supabase
        .from('table_sessions')
        .select('table_id')
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError

      const { data: tableRow, error: tableError } = await supabase
        .from('tables')
        .select('table_number, location')
        .eq('id', sessionRow.table_id)
        .single()

      if (tableError) throw tableError

      const itemIds = draftRows.data.map((row: any) => row.id)
      const optionRows = itemIds.length
        ? await supabase
            .from('order_item_options')
            .select('*')
            .in('order_item_id', itemIds)
        : { data: [], error: null }

      if (optionRows.error) throw optionRows.error

      const optionsMap = buildOptionsMap(optionRows.data ?? [])
      const orderItems = draftRows.data.map((row: any) => {
        const options = optionsMap.get(row.id) ?? []
        return {
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: Math.max(1, Number(row.quantity || 1)),
          price: normalizeAmount(row.unit_price ?? row.price),
          subtotal: buildItemTotal(row, options),
          options: options.map((option: any) => option.optionName),
          notes: row.notes || '',
          account_name: accountRow.name,
          table_number: Number(tableRow.table_number),
        }
      })

      const total = orderItems.reduce((sum: number, item: any) => sum + normalizeAmount(item.subtotal), 0)
      const orderNumber = `M${tableRow.table_number}-${Date.now().toString().slice(-5)}`

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: waiterSession.profile.restaurantId,
          order_number: orderNumber,
          customer_name: `Mesa ${tableRow.table_number} - ${accountRow.name}`,
          table_id: sessionRow.table_id,
          items: orderItems,
          total,
          total_amount: total,
          order_type: 'dine_in',
          payment_method: 'pendente',
          status: 'pending',
          session_id: sessionId,
          account_id: accountId,
          waiter_id: waiterSession.profile.id,
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          status: 'sent',
          order_id: orderRow.id,
          sent_at: new Date().toISOString(),
        })
        .in('id', itemIds)

      if (updateError) throw updateError

      await refreshSessionStatus(supabase, sessionId)
      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    if (action === 'record_payments') {
      const cashGuard = await requireOpenCashSession(supabase, waiterSession.profile.restaurantId)
      if (cashGuard) return cashGuard

      const sessionId = String(body?.sessionId || '')
      const payments = Array.isArray(body?.payments) ? body.payments : []
      if (!sessionId || !payments.length) return fail('Informe ao menos um pagamento.', 400)

      const sanitizedPayments = payments
        .map((payment: any) => ({
          accountId: String(payment?.accountId || ''),
          method: String(payment?.method || ''),
          amount: normalizeAmount(payment?.amount),
        }))
        .filter((payment: any) => payment.accountId && ['cash', 'pix', 'card'].includes(payment.method) && payment.amount > 0)

      if (!sanitizedPayments.length) return fail('Nenhum pagamento valido foi informado.', 400)

      const { data: accountRows, error: accountError } = await supabase
        .from('table_accounts')
        .select('id, session_id')
        .in('id', sanitizedPayments.map((payment: any) => payment.accountId))

      if (accountError) throw accountError
      const validAccountIds = new Set((accountRows ?? []).filter((row: any) => row.session_id === sessionId).map((row: any) => row.id))
      if (!sanitizedPayments.every((payment: any) => validAccountIds.has(payment.accountId))) {
        return fail('Existe uma comanda invalida no pagamento informado.', 400)
      }

      const { error: insertError } = await supabase
        .from('payments')
        .insert(
          sanitizedPayments.map((payment: any) => ({
            session_id: sessionId,
            account_id: payment.accountId,
            user_id: waiterSession.profile.restaurantId,
            waiter_id: waiterSession.profile.id,
            method: payment.method,
            amount: payment.amount,
          })),
        )

      if (insertError) throw insertError

      await refreshSessionStatus(supabase, sessionId)
      const session = await buildSessionResponse(supabase, waiterSession.profile.restaurantId, sessionId)
      return ok({ session })
    }

    return fail('Acao invalida.', 400)
  } catch (error: any) {
    return fail(String(error?.message || 'Erro interno no app do garcom.'), 500)
  }
})
