import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { markLoyaltyRewardUsedForOrder } from '../_shared/loyalty.ts'

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
    const rewardId = String(body?.rewardId || '')
    const orderId = String(body?.orderId || '')
    const userId = String(body?.userId || '')

    if (!rewardId || !orderId || !userId) {
      return new Response(JSON.stringify({ ok: false, message: 'Dados incompletos' }), { status: 400, headers: corsHeaders })
    }

    const result = await markLoyaltyRewardUsedForOrder(supabase, { rewardId, orderId, userId })
    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
