
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  options?: string[];
  notes?: string;
}

export interface KitchenOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  items: OrderItem[];
  priority: 'normal' | 'high';
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  created_at: string;
  updated_at: string;
}

export const useKitchenOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Fetching kitchen orders...');
      
      const { data, error } = await supabase
        .from('kitchen_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching kitchen orders:', error);
        setError(error.message);
        return;
      }

      console.log('✅ Kitchen orders fetched:', data?.length || 0);
      // Cast the data to our interface type since the table exists but isn't in types yet
      setOrders((data as unknown as KitchenOrder[]) || []);
      setError(null);
    } catch (err) {
      console.error('❌ Unexpected error fetching kitchen orders:', err);
      setError('Erro inesperado ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'preparing' | 'ready' | 'completed') => {
    try {
      console.log(`🔄 Updating order ${orderId} status to ${newStatus}`);
      
      const { error } = await supabase
        .from('kitchen_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) {
        console.error('❌ Error updating order status:', error);
        throw error;
      }

      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: newStatus }
          : order
      ));

      console.log('✅ Order status updated successfully');
    } catch (err) {
      console.error('❌ Failed to update order status:', err);
      throw err;
    }
  };

  const createSampleOrder = async () => {
    if (!user) return;

    try {
      const sampleOrder = {
        user_id: user.id,
        order_number: `${Date.now()}`,
        customer_name: 'Cliente Teste',
        customer_phone: '(11) 99999-9999',
        items: [
          {
            id: '1',
            name: 'X-Burger Especial',
            quantity: 1,
            options: ['Sem cebola'],
            notes: 'Bem passado'
          }
        ],
        priority: 'normal' as const,
        status: 'pending' as const
      };

      const { error } = await supabase
        .from('kitchen_orders')
        .insert([sampleOrder]);

      if (error) {
        console.error('❌ Error creating sample order:', error);
        throw error;
      }

      console.log('✅ Sample order created');
      fetchOrders(); // Refresh the list
    } catch (err) {
      console.error('❌ Failed to create sample order:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  return {
    orders,
    loading,
    error,
    updateOrderStatus,
    createSampleOrder,
    refetch: fetchOrders
  };
};
