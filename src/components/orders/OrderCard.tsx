
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, Phone, MapPin, DollarSign } from 'lucide-react';
import OrderStatusBadge, { OrderStatusType } from './OrderStatusBadge';

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

interface OrderCardProps {
  order: Order;
  onStatusChange: (orderId: string, newStatus: OrderStatusType) => void;
  onViewDetails?: (orderId: string) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onStatusChange, onViewDetails }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes === 1) return '1 minuto';
    return `${diffInMinutes} minutos`;
  };

  const getNextStatus = (currentStatus: OrderStatusType): OrderStatusType | null => {
    switch (currentStatus) {
      case 'new':
        return 'confirmed';
      case 'confirmed':
        return 'preparing';
      case 'preparing':
        return 'ready';
      case 'ready':
        return 'in_delivery';
      case 'in_delivery':
        return 'delivered';
      default:
        return null;
    }
  };

  const getNextStatusLabel = (currentStatus: OrderStatusType): string => {
    const nextStatus = getNextStatus(currentStatus);
    switch (nextStatus) {
      case 'confirmed':
        return 'Confirmar';
      case 'preparing':
        return 'Iniciar Preparo';
      case 'ready':
        return 'Marcar como Pronto';
      case 'in_delivery':
        return 'Enviar para Entrega';
      case 'delivered':
        return 'Marcar como Entregue';
      default:
        return 'Atualizar';
    }
  };

  const handleStatusUpdate = () => {
    const nextStatus = getNextStatus(order.status);
    if (nextStatus) {
      onStatusChange(order.id, nextStatus);
    }
  };

  const canCancel = !['delivered', 'cancelled'].includes(order.status);
  const canAdvance = getNextStatus(order.status) !== null;

  return (
    <Card className={`w-full ${order.status === 'new' ? 'border-red-500 border-2 shadow-lg' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Pedido #{order.order_number}
              <OrderStatusBadge status={order.status} />
              {order.status === 'new' && (
                <Badge className="bg-red-100 text-red-800 animate-bounce">NOVO!</Badge>
              )}
            </CardTitle>
            <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
              <span>{order.customer_name}</span>
              <div className="flex items-center gap-1">
                <Clock size={12} />
                {formatTime(order.created_at)} ({getTimeElapsed(order.created_at)})
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-lg text-boracume-orange">
              {formatCurrency(order.total)}
            </div>
            <div className="text-sm text-muted-foreground">
              {order.payment_method}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Customer Info */}
        <div className="flex gap-4 text-sm">
          {order.customer_phone && (
            <div className="flex items-center gap-1">
              <Phone size={14} />
              {order.customer_phone}
            </div>
          )}
          {order.customer_address && (
            <div className="flex items-center gap-1">
              <MapPin size={14} />
              {order.customer_address}
            </div>
          )}
        </div>

        <Separator />

        {/* Order Items */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Itens do Pedido:</h4>
          {order.items.map((item, index) => (
            <div key={index} className="text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{item.quantity}x {item.name}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
              {item.options && item.options.length > 0 && (
                <div className="ml-4 text-xs text-muted-foreground">
                  {item.options.join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="ml-4 text-xs italic text-muted-foreground">
                  Obs: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3">
          {canAdvance && (
            <Button 
              onClick={handleStatusUpdate}
              className="flex-1"
              variant={order.status === 'new' ? 'default' : 'outline'}
            >
              {getNextStatusLabel(order.status)}
            </Button>
          )}
          
          {canCancel && (
            <Button 
              onClick={() => onStatusChange(order.id, 'cancelled')}
              variant="destructive"
              size="sm"
            >
              Cancelar
            </Button>
          )}
          
          {onViewDetails && (
            <Button 
              onClick={() => onViewDetails(order.id)}
              variant="outline"
              size="sm"
            >
              Detalhes
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderCard;
