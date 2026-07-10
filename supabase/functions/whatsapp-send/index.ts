import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const evolutionBaseUrl = () => String(Deno.env.get('EVOLUTION_BASE_URL') || Deno.env.get('EVOGO_BASE_URL') || 'https://api.boracume.com').replace(/\/+$/, '');
const evolutionApiKey = () => String(Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOGO_API_KEY') || '').trim();

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

function getManualPauseWindow() {
  const rawMinutes = Number(Deno.env.get('WHATSAPP_MANUAL_PAUSE_MINUTES') || '60');
  const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 60;
  const now = new Date();
  const resumeAt = new Date(now.getTime() + minutes * 60000);

  return {
    nowIso: now.toISOString(),
    resumeAtIso: resumeAt.toISOString(),
    status: `bot_paused_until:${resumeAt.toISOString()}`
  };
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
    const instanceSuffix = restaurant_id.replace(/-/g, '');
    const instanceName = `rest_${instanceSuffix}`;
    const instanceToken = `token_${instanceSuffix}`;
    const baseUrl = evolutionBaseUrl();
    const globalApiKey = evolutionApiKey();

    const { number, message } = await req.json();

    if (!number || !message) {
      return new Response(JSON.stringify({ error: 'Missing number or message' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let evoRes = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': globalApiKey
      },
      body: JSON.stringify({
        number: normalizePhone(number),
        text: message,
        delay: 500
      })
    });

    let evoData;
    try {
      evoData = await evoRes.json();
    } catch(e) {
      evoData = {};
    }

    if (!evoRes.ok) {
      evoRes = await fetch(`${baseUrl}/send/text`, {
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

      try {
        evoData = await evoRes.json();
      } catch(e) {
        evoData = {};
      }
    }

    if (!evoRes.ok) {
      console.error("Evolution API Error (Send Message):", evoData);
      return new Response(JSON.stringify({ error: true, message: 'Failed to send message', details: evoData, status: evoRes.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pause = getManualPauseWindow();
    const phoneCandidates = buildPhoneCandidates(number);
    const pausePayload = {
      status: pause.status,
      bot_paused: true,
      bot_paused_at: pause.nowIso,
      bot_paused_by: user.id,
      owner: 'HUMAN',
      current_state: 'HUMAN_ATTENDING',
      last_human_message_at: pause.nowIso,
      ai_resume_at: pause.resumeAtIso,
      metadata: {
        reason: 'manual_agent_message',
        aiResumeAt: pause.resumeAtIso,
        lastHumanMessageAt: pause.nowIso,
        handoffMode: 'temporary_human_owner'
      },
      updated_at: pause.nowIso
    };

    let pauseResult = await supabaseClient
      .from('whatsapp_conversations')
      .update(pausePayload)
      .eq('user_id', restaurant_id)
      .in('customer_phone', phoneCandidates);

    if (pauseResult.error && /bot_paused|owner|current_state|last_human_message_at|ai_resume_at|metadata|schema cache|column/i.test(String(pauseResult.error.message || ''))) {
      pauseResult = await supabaseClient
        .from('whatsapp_conversations')
        .update({
          status: pause.status,
          updated_at: pause.nowIso
        })
        .eq('user_id', restaurant_id)
        .in('customer_phone', phoneCandidates);
    }

    const aiPausePayload = {
      status: 'human_active',
      owner: 'HUMAN',
      current_state: 'HUMAN_ATTENDING',
      last_human_message_at: pause.nowIso,
      ai_resume_at: pause.resumeAtIso,
      metadata: {
        reason: 'manual_agent_message',
        pausedAt: pause.nowIso,
        aiResumeAt: pause.resumeAtIso,
        lastHumanMessageAt: pause.nowIso,
        handoffMode: 'temporary_human_owner'
      },
      last_message_at: pause.nowIso
    };

    const aiPauseResult = await supabaseClient
      .from('ai_conversations')
      .update(aiPausePayload)
      .eq('restaurant_id', restaurant_id)
      .in('phone', phoneCandidates);

    if (aiPauseResult.error && /owner|current_state|last_human_message_at|ai_resume_at|metadata|schema cache|column/i.test(String(aiPauseResult.error.message || ''))) {
      await supabaseClient
        .from('ai_conversations')
        .update({
          status: 'human_active',
          metadata: aiPausePayload.metadata,
          last_message_at: pause.nowIso
        })
        .eq('restaurant_id', restaurant_id)
        .in('phone', phoneCandidates);
    }

    return new Response(JSON.stringify({ success: true, data: evoData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Internal Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
