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
    const raw = String(phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      return null;
    }

    setIsLoading(true);
    try {
      const candidates = (() => {
        const set = new Set<string>();
        const add = (v: string) => {
          const t = String(v || '').trim();
          if (t) set.add(t);
        };
        add(raw);
        add(digits);
        if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) add(`55${digits}`);
        if (digits.length === 11) {
          const ddd = digits.slice(0, 2);
          const a = digits.slice(2, 7);
          const b = digits.slice(7);
          add(`(${ddd}) ${a}-${b}`);
          add(`(${ddd})${a}-${b}`);
          add(`(${ddd}) ${a}${b}`);
          add(`${ddd} ${a}-${b}`);
          add(`${ddd}${a}${b}`);
        }
        if (digits.length === 10) {
          const ddd = digits.slice(0, 2);
          const a = digits.slice(2, 6);
          const b = digits.slice(6);
          add(`(${ddd}) ${a}-${b}`);
          add(`(${ddd})${a}-${b}`);
          add(`(${ddd}) ${a}${b}`);
          add(`${ddd} ${a}-${b}`);
          add(`${ddd}${a}${b}`);
        }
        return Array.from(set).slice(0, 12);
      })();

      // Primeiro tentar buscar na tabela customers
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('name, phone, address, neighborhood')
        .eq('user_id', userId)
        .in('phone', candidates as any)
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
        .in('customer_phone', candidates as any)
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
