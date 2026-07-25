import { buildSessionToken, corsHeaders, createServiceClient, fail, getDriverSession, hashToken, ok } from '../_shared/motoboy-web.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    if (action === 'login') {
      const cpf = String(body?.cpf || body?.login || '').replace(/\D/g, '')
      const password = String(body?.password || '')
      if (cpf.length !== 11 || !password) return fail('Informe CPF e senha válidos.')
      const supabase = createServiceClient()
      const { data, error } = await supabase.rpc('verify_delivery_personnel_login', { p_login: cpf, p_password: password })
      if (error) return fail(error.message)
      const driver = Array.isArray(data) ? data[0] : data
      if (!driver) return fail('CPF ou senha inválidos.', 401)
      const token = buildSessionToken()
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
      await supabase.from('delivery_driver_sessions').delete().eq('delivery_personnel_id', driver.id)
      const { error: sessionError } = await supabase.from('delivery_driver_sessions').insert({
        delivery_personnel_id: driver.id,
        restaurant_id: driver.user_id,
        token_hash: await hashToken(token),
        expires_at: expiresAt,
      })
      if (sessionError) return fail(sessionError.message)
      return ok({ session: { token, expiresAt, profile: { ...driver, restaurantId: driver.user_id } } })
    }
    if (action === 'me') {
      const session = await getDriverSession(req)
      return ok({ session: { token: session.token, expiresAt: session.expiresAt, profile: { ...session.driver, restaurantId: session.restaurantId } } })
    }
    if (action === 'logout') {
      const session = await getDriverSession(req)
      await session.supabase.from('delivery_driver_sessions').delete().eq('id', session.sessionId)
      return ok({ ok: true })
    }
    return fail('Ação inválida.')
  } catch (error: any) {
    return fail(String(error?.message || 'Erro interno no login do motoboy.'), 500)
  }
})
