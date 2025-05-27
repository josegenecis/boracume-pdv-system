
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Bell, Package } from 'lucide-react';
import OrderCard from '@/components/orders/OrderCard';
import { OrderStatusType } from '@/components/orders/OrderStatusBadge';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  options?: string[];
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatusType;
  payment_method: string;
  created_at: string;
  estimated_time?: number;
}

// Sample orders data with different statuses
const sampleOrders: Order[] = [
  {
    id: '1',
    order_number: '8765',
    customer_name: 'João Silva',
    customer_phone: '(11) 99999-8765',
    customer_address: 'Rua das Flores, 123 - Centro',
    items: [
      { id: '1', name: 'X-Burger Especial', quantity: 1, price: 29.90, options: ['Sem cebola'], notes: 'Bem passado' },
      { id: '2', name: 'Batata Frita', quantity: 1, price: 18.90 },
      { id: '3', name: 'Refrigerante Cola', quantity: 1, price: 12.90 }
    ],
    total: 61.70,
    status: 'new',
    payment_method: 'PIX',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
  },
  {
    id: '2',
    order_number: '8764',
    customer_name: 'Maria Souza',
    customer_phone: '(11) 98888-7654',
    customer_address: 'Av. Principal, 456 - Jardim',
    items: [
      { id: '1', name: 'Pizza Margherita', quantity: 1, price: 45.90 },
      { id: '2', name: 'Refrigerante Cola', quantity: 2, price: 12.90 }
    ],
    total: 71.70,
    status: 'preparing',
    payment_method: 'Cartão de Crédito',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
  },
  {
    id: '3',
    order_number: '8763',
    customer_name: 'Carlos Oliveira',
    customer_phone: '(11) 97777-6543',
    customer_address: 'Rua da Liberdade, 789 - Vila Nova',
    items: [
      { id: '1', name: 'X-Burger Especial', quantity: 2, price: 29.90 },
      { id: '2', name: 'Batata Frita', quantity: 2, price: 18.90 }
    ],
    total: 97.60,
    status: 'ready',
    payment_method: 'Dinheiro',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 minutes ago
  },
  {
    id: '4',
    order_number: '8762',
    customer_name: 'Ana Santos',
    customer_phone: '(11) 96666-5432',
    customer_address: 'Rua do Comércio, 321 - Centro',
    items: [
      { id: '1', name: 'Pizza Margherita', quantity: 1, price: 45.90 }
    ],
    total: 45.90,
    status: 'in_delivery',
    payment_method: 'PIX',
    created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 minutes ago
  },
  {
    id: '5',
    order_number: '8761',
    customer_name: 'Roberto Lima',
    customer_phone: '(11) 95555-4321',
    customer_address: 'Av. das Nações, 654 - Bela Vista',
    items: [
      { id: '1', name: 'X-Burger Especial', quantity: 1, price: 29.90 },
      { id: '2', name: 'Refrigerante Cola', quantity: 1, price: 12.90 }
    ],
    total: 42.80,
    status: 'delivered',
    payment_method: 'Cartão de Débito',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
  }
];

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    const newCount = orders.filter(order => order.status === 'new').length;
    setNewOrdersCount(newCount);
  }, [orders]);

  const handleStatusChange = (orderId: string, newStatus: OrderStatusType) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus }
        : order
    ));

    const statusMessages: Record<OrderStatusType, string> = {
      new: 'Pedido marcado como novo',
      confirmed: 'Pedido confirmado com sucesso',
      preparing: 'Preparo iniciado',
      ready: 'Pedido pronto para entrega',
      in_delivery: 'Pedido enviado para entrega',
      delivered: 'Pedido entregue com sucesso',
      cancelled: 'Pedido cancelado'
    };

    toast({
      title: "Status atualizado",
      description: statusMessages[newStatus],
    });
  };

  const handleViewDetails = (orderId: string) => {
    // Implementation for viewing order details
    toast({
      title: "Detalhes do pedido",
      description: `Visualizando detalhes do pedido ${orderId}`,
    });
  };

  const refreshOrders = () => {
    // Simulate refreshing orders
    toast({
      title: "Pedidos atualizados",
      description: "Lista de pedidos foi atualizada",
    });
  };

  const getOrdersByStatus = (status: OrderStatusType) => {
    return orders.filter(order => order.status === status);
  };

  const getStatusCount = (status: OrderStatusType) => {
    return getOrdersByStatus(status).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel de Pedidos</h1>
          <p className="text-muted-foreground">Gerencie todos os pedidos em tempo real</p>
        </div>
        <div className="flex gap-2">
          {newOrdersCount > 0 && (
            <Badge className="bg-red-500 text-white animate-pulse">
              <Bell className="w-3 h-3 mr-1" />
              {newOrdersCount} novos
            </Badge>
          )}
          <Button onClick={refreshOrders} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="all">
            Todos ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="new" className="relative">
            Novos ({getStatusCount('new')})
            {getStatusCount('new') > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmados ({getStatusCount('confirmed')})
          </TabsTrigger>
          <TabsTrigger value="preparing">
            Preparando ({getStatusCount('preparing')})
          </TabsTrigger>
          <TabsTrigger value="ready">
            Prontos ({getStatusCount('ready')})
          </TabsTrigger>
          <TabsTrigger value="in_delivery">
            Em Entrega ({getStatusCount('in_delivery')})
          </TabsTrigger>
          <TabsTrigger value="delivered">
            Entregues ({getStatusCount('delivered')})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={handleStatusChange}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
          {orders.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum pedido encontrado</h3>
                <p className="text-muted-foreground text-center">
                  Quando você receber pedidos, eles aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {['new', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered'].map(status => (
          <TabsContent key={status} value={status} className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {getOrdersByStatus(status as OrderStatusType).map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={handleStatusChange}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
            {getOrdersByStatus(status as OrderStatusType).length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Nenhum pedido {status === 'new' ? 'novo' : 
                                  status === 'confirmed' ? 'confirmado' :
                                  status === 'preparing' ? 'em preparo' :
                                  status === 'ready' ? 'pronto' :
                                  status === 'in_delivery' ? 'em entrega' : 'entregue'}
                  </h3>
                  <p className="text-muted-foreground text-center">
                    Os pedidos com este status aparecerão aqui.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Orders;
