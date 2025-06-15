import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  name: string;
  phone: string;
  address: string;
}

export const useCustomerLookup = (userId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const lookupCustomer = useCallback(async (phone: string): Promise<Customer | null> => {
    if (!phone || phone.length < 10) {
      return null;
    }

    setIsLoading(true);
    try {
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
          address: customer.customer_address || ''
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