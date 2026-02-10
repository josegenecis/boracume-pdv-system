import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { X, Bell, Truck, Package, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { soundNotifications } from '@/utils/soundUtils';

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
  const [soundType, setSoundType] = useState('bell');
  const [volume, setVolume] = useState(0.8);
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dismissedOrders');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Verifica se está na página de pedidos para não mostrar notificação
  const isOnOrdersPage = ['/orders', '/pedidos', '/kitchen', '/cozinha'].includes(location.pathname);
  const isDigitalMenu = location.pathname.includes('/menu');

  const isOnOrdersPageRef = useRef(isOnOrdersPage);
  const soundEnabledRef = useRef(soundEnabled);
  const soundTypeRef = useRef(soundType);
  const volumeRef = useRef(volume);

  useEffect(() => {
    isOnOrdersPageRef.current = isOnOrdersPage;
  }, [isOnOrdersPage]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    soundTypeRef.current = soundType;
    volumeRef.current = volume;
    soundNotifications.setEnabled(soundEnabled);
    soundNotifications.setVolume(volume);
  }, [soundEnabled, soundType, volume]);

  useEffect(() => {
    try {
      if (localStorage.getItem('sound_unlocked') === 'true') return;
    } catch {}

    const unlock = async () => {
      try {
        await soundNotifications.enableSound();
        try { localStorage.setItem('sound_unlocked', 'true'); } catch {}
      } catch {}
    };

    const onFirstInteraction = () => {
      unlock().catch(() => {});
    };

    window.addEventListener('pointerdown', onFirstInteraction, { passive: true, once: true });
    window.addEventListener('touchstart', onFirstInteraction, { passive: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction as any);
      window.removeEventListener('touchstart', onFirstInteraction as any);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isDigitalMenu) return; // não mostrar para clientes no cardápio digital

    const loadSettings = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('notification_settings')
          .select('sound_enabled, volume, order_sound, custom_bell_url, custom_chime_url, custom_ding_url, custom_notification_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) return;
        if (!data) return;
        const enabled = !!data.sound_enabled;
        const vol = Math.max(0, Math.min(1, parseFloat(String(data.volume || '80')) / 100));
        const type = String(data.order_sound || 'bell');
        setSoundEnabled(enabled);
        setVolume(vol);
        setSoundType(type);
        soundNotifications.setCustomSoundUrls({
          custom_bell_url: data.custom_bell_url || null,
          custom_chime_url: data.custom_chime_url || null,
          custom_ding_url: data.custom_ding_url || null,
          custom_notification_url: data.custom_notification_url || null,
        });
      } catch {}
    };

    // Carregar pedidos pendentes iniciais
    const loadPendingOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, order_type, total, created_at, acceptance_status, status')
        .eq('user_id', user.id)
        .in('acceptance_status', ['pending_acceptance', 'awaiting_pix_payment'])
        .or('status.eq.pending')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setPendingOrders(data);
        if (!isOnOrdersPageRef.current) {
          setIsVisible(true);
        }
      }
    };

    loadSettings();
    loadPendingOrders();

    // Escutar novos pedidos em tempo real
    const channel = supabase
      .channel(`global-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🔔 GlobalNotification - Novo pedido:', payload);
          
          const newOrder = payload.new as PendingOrder;
          const showForInsert = 
            newOrder.acceptance_status === 'pending_acceptance' ||
            newOrder.acceptance_status === 'awaiting_pix_payment' ||
            (newOrder as any).status === 'pending';
          if (!showForInsert) return;
          setPendingOrders(prev => [newOrder, ...prev]);
          if (soundEnabledRef.current) {
            await soundNotifications.playSound(soundTypeRef.current).catch(() => soundNotifications.playSound('bell'));
          }
          if (!isOnOrdersPageRef.current) {
            setIsVisible(true);
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]);
            }
            toast({
              title: "🔔 Novo Pedido Recebido!",
              description: `Pedido ${newOrder.order_number} - ${newOrder.customer_name || 'Cliente'}`,
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
        async (payload) => {
          const updatedOrder = payload.new as PendingOrder;
          const isPendingLike = updatedOrder.acceptance_status === 'pending_acceptance' 
            || updatedOrder.acceptance_status === 'awaiting_pix_payment'
            || (updatedOrder as any).status === 'pending';
          if (isPendingLike) {
            setPendingOrders(prev => [updatedOrder, ...prev.filter(o => o.id !== updatedOrder.id)]);
            if (soundEnabledRef.current) {
              await soundNotifications.playSound(soundTypeRef.current).catch(() => soundNotifications.playSound('bell'));
            }
            if (!isOnOrdersPageRef.current) {
              setIsVisible(true);
              if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
              }
              toast({
                title: "🔔 Novo Pedido Recebido!",
                description: `Pedido ${updatedOrder.order_number} - ${updatedOrder.customer_name || 'Cliente'}`,
                duration: 5000,
              });
            }
          } else {
            soundNotifications.stopAllSounds();
            setPendingOrders(prev => prev.filter(order => order.id !== updatedOrder.id));
            setDismissedOrders(prev => {
              const newDismissed = new Set([...prev, updatedOrder.id]);
              localStorage.setItem('dismissedOrders', JSON.stringify([...newDismissed]));
              return newDismissed;
            });
            setTimeout(() => {
              setPendingOrders(current => {
                if (current.length === 0) {
                  setIsVisible(false);
                }
                return current;
              });
            }, 100);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_settings', filter: `user_id=eq.${user.id}` },
        () => {
          loadSettings();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadPendingOrders();
        }
      });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadPendingOrders();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      // Parar todos os sons quando o componente for desmontado
      soundNotifications.stopAllSounds();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, isDigitalMenu, toast]);

  // Atualizar visibilidade quando muda a página
  useEffect(() => {
    if (isOnOrdersPage) {
      // Parar sons quando navegar para página de pedidos
      soundNotifications.stopAllSounds();
      setIsVisible(false);
    } else if (pendingOrders.length > 0) {
      setIsVisible(true);
    }
  }, [isOnOrdersPage, pendingOrders.length]);

  const handleGoToOrders = () => {
    // Parar todos os sons que estão tocando
    soundNotifications.stopAllSounds();
    
    // Adicionar todos os pedidos atuais aos dispensados
    const currentOrderIds = pendingOrders.map(order => order.id);
    setDismissedOrders(prev => {
      const newDismissed = new Set([...prev, ...currentOrderIds]);
      localStorage.setItem('dismissedOrders', JSON.stringify([...newDismissed]));
      return newDismissed;
    });
    setIsVisible(false);
    navigate('/pedidos');
  };

  const handleDismiss = () => {
    // Parar todos os sons que estão tocando
    soundNotifications.stopAllSounds();
    
    // Adicionar todos os pedidos atuais aos dispensados
    const currentOrderIds = pendingOrders.map(order => order.id);
    setDismissedOrders(prev => {
      const newDismissed = new Set([...prev, ...currentOrderIds]);
      localStorage.setItem('dismissedOrders', JSON.stringify([...newDismissed]));
      return newDismissed;
    });
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

  // Filtrar pedidos que não foram dispensados
  const visibleOrders = pendingOrders.filter(order => !dismissedOrders.has(order.id));

  if (!isVisible || visibleOrders.length === 0 || isOnOrdersPage || isDigitalMenu) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className="border border-gray-200 bg-white shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-600" />
              <span className="font-semibold text-orange-800">
                {visibleOrders.length} Novo{visibleOrders.length > 1 ? 's' : ''} Pedido{visibleOrders.length > 1 ? 's' : ''}!
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {visibleOrders.slice(0, 3).map((order) => (
              <div key={order.id} className="bg-white p-2 rounded border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getOrderTypeIcon(order.order_type)}
                  <div>
                    <div className="font-medium text-sm">Pedido {order.order_number}</div>
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
            
            {visibleOrders.length > 3 && (
              <div className="text-center text-sm text-muted-foreground">
                +{visibleOrders.length - 3} pedido{visibleOrders.length - 3 > 1 ? 's' : ''} adicional{visibleOrders.length - 3 > 1 ? 'is' : ''}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleGoToOrders}
              className="flex-1 bg-boracume-orange hover:bg-boracume-orange/90"
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
