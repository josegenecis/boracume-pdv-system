// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceKey)

const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const correlationID = String(body?.correlationID || '')
    if (!correlationID) return new Response(JSON.stringify({ ok: false, error: 'missing_correlationID' }), { status: 200, headers: corsHeaders })

    const { data, error } = await supabase
      .from('pix_checkouts')
      .select('id,status,order_id,provider,restaurant_user_id,transaction_id,metadata,order_payload')
      .eq('correlation_id', correlationID)
      .maybeSingle()

    if (error || !data) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 200, headers: corsHeaders })

    const normalized = String(data.status || '').toUpperCase()
    const existingOrderId = data.order_id || null
    if (normalized === 'PAID' && existingOrderId) {
      return new Response(JSON.stringify({ ok: true, status: data.status, orderId: existingOrderId }), { status: 200, headers: corsHeaders })
    }

    const provider = String((data as any).provider || '').toLowerCase()
    if (provider === 'mercadopago') {
      const paymentId =
        String((data as any)?.metadata?.payment_id || '') ||
        String((data as any)?.transaction_id || '')

      if (paymentId) {
        const mpClientId = getEnv('MP_PLATFORM_CLIENT_ID')
        const mpClientSecret = getEnv('MP_PLATFORM_CLIENT_SECRET')

        const { data: mp } = await supabase
          .from('pix_settings')
          .select('client_id, mp_access_token, mp_refresh_token, mp_expires_at')
          .eq('user_id', (data as any).restaurant_user_id)
          .maybeSingle()

        const refreshAccessToken = async () => {
          const refreshToken = String((mp as any)?.mp_refresh_token || '')
          if (!refreshToken || !mpClientId || !mpClientSecret) return ''
          const resp = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: mpClientId,
              client_secret: mpClientSecret,
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
            })
          })
          const json: any = await resp.json().catch(() => ({}))
          if (!resp.ok) return ''
          const nextToken = String(json?.access_token || '')
          const nextRefresh = String(json?.refresh_token || '') || refreshToken
          const expiresIn = json?.expires_in ? Number(json.expires_in) : 0
          const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
          await supabase
            .from('pix_settings')
            .update({
              mp_access_token: nextToken || null,
              mp_refresh_token: nextRefresh || null,
              mp_expires_at: expiresAt,
              client_id: nextToken || null,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', (data as any).restaurant_user_id)
          return nextToken
        }

        const getAccessToken = async () => {
          const token = String((mp as any)?.mp_access_token || (mp as any)?.client_id || '')
          const expiresAtRaw = String((mp as any)?.mp_expires_at || '')
          if (expiresAtRaw) {
            const t = new Date(expiresAtRaw).getTime()
            if (Number.isFinite(t) && Date.now() > t - 60_000) {
              const refreshed = await refreshAccessToken()
              if (refreshed) return refreshed
            }
          }
          return token
        }

        let accessToken = await getAccessToken()
        if (!accessToken) {
          return new Response(JSON.stringify({ ok: true, status: data.status, orderId: existingOrderId }), { status: 200, headers: corsHeaders })
        }

        const callPayment = async (token: string) =>
          fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })

        let paymentResp = await callPayment(accessToken)
        if (paymentResp.status === 401) {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            accessToken = refreshed
            paymentResp = await callPayment(accessToken)
          }
        }
        const paymentJson: any = await paymentResp.json().catch(() => ({}))
        if (!paymentResp.ok) {
          return new Response(JSON.stringify({
            ok: true,
            status: data.status,
            orderId: existingOrderId,
            mp: {
              ok: false,
              id: paymentId,
              status: paymentJson?.status ?? null,
              status_detail: paymentJson?.status_detail ?? null,
              message: paymentJson?.message ?? null,
              error: paymentJson?.error ?? null,
              cause: paymentJson?.cause ?? null
            }
          }), { status: 200, headers: corsHeaders })
        }

        const mpStatus = String(paymentJson?.status || '').toLowerCase()
        const mpDetail = String(paymentJson?.status_detail || '').toLowerCase()
        const externalRef = String(paymentJson?.external_reference || '')
        if (externalRef && externalRef !== correlationID) {
          return new Response(JSON.stringify({
            ok: true,
            status: data.status,
            orderId: existingOrderId,
            mp: {
              ok: true,
              id: paymentJson?.id ?? paymentId,
              status: paymentJson?.status ?? null,
              status_detail: paymentJson?.status_detail ?? null,
              date_approved: paymentJson?.date_approved ?? null,
              external_reference: paymentJson?.external_reference ?? null,
              note: 'external_reference_mismatch'
            }
          }), { status: 200, headers: corsHeaders })
        }

        if (mpStatus === 'approved' && (Boolean(paymentJson?.date_approved) || mpDetail === 'accredited')) {
          const payload = (data as any).order_payload || {}
          const orderNumber = payload?.order_number || `MP-${correlationID.slice(0, 8)}`

          const insertData: any = {
            user_id: (data as any).restaurant_user_id,
            order_number: orderNumber,
            customer_name: payload?.customer_name || 'Cliente',
            customer_phone: payload?.customer_phone || null,
            customer_address: payload?.customer_address || null,
            customer_neighborhood: payload?.customer_neighborhood || null,
            delivery_zone_id: payload?.delivery_zone_id || null,
            items: payload?.items || [],
            total: payload?.total || 0,
            delivery_fee: payload?.delivery_fee || 0,
            payment_method: 'pix',
            discount: payload?.discount ?? 0,
            coupon_code: payload?.coupon_code ?? null,
            status: 'pending',
            acceptance_status: 'pending_acceptance',
            change_amount: payload?.change_amount ?? null,
            order_type: payload?.order_type || 'delivery',
            delivery_instructions: payload?.delivery_instructions || null,
            estimated_time: payload?.estimated_time || null,
            customer_latitude: payload?.customer_latitude || null,
            customer_longitude: payload?.customer_longitude || null,
            customer_location_accuracy: payload?.customer_location_accuracy || null,
            google_maps_link: payload?.google_maps_link || null
          }

          const { data: created, error: createErr } = await supabase
            .from('orders')
            .insert(insertData)
            .select('id')
            .single()

          if (!createErr && created?.id) {
            await supabase
              .from('pix_checkouts')
              .update({ status: 'PAID', order_id: created.id, updated_at: new Date().toISOString() })
              .eq('id', (data as any).id)
            return new Response(JSON.stringify({
              ok: true,
              status: 'PAID',
              orderId: created.id,
              mp: {
                ok: true,
                id: paymentJson?.id ?? paymentId,
                status: paymentJson?.status ?? null,
                status_detail: paymentJson?.status_detail ?? null,
                date_approved: paymentJson?.date_approved ?? null,
                external_reference: paymentJson?.external_reference ?? null,
              }
            }), { status: 200, headers: corsHeaders })
          }
          return new Response(JSON.stringify({
            ok: true,
            status: data.status,
            orderId: existingOrderId,
            mp: {
              ok: true,
              id: paymentJson?.id ?? paymentId,
              status: paymentJson?.status ?? null,
              status_detail: paymentJson?.status_detail ?? null,
              date_approved: paymentJson?.date_approved ?? null,
              external_reference: paymentJson?.external_reference ?? null,
              note: 'order_create_failed'
            }
          }), { status: 200, headers: corsHeaders })
        } else if (mpStatus) {
          await supabase
            .from('pix_checkouts')
            .update({ status: String(mpStatus).toUpperCase(), updated_at: new Date().toISOString() })
            .eq('id', (data as any).id)
          return new Response(JSON.stringify({
            ok: true,
            status: String(mpStatus).toUpperCase(),
            orderId: existingOrderId,
            mp: {
              ok: true,
              id: paymentJson?.id ?? paymentId,
              status: paymentJson?.status ?? null,
              status_detail: paymentJson?.status_detail ?? null,
              date_approved: paymentJson?.date_approved ?? null,
              external_reference: paymentJson?.external_reference ?? null,
            }
          }), { status: 200, headers: corsHeaders })
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, status: data.status, orderId: existingOrderId }), { status: 200, headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 200, headers: corsHeaders })
  }
}
