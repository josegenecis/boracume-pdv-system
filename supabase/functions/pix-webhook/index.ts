import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pix-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL') ??
      Deno.env.get('BORACUME_SUPABASE_URL') ??
      ''
    const serviceRole =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      Deno.env.get('BORACUME_SERVICE_ROLE_KEY') ??
      Deno.env.get('SERVICE_ROLE_KEY') ??
      ''
    const supabase = createClient(supabaseUrl, serviceRole)

    const url = new URL(req.url)
    const cidFromQuery = url.searchParams.get('cid') ?? ''
    const providedSecret =
      (req.headers.get('x-pix-secret') ?? '') ||
      (url.searchParams.get('secret') ?? '')

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const status = body?.status ?? body?.payment_status ?? body?.charge?.status ?? ''
    const orderId = body?.order_id ?? body?.metadata?.order_id ?? body?.orderId ?? ''
    const correlationID = body?.charge?.correlationID ?? body?.pix?.charge?.correlationID ?? ''

    const paymentIdFromQuery =
      url.searchParams.get('data.id') ||
      url.searchParams.get('id') ||
      ''

    const paymentIdFromBody =
      body?.data?.id ??
      body?.id ??
      ''

    const paymentId = String(paymentIdFromBody || paymentIdFromQuery || '')

    let checkoutPrefetched: any | null = null
    const prefetchCheckoutByCorrelation = async (cid: string) =>
      (await supabase
        .from('pix_checkouts')
        .select('id, restaurant_user_id, status, provider, order_payload, order_id, correlation_id')
        .eq('correlation_id', cid)
        .maybeSingle()).data

    const prefetchCheckoutByPaymentId = async (pid: string) =>
      (await supabase
        .from('pix_checkouts')
        .select('id, restaurant_user_id, status, provider, order_payload, order_id, correlation_id')
        .or(`transaction_id.eq.${pid},metadata->>payment_id.eq.${pid}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()).data

    if (!providedSecret) {
      if (!cidFromQuery && !paymentId) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const checkout = cidFromQuery
        ? await prefetchCheckoutByCorrelation(cidFromQuery)
        : await prefetchCheckoutByPaymentId(paymentId)
      if (!checkout) {
        return new Response(JSON.stringify({ ok: true, unknown: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (String(checkout.provider).toLowerCase() !== 'mercadopago') {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      checkoutPrefetched = checkout
    } else if (!cidFromQuery && paymentId) {
      const checkout = await prefetchCheckoutByPaymentId(paymentId)
      if (checkout && String(checkout.provider).toLowerCase() === 'mercadopago') {
        checkoutPrefetched = checkout
      }
    }

    let userIdFromSecret: string | null = null
    let secretValidated = false

    if (providedSecret) {
      // Try multi-tenant secret from DB first
      try {
        const { data: pix, error: pixErr } = await supabase
          .from('pix_settings')
          .select('user_id, webhook_secret')
          .eq('webhook_secret', providedSecret)
          .maybeSingle()
        if (!pixErr && pix) {
          userIdFromSecret = pix.user_id as string
          secretValidated = true
        }
      } catch (_) {
        // Table may not exist yet; ignore and fallback to env secret
      }

      if (!secretValidated) {
        const expectedSecret = Deno.env.get('PIX_WEBHOOK_SECRET') ?? ''
        if (!expectedSecret || providedSecret !== expectedSecret) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        secretValidated = true
      }
    }

    const effectiveCid = String(cidFromQuery || checkoutPrefetched?.correlation_id || '')
    console.log(`[PixWebhook] Received request. CID: ${effectiveCid}, Secret provided: ${!!providedSecret}`);

    if (!effectiveCid && paymentId) {
      return new Response(JSON.stringify({ ok: true, unknown: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ... (rest of the code)

    if (effectiveCid) {
      console.log(`[PixWebhook] Processing correlation ID: ${effectiveCid}`);
      const checkout = checkoutPrefetched
        ? checkoutPrefetched
        : (await supabase
            .from('pix_checkouts')
            .select('id, restaurant_user_id, status, provider, order_payload, order_id')
            .eq('correlation_id', effectiveCid)
            .maybeSingle()).data

      if (!checkout) {
        console.error(`[PixWebhook] Checkout not found for CID: ${cid}`);
        return new Response(JSON.stringify({ ok: true, unknown: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      console.log(`[PixWebhook] Checkout found. Status: ${checkout.status}, Provider: ${checkout.provider}`);

      if (checkout.status === 'PAID' && checkout.order_id) {
        console.log(`[PixWebhook] Checkout already PAID. Order ID: ${checkout.order_id}`);
        return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (String(checkout.provider).toLowerCase() === 'mercadopago') {
        console.log(`[PixWebhook] MP Payment ID: ${paymentId}`);
        
        if (!paymentId) {
           // Se for apenas teste de validação do MP
           if (body?.action === 'test.created') {
               console.log('[PixWebhook] MP Test Notification received.');
               return new Response(JSON.stringify({ ok: true }), { status: 200 });
           }
           console.log('[PixWebhook] No payment ID found in body');
           return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // ... busca credenciais ...
        const { data: mp, error: mpErr } = await supabase
          .from('pix_settings')
          .select('enabled, bank, client_id, mp_access_token, mp_refresh_token, mp_expires_at')
          .eq('user_id', checkout.restaurant_user_id)
          .maybeSingle()
        
        if (!mp || !(mp.mp_access_token || mp.client_id)) {
            console.error(`[PixWebhook] MP settings not found for user ${checkout.restaurant_user_id}`);
            return new Response(JSON.stringify({ error: 'config_missing' }), { status: 200 });
        }

        const getEnv = (...keys: string[]) => {
          for (const key of keys) {
            const value = Deno.env.get(key)
            if (value) return value
          }
          return ''
        }

        const mpClientId = getEnv('MP_PLATFORM_CLIENT_ID')
        const mpClientSecret = getEnv('MP_PLATFORM_CLIENT_SECRET')

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
            .eq('user_id', checkout.restaurant_user_id)
          ;(mp as any).mp_access_token = nextToken
          ;(mp as any).client_id = nextToken
          ;(mp as any).mp_refresh_token = nextRefresh
          ;(mp as any).mp_expires_at = expiresAt
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
        
        console.log(`[PixWebhook] Fetching payment status from MP API...`);
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

        const externalRef = String(paymentJson?.external_reference || '')
        if (effectiveCid && externalRef && externalRef !== String(effectiveCid)) {
          console.error('[PixWebhook] external_reference mismatch', { cid: effectiveCid, externalRef })
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        
        if (!paymentResp.ok) {
          console.error(`[PixWebhook] MP API Error:`, paymentJson);
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const mpStatus = String(paymentJson?.status || '').toLowerCase()
        const mpDetail = String(paymentJson?.status_detail || '').toLowerCase()
        console.log(`[PixWebhook] Payment Status: ${mpStatus}`);
        
        const isApproved = mpStatus === 'approved' && (Boolean(paymentJson?.date_approved) || mpDetail === 'accredited')
        if (!isApproved) {
          await supabase
            .from('pix_checkouts')
            .update({ status: String(mpStatus || 'PENDING').toUpperCase(), updated_at: new Date().toISOString() })
            .eq('id', checkout.id)
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // CREATE ORDER
        console.log(`[PixWebhook] Creating Order...`);
        const payload = checkout.order_payload || {}
        // ... (rest of order creation)
        const orderNumber = payload?.order_number || `MP-${effectiveCid.slice(0, 8)}`
        const insertData: any = {
          user_id: checkout.restaurant_user_id,
          order_number: orderNumber,
          customer_name: payload?.customer_name || 'Cliente', // Fallback
          customer_phone: payload?.customer_phone || null,
          customer_address: payload?.customer_address || null,
          customer_neighborhood: payload?.customer_neighborhood || null,
          delivery_zone_id: payload?.delivery_zone_id || null,
          items: payload?.items || [],
          total: payload?.total || 0,
          delivery_fee: payload?.delivery_fee || 0,
          payment_method: 'pix', // Force PIX
          status: 'pending', // Status inicial para o painel
          acceptance_status: 'pending_acceptance',
          change_amount: payload?.change_amount ?? null,
          order_type: payload?.order_type || 'delivery',
          delivery_instructions: payload?.delivery_instructions || null,
          // ...
        }

        const { data: created, error: createErr } = await supabase
          .from('orders')
          .insert(insertData)
          .select('id')
          .single()

        if (createErr) {
            console.error(`[PixWebhook] Order Creation Error:`, createErr);
            return new Response(JSON.stringify({ error: 'order_create_failed' }), { status: 500 });
        }

        console.log(`[PixWebhook] Order Created: ${created.id}`);
        
        // ... update checkout ...
        await supabase
          .from('pix_checkouts')
          .update({ status: 'PAID', order_id: created.id, updated_at: new Date().toISOString() })
          .eq('id', checkout.id)

        return new Response(JSON.stringify({ ok: true, orderId: created.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const normalized = String(status).toUpperCase()
    const isPaid =
      normalized === 'PAID' ||
      normalized === 'APPROVED' ||
      normalized === 'PAID_OUT' ||
      normalized === 'CONCLUDED' ||
      normalized === 'COMPLETED'

    if (!isPaid) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (correlationID) {
      const { data: checkout, error: chkErr } = await supabase
        .from('pix_checkouts')
        .select('id, restaurant_user_id, status, order_payload, order_id')
        .eq('correlation_id', correlationID)
        .maybeSingle()
      if (chkErr || !checkout) {
        return new Response(JSON.stringify({ ok: true, unknown: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (checkout.status === 'PAID' && checkout.order_id) {
        return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const payload = checkout.order_payload || {}
      const orderNumber = payload?.order_number || `PIX-${correlationID.slice(0, 8)}`

      const insertData: any = {
        user_id: checkout.restaurant_user_id,
        order_number: orderNumber,
        customer_name: payload?.customer_name || null,
        customer_phone: payload?.customer_phone || null,
        customer_address: payload?.customer_address || null,
        customer_neighborhood: payload?.customer_neighborhood || null,
        delivery_zone_id: payload?.delivery_zone_id || null,
        items: payload?.items || [],
        total: payload?.total || 0,
        delivery_fee: payload?.delivery_fee || null,
        payment_method: payload?.payment_method || 'pix',
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

      if (createErr || !created?.id) {
        return new Response(JSON.stringify({ error: 'order_create_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      await supabase
        .from('pix_checkouts')
        .update({ status: 'PAID', order_id: created.id, updated_at: new Date().toISOString() })
        .eq('id', checkout.id)

      return new Response(JSON.stringify({ ok: true, orderId: created.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'missing_order_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: order, error: getError } = await supabase
      .from('orders')
      .select('id, acceptance_status, user_id')
      .eq('id', orderId)
      .maybeSingle()

    if (getError) {
      return new Response(JSON.stringify({ error: 'order_lookup_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!order) {
      return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (userIdFromSecret && order.user_id !== userIdFromSecret) {
      return new Response(JSON.stringify({ error: 'order_mismatch' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (order.acceptance_status === 'pending_acceptance' || order.acceptance_status === 'accepted') {
      return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ acceptance_status: 'pending_acceptance' })
      .eq('id', orderId)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'update_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
