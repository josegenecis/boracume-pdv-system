function required(name: string, value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Variavel obrigatoria ausente: ${name}`);
  return normalized;
}

export function getSupabaseRuntimeEnv() {
  return {
    url: required('SUPABASE_URL', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    anonKey: required(
      'SUPABASE_ANON_KEY',
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    ),
  };
}

export function getPublicWebBaseUrl() {
  const value = required(
    'PUBLIC_WEB_BASE_URL',
    process.env.PUBLIC_WEB_BASE_URL || process.env.VITE_PUBLIC_WEB_BASE_URL || process.env.VERCEL_URL,
  );
  return (/^https?:\/\//i.test(value) ? value : `https://${value}`).replace(/\/+$/, '');
}
