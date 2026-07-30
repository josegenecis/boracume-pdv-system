// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnv, getPopPayAccessToken, getPopPayConnection, refreshPopPayAccessToken } from '../_shared/poppay.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const response = (payload: any, status = 200) => new Response(JSON.stringify(payload), { status, headers: corsHeaders })

const getAuthUserId = async (req: Request) => {
  const url = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const anon = getEnv('SUPABASE_ANON_KEY', 'BORACUME_SUPABASE_ANON_KEY')
  const authorization = req.headers.get('authorization') || ''
  if (!url || !anon || !authorization) return ''
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser()
  return error ? '' : String(data?.user?.id || '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    const userId = await getAuthUserId(req)
    if (!url || !serviceKey || !userId) return response({ ok: false, error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.orderId || '').trim()
    const reason = String(body?.reason || 'Cancelamento solicitado pelo restaurante').trim().slice(0, 500)
    if (!orderId) return response({ ok: false, error: 'missing_order_id' }, 400)

    const supabase = createClient(url, serviceKey)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,user_id,total,payment_method,status,order_number')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError || !order) return response({ ok: false, error: 'order_not_found' }, 404)
    if (String(order.user_id) !== userId) return response({ ok: false, error: 'forbidden' }, 403)
    if (!String(order.payment_method || '').toLowerCase().includes('pix')) {
      return response({ ok: false, error: 'not_pix_payment', message: 'Este pedido nao foi pago via PIX online.' }, 409)
    }

    const { data: checkout } = await supabase
      .from('pix_checkouts')
      .select('id,restaurant_user_id,transaction_id,status,amount_cents,payment_connection,refund_status,refunded_cents')
      .eq('order_id', orderId)
      .eq('restaurant_user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!checkout || !checkout.transaction_id) {
      return response({ ok: false, error: 'pix_checkout_not_found', message: 'Nao foi localizada uma cobranca PIX online para este pedido.' }, 404)
    }
    if (String(checkout.status).toUpperCase() === 'REFUNDED' || String(checkout.refund_status) === 'approved') {
      return response({ ok: true, idempotent: true, status: 'approved', refundedCents: Number(checkout.refunded_cents || checkout.amount_cents) })
    }
    if (String(checkout.status).toUpperCase() !== 'PAID') {
      return response({ ok: false, error: 'payment_not_approved', message: 'Somente um PIX aprovado pode ser devolvido.' }, 409)
    }

    const { data: existingRefund } = await supabase
      .from('poppay_refunds')
      .select('*')
      .eq('checkout_id', checkout.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existingRefund && ['requested', 'in_process', 'approved'].includes(String(existingRefund.status))) {
      return response({
        ok: true,
        idempotent: true,
        status: existingRefund.status,
        refundId: existingRefund.mp_refund_id || null,
        refundedCents: existingRefund.amount_cents,
      })
    }

    let accessToken = ''
    let refreshAccessToken: () => Promise<string>
    if (String(checkout.payment_connection || '') === 'poppay') {
      const { connection } = await getPopPayConnection(supabase, userId)
      if (!connection) return response({ ok: false, error: 'poppay_connection_missing' }, 409)
      accessToken = await getPopPayAccessToken(supabase, connection)
      refreshAccessToken = () => refreshPopPayAccessToken(supabase, connection)
    } else {
      const { data: legacy } = await supabase
        .from('pix_settings')
        .select('mp_access_token,client_id,mp_refresh_token,mp_expires_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (!legacy) return response({ ok: false, error: 'legacy_connection_missing' }, 409)
      const clientId = getEnv('MP_PLATFORM_CLIENT_ID')
      const clientSecret = getEnv('MP_PLATFORM_CLIENT_SECRET')
      refreshAccessToken = async () => {
        const refreshToken = String(legacy?.mp_refresh_token || '')
        if (!refreshToken || !clientId || !clientSecret) return ''
        const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }),
        })
        const token: any = await tokenResponse.json().catch(() => ({}))
        if (!tokenResponse.ok) return ''
        const next = String(token?.access_token || '')
        const nextRefresh = String(token?.refresh_token || '') || refreshToken
        const expiresIn = Number(token?.expires_in || 0)
        const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
        await supabase.from('pix_settings').update({ mp_access_token: next, client_id: next, mp_refresh_token: nextRefresh, mp_expires_at: expiresAt, updated_at: new Date().toISOString() }).eq('user_id', userId)
        return next
      }
      accessToken = String(legacy?.mp_access_token || legacy?.client_id || '')
      const expiresAt = legacy?.mp_expires_at ? new Date(String(legacy.mp_expires_at)).getTime() : 0
      if (!accessToken || (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt - 60_000)) accessToken = await refreshAccessToken()
    }
    if (!accessToken) return response({ ok: false, error: 'provider_credentials_missing' }, 409)

    const idempotencyKey = existingRefund?.idempotency_key || `poppay-refund-${checkout.id}`
    let refundRow = existingRefund
    if (refundRow) {
      const { data } = await supabase.from('poppay_refunds').update({ status: 'requested', reason, requested_by: userId, updated_at: new Date().toISOString() }).eq('id', refundRow.id).select('*').single()
      refundRow = data || refundRow
    } else {
      const { data, error } = await supabase.from('poppay_refunds').insert({
        user_id: userId,
        order_id: orderId,
        checkout_id: checkout.id,
        payment_id: String(checkout.transaction_id),
        amount_cents: Number(checkout.amount_cents),
        status: 'requested',
        idempotency_key: idempotencyKey,
        reason,
        requested_by: userId,
      }).select('*').single()
      if (error) {
        const { data: concurrent } = await supabase.from('poppay_refunds').select('*').eq('checkout_id', checkout.id).limit(1).maybeSingle()
        if (concurrent) return response({ ok: true, idempotent: true, status: concurrent.status, refundId: concurrent.mp_refund_id || null })
        throw error
      }
      refundRow = data
    }

    const requestRefund = (token: string) => fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(checkout.transaction_id))}/refunds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          'X-Render-In-Process-Refunds': 'true',
        },
        body: JSON.stringify({}),
      },
    )

    let providerResponse = await requestRefund(accessToken)
    if (providerResponse.status === 401) {
      const refreshed = await refreshAccessToken()
      if (refreshed) providerResponse = await requestRefund(refreshed)
    }
    const providerJson: any = await providerResponse.json().catch(() => ({}))
    if (!providerResponse.ok) {
      await supabase.from('poppay_refunds').update({ status: 'failed', provider_response: providerJson, updated_at: new Date().toISOString() }).eq('id', refundRow.id)
      await supabase.from('pix_checkouts').update({ refund_status: 'failed', updated_at: new Date().toISOString() }).eq('id', checkout.id)
      await supabase
        .from('finance_sale_cancellations')
        .update({ refund_status: 'failed' })
        .eq('user_id', userId)
        .eq('order_id', orderId)
        .eq('refund_requested', true)
      return response({ ok: false, error: 'refund_failed', message: String(providerJson?.message || providerJson?.error || 'O Mercado Pago recusou o reembolso.'), details: providerJson }, 409)
    }

    const providerStatus = String(providerJson?.status || '').toLowerCase()
    const refundStatus = providerStatus === 'in_process' ? 'in_process' : 'approved'
    await supabase.from('poppay_refunds').update({
      status: refundStatus,
      mp_refund_id: providerJson?.id ? String(providerJson.id) : null,
      provider_response: providerJson,
      completed_at: refundStatus === 'approved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', refundRow.id)
    await supabase.from('pix_checkouts').update({
      status: refundStatus === 'approved' ? 'REFUNDED' : 'PAID',
      refund_status: refundStatus,
      refunded_cents: refundStatus === 'approved' ? Number(checkout.amount_cents) : 0,
      updated_at: new Date().toISOString(),
    }).eq('id', checkout.id)
    await supabase
      .from('finance_sale_cancellations')
      .update({ refund_status: refundStatus })
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .eq('refund_requested', true)

    return response({
      ok: true,
      status: refundStatus,
      refundId: providerJson?.id ? String(providerJson.id) : null,
      refundedCents: Number(checkout.amount_cents),
      message: refundStatus === 'in_process' ? 'Reembolso em processamento pelo Mercado Pago.' : 'PIX devolvido para a conta pagadora.',
    })
  } catch (error: any) {
    return response({ ok: false, error: 'internal_error', message: String(error?.message || error) }, 500)
  }
})
