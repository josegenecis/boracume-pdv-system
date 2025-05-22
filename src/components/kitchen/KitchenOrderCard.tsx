
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Clock } from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  options?: string[];
}

interface KitchenOrder {
  id: string;
  orderNumber: string;
  customer: string;
  items: OrderItem[];
  priority: 'normal' | 'high';
  timestamp: Date;
}

interface KitchenOrderCardProps {
  order: KitchenOrder;
  onStatusChange: (id: string, status: 'preparing' | 'ready') => void;
}

const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({ order, onStatusChange }) => {
  const [status, setStatus] = useState<'pending' | 'preparing' | 'ready'>('pending');
  
  const handleStatusChange = (newStatus: 'preparing' | 'ready') => {
    setStatus(newStatus);
    onStatusChange(order.id, newStatus);
  };
  
  // Calculate time passed since order was created
  const getTimePassed = (timestamp: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - timestamp.getTime()) / 1000 / 60); // minutes
    
    if (diff < 1) return 'Agora';
    if (diff === 1) return '1 minuto';
    return `${diff} minutos`;
  };
  
  const timePassed = getTimePassed(order.timestamp);
  
  return (
    <Card className={`w-full ${order.priority === 'high' ? 'border-red-500 border-2' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Pedido #{order.orderNumber}
              {order.priority === 'high' && (
                <Badge className="bg-red-500">URGENTE</Badge>
              )}
            </CardTitle>
            <div className="text-sm text-muted-foreground">Cliente: {order.customer}</div>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock size={14} className="mr-1" />
            {timePassed}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <Separator className="my-2" />
        <ul className="space-y-2">
          {order.items.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex justify-between">
                <div className="font-medium">{item.quantity}x {item.name}</div>
              </div>
              {item.options && item.options.length > 0 && (
                <ul className="ml-4 mt-1 text-xs text-muted-foreground">
                  {item.options.map((option, index) => (
                    <li key={index}>• {option}</li>
                  ))}
                </ul>
              )}
              {item.notes && (
                <div className="ml-4 mt-1 text-xs italic text-muted-foreground">
                  Obs: {item.notes}
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-0 flex justify-between">
        {status === 'pending' && (
          <Button 
            className="w-full" 
            onClick={() => handleStatusChange('preparing')}
          >
            Iniciar Preparo
          </Button>
        )}
        {status === 'preparing' && (
          <Button 
            className="w-full bg-boracume-green hover:bg-boracume-green/90" 
            onClick={() => handleStatusChange('ready')}
          >
            Marcar como Pronto
          </Button>
        )}
        {status === 'ready' && (
          <Button 
            className="w-full" 
            variant="outline" 
            disabled
          >
            Pronto para Entrega
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default KitchenOrderCard;
