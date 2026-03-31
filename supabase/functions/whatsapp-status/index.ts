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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const restaurant_id = user.id;
    const instanceSuffix = restaurant_id.replace(/-/g, '');
    const instanceName = `rest_${instanceSuffix}`;
    const instanceToken = `token_${instanceSuffix}`;

    const evoRes = await fetch(`${EVOLUTION_URL}/instance/all`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    let evoData;
    try {
      evoData = await evoRes.json();
    } catch(e) {
      evoData = {};
    }

    if (!evoRes.ok) {
        console.log("Evolution API status error", evoData);
        // Não falha fatalmente, só retorna disconnected para não dar 500 no polling
        return new Response(JSON.stringify({ status: 'disconnected', details: evoData }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const instances = Array.isArray(evoData?.data) ? evoData.data : [];
    const currentInstance = instances.find((instance: any) => instance?.token === instanceToken || instance?.name === instanceName);

    let newStatus = 'disconnected';
    let phone = null;
    if (currentInstance?.connected) {
      newStatus = 'connected';
    } else if (currentInstance?.qrcode) {
      newStatus = 'connecting';
    }

    if (currentInstance?.jid) {
      phone = String(currentInstance.jid).split('@')[0] || null;
    }

    // Update database
    const updateData: any = { status: newStatus };
    if (phone) updateData.phone = phone;

    await supabaseClient
      .from('whatsapp_instances')
      .update(updateData)
      .eq('restaurant_id', restaurant_id);

    return new Response(JSON.stringify({ status: newStatus, phone }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
