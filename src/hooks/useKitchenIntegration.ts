
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  options?: string[];
  notes?: string;
}

interface OrderData {
  user_id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  items: OrderItem[];
  total: number;
  payment_method: string;
  order_type: string;
}

export const useKitchenIntegration = () => {
  const { user } = useAuth();

  const sendToKitchen = async (orderData: OrderData) => {
    try {
<<<<<<< HEAD
      console.log('🔄 KDS Integration: Iniciando envio do pedido para KDS');
      console.log('📋 Dados do pedido:', {
=======
      const kitchenItems = orderData.items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        options: item.options || [],
        notes: item.notes || '',
        price: item.price,
        subtotal: item.subtotal
      }));

      console.log('🔄 Enviando pedido para o KDS:', {
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
        order_number: orderData.order_number,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        payment_method: orderData.payment_method,
        order_type: orderData.order_type,
        total: orderData.total,
<<<<<<< HEAD
        items_count: orderData.items.length,
        user_id: orderData.user_id
      });

      // Verificar se o usuário está autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ Erro de autenticação:', authError);
        throw new Error(`Erro de autenticação: ${authError.message}`);
      }
      
      if (!user) {
        console.error('❌ Usuário não está logado');
        throw new Error('Usuário não está logado');
      }
      
      console.log('✅ Usuário autenticado:', user.email);

      // Tentar inserir diretamente no kitchen_orders como fallback
      console.log('🔄 Tentando inserir no kitchen_orders...');
      
      // Validar dados obrigatórios
      if (!orderData.customer_name || orderData.customer_name.trim() === '') {
        console.warn('⚠️ customer_name está vazio, usando valor padrão');
        orderData.customer_name = 'Cliente não informado';
      }
      
      const kitchenOrderData = {
        order_number: orderData.order_number,
        customer_name: orderData.customer_name.trim(),
        customer_phone: orderData.customer_phone || '',
        items: orderData.items,
        priority: 'normal',
        status: 'pending',
        user_id: orderData.user_id
      };
      
      const { data: kitchenOrder, error: kitchenError } = await supabase
        .from('kitchen_orders')
        .insert(kitchenOrderData)
        .select()
        .single();
      
      if (kitchenError) {
        console.warn('⚠️ Não foi possível inserir diretamente no kitchen_orders:', kitchenError);
        console.log('🔄 Confiando no trigger do banco de dados...');
      } else {
        console.log('✅ Pedido inserido no kitchen_orders:', kitchenOrder);
      }
      
      // Enviar notificação em tempo real
      try {
        console.log('🔄 Enviando notificação em tempo real...');
        const channel = supabase.channel('kitchen-notifications');
        
        const notificationPayload = {
          order_number: orderData.order_number,
          customer_name: orderData.customer_name,
          user_id: orderData.user_id,
          status: 'accepted',
          timestamp: new Date().toISOString()
        };
        
        // Timeout para evitar travamento
        const notificationPromise = channel.send({
          type: 'broadcast',
          event: 'order_accepted',
          payload: notificationPayload
        });
        
        // Aguardar no máximo 3 segundos pela notificação
        await Promise.race([
          notificationPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout na notificação')), 3000)
          )
        ]);
        
        console.log('✅ Notificação enviada:', notificationPayload);
      } catch (notificationError) {
        console.warn('⚠️ Erro ao enviar notificação (não crítico):', notificationError);
        // Não propagar o erro, pois a notificação é opcional
      }

      console.log('✅ Integração KDS concluída com sucesso');
      return { success: true, kitchenOrder };

    } catch (error) {
      console.error('❌ Falha na integração KDS:', {
        message: error?.message,
        stack: error?.stack,
        orderData: {
          order_number: orderData.order_number,
          user_id: orderData.user_id
        }
      });
=======
        items: kitchenItems
      });

      const kitchenOrder = {
        user_id: orderData.user_id,
        order_number: orderData.order_number,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone || '',
        items: kitchenItems,
        priority: 'normal' as const,
        status: 'pending' as const
      };

      const { error } = await supabase
        .from('kitchen_orders')
        .insert([kitchenOrder]);

      if (error) {
        console.error('❌ Erro ao enviar para o KDS:', error);
        throw error;
      }

      console.log('✅ Pedido enviado para o KDS com sucesso');
      
      // Enviar notificação em tempo real
      const channel = supabase.channel('kitchen-notifications');
      channel.send({
        type: 'broadcast',
        event: 'new_order',
        payload: { 
          order_number: orderData.order_number,
          customer_name: orderData.customer_name,
          user_id: orderData.user_id
        }
      });

    } catch (error) {
      console.error('❌ Falha ao enviar pedido para o KDS:', error);
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      throw error;
    }
  };

  return {
    sendToKitchen
  };
};
