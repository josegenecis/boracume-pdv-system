// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnv } from '../_shared/poppay.ts'
import { resolveStoreUserId } from '../_shared/multi-store.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const getAuthUserId = async (req: Request) => {
  const url = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const anon = getEnv('SUPABASE_ANON_KEY', 'BORACUME_SUPABASE_ANON_KEY')
  const authorization = req.headers.get('authorization') || ''
  if (!url || !anon || !authorization) return ''
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser()
  return error ? '' : String(data?.user?.id || '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    const authenticatedUserId = await getAuthUserId(req)
    if (!url || !serviceKey || !authenticatedUserId) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: corsHeaders })
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'status')
    const supabase = createClient(url, serviceKey)
    const userId = await resolveStoreUserId(supabase, authenticatedUserId, body?._storeId)

    if (action === 'set_split_enabled') {
      return new Response(JSON.stringify({ ok: false, error: 'operation_not_allowed' }), { status: 403, headers: corsHeaders })
    } else if (action === 'disconnect') {
      await supabase
        .from('poppay_connections')
        .update({ enabled: false, split_enabled: false, status: 'disabled', disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    }

    const { data } = await supabase
      .from('poppay_connections')
      .select('status,enabled,mp_user_id,expires_at,connected_at,last_error')
      .eq('user_id', userId)
      .maybeSingle()
    return new Response(JSON.stringify({
      ok: true,
      configured: Boolean(getEnv('POPPAY_CLIENT_ID') && getEnv('POPPAY_CLIENT_SECRET') && getEnv('POPPAY_REDIRECT_URI')),
      connection: data || null,
    }), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
