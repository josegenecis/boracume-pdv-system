import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logSecurityEvent, logSignupEvent } from '@/utils/securityLogger';
<<<<<<< HEAD
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
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44

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
<<<<<<< HEAD
  refreshUser: () => Promise<void>;
  syncGoogleUserData: (googleUser: any) => Promise<void>;
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
<<<<<<< HEAD
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setSession(session);
        
        // Log da criação de sessão OAuth
        if (session.user.app_metadata?.provider === 'google') {
          await logOAuthSessionCreated('google', session.user.id, session.user.email || '', {
            sessionId: session.access_token.substring(0, 10) + '...',
            expiresAt: session.expires_at
          });
        }
        
        // Salvar no cache
        SessionCache.set(session);
        UserCache.set(session.user);
        
        // Iniciar refresh automático de tokens
        startTokenAutoRefresh(session);
        
        // Pré-carregar dados do usuário baseado no contexto
        try {
          const preloadedData = await preloadByContext(session.user, 'login');
          
          // Aplicar dados pré-carregados se disponíveis
          if (preloadedData.profile) {
            setProfile(preloadedData.profile);
          } else {
            await fetchProfile(session.user.id);
          }
          
          if (preloadedData.subscription) {
            setSubscription(preloadedData.subscription);
          } else {
            await fetchSubscription(session.user.id);
          }
          
          // Iniciar pré-carregamento em background para próximas navegações
          backgroundPreload(session.user.id);
          
        } catch (error) {
          console.error('Erro no pré-carregamento:', error);
          // Fallback para carregamento normal
          await fetchProfile(session.user.id);
          await fetchSubscription(session.user.id);
        }
        
        // Limpar cache de sincronização se existir
        SyncCache.clear();
        
      } else if (event === 'SIGNED_OUT') {
        const currentUser = user;
        
        // Log da destruição de sessão OAuth
        if (currentUser?.app_metadata?.provider === 'google') {
          await logOAuthSessionDestroyed('google', currentUser.id, {
            reason: 'user_signout'
          });
        }
        
        // Parar refresh automático de tokens
        stopTokenAutoRefresh();
        
        setUser(null);
        setSession(null);
        setProfile(null);
        setSubscription(null);
        
        // Limpar todos os caches
        clearAllCache();
=======
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Log security events for auth state changes
        if (event === 'SIGNED_IN' && session?.user) {
          logSecurityEvent('login', `User signed in: ${session.user.email}`, 'low');
        } else if (event === 'SIGNED_OUT') {
          logSecurityEvent('logout', 'User signed out', 'low');
        }
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchSubscription(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setSubscription(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchSubscription(session.user.id);
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      }
      
      setLoading(false);
    });

<<<<<<< HEAD
    // Auto-autenticação com cache ou sessão atual
    const autoAuthWithCache = async () => {
      try {
        setLoading(true);
        
        // Verificar e renovar token se necessário
        const validSession = await checkAndRefreshToken();
        
        if (validSession) {
          // Tentar recuperar do cache primeiro
          const cachedSession = SessionCache.get();
          const cachedUser = UserCache.get();
          const cachedProfile = ProfileCache.get();
          const cachedSubscription = SubscriptionCache.get();
          
          if (cachedSession && cachedUser && SessionCache.isValid()) {
            console.log('📦 Restaurando sessão do cache');
            setSession(validSession); // Usar sessão válida/renovada
            setUser(validSession.user);
            
            if (cachedProfile) {
              setProfile(cachedProfile);
            }
            
            if (cachedSubscription) {
              setSubscription(cachedSubscription);
            }
            
            // Iniciar refresh automático
            startTokenAutoRefresh(validSession);
            
            // Verificar se precisa sincronizar
            if (SyncCache.shouldSync()) {
              console.log('🔄 Sincronizando dados em background...');
              try {
                await fetchProfile(validSession.user.id);
                await fetchSubscription(validSession.user.id);
                SyncCache.setLastSync();
              } catch (error) {
                console.error('Erro na sincronização em background:', error);
              }
            }
            
            // Iniciar pré-carregamento em background
            backgroundPreload(validSession.user.id);
            
            setLoading(false);
            return;
          }
          
          // Se não há cache válido, usar sessão renovada
          SessionCache.set(validSession);
          UserCache.set(validSession.user);
          
          setSession(validSession);
          setUser(validSession.user);
          
          // Iniciar refresh automático
          startTokenAutoRefresh(validSession);
          
          try {
            // Usar pré-carregamento para dados iniciais
            const preloadedData = await preloadByContext(validSession.user, 'login');
            
            if (preloadedData.profile) {
              setProfile(preloadedData.profile);
            } else {
              await fetchProfile(validSession.user.id);
            }
            
            if (preloadedData.subscription) {
              setSubscription(preloadedData.subscription);
            } else {
              await fetchSubscription(validSession.user.id);
            }
            
            SyncCache.setLastSync();
            
            // Iniciar pré-carregamento em background
            backgroundPreload(validSession.user.id);
            
          } catch (error) {
            console.error('Erro ao buscar dados do usuário:', error);
            // Fallback para carregamento normal
            await fetchProfile(validSession.user.id);
            await fetchSubscription(validSession.user.id);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Erro na auto-autenticação:', error);
        setLoading(false);
      }
    };

    autoAuthWithCache();

    return () => {
      subscription.unsubscribe();
      stopTokenAutoRefresh(); // Limpar timer ao desmontar
=======
    return () => {
      subscription.unsubscribe();
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
<<<<<<< HEAD
        if (data) {
          ProfileCache.setProfile(data); // Salvar no cache
        }
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
      } else {
        setSubscription(data);
<<<<<<< HEAD
        if (data) {
          SubscriptionCache.setSubscription(data); // Salvar no cache
        }
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      }
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
          data: {
            restaurant_name: restaurantName,
          },
          emailRedirectTo: redirectUrl
        },
      });

      if (error) {
        let errorMessage = 'Erro ao criar conta. Tente novamente.';
        
        if (error.message.includes('User already registered')) {
          errorMessage = 'Este email já está cadastrado. Tente fazer login ou use outro email.';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Email inválido. Verifique o formato do email.';
        } else if (error.message.includes('signup is disabled')) {
          errorMessage = 'Cadastro temporariamente desabilitado. Tente novamente mais tarde.';
        }

        toast({
          title: "Erro ao criar conta",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }

      // Verificar se o usuário foi criado com sucesso
      if (data?.user) {
        toast({
          title: "Conta criada com sucesso!",
          description: "Bem-vindo ao BoraCumê! Redirecionando...",
        });
        
        // Usando a função específica para signup que evita o erro de tipo
        await logSignupEvent(email);
        
        // Aguardar um pouco para permitir que o trigger seja executado
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        throw new Error('Falha ao criar usuário');
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
      const currentUser = user?.email;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setProfile(null);
      setSubscription(null);
      
      // Log the logout event with the user email before clearing state
      if (currentUser) {
        await logSecurityEvent('logout', `User logged out: ${currentUser}`, 'low');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  // Função para atualizar dados do usuário
  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        await fetchProfile(session.user.id);
        await fetchSubscription(session.user.id);
      }
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
    }
  };

  // Função para sincronizar dados do usuário Google
  const syncGoogleUserData = async (user: User): Promise<void> => {
    try {
      console.log('🔄 Sincronizando dados do usuário Google:', user.email);
      
      // Validar dados do usuário
      const userValidation = validateOAuthUser(user);
      if (!userValidation.isValid) {
        console.error('❌ Dados do usuário inválidos:', userValidation.errors);
        throw new Error(`Dados do usuário inválidos: ${userValidation.errors.join(', ')}`);
      }

      // Verificar se o perfil já existe
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Erro ao buscar perfil existente:', fetchError);
        throw fetchError;
      }

      const profileData = {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        provider: 'google',
        updated_at: new Date().toISOString()
      };

      // Validar dados do perfil
      const profileValidation = validateProfileData(profileData);
      if (!profileValidation.isValid) {
        console.error('❌ Dados do perfil inválidos:', profileValidation.errors);
        throw new Error(`Dados do perfil inválidos: ${profileValidation.errors.join(', ')}`);
      }

      let result;
      if (existingProfile) {
        // Atualizar perfil existente
        const { data, error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', user.id)
          .select()
          .single();
        
        result = { data, error };
        console.log('✅ Perfil atualizado:', data);
      } else {
        // Criar novo perfil
        const { data, error } = await supabase
          .from('profiles')
          .insert([profileData])
          .select()
          .single();
        
        result = { data, error };
        console.log('✅ Novo perfil criado:', data);
      }

      if (result.error) {
        console.error('❌ Erro ao sincronizar perfil:', result.error);
        
        // Log da falha na sincronização
        await logOAuthUserSync('google', user.id, user.email || '', false, {
          error: result.error.message,
          operation: existingProfile ? 'update' : 'create'
        });
        
        throw result.error;
      }

      // Atualizar estado local
      setProfile(result.data);
      
      // Log do sucesso da sincronização
      await logOAuthUserSync('google', user.id, user.email || '', true, {
        operation: existingProfile ? 'update' : 'create',
        profileData: {
          name: profileData.name,
          hasAvatar: !!profileData.avatar_url
        }
      });

      console.log('✅ Dados do usuário Google sincronizados com sucesso');
      
    } catch (error: any) {
      console.error('❌ Erro na sincronização de dados do Google:', error);
      
      // Log da falha na sincronização
      await logOAuthUserSync('google', user.id, user.email || '', false, {
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  };

=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
<<<<<<< HEAD
    refreshUser,
    syncGoogleUserData,
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
