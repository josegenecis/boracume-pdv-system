const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gcfyrcpugmducptktjic.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

function escHtml(v: string) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeAbsoluteUrl(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `https://boracume.com${raw}`;
  return raw;
}

async function fetchProfile(userId: string) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  url.searchParams.set('select', 'restaurant_name,description,logo_url,banner_url');
  url.searchParams.set('id', `eq.${userId}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as any[];
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

function isCrawler(userAgent: string) {
  return /facebookexternalhit|facebot|whatsapp|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|googlebot|bingbot|meta-externalagent|meta-externalfetcher|skypeuripreview|crawler|spider|bot/i.test(userAgent);
}

export default async function handler(req: any, res: any) {
  try {
    const id = String(req?.query?.id || '').trim();
    if (!id) {
      res.statusCode = 400;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('missing id');
      return;
    }

    const redirectUrl = `/menu-digital?userId=${encodeURIComponent(id)}`;
    const userAgent = String(req?.headers?.['user-agent'] || '');
    if (!isCrawler(userAgent)) {
      res.statusCode = 307;
      res.setHeader('location', redirectUrl);
      res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=86400');
      res.end();
      return;
    }

    const profile = await fetchProfile(id).catch(() => null);
    const restaurantName = String(profile?.restaurant_name || 'Cardápio Digital');
    const description = String(profile?.description || 'Confira nosso cardápio digital.');
    const logoUrl = normalizeAbsoluteUrl(String(profile?.logo_url || profile?.banner_url || 'https://boracume.com/LOGOMARCA/logo-sistema.png'));
    const originalPath = String(req?.url || '').includes(`/menu/${id}`) ? `/menu/${encodeURIComponent(id)}` : `/share/menu/${encodeURIComponent(id)}`;
    const pageUrl = `https://boracume.com${originalPath}`;

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escHtml(restaurantName)}</title>
    <meta name="description" content="${escHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escHtml(restaurantName)}" />
    <meta property="og:description" content="${escHtml(description)}" />
    <meta property="og:image" content="${escHtml(logoUrl)}" />
    <meta property="og:image:secure_url" content="${escHtml(logoUrl)}" />
    <meta property="og:image:alt" content="${escHtml(`Logo do restaurante ${restaurantName}`)}" />
    <meta property="og:site_name" content="${escHtml(restaurantName)}" />
    <meta property="og:url" content="${escHtml(pageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escHtml(restaurantName)}" />
    <meta name="twitter:description" content="${escHtml(description)}" />
    <meta name="twitter:image" content="${escHtml(logoUrl)}" />
    <meta name="twitter:image:alt" content="${escHtml(`Logo do restaurante ${restaurantName}`)}" />
    <meta http-equiv="refresh" content="0; url=${escHtml(redirectUrl)}" />
  </head>
  <body>
    <script>location.replace(${JSON.stringify(redirectUrl)});</script>
    <noscript><a href="${escHtml(redirectUrl)}">Abrir cardápio</a></noscript>
  </body>
</html>`;

    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.end(html);
  } catch (e: any) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(e?.message || 'internal error');
  }
}
