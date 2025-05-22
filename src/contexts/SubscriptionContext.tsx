
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
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('price', { ascending: true });

        if (error) throw error;
        setPlans(data as Plan[]);
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleSubscribe = async (planId: number) => {
    setIsLoading(true);
    try {
      if (!user) throw new Error('Usuário não autenticado');

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

      if (error) throw error;

      // Refresh subscription data
      await refreshSubscription();

      // In a real app, this would redirect to a payment gateway
      console.log(`Subscribed to plan ${planId}`);
    } catch (error) {
      console.error('Error subscribing to plan:', error);
    } finally {
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
