// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const DEFAULT_ADMIN_EMAIL = "admin@popsystem.com.br";
const DEFAULT_ADMIN_PASSWORD = "__configure_POP_SYSTEM_ADMIN_PASSWORD_secret__";
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function numeric(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function dateMs(value: unknown) {
  const ms = new Date(String(value || "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function maxDateIso(...values: unknown[]) {
  const max = values.reduce<number>((latest, value) => Math.max(latest, dateMs(value)), 0);
  return max ? new Date(max).toISOString() : null;
}

function stableStringify(value: unknown) {
  return JSON.stringify(value);
}

async function hmacHex(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getAdminConfig() {
  const emails = String(Deno.env.get("POPSYSTEM_ADMIN_EMAILS") || DEFAULT_ADMIN_EMAIL)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const password = String(Deno.env.get("POPSYSTEM_ADMIN_PASSWORD") || DEFAULT_ADMIN_PASSWORD);
  const tokenSecret = String(Deno.env.get("POPSYSTEM_ADMIN_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || password);
  return { emails, password, tokenSecret };
}

async function createToken(email: string) {
  const { tokenSecret } = getAdminConfig();
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = stableStringify({ email: email.toLowerCase(), exp });
  const sig = await hmacHex(tokenSecret, payload);
  return btoa(`${payload}.${sig}`);
}

async function verifyToken(token: string) {
  if (!token) return null;
  try {
    const decoded = atob(token);
    const dot = decoded.lastIndexOf(".");
    if (dot <= 0) return null;
    const payload = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    const { tokenSecret, emails } = getAdminConfig();
    const expected = await hmacHex(tokenSecret, payload);
    if (sig !== expected) return null;
    const parsed = JSON.parse(payload);
    const email = String(parsed?.email || "").toLowerCase();
    const exp = Number(parsed?.exp || 0);
    if (!emails.includes(email) || !Number.isFinite(exp) || exp < Date.now()) return null;
    return { email };
  } catch {
    return null;
  }
}

async function authenticate(body: any) {
  const token = String(body?.token || "").trim();
  const tokenUser = await verifyToken(token);
  if (tokenUser) return tokenUser;

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const { emails, password: expectedPassword } = getAdminConfig();
  if (emails.includes(email) && password === expectedPassword) {
    return { email };
  }
  return null;
}

async function listAuthUsers(supabase: any) {
  const users: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  return users;
}

function isPaidStatus(status: string) {
  return ["active", "paid", "trialing_paid", "current"].includes(status);
}

function isTrialStatus(status: string) {
  return status.includes("trial") || status === "teste";
}

function isDelinquentStatus(status: string, subscription: any, nowMs: number) {
  if (["past_due", "unpaid", "overdue", "inadimplente", "blocked", "suspended"].includes(status)) return true;
  const periodEnd = dateMs(subscription?.current_period_end);
  if (periodEnd && periodEnd < nowMs && !isTrialStatus(status)) return true;
  return false;
}

function toClientRow(params: {
  profile: any;
  subscription: any;
  plan: any;
  authUser: any;
  orders: any[];
  monthOrders: any[];
  productsCount: number;
  customersCount: number;
  whatsappEnabled: boolean;
  nfceAuthorizedMonth: number;
  nfceRejectedMonth: number;
}) {
  const lastOrderAt = params.orders.reduce((latest, order) => Math.max(latest, dateMs(order.created_at)), 0);
  const status = normalizeStatus(params.subscription?.status || "sem_assinatura");
  const lastAccessAt = maxDateIso(
    params.authUser?.last_sign_in_at,
    params.authUser?.updated_at,
  );
  return {
    id: params.profile.id,
    restaurantName: params.profile.restaurant_name || "Restaurante sem nome",
    email: params.profile.email || params.authUser?.email || "",
    phone: params.profile.phone || "",
    createdAt: params.profile.created_at,
    updatedAt: params.profile.updated_at || null,
    lastSignInAt: params.authUser?.last_sign_in_at || null,
    lastAccessAt,
    subscriptionStatus: status,
    planName: params.plan?.name || (params.subscription?.plan_id ? `Plano ${params.subscription.plan_id}` : "Sem plano"),
    planPrice: numeric(params.plan?.price),
    trialEnd: params.subscription?.trial_end || null,
    currentPeriodEnd: params.subscription?.current_period_end || null,
    ordersMonth: params.monthOrders.length,
    lastOrderAt: lastOrderAt ? new Date(lastOrderAt).toISOString() : null,
    productsCount: params.productsCount,
    customersCount: params.customersCount,
    whatsappEnabled: params.whatsappEnabled,
    nfceAuthorizedMonth: params.nfceAuthorizedMonth,
    nfceRejectedMonth: params.nfceRejectedMonth,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const user = await authenticate(body);
    if (!user) return json({ ok: false, error: "Login interno inválido." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (body?.action === "login") {
      return json({ ok: true, token: await createToken(user.email), user });
    }

    const now = new Date();
    const nowMs = now.getTime();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const nextMonthStart = addMonths(monthStart, 1);
    const sevenDaysAgo = addDays(now, -7);
    const thirtyDaysAgo = addDays(now, -30);
    const nextSevenDays = addDays(now, 7);

    const [
      authUsers,
      profilesResp,
      subscriptionsResp,
      plansResp,
      ordersResp,
      productsResp,
      customersResp,
      whatsappResp,
      nfceResp,
    ] = await Promise.all([
      listAuthUsers(supabase),
      supabase.from("profiles").select("id, restaurant_name, email, phone, created_at, updated_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("subscriptions").select("id, user_id, status, plan_id, trial_start, trial_end, current_period_start, current_period_end, created_at, updated_at").limit(5000),
      supabase.from("subscription_plans").select("id, name, price").limit(100),
      supabase.from("orders").select("id, user_id, status, created_at, order_type").gte("created_at", thirtyDaysAgo.toISOString()).limit(20000),
      supabase.from("products").select("id, user_id, available").limit(50000),
      supabase.from("customers").select("id, user_id, created_at").limit(50000),
      supabase.from("whatsapp_settings").select("user_id, enabled, phone_number, updated_at").limit(5000),
      supabase.from("nfce_cupons").select("id, user_id, status, valor_total, created_at").gte("created_at", monthStart.toISOString()).limit(20000),
    ]);

    const profiles = Array.isArray(profilesResp.data) ? profilesResp.data : [];
    const subscriptions = Array.isArray(subscriptionsResp.data) ? subscriptionsResp.data : [];
    const plans = Array.isArray(plansResp.data) ? plansResp.data : [];
    const orders = Array.isArray(ordersResp.data) ? ordersResp.data : [];
    const products = Array.isArray(productsResp.data) ? productsResp.data : [];
    const customers = Array.isArray(customersResp.data) ? customersResp.data : [];
    const whatsappSettings = Array.isArray(whatsappResp.data) ? whatsappResp.data : [];
    const nfce = Array.isArray(nfceResp.data) ? nfceResp.data : [];

    const subscriptionByUser = new Map(subscriptions.map((s: any) => [s.user_id, s]));
    const planById = new Map(plans.map((p: any) => [Number(p.id), p]));
    const authById = new Map(authUsers.map((u: any) => [u.id, u]));

    const ordersByUser = new Map<string, any[]>();
    const monthOrdersByUser = new Map<string, any[]>();
    for (const order of orders) {
      const userId = String(order.user_id || "");
      if (!userId) continue;
      if (!ordersByUser.has(userId)) ordersByUser.set(userId, []);
      ordersByUser.get(userId)!.push(order);
      const created = dateMs(order.created_at);
      if (created >= monthStart.getTime() && created < nextMonthStart.getTime()) {
        if (!monthOrdersByUser.has(userId)) monthOrdersByUser.set(userId, []);
        monthOrdersByUser.get(userId)!.push(order);
      }
    }

    const countByUser = (rows: any[]) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const userId = String(row.user_id || "");
        if (!userId) continue;
        map.set(userId, (map.get(userId) || 0) + 1);
      }
      return map;
    };

    const productsByUser = countByUser(products);
    const customersByUser = countByUser(customers);
    const whatsappByUser = new Map(whatsappSettings.map((w: any) => [w.user_id, Boolean(w.enabled && w.phone_number)]));
    const nfceAuthorizedByUser = new Map<string, number>();
    const nfceRejectedByUser = new Map<string, number>();
    for (const coupon of nfce) {
      const userId = String(coupon.user_id || "");
      const status = normalizeStatus(coupon.status);
      if (["autorizado", "authorized", "aprovado"].includes(status)) {
        nfceAuthorizedByUser.set(userId, (nfceAuthorizedByUser.get(userId) || 0) + 1);
      }
      if (["rejeitado", "rejected", "erro", "error"].includes(status)) {
        nfceRejectedByUser.set(userId, (nfceRejectedByUser.get(userId) || 0) + 1);
      }
    }

    const clients = profiles.map((profile: any) => {
      const subscription = subscriptionByUser.get(profile.id);
      return toClientRow({
        profile,
        subscription,
        plan: planById.get(Number(subscription?.plan_id || 0)),
        authUser: authById.get(profile.id),
        orders: ordersByUser.get(profile.id) || [],
        monthOrders: monthOrdersByUser.get(profile.id) || [],
        productsCount: productsByUser.get(profile.id) || 0,
        customersCount: customersByUser.get(profile.id) || 0,
        whatsappEnabled: Boolean(whatsappByUser.get(profile.id)),
        nfceAuthorizedMonth: nfceAuthorizedByUser.get(profile.id) || 0,
        nfceRejectedMonth: nfceRejectedByUser.get(profile.id) || 0,
      });
    });

    const activeClients = clients.filter((client: any) => isPaidStatus(client.subscriptionStatus));
    const trialClients = clients.filter((client: any) => isTrialStatus(client.subscriptionStatus));
    const delinquentClients = clients.filter((client: any) => isDelinquentStatus(client.subscriptionStatus, subscriptionByUser.get(client.id), nowMs));
    const newToday = clients.filter((client: any) => dateMs(client.createdAt) >= today.getTime());
    const newMonth = clients.filter((client: any) => dateMs(client.createdAt) >= monthStart.getTime());
    const paidThisMonth = clients.filter((client: any) => {
      const sub = subscriptionByUser.get(client.id);
      const status = normalizeStatus(sub?.status);
      return isPaidStatus(status) && (
        dateMs(sub?.current_period_start) >= monthStart.getTime() ||
        dateMs(sub?.updated_at) >= monthStart.getTime() ||
        dateMs(sub?.current_period_end) >= nowMs
      );
    });
    const trialExpiring = clients.filter((client: any) => {
      const trialEnd = dateMs(client.trialEnd);
      return isTrialStatus(client.subscriptionStatus) && trialEnd >= nowMs && trialEnd <= nextSevenDays.getTime();
    });
    const accessedToday = clients.filter((client: any) => dateMs(client.lastAccessAt) >= today.getTime());
    const accessed7Days = clients.filter((client: any) => dateMs(client.lastAccessAt) >= sevenDaysAgo.getTime());
    const accessed30Days = clients.filter((client: any) => dateMs(client.lastAccessAt) >= thirtyDaysAgo.getTime());
    const noAccess7Days = clients.filter((client: any) => {
      const last = dateMs(client.lastAccessAt);
      return !last || last < sevenDaysAgo.getTime();
    });
    const noAccess30Days = clients.filter((client: any) => {
      const last = dateMs(client.lastAccessAt);
      return !last || last < thirtyDaysAgo.getTime();
    });
    const neverAccessed = clients.filter((client: any) => !client.lastAccessAt);
    const noOrders7Days = clients.filter((client: any) => {
      const last = dateMs(client.lastOrderAt);
      return !last || last < sevenDaysAgo.getTime();
    });

    const ordersMonth = clients.reduce((sum: number, client: any) => sum + Number(client.ordersMonth || 0), 0);
    const mrr = activeClients.reduce((sum: number, client: any) => sum + numeric(client.planPrice), 0);

    const attention = clients
      .map((client: any) => {
        const reasons: string[] = [];
        if (delinquentClients.some((item: any) => item.id === client.id)) reasons.push("inadimplente");
        if (trialExpiring.some((item: any) => item.id === client.id)) reasons.push("teste vencendo");
        if (!client.whatsappEnabled) reasons.push("WhatsApp não configurado");
        if (client.productsCount <= 0) reasons.push("sem produtos");
        if (!client.lastAccessAt || dateMs(client.lastAccessAt) < sevenDaysAgo.getTime()) reasons.push("sem acesso há 7 dias");
        if (!client.lastOrderAt || dateMs(client.lastOrderAt) < sevenDaysAgo.getTime()) reasons.push("sem pedidos há 7 dias");
        if (client.nfceRejectedMonth > 0) reasons.push("NFC-e com rejeição");
        return { ...client, reasons };
      })
      .filter((client: any) => client.reasons.length > 0)
      .sort((a: any, b: any) => b.reasons.length - a.reasons.length || dateMs(a.lastAccessAt) - dateMs(b.lastAccessAt))
      .slice(0, 30);

    const activeByAccess = [...clients]
      .sort((a: any, b: any) => dateMs(b.lastAccessAt) - dateMs(a.lastAccessAt))
      .slice(0, 12);

    return json({
      ok: true,
      token: await createToken(user.email),
      generatedAt: now.toISOString(),
      metrics: {
        totalClients: clients.length,
        newToday: newToday.length,
        newMonth: newMonth.length,
        activeClients: activeClients.length,
        trialClients: trialClients.length,
        trialExpiring: trialExpiring.length,
        delinquentClients: delinquentClients.length,
        paidThisMonth: paidThisMonth.length,
        accessedToday: accessedToday.length,
        accessed7Days: accessed7Days.length,
        accessed30Days: accessed30Days.length,
        noAccess7Days: noAccess7Days.length,
        noAccess30Days: noAccess30Days.length,
        neverAccessed: neverAccessed.length,
        noOrders7Days: noOrders7Days.length,
        ordersMonth,
        mrr,
        whatsappConfigured: clients.filter((client: any) => client.whatsappEnabled).length,
        nfceAuthorizedMonth: Array.from(nfceAuthorizedByUser.values()).reduce((sum, value) => sum + value, 0),
        nfceRejectedMonth: Array.from(nfceRejectedByUser.values()).reduce((sum, value) => sum + value, 0),
      },
      lists: {
        newToday: newToday.slice(0, 20),
        recentSignups: clients.slice(0, 20),
        delinquent: delinquentClients.slice(0, 20),
        trialExpiring: trialExpiring.slice(0, 20),
        attention,
        activeByAccess,
        inactiveByAccess: noAccess7Days
          .sort((a: any, b: any) => dateMs(a.lastAccessAt) - dateMs(b.lastAccessAt))
          .slice(0, 20),
        neverAccessed: neverAccessed.slice(0, 20),
        paidThisMonth: paidThisMonth.slice(0, 20),
      },
    });
  } catch (error) {
    console.error("admin-dashboard error", error);
    const message = error instanceof Error ? error.message : "Erro ao carregar painel interno.";
    return json({ ok: false, error: message }, 500);
  }
});
