
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
    if (!user) return;

    try {
      // Transform items to include all additional information
      const kitchenItems = orderData.items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        options: item.options || [],
        notes: item.notes || '',
        price: item.price,
        subtotal: item.subtotal
      }));

      console.log('🔄 Sending order to KDS with full details:', {
        order_number: orderData.order_number,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        payment_method: orderData.payment_method,
        order_type: orderData.order_type,
        total: orderData.total,
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
        console.error('❌ Error sending to KDS:', error);
        throw error;
      }

      console.log('✅ Order sent to KDS successfully with all details');
    } catch (error) {
      console.error('❌ Failed to send order to KDS:', error);
      throw error;
    }
  };

  return {
    sendToKitchen
  };
};
