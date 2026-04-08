import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'boracume-garcom-mobile',
    },
  },
});
