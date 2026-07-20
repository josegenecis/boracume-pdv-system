import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

export const ok = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: corsHeaders })
export const fail = (message: string, status = 400) => ok({ error: message }, status)

const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

export const createServiceClient = () => {
  const url = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Ambiente do Supabase não configurado para o app motoboy.')
  return createClient(url, key, { auth: { persistSession: false } })
}

export const hashToken = async (value: string) => {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, '0')).join('')
}

export const buildSessionToken = () => `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')

export async function getDriverSession(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('Sessão do motoboy não informada.')
  const supabase = createServiceClient()
  const tokenHash = await hashToken(token)
  const { data, error } = await supabase
    .from('delivery_driver_sessions')
    .select('id,delivery_personnel_id,restaurant_id,expires_at,driver:delivery_personnel(id,name,phone,vehicle_type,vehicle_plate,status,app_enabled)')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error || !data) throw new Error('Sessão do motoboy inválida.')
  const driver = Array.isArray(data.driver) ? data.driver[0] : data.driver
  if (!driver?.app_enabled) throw new Error('Acesso do motoboy está desativado.')
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from('delivery_driver_sessions').delete().eq('id', data.id)
    throw new Error('Sessão expirada. Entre novamente.')
  }
  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('delivery_driver_sessions').update({ last_seen_at: now }).eq('id', data.id),
    supabase.from('delivery_personnel').update({ last_seen_at: now }).eq('id', data.delivery_personnel_id),
  ])
  return { token, sessionId: data.id, driver, restaurantId: data.restaurant_id, expiresAt: data.expires_at, supabase }
}

