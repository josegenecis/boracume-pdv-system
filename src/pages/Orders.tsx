
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Package, User, Phone, MapPin, DollarSign, Receipt } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NFCeEmissionModal from '@/components/nfce/NFCeEmissionModal';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  status: string;
  order_type: string;
  total: number;
  items: any[];
  variations?: any[];
  created_at: string;
  estimated_delivery_time?: string;
  delivery_instructions?: string;
  payment_method: string;
  status_color?: string;
}

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showNFCeModal, setShowNFCeModal] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const processedOrders: Order[] = (data || []).map(order => ({
        ...order,
        items: Array.isArray(order.items) 
          ? order.items 
          : (typeof order.items === 'string' 
              ? JSON.parse(order.items) 
              : (order.items ? [order.items] : [])),
        variations: Array.isArray(order.variations) 
          ? order.variations 
          : (typeof order.variations === 'string' 
              ? JSON.parse(order.variations) 
              : [])
      }));

      setOrders(processedOrders);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os pedidos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: 'Status do pedido foi atualizado com sucesso.',
      });

      fetchOrders();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status do pedido.',
        variant: 'destructive',
      });
    }
  };

  const handleEmitirNFCe = (order: Order) => {
    setSelectedOrder(order);
    setShowNFCeModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'preparing': return '#EF4444';
      case 'ready': return '#10B981';
      case 'out_for_delivery': return '#8B5CF6';
      case 'delivered': return '#059669';
      case 'completed': return '#059669';
      case 'cancelled': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'confirmed': return 'Confirmado';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Pronto';
      case 'out_for_delivery': return 'Saiu para entrega';
      case 'delivered': return 'Entregue';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getVariationsText = (item: any) => {
    if (!item.variations || item.variations.length === 0) return '';
    
    return item.variations.map((variation: any) => {
      if (Array.isArray(variation.selection)) {
        return variation.selection.map((sel: any) => sel.name).join(', ');
      } else if (variation.selection) {
        return variation.selection.name;
      }
      return '';
    }).filter(Boolean).join(' | ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="preparing">Preparando</SelectItem>
            <SelectItem value="ready">Pronto</SelectItem>
            <SelectItem value="out_for_delivery">Saiu para entrega</SelectItem>
            <SelectItem value="delivered">Entregue</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium mb-2">Nenhum pedido encontrado</p>
            <p className="text-muted-foreground">
              {statusFilter === 'all' 
                ? 'Quando você receber pedidos, eles aparecerão aqui.'
                : 'Nenhum pedido encontrado com o status selecionado.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card 
              key={order.id} 
              className="overflow-hidden"
              style={{ borderLeft: `4px solid ${getStatusColor(order.status)}` }}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      Pedido #{order.order_number}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                  <Badge 
                    style={{ 
                      backgroundColor: getStatusColor(order.status),
                      color: 'white'
                    }}
                  >
                    {getStatusLabel(order.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Informações do cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{order.customer_name}</span>
                    </div>
                    {order.customer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{order.customer_phone}</span>
                      </div>
                    )}
                    {order.customer_address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{order.customer_address}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{order.order_type?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="font-bold text-lg">{formatCurrency(order.total)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{order.payment_method}</span>
                    </div>
                  </div>
                </div>

                {/* Itens do pedido */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Itens do pedido:</h4>
                  <div className="space-y-2">
                    {order.items?.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-start p-2 bg-muted/50 rounded">
                        <div className="flex-1">
                          <span className="font-medium">{item.quantity}x {item.name}</span>
                          {item.variations && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {getVariationsText(item)}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-sm text-muted-foreground italic mt-1">
                              Obs: {item.notes}
                            </div>
                          )}
                        </div>
                        <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instruções de entrega */}
                {order.delivery_instructions && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-1">Instruções de entrega:</h4>
                    <p className="text-sm text-muted-foreground">{order.delivery_instructions}</p>
                  </div>
                )}

                {/* Ações */}
                <div className="border-t pt-4 flex gap-2 flex-wrap">
                  {/* Botão para emitir NFC-e */}
                  {(order.status === 'completed' || order.status === 'delivered') && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEmitirNFCe(order)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Receipt className="w-4 h-4 mr-1" />
                      Emitir NFC-e
                    </Button>
                  )}

                  {/* Ações de status existentes */}
                  {order.status === 'pending' && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => updateOrderStatus(order.id, 'confirmed')}
                      >
                        Confirmar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => updateOrderStatus(order.id, 'cancelled')}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                  
                  {order.status === 'confirmed' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateOrderStatus(order.id, 'preparing')}
                    >
                      Iniciar Preparo
                    </Button>
                  )}
                  
                  {order.status === 'preparing' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                    >
                      Marcar como Pronto
                    </Button>
                  )}
                  
                  {order.status === 'ready' && order.order_type === 'delivery' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                    >
                      Saiu para Entrega
                    </Button>
                  )}
                  
                  {(order.status === 'ready' && order.order_type !== 'delivery') && (
                    <Button 
                      size="sm" 
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                    >
                      Finalizar
                    </Button>
                  )}
                  
                  {order.status === 'out_for_delivery' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                    >
                      Marcar como Entregue
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de emissão de NFC-e */}
      <NFCeEmissionModal
        isOpen={showNFCeModal}
        onClose={() => {
          setShowNFCeModal(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onSuccess={() => {
          toast({
            title: "NFC-e emitida",
            description: "Cupom fiscal emitido com sucesso!",
          });
          fetchOrders();
        }}
      />
    </div>
  );
};

export default Orders;
