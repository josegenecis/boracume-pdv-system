import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './client';

/**
 * Cliente sem sessão para páginas públicas, como o cardápio digital.
 *
 * Uma sessão administrativa presente no mesmo navegador não pode alterar o
 * conteúdo público que está sendo consultado para outro restaurante.
 */
export const publicSupabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'popsystem-public-menu',
      },
      fetch: (url, options: RequestInit = {}) => fetch(url, {
        ...options,
        signal: options.signal || (AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined),
      }),
    },
    db: {
      schema: 'public',
    },
  },
);
