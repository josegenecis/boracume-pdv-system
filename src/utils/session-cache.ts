import { Session, User } from '@supabase/supabase-js';
import { Profile, Subscription } from '@/contexts/AuthContext';

// Chaves para localStorage
const CACHE_KEYS = {
  SESSION: 'boracume_session_cache',
  USER: 'boracume_user_cache',
  PROFILE: 'boracume_profile_cache',
  SUBSCRIPTION: 'boracume_subscription_cache',
  LAST_SYNC: 'boracume_last_sync',
  TOKEN_REFRESH: 'boracume_token_refresh'
} as const;

// Tempo de cache em milissegundos (5 minutos)
const CACHE_DURATION = 5 * 60 * 1000;

// Interface para dados em cache
interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Verifica se os dados em cache ainda são válidos
 */
const isCacheValid = (cachedItem: CachedData<any> | null): boolean => {
  if (!cachedItem) return false;
  return Date.now() < cachedItem.expiresAt;
};

/**
 * Cria um objeto de cache com timestamp
 */
const createCacheItem = <T>(data: T): CachedData<T> => {
  const now = Date.now();
  return {
    data,
    timestamp: now,
    expiresAt: now + CACHE_DURATION
  };
};

/**
 * Cache de sessão
 */
export const SessionCache = {
  // Salvar sessão no cache
  setSession: (session: Session | null): void => {
    try {
      if (session) {
        const cacheItem = createCacheItem(session);
        localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(cacheItem));
        console.log('💾 Sessão salva no cache');
      } else {
        localStorage.removeItem(CACHE_KEYS.SESSION);
        console.log('🗑️ Cache de sessão removido');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar sessão no cache:', error);
    }
  },

  // Obter sessão do cache
  getSession: (): Session | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.SESSION);
      if (!cached) return null;

      const cacheItem: CachedData<Session> = JSON.parse(cached);
      
      if (isCacheValid(cacheItem)) {
        console.log('📦 Sessão recuperada do cache');
        return cacheItem.data;
      } else {
        console.log('⏰ Cache de sessão expirado');
        localStorage.removeItem(CACHE_KEYS.SESSION);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao recuperar sessão do cache:', error);
      localStorage.removeItem(CACHE_KEYS.SESSION);
      return null;
    }
  },

  // Verificar se a sessão em cache é válida
  isSessionCacheValid: (): boolean => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.SESSION);
      if (!cached) return false;

      const cacheItem: CachedData<Session> = JSON.parse(cached);
      return isCacheValid(cacheItem);
    } catch {
      return false;
    }
  }
};

/**
 * Cache de usuário
 */
export const UserCache = {
  setUser: (user: User | null): void => {
    try {
      if (user) {
        const cacheItem = createCacheItem(user);
        localStorage.setItem(CACHE_KEYS.USER, JSON.stringify(cacheItem));
        console.log('💾 Usuário salvo no cache');
      } else {
        localStorage.removeItem(CACHE_KEYS.USER);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar usuário no cache:', error);
    }
  },

  getUser: (): User | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.USER);
      if (!cached) return null;

      const cacheItem: CachedData<User> = JSON.parse(cached);
      
      if (isCacheValid(cacheItem)) {
        console.log('📦 Usuário recuperado do cache');
        return cacheItem.data;
      } else {
        localStorage.removeItem(CACHE_KEYS.USER);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao recuperar usuário do cache:', error);
      localStorage.removeItem(CACHE_KEYS.USER);
      return null;
    }
  }
};

/**
 * Cache de perfil
 */
export const ProfileCache = {
  setProfile: (profile: Profile | null): void => {
    try {
      if (profile) {
        const cacheItem = createCacheItem(profile);
        localStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(cacheItem));
        console.log('💾 Perfil salvo no cache');
      } else {
        localStorage.removeItem(CACHE_KEYS.PROFILE);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar perfil no cache:', error);
    }
  },

  getProfile: (): Profile | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.PROFILE);
      if (!cached) return null;

      const cacheItem: CachedData<Profile> = JSON.parse(cached);
      
      if (isCacheValid(cacheItem)) {
        console.log('📦 Perfil recuperado do cache');
        return cacheItem.data;
      } else {
        localStorage.removeItem(CACHE_KEYS.PROFILE);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao recuperar perfil do cache:', error);
      localStorage.removeItem(CACHE_KEYS.PROFILE);
      return null;
    }
  }
};

/**
 * Cache de assinatura
 */
export const SubscriptionCache = {
  setSubscription: (subscription: Subscription | null): void => {
    try {
      if (subscription) {
        const cacheItem = createCacheItem(subscription);
        localStorage.setItem(CACHE_KEYS.SUBSCRIPTION, JSON.stringify(cacheItem));
        console.log('💾 Assinatura salva no cache');
      } else {
        localStorage.removeItem(CACHE_KEYS.SUBSCRIPTION);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar assinatura no cache:', error);
    }
  },

  getSubscription: (): Subscription | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEYS.SUBSCRIPTION);
      if (!cached) return null;

      const cacheItem: CachedData<Subscription> = JSON.parse(cached);
      
      if (isCacheValid(cacheItem)) {
        console.log('📦 Assinatura recuperada do cache');
        return cacheItem.data;
      } else {
        localStorage.removeItem(CACHE_KEYS.SUBSCRIPTION);
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao recuperar assinatura do cache:', error);
      localStorage.removeItem(CACHE_KEYS.SUBSCRIPTION);
      return null;
    }
  }
};

/**
 * Controle de sincronização
 */
export const SyncCache = {
  setLastSync: (): void => {
    try {
      localStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error('❌ Erro ao salvar timestamp de sincronização:', error);
    }
  },

  getLastSync: (): number => {
    try {
      const lastSync = localStorage.getItem(CACHE_KEYS.LAST_SYNC);
      return lastSync ? parseInt(lastSync, 10) : 0;
    } catch {
      return 0;
    }
  },

  shouldSync: (intervalMs: number = CACHE_DURATION): boolean => {
    const lastSync = SyncCache.getLastSync();
    return Date.now() - lastSync > intervalMs;
  }
};

/**
 * Controle de refresh de token
 */
export const TokenRefreshCache = {
  setTokenRefresh: (timestamp: number): void => {
    try {
      localStorage.setItem(CACHE_KEYS.TOKEN_REFRESH, timestamp.toString());
    } catch (error) {
      console.error('❌ Erro ao salvar timestamp de refresh:', error);
    }
  },

  getTokenRefresh: (): number => {
    try {
      const refresh = localStorage.getItem(CACHE_KEYS.TOKEN_REFRESH);
      return refresh ? parseInt(refresh, 10) : 0;
    } catch {
      return 0;
    }
  },

  shouldRefreshToken: (session: Session | null): boolean => {
    if (!session?.expires_at) return false;
    
    const expiresAt = session.expires_at * 1000; // Converter para ms
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    // Refresh se faltam menos de 5 minutos para expirar
    return timeUntilExpiry < 5 * 60 * 1000;
  }
};

/**
 * Limpar todo o cache
 */
export const clearAllCache = (): void => {
  try {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🧹 Todo o cache foi limpo');
  } catch (error) {
    console.error('❌ Erro ao limpar cache:', error);
  }
};

/**
 * Obter informações do cache
 */
export const getCacheInfo = () => {
  const info = {
    session: SessionCache.isSessionCacheValid(),
    lastSync: SyncCache.getLastSync(),
    cacheSize: 0
  };

  try {
    // Calcular tamanho aproximado do cache
    let totalSize = 0;
    Object.values(CACHE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length;
      }
    });
    info.cacheSize = totalSize;
  } catch (error) {
    console.error('❌ Erro ao calcular tamanho do cache:', error);
  }

  return info;
};