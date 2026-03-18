// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

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
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: 'missing_env' }), { status: 200, headers: corsHeaders })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({}))
    const correlationID = String(body?.correlationID || '')
    if (!correlationID) return new Response(JSON.stringify({ ok: false, error: 'missing_correlationID' }), { status: 200, headers: corsHeaders })

    console.log('[PixCheckoutStatus] Request', { correlationID })

    const { data, error } = await supabase
      .from('pix_checkouts')
      .select('id,status,order_id,provider,restaurant_user_id,transaction_id,metadata,order_payload')
      .eq('correlation_id', correlationID)
      .maybeSingle()

    if (error || !data) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 200, headers: corsHeaders })

    const normalized = String(data.status || '').toUpperCase()
    const existingOrderId = data.order_id || null
    return new Response(JSON.stringify({ ok: true, status: normalized, orderId: existingOrderId }), { status: 200, headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 200, headers: corsHeaders })
  }
}
