import { supabase } from '@/integrations/supabase/client';

type MetaActionPayload = Record<string, unknown> & { action: string };

export async function callPopMarketingAI<T = any>(payload: MetaActionPayload): Promise<T> {
  const { data, error } = await supabase.functions.invoke('meta-marketing', {
    body: payload,
  });

  if (error) {
    const context = (error as any)?.context;
    if (context?.json) {
      try {
        const json = await context.clone?.().json?.() || await context.json();
        if (json?.error) throw new Error(String(json.error));
      } catch (parseError: any) {
        if (parseError?.message) throw parseError;
      }
    }
    if (context instanceof Response && !context.bodyUsed) {
      try {
        const json = await context.clone().json();
        if (json?.error) throw new Error(String(json.error));
      } catch {
        const text = await context.clone().text().catch(() => '');
        if (text) throw new Error(text);
      }
    }
    if (String(error.message || '').includes('Failed to send a request')) {
      throw new Error('A geração demorou ou a Edge Function não respondeu. Tente gerar novamente com menos formatos ou confira os logs da função meta-marketing.');
    }
    throw error;
  }
  if ((data as any)?.error) throw new Error(String((data as any).error));
  return data as T;
}

export function buildCreativeSvgDataUrl(params: {
  format: 'feed_1080x1080' | 'story_1080x1920' | 'reels_1080x1920' | 'banner_1200x628';
  restaurantName: string;
  productName: string;
  price?: string;
  headline?: string;
  cta?: string;
  imageUrl?: string | null;
  logoUrl?: string | null;
  generatedImagePrompt?: string | null;
}) {
  const size = {
    feed_1080x1080: [1080, 1080],
    story_1080x1920: [1080, 1920],
    reels_1080x1920: [1080, 1920],
    banner_1200x628: [1200, 628],
  }[params.format];
  const [width, height] = size;
  const safe = (value: string) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
  const isTall = height > width;
  const hasProductImage = Boolean(params.imageUrl);
  const hasLogo = Boolean(params.logoUrl);
  const titleY = isTall ? 870 : 235;
  const productY = isTall ? 1015 : 335;
  const priceY = isTall ? 1135 : 428;
  const ctaY = height - (isTall ? 280 : 72);
  const imageX = isTall ? width * 0.12 : width * 0.58;
  const imageY = isTall ? 250 : 96;
  const imageW = isTall ? width * 0.76 : width * 0.34;
  const imageH = isTall ? 500 : height * 0.54;
  const fallbackFoodLabel = safe(params.productName).slice(0, 22);
  const logoBlock = hasLogo
    ? `<image href="${safe(params.logoUrl || '')}" x="${width * 0.08}" y="${isTall ? 82 : 56}" width="${isTall ? 230 : 180}" height="${isTall ? 92 : 72}" preserveAspectRatio="xMinYMid meet"/>`
    : `<text x="${width * 0.08}" y="${isTall ? 150 : 105}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 58 : 42}" font-weight="800">${safe(params.restaurantName)}</text>`;
  const productImage = hasProductImage
    ? `<clipPath id="productClip"><rect x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" rx="${isTall ? 54 : 38}"/></clipPath>
  <rect x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" rx="${isTall ? 54 : 38}" fill="#ffffff" opacity="0.94" filter="url(#shadow)"/>
  <image href="${safe(params.imageUrl || '')}" x="${imageX}" y="${imageY}" width="${imageW}" height="${imageH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#productClip)"/>`
    : `<g transform="translate(${imageX} ${imageY})" filter="url(#shadow)">
  <rect width="${imageW}" height="${imageH}" rx="${isTall ? 54 : 38}" fill="#fff7ed"/>
  <circle cx="${imageW * 0.52}" cy="${imageH * 0.48}" r="${Math.min(imageW, imageH) * 0.28}" fill="#7c2d12" opacity="0.16"/>
  <circle cx="${imageW * 0.5}" cy="${imageH * 0.46}" r="${Math.min(imageW, imageH) * 0.22}" fill="#ff5a00" opacity="0.88"/>
  <circle cx="${imageW * 0.43}" cy="${imageH * 0.37}" r="${Math.min(imageW, imageH) * 0.035}" fill="#ffffff" opacity="0.92"/>
  <circle cx="${imageW * 0.58}" cy="${imageH * 0.4}" r="${Math.min(imageW, imageH) * 0.032}" fill="#ffffff" opacity="0.86"/>
  <path d="M ${imageW * 0.32} ${imageH * 0.72} C ${imageW * 0.45} ${imageH * 0.82}, ${imageW * 0.68} ${imageH * 0.81}, ${imageW * 0.78} ${imageH * 0.69}" stroke="#064e3b" stroke-width="${isTall ? 16 : 10}" fill="none" stroke-linecap="round"/>
  <text x="${imageW * 0.5}" y="${imageH * 0.9}" text-anchor="middle" fill="#064e3b" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 38 : 28}" font-weight="900">${fallbackFoodLabel}</text>
</g>`;
  const promptBadge = !hasProductImage && params.generatedImagePrompt
    ? `<text x="${width * 0.08}" y="${ctaY + (isTall ? 118 : 62)}" fill="#ffffff" opacity="0.72" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 26 : 18}" font-weight="700">Imagem IA sugerida com base no produto</text>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#003223"/>
      <stop offset="0.55" stop-color="#065f46"/>
      <stop offset="1" stop-color="#ff5a00"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#001b12" flood-opacity="0.35"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="${width * 0.86}" cy="${height * 0.12}" r="${Math.min(width, height) * 0.22}" fill="#ffffff" opacity="0.10"/>
  <circle cx="${width * 0.15}" cy="${height * 0.88}" r="${Math.min(width, height) * 0.18}" fill="#ffffff" opacity="0.08"/>
  ${logoBlock}
  ${productImage}
  <text x="${width * 0.08}" y="${titleY}" fill="#d9ff99" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 58 : 42}" font-weight="700">${safe(params.headline || 'Oferta especial')}</text>
  <text x="${width * 0.08}" y="${productY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 88 : 64}" font-weight="900">${safe(params.productName).slice(0, 28)}</text>
  <text x="${width * 0.08}" y="${priceY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 112 : 74}" font-weight="900">${safe(params.price || 'Peça agora')}</text>
  <rect x="${width * 0.08}" y="${ctaY - 72}" width="${width * 0.58}" height="${isTall ? 132 : 96}" rx="44" fill="#ff5a00" filter="url(#shadow)"/>
  <text x="${width * 0.12}" y="${ctaY + (isTall ? 12 : -8)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 52 : 36}" font-weight="900">${safe(params.cta || 'CLIQUE E PEÇA')}</text>
  ${promptBadge}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
