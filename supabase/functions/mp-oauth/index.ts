// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const clientID = Deno.env.get('MP_PLATFORM_CLIENT_ID')
    const clientSecret = Deno.env.get('MP_PLATFORM_CLIENT_SECRET')
    const redirectUri = Deno.env.get('MP_REDIRECT_URI') // Ex: https://seu-site.com/mp/callback

    if (!clientID || !clientSecret || !redirectUri) {
      return new Response(JSON.stringify({ error: 'misconfigured_server', message: 'Faltam variáveis de ambiente MP_PLATFORM_CLIENT_ID/SECRET/REDIRECT_URI' }), { status: 500, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { code, userId } = await req.json()

    if (!code || !userId) {
      return new Response(JSON.stringify({ error: 'missing_params', message: 'Code e UserId são obrigatórios' }), { status: 400, headers: corsHeaders })
    }

    // 1. Trocar o CODE pelo ACCESS_TOKEN
    const tokenResp = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_secret: clientSecret,
        client_id: clientID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    const tokenData = await tokenResp.json()

    if (!tokenResp.ok) {
      console.error('Erro MP OAuth:', tokenData)
      return new Response(JSON.stringify({ error: 'mp_oauth_error', details: tokenData }), { status: 400, headers: corsHeaders })
    }

    // 2. Salvar as credenciais no banco do restaurante
    const { access_token, refresh_token, public_key, user_id: mp_user_id } = tokenData

    const { error: upsertError } = await supabase
      .from('pix_settings')
      .upsert({
        user_id: userId,
        enabled: true,
        bank: 'mercadopago',
        client_id: access_token, // Access Token do restaurante
        pix_key: public_key,     // Public Key (opcional, mas útil)
        merchant_name: `MP User ${mp_user_id}`, // Nome provisório
        webhook_secret: null,    // OAuth geralmente configura webhook via API, ou mantém manual por enquanto
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (upsertError) {
      throw upsertError
    }

    return new Response(JSON.stringify({ ok: true, message: 'Conectado com sucesso' }), { headers: corsHeaders })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
