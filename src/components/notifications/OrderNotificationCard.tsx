import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Package, Clock, User } from 'lucide-react';

interface OrderNotificationCardProps {
  orderNumber: string;
  customerName: string;
  itemCount: number;
  total: number;
  orderType: string;
  onClose: () => void;
  onAccept: () => void;
}

const OrderNotificationCard: React.FC<OrderNotificationCardProps> = ({
  orderNumber,
  customerName,
  itemCount,
  total,
  orderType,
  onClose,
  onAccept
}) => {
  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery':
        return 'Entrega';
      case 'pickup':
        return 'Retirada';
      case 'dine_in':
        return 'No Local';
      default:
        return type;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card className="fixed top-4 right-4 w-80 z-50 border-2 border-orange-500 bg-white shadow-lg animate-in slide-in-from-right">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-600" />
            <span className="font-semibold text-lg">Novo Pedido!</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">#{orderNumber}</span>
            <Badge variant="outline">
              {getOrderTypeLabel(orderType)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{customerName}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{itemCount} item(s)</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            Depois
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
          >
            Aceitar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderNotificationCard;