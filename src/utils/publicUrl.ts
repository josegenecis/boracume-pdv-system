function normalizeBase(base: string) {
  return base.replace(/\/+$/, '');
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getPublicWebBaseUrl() {
  try {
    const fromStorage = (localStorage.getItem('boracume_public_web_base_url') || '').trim();
    if (fromStorage && isHttpUrl(fromStorage)) return normalizeBase(fromStorage);
  } catch {}

  try {
    const fromEnv = String((import.meta as any)?.env?.VITE_PUBLIC_WEB_BASE_URL || '').trim();
    if (fromEnv && isHttpUrl(fromEnv)) return normalizeBase(fromEnv);
  } catch {}

  try {
    if (window.location.protocol !== 'file:') return window.location.origin;
  } catch {}

  return 'https://boracume.com';
}

export function buildPublicMenuUrl(userId: string) {
  const id = String(userId || '').trim();
  if (!id) return '';
  const base = getPublicWebBaseUrl();
  return new URL(`/menu/${id}`, base).toString();
}

export function buildPublicMenuShareUrl(userId: string) {
  const id = String(userId || '').trim();
  if (!id) return '';
  const base = getPublicWebBaseUrl();
  return new URL(`/share/menu/${id}`, base).toString();
}

export function buildPublicTrackShareUrl(orderId: string, opts?: { userId?: string; orderNumber?: string }) {
  const id = String(orderId || '').trim();
  if (!id) return '';
  const base = getPublicWebBaseUrl();
  const url = new URL(`/share/track/${id}`, base);
  const userId = String(opts?.userId || '').trim();
  const orderNumber = String(opts?.orderNumber || '').trim();
  if (userId) url.searchParams.set('u', userId);
  if (orderNumber) url.searchParams.set('n', orderNumber);
  return url.toString();
}

