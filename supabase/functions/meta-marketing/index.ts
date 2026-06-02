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
  if (!res.ok) {
    const metaError = payload?.error || {};
    throw new Error(`${metaError?.message || "Falha ao enviar para Meta."} (${path.replace(/^\/+/, "")}${metaError?.code ? `, code ${metaError.code}` : ""}${metaError?.error_subcode ? `, subcode ${metaError.error_subcode}` : ""})`);
  }
  return payload;
}

async function graphPostMultipart(path: string, token: string, form: FormData) {
  form.set("access_token", token);
  const res = await fetch(`${GRAPH_BASE}/${path.replace(/^\/+/, "")}`, {
    method: "POST",
    body: form,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const metaError = payload?.error || {};
    throw new Error(`${metaError?.message || "Falha ao enviar arquivo para Meta."} (${path.replace(/^\/+/, "")}${metaError?.code ? `, code ${metaError.code}` : ""}${metaError?.error_subcode ? `, subcode ${metaError.error_subcode}` : ""})`);
  }
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

function publicProductImageUrl(serviceClient: any, value?: string | null) {
  let raw = String(value || "").trim().replace(/^['"]+|['"]+$/g, "");
  if (!raw) return null;
  if (raw.startsWith("//")) raw = `https:${raw}`;
  if (raw.startsWith("http://")) raw = `https://${raw.slice("http://".length)}`;
  raw = raw.replace(/^https:\/\/https:\/\//, "https://");
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const path = raw.replace(/^\/+/, "").replace(/^product-images\//, "");
  const { data } = serviceClient.storage.from("product-images").getPublicUrl(path);
  return data?.publicUrl || raw;
}

async function isUsablePublicImage(url?: string | null) {
  const raw = String(url || "").trim();
  if (!/^https?:\/\//i.test(raw)) return false;
  try {
    const head = await fetch(raw, { method: "HEAD" });
    const headType = head.headers.get("content-type") || "";
    if (head.ok && headType.toLowerCase().startsWith("image/")) return true;
    const get = await fetch(raw, { headers: { Range: "bytes=0-2047" } });
    const getType = get.headers.get("content-type") || "";
    return get.ok && getType.toLowerCase().startsWith("image/");
  } catch {
    return false;
  }
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const creativeFormatConfig: Record<string, { label: string; size: string; width: number; height: number; aspect: string; placement: string[]; preset: string }> = {
  feed_1080x1080: {
    label: "Feed quadrado 1080x1080",
    size: "1024x1024",
    width: 1080,
    height: 1080,
    aspect: "quadrado 1:1",
    placement: ["facebook_feed", "instagram_feed"],
    preset: "feed_square",
  },
  story_1080x1920: {
    label: "Stories 1080x1920",
    size: "1024x1536",
    width: 1080,
    height: 1920,
    aspect: "vertical 9:16",
    placement: ["instagram_stories", "facebook_stories"],
    preset: "story_vertical",
  },
  reels_1080x1920: {
    label: "Reels 1080x1920",
    size: "1024x1536",
    width: 1080,
    height: 1920,
    aspect: "vertical 9:16",
    placement: ["instagram_reels"],
    preset: "reels_vertical",
  },
  banner_1200x628: {
    label: "Horizontal 1200x628",
    size: "1536x1024",
    width: 1200,
    height: 628,
    aspect: "horizontal",
    placement: ["facebook_feed"],
    preset: "facebook_horizontal",
  },
};

function normalizeSelectedFormats(value: unknown) {
  const allowed = new Set(Object.keys(creativeFormatConfig));
  const list = Array.isArray(value) ? value.map(String).filter((item) => allowed.has(item)) : [];
  return list.length ? [...new Set(list)] : ["feed_1080x1080", "story_1080x1920", "reels_1080x1920"];
}

function normalizeSelectedPlacements(formats: string[], value: unknown) {
  const allowed = new Set(["facebook_feed", "instagram_feed", "instagram_stories", "instagram_reels", "facebook_stories"]);
  const selected = Array.isArray(value) ? value.map(String).filter((item) => allowed.has(item)) : [];
  const fromFormats = formats.flatMap((format) => creativeFormatConfig[format]?.placement || []);
  return [...new Set(selected.length ? selected : fromFormats)];
}

async function fetchImageBlob(url?: string | null) {
  const raw = String(url || "").trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  const res = await fetch(raw);
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/png";
  if (!contentType.toLowerCase().startsWith("image/")) return null;
  return new Blob([await res.arrayBuffer()], { type: contentType });
}

function imageFilename(name: string, blob: Blob) {
  const type = blob.type.toLowerCase();
  const ext = type.includes("webp") ? "webp" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : "png";
  return `${name}.${ext}`;
}

function compactCreativeText(value: string, max = 34) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function objectiveLabel(value?: string | null) {
  const labels: Record<string, string> = {
    vender_mais: "vender mais pelo delivery",
    divulgar_promocao: "divulgar uma promocao",
    aumentar_pedidos: "aumentar pedidos no horario de movimento",
    recuperar_clientes: "recuperar clientes inativos",
  };
  return labels[String(value || "")] || "gerar pedidos";
}

function buildCreativePrompt(input: {
  restaurant_name: string;
  product_name: string;
  product_description?: string | null;
  price?: string | null;
  promotion?: string | null;
  cta?: string | null;
  brand_colors?: string | null;
  format: string;
  width: number;
  height: number;
  objective?: string | null;
  placement?: string | null;
  product_image_url?: string | null;
  logo_url?: string | null;
  headline?: string | null;
  notes?: string | null;
}) {
  const config = creativeFormatConfig[input.format] || creativeFormatConfig.feed_1080x1080;
  const isVertical = input.height > input.width;
  const hasProductImage = Boolean(input.product_image_url);
  const hasLogo = Boolean(input.logo_url);
  const priceLine = input.price ? `Preco/oferta: ${input.price}.` : "Sem preco informado: nao invente preco, use chamada de pedido.";
  const promotionLine = input.promotion ? `Promocao: ${input.promotion}.` : "Sem promocao informada: nao invente promocao.";
  const imageRule = hasProductImage
    ? "Imagem do produto: use obrigatoriamente a imagem real enviada como protagonista. Nao substitua por outro produto. Apenas melhore apresentacao, fundo, iluminacao, recorte, profundidade e acabamento comercial."
    : "Imagem do produto: nao ha foto real. Gere uma imagem comercial realista e apetitosa baseada no nome e descricao do produto, sem parecer banco de imagem generico.";
  const logoRule = hasLogo
    ? "Logo: use obrigatoriamente a logo enviada, sem distorcer, em tamanho discreto e limpo."
    : "Logo: nao invente logomarca. Use apenas o nome do restaurante em tipografia profissional.";
  const layoutRule = isVertical
    ? "Layout Story/Reels: produto grande no centro, chamada curta no topo, preco grande no meio ou abaixo do produto, CTA forte proximo ao rodape, margens seguras no topo e rodape para nao cortar texto no celular."
    : config.preset === "facebook_horizontal"
      ? "Layout horizontal: produto grande em um lado, chamada e preco do outro lado, CTA visivel, logo no canto, composicao equilibrada para Facebook Ads."
      : "Layout Feed: produto grande centralizado ou lateral, chamada principal no topo, preco em destaque, CTA na parte inferior, logo no canto superior.";

  return [
    "Crie uma arte publicitaria profissional para restaurante/delivery, pronta para Meta Ads.",
    `Preset: ${config.preset}.`,
    `Formato: ${config.label}.`,
    `Dimensao final: ${input.width}x${input.height}.`,
    `Posicionamento: ${input.placement || config.placement.join(", ")}.`,
    `Objetivo da campanha: ${objectiveLabel(input.objective)}.`,
    "",
    `Restaurante: ${input.restaurant_name}.`,
    `Produto principal: ${input.product_name}.`,
    input.product_description ? `Descricao do produto: ${input.product_description}.` : "Descricao do produto: nao informada.",
    priceLine,
    promotionLine,
    `CTA: ${input.cta || "Clique e faca seu pedido"}.`,
    `Cores da marca: ${input.brand_colors || "verde escuro, laranja vibrante, branco e tons apetitosos do produto"}.`,
    input.headline ? `Chamada principal curta: ${input.headline}.` : "",
    input.notes ? `Direcao extra do dono: ${input.notes}.` : "",
    "",
    logoRule,
    imageRule,
    layoutRule,
    "",
    "Regras de qualidade obrigatorias:",
    "- Nunca gerar imagem generica.",
    "- Produto como protagonista, grande e apetitoso.",
    "- Hierarquia visual clara: chamada principal, produto, preco/oferta, CTA, logo.",
    "- No maximo 3 blocos de texto na arte.",
    "- Texto grande, legivel no celular, sem corte e sem letras pequenas.",
    "- Area segura para texto, principalmente em Story/Reels.",
    "- Visual moderno, limpo, alto contraste, premium mas popular.",
    "- Fundo com textura leve, cenario ou degradê sofisticado; nunca template chapado verde padrao.",
    "- Sombras suaves e composicao equilibrada.",
    "- Nao poluir a peca, nao distorcer logo, nao distorcer produto.",
    "- Nao inventar preco, promocao ou promessa de resultado.",
    "",
    "Resultado esperado: imagem final de anuncio pago com aparencia de designer profissional de social media para restaurantes, pronta para conversao.",
  ].filter(Boolean).join("\n");
}

async function generateAiAdCreativeImage(params: {
  serviceClient: any;
  restaurantId: string;
  format: string;
  restaurantName: string;
  productName: string;
  productDescription?: string | null;
  priceLabel?: string | null;
  headline?: string | null;
  cta?: string | null;
  productImageUrl?: string | null;
  logoUrl?: string | null;
  notes?: string | null;
  objective?: string | null;
  placement?: string | null;
  promotion?: string | null;
  brandColors?: string | null;
}) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada para gerar criativos.");
  const config = creativeFormatConfig[params.format] || creativeFormatConfig.feed_1080x1080;
  const headline = compactCreativeText(params.headline || `${params.productName} em oferta`, 32);
  const price = compactCreativeText(params.priceLabel || "Peça agora", 18);
  const cta = compactCreativeText(params.cta || "PEÇA AGORA", 22);
  const prompt = buildCreativePrompt({
    restaurant_name: params.restaurantName,
    product_name: params.productName,
    product_description: params.productDescription,
    price,
    promotion: params.promotion,
    cta,
    brand_colors: params.brandColors,
    format: params.format,
    width: config.width,
    height: config.height,
    objective: params.objective,
    placement: params.placement,
    product_image_url: params.productImageUrl,
    logo_url: params.logoUrl,
    headline,
    notes: params.notes,
  });

  const productBlob = await fetchImageBlob(params.productImageUrl);
  const logoBlob = await fetchImageBlob(params.logoUrl);
  const envModel = Deno.env.get("OPENAI_IMAGE_MODEL");
  const modelCandidates = [...new Set([envModel || "gpt-image-1", "gpt-image-1-mini"])];
  let lastError: any = null;

  for (const model of modelCandidates) {
    try {
      let res: Response;
      if (productBlob || logoBlob) {
        const form = new FormData();
        form.set("model", model);
        form.set("prompt", prompt);
        form.set("size", config.size);
        form.set("quality", Deno.env.get("OPENAI_IMAGE_QUALITY") || "medium");
        form.set("background", "opaque");
        form.set("output_format", "png");
        if (productBlob && model === "gpt-image-1") form.set("input_fidelity", "high");
        if (productBlob) form.append("image[]", productBlob, imageFilename("produto", productBlob));
        if (logoBlob) form.append("image[]", logoBlob, imageFilename("logo", logoBlob));
        res = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
      } else {
        res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            prompt,
            size: config.size,
            quality: Deno.env.get("OPENAI_IMAGE_QUALITY") || "medium",
            background: "opaque",
            output_format: "png",
            n: 1,
          }),
        });
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error?.message || "Falha ao gerar criativo IA.");
      const item = payload?.data?.[0] || {};
      if (item.b64_json) {
        return uploadMarketingImage(params.serviceClient, params.restaurantId, bytesFromBase64(String(item.b64_json)), "image/png");
      }
      if (item.url) {
        const imageRes = await fetch(String(item.url));
        if (!imageRes.ok) throw new Error("Falha ao baixar criativo IA.");
        const contentType = imageRes.headers.get("content-type") || "image/png";
        return uploadMarketingImage(params.serviceClient, params.restaurantId, new Uint8Array(await imageRes.arrayBuffer()), contentType);
      }
      throw new Error("OpenAI não retornou uma imagem utilizável.");
    } catch (error) {
      lastError = error;
      console.error("marketing_ai_ad_creative_failed", model, params.format, error);
    }
  }
  throw lastError || new Error("Falha ao gerar criativo IA.");
}

async function uploadMetaAdImage(adAccountId: string, token: string, imageUrl?: string | null) {
  const blob = await fetchImageBlob(imageUrl);
  if (!blob) return null;
  const form = new FormData();
  form.append("filename", blob, imageFilename("popmarketing-ai", blob));
  const payload = await graphPostMultipart(`${adAccountId}/adimages`, token, form);
  const images = payload?.images || {};
  const first = Object.values(images)[0] as any;
  return first?.hash || null;
}

async function geocodeRestaurantAddress(address?: string | null, city?: string | null) {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  const query = [address, city, "Brasil"].filter(Boolean).join(", ");
  if (!apiKey || !query.trim()) return null;
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("region", "br");
    const res = await fetch(url);
    const payload = await res.json().catch(() => ({}));
    const location = payload?.results?.[0]?.geometry?.location;
    if (!res.ok || payload?.status !== "OK" || !location) return null;
    return {
      lat: Number(location.lat),
      lng: Number(location.lng),
      formatted_address: String(payload?.results?.[0]?.formatted_address || query),
    };
  } catch (error) {
    console.error("marketing_geocode_failed", error);
    return null;
  }
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
  if (restaurant) {
    restaurant.logo_url = publicProductImageUrl(serviceClient, restaurant.logo_url);
    restaurant.banner_url = publicProductImageUrl(serviceClient, restaurant.banner_url);
  }
  let product: any = null;
  if (input.productId) {
    const { data } = await serviceClient.from("products").select("id,name,description,price,category,image_url,available").eq("user_id", restaurantId).eq("id", input.productId).maybeSingle();
    product = data;
  }
  if (!product && input.productFocus) {
    const { data } = await serviceClient.from("products").select("id,name,description,price,category,image_url,available").eq("user_id", restaurantId).ilike("name", `%${input.productFocus}%`).eq("available", true).limit(1);
    product = data?.[0] || null;
  }
  if (product) {
    const rawImageUrl = product.image_url;
    const normalizedImageUrl = publicProductImageUrl(serviceClient, rawImageUrl);
    product.original_image_url = rawImageUrl || null;
    product.image_url = await isUsablePublicImage(normalizedImageUrl) ? normalizedImageUrl : null;
    product.image_status = product.image_url ? "valid" : normalizedImageUrl ? "broken" : "missing";
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
  const selectedFormats = normalizeSelectedFormats(input.selectedFormats);
  const selectedPlacements = normalizeSelectedPlacements(selectedFormats, input.selectedPlacements);
  const generatedImagePrompt = `Crie uma arte final publicitária completa e pronta para Meta Ads.
Produto: ${productFocus}.
Descrição: ${knowledge.product?.description || input.notes || "produto do cardápio"}.
Restaurante: ${knowledge.restaurant?.restaurant_name || "PopSystem"}.
A arte deve conter produto, copy curta, preço quando disponível, CTA e identidade visual profissional.`;
  const restaurantLocation = await geocodeRestaurantAddress(knowledge.restaurant?.address, input.targetCity);
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
      origin: restaurantLocation,
      age_min: 18,
      age_max: 55,
      interests: ["delivery", "restaurantes", "comida", productFocus],
    },
    placements: selectedPlacements,
    formats: selectedFormats,
    budget: { daily: dailyBudget, recommended_daily: Math.max(dailyBudget, 20) },
    safety: [
      "Campanha será criada pausada para revisão.",
      "Sem promessa de resultado garantido.",
      "Preço e disponibilidade validados pelo cardápio.",
    ],
    product: knowledge.product,
    media: {
      product_image_url: knowledge.product?.image_url || null,
      product_image_status: knowledge.product?.image_status || "not_selected",
      generated_image_url: null,
      generated_image_prompt: generatedImagePrompt,
      final_image_source: "ai_ad_creative",
    },
    menu_link: knowledge.menuLink,
  };
  const creatives = await Promise.all(selectedFormats.map(async (format) => {
    const headline = copies[0]?.headline || `${productFocus} no ${knowledge.restaurant?.restaurant_name || "PopSystem"}`;
    const primaryText = copies[0]?.primary_text || `Peça ${productFocus} agora.`;
    const description = copies[0]?.description || "Campanha criada com IA para revisão.";
    const price = knowledge.product?.price ? `R$ ${Number(knowledge.product.price).toFixed(2).replace(".", ",")}` : "";
    const placement = (creativeFormatConfig[format]?.placement || []).filter((item) => selectedPlacements.includes(item)).join(", ");
    const finalImageUrl = await generateAiAdCreativeImage({
      serviceClient,
      restaurantId,
      format,
      restaurantName: knowledge.restaurant?.restaurant_name || "PopSystem",
      productName: productFocus,
      productDescription: knowledge.product?.description || input.notes || "",
      priceLabel: price,
      headline,
      cta: destination === "whatsapp" ? "Chame no WhatsApp" : "Peça agora",
      notes: input.notes || "",
      productImageUrl: knowledge.product?.image_url || null,
      logoUrl: knowledge.restaurant?.logo_url || null,
      objective: input.objective || "vender_mais",
      placement,
      promotion: input.promotion || input.notes || null,
      brandColors: input.brandColors || "verde escuro, laranja PopSystem, branco, cores naturais do produto",
    });
    if (!finalImageUrl) throw new Error(`A IA não retornou imagem final para o formato ${creativeFormatConfig[format]?.label || format}.`);
    return {
      format,
      type: "ai_ad_creative",
      image_url: finalImageUrl,
      logo_url: knowledge.restaurant?.logo_url || null,
      generated_image_prompt: `${generatedImagePrompt}\nFormato: ${creativeFormatConfig[format]?.label || format}.`,
      image_error: null,
      headline,
      primary_text: primaryText,
      description,
      cta: destination === "whatsapp" ? "WHATSAPP_MESSAGE" : "ORDER_NOW",
    };
  }));
  if (creatives.length !== selectedFormats.length || creatives.some((creative) => !creative.image_url)) {
    throw new Error("Não foi possível gerar todos os criativos finais por IA. Tente novamente ou confira a chave OPENAI_API_KEY.");
  }
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
        objective: "OUTCOME_TRAFFIC",
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
      const copyIndex = Math.max(0, Number(body.copyIndex || 0));
      const { data: campaign } = await serviceClient.from("marketing_campaigns").select("*, meta_connections(*)").eq("restaurant_id", user.id).eq("id", campaignId).single();
      if (!campaign?.id) return json({ error: "Campanha não encontrada." }, 404);
      const conn = campaign.meta_connections;
      if (!conn?.access_token_encrypted || !conn?.ad_account_id || !conn?.page_id) return json({ error: "Conecte uma conta Meta com conta de anúncio e página antes de publicar." }, 400);
      const token = await decryptToken(conn.access_token_encrypted);
      const adAccountId = normalizeAdAccountId(conn.ad_account_id);
      const radiusKm = Math.max(1, Number(campaign.target_radius_km || campaign.ai_strategy?.audience?.radius_km || 5));
      const origin = campaign.ai_strategy?.audience?.origin;
      const geoLocations = origin?.lat && origin?.lng
        ? { custom_locations: [{ latitude: Number(origin.lat), longitude: Number(origin.lng), radius: radiusKm, distance_unit: "kilometer" }] }
        : { countries: ["BR"] };
      const copies = Array.isArray(campaign.ai_strategy?.copies) ? campaign.ai_strategy.copies : [];
      const selectedCopy = copies[copyIndex] || copies[0] || {};
      const { data: creativeRows } = await serviceClient
        .from("marketing_creatives")
        .select("*")
        .eq("campaign_id", campaign.id);
      const creativeRow = (creativeRows || []).find((item: any) => item.format === "feed_1080x1080" && item.image_url)
        || (creativeRows || []).find((item: any) => item.image_url);
      if (!creativeRow?.image_url) {
        return json({ error: "Gere um criativo final com imagem antes de publicar." }, 400);
      }
      const imageHash = await uploadMetaAdImage(adAccountId, token, creativeRow.image_url);
      if (!imageHash) {
        return json({ error: "A Meta não retornou o hash da imagem. Gere o criativo novamente e tente publicar." }, 400);
      }
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
        optimization_goal: "LINK_CLICKS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        destination_type: "WEBSITE",
        targeting: { geo_locations: geoLocations, age_min: 18, age_max: 55 },
        status: "PAUSED",
      });
      const link = campaign.menu_link || `${baseUrl()}/share/menu/${user.id}`;
      const linkData: Record<string, any> = {
        link,
        message: selectedCopy?.primary_text || creativeRow?.primary_text || "Clique e faça seu pedido.",
        name: selectedCopy?.headline || creativeRow?.headline || campaign.name,
        description: selectedCopy?.description || creativeRow?.description || "Campanha PopMarketing AI",
        call_to_action: { type: "LEARN_MORE", value: { link } },
        image_hash: imageHash,
      };
      const metaCreative = await graphPost(`${adAccountId}/adcreatives`, token, {
        name: `${campaign.name} - Criativo IA`,
        object_story_spec: {
          page_id: conn.page_id,
          link_data: linkData,
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
    return json({ error: error?.message || "Erro inesperado no PopMarketing AI." }, 200);
  }
});
