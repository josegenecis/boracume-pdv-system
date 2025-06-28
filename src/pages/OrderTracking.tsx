
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Clock, CheckCircle, Truck, ChefHat, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total: number;
  estimated_time: string;
  items: any[];
  created_at: string;
}

const OrderTracking: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const statusSteps = [
    { key: 'pending', label: 'Pedido Recebido', icon: Package, color: 'bg-blue-500' },
    { key: 'confirmed', label: 'Confirmado', icon: CheckCircle, color: 'bg-green-500' },
    { key: 'preparing', label: 'Preparando', icon: ChefHat, color: 'bg-orange-500' },
    { key: 'ready', label: 'Pronto', icon: CheckCircle, color: 'bg-green-600' },
    { key: 'out_for_delivery', label: 'Saiu para Entrega', icon: Truck, color: 'bg-purple-500' },
    { key: 'delivered', label: 'Entregue', icon: CheckCircle, color: 'bg-green-700' }
  ];

  useEffect(() => {
    if (orderNumber) {
      fetchOrder();
      subscribeToOrderUpdates();
    }
  }, [orderNumber]);

  const fetchOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderNumber)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      toast({
        title: "Erro",
        description: "Pedido não encontrado.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToOrderUpdates = () => {
    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `order_number=eq.${orderNumber}`
        },
        (payload) => {
          console.log('📡 Atualização do pedido recebida:', payload);
          setOrder(payload.new as Order);
          
          toast({
            title: "Status Atualizado!",
            description: `Seu pedido está: ${getStatusLabel(payload.new.status)}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusLabel = (status: string) => {
    const step = statusSteps.find(s => s.key === status);
    return step?.label || status;
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    return statusSteps.findIndex(step => step.key === order.status);
  };

  const getProgressPercentage = () => {
    const currentIndex = getCurrentStepIndex();
    return Math.max(0, (currentIndex / (statusSteps.length - 1)) * 100);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando pedido...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Pedido não encontrado</h2>
            <p className="text-muted-foreground mb-4">
              Verifique se o número do pedido está correto.
            </p>
            <Button onClick={() => navigate('/')}>
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Acompanhar Pedido</h1>
            <p className="text-muted-foreground">#{order.order_number}</p>
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Status do Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={getProgressPercentage()} className="h-2" />
            
            <div className="space-y-3">
              {statusSteps.map((step, index) => {
                const isCompleted = index <= getCurrentStepIndex();
                const isCurrent = index === getCurrentStepIndex();
                const Icon = step.icon;
                
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      isCurrent ? 'bg-blue-50 border border-blue-200' : ''
                    }`}
                  >
                    <div
                      className={`rounded-full p-2 ${
                        isCompleted ? step.color : 'bg-gray-200'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${
                        isCompleted ? 'text-white' : 'text-gray-500'
                      }`} />
                    </div>
                    <span className={`font-medium ${
                      isCompleted ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {isCurrent && (
                      <Badge variant="secondary" className="ml-auto">
                        Atual
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{order.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{order.customer_phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Estimado</p>
                <p className="font-medium">{order.estimated_time}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedido às</p>
                <p className="font-medium">{formatTime(order.created_at)}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Itens do Pedido</h4>
              <div className="space-y-2">
                {order.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{item.quantity}x {item.product_name}</span>
                      {item.options && item.options.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {item.options.join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="font-medium">
                      R$ {item.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center pt-3 border-t font-bold text-lg">
                <span>Total:</span>
                <span className="text-green-600">R$ {order.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderTracking;
