import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { X, Bell, Truck, Package, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface PendingOrder {
  id: string;
  order_number: string;
  customer_name?: string;
  order_type: string;
  total: number;
  created_at: string;
  acceptance_status?: string;
}

const GlobalNotificationSystem: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Verifica se está na página de pedidos para não mostrar notificação
  const isOnOrdersPage = location.pathname === '/orders' || location.pathname === '/kitchen';

  useEffect(() => {
    if (!user) return;

    // Carregar pedidos pendentes iniciais
    const loadPendingOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, order_type, total, created_at, acceptance_status')
        .eq('user_id', user.id)
        .eq('acceptance_status', 'pending_acceptance')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setPendingOrders(data);
        if (!isOnOrdersPage) {
          setIsVisible(true);
        }
      }
    };

    loadPendingOrders();

    // Escutar novos pedidos em tempo real
    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 GlobalNotification - Novo pedido:', payload);
          
          const newOrder = payload.new as PendingOrder;
          
          // Adicionar à lista de pendentes
          setPendingOrders(prev => [newOrder, ...prev]);
          
          // Mostrar notificação se não estiver na página de pedidos
          if (!isOnOrdersPage) {
            setIsVisible(true);
            
            // Som de notificação
            if (soundEnabled) {
              const audio = new Audio('/sounds/bell.mp3');
              audio.volume = 0.8;
              audio.play().catch(console.error);
            }
            
            // Vibração (se suportado)
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
            
            // Toast notification
            toast({
              title: "🔔 Novo Pedido Recebido!",
              description: `Pedido #${newOrder.order_number} - ${newOrder.customer_name || 'Cliente'}`,
              duration: 5000,
            });
          }
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
          const updatedOrder = payload.new as PendingOrder;
          
          // Se o pedido foi aceito ou cancelado, remover da lista
          if (updatedOrder.acceptance_status !== 'pending_acceptance') {
            setPendingOrders(prev => prev.filter(order => order.id !== updatedOrder.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOnOrdersPage, soundEnabled, toast]);

  // Atualizar visibilidade quando muda a página
  useEffect(() => {
    if (isOnOrdersPage) {
      setIsVisible(false);
    } else if (pendingOrders.length > 0) {
      setIsVisible(true);
    }
  }, [isOnOrdersPage, pendingOrders.length]);

  const handleGoToOrders = () => {
    setIsVisible(false);
    navigate('/orders');
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'pickup':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'dine_in':
        return <div className="w-4 h-4 bg-orange-600 rounded-sm" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isVisible || pendingOrders.length === 0 || isOnOrdersPage) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className="border-2 border-orange-300 bg-orange-50 shadow-lg animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-600" />
              <span className="font-semibold text-orange-800">
                {pendingOrders.length} Novo{pendingOrders.length > 1 ? 's' : ''} Pedido{pendingOrders.length > 1 ? 's' : ''}!
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-orange-600 hover:bg-orange-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 mb-4">
            {pendingOrders.slice(0, 3).map((order) => (
              <div key={order.id} className="bg-white p-2 rounded border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getOrderTypeIcon(order.order_type)}
                  <div>
                    <div className="font-medium text-sm">#{order.order_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.customer_name || 'Cliente'} • {formatTime(order.created_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-sm">{formatCurrency(order.total)}</div>
                  <Badge variant="outline" className="text-xs">Pendente</Badge>
                </div>
              </div>
            ))}
            
            {pendingOrders.length > 3 && (
              <div className="text-center text-sm text-muted-foreground">
                +{pendingOrders.length - 3} pedido{pendingOrders.length - 3 > 1 ? 's' : ''} adicional{pendingOrders.length - 3 > 1 ? 'is' : ''}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleGoToOrders}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              size="sm"
            >
              Ver Pedidos
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDismiss}
              size="sm"
            >
              Dispensar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GlobalNotificationSystem;