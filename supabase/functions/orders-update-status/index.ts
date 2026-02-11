// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const config = { runtime: 'edge' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

const ok = (payload: any) =>
  new Response(JSON.stringify(payload), { status: 200, headers: corsHeaders })

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceKey) return ok({ ok: false, error: 'missing_env' })

    const userId = await getAuthUserId(req)
    if (!userId) return ok({ ok: false, error: 'unauthorized' })

    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.orderId || '')
    const newStatus = String(body?.newStatus || '')

    const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled']
    if (!orderId || !validStatuses.includes(newStatus)) {
      return ok({ ok: false, error: 'invalid_payload' })
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, status, acceptance_status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr) return ok({ ok: false, error: 'db_error', details: orderErr })
    if (!order) return ok({ ok: false, error: 'not_found' })

    if (String(order.user_id) !== userId) {
      return ok({ ok: false, error: 'forbidden' })
    }

    const updateData =
      newStatus === 'preparing'
        ? { status: newStatus, acceptance_status: 'accepted' }
        : newStatus === 'cancelled'
          ? { status: newStatus, acceptance_status: 'rejected' }
          : { status: newStatus }

    const { data: updated, error: updateErr } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select('*')
      .single()

    if (updateErr) return ok({ ok: false, error: 'db_error', details: updateErr })

    return ok({ ok: true, order: updated })
  } catch (e: any) {
    return ok({ ok: false, error: 'internal_error', message: String(e?.message || e) })
  }
})

