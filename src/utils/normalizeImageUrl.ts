export function normalizeImageUrlForDisplay(value?: string | null): string {
  let v = String(value ?? '').trim();
  if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') return '';

  v = v.replace(/^['"]+|['"]+$/g, '').trim();
  if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') return '';

  if (v.startsWith('//')) v = `https:${v}`;
  if (v.startsWith('http://')) v = `https://${v.slice('http://'.length)}`;
  v = v.replace(/^https:\/\/https:\/\//, 'https://');

  if (v.startsWith('https://') || v.startsWith('data:') || v.startsWith('blob:')) {
    return v;
  }

  if (v.includes('ifood-static.com.br') || v.includes('ifood-static.com')) return `https://${v}`;
  if (v.includes('storage.googleapis.com')) return `https://${v}`;

  try {
    return new URL(v).toString();
  } catch {
    try {
      const encoded = encodeURI(v);
      return new URL(encoded).toString();
    } catch {
      return '';
    }
  }
}

