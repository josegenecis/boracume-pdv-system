
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        
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
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Erro ao entrar",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }
    } catch (error) {
      console.error('Error signing in:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, restaurantName: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            restaurant_name: restaurantName,
          },
        },
      });

      if (error) {
        toast({
          title: "Erro ao criar conta",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Bem-vindo ao BoraCumê!",
      });
    } catch (error) {
      console.error('Error signing up:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setProfile(null);
      setSubscription(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
