import { corsHeaders, fail, getWaiterSession, ok } from '../_shared/waiter-web.ts'

const minutesSince = (value: string) => Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))

const mapSessionToTableStatus = (status?: string | null) => {
  if (status === 'payment_pending') return 'payment_pending'
  if (status === 'serving') return 'serving'
  if (status === 'open') return 'occupied'
  return 'free'
}

const mapTableStatus = (status?: string | null) => {
  if (status === 'payment_pending') return 'payment_pending'
  if (status === 'serving') return 'serving'
  if (status === 'occupied' || status === 'reserved') return 'occupied'
  return 'free'
}

const buildOptionsMap = (rows: any[]) => {
  const map = new Map<string, any[]>()
  rows.forEach((row) => {
    const current = map.get(row.order_item_id) ?? []
    current.push({
      id: row.id,
      orderItemId: row.order_item_id,
      optionName: row.option_name,
      price: Number(row.price || 0),
      quantity: Number(row.quantity || 1),
    })
    map.set(row.order_item_id, current)
  })
  return map
}

const buildItemTotal = (row: any, options: any[]) => {
  const unitPrice = Number(row.unit_price ?? row.price ?? 0)
  const quantity = Number(row.quantity ?? 1)
  const optionsTotal = options.reduce((sum, option) => sum + option.price * option.quantity, 0)
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
            price: Number(option.price ?? 0),
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
              price: Number(option.price ?? 0),
            }))
          : [],
      }
    })
    .filter(Boolean)

  return [...directGroups, ...globalGroups]
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

async function refreshAccountTotal(supabase: any, accountId: string) {
  const { data: itemRows, error: itemError } = await supabase
    .from('order_items')
    .select('id, quantity, unit_price, price, status')
    .eq('account_id', accountId)
    .neq('status', 'cancelled')

  if (itemError) throw itemError

  const itemIds = (itemRows ?? []).map((row: any) => row.id)
  const { data: optionRows, error: optionError } = itemIds.length
    ? await supabase.from('order_item_options').select('*').in('order_item_id', itemIds)
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

async function refreshSessionStatus(supabase: any, sessionId: string) {
  const { data: sessionRow, error: sessionError } = await supabase
    .from('table_sessions')
    .select('id, table_id')
    .eq('id', sessionId)
    .single()

  if (sessionError) throw sessionError

  const { data: accountRows, error: accountError } = await supabase
    .from('table_accounts')
    .select('id, status')
    .eq('session_id', sessionId)
    .order('account_number')

  if (accountError) throw accountError

  const accountIds = (accountRows ?? []).map((row: any) => row.id)
  const { data: itemRows, error: itemError } = accountIds.length
    ? await supabase.from('order_items').select('id, status').in('account_id', accountIds)
    : { data: [], error: null }

  if (itemError) throw itemError

  const hasSentItems = (itemRows ?? []).some((row: any) => row.status === 'sent')
  const allAccountsPaid = (accountRows ?? []).length > 0 && (accountRows ?? []).every((row: any) => row.status === 'paid')

  let sessionStatus = 'open'
  let tableStatus = 'occupied'

  if (allAccountsPaid) {
    sessionStatus = 'closed'
    tableStatus = 'available'
  } else if (hasSentItems) {
    sessionStatus = 'serving'
    tableStatus = 'serving'
  }

  const { error: updateSessionError } = await supabase
    .from('table_sessions')
    .update({
      status: sessionStatus,
      closed_at: sessionStatus === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', sessionId)

  if (updateSessionError) throw updateSessionError

  const { error: updateTableError } = await supabase
    .from('tables')
    .update({ status: tableStatus })
    .eq('id', sessionRow.table_id)

  if (updateTableError) throw updateTableError
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

  const activeSessions = sessionError ? [] : (sessionRows ?? [])

  const latestSessionByTable = new Map<string, any>()
  activeSessions.forEach((row: any) => {
    if (!latestSessionByTable.has(row.table_id)) latestSessionByTable.set(row.table_id, row)
  })

  const sessionIds = activeSessions.map((row: any) => row.id)
  const { data: accountRows, error: accountError } = sessionIds.length
    ? await supabase.from('table_accounts').select('session_id, total').in('session_id', sessionIds)
    : { data: [], error: null }

  const totalsBySession = new Map<string, number>()
  ;(accountError ? [] : (accountRows ?? [])).forEach((row: any) => {
    totalsBySession.set(row.session_id, (totalsBySession.get(row.session_id) ?? 0) + Number(row.total ?? 0))
  })

  const legacyAccountsResult = await supabase
    .from('table_accounts')
    .select('table_id, total, status, updated_at, session_id')
    .eq('user_id', restaurantId)
    .order('updated_at', { ascending: false })

  let legacyRows = legacyAccountsResult.error ? [] : (legacyAccountsResult.data ?? [])
  if (legacyAccountsResult.error) {
    const fallbackLegacyResult = await supabase
      .from('table_accounts')
      .select('table_id, total, status, updated_at')
      .eq('user_id', restaurantId)
      .order('updated_at', { ascending: false })

    legacyRows = fallbackLegacyResult.error ? [] : (fallbackLegacyResult.data ?? [])
  }

  const legacyTotalsByTable = new Map<string, number>()
  legacyRows.forEach((row: any) => {
    if (row.session_id) return
    const status = String(row.status || '').toLowerCase()
    if (status === 'closed' || status === 'paid') return
    legacyTotalsByTable.set(row.table_id, (legacyTotalsByTable.get(row.table_id) ?? 0) + Number(row.total ?? 0))
  })

  return (tableRows ?? []).map((row: any) => {
    const session = latestSessionByTable.get(row.id)
    const fallbackTotal = legacyTotalsByTable.get(row.id) ?? 0
    return {
      id: row.id,
      number: Number(row.table_number),
      capacity: Number(row.capacity ?? 0),
      location: row.location,
      status: session ? mapSessionToTableStatus(session.status) : mapTableStatus(row.status),
      total: session ? totalsBySession.get(session.id) ?? 0 : fallbackTotal,
      openMinutes: session?.opened_at ? minutesSince(session.opened_at) : 0,
      sessionId: session?.id ?? null,
    }
  })
}

async function getSessionDetails(supabase: any, sessionId: string) {
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
    ? await supabase.from('order_item_options').select('*').in('order_item_id', itemIds)
    : { data: [], error: null }

  if (optionError) throw optionError

  const { data: paymentRows, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (paymentError) throw paymentError

  const optionsMap = buildOptionsMap(optionRows ?? [])
  const items = (itemRows ?? []).map((row: any) => {
    const options = optionsMap.get(row.id) ?? []
    return {
      id: row.id,
      sessionId: row.session_id,
      accountId: row.account_id,
      productId: row.product_id,
      productName: row.product_name,
      quantity: Number(row.quantity ?? 1),
      unitPrice: Number(row.unit_price ?? row.price ?? 0),
      totalPrice: buildItemTotal(row, options),
      notes: row.notes || '',
      status: row.status,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      options,
    }
  })

  const accounts = (accountRows ?? []).map((row: any) => {
    const accountItems = items.filter((item: any) => item.accountId === row.id)
    return {
      id: row.id,
      sessionId: row.session_id,
      name: row.name || `Conta ${row.account_number ?? 1}`,
      total: Number(row.total ?? 0),
      status: row.status === 'paid' ? 'paid' : 'open',
      itemCount: accountItems.length,
      items: accountItems,
    }
  })

  const history = [
    ...items.map((item: any) => ({
      id: `item-${item.id}`,
      type: 'item',
      label: `${item.quantity}x ${item.productName}`,
      timestamp: item.sentAt ?? item.createdAt,
      amount: item.totalPrice,
    })),
    ...(paymentRows ?? []).map((payment: any) => ({
      id: `payment-${payment.id}`,
      type: 'payment',
      label: `Pagamento ${String(payment.method).toUpperCase()}`,
      timestamp: payment.created_at,
      amount: Number(payment.amount ?? 0),
    })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())

  return {
    id: sessionRow.id,
    tableId: sessionRow.table_id,
    tableNumber: Number(tableRow.table_number),
    openedAt: sessionRow.opened_at,
    closedAt: sessionRow.closed_at,
    guestCount: Number(sessionRow.guest_count ?? accounts.length),
    status: sessionRow.status,
    accounts,
    history,
  }
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
    ? await supabase.from('product_variations').select('*').in('product_id', productIds)
    : { data: [], error: null }

  if (specificError) throw specificError

  const { data: linkRows, error: linkError } = productIds.length
    ? await supabase.from('product_global_variation_links').select('*').in('product_id', productIds)
    : { data: [], error: null }

  if (linkError) throw linkError

  const globalIds = (linkRows ?? []).map((row: any) => row.global_variation_id)
  const { data: globalRows, error: globalError } = globalIds.length
    ? await supabase.from('global_variations').select('*').in('id', globalIds)
    : { data: [], error: null }

  if (globalError) throw globalError

  const products = (productRows ?? []).map((row: any) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: Number(row.price ?? 0),
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
    name: 'Favoritos',
    products: products.filter((product: any) => product.featured),
  }

  return favorites.products.length ? [favorites, ...categories] : categories
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

    if (action === 'open_session') {
      const cashGuard = await requireOpenCashSession(supabase, waiterSession.profile.restaurantId)
      if (cashGuard) return cashGuard
      const tableId = String(body?.tableId || '')
      const tableNumber = Number(body?.tableNumber || 0)
      const guestCount = Math.max(1, Number(body?.guestCount || 1))
      if (!tableId || !tableNumber) {
        return fail('Mesa inválida.')
      }

      const existing = await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', tableId)
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
          opened_at: new Date().toISOString(),
          guest_count: guestCount,
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
      if (!sessionId) return fail('Sessão inválida.')
      const session = await getSessionDetails(supabase, sessionId)
      return ok({ session })
    }

    if (action === 'create_account') {
      const sessionId = String(body?.sessionId || '')
      const name = String(body?.name || '').trim()
      if (!sessionId || !name) return fail('Informe o nome da conta.')

      const { data: rows, error: listError } = await supabase
        .from('table_accounts')
        .select('account_number')
        .eq('session_id', sessionId)
        .order('account_number', { ascending: false })
        .limit(1)

      if (listError) throw listError

      const nextNumber = Number(rows?.[0]?.account_number ?? 0) + 1
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
      return ok({ ok: true })
    }

    if (action === 'rename_account') {
      const accountId = String(body?.accountId || '')
      const name = String(body?.name || '').trim()
      if (!accountId || !name) return fail('Informe um nome válido.')
      const { error } = await supabase.from('table_accounts').update({ name }).eq('id', accountId)
      if (error) throw error
      return ok({ ok: true })
    }

    if (action === 'remove_account') {
      const accountId = String(body?.accountId || '')
      if (!accountId) return fail('Conta inválida.')
      const { data, error } = await supabase.from('order_items').select('id').eq('account_id', accountId).limit(1)
      if (error) throw error
      if ((data ?? []).length > 0) return fail('Só é possível remover conta vazia.', 400)
      const { error: deleteError } = await supabase.from('table_accounts').delete().eq('id', accountId)
      if (deleteError) throw deleteError
      return ok({ ok: true })
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
      if (!sessionId || !accountId || !productId) return fail('Dados do item inválidos.')

      const { data: productRow, error: productError } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('id', productId)
        .eq('user_id', waiterSession.profile.restaurantId)
        .single()

      if (productError) throw productError

      const { data: itemRow, error: itemError } = await supabase
        .from('order_items')
        .insert({
          session_id: sessionId,
          account_id: accountId,
          product_id: productRow.id,
          product_name: productRow.name,
          quantity,
          unit_price: Number(productRow.price ?? 0),
          notes,
          status: 'draft',
        })
        .select('id')
        .single()

      if (itemError) throw itemError

      if (selectedOptions.length) {
        const { error: optionError } = await supabase
          .from('order_item_options')
          .insert(
            selectedOptions.map((option: any) => ({
              order_item_id: itemRow.id,
              option_name: option.name,
              price: Number(option.price ?? 0),
              quantity: 1,
            })),
          )

        if (optionError) throw optionError
      }

      await refreshAccountTotal(supabase, accountId)
      await refreshSessionStatus(supabase, sessionId)
      return ok({ ok: true })
    }

    if (action === 'cancel_draft_item') {
      const itemId = String(body?.itemId || '')
      const accountId = String(body?.accountId || '')
      const sessionId = String(body?.sessionId || '')
      if (!itemId || !accountId || !sessionId) return fail('Item inválido.')

      const { data: row, error: rowError } = await supabase
        .from('order_items')
        .select('id, status')
        .eq('id', itemId)
        .maybeSingle()

      if (rowError) throw rowError
      if (!row) return fail('Item não encontrado.', 404)
      if (row.status !== 'draft') return fail('Só é possível cancelar itens que ainda não foram enviados.', 400)

      const { error: updateError } = await supabase.from('order_items').update({ status: 'cancelled' }).eq('id', itemId)
      if (updateError) throw updateError

      await refreshAccountTotal(supabase, accountId)
      await refreshSessionStatus(supabase, sessionId)
      return ok({ ok: true })
    }

    if (action === 'send_account') {
      const sessionId = String(body?.sessionId || '')
      const accountId = String(body?.accountId || '')
      if (!sessionId || !accountId) return fail('Conta inválida.')

      const draftRows = await supabase
        .from('order_items')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'draft')
        .order('created_at', { ascending: true })

      if (draftRows.error) throw draftRows.error
      if (!draftRows.data?.length) return fail('Nenhum item novo para enviar.', 400)

      const { data: accountRow, error: accountError } = await supabase
        .from('table_accounts')
        .select('id, name')
        .eq('id', accountId)
        .single()

      if (accountError) throw accountError

      const itemIds = draftRows.data.map((row: any) => row.id)
      const optionRows = itemIds.length
        ? await supabase.from('order_item_options').select('*').in('order_item_id', itemIds)
        : { data: [], error: null }

      if (optionRows.error) throw optionRows.error

      const { data: sessionRow, error: sessionError } = await supabase
        .from('table_sessions')
        .select('table_id')
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError

      const optionsMap = buildOptionsMap(optionRows.data ?? [])
      const orderItems = draftRows.data.map((row: any) => {
        const options = optionsMap.get(row.id) ?? []
        return {
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: Number(row.quantity ?? 1),
          price: Number(row.unit_price ?? 0),
          subtotal: buildItemTotal(row, options),
          options: options.map((option: any) => option.optionName),
          notes: row.notes || '',
        }
      })

      const total = orderItems.reduce((sum: number, item: any) => sum + Number(item.subtotal ?? 0), 0)
      const orderNumber = `M${new Date().getTime().toString().slice(-6)}`
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: waiterSession.profile.restaurantId,
          order_number: orderNumber,
          customer_name: accountRow.name,
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
      return ok({ ok: true })
    }

    if (action === 'record_payment') {
      const cashGuard = await requireOpenCashSession(supabase, waiterSession.profile.restaurantId)
      if (cashGuard) return cashGuard
      const sessionId = String(body?.sessionId || '')
      const accountId = body?.accountId ? String(body.accountId) : null
      const amount = Number(body?.amount || 0)
      const method = String(body?.method || 'cash')
      if (!sessionId || amount <= 0) return fail('Pagamento inválido.')

      const { error: paymentError } = await supabase.from('payments').insert({
        session_id: sessionId,
        account_id: accountId,
        user_id: waiterSession.profile.restaurantId,
        waiter_id: waiterSession.profile.id,
        method,
        amount,
      })

      if (paymentError) throw paymentError

      if (accountId) {
        const { error: accountError } = await supabase
          .from('table_accounts')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', accountId)

        if (accountError) throw accountError
      } else {
        const { error: accountError } = await supabase
          .from('table_accounts')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('session_id', sessionId)

        if (accountError) throw accountError
      }

      await refreshSessionStatus(supabase, sessionId)
      return ok({ ok: true })
    }

    return fail('Ação inválida.', 400)
  } catch (error: any) {
    return fail(String(error?.message || 'Erro interno no app do garçom.'), 500)
  }
})
