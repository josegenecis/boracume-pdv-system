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
        return {
          name: customer.name || '',
          phone: customer.phone || '',
          address: customer.address || '',
          neighborhood: customer.neighborhood || ''
        };
      }

      // Fallback para buscar nos pedidos
      const { data, error } = await supabase
        .from('orders')
        .select('customer_name, customer_phone, customer_address')
        .eq('user_id', userId)
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Erro ao buscar cliente:', error);
        return null;
      }

      if (data && data.length > 0) {
        const customer = data[0];
        return {
          name: customer.customer_name || '',
          phone: customer.customer_phone || '',
          address: customer.customer_address || '',
          neighborhood: ''
        };
      }

      return null;
    } catch (error) {
      console.error('Erro na consulta de cliente:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return { lookupCustomer, isLoading };
};