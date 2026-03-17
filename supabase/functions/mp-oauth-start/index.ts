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

const randomState = () => {
  try {
    return crypto.randomUUID()
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
    const clientId = getEnv('MP_PLATFORM_CLIENT_ID')
    const redirectUri = getEnv('MP_REDIRECT_URI')

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'missing_env', message: 'Faltam SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY' }), { status: 500, headers: corsHeaders })
    }
    if (!clientId || !redirectUri) {
      return new Response(JSON.stringify({ error: 'misconfigured_server', message: 'Faltam MP_PLATFORM_CLIENT_ID/MP_REDIRECT_URI' }), { status: 500, headers: corsHeaders })
    }

    const userId = await getAuthUserId(req)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const state = randomState()
    const { error: insErr } = await supabaseAdmin.from('mp_oauth_states').insert({
      user_id: userId,
      state,
    })
    if (insErr) {
      return new Response(JSON.stringify({ error: 'db_error', details: insErr }), { status: 500, headers: corsHeaders })
    }

    const scope = 'offline_access read write'
    const url =
      `https://auth.mercadopago.com.br/authorization?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`

    return new Response(JSON.stringify({ ok: true, url, state }), { headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal_error' }), { status: 500, headers: corsHeaders })
  }
})

