export function normalizeImageUrlForDisplay(value?: string | null): string {
  let v = String(value ?? '').trim();
  if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') return '';

  v = v.replace(/^['"]+|['"]+$/g, '').trim();
  if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') return '';

  if (v.startsWith('data:') || v.startsWith('blob:')) return v;
  if (v.startsWith('//')) v = `https:${v}`;
  if (v.startsWith('http://')) v = `https://${v.slice('http://'.length)}`;
  v = v.replace(/^https:\/\/https:\/\//, 'https://');

  if (v.startsWith('https://')) {
    try {
      return new URL(encodeURI(v)).toString();
    } catch {
      return encodeURI(v);
    }
  }

  if (
    v.includes('ifood-static.com.br') ||
    v.includes('ifood-static.com') ||
    v.includes('storage.googleapis.com') ||
    v.includes('/storage/v1/object/')
  ) {
    const withProtocol = `https://${v.replace(/^\/+/, '')}`;
    try {
      return new URL(encodeURI(withProtocol)).toString();
    } catch {
      return encodeURI(withProtocol);
    }
  }

  try {
    return new URL(encodeURI(v)).toString();
  } catch {
    try {
      if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(v)) {
        return new URL(encodeURI(`https://${v.replace(/^\/+/, '')}`)).toString();
      }
      return new URL(v).toString();
    } catch {
      return '';
    }
  }
}
