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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const providedSecret = req.headers.get('x-pix-secret') ?? ''
    const expectedSecret = Deno.env.get('PIX_WEBHOOK_SECRET') ?? ''
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const status = body?.status ?? body?.payment_status ?? ''
    const orderId = body?.order_id ?? body?.metadata?.order_id ?? body?.orderId ?? ''
    if (!orderId) {
      return new Response(JSON.stringify({ error: 'missing_order_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: order, error: getError } = await supabase
      .from('orders')
      .select('id, acceptance_status')
      .eq('id', orderId)
      .maybeSingle()

    if (getError) {
      return new Response(JSON.stringify({ error: 'order_lookup_failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!order) {
      return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const normalized = String(status).toLowerCase()
    const isPaid = normalized === 'paid' || normalized === 'approved' || normalized === 'paid_out' || normalized === 'concluded'

    if (!isPaid) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

