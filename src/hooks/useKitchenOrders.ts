import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  options?: string[];
  notes?: string;
  variations?: {
    name: string;
    selectedOptions: string[];
    price: number;
  }[];
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
  timestamp: Date;
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
      
      // Convert the data to match our KitchenOrder interface
      const formattedOrders: KitchenOrder[] = (data || []).map(order => {
        // Process items to ensure all data is properly formatted
        const processedItems = Array.isArray(order.items) ? order.items.map((item: any) => {
          console.log('🔍 KITCHEN - Processando item:', item);
          
          // Detectar formato do item (do useKitchenIntegration vs direto do pedido)
          const isKitchenFormat = item.hasOwnProperty('id') && item.hasOwnProperty('name');
          const isOrderFormat = item.hasOwnProperty('product_id') && item.hasOwnProperty('product_name');
          
          let processedItem: any = {
            id: item.id || item.product_id || String(Math.random()),
            name: item.name || item.product_name || 'Produto',
            quantity: Number(item.quantity) || 1,
            notes: item.notes || '',
          };
          
          // Processar opções e variações
          if (isKitchenFormat) {
            // Formato do useKitchenIntegration (mais simples)
            processedItem.options = Array.isArray(item.options) ? item.options : [];
            processedItem.variations = [];
          } else if (isOrderFormat) {
            // Formato direto do pedido (com variations)
            processedItem.options = [];
            
            // Processar variations se existirem
            if (Array.isArray(item.variations)) {
              processedItem.variations = item.variations.map((variation: any) => {
                console.log('🔍 KITCHEN - Processando variation:', variation);
                
                if (typeof variation === 'string') {
                  // Variation como string simples
                  return {
                    name: 'Personalização',
                    selectedOptions: [variation],
                    price: 0
                  };
                } else if (typeof variation === 'object' && variation !== null) {
                  // Variation como objeto
                  return {
                    name: variation.name || 'Personalização',
                    selectedOptions: Array.isArray(variation.selectedOptions) 
                      ? variation.selectedOptions.map((opt: any) => 
                          typeof opt === 'string' ? opt : String(opt.name || opt.option || opt)
                        )
                      : (variation.selectedOptions ? [String(variation.selectedOptions)] : []),
                    price: Number(variation.price) || 0
                  };
                } else {
                  return {
                    name: 'Personalização',
                    selectedOptions: [String(variation)],
                    price: 0
                  };
                }
              });
            } else {
              processedItem.variations = [];
            }
          } else {
            // Formato desconhecido - tentar extrair o que for possível
            processedItem.options = [];
            processedItem.variations = [];
          }
          
          console.log('✅ KITCHEN - Item processado:', processedItem);
          return processedItem;
        }) : [];

        return {
          ...order,
          items: processedItems,
          priority: order.priority as 'normal' | 'high',
          status: order.status as 'pending' | 'preparing' | 'ready' | 'completed',
          timestamp: new Date(order.created_at)
        };
      });
      
      setOrders(formattedOrders);
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

  const updateMultipleOrdersStatus = async (orderIds: string[], newStatus: 'preparing' | 'ready' | 'completed') => {
    try {
      console.log(`🔄 Updating ${orderIds.length} orders to status ${newStatus}`);
      
      const { error } = await supabase
        .from('kitchen_orders')
        .update({ status: newStatus })
        .in('id', orderIds);

      if (error) {
        console.error('❌ Error updating multiple orders status:', error);
        throw error;
      }

      // Update local state
      setOrders(prev => prev.map(order => 
        orderIds.includes(order.id) 
          ? { ...order, status: newStatus }
          : order
      ));

      console.log(`✅ ${orderIds.length} orders status updated successfully`);
      return { success: true, updatedCount: orderIds.length };
    } catch (err) {
      console.error('❌ Failed to update multiple orders status:', err);
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
    updateMultipleOrdersStatus,
    createSampleOrder,
    refetch: fetchOrders
  };
};