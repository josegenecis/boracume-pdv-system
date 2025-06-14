import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  Copy, 
  ExternalLink,
  CreditCard,
  Truck,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  options?: string[];
  variations?: string[];
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_latitude?: number;
  customer_longitude?: number;
  google_maps_link?: string;
  items: OrderItem[];
  total: number;
  delivery_fee?: number;
  status: string;
  acceptance_status?: string;
  payment_method: string;
  order_type: string;
  created_at: string;
  estimated_time?: string;
  delivery_instructions?: string;
}

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (orderId: string, newStatus: string) => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onStatusChange
}) => {
  const { toast } = useToast();

  if (!order) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const copyLocation = async () => {
    if (order.customer_latitude && order.customer_longitude) {
      const coordinates = `${order.customer_latitude},${order.customer_longitude}`;
      await navigator.clipboard.writeText(coordinates);
      toast({
        title: "Coordenadas copiadas!",
        description: "Localização copiada para a área de transferência",
      });
    } else if (order.customer_address) {
      await navigator.clipboard.writeText(order.customer_address);
      toast({
        title: "Endereço copiado!",
        description: "Endereço copiado para a área de transferência",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'preparing':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pendente',
      preparing: 'Preparando',
      ready: 'Pronto',
      completed: 'Finalizado',
      delivered: 'Entregue',
      cancelled: 'Cancelado'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'pickup':
        return <Package className="h-4 w-4 text-green-600" />;
      case 'dine_in':
        return <div className="w-4 h-4 bg-orange-600 rounded-sm" />;
      default:
        return null;
    }
  };

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Pedido #{order.order_number}</span>
            <div className="flex items-center gap-2">
              {getStatusIcon(order.status)}
              <Badge variant="outline">
                {getStatusLabel(order.status)}
              </Badge>
              <div className="flex items-center gap-1">
                {getOrderTypeIcon(order.order_type)}
                <span className="text-sm text-muted-foreground">
                  {getOrderTypeLabel(order.order_type)}
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Informações do Cliente */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações do Cliente
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                {order.customer_name && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Nome:</span>
                    <span>{order.customer_name}</span>
                  </div>
                )}
                
                {order.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{order.customer_phone}</span>
                  </div>
                )}
                
                {order.customer_address && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      <span className="flex-1">{order.customer_address}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyLocation}
                        className="h-8"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar Localização
                      </Button>
                      
                      {order.google_maps_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(order.google_maps_link, '_blank')}
                          className="h-8"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir no Maps
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Itens do Pedido */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Itens do Pedido ({order.items.length})
              </h3>
              
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium">
                        {item.quantity}x {item.product_name}
                      </div>
                       <div className="font-semibold">
                         {formatCurrency(item.total)}
                       </div>
                    </div>
                    
                    {item.variations && item.variations.length > 0 && (
                      <div className="ml-4 mt-1 text-sm text-blue-600">
                        <span className="font-medium">Variações:</span>
                        <span className="ml-1">{item.variations.join(', ')}</span>
                      </div>
                    )}
                    
                    {item.options && item.options.length > 0 && (
                      <div className="ml-4 mt-1 text-sm text-muted-foreground">
                        {item.options.join(', ')}
                      </div>
                    )}
                    
                    {item.notes && (
                      <div className="ml-4 mt-2 text-sm italic text-muted-foreground">
                        Obs: {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo do Pedido */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Resumo do Pedido
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(order.total - (order.delivery_fee || 0))}</span>
                </div>
                
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa de entrega:</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
                
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Pagamento:</span>
                  <span className="font-medium">{order.payment_method.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Informações Adicionais
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Data/Hora:</span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
                
                {order.estimated_time && (
                  <div className="flex justify-between">
                    <span>Tempo estimado:</span>
                    <span>{order.estimated_time}</span>
                  </div>
                )}
                
                {order.delivery_instructions && (
                  <div className="space-y-1">
                    <span className="font-medium">Instruções de entrega:</span>
                    <p className="text-sm text-muted-foreground">
                      {order.delivery_instructions}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Ações */}
        {onStatusChange && order.acceptance_status === 'pending_acceptance' && (
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => onStatusChange(order.id, 'preparing')}
              className="flex-1"
            >
              Aceitar Pedido
            </Button>
            <Button
              variant="destructive"
              onClick={() => onStatusChange(order.id, 'cancelled')}
              className="flex-1"
            >
              Cancelar Pedido
            </Button>
          </div>
        )}
        
        {onStatusChange && ['preparing', 'ready'].includes(order.status) && (
          <div className="flex gap-2 pt-4 border-t">
            {order.status === 'preparing' && (
              <Button
                onClick={() => onStatusChange(order.id, 'ready')}
                className="flex-1"
              >
                Marcar como Pronto
              </Button>
            )}
            {order.status === 'ready' && (
              <Button
                onClick={() => onStatusChange(order.id, 'completed')}
                className="flex-1"
              >
                Finalizar Pedido
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsModal;