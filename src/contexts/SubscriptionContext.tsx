
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface Plan {
  id: number;
  name: string;
  price: number;
  description: string;
  features: string[];
}

interface SubscriptionContextType {
  plans: Plan[];
  isLoading: boolean;
  handleSubscribe: (planId: number) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user, refreshSubscription } = useAuth();

  useEffect(() => {
    console.log('🔍 [SUBSCRIPTION] useEffect executado, user:', user?.id);
    
    const fetchPlans = async () => {
      console.log('🔍 [SUBSCRIPTION] Iniciando fetchPlans...');
      setIsLoading(true);
      
      try {
        console.log('🔍 [SUBSCRIPTION] Executando query no Supabase...');
        
        // Implementar timeout para a query do Supabase
        const queryPromise = supabase
          .from('subscription_plans')
          .select('*')
          .order('price', { ascending: true });
          
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na query de subscription_plans')), 5000)
        );
        
        console.log('🔍 [SUBSCRIPTION] Aguardando resultado da query com timeout...');
        const result = await Promise.race([queryPromise, timeoutPromise]);
        const { data, error } = result as any;

        console.log('🔍 [SUBSCRIPTION] Resultado da query - data:', data, 'error:', error);

        if (error) {
          console.error('❌ [SUBSCRIPTION] Erro na query:', error);
          throw error;
        }
        
        console.log('✅ [SUBSCRIPTION] Plans carregados:', data?.length || 0);
        setPlans(data as Plan[]);
      } catch (error) {
        console.error('❌ [SUBSCRIPTION] Error fetching subscription plans:', error);
        console.error('❌ [SUBSCRIPTION] Stack trace:', error.stack);
        
        // Em caso de erro, definir plans vazio para não travar a aplicação
        setPlans([]);
      } finally {
        console.log('🔍 [SUBSCRIPTION] Finalizando loading...');
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleSubscribe = async (planId: number) => {
    console.log('🔍 [SUBSCRIPTION] handleSubscribe chamado para planId:', planId);
    setIsLoading(true);
    try {
      if (!user) {
        console.error('❌ [SUBSCRIPTION] Usuário não autenticado');
        throw new Error('Usuário não autenticado');
      }

      console.log('🔍 [SUBSCRIPTION] Atualizando subscription no banco...');
      const currentDate = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      // Update subscription to active with the selected plan
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_id: planId,
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextMonth.toISOString(),
          updated_at: currentDate.toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ [SUBSCRIPTION] Erro ao atualizar subscription:', error);
        throw error;
      }

      console.log('✅ [SUBSCRIPTION] Subscription atualizada, refreshing...');
      // Refresh subscription data
      await refreshSubscription();

      // In a real app, this would redirect to a payment gateway
      console.log(`✅ [SUBSCRIPTION] Subscribed to plan ${planId}`);
    } catch (error) {
      console.error('❌ [SUBSCRIPTION] Error subscribing to plan:', error);
    } finally {
      console.log('🔍 [SUBSCRIPTION] Finalizando loading do handleSubscribe...');
      setIsLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider value={{ plans, isLoading, handleSubscribe }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

// Export individual components to fix Fast Refresh warning
// SubscriptionProvider is already exported above
