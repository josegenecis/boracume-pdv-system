import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, Check, X, Clock, CheckCircle } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'status' | 'system';
  read: boolean;
  created_at: string;
  order_id?: string;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Simular notificações iniciais
    const mockNotifications: Notification[] = [
      {
        id: '1',
        title: 'Novo Pedido',
        message: 'Pedido #PED-001 recebido',
        type: 'order',
        read: false,
        created_at: new Date().toISOString(),
        order_id: '1'
      },
      {
        id: '2',
        title: 'Pedido Pronto',
        message: 'Pedido #PED-002 está pronto para entrega',
        type: 'status',
        read: false,
        created_at: new Date(Date.now() - 300000).toISOString(),
        order_id: '2'
      }
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter(n => !n.read).length);

    // Escutar novos pedidos em tempo real
    const channel = supabase
      .channel('order-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification: Notification = {
            id: `order-${payload.new.id}`,
            title: 'Novo Pedido!',
            message: `Pedido #${payload.new.order_number} recebido`,
            type: 'order',
            read: false,
            created_at: new Date().toISOString(),
            order_id: payload.new.id
          };

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
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
          if (payload.old.status !== payload.new.status) {
            const statusLabels = {
              preparing: 'em preparo',
              ready: 'pronto',
              delivered: 'entregue',
              completed: 'finalizado'
            };

            const newNotification: Notification = {
              id: `status-${payload.new.id}-${Date.now()}`,
              title: 'Status Atualizado',
              message: `Pedido #${payload.new.order_number} está ${statusLabels[payload.new.status as keyof typeof statusLabels] || payload.new.status}`,
              type: 'status',
              read: false,
              created_at: new Date().toISOString(),
              order_id: payload.new.id
            };

            setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const removeNotification = (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (!notification?.read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <BellRing className="w-4 h-4 text-blue-500" />;
      case 'status':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-500">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-auto p-1 text-xs"
            >
              Marcar todas como lidas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <ScrollArea className="h-64">
            {notifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex-shrink-0 mt-1">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${
                      !notification.read ? 'text-gray-900' : 'text-gray-600'
                    }`}>
                      {notification.title}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(notification.id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};