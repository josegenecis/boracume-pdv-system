
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ChefHat, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface KitchenOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  items: any[];
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  priority: 'low' | 'normal' | 'high';
  created_at: string;
}

const NewKitchen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('kitchen-orders-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kitchen_orders',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            console.log('Kitchen order changed, refetching...');
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
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('kitchen_orders')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching kitchen orders:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os pedidos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: KitchenOrder['status']) => {
    try {
      const { error } = await supabase
        .from('kitchen_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Pedido marcado como ${getStatusLabel(newStatus)}`,
      });

      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));

    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };

  const getStatusLabel = (status: KitchenOrder['status']) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Pronto';
      case 'completed': return 'Concluído';
      default: return status;
    }
  };

  const getStatusColor = (status: KitchenOrder['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'preparing': return 'bg-blue-500';
      case 'ready': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: KitchenOrder['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'normal': return 'border-blue-500 bg-blue-50';
      case 'low': return 'border-gray-500 bg-gray-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeElapsed = (dateString: string) => {
    const now = new Date();
    const orderTime = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}min`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      const minutes = diffInMinutes % 60;
      return `${hours}h ${minutes}min`;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p>Carregando pedidos...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" />
            Cozinha
          </h1>
          <p className="text-gray-600">Gerencie os pedidos da cozinha</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingOrders.length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Preparando</p>
                  <p className="text-2xl font-bold text-blue-600">{preparingOrders.length}</p>
                </div>
                <ChefHat className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Prontos</p>
                  <p className="text-2xl font-bold text-green-600">{readyOrders.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-yellow-600 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pendentes ({pendingOrders.length})
            </h2>
            {pendingOrders.map((order) => (
              <Card key={order.id} className={`${getPriorityColor(order.priority)} border-2`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                      <p className="text-sm text-gray-600">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(order.created_at)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getTimeElapsed(order.created_at)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {order.items.map((item: any, index: number) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">{item.quantity}x {item.product_name}</span>
                        {item.variations && item.variations.length > 0 && (
                          <div className="text-xs text-gray-600 ml-2">
                            {item.variations.join(', ')}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs text-gray-600 ml-2 italic">
                            Obs: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    className="w-full"
                    size="sm"
                  >
                    Iniciar Preparo
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Preparing Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Preparando ({preparingOrders.length})
            </h2>
            {preparingOrders.map((order) => (
              <Card key={order.id} className={`${getPriorityColor(order.priority)} border-2`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                      <p className="text-sm text-gray-600">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(order.created_at)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getTimeElapsed(order.created_at)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {order.items.map((item: any, index: number) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">{item.quantity}x {item.product_name}</span>
                        {item.variations && item.variations.length > 0 && (
                          <div className="text-xs text-gray-600 ml-2">
                            {item.variations.join(', ')}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs text-gray-600 ml-2 italic">
                            Obs: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    Marcar como Pronto
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Ready Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-green-600 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Prontos ({readyOrders.length})
            </h2>
            {readyOrders.map((order) => (
              <Card key={order.id} className={`${getPriorityColor(order.priority)} border-2`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                      <p className="text-sm text-gray-600">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(order.created_at)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getTimeElapsed(order.created_at)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {order.items.map((item: any, index: number) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">{item.quantity}x {item.product_name}</span>
                        {item.variations && item.variations.length > 0 && (
                          <div className="text-xs text-gray-600 ml-2">
                            {item.variations.join(', ')}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs text-gray-600 ml-2 italic">
                            Obs: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    Concluir Pedido
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <ChefHat className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum pedido na cozinha</h3>
            <p className="text-gray-500">Os pedidos aparecerão aqui quando forem feitos</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NewKitchen;
