// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey || !vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ ok: false, error: "missing_env" }, 500);
    }

    webpush.setVapidDetails(
      "mailto:push@popsystem.com.br",
      vapidPublicKey,
      vapidPrivateKey,
    );

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || "").trim();
    const isTest = body?.test === true;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    let userId = "";
    let title = "Novo pedido!";
    let message = "Você recebeu um novo pedido.";

    if (orderId) {
      const { data: order, error: orderError } = await serviceClient
        .from("orders")
        .select("id,user_id,order_number,created_at")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        return jsonResponse({ ok: false, error: "order_not_found" }, 404);
      }

      const createdAt = new Date(String(order.created_at || "")).getTime();
      const ageInMinutes = (Date.now() - createdAt) / 60_000;
      if (!Number.isFinite(ageInMinutes) || ageInMinutes < -5 || ageInMinutes > 30) {
        return jsonResponse({ ok: false, error: "order_notification_window_expired" }, 409);
      }

      userId = String(order.user_id || "");
      message = `Pedido ${String(order.order_number || "").trim() || order.id} recebido`;
    } else if (isTest) {
      const authorization = req.headers.get("Authorization") || "";
      if (!authorization || !anonKey) {
        return jsonResponse({ ok: false, error: "unauthorized" }, 401);
      }

      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
      });
      const { data: authData, error: authError } = await authClient.auth.getUser();
      if (authError || !authData.user) {
        return jsonResponse({ ok: false, error: "unauthorized" }, 401);
      }

      userId = authData.user.id;
      title = "Teste de Push";
      message = "Notificação de teste enviada com sucesso!";
    } else {
      return jsonResponse({ ok: false, error: "invalid_request" }, 400);
    }

    if (!userId) {
      return jsonResponse({ ok: false, error: "restaurant_not_found" }, 404);
    }

    const { data: subscriptions, error: subscriptionsError } = await serviceClient
      .from("push_subscriptions")
      .select("id,endpoint,keys")
      .eq("user_id", userId);

    if (subscriptionsError) {
      console.error("push_subscriptions_query_failed", subscriptionsError);
      return jsonResponse({ ok: false, error: "subscriptions_query_failed" }, 500);
    }

    const payload = JSON.stringify({ title, body: message, url: "/pedidos" });
    const results: Array<{ ok: boolean; status?: number }> = [];

    for (const subscription of subscriptions || []) {
      try {
        const response = await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          payload,
          {
            TTL: 0,
            headers: { Urgency: "high" },
          } as any,
        );
        results.push({ ok: true, status: response.statusCode });
      } catch (error: any) {
        const status = Number(error?.statusCode || 0);
        results.push({ ok: false, status: status || undefined });

        if (status === 404 || status === 410) {
          await serviceClient
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
        } else {
          console.error("push_delivery_failed", {
            status,
            message: String(error?.message || error),
          });
        }
      }
    }

    return jsonResponse({
      ok: true,
      delivered: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
    });
  } catch (error: any) {
    console.error("send_push_failed", error);
    return jsonResponse({ ok: false, error: "unexpected_error" }, 500);
  }
});
