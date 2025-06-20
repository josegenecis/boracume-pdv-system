
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  name: string;
  phone: string;
  address: string;
  neighborhood: string;
}

export const useCustomerLookup = (userId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const lookupCustomer = useCallback(async (phone: string): Promise<Customer | null> => {
    if (!phone || phone.length < 10) {
      return null;
    }

    setIsLoading(true);
    try {
      console.log('🔍 Buscando cliente pelo telefone:', phone);
      
      // Primeiro tentar buscar na tabela customers
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('name, phone, address, neighborhood')
        .eq('user_id', userId)
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!customerError && customerData && customerData.length > 0) {
        const customer = customerData[0];
        console.log('✅ Cliente encontrado na tabela customers:', customer);
        return {
          name: customer.name || '',
          phone: customer.phone || '',
          address: customer.address || '',
          neighborhood: customer.neighborhood || ''
        };
      }

      // Fallback: buscar nos pedidos se não encontrou na tabela customers
      console.log('🔄 Buscando em pedidos anteriores...');
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, customer_address, customer_neighborhood')
        .eq('user_id', userId)
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!orderError && orderData && orderData.length > 0) {
        const customer = orderData[0];
        console.log('✅ Cliente encontrado em pedidos:', customer);
        return {
          name: customer.customer_name || '',
          phone: customer.customer_phone || '',
          address: customer.customer_address || '',
          neighborhood: customer.customer_neighborhood || ''
        };
      }

      console.log('ℹ️ Cliente não encontrado');
      return null;
    } catch (error) {
      console.error('❌ Erro na consulta de cliente:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return { lookupCustomer, isLoading };
};
