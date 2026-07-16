// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnv } from '../_shared/poppay.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const getAuthUserId = async (req: Request) => {
  const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY', 'BORACUME_SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('authorization') || ''
  if (!supabaseUrl || !anonKey || !authHeader) return ''
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data, error } = await authClient.auth.getUser()
  return error ? '' : String(data?.user?.id || '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    const clientId = getEnv('POPPAY_CLIENT_ID')
    const clientSecret = getEnv('POPPAY_CLIENT_SECRET')
    const redirectUri = getEnv('POPPAY_REDIRECT_URI')
    if (!supabaseUrl || !serviceKey || !clientId || !clientSecret || !redirectUri) {
      return new Response(JSON.stringify({ ok: false, error: 'poppay_not_configured' }), { status: 503, headers: corsHeaders })
    }

    const userId = await getAuthUserId(req)
    if (!userId) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    const { code, state } = await req.json().catch(() => ({}))
    if (!code || !state) return new Response(JSON.stringify({ ok: false, error: 'missing_params' }), { status: 400, headers: corsHeaders })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: oauthState, error: stateError } = await supabase
      .from('poppay_oauth_states')
      .select('id,user_id,created_at,used_at')
      .eq('state', String(state))
      .maybeSingle()
    if (stateError || !oauthState || String(oauthState.user_id) !== userId || oauthState.used_at) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_state' }), { status: 400, headers: corsHeaders })
    }
    const createdAt = new Date(String(oauthState.created_at || '')).getTime()
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 30 * 60 * 1000) {
      return new Response(JSON.stringify({ ok: false, error: 'state_expired' }), { status: 400, headers: corsHeaders })
    }

    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
      }),
    })
    const token: any = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !token?.access_token) {
      return new Response(JSON.stringify({ ok: false, error: 'mp_oauth_error', details: token }), { status: 400, headers: corsHeaders })
    }

    const expiresIn = Number(token?.expires_in || 0)
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
    const { data: existing } = await supabase
      .from('poppay_connections')
      .select('split_enabled,fee_bps')
      .eq('user_id', userId)
      .maybeSingle()

    const { error: upsertError } = await supabase
      .from('poppay_connections')
      .upsert({
        user_id: userId,
        status: 'connected',
        enabled: true,
        split_enabled: Boolean(existing?.split_enabled),
        fee_bps: Number(existing?.fee_bps || 100),
        mp_user_id: token?.user_id ? String(token.user_id) : null,
        access_token: String(token.access_token),
        refresh_token: token?.refresh_token ? String(token.refresh_token) : null,
        public_key: token?.public_key ? String(token.public_key) : null,
        token_type: token?.token_type ? String(token.token_type) : null,
        scope: token?.scope ? String(token.scope) : null,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        disabled_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    if (upsertError) throw upsertError

    await supabase.from('poppay_oauth_states').update({ used_at: new Date().toISOString() }).eq('id', oauthState.id)
    return new Response(JSON.stringify({ ok: true, connected: true, splitEnabled: Boolean(existing?.split_enabled) }), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
