import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    const instanceName = body.instance || body.instanceName || body.data?.instance || body.data?.instanceName;
    const event = body.event;

    if (!instanceName) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need service role to bypass RLS in webhook
    );

    if (event === 'CONNECTION_UPDATE') {
      const state = body.data?.state || body.data?.connection;
      let newStatus = 'disconnected';
      if (state === 'open' || state === 'connected') newStatus = 'connected';
      else if (state === 'connecting') newStatus = 'connecting';

      await supabaseClient
        .from('whatsapp_instances')
        .update({ status: newStatus })
        .eq('instance_name', instanceName);
    }

    // You can handle MESSAGES_UPSERT here if needed
    // ...

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook Error:", error);
    // Always return 200 for webhooks so EvoGo doesn't retry infinitely
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
