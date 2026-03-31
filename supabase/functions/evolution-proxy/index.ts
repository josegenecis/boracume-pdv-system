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

    // FORÇAR HEADERS DA EVOLUTION API
    const finalHeaders = {
      'Content-Type': 'application/json',
      'apikey': headers?.apikey || ''
    };

    console.log(`[PROXY] Chamando: ${method} ${endpoint}`);
    console.log(`[PROXY] Headers:`, finalHeaders);
    if (payload) console.log(`[PROXY] Payload:`, payload);

    const response = await fetch(endpoint, {
      method: method || 'GET',
      headers: finalHeaders,
      body: method === 'POST' && payload ? JSON.stringify(payload) : undefined
    })

    const responseText = await response.text()
    
    let jsonData = null;
    try {
        if (responseText) {
            jsonData = JSON.parse(responseText);
        }
    } catch (e) {
        jsonData = { raw: responseText };
    }
    
    return new Response(JSON.stringify({ 
      status: response.status, 
      ok: response.ok,
      data: jsonData,
      debug: {
        endpoint,
        method
      }
    }), {
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
