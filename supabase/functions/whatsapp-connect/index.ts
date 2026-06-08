import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const evolutionBaseUrl = () => String(Deno.env.get('EVOLUTION_BASE_URL') || Deno.env.get('EVOGO_BASE_URL') || 'https://api.boracume.com').replace(/\/+$/, '');
const evolutionApiKey = () => String(Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOGO_API_KEY') || '').trim();

const getInstancesFromPayload = (payload: any) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const findCurrentInstance = (payload: any, instanceName: string, instanceToken: string) => {
  const instances = getInstancesFromPayload(payload);
  return instances.find((instance: any) => (
    instance?.token === instanceToken ||
    instance?.instanceName === instanceName ||
    instance?.name === instanceName ||
    instance?.instance === instanceName
  ));
};

const extractPhoneFromInstance = (instance: any) => {
  const jid = instance?.jid || instance?.ownerJid || instance?.owner || instance?.number || instance?.phone;
  if (!jid) return null;
  return String(jid).split('@')[0] || null;
};

const isInstanceConnected = (instance: any) => {
  const state = String(instance?.connectionStatus || instance?.state || instance?.status || instance?.connection || '').toLowerCase();
  return Boolean(instance?.connected) || ['open', 'connected', 'online'].includes(state);
};

const hasInstanceQr = (instance: any) => Boolean(
  instance?.qrcode ||
  instance?.Qrcode ||
  instance?.qr ||
  instance?.QrCode ||
  instance?.base64 ||
  instance?.code
);

const safeFetchJson = async (url: string, init: RequestInit) => {
  try {
    const response = await fetch(url, init);
    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = { message: "Could not parse JSON from Evolution API" };
    }
    return { ok: true, response, data };
  } catch (error: any) {
    return {
      ok: false,
      response: null,
      data: { message: error?.message || 'Network request failed' }
    };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey || (Deno.env.get('SUPABASE_ANON_KEY') ?? ''),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const restaurant_id = user.id;
    const instanceSuffix = restaurant_id.replace(/-/g, '');
    const instanceName = `rest_${instanceSuffix}`;
    const instanceToken = `token_${instanceSuffix}`;
    const baseUrl = evolutionBaseUrl();
    const globalApiKey = evolutionApiKey();
    if (!globalApiKey) {
      return new Response(JSON.stringify({ error: true, message: 'EVOLUTION_API_KEY não configurada.' }), { status: 200, headers: jsonHeaders });
    }
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('restaurant_name')
      .eq('id', restaurant_id)
      .maybeSingle();
    const restaurantName = profileData?.restaurant_name?.trim() || 'Restaurante';

    const allInstancesResult = await safeFetchJson(`${baseUrl}/instance/all`, {
      method: 'GET',
      headers: {
        'apikey': globalApiKey
      }
    });

    let currentInstance = findCurrentInstance(allInstancesResult.data, instanceName, instanceToken);

    if (!currentInstance) {
      const createResult = await safeFetchJson(`${baseUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': globalApiKey
        },
        body: JSON.stringify({
          name: restaurantName,
          instanceName: instanceName,
          token: instanceToken,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        })
      });

      const evoData = createResult.data;

      const alreadyExists =
        evoData?.response?.message?.[0] === 'Instance already exists' ||
        evoData?.response?.message === 'Instance already exists' ||
        evoData?.message === 'Instance already exists' ||
        evoData?.error === 'Instance already exists';

      if ((!createResult.ok || !createResult.response?.ok) && !alreadyExists) {
        console.error("Evolution API Error:", evoData);
        return new Response(JSON.stringify({ error: true, message: 'Falha na EvoGo', details: evoData, status: createResult.response?.status ?? 500 }), { status: 200, headers: jsonHeaders });
      }

      await sleep(1500);

      const refreshedInstancesResult = await safeFetchJson(`${baseUrl}/instance/all`, {
        method: 'GET',
        headers: {
          'apikey': globalApiKey
        }
      });

      currentInstance = findCurrentInstance(refreshedInstancesResult.data, instanceName, instanceToken);
    }

    let connectResult = await safeFetchJson(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalApiKey
      }
    });

    if (!connectResult.response?.ok) {
      connectResult = await safeFetchJson(`${baseUrl}/instance/connect`, {
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
    }

    const connectData = connectResult.data;

    const connectAlreadyExists =
      connectData?.response?.message?.[0] === 'Instance already exists' ||
      connectData?.response?.message === 'Instance already exists' ||
      connectData?.message === 'Instance already exists' ||
      connectData?.error === 'Instance already exists';

    if ((!connectResult.ok || !connectResult.response?.ok) && !connectAlreadyExists) {
      console.error("Evolution API Connect Error:", connectData);
      return new Response(JSON.stringify({ error: true, message: 'Falha ao configurar instância na EvoGo', details: connectData, status: connectResult.response?.status ?? 500 }), { status: 200, headers: jsonHeaders });
    }

    const refreshedStatusResult = await safeFetchJson(`${baseUrl}/instance/all`, {
      method: 'GET',
      headers: {
        'apikey': globalApiKey
      }
    });

    const connectedInstance = findCurrentInstance(refreshedStatusResult.data, instanceName, instanceToken) || currentInstance;
    const isConnected = isInstanceConnected(connectedInstance);
    const hasQr = hasInstanceQr(connectedInstance);
    const phone = extractPhoneFromInstance(connectedInstance);
    const instanceStatus = isConnected ? 'connected' : hasQr ? 'connecting' : 'disconnected';

    const { error: dbError } = await supabaseAdmin
      .from('whatsapp_instances')
      .upsert({
        restaurant_id,
        instance_name: instanceName,
        status: instanceStatus,
        phone
      }, {
        onConflict: 'instance_name'
      });

    if (dbError) {
      console.error("Database Error:", dbError);
      return new Response(JSON.stringify({ error: true, message: 'Falha ao salvar instância no banco', details: dbError }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, instanceName, status: instanceStatus, connected: isConnected, phone }), {
      status: 200,
      headers: jsonHeaders,
    });

  } catch (error: any) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: true, message: error.message || 'Erro interno na conexão WhatsApp' }), {
      status: 200,
      headers: jsonHeaders,
    });
  }
});
