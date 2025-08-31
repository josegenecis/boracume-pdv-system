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
  XCircle,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  total_price: number;
  options?: Array<{name: string; price: number}>;
  variations?: Array<{name: string; options: string[]}>;
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
  subtotal?: number;
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

  const handleStatusUpdate = (newStatus: string) => {
    if (onStatusChange) {
      onStatusChange(order.id, newStatus);
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
            <span>Pedido {order.order_number}</span>
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
              
              <div className="space-y-2">
                {order.items.map((item, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                            {item.quantity}x
                          </span>
                          <span className="text-sm font-medium">{item.product_name}</span>
                        </div>
                        
                        {item.variations && item.variations.length > 0 && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="font-medium">Variações:</span>
                            <div className="ml-2">
                              {item.variations.map((variation, vIndex) => (
                                <div key={vIndex}>
                                  {variation.name}: {variation.options.join(', ')}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {item.options && item.options.length > 0 && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="font-medium">Opções:</span>
                            <div className="ml-2">
                              {item.options.map((option, oIndex) => (
                                <div key={oIndex}>
                                  {option.name} (+{formatCurrency(option.price)})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {item.notes && (
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="font-medium">Observações:</span> {item.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-right">
                        {formatCurrency(item.total_price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Resumo do Pedido */}
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Resumo do Pedido</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(order.subtotal || order.total)}</span>
                </div>
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa de entrega:</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Método de pagamento:</span>
                  <span className="font-medium">{order.payment_method.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Informações Adicionais */}
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Informações Adicionais</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">Pedido realizado em: {formatDateTime(order.created_at)}</span>
                </div>
                {order.estimated_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span className="text-xs">Tempo estimado: {order.estimated_time} minutos</span>
                  </div>
                )}
                {order.delivery_instructions && (
                  <div className="text-xs">
                    <span className="font-medium">Instruções de entrega:</span>
                    <p className="mt-1 text-gray-600">{order.delivery_instructions}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Botões de Ação */}
            {onStatusChange && (
              <div className="space-y-2">
                {order.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleStatusUpdate('preparing')}
                      className="flex-1 bg-green-600 hover:bg-green-700 h-8 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Aceitar
                    </Button>
                    <Button
                      onClick={() => handleStatusUpdate('cancelled')}
                      variant="destructive"
                      className="flex-1 h-8 text-xs"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                )}
                
                {order.status === 'preparing' && (
                  <Button
                    onClick={() => handleStatusUpdate('ready')}
                    className="w-full h-8 text-xs"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Marcar como Pronto
                  </Button>
                )}
                
                {order.status === 'ready' && (
                  <Button
                    onClick={() => handleStatusUpdate('delivered')}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                  >
                    <Truck className="h-3 w-3 mr-1" />
                    Finalizar Pedido
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsModal;