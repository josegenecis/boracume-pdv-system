import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyOrderCreated } from "../_shared/restaurant-whatsapp.ts";

export const config = { runtime: "edge", verify_jwt: false };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "missing_env" }), { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || "");

    if (!orderId) {
      return new Response(JSON.stringify({ ok: false, error: "missing_order_id" }), { status: 200, headers: corsHeaders });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order) {
      return new Response(JSON.stringify({ ok: false, error: "order_not_found" }), { status: 200, headers: corsHeaders });
    }

    const result = await notifyOrderCreated(supabase, order);

    return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), { status: 200, headers: corsHeaders });
  }
});
