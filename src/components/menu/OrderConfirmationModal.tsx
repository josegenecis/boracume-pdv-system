
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, MapPin, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OrderDetails {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  estimatedTime: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetails;
}

const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  isOpen,
  onClose,
  order
}) => {
  const navigate = useNavigate();

  const handleTrackOrder = () => {
    navigate(`/pedido/${order.orderNumber}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500 animate-scale-in" />
          </div>
          
          <DialogHeader>
            <DialogTitle className="text-xl text-green-600">
              Pedido Confirmado!
            </DialogTitle>
          </DialogHeader>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Número do Pedido:</span>
                <Badge variant="outline" className="font-mono">
                  #{order.orderNumber}
                </Badge>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Cliente:</span>
                <span>{order.customerName}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Telefone:</span>
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {order.customerPhone}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="font-medium">Tempo Estimado:</span>
                <span className="flex items-center gap-1 text-orange-600">
                  <Clock className="h-4 w-4" />
                  {order.estimatedTime}
                </span>
              </div>
              
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Total:</span>
                <span className="text-green-600">
                  R$ {order.total.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Seu pedido foi recebido e está sendo preparado.
              Você receberá atualizações em tempo real!
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Continuar Navegando
            </Button>
            <Button 
              onClick={handleTrackOrder}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Acompanhar Pedido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderConfirmationModal;
