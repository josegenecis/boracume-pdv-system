import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveStoreUserId } from "../_shared/multi-store.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const evolutionBaseUrl = () => String(Deno.env.get('EVOLUTION_BASE_URL') || Deno.env.get('EVOGO_BASE_URL') || 'https://api.boracume.com').replace(/\/+$/, '');
const evolutionApiKey = () => String(Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOGO_API_KEY') || '').trim();

const extractQrCode = (payload: any) => (
  payload?.data?.Qrcode ||
  payload?.data?.qrcode ||
  payload?.data?.base64 ||
  payload?.data?.code ||
  payload?.Qrcode ||
  payload?.qrcode ||
  payload?.base64 ||
  payload?.code ||
  null
);

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders });
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

    let lastQrError: any = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      let qrResult = await safeFetchJson(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
        method: 'GET',
        headers: {
          'apikey': globalApiKey
        }
      });

      if (!qrResult.response?.ok || !extractQrCode(qrResult.data)) {
        qrResult = await safeFetchJson(`${baseUrl}/instance/qr`, {
        method: 'GET',
        headers: {
          'apikey': instanceToken
        }
        });
      }

      const evoData = qrResult.data;

      const qrcode = extractQrCode(evoData);
      if (qrResult.ok && qrResult.response?.ok && qrcode) {
        return new Response(JSON.stringify({ qrcode }), {
          status: 200,
          headers: jsonHeaders,
        });
      }

      lastQrError = { status: qrResult.response?.status ?? 500, details: evoData };

      const statusResult = await safeFetchJson(`${baseUrl}/instance/all`, {
        method: 'GET',
        headers: {
          'apikey': globalApiKey
        }
      });

      const statusData = statusResult.data;

      const currentInstance = getInstancesFromPayload(statusData).find((instance: any) => (
        instance?.token === instanceToken ||
        instance?.instanceName === instanceName ||
        instance?.name === instanceName ||
        instance?.instance === instanceName
      ));

      const state = String(currentInstance?.connectionStatus || currentInstance?.state || currentInstance?.status || currentInstance?.connection || '').toLowerCase();
      if (currentInstance?.connected || ['open', 'connected', 'online'].includes(state)) {
        return new Response(JSON.stringify({ connected: true }), {
          status: 200,
          headers: jsonHeaders,
        });
      }

      const fallbackQr = extractQrCode(currentInstance);
      if (fallbackQr) {
        return new Response(JSON.stringify({ qrcode: fallbackQr }), {
          status: 200,
          headers: jsonHeaders,
        });
      }

      if (attempt < 7) {
        await sleep(2000);
      }
    }

    console.error("Evolution API Error (QR Code):", lastQrError);
    return new Response(JSON.stringify({ error: true, message: 'QR Code ainda não disponível', details: lastQrError?.details, status: lastQrError?.status ?? 500 }), {
      status: 200,
      headers: jsonHeaders,
    });

  } catch (error: any) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: true, message: error.message || 'Erro interno ao gerar QR Code' }), { status: 200, headers: jsonHeaders });
  }
});
