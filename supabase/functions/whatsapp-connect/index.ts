import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_URL = "https://api.boracume.com";
const EVOLUTION_API_KEY = "TroqueEssaChaveAgora_2026_Forte";

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const restaurant_id = user.id;
    const instanceSuffix = restaurant_id.replace(/-/g, '');
    const instanceName = `rest_${instanceSuffix}`;
    const instanceToken = `token_${instanceSuffix}`;
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('restaurant_name')
      .eq('id', restaurant_id)
      .maybeSingle();
    const restaurantName = profileData?.restaurant_name?.trim() || 'Restaurante';

    // 1. Call EvoGo to create instance
    const evoRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        name: restaurantName,
        instanceName: instanceName,
        token: instanceToken,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    });

    let evoData;
    try {
      evoData = await evoRes.json();
    } catch (e) {
      evoData = { message: "Could not parse JSON from Evolution API" };
    }

    if (!evoRes.ok && evoData?.response?.message?.[0] !== 'Instance already exists' && evoData?.error !== 'Instance already exists') {
      console.error("Evolution API Error:", evoData);
      return new Response(JSON.stringify({ error: true, message: 'Falha na EvoGo', details: evoData, status: evoRes.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceToken
      },
      body: JSON.stringify({
        webhookUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/evogo-webhook`,
        subscribe: [
          "ALL"
        ],
        rabbitmqEnable: "",
        websocketEnable: "",
        natsEnable: ""
      })
    });

    let connectData;
    try {
      connectData = await connectRes.json();
    } catch (e) {
      connectData = { message: "Could not parse JSON from Evolution API" };
    }

    if (!connectRes.ok) {
      console.error("Evolution API Connect Error:", connectData);
      return new Response(JSON.stringify({ error: true, message: 'Falha ao configurar instância na EvoGo', details: connectData, status: connectRes.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Save in Database using service role to bypass RLS or just use the user client
    // Since user is authenticated, they can insert their own row
    const { data: existingInstance } = await supabaseClient
      .from('whatsapp_instances')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (!existingInstance) {
      const { error: dbError } = await supabaseClient
        .from('whatsapp_instances')
        .insert({
          restaurant_id,
          instance_name: instanceName,
          status: 'connecting'
        });

      if (dbError) {
        console.error("Database Error:", dbError);
        return new Response(JSON.stringify({ error: 'Failed to save instance in database' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Update status to connecting
      await supabaseClient
        .from('whatsapp_instances')
        .update({ status: 'connecting' })
        .eq('restaurant_id', restaurant_id);
    }

    return new Response(JSON.stringify({ success: true, instanceName }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
