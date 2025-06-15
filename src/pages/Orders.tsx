import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Eye, Check, Clock, Truck, Phone, MapPin, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import OrderDetailsModal from '@/components/orders/OrderDetailsModal';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendToKitchen } = useKitchenIntegration();
  
  // Ativar notificações de pedidos
  useOrderNotifications();

  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // Setup real-time subscription for new orders
      const channel = supabase
        .channel('orders-changes')
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
              items: Array.isArray(payload.new.items) ? payload.new.items : []
            } as Order;
            
            setOrders(prev => [newOrder, ...prev]);
            
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
                ? { ...payload.new, items: Array.isArray(payload.new.items) ? payload.new.items : [] } as Order
                : order
            ));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

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
        items: Array.isArray(order.items) ? order.items : []
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
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
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
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(order => order.order_type === typeFilter);
    }

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      console.log('🔄 Atualizando status do pedido:', { orderId, newStatus });
      
      // Atualizar tanto status quanto acceptance_status
      const updateData = newStatus === 'preparing' 
        ? { status: newStatus, acceptance_status: 'accepted' }
        : { status: newStatus };
        
      console.log('📝 Dados para update:', updateData);

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      console.log('✅ Status atualizado no banco de dados');

      // Buscar o pedido para enviar para KDS quando aceito
      const order = orders.find(o => o.id === orderId);
      
      // Se status mudou para 'preparing', enviar para KDS
      if (newStatus === 'preparing' && order) {
        try {
          console.log('🔄 Enviando pedido aceito para KDS:', order.order_number);
          
          const orderData = {
            user_id: order.user_id || user?.id || '',
            order_number: order.order_number,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            items: order.items,
            total: order.total,
            payment_method: order.payment_method,
            order_type: order.order_type
          };
          
          await sendToKitchen(orderData);
          console.log('✅ Pedido enviado para KDS com sucesso');
          
          toast({
            title: "Pedido aceito!",
            description: "Pedido enviado para a cozinha com sucesso",
          });
        } catch (kdsError) {
          console.error('❌ Erro ao enviar para KDS:', kdsError);
          toast({
            title: "Aviso",
            description: "Pedido aceito, mas houve erro ao enviar para a cozinha. Verifique o sistema KDS.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Status atualizado",
          description: `Status do pedido atualizado com sucesso.`,
        });
      }

      // Atualizar estado local com todos os campos atualizados
      setOrders(prev => prev.map(order =>
        order.id === orderId 
          ? { ...order, ...updateData }
          : order
      ));

    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      preparing: { label: 'Preparando', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      ready: { label: 'Pronto', className: 'bg-green-100 text-green-800 border-green-200' },
      delivered: { label: 'Entregue', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      completed: { label: 'Finalizado', className: 'bg-green-100 text-green-800 border-green-200' },
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

  const pendingOrders = filteredOrders.filter(order => order.acceptance_status === 'pending_acceptance');
  const activeOrders = filteredOrders.filter(order => order.status === 'preparing');
  const completedOrders = filteredOrders.filter(order => order.status === 'ready');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] overflow-y-auto">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <Button onClick={fetchOrders} variant="outline">
            Atualizar
          </Button>
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
                  <SelectItem value="completed">Finalizado</SelectItem>
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

        {/* Orders Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Novos (Pendentes) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-yellow-800">Novos ({pendingOrders.length})</h2>
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
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">#{order.order_number}</h3>
                          {getStatusBadge(order.status)}
                          <div className="flex items-center gap-1">
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
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyLocation(order);
                                }}
                                className="h-7 text-xs flex-1"
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
                                  className="h-7 text-xs flex-1"
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

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'preparing');
                            }}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            Aceitar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'cancelled');
                            }}
                            className="flex-1"
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

          {/* Ativos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-blue-800">Ativos ({activeOrders.length})</h2>
            </div>

            {activeOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum pedido ativo</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4" onClick={() => openOrderDetails(order)}>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">#{order.order_number}</h3>
                          {getStatusBadge(order.status)}
                          <div className="flex items-center gap-1">
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
                            
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyLocation(order);
                                }}
                                className="h-7 text-xs flex-1"
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
                                  className="h-7 text-xs flex-1"
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

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'ready');
                            }}
                            className="flex-1"
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
                            className="flex-1"
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

          {/* Prontos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-green-800">Prontos ({completedOrders.length})</h2>
            </div>

            {completedOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum pedido pronto</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedOrders.map((order) => (
                  <Card key={order.id} className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4" onClick={() => openOrderDetails(order)}>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">#{order.order_number}</h3>
                          {getStatusBadge(order.status)}
                          <div className="flex items-center gap-1">
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

                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrderStatus(order.id, 'delivered');
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            Saiu para Entrega
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

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
