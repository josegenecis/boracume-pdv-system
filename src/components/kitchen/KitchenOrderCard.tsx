import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, RotateCcw, Package, User, CheckCircle, Truck } from 'lucide-react';

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
  items: OrderItem[];
  priority?: 'normal' | 'high';
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
  timestamp?: Date;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ready': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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

  return (
    <Card className={`w-full hover:shadow-md transition-shadow ${isHighPriority ? 'border-red-500 border-2' : 'border-gray-200'}`}>
      <CardHeader className="pb-3 bg-gray-50/50">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
              #{order.order_number}
              {isHighPriority && (
                <Badge className="bg-red-500 hover:bg-red-600 text-white text-[10px] h-5 px-1.5 animate-pulse">
                  URGENTE
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User size={14} />
              <span className="font-medium truncate max-w-[150px]">{order.customer_name}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <Badge className={`text-xs ${getStatusColor(order.status)}`} variant="outline">
              {getStatusLabel(order.status)}
            </Badge>
            <div className={`flex items-center text-xs font-medium ${parseInt(timePassed) > 20 ? 'text-red-600' : 'text-muted-foreground'}`}>
              <Clock size={12} className="mr-1" />
              {timePassed}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="py-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Package size={16} />
            <span>Itens do Pedido ({order.items.length})</span>
          </div>
          
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="text-sm bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-gray-900 text-base">{item.quantity}x {item.name}</span>
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
