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
<<<<<<< HEAD
    // TEMPORARY: Remove user dependency for KDS testing
    // if (!user) {
    //   setOrders([]);
    //   setLoading(false);
    //   return;
    // }
=======
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44

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
<<<<<<< HEAD
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
=======
        // Process items to ensure all data is properly formatted
        const processedItems = Array.isArray(order.items) ? order.items.map((item: any) => {
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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
          
<<<<<<< HEAD
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
=======
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
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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

<<<<<<< HEAD
  const updateOrderStatus = async (orderId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'completed') => {
=======
  const updateOrderStatus = async (orderId: string, newStatus: 'preparing' | 'ready' | 'completed') => {
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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

<<<<<<< HEAD
  const updateMultipleOrdersStatus = async (orderIds: string[], newStatus: 'pending' | 'preparing' | 'ready' | 'completed') => {
=======
  const updateMultipleOrdersStatus = async (orderIds: string[], newStatus: 'preparing' | 'ready' | 'completed') => {
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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

<<<<<<< HEAD
  useEffect(() => {
    fetchOrders();

    // TEMPORARY: Remove user dependency for KDS testing
    // if (!user) {
    //   console.log('❌ No user found, skipping realtime setup');
    //   return;
    // }

    console.log('🔄 Setting up realtime subscription for kitchen orders...');
    // console.log('👤 User ID:', user.id);
    
    // Test realtime connection first
    const testChannel = supabase
      .channel('test_connection')
      .subscribe((status) => {
        console.log('🧪 Test channel status:', status);
      });
    
    const channel = supabase
      .channel('kitchen_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events for debugging
          schema: 'public',
          table: 'kitchen_orders'
        },
        (payload) => {
          console.log('📨 Realtime event received:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            console.log('🆕 New order received via realtime:', payload.new);
            try {
              const newOrder = {
                ...payload.new,
                items: typeof payload.new.items === 'string' ? JSON.parse(payload.new.items) : payload.new.items,
                priority: payload.new.priority as 'normal' | 'high',
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
      supabase.removeChannel(testChannel);
      supabase.removeChannel(channel);
    };
  }, []); // Remove user dependency
=======
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
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44

  return {
    orders,
    loading,
    error,
    updateOrderStatus,
    updateMultipleOrdersStatus,
<<<<<<< HEAD
=======
    createSampleOrder,
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    refetch: fetchOrders
  };
};