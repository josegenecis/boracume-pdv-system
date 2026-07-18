// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnv } from '../_shared/poppay.ts'

const POPPAY_TERMS_VERSION = '2026-07-v1'
const POPPAY_TERMS_SNAPSHOT = {
  document: '/termos#poppay',
  privacy: '/privacidade',
  marketplace_fee_bps: 100,
  statements: [
    'Autoriza o PopSystem/PopPay a conectar a conta Mercado Pago e operar pagamentos, consultas e devolucoes solicitadas no sistema.',
    'A comissao PopPay de 1% e descontada do valor recebido pelo restaurante e nao e adicionada ao valor pago pelo consumidor.',
    'As tarifas do Mercado Pago continuam aplicaveis conforme o contrato do titular da conta.',
    'A autorizacao pode ser revogada, observadas as operacoes ja iniciadas e as obrigacoes legais de guarda.',
  ],
}

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

const base64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const createPkce = async () => {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = base64Url(verifierBytes)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64Url(new Uint8Array(digest)) }
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

    const body = await req.json().catch(() => ({}))
    if (body?.acceptedTerms !== true || body?.termsVersion !== POPPAY_TERMS_VERSION) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'terms_acceptance_required',
        message: 'Leia e aceite os termos atuais do PopPay para continuar.',
        termsVersion: POPPAY_TERMS_VERSION,
      }), { status: 412, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { error: acceptanceError } = await supabase.from('poppay_terms_acceptances').insert({
      user_id: userId,
      terms_version: POPPAY_TERMS_VERSION,
      source: 'poppay_oauth',
      user_agent: req.headers.get('user-agent')?.slice(0, 500) || null,
      terms_snapshot: POPPAY_TERMS_SNAPSHOT,
    })
    if (acceptanceError) throw acceptanceError

    const state = crypto.randomUUID()
    const { verifier, challenge } = await createPkce()
    const { error } = await supabase.from('poppay_oauth_states').insert({
      user_id: userId,
      state,
      code_verifier: verifier,
    })
    if (error) throw error

    const url =
      `https://auth.mercadopago.com/authorization?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(challenge)}` +
      `&code_challenge_method=S256`

    return new Response(JSON.stringify({ ok: true, url }), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
