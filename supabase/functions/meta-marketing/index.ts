// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function baseUrl() {
  return (Deno.env.get("PUBLIC_WEB_BASE_URL") || Deno.env.get("VITE_PUBLIC_WEB_BASE_URL") || "https://popsystem.com.br").replace(/\/+$/, "");
}

function redirectUri() {
  return `${baseUrl()}/marketing?tab=pop-ai&meta_callback=1`;
}

function normalizeAdAccountId(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.startsWith("act_") ? raw : `act_${raw.replace(/^act_/, "")}`;
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey || anonKey);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user?.id) throw new Error("Sessão inválida.");
  return { user, serviceClient };
}

async function cryptoKey() {
  const secret = Deno.env.get("META_TOKEN_SECRET") || Deno.env.get("AUTOMATION_SECRET") || Deno.env.get("JWT_SECRET") || "";
  if (!secret || secret.length < 16) throw new Error("META_TOKEN_SECRET não configurado.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function fromB64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await cryptoKey();
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token)));
  return `${b64(iv)}.${b64(encrypted)}`;
}

async function decryptToken(value: string) {
  const [ivRaw, encryptedRaw] = String(value || "").split(".");
  if (!ivRaw || !encryptedRaw) throw new Error("Token Meta inválido.");
  const key = await cryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(ivRaw) }, key, fromB64(encryptedRaw));
  return new TextDecoder().decode(decrypted);
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\/+/, "")}`);
  url.searchParams.set("access_token", token);
  Object.entries(params).forEach(([key, value]) => value && url.searchParams.set(key, value));
  const res = await fetch(url);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message || "Falha ao consultar Meta.");
  return payload;
}

async function graphPost(path: string, token: string, body: Record<string, any>) {
  const params = new URLSearchParams();
  params.set("access_token", token);
  Object.entries(body).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });
  const res = await fetch(`${GRAPH_BASE}/${path.replace(/^\/+/, "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message || "Falha ao enviar para Meta.");
  return payload;
}

async function ensurePublicBucket(serviceClient: any, bucket: string) {
  const { data: buckets } = await serviceClient.storage.listBuckets();
  const exists = Array.isArray(buckets) && buckets.some((item: any) => item.name === bucket || item.id === bucket);
  if (!exists) {
    await serviceClient.storage.createBucket(bucket, { public: true, fileSizeLimit: 10485760 });
  }
}

async function uploadMarketingImage(serviceClient: any, restaurantId: string, bytes: Uint8Array, contentType = "image/png") {
  await ensurePublicBucket(serviceClient, "product-images");
  const ext = contentType.includes("webp") ? "webp" : contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const path = `marketing-ai/${restaurantId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await serviceClient.storage.from("product-images").upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data } = serviceClient.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function generateStaticProductImage(serviceClient: any, restaurantId: string, prompt: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1-mini",
      prompt,
      size: "1024x1024",
      quality: Deno.env.get("OPENAI_IMAGE_QUALITY") || "low",
      n: 1,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error?.message || "Falha ao gerar imagem IA.");
  const item = payload?.data?.[0] || {};
  if (item.b64_json) {
    return uploadMarketingImage(serviceClient, restaurantId, bytesFromBase64(String(item.b64_json)), "image/png");
  }
  if (item.url) {
    const imageRes = await fetch(String(item.url));
    if (!imageRes.ok) throw new Error("Falha ao baixar imagem IA.");
    const contentType = imageRes.headers.get("content-type") || "image/png";
    return uploadMarketingImage(serviceClient, restaurantId, new Uint8Array(await imageRes.arrayBuffer()), contentType);
  }
  return null;
}

async function discoverAssets(token: string) {
  const businesses = await graphGet("me/businesses", token, { fields: "id,name,verification_status" }).catch(() => ({ data: [] }));
  const adAccounts = await graphGet("me/adaccounts", token, { fields: "id,name,account_status,currency,timezone_name,business" }).catch(() => ({ data: [] }));
  const pages = await graphGet("me/accounts", token, { fields: "id,name,access_token,instagram_business_account{id,username,name},connected_instagram_account{id,username,name}" }).catch(() => ({ data: [] }));
  const permissions = await graphGet("me/permissions", token).catch(() => ({ data: [] }));
  const firstBusiness = businesses?.data?.[0] || null;
  let whatsappAccounts: any[] = [];
  let phoneNumbers: any[] = [];
  const warnings: string[] = [];
  if (firstBusiness?.id) {
    const ownedWaba = await graphGet(`${firstBusiness.id}/owned_whatsapp_business_accounts`, token, { fields: "id,name,currency,timezone_id" }).catch((error) => {
      warnings.push(`WhatsApp Business próprio não pôde ser consultado: ${String(error?.message || error)}`);
      return { data: [] };
    });
    const clientWaba = await graphGet(`${firstBusiness.id}/client_whatsapp_business_accounts`, token, { fields: "id,name,currency,timezone_id" }).catch((error) => {
      warnings.push(`WhatsApp Business atribuído não pôde ser consultado: ${String(error?.message || error)}`);
      return { data: [] };
    });
    const byId = new Map<string, any>();
    [...(ownedWaba?.data || []), ...(clientWaba?.data || [])].forEach((item: any) => {
      if (item?.id) byId.set(item.id, item);
    });
    whatsappAccounts = [...byId.values()];
  }
  const firstAd = adAccounts?.data?.[0] || null;
  const firstPage = pages?.data?.[0] || null;
  const firstInstagram = firstPage?.instagram_business_account || firstPage?.connected_instagram_account || null;
  const firstWaba = whatsappAccounts?.[0] || null;
  if (firstWaba?.id) {
    const phones = await graphGet(`${firstWaba.id}/phone_numbers`, token, { fields: "id,display_phone_number,verified_name,quality_rating" }).catch((error) => {
      warnings.push(`Números WABA não puderam ser consultados: ${String(error?.message || error)}`);
      return { data: [] };
    });
    phoneNumbers = phones?.data || [];
  }
  return {
    businesses: businesses?.data || [],
    adAccounts: adAccounts?.data || [],
    pages: pages?.data || [],
    whatsappAccounts,
    phoneNumbers,
    permissions: permissions?.data || [],
    warnings,
    capabilities: {
      canReadInstagram: Boolean(firstInstagram?.id),
      canReadWhatsAppBusiness: whatsappAccounts.length > 0,
      canReadWabaPhone: phoneNumbers.length > 0,
    },
    selected: {
      business_id: firstBusiness?.id || null,
      ad_account_id: firstAd?.id || null,
      page_id: firstPage?.id || null,
      instagram_account_id: firstInstagram?.id || null,
      whatsapp_business_account_id: firstWaba?.id || null,
      phone_number_id: phoneNumbers?.[0]?.id || null,
      currency: firstAd?.currency || null,
      timezone: firstAd?.timezone_name || null,
    },
  };
}

function moneyToCents(value: unknown) {
  const n = Number(value || 0);
  return Math.max(100, Math.round(n * 100));
}

async function generateCopyWithAi(input: any, knowledge: any) {
  const product = knowledge.product?.name || input.productFocus || "produto em destaque";
  const price = knowledge.product?.price ? `R$ ${Number(knowledge.product.price).toFixed(2).replace(".", ",")}` : "preço especial";
  const fallback = [
    { style: "promocional", primary_text: `Hoje tem ${product} por ${price}. Peça agora e receba rapidinho.`, headline: `${product} em oferta`, description: "Promoção por tempo limitado.", cta: "ORDER_NOW" },
    { style: "urgente", primary_text: `Bateu vontade? Garanta seu ${product} enquanto está disponível.`, headline: `Peça ${product} agora`, description: "Clique e fale pelo WhatsApp.", cta: "WHATSAPP_MESSAGE" },
    { style: "emocional", primary_text: `Seu momento gostoso do dia fica melhor com ${product}.`, headline: "Sabor que combina com hoje", description: "Faça seu pedido em poucos cliques.", cta: "ORDER_NOW" },
    { style: "direta", primary_text: `${product} por ${price}. Clique e faça seu pedido.`, headline: `${product} - ${price}`, description: "Entrega conforme área do restaurante.", cta: "ORDER_NOW" },
    { style: "premium", primary_text: `Escolha ${product} preparado com cuidado pelo ${knowledge.restaurant?.restaurant_name || "restaurante"}.`, headline: "Experiência especial", description: "Peça pelo cardápio digital.", cta: "LEARN_MORE" },
  ];

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return fallback;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Você é um especialista brasileiro em tráfego pago para restaurantes. Gere apenas JSON válido com a chave copies, contendo 5 variações: promocional, urgente, emocional, direta e premium. Não prometa resultado garantido." },
          { role: "user", content: JSON.stringify({ input, restaurant: knowledge.restaurant, product: knowledge.product, menuLink: knowledge.menuLink }) },
        ],
      }),
    });
    const payload = await res.json();
    const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
    return Array.isArray(parsed?.copies) && parsed.copies.length ? parsed.copies.slice(0, 5) : fallback;
  } catch {
    return fallback;
  }
}

async function buildKnowledge(serviceClient: any, restaurantId: string, input: any) {
  const { data: restaurant } = await serviceClient.from("profiles").select("restaurant_name,address,phone,opening_hours,logo_url,banner_url,description").eq("id", restaurantId).maybeSingle();
  let product: any = null;
  if (input.productId) {
    const { data } = await serviceClient.from("products").select("id,name,description,price,category,image_url,available").eq("user_id", restaurantId).eq("id", input.productId).maybeSingle();
    product = data;
  }
  if (!product && input.productFocus) {
    const { data } = await serviceClient.from("products").select("id,name,description,price,category,image_url,available").eq("user_id", restaurantId).ilike("name", `%${input.productFocus}%`).eq("available", true).limit(1);
    product = data?.[0] || null;
  }
  const { data: products } = await serviceClient.from("products").select("id,name,price,category,available").eq("user_id", restaurantId).eq("available", true).order("name").limit(80);
  return {
    restaurant,
    product,
    products: products || [],
    menuLink: `${baseUrl()}/share/menu/${restaurantId}`,
  };
}

async function planCampaign(serviceClient: any, restaurantId: string, input: any) {
  const knowledge = await buildKnowledge(serviceClient, restaurantId, input);
  const copies = await generateCopyWithAi(input, knowledge);
  const destination = String(input.destination || "whatsapp");
  const productFocus = knowledge.product?.name || input.productFocus || input.categoryFocus || "Produto em destaque";
  const dailyBudget = Math.max(5, Number(input.dailyBudget || 20));
  const generatedImagePrompt = `Crie uma foto publicitária realista e apetitosa para anúncio de restaurante brasileiro.
Produto: ${productFocus}.
Descrição: ${knowledge.product?.description || input.notes || "produto do cardápio"}.
Restaurante: ${knowledge.restaurant?.restaurant_name || "PopSystem"}.
Estilo: fotografia de comida, iluminação profissional, fundo limpo, alta nitidez, sem texto, sem logo, sem pessoas.`;
  let aiImageUrl: string | null = null;
  if (!knowledge.product?.image_url) {
    aiImageUrl = await generateStaticProductImage(serviceClient, restaurantId, generatedImagePrompt).catch((error) => {
      console.error("marketing_ai_image_generation_failed", error);
      return null;
    });
  }
  const strategy = {
    objective: input.objective || "vender_mais",
    destination,
    restaurant: {
      name: knowledge.restaurant?.restaurant_name || "PopSystem",
      logo_url: knowledge.restaurant?.logo_url || null,
      banner_url: knowledge.restaurant?.banner_url || null,
    },
    audience: {
      city: input.targetCity || "",
      radius_km: Number(input.targetRadiusKm || 5),
      age_min: 18,
      age_max: 55,
      interests: ["delivery", "restaurantes", "comida", productFocus],
    },
    placements: ["facebook_feed", "instagram_feed", "instagram_stories", "instagram_reels", "facebook_stories"],
    budget: { daily: dailyBudget, recommended_daily: Math.max(dailyBudget, 20) },
    safety: [
      "Campanha será criada pausada para revisão.",
      "Sem promessa de resultado garantido.",
      "Preço e disponibilidade validados pelo cardápio.",
    ],
    product: knowledge.product,
    menu_link: knowledge.menuLink,
  };
  const creatives = ["feed_1080x1080", "story_1080x1920", "reels_1080x1920", "banner_1200x628"].map((format) => ({
    format,
    type: knowledge.product?.image_url ? "product_photo" : aiImageUrl ? "ai_generated" : "static",
    image_url: knowledge.product?.image_url || aiImageUrl || null,
    logo_url: knowledge.restaurant?.logo_url || null,
    generated_image_prompt: knowledge.product?.image_url ? null : generatedImagePrompt,
    headline: copies[0]?.headline || `${productFocus} no ${knowledge.restaurant?.restaurant_name || "PopSystem"}`,
    primary_text: copies[0]?.primary_text || `Peça ${productFocus} agora.`,
    description: copies[0]?.description || "Campanha criada com IA para revisão.",
    cta: destination === "whatsapp" ? "WHATSAPP_MESSAGE" : "ORDER_NOW",
  }));
  return { knowledge, strategy, copies, creatives };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, serviceClient } = await getUser(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    if (action === "start_oauth") {
      const appId = Deno.env.get("META_APP_ID");
      if (!appId) return json({ error: "META_APP_ID não configurado." }, 400);
      const loginConfigId = Deno.env.get("META_LOGIN_CONFIG_ID");
      const state = crypto.randomUUID();
      const scopes = [
        "ads_management",
        "ads_read",
        "business_management",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_ads",
      ].join(",");
      const url = new URL("https://www.facebook.com/dialog/oauth");
      url.searchParams.set("client_id", appId);
      url.searchParams.set("redirect_uri", redirectUri());
      url.searchParams.set("state", state);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scopes);
      if (loginConfigId) url.searchParams.set("config_id", loginConfigId);
      return json({ url: url.toString(), state, redirect_uri: redirectUri() });
    }

    if (action === "complete_oauth") {
      const appId = Deno.env.get("META_APP_ID");
      const appSecret = Deno.env.get("META_APP_SECRET");
      const code = String(body.code || "");
      if (!appId || !appSecret) return json({ error: "META_APP_ID/META_APP_SECRET não configurados." }, 400);
      if (!code) return json({ error: "Código Meta não informado." }, 400);
      const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", redirectUri());
      tokenUrl.searchParams.set("code", code);
      const tokenRes = await fetch(tokenUrl);
      const tokenPayload = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenPayload?.error?.message || "Falha ao conectar Meta.");
      const token = String(tokenPayload.access_token || "");
      const assets = await discoverAssets(token);
      const encrypted = await encryptToken(token);
      const selected = assets.selected;
      const expiresAt = tokenPayload.expires_in ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString() : null;
      const { data, error } = await serviceClient.from("meta_connections").upsert({
        restaurant_id: user.id,
        business_id: selected.business_id,
        ad_account_id: selected.ad_account_id,
        page_id: selected.page_id,
        instagram_account_id: selected.instagram_account_id,
        whatsapp_business_account_id: selected.whatsapp_business_account_id,
        phone_number_id: selected.phone_number_id,
        access_token_encrypted: encrypted,
        token_expires_at: expiresAt,
        status: "connected",
        permissions: assets.permissions || [],
        assets_json: assets,
        currency: selected.currency,
        timezone: selected.timezone,
        last_sync_at: new Date().toISOString(),
      }, { onConflict: "restaurant_id" }).select("*").single();
      if (error) throw error;
      return json({ connection: { ...data, access_token_encrypted: undefined } });
    }

    if (action === "sync_assets") {
      const { data: conn, error } = await serviceClient.from("meta_connections").select("*").eq("restaurant_id", user.id).maybeSingle();
      if (error) throw error;
      if (!conn?.access_token_encrypted) return json({ error: "Conta Meta não conectada." }, 400);
      const token = await decryptToken(conn.access_token_encrypted);
      const assets = await discoverAssets(token);
      const selected = assets.selected;
      const { data } = await serviceClient.from("meta_connections").update({
        business_id: selected.business_id || conn.business_id,
        ad_account_id: selected.ad_account_id || conn.ad_account_id,
        page_id: selected.page_id || conn.page_id,
        instagram_account_id: selected.instagram_account_id || conn.instagram_account_id,
        whatsapp_business_account_id: selected.whatsapp_business_account_id || conn.whatsapp_business_account_id,
        phone_number_id: selected.phone_number_id || conn.phone_number_id,
        permissions: assets.permissions || conn.permissions || [],
        assets_json: assets,
        currency: selected.currency || conn.currency,
        timezone: selected.timezone || conn.timezone,
        status: "connected",
        last_sync_at: new Date().toISOString(),
      }).eq("id", conn.id).select("*").single();
      return json({ connection: { ...data, access_token_encrypted: undefined } });
    }

    if (action === "plan_campaign") {
      const plan = await planCampaign(serviceClient, user.id, body);
      const { data: connection } = await serviceClient.from("meta_connections").select("id,ad_account_id,page_id,instagram_account_id,whatsapp_business_account_id,phone_number_id,status").eq("restaurant_id", user.id).maybeSingle();
      const campaignPayload = {
        restaurant_id: user.id,
        connection_id: connection?.id || null,
        name: body.name || `PopMarketing AI - ${plan.strategy.product?.name || body.productFocus || "Campanha"}`,
        objective: body.destination === "whatsapp" ? "OUTCOME_ENGAGEMENT" : "OUTCOME_TRAFFIC",
        destination: body.destination || "whatsapp",
        daily_budget: Number(body.dailyBudget || 20),
        status: "review",
        start_date: body.startDate || null,
        end_date: body.endDate || null,
        target_city: body.targetCity || null,
        target_radius_km: Number(body.targetRadiusKm || 5),
        product_focus: plan.strategy.product?.name || body.productFocus || null,
        product_id: plan.strategy.product?.id || body.productId || null,
        menu_link: plan.knowledge.menuLink,
        ai_strategy: { ...plan.strategy, copies: plan.copies },
        review_snapshot: { connection, creatives: plan.creatives, knowledge: plan.knowledge },
      };
      const { data: campaign, error } = await serviceClient.from("marketing_campaigns").insert(campaignPayload).select("*").single();
      if (error) throw error;
      const adsetPayload = {
        campaign_id: campaign.id,
        audience_json: plan.strategy.audience,
        placement_json: { placements: plan.strategy.placements },
        budget: Number(body.dailyBudget || 20),
        status: "draft",
      };
      const { error: adsetError } = await serviceClient.from("marketing_adsets").insert(adsetPayload);
      if (adsetError) {
        await serviceClient.from("marketing_campaigns").update({ status: "error", last_error: adsetError.message }).eq("id", campaign.id);
        throw adsetError;
      }
      const creativeRows = plan.creatives.map((creative: any) => ({
        campaign_id: campaign.id,
        format: creative.format,
        type: creative.type,
        image_url: creative.image_url,
        video_url: creative.video_url || null,
        headline: creative.headline,
        primary_text: creative.primary_text,
        description: creative.description,
        cta: creative.cta,
        status: "draft",
      }));
      const { error: creativeError } = await serviceClient.from("marketing_creatives").insert(creativeRows);
      if (creativeError) {
        await serviceClient.from("marketing_campaigns").update({ status: "error", last_error: creativeError.message }).eq("id", campaign.id);
        throw creativeError;
      }
      await serviceClient.from("marketing_ai_logs").insert({ restaurant_id: user.id, campaign_id: campaign.id, action: "plan_campaign", input: body, output: { strategy: plan.strategy } });
      return json({ campaignId: campaign.id, plan: { campaign, creatives: plan.creatives, copies: plan.copies, strategy: plan.strategy } });
    }

    if (action === "publish_paused") {
      const campaignId = String(body.campaignId || "");
      const { data: campaign } = await serviceClient.from("marketing_campaigns").select("*, meta_connections(*)").eq("restaurant_id", user.id).eq("id", campaignId).single();
      if (!campaign?.id) return json({ error: "Campanha não encontrada." }, 404);
      const conn = campaign.meta_connections;
      if (!conn?.access_token_encrypted || !conn?.ad_account_id || !conn?.page_id) return json({ error: "Conecte uma conta Meta com conta de anúncio e página antes de publicar." }, 400);
      if (campaign.destination === "whatsapp" && !conn.whatsapp_business_account_id) {
        return json({ error: "Seu WhatsApp ainda não está vinculado à conta de anúncios." }, 400);
      }
      const token = await decryptToken(conn.access_token_encrypted);
      const adAccountId = normalizeAdAccountId(conn.ad_account_id);
      const metaCampaign = await graphPost(`${adAccountId}/campaigns`, token, {
        name: campaign.name,
        objective: campaign.objective || "OUTCOME_TRAFFIC",
        status: "PAUSED",
        special_ad_categories: [],
      });
      const metaAdset = await graphPost(`${adAccountId}/adsets`, token, {
        name: `${campaign.name} - Público IA`,
        campaign_id: metaCampaign.id,
        daily_budget: moneyToCents(campaign.daily_budget),
        billing_event: "IMPRESSIONS",
        optimization_goal: campaign.destination === "whatsapp" ? "CONVERSATIONS" : "LINK_CLICKS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: { geo_locations: { countries: ["BR"] }, age_min: 18, age_max: 55 },
        status: "PAUSED",
      });
      const link = campaign.menu_link || `${baseUrl()}/share/menu/${user.id}`;
      const { data: creativeRow } = await serviceClient.from("marketing_creatives").select("*").eq("campaign_id", campaign.id).limit(1).maybeSingle();
      const metaCreative = await graphPost(`${adAccountId}/adcreatives`, token, {
        name: `${campaign.name} - Criativo IA`,
        object_story_spec: {
          page_id: conn.page_id,
          link_data: {
            link,
            message: creativeRow?.primary_text || "Clique e faça seu pedido.",
            name: creativeRow?.headline || campaign.name,
            description: creativeRow?.description || "Campanha PopMarketing AI",
            picture: creativeRow?.image_url || undefined,
            call_to_action: { type: campaign.destination === "whatsapp" ? "CONTACT_US" : "LEARN_MORE", value: { link } },
          },
        },
      });
      const metaAd = await graphPost(`${adAccountId}/ads`, token, {
        name: `${campaign.name} - Anúncio IA`,
        adset_id: metaAdset.id,
        creative: { creative_id: metaCreative.id },
        status: "PAUSED",
      });
      await serviceClient.from("marketing_campaigns").update({ meta_campaign_id: metaCampaign.id, status: "paused" }).eq("id", campaign.id);
      await serviceClient.from("marketing_adsets").update({ meta_adset_id: metaAdset.id, status: "paused" }).eq("campaign_id", campaign.id);
      if (creativeRow?.id) await serviceClient.from("marketing_creatives").update({ meta_creative_id: metaCreative.id, status: "paused" }).eq("id", creativeRow.id);
      await serviceClient.from("marketing_ads").insert({ campaign_id: campaign.id, adset_id: null, creative_id: creativeRow?.id || null, meta_ad_id: metaAd.id, status: "paused", performance_json: {} });
      return json({ ok: true, meta: { campaign: metaCampaign, adset: metaAdset, creative: metaCreative, ad: metaAd } });
    }

    if (action === "metrics") {
      const campaignId = String(body.campaignId || "");
      const { data: campaign } = await serviceClient.from("marketing_campaigns").select("*, meta_connections(*)").eq("restaurant_id", user.id).eq("id", campaignId).single();
      if (!campaign?.meta_campaign_id) return json({ metrics: [] });
      const token = await decryptToken(campaign.meta_connections.access_token_encrypted);
      const insights = await graphGet(`${campaign.meta_campaign_id}/insights`, token, { fields: "date_start,impressions,reach,clicks,ctr,cpc,cpm,spend", time_increment: "1" });
      const rows = (insights?.data || []).map((item: any) => ({
        campaign_id: campaign.id,
        date: item.date_start,
        impressions: Number(item.impressions || 0),
        reach: Number(item.reach || 0),
        clicks: Number(item.clicks || 0),
        ctr: Number(item.ctr || 0),
        cpc: Number(item.cpc || 0),
        cpm: Number(item.cpm || 0),
        spend: Number(item.spend || 0),
      }));
      if (rows.length) await serviceClient.from("marketing_metrics").upsert(rows, { onConflict: "campaign_id,date" });
      return json({ metrics: rows });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error: any) {
    console.error("[meta-marketing]", error);
    return json({ error: error?.message || "Erro inesperado no PopMarketing AI." }, 500);
  }
});
