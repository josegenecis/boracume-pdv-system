// deno-lint-ignore-file no-explicit-any no-import-prefix
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders })

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase()

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const getSiteUrl = (req: Request) => {
  const configured = String(Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://popsystem.com.br').replace(/\/$/, '')
  const origin = String(req.headers.get('origin') || '')
  if (/^https:\/\/(www\.)?popsystem\.com\.br$/i.test(origin) || /^http:\/\/localhost:\d+$/i.test(origin)) return origin
  return configured
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = String(Deno.env.get('SUPABASE_URL') || '')
    const anonKey = String(Deno.env.get('SUPABASE_ANON_KEY') || '')
    const serviceKey = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')
    const authHeader = String(req.headers.get('authorization') || '')
    if (!supabaseUrl || !anonKey || !serviceKey || !authHeader) return json({ ok: false, error: 'not_configured' }, 503)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: authData, error: authError } = await authClient.auth.getUser()
    const user = authData?.user
    if (authError || !user) return json({ ok: false, error: 'not_authenticated' }, 401)

    const payload = await req.json().catch(() => ({} as any))
    const action = String(payload?.action || 'list')

    if (action === 'ensure') {
      const { data, error } = await authClient.rpc('ensure_my_store_network', {
        p_name: String(payload?.name || '').trim() || null,
      })
      if (error) return json({ ok: false, error: error.message }, 400)
      return json({ ok: true, networkId: data })
    }

    if (action === 'accept') {
      const token = String(payload?.token || '').trim()
      if (!token) return json({ ok: false, error: 'missing_token' }, 400)
      const tokenHash = await sha256(token)
      const { data: invitation, error: invitationError } = await service
        .from('store_network_invitations')
        .select('id,network_id,email,store_name,status,expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (invitationError || !invitation) return json({ ok: false, error: 'invalid_invitation' }, 404)
      if (invitation.status !== 'pending') return json({ ok: false, error: 'invitation_not_pending' }, 409)
      if (new Date(invitation.expires_at).getTime() < Date.now()) {
        await service.from('store_network_invitations').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', invitation.id)
        return json({ ok: false, error: 'invitation_expired' }, 410)
      }
      if (normalizeEmail(invitation.email) !== normalizeEmail(user.email)) {
        return json({ ok: false, error: 'invitation_email_mismatch' }, 403)
      }

      const { data: network } = await service
        .from('store_networks')
        .select('id,owner_user_id')
        .eq('id', invitation.network_id)
        .single()
      if (!network) return json({ ok: false, error: 'network_not_found' }, 404)

      const { data: subscription } = await service
        .from('subscriptions')
        .select('plan_id,status,store_count')
        .eq('user_id', network.owner_user_id)
        .maybeSingle()
      const capacity = Math.max(1, Number(subscription?.store_count || 1))
      const { count } = await service
        .from('store_network_stores')
        .select('id', { count: 'exact', head: true })
        .eq('network_id', network.id)
        .eq('status', 'active')
      if (subscription?.status !== 'active' || Number(subscription?.plan_id || 0) < 3 || Number(count || 0) >= capacity) {
        return json({ ok: false, error: 'network_capacity_reached' }, 409)
      }

      const now = new Date().toISOString()
      const { error: storeError } = await service.from('store_network_stores').upsert({
        network_id: network.id,
        store_user_id: user.id,
        store_name: invitation.store_name,
        store_email: normalizeEmail(user.email),
        is_primary: false,
        status: 'active',
        updated_at: now,
      }, { onConflict: 'store_user_id' })
      if (storeError) throw storeError

      await service.from('profiles').update({
        restaurant_name: invitation.store_name,
        email: normalizeEmail(user.email),
        updated_at: now,
      }).eq('id', user.id)
      await service.from('store_network_invitations').update({
        status: 'accepted', accepted_by: user.id, accepted_at: now, updated_at: now,
      }).eq('id', invitation.id)
      return json({ ok: true, networkId: network.id })
    }

    const { data: network, error: networkError } = await service
      .from('store_networks')
      .select('id,owner_user_id,name')
      .eq('owner_user_id', user.id)
      .maybeSingle()
    if (networkError) throw networkError
    if (!network) return json({ ok: false, error: 'network_owner_required' }, 403)

    if (action === 'invite') {
      const email = normalizeEmail(payload?.email)
      const storeName = String(payload?.storeName || '').trim()
      if (!/^\S+@\S+\.\S+$/.test(email) || !storeName) return json({ ok: false, error: 'invalid_store_data' }, 400)
      if (email === normalizeEmail(user.email)) return json({ ok: false, error: 'email_is_primary_store' }, 409)

      const { data: subscription } = await service
        .from('subscriptions')
        .select('plan_id,status,store_count')
        .eq('user_id', user.id)
        .maybeSingle()
      const capacity = Math.max(1, Number(subscription?.store_count || 1))
      const { count: activeCount } = await service
        .from('store_network_stores')
        .select('id', { count: 'exact', head: true })
        .eq('network_id', network.id)
        .eq('status', 'active')
      const { count: pendingCount } = await service
        .from('store_network_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('network_id', network.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
      if (subscription?.status !== 'active' || Number(subscription?.plan_id || 0) < 3) {
        return json({ ok: false, error: 'multi_plan_required' }, 403)
      }
      if (Number(activeCount || 0) + Number(pendingCount || 0) >= capacity) {
        return json({ ok: false, error: 'network_capacity_reached' }, 409)
      }

      await service.from('store_network_invitations').update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('network_id', network.id).eq('status', 'pending').eq('email', email)

      const token = randomToken()
      const tokenHash = await sha256(token)
      const { data: invitation, error: insertError } = await service.from('store_network_invitations').insert({
        network_id: network.id,
        email,
        store_name: storeName,
        token_hash: tokenHash,
        invited_by: user.id,
      }).select('id,expires_at').single()
      if (insertError) throw insertError

      const invitationUrl = `${getSiteUrl(req)}/lojas/convite?token=${encodeURIComponent(token)}`
      let emailSent = false
      let emailNotice = 'Compartilhe o link de convite com o responsável pela loja.'
      const { error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: invitationUrl,
        data: { restaurant_name: storeName, store_network_invitation_id: invitation.id },
      })
      if (!inviteError) {
        emailSent = true
        emailNotice = 'O convite foi enviado por e-mail.'
      } else if (!String(inviteError.message || '').toLowerCase().includes('already')) {
        emailNotice = 'O e-mail automático não pôde ser enviado; compartilhe o link de convite.'
      }

      return json({ ok: true, invitationId: invitation.id, invitationUrl, expiresAt: invitation.expires_at, emailSent, emailNotice })
    }

    if (action === 'cancel-invitation') {
      const invitationId = String(payload?.invitationId || '')
      const { error } = await service.from('store_network_invitations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', invitationId).eq('network_id', network.id).eq('status', 'pending')
      if (error) throw error
      return json({ ok: true })
    }

    if (action === 'set-store-status') {
      const storeUserId = String(payload?.storeUserId || '')
      const status = String(payload?.status || '')
      if (!['active', 'suspended'].includes(status)) return json({ ok: false, error: 'invalid_status' }, 400)
      const { data: target } = await service.from('store_network_stores')
        .select('id,is_primary').eq('network_id', network.id).eq('store_user_id', storeUserId).maybeSingle()
      if (!target || target.is_primary) return json({ ok: false, error: 'primary_store_cannot_be_suspended' }, 409)
      if (status === 'active') {
        const { data: subscription } = await service.from('subscriptions')
          .select('plan_id,status,store_count').eq('user_id', user.id).maybeSingle()
        const { count } = await service.from('store_network_stores')
          .select('id', { count: 'exact', head: true }).eq('network_id', network.id).eq('status', 'active')
        if (subscription?.status !== 'active' || Number(subscription?.plan_id || 0) < 3 || Number(count || 0) >= Math.max(1, Number(subscription?.store_count || 1))) {
          return json({ ok: false, error: 'network_capacity_reached' }, 409)
        }
      }
      const { error } = await service.from('store_network_stores')
        .update({ status, updated_at: new Date().toISOString() }).eq('id', target.id)
      if (error) throw error
      return json({ ok: true })
    }

    return json({ ok: false, error: 'unsupported_action' }, 400)
  } catch (error: any) {
    console.error('[store-network]', error)
    return json({ ok: false, error: 'internal_error', message: String(error?.message || error) }, 500)
  }
})
