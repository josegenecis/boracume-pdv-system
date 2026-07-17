// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const config = { runtime: 'edge' }

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(url, serviceKey)

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  const { searchParams } = new URL(req.url)
  let userId = searchParams.get('userId')
  if (!userId && req.method === 'POST') {
    try {
      const body = await req.json()
      userId = body.userId
    } catch {}
  }
  if (!userId) return new Response(JSON.stringify({ ok: false, error: 'missing_userId' }), { status: 400, headers })

  try {
    const { data, error } = await supabase
      .from('pix_settings')
      .select('enabled, bank, pix_key, merchant_name, merchant_city')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) return new Response(JSON.stringify({ ok: false, error: 'query_failed' }), { status: 500, headers })
    if (!data) return new Response(JSON.stringify({ ok: true, settings: null, onlineCheckoutAvailable: false }), { headers })

    const providerKey = String(data.bank || 'mercadopago')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    const isMercadoPago = !providerKey || providerKey === 'mp' || providerKey.includes('mercadopago')
    const { data: popPayConnection } = await supabase
      .from('poppay_connections')
      .select('status,enabled')
      .eq('user_id', userId)
      .maybeSingle()
    const hasOnlineCredentials = popPayConnection?.status === 'connected' && popPayConnection?.enabled === true
    const publicSettings = {
      enabled: Boolean(data.enabled),
      bank: data.bank || 'mercadopago',
      pix_key: data.pix_key || null,
      merchant_name: data.merchant_name || null,
      merchant_city: data.merchant_city || null,
    }

    return new Response(JSON.stringify({
      ok: true,
      settings: publicSettings,
      onlineCheckoutAvailable: Boolean(data.enabled) && isMercadoPago && hasOnlineCredentials,
    }), { headers })
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error' }), { status: 500, headers })
  }
}
