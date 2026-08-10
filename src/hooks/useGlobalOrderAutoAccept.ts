import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PrinterService } from '@/utils/printerService';
import { updateOrderStatus } from '@/utils/updateOrderStatus';
import { POPSYSTEM_ORDER_SOUND_TYPE, soundNotifications } from '@/utils/soundUtils';
import { useLocation } from 'react-router-dom';

const getAutoAcceptKey = (userId?: string) => `orders_auto_accept:${userId || 'local'}`;

const normalizeItems = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const isPdvCounterOrder = (order: any) => {
  const source = String(order?.variations?.source || order?.source || '').toUpperCase();
  return order?.order_type === 'counter' && source === 'PDV';
};

const isHiddenTableServiceOrder = (order: any) => {
  const orderType = String(order?.order_type || '').toLowerCase();
  const flow = String(order?.variations?.table_order_flow || '').toLowerCase();
  const showInManager = order?.variations?.show_in_manager;
  return orderType === 'dine_in' && (flow === 'account_only' || showInManager === false);
};

const isPendingOrder = (order: any) => {
  return order?.acceptance_status === 'pending_acceptance' || order?.status === 'pending';
};

const playTwoAlerts = async () => {
  await soundNotifications.playSound(POPSYSTEM_ORDER_SOUND_TYPE);
  window.setTimeout(() => {
    void soundNotifications.playSound(POPSYSTEM_ORDER_SOUND_TYPE);
  }, 1400);
};

export const useGlobalOrderAutoAccept = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isStandaloneOrderingScreen = pathname.startsWith('/totem') || pathname.startsWith('/menu') || pathname.startsWith('/track');
  const [enabled, setEnabled] = useState(false);
  const processingRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef<number | null>(null);

  const loadEnabled = useCallback(() => {
    if (!user?.id) {
      setEnabled(false);
      return false;
    }
    const next = localStorage.getItem(getAutoAcceptKey(user.id)) === 'true';
    setEnabled(next);
    return next;
  }, [user?.id]);

  const sendToKitchenOnce = useCallback(async (order: any) => {
    const userId = String(order?.user_id || user?.id || '');
    const orderNumber = String(order?.order_number || '').trim();
    if (!userId || !orderNumber) return;

    const payload = {
      user_id: userId,
      order_number: orderNumber,
      customer_name: String(order?.customer_name || 'Cliente não informado').trim(),
      customer_phone: order?.customer_phone || '',
      items: normalizeItems(order?.items),
      priority: 'normal',
      status: 'pending',
    };

    const { error } = await (supabase as any)
      .from('kitchen_orders')
      .upsert(payload, { onConflict: 'order_number', ignoreDuplicates: true });

    if (error) {
      console.warn('Não foi possível enviar o pedido aceito para a cozinha:', error);
    }
  }, [user?.id]);

  const acceptOrder = useCallback(async (order: any) => {
    const orderId = String(order?.id || '');
    if (!orderId || processingRef.current.has(orderId)) return;
    if (!isPendingOrder(order) || isPdvCounterOrder(order) || isHiddenTableServiceOrder(order)) return;

    processingRef.current.add(orderId);
    try {
      const acceptedOrder = await updateOrderStatus(orderId, 'preparing');
      const orderForPrint = {
        ...order,
        ...acceptedOrder,
        items: normalizeItems(acceptedOrder?.items ?? order?.items),
      };

      await sendToKitchenOnce(orderForPrint);
      await PrinterService.printOrderOnAccept(orderForPrint);
      await playTwoAlerts();

      toast.success(`Pedido #${orderForPrint.order_number || orderId.slice(0, 8)} aceito automaticamente`, {
        description: 'Pedido impresso e alerta tocado 2 vezes.',
      });
    } catch (error: any) {
      console.error('Falha no aceite automático global:', error);
      toast.error('Aceite automático falhou', {
        description: error?.message || 'Abra o gestor de pedidos e aceite manualmente.',
      });
    } finally {
      processingRef.current.delete(orderId);
    }
  }, [sendToKitchenOnce]);

  const scanPendingOrders = useCallback(async () => {
    if (!user?.id || isStandaloneOrderingScreen || localStorage.getItem(getAutoAcceptKey(user.id)) !== 'true') return;

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .or('status.eq.pending,acceptance_status.eq.pending_acceptance')
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) {
      console.warn('Não foi possível conferir pedidos pendentes para aceite automático:', error);
      return;
    }

    for (const order of data || []) {
      await acceptOrder(order);
    }
  }, [acceptOrder, isStandaloneOrderingScreen, user?.id]);

  useEffect(() => {
    loadEnabled();

    const handleStorage = (event: StorageEvent) => {
      if (!user?.id || event.key !== getAutoAcceptKey(user.id)) return;
      loadEnabled();
    };
    const handleCustom = () => {
      const next = loadEnabled();
      if (next) void scanPendingOrders();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('orders-auto-accept-changed', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('orders-auto-accept-changed', handleCustom);
    };
  }, [loadEnabled, scanPendingOrders, user?.id]);

  useEffect(() => {
    if (!user?.id || !enabled || isStandaloneOrderingScreen) return;

    void scanPendingOrders();
    const channel = supabase
      .channel(`global-order-auto-accept-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          void acceptOrder((payload as any)?.new);
        },
      )
      .subscribe();

    pollingRef.current = window.setInterval(() => {
      void scanPendingOrders();
    }, 12000);

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [acceptOrder, enabled, isStandaloneOrderingScreen, scanPendingOrders, user?.id]);
};
