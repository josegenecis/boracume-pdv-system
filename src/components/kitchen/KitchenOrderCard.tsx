import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock, RotateCcw } from 'lucide-react';

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
  timestamp?: Date; // Optional now as we might use created_at
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
  const isHighPriority = order.priority === 'high' || (order.items.length > 5); // Simple logic for priority

  return (
    <Card className={`w-full ${isHighPriority ? 'border-red-500 border-2' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              #{order.order_number}
              {isHighPriority && (
                <Badge className="bg-red-500 text-[10px] h-5 px-1">URGENTE</Badge>
              )}
            </CardTitle>
            <div className="text-sm text-muted-foreground truncate max-w-[150px]">{order.customer_name}</div>
          </div>
          <div className={`flex items-center text-sm font-medium ${parseInt(timePassed) > 20 ? 'text-red-500' : 'text-muted-foreground'}`}>
            <Clock size={14} className="mr-1" />
            {timePassed}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <Separator className="my-2" />
        <ul className="space-y-2">
          {order.items.map((item, idx) => (
            <li key={idx} className="text-base">
              <div className="flex justify-between">
                <div className="font-semibold">{item.quantity}x {item.name}</div>
              </div>

              {item.variations && item.variations.length > 0 && (
                <ul className="ml-4 mt-1 text-sm">
                  {item.variations.map((variation, index) => {
                    if (!variation.selectedOptions || variation.selectedOptions.length === 0) {
                      return null;
                    }

                    return variation.selectedOptions.map((option, optIndex) => (
                      <li key={`${index}-${optIndex}`} className="font-medium text-blue-600">
                        • {option}
                      </li>
                    ));

                  })}
                </ul>
              )}
              {item.notes && (
                <div className="ml-4 mt-1 text-xs italic text-muted-foreground bg-yellow-50 p-1 rounded">
                  Obs: {item.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-0 flex gap-2">
        {order.status === 'pending' && (
          <Button
            className="w-full"
            onClick={() => handleStatusChange('preparing')}
          >
            Iniciar Preparo
          </Button>
        )}
        {order.status === 'preparing' && (
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => handleStatusChange('ready')}
          >
            Marcar Pronto
          </Button>
        )}
        {order.status === 'ready' && (
          <>
            <Button
              className="flex-1 bg-gray-600 hover:bg-gray-700"
              variant="default"
              onClick={() => handleStatusChange('delivered')}
            >
              Entregar
            </Button>
            {onRecall && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onRecall(order.id)}
                title="Voltar para Preparo"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default KitchenOrderCard;
