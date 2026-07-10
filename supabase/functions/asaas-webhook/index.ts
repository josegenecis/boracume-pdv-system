import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, access_token, asaas-access-token, x-asaas-token",
};

const paidEvents = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
]);

const overdueEvents = new Set([
  "PAYMENT_OVERDUE",
  "PAYMENT_AWAITING_RISK_ANALYSIS",
]);

const canceledEvents = new Set([
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_REFUND_DENIED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_CHARGEBACK_DISPUTE_LOST",
]);

const tokenFromHeaders = (req: Request) => {
  const authorization = req.headers.get("authorization") || "";
  return req.headers.get("asaas-access-token")
    || req.headers.get("x-asaas-token")
    || req.headers.get("access_token")
    || authorization.replace(/^Bearer\s+/i, "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    if (expectedToken && tokenFromHeaders(req) !== expectedToken) {
      return new Response(JSON.stringify({ ok: false, error: "Webhook não autorizado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const payload = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const event = String(payload.event || "");
    const payment = payload.payment || {};
    const subscriptionId = payment.subscription || payload.subscription?.id || null;

    await supabase.from("asaas_webhook_events").insert({
      event_id: payload.id || payment.id || crypto.randomUUID(),
      event_type: event,
      asaas_payment_id: payment.id || null,
      asaas_subscription_id: subscriptionId,
      payload,
    });

    if (subscriptionId) {
      const status = paidEvents.has(event)
        ? "active"
        : overdueEvents.has(event)
          ? "past_due"
          : canceledEvents.has(event)
            ? "canceled"
            : null;

      if (status) {
        const periodEnd = new Date();
        periodEnd.setDate(periodEnd.getDate() + 30);

        await supabase
          .from("subscriptions")
          .update({
            status,
            asaas_payment_id: payment.id || null,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("asaas_subscription_id", subscriptionId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("asaas-webhook error:", error);
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Erro no webhook do Asaas.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
