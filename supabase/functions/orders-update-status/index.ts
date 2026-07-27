// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getUserIfoodSettings,
  requestIfoodOrderAction,
} from '../_shared/ifood.ts'
import { notifyOrderStatus } from '../_shared/restaurant-whatsapp.ts'
import { processLoyaltyForOrder } from '../_shared/loyalty.ts'
import { resolveStoreUserId } from '../_shared/multi-store.ts'

export const config = { runtime: 'edge', verify_jwt: false }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

const ok = (payload: any) =>
  new Response(JSON.stringify(payload), { status: 200, headers: corsHeaders })

const errInfo = (e: any) => {
  if (!e) return null
  return {
    message: e.message,
    code: e.code,
    details: e.details,
    hint: e.hint,
    status: e.status
  }
}

const parseItems = (raw: any): any[] => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw)
      return Array.isArray(j) ? j : []
    } catch {
      return []
    }
  }
  return []
}

const applyStockForOrder = async (supabase: any, order: any) => {
  const items = parseItems(order?.items)
  if (!items.length) return { updated: 0, disabled: 0 }

  let updatedCount = 0
  let disabledCount = 0
  const grouped = new Map<string, number>()

  for (const item of items) {
    const productId = String(item?.product_id || item?.id || '')
    const qty = Math.max(0, parseInt(String(item?.quantity || '0'), 10) || 0)
    if (!productId || qty <= 0) continue
    grouped.set(productId, (grouped.get(productId) || 0) + qty)
  }

  for (const [productId, qty] of grouped.entries()) {
    const { data: existingMovement } = await supabase
      .from('inventory_movements')
      .select('id')
      .eq('user_id', order.user_id)
      .eq('order_id', order.id)
      .eq('product_id', productId)
      .eq('type', 'sale')
      .maybeSingle()

    if (existingMovement?.id) continue

    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, user_id, track_stock, stock_quantity, show_in_delivery, available, is_available')
      .eq('id', productId)
      .eq('user_id', order.user_id)
      .maybeSingle()

    if (pErr || !product) continue
    if (!product.track_stock) continue

    const { error: movementErr } = await supabase
      .from('inventory_movements')
      .insert({
        user_id: order.user_id,
        product_id: productId,
        order_id: order.id,
        type: 'sale',
        quantity: -qty
      })

    if (movementErr) continue

    const currentQty = Math.max(0, parseInt(String(product.stock_quantity || 0), 10) || 0)
    const nextQty = Math.max(0, currentQty - qty)

    const updateData: any = { stock_quantity: nextQty }
    if (nextQty <= 0) {
      updateData.show_in_delivery = false
      updateData.available = false
      updateData.is_available = false
    }

    const { error: uErr } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('user_id', order.user_id)

    if (!uErr) {
      updatedCount += 1
      if (nextQty <= 0) disabledCount += 1
    }
  }

  return { updated: updatedCount, disabled: disabledCount }
}

const restoreStockForCancelledOrder = async (supabase: any, order: any) => {
  const { data: saleMovements, error } = await supabase
    .from('inventory_movements')
    .select('product_id, quantity')
    .eq('user_id', order.user_id)
    .eq('order_id', order.id)
    .eq('type', 'sale')

  if (error || !Array.isArray(saleMovements) || saleMovements.length === 0) {
    return { restored: 0, skipped: true }
  }

  const { data: returnMovements } = await supabase
    .from('inventory_movements')
    .select('product_id, quantity')
    .eq('user_id', order.user_id)
    .eq('order_id', order.id)
    .eq('type', 'return')

  const returnedByProduct = new Map<string, number>()
  for (const movement of returnMovements || []) {
    const productId = String(movement?.product_id || '')
    const qty = Math.max(0, Number(movement?.quantity || 0))
    if (!productId || qty <= 0) continue
    returnedByProduct.set(productId, (returnedByProduct.get(productId) || 0) + qty)
  }

  const soldByProduct = new Map<string, number>()
  for (const movement of saleMovements) {
    const productId = String(movement?.product_id || '')
    const qty = Math.abs(Number(movement?.quantity || 0))
    if (!productId || qty <= 0) continue
    soldByProduct.set(productId, (soldByProduct.get(productId) || 0) + qty)
  }

  let restored = 0
  for (const [productId, soldQty] of soldByProduct.entries()) {
    const pendingQty = Math.max(0, soldQty - (returnedByProduct.get(productId) || 0))
    if (pendingQty <= 0) continue

    const { data: product } = await supabase
      .from('products')
      .select('id, stock_quantity, track_stock')
      .eq('id', productId)
      .eq('user_id', order.user_id)
      .maybeSingle()

    if (!product?.track_stock) continue

    const nextQty = Math.max(0, Number(product.stock_quantity || 0)) + pendingQty
    const { error: updateError } = await supabase
      .from('products')
      .update({
        stock_quantity: nextQty,
        available: true,
        is_available: true,
        show_in_delivery: true
      })
      .eq('id', productId)
      .eq('user_id', order.user_id)

    if (updateError) continue

    await supabase
      .from('inventory_movements')
      .insert({
        user_id: order.user_id,
        product_id: productId,
        order_id: order.id,
        type: 'return',
        quantity: pendingQty
      })

    restored += 1
  }

  return { restored, skipped: false }
}

const createAutomaticDeliveryOffer = async (supabase: any, order: any, newStatus: string) => {
  if (newStatus !== 'preparing' || String(order?.order_type || '') !== 'delivery') {
    return { ok: true, skipped: true, reason: 'not_accepted_delivery' }
  }

  const { data: assigned } = await supabase
    .from('delivery_assignments')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle()
  if (assigned?.id) return { ok: true, skipped: true, reason: 'already_assigned' }

  const { count: enabledDrivers } = await supabase
    .from('delivery_personnel')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', order.user_id)
    .eq('app_enabled', true)
  if (!enabledDrivers) return { ok: true, skipped: true, reason: 'no_app_drivers' }

  const now = new Date().toISOString()
  await supabase
    .from('delivery_offers')
    .update({ status: 'expired', updated_at: now })
    .eq('order_id', order.id)
    .eq('status', 'open')
    .lte('expires_at', now)

  const { data: existingOffer } = await supabase
    .from('delivery_offers')
    .select('id')
    .eq('order_id', order.id)
    .eq('status', 'open')
    .maybeSingle()
  if (existingOffer?.id) return { ok: true, skipped: true, reason: 'already_offered', offerId: existingOffer.id }

  const { data: settings } = await supabase
    .from('delivery_settlement_settings')
    .select('payout_mode,fixed_payout')
    .eq('user_id', order.user_id)
    .maybeSingle()
  const payoutAmount = String(settings?.payout_mode || 'delivery_fee') === 'fixed'
    ? Math.max(0, Number(settings?.fixed_payout) || 0)
    : Math.max(0, Number(order?.delivery_fee) || 0)

  const { data: offer, error } = await supabase
    .from('delivery_offers')
    .insert({
      restaurant_id: order.user_id,
      order_id: order.id,
      target_driver_id: null,
      payout_amount: payoutAmount,
      status: 'open',
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    if (String(error?.code || '') === '23505') return { ok: true, skipped: true, reason: 'already_offered' }
    return { ok: false, error: String(error?.message || error) }
  }

  return { ok: true, created: true, offerId: offer?.id || null, payoutAmount }
}

const callIfoodForStatus = async (supabase: any, order: any, newStatus: string, payload: any) => {
  const variations = order?.variations && typeof order.variations === 'object'
    ? order.variations
    : {}
  const ifoodData = variations?.ifood || {}
  const ifoodOrderId = String(variations?.externalOrderId || ifoodData?.id || '').trim()

  if (String(variations?.provider || '') !== 'ifood' || !ifoodOrderId) {
    return { ok: true, skipped: true }
  }

  const settings = await getUserIfoodSettings(supabase, String(order.user_id || ''))
  if (!settings?.client_id || !settings?.client_secret) {
    throw new Error('Credenciais do iFood não configuradas para esta loja')
  }

  const deliveredBy = String(ifoodData?.deliveredBy || '').toUpperCase()

  if (newStatus === 'preparing') {
    return await requestIfoodOrderAction(supabase, settings, ifoodOrderId, 'confirm')
  }

  if (newStatus === 'ready') {
    if (String(order?.order_type || '') !== 'delivery' || deliveredBy === 'IFOOD') {
      return await requestIfoodOrderAction(supabase, settings, ifoodOrderId, 'readyToPickup')
    }
    return { ok: true, skipped: true }
  }

  if (newStatus === 'in_delivery') {
    return await requestIfoodOrderAction(supabase, settings, ifoodOrderId, 'dispatch')
  }

  if (newStatus === 'cancelled') {
    const cancellationCode = String(payload?.ifoodCancellationCode || '').trim()
    const cancellationReason = String(payload?.ifoodCancellationReason || '').trim()
    if (!cancellationCode) {
      throw new Error('ifood_cancel_reason_required')
    }

    return await requestIfoodOrderAction(
      supabase,
      settings,
      ifoodOrderId,
      'requestCancellation',
      {
        reason: cancellationReason || 'Cancelamento solicitado no PopSystem',
        cancellationCode,
      },
    )
  }

  return { ok: true, skipped: true }
}

const getAuthUserId = async (req: Request): Promise<string> => {
  const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY', 'BORACUME_SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('authorization') || ''

  if (!supabaseUrl || !anonKey || !authHeader) return ''

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data, error } = await authClient.auth.getUser()
  if (error) return ''
  return data?.user?.id || ''
}

const createServiceClient = async (supabaseUrl: string) => {
  const keys = [
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    getEnv('BORACUME_SERVICE_ROLE_KEY'),
    getEnv('SERVICE_ROLE_KEY'),
  ].filter(Boolean)

  if (!keys.length) return { client: null, error: 'missing_env' }

  for (const key of keys) {
    const client = createClient(supabaseUrl, String(key), { auth: { persistSession: false } })
    const { error } = await client.from('orders').select('id').limit(1)
    if (!error) return { client, error: null }
    const msg = String(error?.message || '').toLowerCase()
    if (msg.includes('invalid api key') || msg.includes('jwt') || error?.status === 401 || error?.status === 403) {
      continue
    }
    return { client, error }
  }

  return { client: null, error: 'invalid_service_key' }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) return ok({ ok: false, error: 'missing_env' })

    const authenticatedUserId = await getAuthUserId(req)
    if (!authenticatedUserId) return ok({ ok: false, error: 'unauthorized' })

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.orderId || '')
    const newStatus = String(body?.newStatus || '')
    const operationId = String(body?.operationId || crypto.randomUUID())

    const validStatuses = ['pending', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed', 'cancelled']
    if (!orderId || !validStatuses.includes(newStatus)) {
      return ok({ ok: false, error: 'invalid_payload' })
    }

    const svc = await createServiceClient(supabaseUrl)
    if (svc.error) return ok({ ok: false, error: 'missing_env', details: svc.error })
    const supabase = svc.client
    let userId = authenticatedUserId
    try {
      userId = await resolveStoreUserId(supabase, authenticatedUserId, body?._storeId)
    } catch {
      return ok({ ok: false, error: 'forbidden' })
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr) return ok({ ok: false, error: 'db_error', details: errInfo(orderErr) })
    if (!order) return ok({ ok: false, error: 'not_found' })

    if (String(order.user_id) !== userId) {
      return ok({ ok: false, error: 'forbidden' })
    }

    const alreadyApplied =
      String(order.status || '') === newStatus &&
      (newStatus !== 'preparing' || String(order.acceptance_status || '') === 'accepted') &&
      (newStatus !== 'cancelled' || String(order.acceptance_status || '') === 'rejected')

    // Aceites repetidos (duplo clique, retry ou resposta perdida) não podem
    // repetir confirmação no iFood, WhatsApp, impressão lógica ou estoque.
    if (alreadyApplied) {
      return ok({
        ok: true,
        order,
        idempotent: true,
        operationId,
        stock: { skipped: true, reason: 'status_already_applied' },
        whatsapp: { skipped: true, reason: 'status_already_applied' },
        deliveryOffer: { skipped: true, reason: 'status_already_applied' },
        loyalty: { skipped: true, reason: 'status_already_applied' },
      })
    }

    try {
      await callIfoodForStatus(supabase, order, newStatus, body)
    } catch (e: any) {
      return ok({ ok: false, error: 'ifood_action_failed', details: { message: String(e?.message || e) } })
    }

    const updateData =
      newStatus === 'preparing'
        ? { status: newStatus, acceptance_status: 'accepted' }
        : newStatus === 'cancelled'
          ? { status: newStatus, acceptance_status: 'rejected' }
          : { status: newStatus }

    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('*')
      .single()

    if (updateErr) return ok({ ok: false, error: 'db_error', details: errInfo(updateErr) })

    let stockResult: any = null
    if (['preparing', 'ready', 'in_delivery', 'delivered', 'completed'].includes(newStatus)) {
      try {
        stockResult = await applyStockForOrder(supabase, updated)
      } catch {}
    } else if (newStatus === 'cancelled' && String(order.status || '') !== 'cancelled') {
      try {
        stockResult = await restoreStockForCancelledOrder(supabase, updated)
      } catch (e: any) {
        stockResult = { ok: false, error: String(e?.message || e) }
      }
    }

    let whatsappResult: any = null
    try {
      whatsappResult = await notifyOrderStatus(supabase, updated, newStatus)
    } catch (e: any) {
      whatsappResult = { ok: false, error: String(e?.message || e) }
    }

    let deliveryOfferResult: any = null
    try {
      deliveryOfferResult = await createAutomaticDeliveryOffer(supabase, updated, newStatus)
    } catch (e: any) {
      deliveryOfferResult = { ok: false, error: String(e?.message || e) }
    }

    let loyaltyResult: any = null
    try {
      if (newStatus === 'delivered' || newStatus === 'completed') {
        loyaltyResult = await processLoyaltyForOrder(supabase, updated)
      }
    } catch (e: any) {
      loyaltyResult = { ok: false, error: String(e?.message || e) }
    }

    return ok({
      ok: true,
      order: updated,
      stock: stockResult,
      whatsapp: whatsappResult,
      deliveryOffer: deliveryOfferResult,
      loyalty: loyaltyResult,
      idempotent: false,
      operationId,
    })
  } catch (e: any) {
    return ok({ ok: false, error: 'internal_error', message: String(e?.message || e) })
  }
})
