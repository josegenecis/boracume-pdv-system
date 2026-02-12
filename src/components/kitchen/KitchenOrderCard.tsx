import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, RotateCcw, Package, User, CheckCircle, Truck, Phone, MapPin } from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  options?: string[];
  variations?: {
    name: string;
    selectedOptions: string[];
    price: number;
  }[];
}

interface KitchenOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  items: OrderItem[];
  priority?: 'normal' | 'high';
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
  order_type?: string;
}

interface KitchenOrderCardProps {
  order: KitchenOrder;
  onStatusChange: (id: string, status: string) => void;
  onRecall?: (id: string) => void;
}

const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({ order, onStatusChange, onRecall }) => {

  const handleStatusChange = (newStatus: string) => {
    onStatusChange(order.id, newStatus);
  };

  // Calculate time passed since order was created
  const getTimePassed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60); // minutes

    if (diff < 1) return 'Agora';
    if (diff === 1) return '1 min';
    return `${diff} min`;
  };

  const timePassed = getTimePassed(order.created_at);
  const isHighPriority = order.priority === 'high' || (order.items.length > 5);

  const getHeaderColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-red-600';
      case 'preparing': return 'bg-red-600';
      case 'ready': return 'bg-green-600';
      default: return 'bg-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Pronto';
      case 'delivered': return 'Entregue';
      default: return status;
    }
  };

  const getOrderTypeColor = (type?: string) => {
    switch (type) {
      case 'delivery': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pickup': return 'bg-green-100 text-green-800 border-green-300';
      case 'dine_in': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getOrderTypeLabel = (type?: string) => {
    switch (type) {
      case 'delivery': return 'Delivery';
      case 'pickup': return 'Retirada';
      case 'dine_in': return 'Mesa';
      default: return type || 'Pedido';
    }
  };

  return (
    <Card className={`w-[280px] shrink-0 border ${isHighPriority ? 'border-red-500' : 'border-gray-200'} shadow-sm`}>
      <div className={`px-3 py-2 text-white ${getHeaderColor(order.status)}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-sm truncate">#{order.order_number}</div>
          <div className="flex items-center gap-2">
            {isHighPriority && (
              <Badge className="bg-white/20 text-white text-[10px] h-5 px-1.5">
                Urgente
              </Badge>
            )}
            <div className="flex items-center text-[11px] font-medium">
              <Clock size={12} className="mr-1" />
              {timePassed}
            </div>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-[11px] opacity-95">{getStatusLabel(order.status)}</div>
          <div className="text-[11px] opacity-95">{getOrderTypeLabel(order.order_type)}</div>
        </div>
      </div>

      <CardContent className="py-3 space-y-3">
        {/* Customer Info */}
        <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <User size={14} className="text-muted-foreground" />
              <span className="font-medium truncate">{order.customer_name}</span>
            </div>
             {order.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">{order.customer_phone}</span>
              </div>
            )}
             {order.customer_address && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground text-xs leading-tight">{order.customer_address}</span>
              </div>
            )}
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-gray-700">
            <div className="flex items-center gap-2">
              <Package size={14} />
              <span>Itens ({order.items.length})</span>
            </div>
          </div>

          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="text-sm bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-gray-900 text-sm">{item.quantity}x {item.name}</span>
                </div>

                {item.variations && item.variations.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {item.variations.map((variation, index) => {
                      if (!variation.selectedOptions || variation.selectedOptions.length === 0) return null;
                      return variation.selectedOptions.map((option, optIndex) => (
                        <li key={`${index}-${optIndex}`} className="text-xs text-blue-600 font-medium pl-2 border-l-2 border-blue-200">
                          {option}
                        </li>
                      ));
                    })}
                  </ul>
                )}
                
                {item.notes && (
                  <div className="mt-2 text-xs italic text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-100">
                    <span className="font-semibold">Obs:</span> {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      
      <Separator />
      
      <CardFooter className="pt-3 pb-3 bg-gray-50/30">
        <div className="flex w-full gap-2">
          {order.status === 'pending' && (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              onClick={() => handleStatusChange('preparing')}
            >
              <Package className="mr-2 h-4 w-4" />
              Iniciar Preparo
            </Button>
          )}
          
          {order.status === 'preparing' && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm"
              onClick={() => handleStatusChange('ready')}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Marcar Pronto
            </Button>
          )}
          
          {order.status === 'ready' && (
            <div className="flex w-full gap-2">
              {onRecall && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onRecall(order.id)}
                  title="Voltar para Preparo"
                  className="shrink-0"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button
                className="flex-1 bg-gray-800 hover:bg-gray-900 text-white shadow-sm"
                onClick={() => handleStatusChange('delivered')}
              >
                <Truck className="mr-2 h-4 w-4" />
                Entregar
              </Button>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default KitchenOrderCard;
