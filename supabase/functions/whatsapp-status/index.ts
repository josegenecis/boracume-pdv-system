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

    // Fetch status from EvoGo
    // Evolution API v2 uses GET /instance/connectionState/{instanceName}
    const evoRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    const evoData = await evoRes.json();

    let newStatus = 'disconnected';
    if (evoData?.instance?.state === 'open') {
      newStatus = 'connected';
    } else if (evoData?.instance?.state === 'connecting') {
      newStatus = 'connecting';
    }

    // Optional: get phone if connected. /instance/fetchInstances
    let phone = null;
    if (newStatus === 'connected') {
        const infoRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
            method: 'GET',
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        if (infoRes.ok) {
            const infoData = await infoRes.json();
            if (infoData && infoData.length > 0 && infoData[0].ownerJid) {
                phone = infoData[0].ownerJid.split('@')[0];
            }
        }
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
