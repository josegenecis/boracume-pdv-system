import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logSecurityEvent, logSignupEvent } from '@/utils/securityLogger';
import { debugLogger } from '@/utils/debugLogger';
import { debugSystem, measurePerformance, debugLog } from '@/utils/debugSystem';

import { 
  SessionCache, 
  UserCache, 
  ProfileCache, 
  SubscriptionCache, 
  SyncCache, 
  clearAllCache 
} from '@/utils/session-cache';
import { logOAuthSessionCreated, logOAuthSessionDestroyed, logOAuthUserSync } from '../utils/oauth-security-logger';
import { validateOAuthUser, validateProfileData } from '@/utils/oauth-validation';
import { preloadByContext, backgroundPreload } from '@/utils/user-preloader';
import { startTokenAutoRefresh, stopTokenAutoRefresh, checkAndRefreshToken } from '@/utils/token-refresh';


interface Profile {
  id: string;
  restaurant_name?: string;
  description?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  logo_url?: string;
  delivery_fee?: number;
  minimum_order?: number;
  onboarding_completed?: boolean;
  email?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  plan_id?: number;
  trial_start?: string;
  trial_end?: string;
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  loading: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, restaurantName: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncGoogleUserData: (googleUser: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Circuit breaker para evitar múltiplas inicializações
let initializationInProgress = false;
let initializationPromise: Promise<void> | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Refs para controle de debounce e cleanup
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authSubscriptionRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastInitTimeRef = useRef<number>(0);

  useEffect(() => {
    debugLogger.auth('provider_mounted', { timestamp: Date.now() });
    
    // Evitar múltiplas inicializações muito próximas - REDUZIDO para 100ms
    const now = Date.now();
    if (now - lastInitTimeRef.current < 100) {
      debugLogger.auth('initialization_debounced', { 
        timeSinceLastInit: now - lastInitTimeRef.current,
        delay: 100 
      }, 'warn');
      
      // Debounce REDUZIDO para 100ms
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      
      initTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && !initializationInProgress) {
          initializeAuth();
        }
      }, 100);
      return;
    }
    
    lastInitTimeRef.current = now;
    
    // Inicialização imediata sem debounce desnecessário
    if (isMountedRef.current && !initializationInProgress) {
      initializeAuth();
    }

    return () => {
      debugLogger.auth('provider_cleanup', { timestamp: Date.now() });
      isMountedRef.current = false;
      
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.data.subscription.unsubscribe();
      }
      
      stopTokenAutoRefresh();
    };
  }, []); // Dependências vazias - executar apenas uma vez

  useEffect(() => {
    const onFocus = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const s = data?.session;
        if (!s) return;
        const exp = Number((s as any).expires_at || 0);
        const now = Math.floor(Date.now() / 1000);
        if (exp && exp - now > 120) return;
        const refreshed = await supabase.auth.refreshSession();
        const next = refreshed?.data?.session;
        if (next?.user && isMountedRef.current) {
          setUser(next.user);
          setSession(next);
        }
      } catch {}
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void onFocus();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const initializeAuth = async () => {
    const performanceTracker = measurePerformance('AuthContext', 'initializeAuth');
    
    // Circuit breaker - evitar múltiplas inicializações simultâneas
    if (initializationInProgress) {
      debugLog('AuthContext', 'initialization_blocked', { 
        hasPromise: !!initializationPromise,
        reason: 'already_in_progress'
      });
      debugLogger.auth('initialization_already_in_progress', { 
        hasPromise: !!initializationPromise 
      }, 'warn');
      if (initializationPromise) {
        await initializationPromise;
      }
      performanceTracker.end({ status: 'blocked' });
      return;
    }

    initializationInProgress = true;
    debugLog('AuthContext', 'initializeAuth', { 
      timestamp: Date.now(),
      loading,
      mounted: isMountedRef.current 
    });
    debugLogger.auth('initialization_started', { timestamp: Date.now() });

    // Timeout de segurança para garantir que o loading não fique travado para sempre
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current && loading) {
        debugLogger.auth('safety_timeout_triggered', { 
          timeout: 12000,
          loading,
          mounted: isMountedRef.current 
        }, 'warn');
        setLoading(false);
        initializationInProgress = false;
      }
    }, 12000);

    initializationPromise = (async () => {
      try {
        debugLogger.auth('checking_existing_session', { timestamp: Date.now() });
        // Verificar e atualizar token se necessário antes de consultar a sessão
        try {
          // Temporarily disabled checkAndRefreshToken to prevent potential loops
          // await checkAndRefreshToken();
        } catch (e: any) {
          console.warn('⚠️ [AUTH] Falha ao verificar/atualizar token:', e?.message || e);
        }
        
        // Verificação de sessão com timeout AUMENTADO para 10 segundos para evitar falsos negativos
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na verificação de sessão')), 10000)
        );
        
        let sessionData: any = null;
        
        try {
          sessionData = await Promise.race([sessionPromise, timeoutPromise]);
        } catch (timeoutError) {
          debugLogger.auth('session_check_timeout', { 
            timeout: 10000,
            error: timeoutError.message 
          }, 'error');
        }
        
        if (sessionData) {
          const { data: { session }, error } = sessionData;
          
          if (error) {
            debugLogger.auth('session_check_error', { error: error.message }, 'error');
            // Continuamos mesmo com erro, pois o onAuthStateChange pode recuperar
          }

          if (session?.user && isMountedRef.current) {
            debugLogger.auth('session_found', { 
              userId: session.user.id,
              email: session.user.email 
            });
            setUser(session.user);
            setSession(session);
            
            // Carregar dados do usuário em background - NÃO BLOQUEAR
            loadUserDataInBackground(session.user.id);
          } else {
            console.log('ℹ️ [AUTH] Nenhuma sessão encontrada via getSession');
          }
        }
        
        if (isMountedRef.current) {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }

        // Configurar listener de mudanças de auth - APENAS UMA VEZ
        if (!authSubscriptionRef.current) {
          authSubscriptionRef.current = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMountedRef.current) return;
            
            console.log('🔄 [AUTH] Auth state changed:', event, session?.user?.email);

            if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') && session?.user) {
              console.log('✅ [AUTH] SIGNED_IN - Processando nova autenticação');
              setUser(session.user);
              setSession(session);
              // Reiniciar auto-refresh quando um novo login ocorrer
              /*
              try {
                startTokenAutoRefresh(session);
              } catch (e: any) {
                console.warn('⚠️ [AUTH] Falha ao reiniciar auto-refresh:', e?.message || e);
              }
              */
              loadUserDataInBackground(session.user.id);
              
            } else if (event === 'SIGNED_OUT') {
              console.log('🚪 [AUTH] SIGNED_OUT - Limpando dados');
              setUser(null);
              setSession(null);
              setProfile(null);
              setSubscription(null);
              // stopTokenAutoRefresh();
            }
          });
        }

      } catch (error) {
        console.error('❌ [AUTH] Erro na inicialização:', error);
        debugLog('AuthContext', 'initialization_error', { 
          error: error.message,
          mounted: isMountedRef.current 
        });
        if (isMountedRef.current) {
          setLoading(false);
        }
      } finally {
        initializationInProgress = false;
        initializationPromise = null;
        clearTimeout(safetyTimeout);
        performanceTracker.end({ 
          status: 'completed',
          hasUser: !!user,
          hasSession: !!session 
        });
        debugLog('AuthContext', 'initialization_completed', {
          hasUser: !!user,
          hasSession: !!session,
          loading
        });
        console.log('🔍 [AUTH] === FIM INICIALIZAÇÃO AUTH ===');
      }
    })();

    await initializationPromise;
  };

  // Função otimizada para carregar dados do usuário em background
  const loadUserDataInBackground = useCallback(async (userId: string) => {
    try {
      console.log('📊 [AUTH] Carregando dados do usuário em background...');
      
      // Carregar em paralelo com timeout REDUZIDO para 1.5 segundos
      const profilePromise = fetchProfileWithTimeout(userId, 1500);
      const subscriptionPromise = fetchSubscriptionWithTimeout(userId, 1500);
      
      const [profileResult, subscriptionResult] = await Promise.allSettled([
        profilePromise,
        subscriptionPromise
      ]);
      
      if (profileResult.status === 'fulfilled') {
        console.log('✅ [AUTH] Perfil carregado');
      } else {
        console.error('❌ [AUTH] Erro ao carregar perfil:', profileResult.reason);
      }
      
      if (subscriptionResult.status === 'fulfilled') {
        console.log('✅ [AUTH] Assinatura carregada');
      } else {
        console.error('❌ [AUTH] Erro ao carregar assinatura:', subscriptionResult.reason);
      }
      
    } catch (error) {
      console.error('❌ [AUTH] Erro no carregamento em background:', error);
    }
  }, []);

  const fetchProfileWithTimeout = async (userId: string, timeout: number = 1500) => {
    const profilePromise = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout no carregamento do perfil')), timeout)
    );
    
    const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (data && isMountedRef.current) {
      setProfile(data);
      ProfileCache.setProfile(data);
    }
    
    return data;
  };

  const fetchSubscriptionWithTimeout = async (userId: string, timeout: number = 1500) => {
    const subscriptionPromise = supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout no carregamento da assinatura')), timeout)
    );
    
    const { data, error } = await Promise.race([subscriptionPromise, timeoutPromise]) as any;
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (data && isMountedRef.current) {
      setSubscription(data);
      SubscriptionCache.setSubscription(data);
    }
    
    return data;
  };

  const fetchProfile = async (userId: string) => {
    try {
      await fetchProfileWithTimeout(userId);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchSubscription = async (userId: string) => {
    try {
      await fetchSubscriptionWithTimeout(userId);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const refreshSubscription = async () => {
    if (user) {
      await fetchSubscription(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      localStorage.removeItem('operator_session');
      localStorage.removeItem('waiter_session');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let errorMessage = 'Erro ao entrar. Tente novamente.';
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Credenciais inválidas. Verifique seu email e senha.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        }

        toast({
          title: "Erro ao entrar",
          description: errorMessage,
          variant: "destructive",
        });
        await logSecurityEvent('failed_login', `Failed login for ${email}: ${error.message}`, 'medium');
        throw error;
      }
      
      // Success is logged by the auth state change listener
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, restaurantName: string) => {
    try {
      setLoading(true);
      
      // Configurar redirect URL corretamente
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            restaurant_name: restaurantName,
          }
        }
      });

      if (error) {
        let errorMessage = 'Erro ao criar conta. Tente novamente.';
        
        if (error.message.includes('User already registered')) {
          errorMessage = 'Este email já está cadastrado. Tente fazer login.';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Email inválido. Verifique o formato.';
        }

        toast({
          title: "Erro ao criar conta",
          description: errorMessage,
          variant: "destructive",
        });
        
        await logSecurityEvent('failed_signup', `Failed signup for ${email}: ${error.message}`, 'medium');
        throw error;
      }

      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Conta criada com sucesso!",
          description: "Verifique seu email para confirmar a conta antes de fazer login.",
        });
        
        await logSignupEvent(email, restaurantName, 'pending_confirmation');
      }
      
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      localStorage.removeItem('operator_session');
      localStorage.removeItem('waiter_session');
      await supabase.auth.signOut({ scope: 'local' });
      
      // Limpar cache
      clearAllCache();
      
      // Resetar estados
      setUser(null);
      setSession(null);
      setProfile(null);
      setSubscription(null);
      
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (user) {
      await loadUserDataInBackground(user.id);
    }
  };

  const syncGoogleUserData = async (googleUser: any) => {
    try {
      console.log('🔄 Sincronizando dados do Google User...');
      
      if (!validateOAuthUser(googleUser)) {
        throw new Error('Dados do usuário Google inválidos');
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se já existe perfil
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const profileData = {
        id: user.id,
        email: googleUser.email,
        restaurant_name: existingProfile?.restaurant_name || googleUser.name || 'Meu Restaurante',
        updated_at: new Date().toISOString()
      };

      if (!validateProfileData(profileData)) {
        throw new Error('Dados do perfil inválidos');
      }

      const { id, ...updateData } = profileData as any;
      const upd = await supabase.from('profiles').update(updateData).eq('id', id).select('id');
      let profileError = (upd as any).error;
      const updatedRows = (upd as any).data;
      if (!profileError && (!Array.isArray(updatedRows) || updatedRows.length === 0)) {
        const ins = await supabase.from('profiles').insert(profileData as any);
        profileError = (ins as any).error;
      }

      if (profileError) {
        console.error('Erro ao sincronizar perfil:', profileError);
        throw profileError;
      }

      // Atualizar estado local
      setProfile(profileData as Profile);
      ProfileCache.setProfile(profileData);

      await logOAuthUserSync(user.id, 'google', 'success');
      console.log('✅ Dados do Google User sincronizados com sucesso');
      
    } catch (error) {
      console.error('❌ Erro na sincronização do Google User:', error);
      if (user) {
        await logOAuthUserSync(user.id, 'google', 'error', error instanceof Error ? error.message : 'Unknown error');
      }
      throw error;
    }
  };

  const value = {
    user,
    session,
    profile,
    subscription,
    loading,
    isLoading: loading,
    signOut,
    signIn,
    signUp,
    refreshSubscription,
    refreshUser,
    syncGoogleUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
