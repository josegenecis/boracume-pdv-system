import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ifood-secret, x-merchant-id",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const providedSecret =
    (req.headers.get("x-ifood-secret") ?? "") ||
    (req.headers.get("authorization") ?? "") ||
    (new URL(req.url).searchParams.get("secret") ?? "")

  const expectedSecret = Deno.env.get("IFOOD_WEBHOOK_SECRET") ?? ""
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ??
    Deno.env.get("BORACUME_SUPABASE_URL") ??
    ""
  const serviceRole =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("BORACUME_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY") ??
    ""
  const supabase = createClient(supabaseUrl, serviceRole)

  let payload: any = {}
  try {
    payload = await req.json()
  } catch {
    payload = {}
  }

  const url = new URL(req.url)
  const merchantId =
    (url.searchParams.get("merchant_id") ?? "") ||
    (req.headers.get("x-merchant-id") ?? "") ||
    (req.headers.get("x-ifood-merchant-id") ?? "") ||
    (payload?.merchant_id ?? payload?.merchantId ?? "")

  let userId: string | null = null
  if (merchantId) {
    const { data } = await supabase
      .from("ifood_settings")
      .select("user_id")
      .eq("merchant_id", merchantId)
      .maybeSingle()
    userId = (data?.user_id as string) ?? null
  }

  const headersObj: Record<string, string> = {}
  for (const [k, v] of req.headers.entries()) {
    headersObj[k] = v
  }

  const eventType =
    String(payload?.event_type ?? payload?.type ?? payload?.eventType ?? "")

  await supabase.from("ifood_events").insert({
    user_id: userId,
    merchant_id: merchantId || null,
    event_type: eventType || null,
    payload,
    headers: headersObj,
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})

