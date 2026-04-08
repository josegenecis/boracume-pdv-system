import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { previewLoyaltyForCustomer } from '../_shared/loyalty.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '')
    const customerPhone = String(body?.customerPhone || '')
    const cartTotal = Number(body?.cartTotal || 0)
    const deliveryFee = Number(body?.deliveryFee || 0)

    if (!userId || !customerPhone) {
      return new Response(JSON.stringify({ ok: false, message: 'Dados incompletos' }), { status: 400, headers: corsHeaders })
    }

    const result = await previewLoyaltyForCustomer(supabase, { userId, customerPhone, cartTotal, deliveryFee })
    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
