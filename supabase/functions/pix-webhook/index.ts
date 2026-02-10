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
    const cid = url.searchParams.get('cid') ?? ''
    const providedSecret =
      (req.headers.get('x-pix-secret') ?? '') ||
      (req.headers.get('authorization') ?? '') ||
      (url.searchParams.get('secret') ?? '')
  if (!providedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

    let userIdFromSecret: string | null = null
    let secretValidated = false

    // Try multi-tenant secret from DB first
    try {
      const { data: pix, error: pixErr } = await supabase
        .from('pix_settings')
        .select('user_id, webhook_secret, enabled')
        .eq('webhook_secret', providedSecret)
        .eq('enabled', true)
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

    const body = await req.json()
    const status = body?.status ?? body?.payment_status ?? body?.charge?.status ?? ''
    const orderId = body?.order_id ?? body?.metadata?.order_id ?? body?.orderId ?? ''
    const correlationID = body?.charge?.correlationID ?? body?.pix?.charge?.correlationID ?? ''

    if (cid) {
      const { data: checkout, error: chkErr } = await supabase
        .from('pix_checkouts')
        .select('id, restaurant_user_id, status, provider, order_payload, order_id')
        .eq('correlation_id', cid)
        .maybeSingle()

      if (chkErr || !checkout) {
        return new Response(JSON.stringify({ ok: true, unknown: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (checkout.status === 'PAID' && checkout.order_id) {
        return new Response(JSON.stringify({ ok: true, idempotent: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (String(checkout.provider).toLowerCase() === 'mercadopago') {
        const paymentId = body?.data?.id ?? body?.id ?? ''
        if (!paymentId) {
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { data: mp, error: mpErr } = await supabase
          .from('pix_settings')
          .select('enabled, bank, client_id')
          .eq('user_id', checkout.restaurant_user_id)
          .maybeSingle()

        if (mpErr || !mp || !mp.enabled) {
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const accessToken = String(mp.client_id || '')
        if (!accessToken) {
          return new Response(JSON.stringify({ error: 'missing_provider_credentials' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        const paymentJson: any = await paymentResp.json().catch(() => ({}))
        if (!paymentResp.ok) {
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const mpStatus = String(paymentJson?.status || '').toLowerCase()
        const isApproved = mpStatus === 'approved'
        if (!isApproved) {
          await supabase
            .from('pix_checkouts')
            .update({ status: String(mpStatus || 'PENDING').toUpperCase(), updated_at: new Date().toISOString() })
            .eq('id', checkout.id)
          return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const payload = checkout.order_payload || {}
        const orderNumber = payload?.order_number || `MP-${cid.slice(0, 8)}`
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
