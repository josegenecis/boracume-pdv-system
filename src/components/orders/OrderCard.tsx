
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
    <Card className={`w-full max-w-sm ${order.status === 'new' ? 'border-red-500 border-2 shadow-lg' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              #{order.order_number}
              <OrderStatusBadge status={order.status} />
              {order.status === 'new' && (
                <Badge className="bg-red-100 text-red-800 animate-bounce text-xs">NOVO!</Badge>
              )}
            </CardTitle>
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
              <span className="truncate max-w-24">{order.customer_name}</span>
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>{formatTime(order.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-base text-primary">
              {formatCurrency(order.total)}
            </div>
            <div className="text-xs text-muted-foreground">
              {getTimeElapsed(order.created_at)}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="py-2">
        <div className="space-y-1">
          {order.customer_phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone size={10} />
              <span className="truncate">{order.customer_phone}</span>
            </div>
          )}
          {order.customer_address && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={10} />
              <span className="truncate">{order.customer_address}</span>
            </div>
          )}
        </div>
        
        <Separator className="my-2" />
        
        <div className="space-y-1 max-h-20 overflow-y-auto">
          {order.items.slice(0, 3).map((item, index) => (
            <div key={index} className="text-xs flex justify-between">
              <span className="truncate">{item.quantity}x {item.name}</span>
              <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <div className="text-xs text-muted-foreground">
              +{order.items.length - 3} itens...
            </div>
          )}
        </div>
      </CardContent>
      
      <CardContent className="pt-0 pb-2">
        <div className="flex items-center gap-1 text-xs">
          <DollarSign size={10} />
          <span className="capitalize">{order.payment_method}</span>
          {order.estimated_time && (
            <>
              <span className="mx-1">•</span>
              <span>{order.estimated_time}</span>
            </>
          )}
        </div>
      </CardContent>
      
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-2">
          {canAdvance && (
            <Button 
              onClick={handleStatusUpdate}
              size="sm"
              className="w-full text-xs"
            >
              {getNextStatusLabel(order.status)}
            </Button>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            {onViewDetails && (
              <Button 
                variant="outline" 
                onClick={() => onViewDetails(order.id)}
                size="sm"
                className="text-xs"
              >
                Detalhes
              </Button>
            )}
            
            {canCancel && (
              <Button 
                variant="destructive" 
                onClick={() => onStatusChange(order.id, 'cancelled')}
                size="sm"
                className="text-xs"
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderCard;
