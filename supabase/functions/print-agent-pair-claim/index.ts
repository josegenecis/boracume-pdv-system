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

const sha256Hex = async (input: string) => {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ ok: false, error: 'missing_env' }), { status: 500, headers: corsHeaders })

    const authHeader = req.headers.get('Authorization') || ''
    const supabaseAuth = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } })
    const { data: authData } = await supabaseAuth.auth.getUser()
    const userId = authData?.user?.id
    if (!userId) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: corsHeaders })

    const supabase = createClient(supabaseUrl, serviceKey)

    let body: any = {}
    try { body = await req.json() } catch { body = {} }
    const code = String(body?.pairingCode || '').trim()
    const name = body?.name ? String(body.name).slice(0, 120) : null
    if (!code) return new Response(JSON.stringify({ ok: false, error: 'missing_code' }), { status: 400, headers: corsHeaders })

    const { data: pairing, error: pairingErr } = await supabase
      .from('print_agent_pairings')
      .select('id, pairing_code, claimed_at, delivered_at, expires_at')
      .eq('pairing_code', code)
      .maybeSingle()

    if (pairingErr) return new Response(JSON.stringify({ ok: false, error: 'db_error', details: pairingErr }), { status: 500, headers: corsHeaders })
    if (!pairing) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404, headers: corsHeaders })
    if (pairing.claimed_at) return new Response(JSON.stringify({ ok: false, error: 'already_claimed' }), { status: 409, headers: corsHeaders })
    if (new Date(pairing.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ ok: false, error: 'expired' }), { status: 410, headers: corsHeaders })

    const token = randomToken()
    const tokenHash = await sha256Hex(token)

    const { error: tokErr } = await supabase
      .from('print_agent_tokens')
      .insert({ restaurant_user_id: userId, name, token_hash: tokenHash, revoked: false })

    if (tokErr) return new Response(JSON.stringify({ ok: false, error: 'db_error', details: tokErr }), { status: 500, headers: corsHeaders })

    const now = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('print_agent_pairings')
      .update({ restaurant_user_id: userId, token_plain: token, claimed_at: now })
      .eq('id', pairing.id)

    if (updErr) return new Response(JSON.stringify({ ok: false, error: 'db_error', details: updErr }), { status: 500, headers: corsHeaders })

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 500, headers: corsHeaders })
  }
})

