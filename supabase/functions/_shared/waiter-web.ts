import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

export const ok = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders })

export const fail = (message: string, status = 400) =>
  ok({ error: message }, status)

export const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

export const normalizeCpf = (value: string) => String(value || '').replace(/\D/g, '')

export const createServiceClient = () => {
  const url = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('Ambiente do Supabase não configurado para o app do garçom.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export const hashToken = async (value: string) => {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((chunk) => chunk.toString(16).padStart(2, '0'))
    .join('')
}

export const buildSessionToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')

export async function getWaiterSession(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!rawToken) {
    throw new Error('Sessão do garçom não informada.')
  }

  const supabase = createServiceClient()
  const tokenHash = await hashToken(rawToken)
  const { data, error } = await supabase
    .from('waiter_web_sessions')
    .select('id, waiter_id, restaurant_id, expires_at, waiters(id, name, role, permissions, cpf, active)')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) {
    throw new Error('Sessão do garçom inválida.')
  }

  if (!data.waiters || !(data.waiters as any).active) {
    await supabase.from('waiter_web_sessions').delete().eq('id', data.id)
    throw new Error('Garçom inativo.')
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from('waiter_web_sessions').delete().eq('id', data.id)
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  await supabase
    .from('waiter_web_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)

  return {
    rawToken,
    sessionId: data.id,
    profile: {
      id: (data.waiters as any).id,
      restaurantId: data.restaurant_id,
      name: (data.waiters as any).name,
      cpf: (data.waiters as any).cpf || '',
      role: (data.waiters as any).role || 'cashier',
      permissions: ((data.waiters as any).permissions as Record<string, boolean>) || {},
    },
    expiresAt: data.expires_at,
    supabase,
  }
}
