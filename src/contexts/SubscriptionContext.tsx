
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
            setPlans([
              {
                  id: 1,
                  name: 'Essencial',
                  description: 'Para quem está começando',
                  price: 89.00,
                  features: ["Cardápio Digital", "PDV Frente de Caixa", "Gestão de Pedidos", "Até 100 Produtos", "Relatórios Básicos", "1 Usuário"]
              },
              {
                  id: 2,
                  name: 'Profissional',
                  description: 'Para restaurantes em crescimento',
                  price: 169.00,
                  features: ["Tudo do Essencial", "Produtos Ilimitados", "Gestão de Entregadores", "KDS (Tela de Cozinha)", "Controle de Estoque", "Gestão Financeira", "Até 5 Usuários", "WhatsApp Bot (Cardápio)"]
              },
              {
                  id: 3,
                  name: 'Enterprise',
                  description: 'Para redes e franquias',
                  price: 229.00,
                  features: ["Tudo do Profissional", "Múltiplas Lojas", "API de Integração", "Suporte Prioritário", "Gerente de Contas", "Customização de Marca", "Agente de Voz IA", "Importação de Cardápio com IA"]
              }
            ]);
        } else {
            setPlans(data);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
        // Fallback em caso de erro de conexão também
        setPlans([
              {
                  id: 1,
                  name: 'Essencial',
                  description: 'Para quem está começando',
                  price: 89.00,
                  features: ["Cardápio Digital", "PDV Frente de Caixa", "Gestão de Pedidos", "Até 100 Produtos", "Relatórios Básicos", "1 Usuário"]
              },
              {
                  id: 2,
                  name: 'Profissional',
                  description: 'Para restaurantes em crescimento',
                  price: 169.00,
                  features: ["Tudo do Essencial", "Produtos Ilimitados", "Gestão de Entregadores", "KDS (Tela de Cozinha)", "Controle de Estoque", "Gestão Financeira", "Até 5 Usuários", "WhatsApp Bot (Cardápio)"]
              },
              {
                  id: 3,
                  name: 'Enterprise',
                  description: 'Para redes e franquias',
                  price: 229.00,
                  features: ["Tudo do Profissional", "Múltiplas Lojas", "API de Integração", "Suporte Prioritário", "Gerente de Contas", "Customização de Marca", "Agente de Voz IA", "Importação de Cardápio com IA"]
              }
        ]);
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
