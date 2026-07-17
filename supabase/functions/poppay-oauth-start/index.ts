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
    const redirectUri = getEnv('POPPAY_REDIRECT_URI')
    if (!supabaseUrl || !serviceKey || !clientId || !redirectUri) {
      return new Response(JSON.stringify({ ok: false, error: 'poppay_not_configured', message: 'O PopPay ainda nao possui credenciais de producao configuradas.' }), { status: 503, headers: corsHeaders })
    }

    const userId = await getAuthUserId(req)
    if (!userId) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: corsHeaders })

    const supabase = createClient(supabaseUrl, serviceKey)
    const state = crypto.randomUUID()
    const { error } = await supabase.from('poppay_oauth_states').insert({ user_id: userId, state })
    if (error) throw error

    const url =
      `https://auth.mercadopago.com/authorization?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`

    return new Response(JSON.stringify({ ok: true, url }), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
