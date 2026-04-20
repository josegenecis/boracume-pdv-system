import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { queryClient } from '../lib/queryClient';
import {
  restoreWaiterSession,
  signInWaiter,
  signOutWaiter,
} from '../services/waiterApp';
import type { OperatorProfile, WaiterStoredSession } from '../types/domain';

type AuthSessionContextValue = {
  loading: boolean;
  session: WaiterStoredSession | null;
  operator: OperatorProfile | null;
  signIn: (cpf: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshOperator: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<WaiterStoredSession | null>(null);
  const [operator, setOperator] = useState<OperatorProfile | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const restoredSession = await restoreWaiterSession();
        if (!mounted) {
          return;
        }

        setSession(restoredSession);
        setOperator(restoredSession?.profile ?? null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      loading,
      session,
      operator,
      signIn: async (cpf: string, password: string) => {
        const nextSession = await signInWaiter(cpf, password);
        setSession(nextSession);
        setOperator(nextSession.profile);
        queryClient.clear();
      },
      signOut: async () => {
        await signOutWaiter();
        setSession(null);
        setOperator(null);
        queryClient.clear();
      },
      refreshOperator: async () => {
        const refreshedSession = await restoreWaiterSession();
        setSession(refreshedSession);
        setOperator(refreshedSession?.profile ?? null);
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
