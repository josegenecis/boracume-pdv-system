// deno-lint-ignore-file no-explicit-any
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

const getAuthUserId = async (req: Request): Promise<string> => {
  const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY', 'BORACUME_SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('authorization') || ''
  if (!supabaseUrl || !anonKey || !authHeader) return ''

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data, error } = await authClient.auth.getUser()
  if (error) return ''
  return data?.user?.id || ''
}

const randomSecret = () => {
  try {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    const clientID = getEnv('MP_PLATFORM_CLIENT_ID')
    const clientSecret = getEnv('MP_PLATFORM_CLIENT_SECRET')
    const redirectUri = getEnv('MP_REDIRECT_URI')

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'missing_env', message: 'Faltam variáveis de ambiente SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY' }), { status: 500, headers: corsHeaders })
    }

    if (!clientID || !clientSecret || !redirectUri) {
      return new Response(JSON.stringify({ error: 'misconfigured_server', message: 'Faltam variáveis de ambiente MP_PLATFORM_CLIENT_ID/SECRET/REDIRECT_URI' }), { status: 500, headers: corsHeaders })
    }

    const userId = await getAuthUserId(req)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { code, state } = await req.json()

    if (!code || !state) {
      return new Response(JSON.stringify({ error: 'missing_params', message: 'Code e state são obrigatórios' }), { status: 400, headers: corsHeaders })
    }

    const { data: st, error: stErr } = await supabase
      .from('mp_oauth_states')
      .select('id,user_id,created_at,used_at')
      .eq('state', String(state))
      .maybeSingle()

    if (stErr || !st) {
      return new Response(JSON.stringify({ error: 'invalid_state' }), { status: 400, headers: corsHeaders })
    }
    if (String(st.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: 'invalid_state' }), { status: 400, headers: corsHeaders })
    }
    if (st.used_at) {
      return new Response(JSON.stringify({ error: 'state_already_used' }), { status: 400, headers: corsHeaders })
    }
    const createdAt = new Date(String(st.created_at || ''))
    if (!Number.isFinite(createdAt.getTime()) || Date.now() - createdAt.getTime() > 30 * 60 * 1000) {
      return new Response(JSON.stringify({ error: 'state_expired' }), { status: 400, headers: corsHeaders })
    }

    // 1. Trocar o CODE pelo ACCESS_TOKEN
    const tokenResp = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_secret: clientSecret,
        client_id: clientID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    const tokenData = await tokenResp.json()

    if (!tokenResp.ok) {
      console.error('Erro MP OAuth:', tokenData)
      return new Response(JSON.stringify({ error: 'mp_oauth_error', details: tokenData }), { status: 400, headers: corsHeaders })
    }

    // 2. Salvar as credenciais no banco do restaurante
    const { access_token, refresh_token, public_key, user_id: mp_user_id, token_type, scope, expires_in } = tokenData
    const expiresAt = expires_in ? new Date(Date.now() + Number(expires_in) * 1000).toISOString() : null

    const { data: existing } = await supabase
      .from('pix_settings')
      .select('webhook_secret')
      .eq('user_id', userId)
      .maybeSingle()

    const webhookSecret = String(existing?.webhook_secret || '') || randomSecret()

    const { error: upsertError } = await supabase
      .from('pix_settings')
      .upsert({
        user_id: userId,
        enabled: true,
        bank: 'mercadopago',
        client_id: access_token,
        pix_key: public_key,
        mp_access_token: access_token,
        mp_refresh_token: refresh_token || null,
        mp_public_key: public_key || null,
        mp_user_id: mp_user_id ? String(mp_user_id) : null,
        mp_token_type: token_type || null,
        mp_scope: scope || null,
        mp_expires_at: expiresAt,
        webhook_secret: webhookSecret,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      throw upsertError
    }

    await supabase
      .from('mp_oauth_states')
      .update({ used_at: new Date().toISOString() })
      .eq('id', st.id)

    return new Response(JSON.stringify({ ok: true, message: 'Conectado com sucesso' }), { headers: corsHeaders })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
