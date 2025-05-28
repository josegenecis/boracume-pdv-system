import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Phone, MapPin, Clock, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import OrderStatusBadge, { OrderStatusType } from '@/components/orders/OrderStatusBadge';
import type { Json } from '@/integrations/supabase/types';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: any[];
  total: number;
  payment_method: string;
  status: OrderStatusType;
  created_at: string;
  updated_at: string;
}

// Type for raw order data from Supabase
interface RawOrder {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  items: Json;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  change_amount: number | null;
}

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // Set up real-time subscription for new orders
      const channel = supabase
        .channel('orders-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Order change detected:', payload);
            if (payload.eventType === 'INSERT') {
              toast({
                title: "Novo Pedido!",
                description: `Pedido de ${payload.new.customer_name} foi recebido.`,
              });
            }
            fetchOrders();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform raw orders to match our Order interface
      const transformedOrders: Order[] = (data as RawOrder[] || []).map(order => ({
        id: order.id,
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        customer_address: order.customer_address || '',
        items: Array.isArray(order.items) ? order.items : [],
        total: order.total,
        payment_method: order.payment_method,
        status: order.status as OrderStatusType,
        created_at: order.created_at,
        updated_at: order.updated_at,
      }));

      setOrders(transformedOrders);
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

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatusType) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      toast({
        title: "Status atualizado!",
        description: "O status do pedido foi atualizado com sucesso.",
      });

      fetchOrders();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.includes(searchQuery) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusCounts = () => {
    return {
      all: orders.length,
      new: orders.filter(o => o.status === 'new').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      in_delivery: orders.filter(o => o.status === 'in_delivery').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
    };
  };

  const statusCounts = getStatusCounts();

  const statusOptions: { value: OrderStatusType; label: string }[] = [
    { value: 'confirmed', label: 'Confirmar' },
    { value: 'preparing', label: 'Preparando' },
    { value: 'ready', label: 'Pronto' },
    { value: 'in_delivery', label: 'Em Entrega' },
    { value: 'delivered', label: 'Entregue' },
    { value: 'cancelled', label: 'Cancelar' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Total: {orders.length}</span>
          {statusCounts.new > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {statusCounts.new} novos
            </Badge>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 relative">
        <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        <Input 
          placeholder="Buscar por cliente, telefone ou ID do pedido..." 
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Status Tabs */}
      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-1">
          <TabsTrigger value="all" className="text-xs">
            Todos ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="new" className="text-xs">
            Novos ({statusCounts.new})
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="text-xs">
            Confirmados ({statusCounts.confirmed})
          </TabsTrigger>
          <TabsTrigger value="preparing" className="text-xs">
            Preparando ({statusCounts.preparing})
          </TabsTrigger>
          <TabsTrigger value="ready" className="text-xs">
            Prontos ({statusCounts.ready})
          </TabsTrigger>
          <TabsTrigger value="in_delivery" className="text-xs">
            Em Entrega ({statusCounts.in_delivery})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs">
            Entregues ({statusCounts.delivered})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="text-xs">
            Cancelados ({statusCounts.cancelled})
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium">Nenhum pedido encontrado</h3>
              <p className="text-gray-600">
                {orders.length === 0 
                  ? "Aguardando o primeiro pedido..."
                  : "Tente ajustar os filtros de busca."
                }
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">#{order.id.slice(-8)}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(order.created_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Cliente</h4>
                        <p className="text-sm">{order.customer_name}</p>
                        <p className="text-sm flex items-center gap-1 text-gray-600">
                          <Phone className="w-3 h-3" />
                          {order.customer_phone}
                        </p>
                        <p className="text-sm flex items-center gap-1 text-gray-600">
                          <MapPin className="w-3 h-3" />
                          {order.customer_address}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Pagamento</h4>
                        <Badge variant="outline">
                          {order.payment_method === 'credit' && 'Cartão de Crédito'}
                          {order.payment_method === 'pix' && 'PIX'}
                          {order.payment_method === 'cash' && 'Dinheiro'}
                        </Badge>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div>
                      <h4 className="font-semibold mb-2">Itens do Pedido</h4>
                      <div className="space-y-2">
                        {order.items.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span>{formatCurrency(item.price * item.quantity)}</span>
                          </div>
                        ))}
                        <div className="border-t pt-2 flex justify-between items-center font-semibold">
                          <span>Total:</span>
                          <span>{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Actions */}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <div>
                        <h4 className="font-semibold mb-2">Ações</h4>
                        <div className="flex gap-2 flex-wrap">
                          {statusOptions
                            .filter(option => option.value !== order.status)
                            .map((option) => (
                              <Button
                                key={option.value}
                                variant="outline"
                                size="sm"
                                onClick={() => updateOrderStatus(order.id, option.value)}
                              >
                                {option.label}
                              </Button>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default Orders;
