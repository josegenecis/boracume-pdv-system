import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveStoreUserId } from "../_shared/multi-store.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const SUPABASE_PROJECT_REF = 'gcfyrcpugmducptktjic';

const evolutionBaseUrl = () => String(Deno.env.get('EVOLUTION_BASE_URL') || Deno.env.get('EVOGO_BASE_URL') || 'https://api.boracume.com').replace(/\/+$/, '');
const evolutionApiKey = () => String(Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOGO_API_KEY') || '').trim();
const functionsBaseUrl = () => {
  const explicit = String(Deno.env.get('SUPABASE_FUNCTIONS_URL') || Deno.env.get('PUBLIC_FUNCTIONS_URL') || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1`;
};
const buildWebhookUrl = () => `${functionsBaseUrl()}/evogo-webhook`;

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

const configureEvolutionWebhook = async (baseUrl: string, globalApiKey: string, instanceName: string, instanceToken: string) => {
  const webhookUrl = buildWebhookUrl();
  const events = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE'];
  const attempts = [
    {
      label: 'webhook-set-standard',
      url: `${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: globalApiKey },
        body: JSON.stringify({
          webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: true, events }
        })
      }
    },
    {
      label: 'webhook-set-flat',
      url: `${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: globalApiKey },
        body: JSON.stringify({ enabled: true, url: webhookUrl, webhookUrl, byEvents: false, base64: true, events })
      }
    },
    {
      label: 'instance-connect-legacy',
      url: `${baseUrl}/instance/connect`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: instanceToken },
        body: JSON.stringify({
          webhookUrl,
          subscribe: ['ALL'],
          rabbitmqEnable: '',
          websocketEnable: '',
          natsEnable: ''
        })
      }
    }
  ];

  const results = [];
  for (const attempt of attempts) {
    const result = await safeFetchJson(attempt.url, attempt.init);
    const ok = Boolean(result.response?.ok);
    results.push({ label: attempt.label, ok, status: result.response?.status || null, data: result.data });
    if (ok) return { ok: true, webhookUrl, results };
  }
  return { ok: false, webhookUrl, results };
};

const configureEvolutionWebhooks = async (baseUrl: string, globalApiKey: string, instanceNames: string[], instanceToken: string) => {
  const names = Array.from(new Set(instanceNames.map((item) => String(item || '').trim()).filter(Boolean)));
  const results = [];
  for (const name of names) {
    const result = await configureEvolutionWebhook(baseUrl, globalApiKey, name, instanceToken);
    results.push({ instanceName: name, ...result });
    if (result.ok) return { ok: true, webhookUrl: result.webhookUrl, results };
  }
  return { ok: false, webhookUrl: buildWebhookUrl(), results };
};

const ensureWhatsAppSettingsEnabled = async (supabaseAdmin: any, restaurantId: string, baseUrl: string, globalApiKey: string) => {
  const defaultMessage = 'Olá! Bem-vindo ao nosso restaurante. Como posso ajudar você hoje?';
  const payload = {
    enabled: true,
    ai_enabled: true,
    evolution_url: baseUrl,
    evolution_api_key: globalApiKey,
    updated_at: new Date().toISOString()
  };
  const existing = await supabaseAdmin
    .from('whatsapp_settings')
    .select('id')
    .eq('user_id', restaurantId)
    .limit(1)
    .maybeSingle();

  if (existing?.data?.id) {
    const updated = await supabaseAdmin.from('whatsapp_settings').update(payload).eq('id', existing.data.id);
    if (updated.error && String(updated.error.message || '').includes('ai_enabled')) {
      await supabaseAdmin.from('whatsapp_settings').update({
        enabled: true,
        evolution_url: baseUrl,
        evolution_api_key: globalApiKey,
        updated_at: new Date().toISOString()
      }).eq('id', existing.data.id);
    }
    return;
  }

  const inserted = await supabaseAdmin.from('whatsapp_settings').insert({
    user_id: restaurantId,
    phone_number: '',
    default_message: defaultMessage,
    ...payload
  });
  if (inserted.error && String(inserted.error.message || '').includes('ai_enabled')) {
    const fallbackInsert = await supabaseAdmin.from('whatsapp_settings').insert({
      user_id: restaurantId,
      phone_number: '',
      default_message: defaultMessage,
      enabled: true,
      evolution_url: baseUrl,
      evolution_api_key: globalApiKey,
      updated_at: new Date().toISOString()
    });
    if (fallbackInsert.error) {
      console.error('Failed to create WhatsApp settings:', fallbackInsert.error);
    }
  } else if (inserted.error) {
    console.error('Failed to create WhatsApp settings:', inserted.error);
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

    const requestBody = await req.json().catch(() => ({}));
    const restaurant_id = await resolveStoreUserId(supabaseAdmin, user.id, requestBody?._storeId);
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
        webhookUrl: buildWebhookUrl(),
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

    const preWebhookNames = Array.from(new Set([
      instanceName,
      currentInstance?.name,
      currentInstance?.instanceName,
      currentInstance?.instance
    ].filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));
    const webhookResult = await configureEvolutionWebhooks(baseUrl, globalApiKey, preWebhookNames, instanceToken);
    if (!webhookResult.ok) {
      console.warn('Evolution webhook configuration failed', webhookResult);
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

    const providerNames = Array.from(new Set([
      instanceName,
      connectedInstance?.name,
      connectedInstance?.instanceName,
      connectedInstance?.instance
    ].filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));

    let dbError: any = null;
    for (const name of providerNames) {
      const result = await supabaseAdmin
        .from('whatsapp_instances')
        .upsert({
          restaurant_id,
          instance_name: name,
          status: instanceStatus,
          phone
        }, {
          onConflict: 'instance_name'
        });
      if (result.error) {
        dbError = result.error;
        break;
      }
    }

    if (dbError) {
      console.error("Database Error:", dbError);
      return new Response(JSON.stringify({ error: true, message: 'Falha ao salvar instância no banco', details: dbError }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    await ensureWhatsAppSettingsEnabled(supabaseAdmin, restaurant_id, baseUrl, globalApiKey);

    return new Response(JSON.stringify({ success: true, instanceName, instanceNames: providerNames, status: instanceStatus, connected: isConnected, phone, webhook: webhookResult }), {
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
