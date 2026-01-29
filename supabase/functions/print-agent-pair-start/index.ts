// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-print-agent-token',
  'Content-Type': 'application/json'
}

const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

const randomCode = () => {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  return String(n).padStart(6, '0')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ ok: false, error: 'missing_env' }), { status: 500, headers: corsHeaders })

    const supabase = createClient(supabaseUrl, serviceKey)

    let code = randomCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    for (let i = 0; i < 5; i++) {
      const { error } = await supabase
        .from('print_agent_pairings')
        .insert({ pairing_code: code, expires_at: expiresAt })
      if (!error) {
        return new Response(JSON.stringify({ ok: true, pairingCode: code, expiresAt }), { headers: corsHeaders })
      }
      code = randomCode()
    }

    return new Response(JSON.stringify({ ok: false, error: 'cannot_create_pairing' }), { status: 500, headers: corsHeaders })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'internal_error', message: e?.message }), { status: 500, headers: corsHeaders })
  }
})

