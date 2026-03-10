// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  for (const item of items) {
    const productId = String(item?.product_id || '')
    const qty = Math.max(0, parseInt(String(item?.quantity || '0'), 10) || 0)
    if (!productId || qty <= 0) continue

    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, user_id, track_stock, stock_quantity, show_in_delivery, available, is_available')
      .eq('id', productId)
      .eq('user_id', order.user_id)
      .maybeSingle()

    if (pErr || !product) continue
    if (!product.track_stock) continue

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

    const userId = await getAuthUserId(req)
    if (!userId) return ok({ ok: false, error: 'unauthorized' })

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.orderId || '')
    const newStatus = String(body?.newStatus || '')

    const validStatuses = ['pending', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed', 'cancelled']
    if (!orderId || !validStatuses.includes(newStatus)) {
      return ok({ ok: false, error: 'invalid_payload' })
    }

    const svc = await createServiceClient(supabaseUrl)
    if (svc.error) return ok({ ok: false, error: 'missing_env', details: svc.error })
    const supabase = svc.client

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, status, acceptance_status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr) return ok({ ok: false, error: 'db_error', details: errInfo(orderErr) })
    if (!order) return ok({ ok: false, error: 'not_found' })

    if (String(order.user_id) !== userId) {
      return ok({ ok: false, error: 'forbidden' })
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
    if (newStatus === 'preparing') {
      try {
        stockResult = await applyStockForOrder(supabase, updated)
      } catch {}
    }

    return ok({ ok: true, order: updated, stock: stockResult })
  } catch (e: any) {
    return ok({ ok: false, error: 'internal_error', message: String(e?.message || e) })
  }
})
