
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { PLAN_CATALOG, getPlanCatalogItem } from '@/data/planCatalog';

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

const getFallbackPlans = (): Plan[] => {
  return PLAN_CATALOG.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: plan.monthlyPrice,
    features: plan.features
  }));
};

const normalizePlans = (rows: any[]): Plan[] => {
  return rows.map((row) => {
    const catalog = getPlanCatalogItem(row?.id, row?.name);
    return {
      id: Number(row?.id),
      name: String(row?.name || catalog?.name || 'Plano'),
      description: String(row?.description || catalog?.description || ''),
      price: Number(row?.price ?? catalog?.monthlyPrice ?? 0),
      features: Array.isArray(row?.features) && row.features.length > 0 ? row.features : (catalog?.features || [])
    };
  });
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user, refreshSubscription } = useAuth();

  useEffect(() => {
    console.log('🔍 [SUBSCRIPTION] useEffect executado, user:', user?.id);
    
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('price');

        if (error) {
          console.error('Error fetching plans:', error);
          throw error;
        }
        
        // FALLBACK SE O BANCO ESTIVER VAZIO
        if (!data || data.length === 0) {
            console.warn('⚠️ Banco de dados vazio. Usando planos padrão locais.');
            setPlans(getFallbackPlans());
        } else {
            setPlans(normalizePlans(data));
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
        // Fallback em caso de erro de conexão também
        setPlans(getFallbackPlans());
      } finally {
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
