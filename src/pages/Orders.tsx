
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Eye, Printer, Phone, MapPin, Clock, User, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import OrderStatusBadge, { OrderStatusType } from '@/components/orders/OrderStatusBadge';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total: number;
  status: OrderStatusType;
  status_color: string;
  payment_method: string;
  order_type: string;
  items: any[];
  created_at: string;
  delivery_fee: number;
  estimated_time: string;
  variations: any[];
}

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const transformedData = (data || []).map(item => {
        let parsedItems = [];
        let parsedVariations = [];
        
        try {
          if (typeof item.items === 'string') {
            parsedItems = JSON.parse(item.items);
          } else if (Array.isArray(item.items)) {
            parsedItems = item.items;
          }
        } catch (e) {
          console.error('Error parsing items:', e);
          parsedItems = [];
        }

        try {
          if (typeof item.variations === 'string') {
            parsedVariations = JSON.parse(item.variations);
          } else if (Array.isArray(item.variations)) {
            parsedVariations = item.variations;
          }
        } catch (e) {
          console.error('Error parsing variations:', e);
          parsedVariations = [];
        }

        return {
          ...item,
          status: item.status as OrderStatusType,
          items: parsedItems,
          variations: parsedVariations
        };
      });
      
      setOrders(transformedData);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pedidos.",
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
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));

      toast({
        title: "Status atualizado",
        description: "Status do pedido foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do pedido.",
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

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery': return 'Delivery';
      case 'dine_in': return 'Local';
      case 'takeaway': return 'Retirada';
      default: return type;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'dinheiro': return 'Dinheiro';
      case 'cartao': return 'Cartão';
      case 'pix': return 'PIX';
      default: return method;
    }
  };

  const renderItemWithVariations = (item: any, orderVariations: any[]) => {
    const itemVariations = orderVariations?.filter(v => v.item_id === item.id) || [];
    
    return (
      <div key={item.id || Math.random()} className="py-1 border-b border-gray-100 last:border-0">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="font-medium">{item.quantity}x {item.product_name}</span>
            {itemVariations.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {itemVariations.map((variation, idx) => (
                  <div key={idx}>
                    <strong>{variation.variation_name}:</strong> {
                      Array.isArray(variation.selection) 
                        ? variation.selection.map((sel: any) => sel.name).join(', ')
                        : variation.selection?.name || ''
                    }
                  </div>
                ))}
              </div>
            )}
            {item.notes && (
              <div className="text-xs text-gray-500 italic mt-1">
                Obs: {item.notes}
              </div>
            )}
          </div>
          <span className="font-medium text-gray-900 ml-2">
            {formatCurrency(item.subtotal)}
          </span>
        </div>
      </div>
    );
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer_phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesType = typeFilter === 'all' || order.order_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
        <Button onClick={fetchOrders} variant="outline">
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Buscar por número, cliente ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="preparing">Em Produção</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="in_delivery">Saiu para Entrega</SelectItem>
                <SelectItem value="delivered">Entregue</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="dine_in">Local</SelectItem>
                <SelectItem value="takeaway">Retirada</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-500" />
              <span className="text-sm text-gray-600">
                {filteredOrders.length} de {orders.length} pedidos
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <div className="grid gap-4">
        {filteredOrders.map((order) => (
          <Card 
            key={order.id} 
            className="overflow-hidden border-l-4"
            style={{ borderLeftColor: order.status_color }}
          >
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                
                {/* Informações Principais - 4 colunas */}
                <div className="lg:col-span-4 p-6 bg-gray-50">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt size={16} className="text-gray-500" />
                        <span className="font-bold text-lg">#{order.order_number}</span>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User size={14} className="text-gray-500" />
                        <span className="font-medium">{order.customer_name || 'Cliente Local'}</span>
                      </div>
                      
                      {order.customer_phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone size={14} className="text-gray-500" />
                          <span>{order.customer_phone}</span>
                        </div>
                      )}
                      
                      {order.customer_address && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin size={14} className="text-gray-500" />
                          <span className="text-gray-600">{order.customer_address}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-gray-500" />
                        <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {getOrderTypeLabel(order.order_type)}
                      </Badge>
                      <Badge variant="outline">
                        {getPaymentMethodLabel(order.payment_method)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Items do Pedido - 5 colunas */}
                <div className="lg:col-span-5 p-6">
                  <h4 className="font-medium mb-3 text-gray-900">Itens do Pedido</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {order.items?.map((item: any, index: number) => 
                      renderItemWithVariations(item, order.variations)
                    )}
                  </div>
                </div>

                {/* Total e Ações - 3 colunas */}
                <div className="lg:col-span-3 p-6 bg-white border-l border-gray-200">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency((order.total || 0) - (order.delivery_fee || 0))}</span>
                      </div>
                      
                      {order.delivery_fee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Taxa de entrega:</span>
                          <span>{formatCurrency(order.delivery_fee)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total:</span>
                        <span className="text-green-600">{formatCurrency(order.total)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Select
                        value={order.status}
                        onValueChange={(value: OrderStatusType) => updateOrderStatus(order.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="confirmed">Confirmado</SelectItem>
                          <SelectItem value="preparing">Em Produção</SelectItem>
                          <SelectItem value="ready">Pronto</SelectItem>
                          <SelectItem value="in_delivery">Saiu para Entrega</SelectItem>
                          <SelectItem value="delivered">Entregue</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Eye size={14} className="mr-1" />
                          Ver
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Printer size={14} className="mr-1" />
                          Imprimir
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 text-lg">Nenhum pedido encontrado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Orders;
