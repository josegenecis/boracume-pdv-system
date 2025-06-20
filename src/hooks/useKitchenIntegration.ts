
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
  status?: string;
}

export const useKitchenIntegration = () => {
  const { user } = useAuth();

  const sendToKitchen = async (orderData: OrderData) => {
    try {
      // Só enviar para o KDS se o pedido foi aceito ou é do tipo PDV/mesa
      const shouldSendToKDS = orderData.status === 'accepted' || 
                             orderData.order_type === 'pdv' || 
                             orderData.order_type === 'dine_in';
      
      if (!shouldSendToKDS) {
        console.log('🔄 Pedido não enviado para KDS - aguardando aceitação');
        return;
      }

      const kitchenItems = orderData.items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        options: item.options || [],
        notes: item.notes || '',
        price: item.price,
        subtotal: item.subtotal
      }));

      console.log('🔄 Enviando pedido aceito para o KDS:', {
        order_number: orderData.order_number,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        payment_method: orderData.payment_method,
        order_type: orderData.order_type,
        total: orderData.total,
        items: kitchenItems
      });

      // Verificar se já existe no KDS para evitar duplicatas
      const { data: existingOrder } = await supabase
        .from('kitchen_orders')
        .select('id')
        .eq('order_number', orderData.order_number)
        .eq('user_id', orderData.user_id)
        .single();

      if (existingOrder) {
        console.log('⚠️ Pedido já existe no KDS, não enviando duplicata');
        return;
      }

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

      console.log('✅ Pedido aceito enviado para o KDS com sucesso');
      
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
      throw error;
    }
  };

  const sendAcceptedOrderToKitchen = async (orderData: OrderData) => {
    // Função específica para enviar pedidos aceitos
    await sendToKitchen({ ...orderData, status: 'accepted' });
  };

  return {
    sendToKitchen,
    sendAcceptedOrderToKitchen
  };
};
