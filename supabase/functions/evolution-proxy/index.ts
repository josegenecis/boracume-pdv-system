import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { endpoint, method, headers, payload } = body

    if (!endpoint) throw new Error("Endpoint is required")

    const response = await fetch(endpoint, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {})
      },
      body: method === 'POST' ? JSON.stringify(payload || {}) : undefined
    })

    const data = await response.json()
    
    return new Response(JSON.stringify({ status: response.status, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
