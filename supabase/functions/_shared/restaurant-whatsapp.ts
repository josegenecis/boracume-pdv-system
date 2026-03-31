const EVOLUTION_URL = "https://api.boracume.com";

type AutoResponses = {
  welcome?: string;
  menu_link?: string;
  order_received?: string;
  preparing?: string;
  ready?: string;
  out_for_delivery?: string;
  delivered?: string;
  cancelled?: string;
};

type RestaurantContext = {
  enabled: boolean;
  restaurantName: string;
  autoResponses: AutoResponses;
};

const defaultResponses: Required<AutoResponses> = {
  welcome: "Olá! 👋 Bem-vindo ao {restaurant_name}. Aqui está nosso cardápio: {menu_link}",
  menu_link: "📋 Confira nosso cardápio: {menu_link}",
  order_received: "🎉 Recebemos seu pedido #{order_number}! Acompanhe aqui: {track_link}",
  preparing: "👨‍🍳 Seu pedido #{order_number} está sendo preparado. Acompanhe aqui: {track_link}",
  ready: "✅ Seu pedido #{order_number} está pronto! Acompanhe aqui: {track_link}",
  out_for_delivery: "🚗 Seu pedido #{order_number} saiu para entrega. Acompanhe aqui: {track_link}",
  delivered: "📦 Seu pedido #{order_number} foi entregue. Obrigado pela preferência!",
  cancelled: "❌ Seu pedido #{order_number} foi cancelado. Se precisar, fale com a gente."
};

function baseUrl() {
  return (Deno.env.get("PUBLIC_WEB_BASE_URL") || Deno.env.get("VITE_PUBLIC_WEB_BASE_URL") || "https://boracume.com").replace(/\/+$/, "");
}

function parseAutoResponses(value: unknown): AutoResponses {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AutoResponses;
}

export function normalizePhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function extractPhoneFromRemoteJid(value: string | null | undefined) {
  const remote = String(value || "").split("@")[0];
  return normalizePhone(remote);
}

export function fillTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? "");
}

export async function loadRestaurantContext(supabase: any, restaurantId: string): Promise<RestaurantContext> {
  const [profileResult, settingsResult] = await Promise.all([
    supabase.from("profiles").select("restaurant_name").eq("id", restaurantId).maybeSingle(),
    supabase.from("whatsapp_settings").select("enabled, auto_responses").eq("user_id", restaurantId).maybeSingle()
  ]);

  const restaurantName = profileResult?.data?.restaurant_name?.trim() || "BoraCumê";
  const enabled = settingsResult?.data?.enabled !== false;
  const autoResponses = {
    ...defaultResponses,
    ...parseAutoResponses(settingsResult?.data?.auto_responses)
  };

  return { enabled, restaurantName, autoResponses };
}

export function buildMenuShareUrl(restaurantId: string) {
  return `${baseUrl()}/share/menu/${restaurantId}`;
}

export function buildTrackShareUrl(orderId: string, restaurantId?: string, orderNumber?: string) {
  const url = new URL(`/share/track/${orderId}`, baseUrl());
  if (restaurantId) url.searchParams.set("u", restaurantId);
  if (orderNumber) url.searchParams.set("n", orderNumber);
  return url.toString();
}

export async function sendRestaurantWhatsApp(restaurantId: string, phone: string, text: string) {
  const to = normalizePhone(phone);
  const message = String(text || "").trim();
  if (!restaurantId || !to || !message) return { ok: false, skipped: true };

  const instanceToken = `token_${restaurantId.replace(/-/g, "")}`;
  const response = await fetch(`${EVOLUTION_URL}/send/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: instanceToken
    },
    body: JSON.stringify({
      number: to,
      text: message
    })
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data, status: response.status };
}

export async function notifyOrderCreated(supabase: any, order: any) {
  const restaurantId = String(order?.user_id || "");
  const orderId = String(order?.id || "");
  const orderNumber = String(order?.order_number || "");
  const customerPhone = normalizePhone(order?.customer_phone);
  if (!restaurantId || !orderId || !customerPhone) return { ok: false, skipped: true };

  const context = await loadRestaurantContext(supabase, restaurantId);
  if (!context.enabled) return { ok: false, skipped: true };

  const variables = {
    restaurant_name: context.restaurantName,
    order_number: orderNumber,
    track_link: buildTrackShareUrl(orderId, restaurantId, orderNumber),
    menu_link: buildMenuShareUrl(restaurantId),
    customer_name: String(order?.customer_name || "Cliente")
  };

  const text = fillTemplate(context.autoResponses.order_received, variables);
  return await sendRestaurantWhatsApp(restaurantId, customerPhone, text);
}

export async function notifyOrderStatus(supabase: any, order: any, status: string) {
  const restaurantId = String(order?.user_id || "");
  const orderId = String(order?.id || "");
  const orderNumber = String(order?.order_number || "");
  const customerPhone = normalizePhone(order?.customer_phone);
  if (!restaurantId || !orderId || !customerPhone) return { ok: false, skipped: true };

  const context = await loadRestaurantContext(supabase, restaurantId);
  if (!context.enabled) return { ok: false, skipped: true };

  const templateByStatus: Record<string, keyof Required<AutoResponses>> = {
    preparing: "preparing",
    ready: "ready",
    in_delivery: "out_for_delivery",
    delivered: "delivered",
    cancelled: "cancelled"
  };

  const templateKey = templateByStatus[status];
  if (!templateKey) return { ok: false, skipped: true };

  const variables = {
    restaurant_name: context.restaurantName,
    order_number: orderNumber,
    track_link: buildTrackShareUrl(orderId, restaurantId, orderNumber),
    menu_link: buildMenuShareUrl(restaurantId),
    customer_name: String(order?.customer_name || "Cliente")
  };

  const text = fillTemplate(context.autoResponses[templateKey], variables);
  return await sendRestaurantWhatsApp(restaurantId, customerPhone, text);
}

export async function autoReplyWithMenu(supabase: any, restaurantId: string, phone: string, customerName?: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!restaurantId || !normalizedPhone) return { ok: false, skipped: true };

  const context = await loadRestaurantContext(supabase, restaurantId);
  if (!context.enabled) return { ok: false, skipped: true };

  const variables = {
    restaurant_name: context.restaurantName,
    menu_link: buildMenuShareUrl(restaurantId),
    customer_name: customerName || "Cliente",
    order_number: "",
    track_link: ""
  };

  const text = fillTemplate(context.autoResponses.welcome, variables);
  return await sendRestaurantWhatsApp(restaurantId, normalizedPhone, text);
}
