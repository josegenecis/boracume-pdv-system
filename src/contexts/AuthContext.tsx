import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  restaurant_name: string | null;
  phone: string | null;
  address: string | null;
  onboarding_completed: boolean | null;
}

interface Subscription {
  status: 'trial' | 'active' | 'canceled' | 'expired';
  plan_id: number | null;
  trial_end: string | null;
  current_period_end: string | null;
  plan?: {
    name: string;
    description: string;
    features: string[];
  } | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, restaurantName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Timeout for async operations
  const createTimeoutPromise = (ms: number) => 
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), ms)
    );

  // Fetch profile from Supabase with timeout and error handling
  const fetchProfile = async (userId: string) => {
    console.log('🔍 Fetching profile for user:', userId);
    try {
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const result = await Promise.race([
        profilePromise,
        createTimeoutPromise(10000) // 10 second timeout
      ]);

      const { data, error } = result as any;
      
      if (error) {
        console.warn('⚠️ Profile fetch error (this might be expected for new users):', error.message);
        // Don't throw for missing profile - it's normal for new users
        if (error.code !== 'PGRST116') {
          throw error;
        }
        return;
      }
      
      if (data) {
        console.log('✅ Profile loaded successfully');
        setProfile(data as Profile);
      }
    } catch (error: any) {
      console.error('❌ Error fetching profile:', error.message);
      // Don't block auth flow for profile errors
    }
  };

  // Fetch subscription from Supabase with timeout and error handling
  const fetchSubscription = async (userId: string) => {
    console.log('🔍 Fetching subscription for user:', userId);
    try {
      const subscriptionPromise = supabase
        .from('subscriptions')
        .select(`
          *,
          plan:plan_id(
            name,
            description,
            features
          )
        `)
        .eq('user_id', userId)
        .single();

      const result = await Promise.race([
        subscriptionPromise,
        createTimeoutPromise(10000) // 10 second timeout
      ]);

      const { data, error } = result as any;
      
      if (error) {
        console.warn('⚠️ Subscription fetch error (this might be expected):', error.message);
        // Don't throw for missing subscription
        if (error.code !== 'PGRST116') {
          throw error;
        }
        return;
      }
      
      if (data) {
        console.log('✅ Subscription loaded successfully');
        setSubscription(data as Subscription);
      }
    } catch (error: any) {
      console.error('❌ Error fetching subscription:', error.message);
      // Don't block auth flow for subscription errors
    }
  };

  // Refresh subscription data
  const refreshSubscription = async () => {
    if (user?.id) {
      await fetchSubscription(user.id);
    }
  };

  // Initialize auth state with comprehensive error handling
  useEffect(() => {
    console.log('🚀 Initializing AuthContext');
    
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Set up auth state change listener FIRST
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log('🔄 Auth event:', event, 'Session exists:', !!newSession);
            
            setSession(newSession);
            setUser(newSession?.user || null);
            
            if (event === 'SIGNED_IN' && newSession?.user) {
              console.log('👤 User signed in, loading profile data...');
              // Use setTimeout to avoid blocking the auth state change
              setTimeout(async () => {
                try {
                  await Promise.all([
                    fetchProfile(newSession.user.id),
                    fetchSubscription(newSession.user.id)
                  ]);
                } catch (error) {
                  console.error('❌ Error loading user data:', error);
                } finally {
                  setIsLoading(false);
                }
              }, 100);
            } else if (event === 'SIGNED_OUT') {
              console.log('👋 User signed out');
              setProfile(null);
              setSubscription(null);
              setIsLoading(false);
            } else {
              setIsLoading(false);
            }
          }
        );
        
        // THEN check for existing session
        console.log('🔍 Checking for existing session...');
        const sessionPromise = supabase.auth.getSession();
        const sessionResult = await Promise.race([
          sessionPromise,
          createTimeoutPromise(8000) // 8 second timeout
        ]);
        
        const { data: { session: currentSession }, error } = sessionResult as any;
        
        if (error) {
          console.error('❌ Session check error:', error);
          setIsLoading(false);
          return;
        }
        
        console.log('📋 Initial session check:', !!currentSession);
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (currentSession?.user) {
          console.log('👤 Existing session found, loading user data...');
          try {
            await Promise.all([
              fetchProfile(currentSession.user.id),
              fetchSubscription(currentSession.user.id)
            ]);
          } catch (error) {
            console.error('❌ Error loading initial user data:', error);
          }
        }
        
        // Cleanup function
        return () => {
          console.log('🧹 Cleaning up auth subscription');
          authSubscription.unsubscribe();
        };
        
      } catch (error) {
        console.error('❌ Fatal auth initialization error:', error);
        toast({
          title: "Erro de conexão",
          description: "Problema ao conectar com o servidor. Recarregue a página.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    const cleanup = initializeAuth();
    
    // Safety timeout - if loading takes too long, force stop
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Auth initialization taking too long, forcing stop');
      setIsLoading(false);
    }, 15000); // 15 second safety timeout
    
    return () => {
      clearTimeout(safetyTimeout);
      cleanup?.then(fn => fn?.());
    };
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('🔐 Attempting sign in for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error('❌ Sign in error:', error);
        toast({
          title: "Erro ao fazer login",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }
      
      console.log('✅ Sign in successful');
      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo de volta!",
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, restaurantName: string) => {
    try {
      setIsLoading(true);
      console.log('📝 Attempting sign up for:', email);
      
      // Register user
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
      });
      
      if (error) {
        console.error('❌ Sign up error:', error);
        toast({
          title: "Erro ao criar conta",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error: error.message };
      }
      
      // Update profile with restaurant name
      if (data?.user) {
        try {
          await supabase
            .from('profiles')
            .update({ restaurant_name: restaurantName })
            .eq('id', data.user.id);
          console.log('✅ Profile updated with restaurant name');
        } catch (profileError) {
          console.warn('⚠️ Could not update profile immediately:', profileError);
        }
      }
      
      console.log('✅ Sign up successful');
      toast({
        title: "Conta criada com sucesso",
        description: "Bem-vindo ao BoraCumê!",
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      console.log('👋 Attempting sign out');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      toast({
        title: "Logout realizado",
        description: "Você saiu da sua conta com sucesso.",
      });
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      toast({
        title: "Erro ao fazer logout",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (data: Partial<Profile>) => {
    try {
      setIsLoading(true);
      
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Refresh profile data
      await fetchProfile(user.id);
      
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      subscription,
      isLoading,
      signIn,
      signUp,
      signOut,
      updateProfile,
      refreshSubscription
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
