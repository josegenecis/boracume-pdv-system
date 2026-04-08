import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resolveOperatorProfile } from '../services/waiterApp';
import type { OperatorProfile } from '../types/domain';

type AuthSessionContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  operator: OperatorProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshOperator: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [operator, setOperator] = useState<OperatorProfile | null>(null);

  async function loadOperator(user: User | null) {
    if (!user) {
      setOperator(null);
      return;
    }
    const profile = await resolveOperatorProfile(user);
    setOperator(profile);
  }

  async function bootstrap() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    await loadOperator(data.session?.user ?? null);
    setLoading(false);
  }

  useEffect(() => {
    bootstrap();
    const listener = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await loadOperator(nextSession?.user ?? null);
      setLoading(false);
    });
    return () => {
      listener.data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      operator,
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
      refreshOperator: async () => {
        await loadOperator(session?.user ?? null);
      },
    }),
    [loading, operator, session],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession precisa estar dentro de AuthSessionProvider');
  }
  return context;
}
