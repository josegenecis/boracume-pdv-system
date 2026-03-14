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

    // TEMPORARY: Remove user dependency for KDS testing
    // if (!user) {
    //   setOrders([]);
    //   setLoading(false);
    //   return;
    // }


    try {
      setLoading(true);
      console.log('🔄 Fetching kitchen orders...');
      
      const { data, error } = await supabase
        .from('orders') // Changed from kitchen_orders
        .select('*')
        .in('status', ['pending', 'preparing', 'ready', 'completed']) // Filter pertinent statuses
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching kitchen orders:', error);
        setError(error.message);
        return;
      }
      
      // ... (rest of the mapping logic needs to handle orders structure)

      console.log('✅ Kitchen orders fetched:', data?.length || 0);
      
      // Convert the data to match our KitchenOrder interface
      const formattedOrders: KitchenOrder[] = (data || []).map(order => {

        // Corrigir caso items venha como string JSON
        let itemsRaw = order.items;
        if (typeof itemsRaw === 'string') {
          try {
            itemsRaw = JSON.parse(itemsRaw);
          } catch (e) {
            console.error('❌ Erro ao fazer parse de items do pedido:', itemsRaw, e);
            itemsRaw = [];
          }
        }
        // Process items to ensure all data is properly formatted
        const processedItems = Array.isArray(itemsRaw) ? itemsRaw.map((item: any) => {

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
          

          // Processar opções e variações (evitar duplicação)
          processedItem.options = [];
          processedItem.variations = [];
          
          // Coletar todas as opções/adicionais de diferentes fontes
          let allOptions: string[] = [];
          
          // 1. Verificar se há options diretas (formato antigo)
          if (Array.isArray(item.options) && item.options.length > 0) {
            allOptions = [...allOptions, ...item.options.map((opt: any) => 
              typeof opt === 'string' ? opt : String(opt)
            )];
          }
          
          // 2. Verificar se há variations (formato novo)
          if (Array.isArray(item.variations) && item.variations.length > 0) {
            item.variations.forEach((variation: any) => {
              console.log('🔍 KITCHEN - Processando variation:', variation);
              
              if (typeof variation === 'string') {
                allOptions.push(variation);
              } else if (typeof variation === 'object' && variation !== null) {
                if (Array.isArray(variation.selectedOptions)) {
                  variation.selectedOptions.forEach((opt: any) => {
                    const optionText = typeof opt === 'string' ? opt : String(opt.name || opt.option || opt);
                    if (optionText) allOptions.push(optionText);
                  });
                } else if (variation.selectedOptions) {
                  allOptions.push(String(variation.selectedOptions));
                }
              }
            });
          }
          
          // 3. Remover duplicatas e criar variations únicas
          const uniqueOptions = [...new Set(allOptions)].filter(Boolean);
          
          if (uniqueOptions.length > 0) {
            processedItem.variations = [
              {
                name: 'Adicionais',
                selectedOptions: uniqueOptions,
                price: 0
              }
            ];

          }
          
          console.log('✅ KITCHEN - Item processado:', processedItem);
          return processedItem;
        }) : [];

        return {
          ...order,
          items: processedItems,
          priority: (order as any).priority as 'normal' | 'high' || 'normal',
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


  const updateOrderStatus = async (orderId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'completed') => {

    try {
      console.log(`🔄 Updating order ${orderId} status to ${newStatus}`);
      
      const { error } = await supabase
        .from('orders')
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


  const updateMultipleOrdersStatus = async (orderIds: string[], newStatus: 'pending' | 'preparing' | 'ready' | 'completed') => {

    try {
      console.log(`🔄 Updating ${orderIds.length} orders to status ${newStatus}`);
      
      const { error } = await supabase
        .from('orders')
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


  useEffect(() => {
    fetchOrders();

    if (!user?.id) return;
    
    const channel = supabase
      .channel('kitchen_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events for debugging
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📨 Realtime event received:', payload.eventType, payload);

          const nextStatus = String((payload as any)?.new?.status || (payload as any)?.old?.status || '');
          if (!['pending', 'preparing', 'ready', 'completed'].includes(nextStatus)) return;
          
          if (payload.eventType === 'INSERT') {
            console.log('🆕 New order received via realtime:', payload.new);
            try {
              const newOrder = {
                ...payload.new,
                items: typeof payload.new.items === 'string' ? JSON.parse(payload.new.items) : payload.new.items,
                priority: (payload.new as any).priority as 'normal' | 'high' || 'normal',
                status: payload.new.status as 'pending' | 'preparing' | 'ready' | 'completed',
                timestamp: new Date(payload.new.created_at)
              };
              console.log('✅ Processed new order:', newOrder);
              setOrders(prev => [newOrder, ...prev]);
            } catch (error) {
              console.error('❌ Error processing new order:', error);
            }
          } else if (payload.eventType === 'UPDATE') {
            console.log('🔄 Order updated via realtime:', payload.new);
            setOrders(prev => prev.map(order => 
              order.id === payload.new.id 
                ? { ...order, ...payload.new, timestamp: new Date(payload.new.created_at) }
                : order
            ));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Kitchen orders subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to kitchen_orders realtime!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to kitchen_orders realtime');
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ Timeout subscribing to kitchen_orders realtime');
        }
      });

    return () => {
      console.log('🔌 Removing realtime subscriptions...');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);


  return {
    orders,
    loading,
    error,
    updateOrderStatus,
    updateMultipleOrdersStatus,


    refetch: fetchOrders
  };
};
