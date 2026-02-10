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
    const body = await req.json().catch(() => ({}))
    const correlationID = String(body?.correlationID || '')
    if (!correlationID) return new Response(JSON.stringify({ ok: false, error: 'missing_correlationID' }), { status: 200, headers: corsHeaders })

    const { data, error } = await supabase
      .from('pix_checkouts')
      .select('status, order_id')
      .eq('correlation_id', correlationID)
      .maybeSingle()

    if (error || !data) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 200, headers: corsHeaders })
    return new Response(JSON.stringify({ ok: true, status: data.status, orderId: data.order_id || null }), { status: 200, headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 200, headers: corsHeaders })
  }
}
