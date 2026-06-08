import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const evolutionBaseUrl = () => String(Deno.env.get('EVOLUTION_BASE_URL') || Deno.env.get('EVOGO_BASE_URL') || 'https://api.boracume.com').replace(/\/+$/, '');
const evolutionApiKey = () => String(Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOGO_API_KEY') || '').trim();

const getInstancesFromPayload = (payload: any) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
      { auth: { persistSession: false, autoRefreshToken: false } }
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
    const baseUrl = evolutionBaseUrl();
    const globalApiKey = evolutionApiKey();
    if (!globalApiKey) {
      return new Response(JSON.stringify({ status: 'disconnected', error: 'EVOLUTION_API_KEY não configurada.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const evoRes = await fetch(`${baseUrl}/instance/all`, {
      method: 'GET',
      headers: {
        'apikey': globalApiKey
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

    const instances = getInstancesFromPayload(evoData);
    const currentInstance = instances.find((instance: any) => (
      instance?.token === instanceToken ||
      instance?.instanceName === instanceName ||
      instance?.name === instanceName ||
      instance?.instance === instanceName
    ));

    let newStatus = 'disconnected';
    let phone = null;
    const state = String(currentInstance?.connectionStatus || currentInstance?.state || currentInstance?.status || currentInstance?.connection || '').toLowerCase();
    const hasQr = Boolean(
      currentInstance?.qrcode ||
      currentInstance?.Qrcode ||
      currentInstance?.qr ||
      currentInstance?.QrCode ||
      currentInstance?.base64 ||
      currentInstance?.code
    );

    if (currentInstance?.connected || ['open', 'connected', 'online'].includes(state)) {
      newStatus = 'connected';
    } else if (hasQr) {
      newStatus = 'connecting';
    }

    const jid = currentInstance?.jid || currentInstance?.ownerJid || currentInstance?.owner || currentInstance?.number || currentInstance?.phone;
    if (jid) {
      phone = String(jid).split('@')[0] || null;
    }

    // Update database
    const updateData: any = { status: newStatus };
    if (phone) updateData.phone = phone;

    await supabaseAdmin
      .from('whatsapp_instances')
      .upsert({
        restaurant_id,
        instance_name: instanceName,
        ...updateData
      }, { onConflict: 'instance_name' });

    return new Response(JSON.stringify({ status: newStatus, phone }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
