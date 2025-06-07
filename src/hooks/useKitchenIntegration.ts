
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useKitchenIntegration = () => {
  const { user } = useAuth();

  const sendToKitchen = async (orderData: any) => {
    if (!user) return;

    try {
      const kitchenOrder = {
        user_id: user.id,
        order_number: orderData.order_number,
        customer_name: orderData.customer_name || 'Cliente Local',
        customer_phone: orderData.customer_phone || null,
        items: orderData.items.map((item: any) => ({
          id: item.product_id || item.id,
          name: item.product_name || item.name,
          quantity: item.quantity,
          options: item.options || [],
          notes: item.notes || ''
        })),
        priority: orderData.total > 50 ? 'high' : 'normal',
        status: 'pending'
      };

      const { error } = await supabase
        .from('kitchen_orders')
        .insert([kitchenOrder]);

      if (error) throw error;

      console.log('✅ Pedido enviado para a cozinha:', kitchenOrder.order_number);
    } catch (error) {
      console.error('❌ Erro ao enviar pedido para cozinha:', error);
      throw error;
    }
  };

  return { sendToKitchen };
};
