
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const requiredEnvironmentVariable = (name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY') => {
  const value = import.meta.env[name]?.trim();

  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }

  return value;
};

export const SUPABASE_URL = requiredEnvironmentVariable('VITE_SUPABASE_URL');
export const SUPABASE_PUBLISHABLE_KEY = requiredEnvironmentVariable('VITE_SUPABASE_ANON_KEY');

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    detectSessionInUrl: true

  },
  realtime: {
    params: {
      eventsPerSecond: 50
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'boracume-app'
    },
    fetch: (url, options: any = {}) => {
      return fetch(url, {
        ...options,
        signal: options.signal || ((AbortSignal as any).timeout ? (AbortSignal as any).timeout(30000) : undefined),
      });
    }
  },
  db: {
    schema: 'public'

  }
});
