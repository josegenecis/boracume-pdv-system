
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
  slug?: string | null;
  included_stores?: number | null;
  store_limit?: number | null;
  extra_store_price?: number | null;
  is_public?: boolean | null;
  sort_order?: number | null;
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
    features: plan.features,
    slug: plan.slug,
    included_stores: plan.includedStores,
    store_limit: plan.storeLimit,
    extra_store_price: plan.extraStorePrice || 0,
    is_public: true,
    sort_order: plan.id
  }));
};

const normalizePlans = (rows: any[]): Plan[] => {
  const normalizedRows = rows.map((row) => {
    const catalog = getPlanCatalogItem(row?.id, row?.name);
    return {
      id: Number(catalog?.id || row?.id),
      name: String(catalog?.name || row?.name || 'Plano'),
      description: String(catalog?.description || row?.description || ''),
      price: Number(catalog?.monthlyPrice ?? row?.price ?? 0),
      features: catalog?.features || (Array.isArray(row?.features) ? row.features : []),
      slug: catalog?.slug || row?.slug || null,
      included_stores: Number(catalog?.includedStores ?? row?.included_stores ?? 1),
      store_limit: catalog?.storeLimit ?? row?.store_limit ?? null,
      extra_store_price: Number(catalog?.extraStorePrice ?? row?.extra_store_price ?? 0),
      is_public: row?.is_public ?? true,
      sort_order: Number(row?.sort_order ?? catalog?.id ?? row?.id ?? 99)
    };
  }).filter((plan) => plan.is_public !== false && (plan.id === 1 || plan.id === 2 || plan.id === 3));

  const byId = new Map<number, Plan>();
  normalizedRows.forEach((plan) => byId.set(plan.id, plan));
  getFallbackPlans().forEach((plan) => {
    if (!byId.has(plan.id)) byId.set(plan.id, plan);
  });

  return Array.from(byId.values()).sort((a, b) => Number(a.sort_order || a.id) - Number(b.sort_order || b.id));
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

      console.log('🔍 [SUBSCRIPTION] Criando cobrança no Asaas...');
      const { error } = await supabase.functions.invoke('create-asaas-subscription', {
        body: { planId, storeCount: 1 }
      });

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
