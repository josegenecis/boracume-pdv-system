import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  name: string;
  phone: string;
  address: string;
  neighborhood: string;
  deliveryZoneId?: string | null;
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

      const [{ data: customerData, error: customerError }, { data: orderData, error: orderError }] = await Promise.all([
        supabase
          .from('customers')
          .select('name, phone, address, neighborhood')
          .eq('user_id', userId)
          .in('phone', candidates as any)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('orders')
          .select('customer_name, customer_phone, customer_address, customer_neighborhood, delivery_zone_id')
          .eq('user_id', userId)
          .in('customer_phone', candidates as any)
          .order('created_at', { ascending: false })
          .limit(1)
      ]);

      if (customerError) {
        console.error('Erro ao buscar cliente em customers:', customerError);
      }

      if (orderError) {
        console.error('Erro ao buscar cliente em orders:', orderError);
      }

      const customer = customerData?.[0];
      const lastOrder = orderData?.[0];

      if (customer || lastOrder) {
        return {
          name: customer?.name || lastOrder?.customer_name || '',
          phone: customer?.phone || lastOrder?.customer_phone || '',
          address: customer?.address || lastOrder?.customer_address || '',
          neighborhood: customer?.neighborhood || lastOrder?.customer_neighborhood || '',
          deliveryZoneId: lastOrder?.delivery_zone_id || null
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
