import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_URL = "https://api.boracume.com";
const EVOLUTION_API_KEY = "TroqueEssaChaveAgora_2026_Forte";

function normalizePhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function buildPhoneCandidates(value: string | null | undefined) {
  const normalized = normalizePhone(value);
  const withoutCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  const candidates = [normalized, withoutCountry, withoutCountry.slice(-11), withoutCountry.slice(-10)]
    .map((item) => String(item || "").replace(/\D/g, ""))
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function buildTemporaryPauseStatus(minutes = 60) {
  return `bot_paused_until:${new Date(Date.now() + minutes * 60000).toISOString()}`;
}

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
    const instanceToken = `token_${restaurant_id.replace(/-/g, '')}`;

    const { number, message } = await req.json();

    if (!number || !message) {
      return new Response(JSON.stringify({ error: 'Missing number or message' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const evoRes = await fetch(`${EVOLUTION_URL}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceToken
      },
      body: JSON.stringify({
        number: number,
        text: message
      })
    });

    let evoData;
    try {
      evoData = await evoRes.json();
    } catch(e) {
      evoData = {};
    }

    if (!evoRes.ok) {
      console.error("Evolution API Error (Send Message):", evoData);
      return new Response(JSON.stringify({ error: true, message: 'Failed to send message', details: evoData, status: evoRes.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pausePayload = {
      status: buildTemporaryPauseStatus(60),
      bot_paused: true,
      bot_paused_at: new Date().toISOString(),
      bot_paused_by: user.id,
      updated_at: new Date().toISOString()
    };

    let pauseResult = await supabaseClient
      .from('whatsapp_conversations')
      .update(pausePayload)
      .eq('user_id', restaurant_id)
      .in('customer_phone', buildPhoneCandidates(number));

    if (pauseResult.error && String(pauseResult.error.message || '').includes('bot_paused')) {
      pauseResult = await supabaseClient
        .from('whatsapp_conversations')
        .update({
          status: buildTemporaryPauseStatus(60),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', restaurant_id)
        .in('customer_phone', buildPhoneCandidates(number));
    }

    return new Response(JSON.stringify({ success: true, data: evoData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
