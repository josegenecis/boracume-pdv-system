// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ ok: false, error: 'missing_env' }), { status: 500, headers: corsHeaders })

    const supabase = createClient(supabaseUrl, serviceKey)
    let body: any = {}
    try { body = await req.json() } catch { body = {} }
    const code = String(body?.pairingCode || '').trim()
    if (!code) return new Response(JSON.stringify({ ok: false, error: 'missing_code' }), { status: 400, headers: corsHeaders })

    const { data: pairing, error: pairingErr } = await supabase
      .from('print_agent_pairings')
      .select('id, token_plain, claimed_at, delivered_at, expires_at')
      .eq('pairing_code', code)
      .maybeSingle()

    if (pairingErr) return new Response(JSON.stringify({ ok: false, error: 'db_error', details: pairingErr }), { status: 500, headers: corsHeaders })
    if (!pairing) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404, headers: corsHeaders })
    if (new Date(pairing.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ ok: false, status: 'expired' }), { status: 200, headers: corsHeaders })

    if (!pairing.claimed_at) return new Response(JSON.stringify({ ok: true, status: 'waiting' }), { status: 200, headers: corsHeaders })
    if (pairing.delivered_at) return new Response(JSON.stringify({ ok: true, status: 'delivered' }), { status: 200, headers: corsHeaders })
    if (!pairing.token_plain) return new Response(JSON.stringify({ ok: true, status: 'waiting' }), { status: 200, headers: corsHeaders })

    const now = new Date().toISOString()
    await supabase
      .from('print_agent_pairings')
      .update({ delivered_at: now, token_plain: null })
      .eq('id', pairing.id)

    return new Response(JSON.stringify({ ok: true, status: 'ready', token: pairing.token_plain }), { status: 200, headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 500, headers: corsHeaders })
  }
})

