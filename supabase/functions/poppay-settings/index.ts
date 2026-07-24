// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEnv } from '../_shared/poppay.ts'
import { resolveStoreUserId } from '../_shared/multi-store.ts'

const POPPAY_TERMS_VERSION = '2026-07-v4'
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

const bundledTermsSnapshot = (enablePix: boolean, enableCreditOnline: boolean, feeBps: number) => ({
  document: '/termos#poppay',
  privacy: '/privacidade',
  channels: { pix: enablePix, credit_online: enableCreditOnline },
  integrated_pix_fee_reference_bps: 199,
  credit_marketplace_fee_bps: feeBps,
  credit_installments: 1,
  statements: [
    'O PIX possui tarifa integrada vigente de 1,99% por transacao e confirmacao instantanea apos a aprovacao.',
    `O credito online a vista possui tarifa do Mercado Pago aplicavel a conta mais ${(feeBps / 100).toFixed(2)}% PopPay por transacao aprovada.`,
    'No credito, a confirmacao ocorre em tempo real e a disponibilidade do saldo segue o prazo contratado com o Mercado Pago.',
    'As tarifas incidem sobre o recebivel do restaurante e nao sao adicionadas ao valor pago pelo consumidor.',
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

const refreshConnectionPublicKey = async (
  supabase: any,
  userId: string,
  connection: any,
) => {
  if (connection?.public_key || !connection?.refresh_token) return connection

  const clientId = getEnv('POPPAY_CLIENT_ID')
  const clientSecret = getEnv('POPPAY_CLIENT_SECRET')
  if (!clientId || !clientSecret) return connection

  const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: String(connection.refresh_token),
    }),
  })
  const token = await tokenResponse.json().catch(() => ({}))
  if (!tokenResponse.ok || !token?.access_token) return connection

  const expiresIn = Number(token?.expires_in || 0)
  const expiresAt = expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : connection?.expires_at || null
  const updatedConnection = {
    ...connection,
    access_token: String(token.access_token),
    refresh_token: token?.refresh_token ? String(token.refresh_token) : connection.refresh_token,
    public_key: token?.public_key ? String(token.public_key) : connection.public_key,
    token_type: token?.token_type ? String(token.token_type) : connection.token_type,
    scope: token?.scope ? String(token.scope) : connection.scope,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('poppay_connections')
    .update({
      access_token: updatedConnection.access_token,
      refresh_token: updatedConnection.refresh_token,
      public_key: updatedConnection.public_key || null,
      token_type: updatedConnection.token_type || null,
      scope: updatedConnection.scope || null,
      expires_at: updatedConnection.expires_at,
      last_error: null,
      updated_at: updatedConnection.updated_at,
    })
    .eq('user_id', userId)

  return error ? connection : updatedConnection
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
    } else if (action === 'accept_checkout_bundle') {
      if (body?.acceptedTerms !== true || body?.termsVersion !== POPPAY_TERMS_VERSION) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'terms_acceptance_required',
          message: 'Leia e aceite as condições atuais do PopPay.',
          termsVersion: POPPAY_TERMS_VERSION,
        }), { status: 412, headers: corsHeaders })
      }
      const enablePix = body?.enablePix !== false
      const enableCreditOnline = body?.enableCreditOnline !== false
      if (!enablePix && !enableCreditOnline) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'payment_channel_required',
          message: 'Selecione PIX ou cartão online.',
        }), { status: 400, headers: corsHeaders })
      }

      const { data: storedConnection } = await supabase
        .from('poppay_connections')
        .select('id,status,enabled,public_key,credit_fee_bps,access_token,refresh_token,token_type,scope,expires_at')
        .eq('user_id', userId)
        .maybeSingle()
      const connection = await refreshConnectionPublicKey(supabase, userId, storedConnection)
      if (!connection || connection.status !== 'connected' || connection.enabled !== true) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'poppay_connection_required',
          message: 'Conecte o PopPay para ativar os recebimentos.',
        }), { status: 409, headers: corsHeaders })
      }
      if (enableCreditOnline && !connection.public_key) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'reconnect_required',
          message: 'Reconecte o PopPay uma única vez para liberar o cartão online.',
        }), { status: 409, headers: corsHeaders })
      }

      const acceptedAt = new Date().toISOString()
      const creditFeeBps = Math.max(0, Math.min(1000, Math.round(Number(connection.credit_fee_bps ?? 50))))
      const { error: acceptanceError } = await supabase.from('poppay_terms_acceptances').insert({
        user_id: userId,
        terms_version: POPPAY_TERMS_VERSION,
        source: 'poppay_checkout_bundle',
        user_agent: req.headers.get('user-agent')?.slice(0, 500) || null,
        terms_snapshot: bundledTermsSnapshot(enablePix, enableCreditOnline, creditFeeBps),
      })
      if (acceptanceError) throw acceptanceError

      const { error: connectionError } = await supabase
        .from('poppay_connections')
        .update({
          credit_online_enabled: enableCreditOnline,
          credit_terms_version: enableCreditOnline ? POPPAY_TERMS_VERSION : null,
          credit_terms_accepted_at: enableCreditOnline ? acceptedAt : null,
          updated_at: acceptedAt,
        })
        .eq('user_id', userId)
      if (connectionError) throw connectionError

      const { error: pixError } = await supabase
        .from('pix_settings')
        .upsert({
          user_id: userId,
          enabled: enablePix,
          bank: 'mercadopago',
          updated_at: acceptedAt,
        }, { onConflict: 'user_id' })
      if (pixError) throw pixError
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

        const { data: storedConnection } = await supabase
          .from('poppay_connections')
          .select('id,status,enabled,public_key,credit_fee_bps,access_token,refresh_token,token_type,scope,expires_at')
          .eq('user_id', userId)
          .maybeSingle()
        const connection = await refreshConnectionPublicKey(supabase, userId, storedConnection)
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

    const { data: storedConnection } = await supabase
      .from('poppay_connections')
      .select('status,enabled,mp_user_id,expires_at,connected_at,last_error,credit_online_enabled,credit_fee_bps,credit_terms_version,credit_terms_accepted_at,public_key,access_token,refresh_token,token_type,scope')
      .eq('user_id', userId)
      .maybeSingle()
    const connection = await refreshConnectionPublicKey(supabase, userId, storedConnection)
    const { data: bundledAcceptance } = await supabase
      .from('poppay_terms_acceptances')
      .select('id,terms_snapshot')
      .eq('user_id', userId)
      .eq('terms_version', POPPAY_TERMS_VERSION)
      .eq('source', 'poppay_checkout_bundle')
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: pixSettings } = await supabase
      .from('pix_settings')
      .select('enabled')
      .eq('user_id', userId)
      .maybeSingle()
    const acceptedChannels = (bundledAcceptance?.terms_snapshot as any)?.channels || {}
    const bundledTermsCurrent = Boolean(bundledAcceptance?.id) &&
      (acceptedChannels.pix !== true || pixSettings?.enabled === true) &&
      (acceptedChannels.credit_online !== true || connection?.credit_online_enabled === true)
    return new Response(JSON.stringify({
      ok: true,
      configured: Boolean(getEnv('POPPAY_CLIENT_ID') && getEnv('POPPAY_CLIENT_SECRET') && getEnv('POPPAY_REDIRECT_URI')),
      connection: connection ? {
        status: connection.status,
        enabled: connection.enabled,
        mp_user_id: connection.mp_user_id,
        expires_at: connection.expires_at,
        connected_at: connection.connected_at,
        last_error: connection.last_error,
        credit_online_enabled: connection.credit_online_enabled,
        credit_fee_bps: connection.credit_fee_bps,
        credit_terms_version: connection.credit_terms_version,
        credit_terms_accepted_at: connection.credit_terms_accepted_at,
        card_online_ready: Boolean(connection.public_key),
        bundled_terms_current: bundledTermsCurrent,
      } : null,
      termsVersion: POPPAY_TERMS_VERSION,
    }), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
