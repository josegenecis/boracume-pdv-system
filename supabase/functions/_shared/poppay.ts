// deno-lint-ignore-file no-explicit-any

export const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

export const envEnabled = (...keys: string[]) => {
  const value = getEnv(...keys).trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes' || value === 'on'
}

export const getPopPayConnection = async (supabase: any, userId: string) => {
  const { data, error } = await supabase
    .from('poppay_connections')
    .select('id,user_id,status,enabled,split_enabled,fee_bps,mp_user_id,access_token,refresh_token,public_key,token_type,scope,expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { connection: null, error }
  return { connection: data || null, error: null }
}

export const refreshPopPayAccessToken = async (supabase: any, connection: any) => {
  const clientId = getEnv('POPPAY_CLIENT_ID')
  const clientSecret = getEnv('POPPAY_CLIENT_SECRET')
  const refreshToken = String(connection?.refresh_token || '')
  if (!clientId || !clientSecret || !refreshToken) return ''

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const json: any = await response.json().catch(() => ({}))
  if (!response.ok) {
    await supabase
      .from('poppay_connections')
      .update({ status: 'error', last_error: String(json?.message || json?.error || `HTTP ${response.status}`), updated_at: new Date().toISOString() })
      .eq('id', connection.id)
    return ''
  }

  const accessToken = String(json?.access_token || '')
  const nextRefreshToken = String(json?.refresh_token || '') || refreshToken
  const expiresIn = Number(json?.expires_in || 0)
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

  await supabase
    .from('poppay_connections')
    .update({
      access_token: accessToken || null,
      refresh_token: nextRefreshToken || null,
      expires_at: expiresAt,
      status: accessToken ? 'connected' : 'error',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  connection.access_token = accessToken
  connection.refresh_token = nextRefreshToken
  connection.expires_at = expiresAt
  return accessToken
}

export const getPopPayAccessToken = async (supabase: any, connection: any) => {
  const token = String(connection?.access_token || '')
  const expiresAt = connection?.expires_at ? new Date(String(connection.expires_at)).getTime() : 0
  if (!token || (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt - 60_000)) {
    return await refreshPopPayAccessToken(supabase, connection)
  }
  return token
}

export const calculatePlatformFeeCents = (amountCents: number, feeBps: number) => {
  const safeAmount = Math.max(0, Math.round(Number(amountCents) || 0))
  const safeBps = Math.min(1000, Math.max(0, Math.round(Number(feeBps) || 0)))
  if (safeAmount <= 1 || safeBps <= 0) return 0
  return Math.min(safeAmount - 1, Math.max(1, Math.round((safeAmount * safeBps) / 10_000)))
}
