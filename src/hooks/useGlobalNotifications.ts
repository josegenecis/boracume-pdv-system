import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GlobalNotificationOrder {
  id: string;
  order_number: string;
  customer_name?: string;
  order_type: string;
  total: number;
  created_at: string;
  acceptance_status?: string;
}

export const useGlobalNotifications = () => {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [latestOrder, setLatestOrder] = useState<GlobalNotificationOrder | null>(null);

  useEffect(() => {
    if (!user) return;

    // Carregar contagem inicial de pedidos pendentes
    const loadPendingCount = async () => {
      const { data, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('acceptance_status', 'pending_acceptance');

      setPendingCount(count || 0);
    };

    loadPendingCount();

    // Escutar novos pedidos em tempo real
    const channel = supabase
      .channel('global-notifications-hook')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 useGlobalNotifications - Novo pedido recebido:', payload);
          
          const newOrder = payload.new as GlobalNotificationOrder;
          setLatestOrder(newOrder);
          setPendingCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedOrder = payload.new as GlobalNotificationOrder;
          
          // Se o pedido foi aceito ou cancelado, decrementar contador
          if (updatedOrder.acceptance_status !== 'pending_acceptance') {
            setPendingCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    pendingCount,
    latestOrder,
  };
};
