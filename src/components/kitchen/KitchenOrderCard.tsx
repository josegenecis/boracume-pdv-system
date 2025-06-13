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
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  items: OrderItem[];
  priority: 'normal' | 'high';
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  created_at: string;
  updated_at: string;
  timestamp: Date;
}

interface KitchenOrderCardProps {
  order: KitchenOrder;
  onStatusChange: (id: string, status: 'preparing' | 'ready') => void;
}

const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({ order, onStatusChange }) => {
  const [currentStatus, setCurrentStatus] = useState<'pending' | 'preparing' | 'ready'>(order.status as 'pending' | 'preparing' | 'ready');
  
  const handleStatusChange = (newStatus: 'preparing' | 'ready') => {
    setCurrentStatus(newStatus);
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
              Pedido #{order.order_number}
              {order.priority === 'high' && (
                <Badge className="bg-red-500">URGENTE</Badge>
              )}
            </CardTitle>
            <div className="text-sm text-muted-foreground">Cliente: {order.customer_name}</div>
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
              {(item as any).variations && (item as any).variations.length > 0 && (
                <ul className="ml-4 mt-1 text-xs text-muted-foreground">
                  {(item as any).variations.map((variation: any, index: number) => {
                    console.log('Rendering variation:', variation); // Debug log
                    
                    // Ensure we only render strings
                    const variationName = typeof variation.name === 'string' ? variation.name : String(variation.name || '');
                    
                    let optionsText = 'N/A';
                    if (variation.selectedOptions) {
                      if (Array.isArray(variation.selectedOptions)) {
                        optionsText = variation.selectedOptions
                          .map((opt: any) => typeof opt === 'string' ? opt : String(opt.name || opt.option || opt))
                          .filter(Boolean)
                          .join(', ') || 'N/A';
                      } else {
                        optionsText = String(variation.selectedOptions);
                      }
                    }
                    
                    const price = Number(variation.price) || 0;
                    const priceText = price > 0 ? ` (+${price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : '';
                    
                    return (
                      <li key={index} className="font-medium text-blue-600">
                        {variationName}: {optionsText}{priceText}
                      </li>
                    );
                  })}
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
        {currentStatus === 'pending' && (
          <Button 
            className="w-full" 
            onClick={() => handleStatusChange('preparing')}
          >
            Iniciar Preparo
          </Button>
        )}
        {currentStatus === 'preparing' && (
          <Button 
            className="w-full bg-green-600 hover:bg-green-700" 
            onClick={() => handleStatusChange('ready')}
          >
            Marcar como Pronto
          </Button>
        )}
        {currentStatus === 'ready' && (
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700" 
            variant="default"
          >
            Saiu para Entrega
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default KitchenOrderCard;
