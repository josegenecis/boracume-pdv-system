const fallbackUrl = 'https://gcfyrcpugmducptktjic.supabase.co';
const fallbackAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? fallbackUrl,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? fallbackAnonKey,
};
