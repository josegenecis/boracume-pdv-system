// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_URL = "https://api.boracume.com";
const ACTIVE_WINDOW_DAYS = 30;
const MARKETING_COOLDOWN_DAYS = 7;
const MAX_CREATE_TARGETS = 200;
const MAX_PROCESS_BATCH = 5;

type AudienceFilters = {
  audienceType: string;
  manualPhones: string[];
  inactiveMinDays: number | null;
  inactiveMaxDays: number | null;
};

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function buildPhoneCandidates(value: string | null | undefined) {
  const normalized = normalizePhone(value);
  const withoutCountry = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  return Array.from(new Set([
    normalized,
    withoutCountry,
    withoutCountry.slice(-11),
    withoutCountry.slice(-10),
  ].map((item) => String(item || "").replace(/\D/g, "")).filter(Boolean)));
}

function parseManualPhones(value: unknown) {
  if (Array.isArray(value)) return Array.from(new Set(value.map((item) => normalizePhone(String(item))).filter(Boolean)));
  return Array.from(new Set(String(value || "")
    .split(/[\n,; ]+/)
    .map((item) => normalizePhone(item))
    .filter(Boolean)));
}

function parseAudienceFilters(body: any = {}): AudienceFilters {
  const audienceType = String(body.audienceType || body.audience_type || "active").trim();
  const minRaw = body.inactiveMinDays ?? body.inactive_min_days;
  const maxRaw = body.inactiveMaxDays ?? body.inactive_max_days;
  const min = minRaw === "" || minRaw === null || minRaw === undefined ? null : Math.max(0, Number(minRaw));
  const max = maxRaw === "" || maxRaw === null || maxRaw === undefined ? null : Math.max(0, Number(maxRaw));
  return {
    audienceType: ["active", "manual", "inactive_range"].includes(audienceType) ? audienceType : "active",
    manualPhones: parseManualPhones(body.manualPhones ?? body.manual_phones),
    inactiveMinDays: Number.isFinite(min as number) ? min : null,
    inactiveMaxDays: Number.isFinite(max as number) ? max : null,
  };
}

function withoutAccents(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isOptOutText(value: string) {
  const text = withoutAccents(value).trim().toLowerCase();
  return /^(sair|parar|cancelar|cancelar ofertas|remover|nao quero|nao receber|sem ofertas)\b/.test(text);
}

function isConversationActive(row: any) {
  const status = String(row?.status || "").trim().toLowerCase();
  if (["closed", "archived", "blocked", "opted_out", "cancelled"].includes(status)) return false;
  const updatedAt = new Date(row?.updated_at || row?.created_at || 0).getTime();
  return Number.isFinite(updatedAt) && updatedAt >= Date.now() - ACTIVE_WINDOW_DAYS * 86400000;
}

function fillTemplate(template: string, payload: { customerName?: string; menuLink?: string; productName?: string; productPrice?: string }) {
  return String(template || "")
    .replace(/\{nome\}/gi, String(payload.customerName || ""))
    .replace(/\{cliente\}/gi, String(payload.customerName || ""))
    .replace(/\{cardapio\}/gi, String(payload.menuLink || ""))
    .replace(/\{produto\}/gi, String(payload.productName || ""))
    .replace(/\{preco\}/gi, String(payload.productPrice || ""))
    .trim();
}

function buildMenuLink(restaurantId: string) {
  return `https://boracume.com/share/menu/${restaurantId}`;
}

function appendOptOut(message: string, optOutText: string) {
  const clean = String(message || "").trim();
  const opt = String(optOutText || "").trim();
  if (!opt) return clean;
  if (withoutAccents(clean).toLowerCase().includes(withoutAccents(opt).toLowerCase())) return clean;
  return `${clean}\n\n${opt}`;
}

function randomInt(min: number, max: number) {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function parseHour(value: string, fallback: number) {
  const hour = Number(String(value || "").split(":")[0]);
  return Number.isFinite(hour) ? hour : fallback;
}

function respectQuietHours(value: Date, quietStart: string, quietEnd: string, timeZone: string) {
  const startHour = parseHour(quietStart, 21);
  const endHour = parseHour(quietEnd, 9);
  const parts = localParts(value, timeZone);
  const hour = Number(parts.hour);
  const isQuiet = startHour > endHour
    ? hour >= startHour || hour < endHour
    : hour >= startHour && hour < endHour;

  if (!isQuiet) return value;

  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const currentLocal = new Date(`${localDate}T${String(hour).padStart(2, "0")}:00:00-03:00`);
  const targetDate = hour >= startHour
    ? new Date(currentLocal.getTime() + 86400000)
    : currentLocal;

  const nextParts = localParts(targetDate, timeZone);
  const jitterMinutes = randomInt(3, 45);
  return new Date(`${nextParts.year}-${nextParts.month}-${nextParts.day}T${String(endHour).padStart(2, "0")}:${String(jitterMinutes).padStart(2, "0")}:00-03:00`);
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey || anonKey);
  const { data: { user } } = await userClient.auth.getUser();
  return { user, userClient, serviceClient };
}

async function attachLastOrder(serviceClient: any, userId: string, audience: any[]) {
  const phoneCandidates = Array.from(new Set(audience.flatMap((item: any) => buildPhoneCandidates(item.customer_phone))));
  if (phoneCandidates.length === 0) return audience;

  const { data: orders } = await serviceClient
    .from("orders")
    .select("customer_phone, created_at, status")
    .eq("user_id", userId)
    .in("customer_phone", phoneCandidates)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false })
    .limit(2000);

  const latestByPhone = new Map<string, string>();
  for (const order of orders || []) {
    const createdAt = String(order?.created_at || "");
    for (const candidate of buildPhoneCandidates(order?.customer_phone)) {
      if (!latestByPhone.has(candidate)) latestByPhone.set(candidate, createdAt);
    }
  }

  return audience.map((item: any) => {
    const lastOrderAt = buildPhoneCandidates(item.customer_phone)
      .map((candidate) => latestByPhone.get(candidate))
      .find(Boolean) || null;
    const daysSinceLastOrder = lastOrderAt
      ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 86400000)
      : null;
    return { ...item, lastOrderAt, daysSinceLastOrder };
  });
}

async function loadEligibleAudience(serviceClient: any, userId: string, filters: AudienceFilters = parseAudienceFilters()) {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000).toISOString();
  const { data: conversations, error } = await serviceClient
    .from("whatsapp_conversations")
    .select("id, customer_phone, customer_name, status, updated_at, created_at")
    .eq("user_id", userId)
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const active = (conversations || []).filter(isConversationActive);
  const conversationIds = active.map((item: any) => item.id).filter(Boolean);
  if (conversationIds.length === 0) return [];

  const [{ data: customerMessages }, { data: optouts }, { data: recentSent }] = await Promise.all([
    serviceClient
      .from("whatsapp_messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("sender", "customer"),
    serviceClient
      .from("whatsapp_marketing_optouts")
      .select("customer_phone")
      .eq("user_id", userId),
    serviceClient
      .from("whatsapp_marketing_recipients")
      .select("customer_phone")
      .eq("user_id", userId)
      .eq("status", "sent")
      .gte("sent_at", new Date(Date.now() - MARKETING_COOLDOWN_DAYS * 86400000).toISOString()),
  ]);

  const inboundSet = new Set((customerMessages || []).map((item: any) => item.conversation_id));
  const optoutSet = new Set((optouts || []).map((item: any) => normalizePhone(item.customer_phone)));
  const recentSet = new Set((recentSent || []).map((item: any) => normalizePhone(item.customer_phone)));

  let eligible = active
    .map((item: any) => ({ ...item, customer_phone: normalizePhone(item.customer_phone) }))
    .filter((item: any) => item.customer_phone && inboundSet.has(item.id))
    .filter((item: any) => !optoutSet.has(item.customer_phone))
    .filter((item: any) => !recentSet.has(item.customer_phone));

  if (filters.audienceType === "manual") {
    const manualSet = new Set(filters.manualPhones);
    eligible = eligible.filter((item: any) => manualSet.has(item.customer_phone));
  }

  if (filters.audienceType === "inactive_range") {
    eligible = await attachLastOrder(serviceClient, userId, eligible);
    eligible = eligible.filter((item: any) => {
      if (item.daysSinceLastOrder === null || item.daysSinceLastOrder === undefined) return false;
      if (filters.inactiveMinDays !== null && item.daysSinceLastOrder < filters.inactiveMinDays) return false;
      if (filters.inactiveMaxDays !== null && item.daysSinceLastOrder > filters.inactiveMaxDays) return false;
      return true;
    });
  }

  return eligible.slice(0, MAX_CREATE_TARGETS);
}

async function previewAudience(serviceClient: any, userId: string, filters: AudienceFilters) {
  const audience = await loadEligibleAudience(serviceClient, userId, filters);
  const manualSet = new Set(filters.manualPhones);
  const matchedManual = filters.audienceType === "manual"
    ? audience.filter((item: any) => manualSet.has(item.customer_phone)).length
    : null;
  return {
    count: audience.length,
    activeWindowDays: ACTIVE_WINDOW_DAYS,
    cooldownDays: MARKETING_COOLDOWN_DAYS,
    filters,
    manual: filters.audienceType === "manual"
      ? {
          requested: filters.manualPhones.length,
          matched: matchedManual,
          blocked: Math.max(0, filters.manualPhones.length - Number(matchedManual || 0)),
        }
      : null,
    sample: audience.slice(0, 5).map((item: any) => ({
      name: item.customer_name || "Cliente",
      phone: item.customer_phone,
      lastActivity: item.updated_at,
      lastOrderAt: item.lastOrderAt || null,
      daysSinceLastOrder: item.daysSinceLastOrder ?? null,
    })),
  };
}

async function createCampaign(serviceClient: any, userId: string, body: any) {
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const riskAcknowledged = Boolean(body.riskAcknowledged || body.risk_acknowledged);
  const activeConversationsOnly = body.activeConversationsOnly !== false;
  const dailyLimit = Math.max(1, Math.min(200, Number(body.dailyLimit || 40)));
  const minDelaySeconds = Math.max(60, Math.min(86400, Number(body.minDelaySeconds || 180)));
  const maxDelaySeconds = Math.max(minDelaySeconds, Math.min(86400, Number(body.maxDelaySeconds || 720)));
  const timezone = String(body.timezone || "America/Fortaleza");
  const quietHoursStart = String(body.quietHoursStart || "21:00");
  const quietHoursEnd = String(body.quietHoursEnd || "09:00");
  const optOutText = String(body.optOutText || "Responder SAIR para não receber novas ofertas.").trim();
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
  const productId = String(body.productId || "").trim() || null;
  const productName = String(body.productName || "").trim() || null;
  const productPrice = body.productPrice !== undefined && body.productPrice !== null && body.productPrice !== ""
    ? Number(body.productPrice)
    : null;
  const promoImageUrl = String(body.promoImageUrl || "").trim() || null;
  const audienceFilters = parseAudienceFilters(body);

  if (!title || title.length < 3) return { error: "Informe um nome para a campanha." };
  if (!message || message.length < 10) return { error: "Escreva uma mensagem de oferta com pelo menos 10 caracteres." };
  if (!riskAcknowledged) return { error: "Confirme o aviso de risco antes de criar a campanha." };
  if (!activeConversationsOnly) return { error: "Por segurança, esta campanha só pode usar conversas ativas existentes." };
  if (isOptOutText(message)) return { error: "A mensagem não pode ser apenas um comando de opt-out." };
  if (audienceFilters.audienceType === "manual" && audienceFilters.manualPhones.length === 0) {
    return { error: "Informe pelo menos um WhatsApp na lista manual." };
  }
  if (audienceFilters.audienceType === "inactive_range" && audienceFilters.inactiveMinDays === null && audienceFilters.inactiveMaxDays === null) {
    return { error: "Informe o intervalo de dias sem pedido." };
  }

  const audience = await loadEligibleAudience(serviceClient, userId, audienceFilters);
  if (audience.length === 0) return { error: "Nenhuma conversa ativa elegível encontrada." };

  const { data: campaign, error: campaignError } = await serviceClient
    .from("whatsapp_marketing_campaigns")
    .insert({
      user_id: userId,
      title,
      message,
      status: "scheduled",
      risk_acknowledged: true,
      active_conversations_only: true,
      opt_out_text: optOutText,
      audience_type: audienceFilters.audienceType,
      daily_limit: dailyLimit,
      min_delay_seconds: minDelaySeconds,
      max_delay_seconds: maxDelaySeconds,
      quiet_hours_start: quietHoursStart,
      quiet_hours_end: quietHoursEnd,
      timezone,
      scheduled_at: Number.isNaN(scheduledAt.getTime()) ? new Date().toISOString() : scheduledAt.toISOString(),
      target_count: audience.length,
      product_id: productId,
      product_name: productName,
      product_price: Number.isFinite(productPrice as number) ? productPrice : null,
      promo_image_url: promoImageUrl,
      metadata: {
        safety: {
          activeWindowDays: ACTIVE_WINDOW_DAYS,
          cooldownDays: MARKETING_COOLDOWN_DAYS,
          maxCreateTargets: MAX_CREATE_TARGETS,
        },
        audienceFilters,
      },
    })
    .select("*")
    .single();

  if (campaignError) throw new Error(campaignError.message);

  let cursor = new Date(campaign.scheduled_at);
  const recipients = audience.map((item: any) => {
    cursor = new Date(cursor.getTime() + randomInt(minDelaySeconds, maxDelaySeconds) * 1000);
    cursor = respectQuietHours(cursor, quietHoursStart, quietHoursEnd, timezone);
    const personalized = appendOptOut(fillTemplate(message, {
      customerName: item.customer_name || "",
      menuLink: buildMenuLink(userId),
      productName: productName || "",
      productPrice: Number.isFinite(productPrice as number)
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(productPrice))
        : "",
    } as any), optOutText);

    return {
      campaign_id: campaign.id,
      user_id: userId,
      conversation_id: item.id,
      customer_phone: item.customer_phone,
      customer_name: item.customer_name || "Cliente WhatsApp",
      message_text: personalized,
      promo_image_url: promoImageUrl,
      status: "queued",
      scheduled_at: cursor.toISOString(),
    };
  });

  const { error: recipientError } = await serviceClient
    .from("whatsapp_marketing_recipients")
    .insert(recipients);

  if (recipientError) throw new Error(recipientError.message);

  await serviceClient.from("whatsapp_marketing_safety_events").insert({
    user_id: userId,
    campaign_id: campaign.id,
    event_type: "campaign_created",
    severity: "warning",
    description: "Campanha criada apenas com conversas ativas, cooldown e opt-out obrigatório.",
    metadata: { targetCount: audience.length, minDelaySeconds, maxDelaySeconds, dailyLimit, audienceFilters },
  });

  return { campaign, targetCount: audience.length };
}

async function sendText(userId: string, number: string, text: string) {
  const instanceToken = `token_${userId.replace(/-/g, "")}`;
  const response = await fetch(`${EVOLUTION_URL}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: instanceToken },
    body: JSON.stringify({ number, text }),
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

async function sendMedia(userId: string, number: string, text: string, mediaUrl: string) {
  const instanceToken = `token_${userId.replace(/-/g, "")}`;
  const payloads = [
    {
      url: `${EVOLUTION_URL}/send/media`,
      body: { number, mediatype: "image", media: mediaUrl, caption: text },
    },
    {
      url: `${EVOLUTION_URL}/send/image`,
      body: { number, image: mediaUrl, caption: text },
    },
  ];

  for (const payload of payloads) {
    const response = await fetch(payload.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: instanceToken },
      body: JSON.stringify(payload.body),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (response.ok) return { ok: true, status: response.status, data, transport: payload.url };
  }

  const fallbackText = `${text}\n\nImagem da oferta: ${mediaUrl}`;
  const fallback = await sendText(userId, number, fallbackText);
  return { ...fallback, fallbackText, mediaFallback: true };
}

async function processQueue(serviceClient: any, userId: string, body: any) {
  const batchSize = Math.max(1, Math.min(MAX_PROCESS_BATCH, Number(body.batchSize || MAX_PROCESS_BATCH)));
  const now = new Date().toISOString();
  const { data: recipients, error } = await serviceClient
    .from("whatsapp_marketing_recipients")
    .select("*, whatsapp_marketing_campaigns!inner(status,daily_limit)")
    .eq("user_id", userId)
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .eq("whatsapp_marketing_campaigns.status", "scheduled")
    .order("scheduled_at", { ascending: true })
    .limit(batchSize);

  if (error) throw new Error(error.message);

  const processed: any[] = [];
  const dailyCounters = new Map<string, number>();
  for (const recipient of recipients || []) {
    const campaignLimit = Number(recipient.whatsapp_marketing_campaigns?.daily_limit || 40);
    const campaignId = String(recipient.campaign_id || "");
    if (!dailyCounters.has(campaignId)) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { count } = await serviceClient
        .from("whatsapp_marketing_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .eq("status", "sent")
        .gte("sent_at", since.toISOString());
      dailyCounters.set(campaignId, Number(count || 0));
    }

    if (Number(dailyCounters.get(campaignId) || 0) >= campaignLimit) {
      processed.push({ id: recipient.id, status: "daily_limit_wait" });
      continue;
    }

    const phone = normalizePhone(recipient.customer_phone);
    const { data: optout } = await serviceClient
      .from("whatsapp_marketing_optouts")
      .select("id")
      .eq("user_id", userId)
      .eq("customer_phone", phone)
      .maybeSingle();

    if (optout?.id) {
      await serviceClient
        .from("whatsapp_marketing_recipients")
        .update({ status: "opted_out", last_error: "Cliente optou por não receber ofertas." })
        .eq("id", recipient.id);
      processed.push({ id: recipient.id, status: "opted_out" });
      continue;
    }

    await serviceClient
      .from("whatsapp_marketing_recipients")
      .update({ status: "sending", attempt_count: Number(recipient.attempt_count || 0) + 1 })
      .eq("id", recipient.id);

    const mediaUrl = String(recipient.promo_image_url || "").trim();
    const sendResult = mediaUrl
      ? await sendMedia(userId, phone, recipient.message_text, mediaUrl)
      : await sendText(userId, phone, recipient.message_text);
    if (!sendResult.ok) {
      await serviceClient
        .from("whatsapp_marketing_recipients")
        .update({
          status: Number(recipient.attempt_count || 0) >= 2 ? "failed" : "queued",
          last_error: `Falha no envio (${sendResult.status})`,
          scheduled_at: new Date(Date.now() + randomInt(15, 45) * 60000).toISOString(),
        })
        .eq("id", recipient.id);
      processed.push({ id: recipient.id, status: "failed", details: sendResult.data });
      continue;
    }

    await serviceClient.from("whatsapp_messages").insert({
      conversation_id: recipient.conversation_id,
      content: (sendResult as any)?.fallbackText || recipient.message_text,
      sender: "agent",
      message_type: mediaUrl ? "marketing_offer_image" : "marketing_offer",
      delivered: true,
    });

    await serviceClient
      .from("whatsapp_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", recipient.conversation_id)
      .eq("user_id", userId);

    await serviceClient
      .from("whatsapp_marketing_recipients")
      .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
      .eq("id", recipient.id);

    dailyCounters.set(campaignId, Number(dailyCounters.get(campaignId) || 0) + 1);
    processed.push({ id: recipient.id, status: "sent" });
  }

  await refreshCampaignCounters(serviceClient, userId);
  return { processed };
}

async function refreshCampaignCounters(serviceClient: any, userId: string) {
  const { data: campaigns } = await serviceClient
    .from("whatsapp_marketing_campaigns")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["scheduled", "running"]);

  for (const campaign of campaigns || []) {
    const { data: recipients } = await serviceClient
      .from("whatsapp_marketing_recipients")
      .select("status")
      .eq("campaign_id", campaign.id)
      .eq("user_id", userId);

    const rows = recipients || [];
    const sent = rows.filter((item: any) => item.status === "sent").length;
    const failed = rows.filter((item: any) => item.status === "failed").length;
    const skipped = rows.filter((item: any) => ["skipped", "cancelled", "opted_out"].includes(item.status)).length;
    const pending = rows.filter((item: any) => ["queued", "sending"].includes(item.status)).length;

    await serviceClient
      .from("whatsapp_marketing_campaigns")
      .update({
        status: pending === 0 ? "completed" : "scheduled",
        sent_count: sent,
        failed_count: failed,
        skipped_count: skipped,
        completed_at: pending === 0 ? new Date().toISOString() : null,
      })
      .eq("id", campaign.id)
      .eq("user_id", userId);
  }
}

async function changeCampaignStatus(serviceClient: any, userId: string, body: any, status: "paused" | "scheduled" | "cancelled") {
  const campaignId = String(body.campaignId || "").trim();
  if (!campaignId) return { error: "Campanha não informada." };

  const { error } = await serviceClient
    .from("whatsapp_marketing_campaigns")
    .update({ status, completed_at: status === "cancelled" ? new Date().toISOString() : null })
    .eq("id", campaignId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  if (status === "cancelled") {
    await serviceClient
      .from("whatsapp_marketing_recipients")
      .update({ status: "cancelled" })
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .eq("status", "queued");
  }

  return { ok: true, status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, serviceClient } = await getUser(req);
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = String(body.action || new URL(req.url).searchParams.get("action") || "preview-audience");

    if (action === "preview-audience") {
      return json({ ok: true, audience: await previewAudience(serviceClient, user.id, parseAudienceFilters(body)) });
    }

    if (action === "create") {
      const result = await createCampaign(serviceClient, user.id, body);
      if (result.error) return json({ ok: false, error: result.error }, 400);
      return json({ ok: true, ...result });
    }

    if (action === "process") {
      return json({ ok: true, ...(await processQueue(serviceClient, user.id, body)) });
    }

    if (action === "pause") return json({ ok: true, ...(await changeCampaignStatus(serviceClient, user.id, body, "paused")) });
    if (action === "resume") return json({ ok: true, ...(await changeCampaignStatus(serviceClient, user.id, body, "scheduled")) });
    if (action === "cancel") return json({ ok: true, ...(await changeCampaignStatus(serviceClient, user.id, body, "cancelled")) });

    return json({ error: "Ação inválida." }, 400);
  } catch (error: any) {
    console.error("[whatsapp-campaigns]", error);
    return json({ error: String(error?.message || error || "Erro interno") }, 500);
  }
});
