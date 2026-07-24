// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnv } from '../_shared/poppay.ts'
import { resolveStoreUserId } from '../_shared/multi-store.ts'

const POPPAY_TERMS_VERSION = '2026-07-v3'
const creditTermsSnapshot = (feeBps: number) => ({
  document: '/termos#poppay',
  privacy: '/privacidade',
  product: 'credit_card_online',
  installments: 1,
  marketplace_fee_bps: feeBps,
  statements: [
    'O credito online e opcional e pode ser ativado ou desativado pelo restaurante.',
    'Sao aceitos somente pagamentos de credito a vista; parcelamento nao e oferecido.',
    `A tarifa operacional PopPay vigente e de ${(feeBps / 100).toFixed(2)}% por transacao aprovada, alem da tarifa de processamento do Mercado Pago aplicavel a conta conectada.`,
    'As tarifas incidem sobre o recebivel do restaurante e nao sao acrescentadas ao valor pago pelo consumidor.',
  ],
})

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
    } else if (action === 'set_credit_online') {
      const enabled = body?.enabled === true
      if (enabled) {
        if (body?.acceptedTerms !== true || body?.termsVersion !== POPPAY_TERMS_VERSION) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'terms_acceptance_required',
            message: 'Leia e aceite as condições do crédito online para ativar.',
            termsVersion: POPPAY_TERMS_VERSION,
          }), { status: 412, headers: corsHeaders })
        }

        const { data: connection } = await supabase
          .from('poppay_connections')
          .select('id,status,enabled,public_key,credit_fee_bps')
          .eq('user_id', userId)
          .maybeSingle()
        if (!connection || connection.status !== 'connected' || connection.enabled !== true || !connection.public_key) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'poppay_connection_required',
            message: 'Conecte novamente o PopPay antes de ativar o crédito online.',
          }), { status: 409, headers: corsHeaders })
        }

        const acceptedAt = new Date().toISOString()
        const creditFeeBps = Math.max(0, Math.min(1000, Math.round(Number(connection.credit_fee_bps ?? 50))))
        const { error: acceptanceError } = await supabase.from('poppay_terms_acceptances').insert({
          user_id: userId,
          terms_version: POPPAY_TERMS_VERSION,
          source: 'poppay_credit_online',
          user_agent: req.headers.get('user-agent')?.slice(0, 500) || null,
          terms_snapshot: creditTermsSnapshot(creditFeeBps),
        })
        if (acceptanceError) throw acceptanceError

        const { error: updateError } = await supabase
          .from('poppay_connections')
          .update({
            credit_online_enabled: true,
            credit_terms_version: POPPAY_TERMS_VERSION,
            credit_terms_accepted_at: acceptedAt,
            updated_at: acceptedAt,
          })
          .eq('user_id', userId)
        if (updateError) throw updateError
      } else {
        const { error: updateError } = await supabase
          .from('poppay_connections')
          .update({ credit_online_enabled: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        if (updateError) throw updateError
      }
    } else if (action === 'disconnect') {
      await supabase
        .from('poppay_connections')
        .update({ enabled: false, split_enabled: false, status: 'disabled', disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId)
    }

    const { data } = await supabase
      .from('poppay_connections')
      .select('status,enabled,mp_user_id,expires_at,connected_at,last_error,credit_online_enabled,credit_fee_bps,credit_terms_version,credit_terms_accepted_at')
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
