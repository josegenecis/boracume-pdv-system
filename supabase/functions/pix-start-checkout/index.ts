// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

console.log("Edge Function pix-start-checkout init")

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing environment variables")
      throw new Error("Missing environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    let body
    try {
      body = await req.json()
    } catch (e) {
      console.error("Error parsing JSON body:", e)
      return new Response(JSON.stringify({ ok: false, error: 'invalid_json_body', details: e.message }), { status: 400, headers: corsHeaders })
    }

    const restaurantUserId = String(body?.restaurantUserId || '')
    const orderPayload = body?.orderPayload
    const total = Number(orderPayload?.total || 0)
    const preferredMethod = String(body?.preferredMethod || orderPayload?.payment_method || '')

    console.log(`Processing request for user: ${restaurantUserId}, total: ${total}`)

    if (!restaurantUserId || !orderPayload || !Number.isFinite(total) || total <= 0) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_payload' }), { status: 400, headers: corsHeaders })
    }

    const { data: pix, error: pixErr } = await supabase
      .from('pix_settings')
      .select('enabled, bank, pix_key, merchant_name, merchant_city, client_id, endpoint_base, webhook_secret')
      .eq('user_id', restaurantUserId)
      .maybeSingle()

    if (pixErr) {
      console.error("Database error fetching settings:", pixErr)
      return new Response(JSON.stringify({ ok: false, error: 'db_error', details: pixErr }), { status: 500, headers: corsHeaders })
    }
    
    if (!pix) {
      console.error("No pix settings found for user")
      return new Response(JSON.stringify({ ok: false, error: 'pix_not_configured' }), { status: 400, headers: corsHeaders })
    }

    if (!pix.enabled) return new Response(JSON.stringify({ ok: false, error: 'pix_disabled' }), { status: 400, headers: corsHeaders })

    const correlationID = crypto.randomUUID()
    const value = Math.round(total * 100)
    const customerName = String(orderPayload?.customer_name || 'Cliente')
    const customerPhone = String(orderPayload?.customer_phone || '')
    
    // Fallback seguro para origin se header não existir
    const origin = req.headers.get('origin') || 'http://localhost:5173'

    const provider = String(pix.bank || 'mercadopago').toLowerCase()
    const webhookSecret = Deno.env.get('PIX_WEBHOOK_SECRET') || String(pix.webhook_secret || '')
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
      return new Response(JSON.stringify({ ok: false, error: 'db_insert_error', details: insertErr }), { status: 500, headers: corsHeaders })
    }

    if (provider === 'mercadopago') {
      const accessToken = String(pix.client_id || '')
      if (!accessToken) return new Response(JSON.stringify({ ok: false, error: 'missing_provider_credentials' }), { status: 400, headers: corsHeaders })

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
          return new Response(JSON.stringify({ ok: false, error: 'provider_error', details: mpJson }), { status: 502, headers: corsHeaders })
        }

        const brCode = mpJson?.point_of_interaction?.transaction_data?.qr_code || ''
        const qrBase64 = mpJson?.point_of_interaction?.transaction_data?.qr_code_base64 || ''
        const ticketUrl = mpJson?.point_of_interaction?.transaction_data?.ticket_url || ''
        const qrCodeImage = qrBase64 ? `data:image/png;base64,${qrBase64}` : ''

        return new Response(JSON.stringify({ ok: true, correlationID, brCode, qrCodeImage, paymentLinkUrl: ticketUrl, provider: 'mercadopago' }), { headers: corsHeaders })
      }

      // ... checkout preferences logic ...
      // Simplificado para focar no Pix
      return new Response(JSON.stringify({ ok: false, error: 'method_not_implemented_in_debug' }), { status: 400, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ ok: false, error: 'unsupported_provider' }), { status: 400, headers: corsHeaders })

  } catch (e: any) {
    console.error("Fatal error in edge function:", e)
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 500, headers: corsHeaders })
  }
})
