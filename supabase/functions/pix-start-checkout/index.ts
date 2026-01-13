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
    const preferredMethod = String(body?.preferredMethod || orderPayload?.payment_method || '')

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

    const correlationID = crypto.randomUUID()
    const value = Math.round(total * 100)
    const customerName = String(orderPayload?.customer_name || 'Cliente')
    const customerPhone = String(orderPayload?.customer_phone || '')
    const origin = req.headers.get('origin') || ''

    const provider = String(pix.bank || 'mercadopago').toLowerCase()
    const webhookSecret = Deno.env.get('PIX_WEBHOOK_SECRET') || String(pix.webhook_secret || '')
    const webhookBase = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/pix-webhook`
    const notificationUrl = `${webhookBase}?secret=${encodeURIComponent(webhookSecret)}&cid=${encodeURIComponent(correlationID)}`

    await supabase.from('pix_checkouts').insert({
      restaurant_user_id: restaurantUserId,
      correlation_id: correlationID,
      amount_cents: value,
      status: 'CREATED',
      provider: provider || 'mercadopago',
      order_payload: orderPayload,
      updated_at: new Date().toISOString()
    })

    if (provider === 'mercadopago') {
      const accessToken = String(pix.client_id || '')
      if (!accessToken) return new Response(JSON.stringify({ ok: false, error: 'missing_provider_credentials' }), { status: 400, headers: corsHeaders })

      if (preferredMethod === 'pix') {
        const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            transaction_amount: Number((value / 100).toFixed(2)),
            description: `Pedido ${orderPayload?.order_number || correlationID}`,
            payment_method_id: 'pix',
            external_reference: correlationID,
            notification_url: notificationUrl,
            payer: {
              email: `${correlationID}@boracume.local`,
              first_name: customerName || 'Cliente',
              phone: customerPhone ? { number: customerPhone } : undefined
            }
          })
        })

        const mpJson: any = await mpResp.json().catch(() => ({}))
        if (!mpResp.ok) {
          return new Response(JSON.stringify({ ok: false, error: 'provider_error', details: mpJson }), { status: 502, headers: corsHeaders })
        }

        const brCode = mpJson?.point_of_interaction?.transaction_data?.qr_code || ''
        const qrBase64 = mpJson?.point_of_interaction?.transaction_data?.qr_code_base64 || ''
        const ticketUrl = mpJson?.point_of_interaction?.transaction_data?.ticket_url || ''
        const qrCodeImage = qrBase64 ? `data:image/png;base64,${qrBase64}` : ''

        return new Response(JSON.stringify({ ok: true, correlationID, brCode, qrCodeImage, paymentLinkUrl: ticketUrl, provider: 'mercadopago' }), { headers: corsHeaders })
      }

      const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          external_reference: correlationID,
          notification_url: notificationUrl,
          back_urls: origin
            ? {
                success: `${origin}/mp/return?cid=${encodeURIComponent(correlationID)}`,
                pending: `${origin}/mp/return?cid=${encodeURIComponent(correlationID)}`,
                failure: `${origin}/mp/return?cid=${encodeURIComponent(correlationID)}`
              }
            : undefined,
          auto_return: 'approved',
          items: [
            {
              title: `Pedido ${orderPayload?.order_number || 'BoraCume'}`,
              quantity: 1,
              unit_price: Number((value / 100).toFixed(2))
            }
          ]
        })
      })

      const mpJson: any = await mpResp.json().catch(() => ({}))
      if (!mpResp.ok) {
        return new Response(JSON.stringify({ ok: false, error: 'provider_error', details: mpJson }), { status: 502, headers: corsHeaders })
      }

      const initPoint = mpJson?.init_point || mpJson?.sandbox_init_point || ''
      return new Response(JSON.stringify({ ok: true, correlationID, initPoint, provider: 'mercadopago' }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ ok: false, error: 'unsupported_provider' }), { status: 400, headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 500, headers: corsHeaders })
  }
}
