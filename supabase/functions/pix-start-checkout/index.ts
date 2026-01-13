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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const restaurantUserId = String(body?.restaurantUserId || '')
    const orderPayload = body?.orderPayload
    const total = Number(orderPayload?.total || 0)

    if (!restaurantUserId || !orderPayload || !Number.isFinite(total) || total <= 0) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_payload' }), { status: 400, headers: corsHeaders })
    }

    const { data: pix, error: pixErr } = await supabase
      .from('pix_settings')
      .select('enabled, bank, pix_key, merchant_name, merchant_city, client_id, endpoint_base, webhook_secret')
      .eq('user_id', restaurantUserId)
      .maybeSingle()

    if (pixErr || !pix) return new Response(JSON.stringify({ ok: false, error: 'pix_not_configured' }), { status: 400, headers: corsHeaders })
    if (!pix.enabled) return new Response(JSON.stringify({ ok: false, error: 'pix_disabled' }), { status: 400, headers: corsHeaders })

    const appId = String(pix.client_id || '')
    const base = String(pix.endpoint_base || 'https://api.openpix.com.br/api/openpix/v1')
    if (!appId) return new Response(JSON.stringify({ ok: false, error: 'missing_provider_credentials' }), { status: 400, headers: corsHeaders })

    const correlationID = crypto.randomUUID()
    const value = Math.round(total * 100)
    const customerName = String(orderPayload?.customer_name || 'Cliente')
    const customerPhone = String(orderPayload?.customer_phone || '')

    const chargePayload: any = {
      correlationID,
      value,
      comment: `Pedido BoraCume`,
    }
    if (customerName && customerPhone) {
      chargePayload.customer = { name: customerName, phone: customerPhone }
    } else if (customerName) {
      chargePayload.customer = { name: customerName, email: `${correlationID}@boracume.local` }
    }

    const resp = await fetch(`${base.replace(/\/+$/, '')}/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': appId
      },
      body: JSON.stringify(chargePayload)
    })

    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'provider_error', details: json }), { status: 502, headers: corsHeaders })
    }

    const brCode = json?.charge?.brCode || json?.charge?.brcode || ''
    const qrCodeImage = json?.charge?.qrCodeImage || ''
    const paymentLinkUrl = json?.charge?.paymentLinkUrl || ''

    await supabase.from('pix_checkouts').insert({
      restaurant_user_id: restaurantUserId,
      correlation_id: correlationID,
      amount_cents: value,
      status: 'CREATED',
      provider: 'openpix',
      order_payload: orderPayload,
      updated_at: new Date().toISOString()
    })

    return new Response(JSON.stringify({ ok: true, correlationID, brCode, qrCodeImage, paymentLinkUrl }), { headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 500, headers: corsHeaders })
  }
}

