import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_URL = "https://api.boracume.com";
const EVOLUTION_API_KEY = "BoraCumeMasterKey2024!";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const restaurant_id = user.id;

    // Get instance name from database
    const { data: instanceData, error: dbError } = await supabaseClient
      .from('whatsapp_instances')
      .select('instance_name')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (dbError || !instanceData) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const instanceName = instanceData.instance_name;

    // Fetch QR code from EvoGo
    // Usually it's GET /instance/connect/{instanceName} or we can use the connect endpoint
    // The spec says GET `http://5.189.149.31:8080/instance/{instanceName}/qrcode`
    // Evolution API v2 uses GET /instance/connect/{instanceName}
    
    const evoRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    let evoData;
    try {
      evoData = await evoRes.json();
    } catch (e) {
      evoData = { message: "Could not parse JSON from Evolution API" };
    }

    if (!evoRes.ok) {
      console.error("Evolution API Error (QR Code):", evoData);
      return new Response(JSON.stringify({ error: true, message: 'Evolution API Error', details: evoData, status: evoRes.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ qrcode: evoData?.base64 || evoData?.qrcode || evoData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
