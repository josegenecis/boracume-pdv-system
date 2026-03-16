import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Filter, Eye, Check, Clock, Truck, Phone, MapPin, Copy, ExternalLink, QrCode, MessageCircle, Printer, GripVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import OrderDetailsModal from '@/components/orders/OrderDetailsModal';
import OrdersBulkActionButton from '@/components/orders/OrdersBulkActionButton';
import PixPaymentModal from '@/components/payment/PixPaymentModal';
import { WhatsAppService } from '@/services/WhatsAppService';
import { PrinterService } from '@/utils/printerService';
import AdminPinDialog from '@/components/security/AdminPinDialog';
import { canCancelOrder, getLocalOperatorSession } from '@/services/operatorAuth';
import { verifyAdminPin } from '@/services/adminPin';
import { buildPublicTrackShareUrl } from '@/utils/publicUrl';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_latitude?: number;
  customer_longitude?: number;
  customer_location_accuracy?: number;
  google_maps_link?: string;
  order_type: string;
  status: string;
  acceptance_status?: string;
  total: number;
  delivery_fee?: number;
  payment_method: string;
  items: any[];
  created_at: string;
  estimated_time?: string;
  user_id?: string;
}

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(new Set());
  const [ordersView, setOrdersView] = useState<'list' | 'kanban'>('list');
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryDialogTab, setDeliveryDialogTab] = useState<'in_delivery' | 'delivered'>('in_delivery');
  const [bulkFinalizing, setBulkFinalizing] = useState(false);
  const [requireDriver, setRequireDriver] = useState(false);
  const [payoutMode, setPayoutMode] = useState<'delivery_fee' | 'fixed'>('delivery_fee');
  const [fixedPayout, setFixedPayout] = useState(0);
  const [deliveryPersonnel, setDeliveryPersonnel] = useState<Array<{ id: string; name: string; status?: string }>>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignOrderIds, setAssignOrderIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [assigningDriver, setAssigningDriver] = useState(false);

  // PIX Modal State
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixOrder, setPixOrder] = useState<Order | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { sendToKitchen } = useKitchenIntegration();
  const realtimeOkRef = useRef(false);

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

  useEffect(() => {
    if (user) {
      fetchOrders();

      let pollTimer: number | null = null;
      const startPolling = () => {
        if (pollTimer) return;
        pollTimer = window.setInterval(() => {
          if (document.visibilityState !== 'visible') return;
          if (realtimeOkRef.current) return;
          fetchOrders();
        }, 3000);
      };

      const stopPolling = () => {
        if (!pollTimer) return;
        window.clearInterval(pollTimer);
        pollTimer = null;
      };

      const channel = supabase
        .channel(`orders-changes-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔔 Novo pedido em tempo real:', payload);

            // Add new order to the list
            const newOrder = {
              ...payload.new,
              items: normalizeItems((payload as any)?.new?.items)
            } as Order;

            setOrders(prev => (prev.some(o => o.id === newOrder.id) ? prev : [newOrder, ...prev]));

            // Play notification sound (handled by useOrderNotifications)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('🔄 Pedido atualizado em tempo real:', payload);

            // Update order in the list
            setOrders(prev => prev.map(order =>
              order.id === payload.new.id
                ? { ...payload.new, items: normalizeItems((payload as any)?.new?.items) } as Order
                : order
            ));
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            realtimeOkRef.current = true;
            stopPolling();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeOkRef.current = false;
            startPolling();
          }
        });

      startPolling();

      return () => {
        stopPolling();
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const settingsRes = await supabase
          .from('delivery_settlement_settings' as any)
          .select('require_driver,payout_mode,fixed_payout')
          .eq('user_id', user.id)
          .maybeSingle();

        const settings = (settingsRes as any)?.data;
        const err = (settingsRes as any)?.error;
        if (err) throw err;

        if (!settings) {
          await supabase.from('delivery_settlement_settings' as any).insert({
            user_id: user.id,
            require_driver: false,
            payout_mode: 'delivery_fee',
            fixed_payout: 0
          });
          setRequireDriver(false);
          setPayoutMode('delivery_fee');
          setFixedPayout(0);
        } else {
          setRequireDriver(Boolean(settings.require_driver));
          setPayoutMode(settings.payout_mode === 'fixed' ? 'fixed' : 'delivery_fee');
          setFixedPayout(Math.max(0, Number(settings.fixed_payout) || 0));
        }
      } catch {
        const fromStorage = (() => {
          try {
            return JSON.parse(localStorage.getItem('boracume_delivery_settings') || '{}');
          } catch {
            return {};
          }
        })();
        setRequireDriver(Boolean(fromStorage?.require_driver));
        setPayoutMode(fromStorage?.payout_mode === 'fixed' ? 'fixed' : 'delivery_fee');
        setFixedPayout(Math.max(0, Number(fromStorage?.fixed_payout) || 0));
      }

      try {
        const { data } = await supabase
          .from('delivery_personnel')
          .select('id,name,status')
          .eq('user_id', user.id)
          .order('name');
        setDeliveryPersonnel(((data as any[]) || []).map(d => ({ id: String(d.id), name: String(d.name), status: d.status })));
      } catch {
        setDeliveryPersonnel([]);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchQuery, statusFilter, typeFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to ensure items is always an array
      const transformedData = (data || []).map(order => ({
        ...order,
        items: normalizeItems((order as any)?.items)
      }));

      setOrders(transformedData);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pedidos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: "Localização copiada para a área de transferência",
      });
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const copyLocation = async (order: Order) => {
    if (order.customer_latitude && order.customer_longitude) {
      const coordinates = `${order.customer_latitude},${order.customer_longitude}`;
      await copyToClipboard(coordinates);
    } else if (order.customer_address) {
      await copyToClipboard(order.customer_address);
    }
  };

  const openOrderDetails = (order: Order) => {

    console.log('🔍 ORDERS - Abrindo detalhes do pedido:', {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      status: order.status,
      items: order.items?.length || 0,
      timestamp: new Date().toISOString()
    });

    try {
      console.log('🔍 ORDERS - Dados completos do pedido:', JSON.stringify(order, null, 2));

      setSelectedOrder(order);
      setIsDetailsModalOpen(true);

      console.log('✅ ORDERS - Modal configurado para abrir:', {
        selectedOrderSet: !!order,
        modalOpen: true
      });
    } catch (error) {
      console.error('❌ ORDERS - Erro ao abrir detalhes do pedido:', error);
      toast({
        title: "Erro",
        description: "Erro ao abrir detalhes do pedido. Tente novamente.",
        variant: "destructive"
      });
    }

  };

  const filterOrders = () => {
    let filtered = orders;

    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.customer_phone && order.customer_phone.includes(searchQuery))
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'delivered') {
        filtered = filtered.filter(order => order.status === 'delivered' || order.status === 'completed');
      } else {
        filtered = filtered.filter(order => order.status === statusFilter);
      }
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(order => order.order_type === typeFilter);
    }

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderIds(prev => new Set([...prev, orderId]));
    try {

      console.log('🔄 Iniciando atualização do status do pedido:', { orderId, newStatus });

      // Validações iniciais
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('ID do pedido é obrigatório e deve ser uma string válida');
      }

      if (!newStatus || typeof newStatus !== 'string') {
        throw new Error('Novo status é obrigatório e deve ser uma string válida');
      }

      // Verificar se o usuário está logado
      if (!user?.id) {
        console.error('❌ Usuário não está logado');
        throw new Error('Usuário não está logado. Faça login novamente.');
      }

      console.log('✅ Usuário autenticado:', { userId: user.id, email: user.email });

      // Verificar se o pedido existe no estado local
      const existingOrder = orders.find(o => o.id === orderId);
      if (!existingOrder) {
        console.error('❌ Pedido não encontrado no estado local:', orderId);
        throw new Error(`Pedido com ID ${orderId} não encontrado`);
      }

      console.log('📋 Pedido encontrado:', {
        id: existingOrder.id,
        order_number: existingOrder.order_number,
        current_status: existingOrder.status,
        current_acceptance_status: existingOrder.acceptance_status
      });

      // Verificar se a mudança de status é válida
      const validStatuses = ['pending', 'preparing', 'ready', 'in_delivery', 'delivered', 'cancelled', 'completed'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Status '${newStatus}' não é válido. Status válidos: ${validStatuses.join(', ')}`);
      }


      // Atualizar tanto status quanto acceptance_status
      const updateData = newStatus === 'preparing'
        ? { status: newStatus, acceptance_status: 'accepted' }
        : newStatus === 'cancelled'
          ? { status: newStatus, acceptance_status: 'rejected' }
          : { status: newStatus };

      console.log('📝 Dados para update:', updateData);


      console.log('🔄 Executando update no Supabase...');

      // Verificar conexão com Supabase antes do update
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('❌ Erro de autenticação no Supabase:', authError);
        throw new Error(`Erro de autenticação: ${authError.message}`);
      }

      if (!currentUser) {
        console.error('❌ Usuário não autenticado no Supabase');
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      let data: any = null;
      let error: any = null;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';

      const directUpdate = async () => {
        return await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId)
          .eq('user_id', user?.id)
          .select()
          .single();
      };

      const ef = await supabase.functions
        .invoke('orders-update-status', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          body: { orderId, newStatus, id: orderId, status: newStatus }
        })
        .catch((e: any) => ({ data: null, error: e })) as any;

      if (ef?.data?.ok && ef?.data?.order) {
        data = ef.data.order;
      } else {
        const res = await directUpdate();
        data = (res as any).data;
        error = (res as any).error;
        if (!data && !error) {
          if (ef?.error) {
            error = ef.error;
          } else if (ef?.data?.ok === false) {
            const detailsMsg = ef.data?.details?.message ? `: ${ef.data.details.message}` : '';
            error = { message: `${ef.data.error || 'edge_function_error'}${detailsMsg}`, code: 'EDGE_FN', details: ef.data };
          }
        }
      }

      if (error) {
        console.error('❌ Erro detalhado do Supabase:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          orderId,
          userId: user?.id,
          updateData
        });

        // Mensagens de erro mais específicas
        let errorMessage = 'Erro desconhecido ao atualizar pedido';

        if (error.code === 'PGRST116') {
          errorMessage = 'Pedido não encontrado ou você não tem permissão para atualizá-lo';
        } else if (error.code === '42501') {
          errorMessage = 'Permissão negada. Verifique suas credenciais.';
        } else if (error.message.includes('connection') || error.message.includes('network')) {
          errorMessage = 'Erro de conexão com o banco de dados. Verifique sua internet e tente novamente.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Timeout na operação. Tente novamente em alguns segundos.';
        } else {
          errorMessage = `Erro do banco: ${error.message}`;
        }

        throw new Error(errorMessage);
      }

      if (!data) {
        console.error('❌ Nenhum dado retornado do update');
        throw new Error('Pedido não foi atualizado. Verifique se você tem permissão.');
      }

      console.log('✅ Status atualizado no banco de dados:', data);

      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, ...updateData }
          : order
      ));

      // Buscar o pedido para enviar para KDS quando aceito
      const order = orders.find(o => o.id === orderId);

      // Se status mudou para 'preparing', enviar para KDS
      if (newStatus === 'preparing' && order) {
        toast({
          title: "Pedido aceito!",
          description: "Status atualizado com sucesso.",
        });

        const orderData = {
          user_id: order.user_id || user?.id || '',
          order_number: order.order_number,
          customer_name: order.customer_name || 'Cliente não informado',
          customer_phone: order.customer_phone || '',
          items: order.items,
          total: order.total,
          payment_method: order.payment_method,
          order_type: order.order_type
        };

        sendToKitchen(orderData).catch(() => {
          toast({
            title: "Aviso",
            description: "Pedido aceito, mas não foi possível enviar para a cozinha.",
            variant: "destructive"
          });
        });

        PrinterService.printOrderOnAccept(order);

        (async () => {
          try {
            if (!order.customer_phone || !user?.id) return;
            const { data: wa } = await supabase
              .from('whatsapp_settings')
              .select('enabled')
              .eq('user_id', user.id)
              .maybeSingle();
            if (!wa?.enabled) return;
            const digits = String(order.customer_phone).replace(/\D/g, '');
            const to = digits.startsWith('55') ? digits : `55${digits}`;
            const trackUrl = buildPublicTrackShareUrl(order.id, { userId: order.user_id || user.id, orderNumber: order.order_number });
            await supabase.functions.invoke('whatsapp-notify', {
              body: {
                to,
                text: `Seu pedido ${order.order_number} foi aceito e está sendo preparado. Acompanhe: ${trackUrl}`
              }
            });
          } catch {}
        })();
      } else {
        // Notificar mudanças relevantes
        (async () => {
          try {
            if (!order?.customer_phone || !user?.id) return;
            const { data: wa } = await supabase
              .from('whatsapp_settings')
              .select('enabled')
              .eq('user_id', user.id)
              .maybeSingle();
            if (!wa?.enabled) return;
            const digits = String(order.customer_phone).replace(/\D/g, '');
            const to = digits.startsWith('55') ? digits : `55${digits}`;
            const trackUrl = buildPublicTrackShareUrl(order.id, { userId: order.user_id || user.id, orderNumber: order.order_number });
            const msgByStatus: Record<string, string> = {
              ready: `Seu pedido ${order?.order_number} está pronto! Acompanhe: ${trackUrl}`,
              delivered: `Seu pedido ${order?.order_number} saiu para entrega. Acompanhe: ${trackUrl}`,
              cancelled: `Seu pedido ${order?.order_number} foi cancelado. Se for engano, entre em contato.`
            };
            const text = msgByStatus[newStatus];
            if (!text) return;
            await supabase.functions.invoke('whatsapp-notify', {
              body: { to, text }
            });
          } catch {}
        })();
        toast({
          title: "Status atualizado",
          description: `Status do pedido atualizado com sucesso.`,
        });
      }

    } catch (error: any) {

      console.error('❌ Erro completo ao atualizar status:', {
        error,
        message: error?.message,
        stack: error?.stack,
        orderId,
        newStatus
      });

      const errorMessage = error?.message || 'Erro desconhecido';

      toast({
        title: "Erro ao atualizar pedido",
        description: `Não foi possível atualizar o status: ${errorMessage}`,

        variant: "destructive"
      });

      if (
        String(errorMessage).includes('Permissão') ||
        String(errorMessage).includes('Pedido não encontrado') ||
        String(errorMessage).includes('RLS')
      ) {
        alert(
          `Não foi possível aceitar o pedido por permissão no banco.\n\n` +
            `A correção é aplicar as policies de UPDATE/SELECT na tabela orders.\n` +
            `Rode a migration: supabase/migrations/20260210152000_orders_rls_authenticated_policies.sql`
        );
      }
    } finally {
      setUpdatingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const requestCancelOrder = async (orderId: string) => {
    const session = getLocalOperatorSession();
    if (canCancelOrder(session)) {
      await updateOrderStatus(orderId, 'cancelled');
      return;
    }
    setPendingCancelId(orderId);
    setAdminPinOpen(true);
  };

  const updateOrderInDeliveryWithDriver = async (orderId: string, driverId: string) => {
    if (!user?.id) return;
    const order = orders.find(o => o.id === orderId);
    const payoutAmount =
      payoutMode === 'fixed'
        ? Math.max(0, Number(fixedPayout) || 0)
        : Math.max(0, Number((order as any)?.delivery_fee) || 0);
    try {
      const payload = {
        status: 'in_delivery',
        delivery_personnel_id: driverId,
        delivery_assigned_at: new Date().toISOString(),
        delivery_payout_amount: payoutAmount
      };
      const { data, error } = await supabase
        .from('orders' as any)
        .update(payload as any)
        .eq('id', orderId)
        .eq('user_id', user.id);
      if (error) throw error;
      if (data) {
        setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, ...(payload as any) } : o)));
      }
    } catch (e: any) {
      const code = String(e?.code || '');
      const msg = String(e?.message || '');
      const isMissingColumn =
        code === '42703' ||
        code === 'PGRST204' ||
        msg.toLowerCase().includes('schema cache') ||
        msg.toLowerCase().includes('could not find the') ||
        msg.toLowerCase().includes('column') && msg.toLowerCase().includes('does not exist');

      if (isMissingColumn) {
        toast({
          title: 'Banco ainda não reconheceu as colunas',
          description: 'No Supabase, recarregue o Schema Cache (Database → API → Reload schema cache) e tente novamente.',
          variant: 'destructive'
        });
        throw e;
      }

      toast({
        title: 'Erro ao atribuir motoboy',
        description: msg || 'Não foi possível atualizar o pedido.',
        variant: 'destructive'
      });
      throw e;
    }
  };

  const requestInDelivery = async (orderIds: string[]) => {
    const deliveryOrderIds = orderIds.filter(id => {
      const o = orders.find(x => x.id === id);
      return String((o as any)?.order_type || '') === 'delivery';
    });
    const otherIds = orderIds.filter(id => !deliveryOrderIds.includes(id));

    if (otherIds.length > 0) {
      await Promise.all(otherIds.map(id => updateOrderStatus(id, 'in_delivery')));
    }

    if (deliveryOrderIds.length === 0) return;

    if (deliveryPersonnel.length === 0) {
      if (!requireDriver) {
        await Promise.all(deliveryOrderIds.map(id => updateOrderStatus(id, 'in_delivery')));
        return;
      }
      toast({
        title: 'Cadastre um motoboy',
        description: 'Para enviar para rota, cadastre pelo menos 1 entregador em Entregadores.',
        variant: 'destructive'
      });
      return;
    }

    setAssignOrderIds(deliveryOrderIds);
    setSelectedDriverId('');
    setAssignDialogOpen(true);
  };

  const onKanbanDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const orderId = result.draggableId;
    const dest = result.destination.droppableId;
    if (dest === result.source.droppableId) return;
    if (dest === 'pending') return;
    if (dest === 'cancelled') {
      await requestCancelOrder(orderId);
      return;
    }
    if (dest === 'in_delivery') {
      await requestInDelivery([orderId]);
      return;
    }
    await updateOrderStatus(orderId, dest);
  };

  const handleBulkAction = async (orderIds: string[], action: string) => {
    try {
      console.log(`🔄 Executando ação em massa: ${action} para ${orderIds.length} pedidos`);

      let updatePromises = [];

      switch (action) {
        case 'accept_all':
          // Aceitar todos os pedidos e enviar para KDS
          updatePromises = orderIds.map(async (orderId) => {
            await updateOrderStatus(orderId, 'preparing');
          });
          break;

        case 'ready_all':
          // Marcar todos como prontos
          updatePromises = orderIds.map(async (orderId) => {
            await updateOrderStatus(orderId, 'ready');
          });
          break;

        case 'deliver_all':
          // Saiu para entrega (todos os prontos)
          await requestInDelivery(orderIds);
          updatePromises = [];
          break;
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
      console.log(`✅ Ação em massa ${action} concluída com sucesso`);

    } catch (error) {
      console.error('❌ Erro na ação em massa:', error);
      throw error;
    }
  };

  const finalizeAllInDelivery = async () => {
    if (inDeliveryOrders.length === 0) return;
    try {
      setBulkFinalizing(true);
      await Promise.all(inDeliveryOrders.map((o) => updateOrderStatus(o.id, 'delivered')));
      setDeliveryDialogTab('delivered');
      toast({ title: 'Finalizado', description: 'Todos os pedidos em entrega foram finalizados.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message || 'Não foi possível finalizar todos.', variant: 'destructive' });
    } finally {
      setBulkFinalizing(false);
    }
  };

  const handlePixPayment = (order: Order) => {
    setPixOrder(order);
    setIsPixModalOpen(true);
  };

  const handleWhatsAppShare = (order: Order) => {
    WhatsAppService.shareOrder(order);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      accepted: { label: 'Em preparo', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      preparing: { label: 'Preparando', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      ready: { label: 'Pronto', className: 'bg-green-100 text-green-800 border-green-200' },
      in_delivery: { label: 'Em entrega', className: 'bg-purple-100 text-purple-800 border-purple-200' },
      delivered: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800 border-red-200' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Truck size={16} className="text-blue-600" />;
      case 'pickup':
        return <Clock size={16} className="text-green-600" />;
      case 'dine_in':
        return <div className="w-4 h-4 bg-orange-600 rounded-sm" />;
      default:
        return null;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery':
        return 'Entrega';
      case 'pickup':
        return 'Retirada';
      case 'dine_in':
        return 'No Local';
      default:
        return type;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const pendingOrders = filteredOrders.filter(order => order.acceptance_status === 'pending_acceptance' || order.status === 'pending');
  const activeOrders = filteredOrders.filter(order => order.status === 'accepted' || order.status === 'preparing');
  const completedOrders = filteredOrders.filter(order => order.status === 'ready' || order.status === 'in_delivery');
  const inDeliveryOrders = filteredOrders.filter(order => order.status === 'in_delivery');
  const deliveredOrders = filteredOrders.filter(order => order.status === 'delivered' || order.status === 'completed');
  const cancelledOrders = filteredOrders.filter(order => order.status === 'cancelled');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="space-y-6">
        <AdminPinDialog
          open={adminPinOpen}
          title="Cancelar pedido"
          description="Somente administrador pode cancelar. Digite o PIN do administrador."
          confirmLabel="Cancelar"
          onCancel={() => { setAdminPinOpen(false); setPendingCancelId(null); }}
          onConfirm={async (pin) => {
            const restaurantUserId = user?.id || '';
            if (!restaurantUserId) {
              toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
              return;
            }
            const res = await verifyAdminPin({ restaurantUserId, pin });
            if (!res.ok) {
              toast({ title: 'Sem permissão', description: 'PIN inválido ou não é administrador', variant: 'destructive' });
              return;
            }
            if (pendingCancelId) await updateOrderStatus(pendingCancelId, 'cancelled');
            setAdminPinOpen(false);
            setPendingCancelId(null);
          }}
        />
        <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Entregas e Despachados</DialogTitle>
            </DialogHeader>
            <Tabs value={deliveryDialogTab} onValueChange={(v) => setDeliveryDialogTab(v as any)}>
              <TabsList>
                <TabsTrigger value="in_delivery">Em entrega ({inDeliveryOrders.length})</TabsTrigger>
                <TabsTrigger value="delivered">Despachados ({deliveredOrders.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="in_delivery" className="mt-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-sm text-muted-foreground">Pedidos que saíram para entrega</div>
                  <Button onClick={finalizeAllInDelivery} disabled={bulkFinalizing || inDeliveryOrders.length === 0}>
                    Finalizar todos
                  </Button>
                </div>
                <div className="max-h-[65vh] overflow-y-auto space-y-3 pr-1">
                  {inDeliveryOrders.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Nenhum pedido em entrega</div>
                  ) : (
                    inDeliveryOrders.map((order) => (
                      <Card key={order.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold">Pedido {order.order_number}</div>
                              <div className="text-sm text-muted-foreground truncate">{order.customer_name}</div>
                              <div className="text-sm text-muted-foreground">{formatCurrency(order.total)}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateOrderStatus(order.id, 'preparing')}
                              >
                                Voltar produção
                              </Button>
                              <Button size="sm" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                                Finalizar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="delivered" className="mt-4">
                <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
                  {deliveredOrders.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Nenhum pedido despachado</div>
                  ) : (
                    deliveredOrders.map((order) => (
                      <Card key={order.id} className="border-l-4 border-l-gray-400 cursor-pointer" onClick={() => openOrderDetails(order)}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold">Pedido {order.order_number}</div>
                              <div className="text-sm text-muted-foreground truncate">{order.customer_name}</div>
                              <div className="text-sm text-muted-foreground">{formatCurrency(order.total)}</div>
                            </div>
                            {getStatusBadge(order.status)}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <div className="flex items-center gap-2">
            <Tabs value={ordersView} onValueChange={(v) => setOrdersView(v as any)}>
              <TabsList>
                <TabsTrigger value="list">Lista</TabsTrigger>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              onClick={() => {
                setDeliveryDialogOpen(true);
                setDeliveryDialogTab('in_delivery');
              }}
            >
              Entregas/Despachados
            </Button>
            <Button onClick={fetchOrders} variant="outline">
              Atualizar
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por número, cliente ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="preparing">Preparando</SelectItem>
                  <SelectItem value="ready">Pronto</SelectItem>
                  <SelectItem value="in_delivery">Saiu para Entrega</SelectItem>
                  <SelectItem value="delivered">Finalizado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="delivery">Entrega</SelectItem>
                  <SelectItem value="pickup">Retirada</SelectItem>
                  <SelectItem value="dine_in">No Local</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {ordersView === 'kanban' ? (
          <DragDropContext onDragEnd={(r) => { void onKanbanDragEnd(r); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { id: 'pending', title: 'Pendentes', items: pendingOrders, headerClass: 'bg-yellow-50 border-yellow-500 text-yellow-800' },
                { id: 'preparing', title: 'Em preparo', items: activeOrders, headerClass: 'bg-blue-50 border-blue-500 text-blue-800' },
                { id: 'in_delivery', title: 'Em entrega', items: completedOrders, headerClass: 'bg-purple-50 border-purple-500 text-purple-800' },
              ].map((col) => (
                <div key={col.id} className="space-y-3">
                  <div className={`p-3 rounded-lg border-l-4 ${col.headerClass}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold">{col.title}</h2>
                      <span className="text-sm font-semibold">{col.items.length}</span>
                    </div>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(droppableProvided) => (
                      <div
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                        className="min-h-[180px] space-y-3"
                      >
                        {col.items.map((order, index) => (
                          <Draggable key={order.id} draggableId={order.id} index={index}>
                            {(draggableProvided) => (
                              <div ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                                <Card className="hover:shadow-sm transition-shadow">
                                  <CardContent className="p-3" onClick={() => openOrderDetails(order)}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="font-semibold text-sm truncate">Pedido {order.order_number}</div>
                                        <div className="text-xs text-muted-foreground truncate">{order.customer_name}</div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <button
                                          type="button"
                                          {...draggableProvided.dragHandleProps}
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center justify-center w-7 h-7 rounded border text-muted-foreground cursor-grab active:cursor-grabbing"
                                          title="Arraste para mudar status"
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </button>
                                        {getStatusBadge(order.status)}
                                        <div className="text-xs font-semibold">{formatCurrency(order.total)}</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        {getOrderTypeIcon(order.order_type)}
                                        <span>{getOrderTypeLabel(order.order_type)}</span>
                                      </div>
                                      <span>{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {droppableProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        ) : (
        <>
        {/* Orders Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pendentes */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-yellow-800">Pendentes ({pendingOrders.length})</h2>
              </div>
              <div className="w-full sm:w-auto">
                <OrdersBulkActionButton
                  orderIds={pendingOrders.map(o => o.id)}
                  action="accept_all"
                  onBulkAction={handleBulkAction}
                />
              </div>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum pedido pendente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-yellow-500 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4" onClick={() => openOrderDetails(order)}>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold min-w-0 break-words">Pedido {order.order_number}</h3>
                          {getStatusBadge(order.status)}
                          <div className="flex items-center gap-1 min-w-0">
                            {getOrderTypeIcon(order.order_type)}
                            <span className="text-sm text-gray-600">
                              {getOrderTypeLabel(order.order_type)}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          <div className="font-medium">{order.customer_name}</div>
                          {order.customer_phone && (
                            <div className="flex items-center gap-1">
                              <Phone size={14} />
                              {order.customer_phone}
                            </div>
                          )}
                          <div>{formatDate(order.created_at)}</div>
                        </div>

                        {order.customer_address && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>{order.customer_address}</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyLocation(order);
                                }}
                                className="h-7 text-xs w-full sm:flex-1"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copiar
                              </Button>

                              {order.google_maps_link && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(order.google_maps_link, '_blank');
                                  }}
                                  className="h-7 text-xs w-full sm:flex-1"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Maps
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="text-sm text-gray-600">
                          {order.items.length} item(s) • {formatCurrency(order.total)} •
                          <span className="font-medium"> {order.payment_method.toUpperCase()}</span>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              PrinterService.printOrder(order);
                            }}
                          >
                            <Printer className="h-3 w-3 mr-1" />
                            Imprimir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWhatsAppShare(order);
                            }}
                          >
                            <MessageCircle className="h-3 w-3 mr-1" />
                            WhatsApp
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'preparing');
                            }}
                            className="w-full sm:flex-1 bg-green-600 hover:bg-green-700"
                            disabled={updatingOrderIds.has(order.id)}
                          >
                            {updatingOrderIds.has(order.id) ? 'Aceitando...' : 'Aceitar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestCancelOrder(order.id);
                            }}
                            className="w-full sm:flex-1"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Em preparo */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-blue-800">Em preparo ({activeOrders.length})</h2>
              </div>
              <div className="w-full sm:w-auto">
                <OrdersBulkActionButton
                  orderIds={activeOrders.map(o => o.id)}
                  action="ready_all"
                  onBulkAction={handleBulkAction}
                />
              </div>
            </div>

            {activeOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum pedido em preparo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4" onClick={() => openOrderDetails(order)}>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold min-w-0 break-words">Pedido {order.order_number}</h3>
                          {getStatusBadge(order.status)}
                          <div className="flex items-center gap-1 min-w-0">
                            {getOrderTypeIcon(order.order_type)}
                            <span className="text-sm text-gray-600">
                              {getOrderTypeLabel(order.order_type)}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          <div className="font-medium">{order.customer_name}</div>
                          {order.customer_phone && (
                            <div className="flex items-center gap-1">
                              <Phone size={14} />
                              {order.customer_phone}
                            </div>
                          )}
                          <div>{formatDate(order.created_at)}</div>
                        </div>

                        {order.customer_address && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>{order.customer_address}</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyLocation(order);
                                }}
                                className="h-7 text-xs w-full sm:flex-1"
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copiar
                              </Button>

                              {order.google_maps_link && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(order.google_maps_link, '_blank');
                                  }}
                                  className="h-7 text-xs w-full sm:flex-1"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Maps
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="text-sm text-gray-600">
                          {order.items.length} item(s) • {formatCurrency(order.total)} •
                          <span className="font-medium"> {order.payment_method.toUpperCase()}</span>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              PrinterService.printOrder(order);
                            }}
                          >
                            <Printer className="h-3 w-3 mr-1" />
                            Imprimir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWhatsAppShare(order);
                            }}
                          >
                            <MessageCircle className="h-3 w-3 mr-1" />
                            WhatsApp
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'ready');
                            }}
                            className="w-full sm:flex-1"
                          >
                            Marcar Pronto
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'delivered');
                            }}
                            className="w-full sm:flex-1"
                          >
                            Finalizar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Em entrega */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-purple-800">Em entrega ({completedOrders.length})</h2>
              </div>
              <div className="w-full sm:w-auto">
                <OrdersBulkActionButton
                  orderIds={completedOrders.map(o => o.id)}
                  action="deliver_all"
                  onBulkAction={handleBulkAction}
                />
              </div>
            </div>

            {completedOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum pedido para entrega</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedOrders.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4" onClick={() => openOrderDetails(order)}>
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold min-w-0 break-words">Pedido {order.order_number}</h3>
                          {getStatusBadge(order.status)}
                          <div className="flex items-center gap-1 min-w-0">
                            {getOrderTypeIcon(order.order_type)}
                            <span className="text-sm text-gray-600">
                              {getOrderTypeLabel(order.order_type)}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          <div className="font-medium">{order.customer_name}</div>
                          {order.customer_phone && (
                            <div className="flex items-center gap-1">
                              <Phone size={14} />
                              {order.customer_phone}
                            </div>
                          )}
                          <div>{formatDate(order.created_at)}</div>
                        </div>

                        <div className="text-sm text-gray-600">
                          {order.items.length} item(s) • {formatCurrency(order.total)} •
                          <span className="font-medium"> {order.payment_method.toUpperCase()}</span>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          {order.status !== 'in_delivery' ? (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestInDelivery([order.id]);
                              }}
                              className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              Saiu para entrega
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateOrderStatus(order.id, 'delivered');
                              }}
                              className="w-full sm:flex-1 bg-green-600 hover:bg-green-700"
                            >
                              Finalizar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        </>
        )}

        <Dialog open={assignDialogOpen} onOpenChange={(open) => { if (!assigningDriver) setAssignDialogOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Selecionar motoboy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {assignOrderIds.length} pedido(s) para sair para entrega.
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Entregador</div>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motoboy" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryPersonnel.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={assigningDriver}
                  onClick={() => {
                    setAssignDialogOpen(false);
                    setAssignOrderIds([]);
                    setSelectedDriverId('');
                  }}
                >
                  Cancelar
                </Button>
                {!requireDriver && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={assigningDriver}
                    onClick={async () => {
                      try {
                        setAssigningDriver(true);
                        await Promise.all(assignOrderIds.map((id) => updateOrderStatus(id, 'in_delivery')));
                        setAssignDialogOpen(false);
                        setAssignOrderIds([]);
                        setSelectedDriverId('');
                      } finally {
                        setAssigningDriver(false);
                      }
                    }}
                  >
                    Continuar sem motoboy
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={assigningDriver}
                  onClick={async () => {
                    if (!selectedDriverId) {
                      toast({ title: 'Selecione um motoboy', description: 'Escolha um entregador para continuar.', variant: 'destructive' });
                      return;
                    }
                    try {
                      setAssigningDriver(true);
                      await Promise.all(assignOrderIds.map((id) => updateOrderInDeliveryWithDriver(id, selectedDriverId)));
                      setAssignDialogOpen(false);
                      setAssignOrderIds([]);
                      setSelectedDriverId('');
                      toast({ title: 'Saiu para entrega', description: 'Motoboy atribuído com sucesso.' });
                    } finally {
                      setAssigningDriver(false);
                    }
                  }}
                  className="bg-boracume-orange hover:bg-boracume-orange/90"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Detalhes */}
        <OrderDetailsModal
          order={selectedOrder}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedOrder(null);
          }}
          onStatusChange={updateOrderStatus}
        />
      </div>
    </div>
  );
};

export default Orders;
