import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_URL = "https://api.boracume.com";
const EVOLUTION_API_KEY = "TroqueEssaChaveAgora_2026_Forte";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractQrCode = (payload: any) => (
  payload?.data?.Qrcode ||
  payload?.data?.qrcode ||
  payload?.data?.base64 ||
  payload?.Qrcode ||
  payload?.qrcode ||
  payload?.base64 ||
  null
);

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

    let lastQrError: any = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const evoRes = await fetch(`${EVOLUTION_URL}/instance/qr`, {
        method: 'GET',
        headers: {
          'apikey': instanceToken
        }
      });

      let evoData;
      try {
        evoData = await evoRes.json();
      } catch {
        evoData = { message: "Could not parse JSON from Evolution API" };
      }

      const qrcode = extractQrCode(evoData);
      if (evoRes.ok && qrcode) {
        return new Response(JSON.stringify({ qrcode }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      lastQrError = { status: evoRes.status, details: evoData };

      const statusRes = await fetch(`${EVOLUTION_URL}/instance/all`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY
        }
      });

      let statusData: any = {};
      try {
        statusData = await statusRes.json();
      } catch {
        statusData = {};
      }

      const currentInstance = getInstancesFromPayload(statusData).find((instance: any) => (
        instance?.token === instanceToken ||
        instance?.instanceName === instanceName ||
        instance?.name === instanceName
      ));

      if (currentInstance?.connected) {
        return new Response(JSON.stringify({ connected: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fallbackQr = extractQrCode(currentInstance);
      if (fallbackQr) {
        return new Response(JSON.stringify({ qrcode: fallbackQr }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (attempt < 7) {
        await sleep(2000);
      }
    }

    console.error("Evolution API Error (QR Code):", lastQrError);
    return new Response(JSON.stringify({ error: true, message: 'QR Code ainda não disponível', details: lastQrError?.details, status: lastQrError?.status ?? 500 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
