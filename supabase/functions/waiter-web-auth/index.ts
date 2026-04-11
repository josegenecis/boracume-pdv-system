import { buildSessionToken, corsHeaders, createServiceClient, fail, getWaiterSession, hashToken, normalizeCpf, ok } from '../_shared/waiter-web.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')

    if (action === 'login') {
      const cpf = normalizeCpf(String(body?.cpf || ''))
      const password = String(body?.password || '')
      if (cpf.length !== 11 || !password) {
        return fail('Informe CPF e senha válidos.')
      }

      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('waiters')
        .select('id, user_id, name, role, permissions, active, password, cpf')
        .eq('cpf', cpf)
        .eq('active', true)
        .maybeSingle()

      if (error) {
        return fail(error.message, 400)
      }

      if (!data || String(data.password || '') !== password) {
        return fail('CPF ou senha inválidos.', 401)
      }

      const token = buildSessionToken()
      const tokenHash = await hashToken(token)
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()

      await supabase.from('waiter_web_sessions').delete().eq('waiter_id', data.id)

      const { error: sessionError } = await supabase.from('waiter_web_sessions').insert({
        waiter_id: data.id,
        restaurant_id: data.user_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })

      if (sessionError) {
        return fail(sessionError.message, 400)
      }

      return ok({
        session: {
          token,
          expiresAt,
          profile: {
            id: data.id,
            restaurantId: data.user_id,
            name: data.name,
            cpf: data.cpf || cpf,
            role: data.role || 'cashier',
            permissions: (data.permissions as Record<string, boolean>) || {},
          },
        },
      })
    }

    if (action === 'me') {
      const session = await getWaiterSession(req)
      return ok({
        session: {
          token: session.rawToken,
          expiresAt: session.expiresAt,
          profile: session.profile,
        },
      })
    }

    if (action === 'logout') {
      const session = await getWaiterSession(req)
      await session.supabase.from('waiter_web_sessions').delete().eq('id', session.sessionId)
      return ok({ ok: true })
    }

    return fail('Ação inválida.', 400)
  } catch (error: any) {
    return fail(String(error?.message || 'Erro interno no login do garçom.'), 500)
  }
})
