import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const evolutionBaseUrl = () => String(Deno.env.get('EVOLUTION_BASE_URL') || Deno.env.get('EVOGO_BASE_URL') || 'https://api.boracume.com').replace(/\/+$/, '');
const evolutionApiKey = () => String(Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOGO_API_KEY') || '').trim();
const buildWebhookUrl = () => `${String(Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '')}/functions/v1/evogo-webhook`;

const getInstancesFromPayload = (payload: any) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const safeFetchJson = async (url: string, init: RequestInit) => {
  try {
    const response = await fetch(url, init);
    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = { message: 'Could not parse JSON from Evolution API' };
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
    await supabaseAdmin.from('whatsapp_settings').update(payload).eq('id', existing.data.id);
    return;
  }

  await supabaseAdmin.from('whatsapp_settings').insert({
    user_id: restaurantId,
    ...payload
  });
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

    const providerNames = Array.from(new Set([
      instanceName,
      currentInstance?.name,
      currentInstance?.instanceName,
      currentInstance?.instance
    ].filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));

    const webhookResult = newStatus === 'connected'
      ? await configureEvolutionWebhooks(baseUrl, globalApiKey, providerNames, instanceToken)
      : null;

    for (const name of providerNames) {
      await supabaseAdmin
        .from('whatsapp_instances')
        .upsert({
          restaurant_id,
          instance_name: name,
          ...updateData
        }, { onConflict: 'instance_name' });
    }

    if (newStatus === 'connected') {
      await ensureWhatsAppSettingsEnabled(supabaseAdmin, restaurant_id, baseUrl, globalApiKey);
    }

    return new Response(JSON.stringify({ status: newStatus, phone, webhook: webhookResult, instanceNames: providerNames }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
