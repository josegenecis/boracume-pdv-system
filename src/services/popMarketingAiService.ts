import { supabase } from '@/integrations/supabase/client';

type MetaActionPayload = Record<string, unknown> & { action: string };

export async function callPopMarketingAI<T = any>(payload: MetaActionPayload): Promise<T> {
  const { data, error } = await supabase.functions.invoke('meta-marketing', {
    body: payload,
  });

  if (error) throw error;
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
  const titleY = isTall ? 560 : 230;
  const productY = isTall ? 760 : 340;
  const priceY = isTall ? 930 : 445;
  const ctaY = height - (isTall ? 280 : 120);
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
  <text x="${width * 0.08}" y="${isTall ? 190 : 105}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 58 : 42}" font-weight="800">${safe(params.restaurantName)}</text>
  <text x="${width * 0.08}" y="${titleY}" fill="#d9ff99" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 58 : 42}" font-weight="700">${safe(params.headline || 'Oferta especial')}</text>
  <text x="${width * 0.08}" y="${productY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 88 : 64}" font-weight="900">${safe(params.productName).slice(0, 28)}</text>
  <text x="${width * 0.08}" y="${priceY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 112 : 74}" font-weight="900">${safe(params.price || 'Peça agora')}</text>
  <rect x="${width * 0.08}" y="${ctaY - 72}" width="${width * 0.58}" height="${isTall ? 132 : 96}" rx="44" fill="#ff5a00" filter="url(#shadow)"/>
  <text x="${width * 0.12}" y="${ctaY + (isTall ? 12 : -8)}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${isTall ? 52 : 36}" font-weight="900">${safe(params.cta || 'CLIQUE E PEÇA')}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
