
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Phone, MapPin, CheckCircle, X, AlertTriangle } from 'lucide-react';

interface KitchenOrderCardProps {
  order: {
    id: string;
    order_number: string;
    customer_name: string;
    customer_phone?: string;
    items: any[];
    priority: 'low' | 'normal' | 'high' | 'urgent';
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    created_at: string;
    estimated_time?: string;
  };
  onUpdateStatus: (orderId: string, newStatus: string) => void;
  onUpdatePriority: (orderId: string, newPriority: string) => void;
}

const getTimePassed = (createdAt: string): string => {
  const now = new Date();
  const orderTime = new Date(createdAt);
  const diffInMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min`;
  } else if (diffInMinutes < 1440) { // menos de 24 horas
    const hours = Math.floor(diffInMinutes / 60);
    const remainingMinutes = diffInMinutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}min`;
  } else { // 24 horas ou mais
    const days = Math.floor(diffInMinutes / 1440);
    const remainingHours = Math.floor((diffInMinutes % 1440) / 60);
    if (remainingHours === 0) {
      return `${days} dia${days > 1 ? 's' : ''}`;
    }
    return `${days} dia${days > 1 ? 's' : ''} ${remainingHours}h`;
  }
};

const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({
  order,
  onUpdateStatus,
  onUpdatePriority
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'preparing': return 'bg-blue-500';
      case 'ready': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const timePassed = getTimePassed(order.created_at);

  return (
    <Card className={`border-l-4 ${getPriorityColor(order.priority)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">#{order.order_number}</CardTitle>
            <p className="text-sm text-muted-foreground">{order.customer_name}</p>
          </div>
          <div className="text-right">
            <Badge className={`${getStatusColor(order.status)} text-white`}>
              {order.status === 'pending' && 'Pendente'}
              {order.status === 'preparing' && 'Preparando'}
              {order.status === 'ready' && 'Pronto'}
              {order.status === 'completed' && 'Concluído'}
              {order.status === 'cancelled' && 'Cancelado'}
            </Badge>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{timePassed}</span>
            </div>
          </div>
        </div>

        {order.customer_phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{order.customer_phone}</span>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-2 mb-4">
          {order.items.map((item: any, index: number) => (
            <div key={index} className="flex justify-between items-center">
              <span className="font-medium">{item.quantity}x {item.name}</span>
              {item.variations && item.variations.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {item.variations.join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {order.status === 'pending' && (
            <Button
              size="sm"
              onClick={() => onUpdateStatus(order.id, 'preparing')}
              className="flex-1"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Iniciar
            </Button>
          )}

          {order.status === 'preparing' && (
            <Button
              size="sm"
              onClick={() => onUpdateStatus(order.id, 'ready')}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Finalizar
            </Button>
          )}

          {order.status === 'ready' && (
            <Button
              size="sm"
              onClick={() => onUpdateStatus(order.id, 'completed')}
              className="flex-1 bg-gray-600 hover:bg-gray-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Entregar
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const priorities = ['low', 'normal', 'high', 'urgent'];
              const currentIndex = priorities.indexOf(order.priority);
              const nextPriority = priorities[(currentIndex + 1) % priorities.length];
              onUpdatePriority(order.id, nextPriority);
            }}
          >
            <AlertTriangle className="h-3 w-3" />
          </Button>

          {order.status !== 'cancelled' && order.status !== 'completed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateStatus(order.id, 'cancelled')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default KitchenOrderCard;
