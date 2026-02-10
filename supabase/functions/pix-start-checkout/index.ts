// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

console.log("Edge Function pix-start-checkout init")

const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

const getRequestOrigin = (req: Request) => {
  const origin = req.headers.get('origin')
  if (origin) return origin
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin
    } catch {
      return ''
    }
  }
  return ''
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const ok = (payload: any) =>
    new Response(JSON.stringify(payload), { status: 200, headers: corsHeaders })

  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing environment variables")
      return ok({ ok: false, error: 'missing_env', message: "Missing environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    let body
    try {
      body = await req.json()
    } catch (e: any) {
      console.error("Error parsing JSON body:", e)
      return ok({ ok: false, error: 'invalid_json_body', details: e?.message })
    }

    const restaurantUserId = String(body?.restaurantUserId || '')
    const orderPayload = body?.orderPayload
    const total = Number(orderPayload?.total || 0)
    const preferredMethod = String(body?.preferredMethod || orderPayload?.payment_method || '')

    console.log(`Processing request for user: ${restaurantUserId}, total: ${total}`)

    if (!restaurantUserId || !orderPayload || !Number.isFinite(total) || total <= 0) {
      return ok({ ok: false, error: 'invalid_payload' })
    }

    const { data: pix, error: pixErr } = await supabase
      .from('pix_settings')
      .select('enabled, bank, pix_key, merchant_name, merchant_city, client_id, endpoint_base, webhook_secret')
      .eq('user_id', restaurantUserId)
      .maybeSingle()

    if (pixErr) {
      console.error("Database error fetching settings:", pixErr)
      return ok({ ok: false, error: 'db_error', details: pixErr })
    }
    
    if (!pix) {
      console.error("No pix settings found for user")
      return ok({ ok: false, error: 'pix_not_configured' })
    }

    if (!pix.enabled) return ok({ ok: false, error: 'pix_disabled' })

    const correlationID = crypto.randomUUID()
    const value = Math.round(total * 100)
    const customerName = String(orderPayload?.customer_name || 'Cliente')
    const customerPhone = String(orderPayload?.customer_phone || '')
    
    // Fallback seguro para origin se header não existir
    const origin = getRequestOrigin(req) || 'http://localhost:5173'

    const provider = String(pix.bank || 'mercadopago').toLowerCase()
    const webhookSecret = getEnv('PIX_WEBHOOK_SECRET') || String(pix.webhook_secret || '')
    if (!webhookSecret) {
      return ok({ ok: false, error: 'missing_webhook_secret' })
    }
    const webhookBase = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/pix-webhook`
    const notificationUrl = `${webhookBase}?secret=${encodeURIComponent(webhookSecret)}&cid=${encodeURIComponent(correlationID)}`

    // Tenta inserir, mas não falha fatalmente se der erro (log apenas)
    const { error: insertErr } = await supabase.from('pix_checkouts').insert({
      restaurant_user_id: restaurantUserId,
      correlation_id: correlationID,
      amount_cents: value,
      status: 'CREATED',
      provider: provider || 'mercadopago',
      order_payload: orderPayload,
      updated_at: new Date().toISOString()
    })

    if (insertErr) {
      console.error("Error creating pix_checkout record:", insertErr)
      // Não retorna erro fatal, tenta prosseguir com MP, mas idealmente deveria parar.
      // Vamos parar para garantir consistência
      return ok({ ok: false, error: 'db_insert_error', details: insertErr })
    }

    if (provider === 'mercadopago') {
      const accessToken = String(pix.client_id || '')
      if (!accessToken) return ok({ ok: false, error: 'missing_provider_credentials' })

      console.log("Calling Mercado Pago API...")
      
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
              email: `${correlationID}@boracume.local`, // Fake email para MP aceitar
              first_name: customerName.split(' ')[0] || 'Cliente',
              last_name: customerName.split(' ').slice(1).join(' ') || 'BoraCume',
              phone: customerPhone ? { area_code: "11", number: customerPhone.replace(/\D/g, '') } : undefined
            }
          })
        })

        const mpJson: any = await mpResp.json().catch(() => ({}))
        console.log("MP Response status:", mpResp.status)

        if (!mpResp.ok) {
          console.error("MP Error:", mpJson)
          await supabase
            .from('pix_checkouts')
            .update({
              status: 'FAILED',
              metadata: { provider: 'mercadopago', error: mpJson },
              updated_at: new Date().toISOString()
            })
            .eq('correlation_id', correlationID)
          return ok({ ok: false, error: 'provider_error', details: mpJson })
        }

        await supabase
          .from('pix_checkouts')
          .update({
            status: String(mpJson?.status || 'PENDING').toUpperCase(),
            transaction_id: String(mpJson?.id || ''),
            metadata: {
              provider: 'mercadopago',
              payment_id: mpJson?.id ?? null,
              status: mpJson?.status ?? null,
              ticket_url: mpJson?.point_of_interaction?.transaction_data?.ticket_url ?? null
            },
            updated_at: new Date().toISOString()
          })
          .eq('correlation_id', correlationID)

        const brCode = mpJson?.point_of_interaction?.transaction_data?.qr_code || ''
        const qrBase64 = mpJson?.point_of_interaction?.transaction_data?.qr_code_base64 || ''
        const ticketUrl = mpJson?.point_of_interaction?.transaction_data?.ticket_url || ''
        const qrCodeImage = qrBase64 ? `data:image/png;base64,${qrBase64}` : ''

        return ok({ ok: true, correlationID, brCode, qrCodeImage, paymentLinkUrl: ticketUrl, provider: 'mercadopago' })
      }

      const preferenceBody = {
        items: [
          {
            title: `Pedido ${orderPayload?.order_number || correlationID}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number((value / 100).toFixed(2)),
          },
        ],
        external_reference: correlationID,
        notification_url: notificationUrl,
        payer: {
          email: `${correlationID}@boracume.local`,
          name: customerName,
          phone: customerPhone ? { area_code: "11", number: customerPhone.replace(/\D/g, '') } : undefined,
        },
        back_urls: {
          success: `${origin.replace(/\/+$/, '')}/mp/return?cid=${encodeURIComponent(correlationID)}`,
          pending: `${origin.replace(/\/+$/, '')}/mp/return?cid=${encodeURIComponent(correlationID)}`,
          failure: `${origin.replace(/\/+$/, '')}/mp/return?cid=${encodeURIComponent(correlationID)}`,
        },
        auto_return: 'approved',
        metadata: {
          correlationID,
          restaurantUserId,
          payment_method: preferredMethod || null,
        },
      }

      const prefResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(preferenceBody),
      })

      const prefJson: any = await prefResp.json().catch(() => ({}))
      if (!prefResp.ok) {
        await supabase
          .from('pix_checkouts')
          .update({
            status: 'FAILED',
            metadata: { provider: 'mercadopago', error: prefJson },
            updated_at: new Date().toISOString()
          })
          .eq('correlation_id', correlationID)
        return ok({ ok: false, error: 'provider_error', details: prefJson })
      }

      await supabase
        .from('pix_checkouts')
        .update({
          status: 'PENDING',
          transaction_id: String(prefJson?.id || ''),
          metadata: {
            provider: 'mercadopago',
            preference_id: prefJson?.id ?? null,
            init_point: prefJson?.init_point ?? null
          },
          updated_at: new Date().toISOString()
        })
        .eq('correlation_id', correlationID)

      return ok({ ok: true, correlationID, initPoint: prefJson?.init_point || '', provider: 'mercadopago' })
    }

    return ok({ ok: false, error: 'unsupported_provider' })

  } catch (e: any) {
    console.error("Fatal error in edge function:", e)
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 200, headers: corsHeaders })
  }
})
