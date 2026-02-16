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
    <Card className={`w-full min-w-[300px] shrink-0 border-2 ${isHighPriority ? 'border-red-500 shadow-red-100' : 'border-gray-200'} shadow-md transition-all hover:shadow-lg`}>
      <div className={`px-4 py-3 text-white ${getHeaderColor(order.status)}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="font-black text-2xl tracking-tight">#{order.order_number}</div>
          <div className="flex items-center gap-2">
            {isHighPriority && (
              <Badge className="bg-white text-red-600 font-bold animate-pulse">
                URGENTE
              </Badge>
            )}
            <div className="flex items-center bg-black/20 px-2 py-1 rounded text-sm font-bold backdrop-blur-sm">
              <Clock size={14} className="mr-1.5" />
              {timePassed}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="outline" className="text-white border-white/40 bg-white/10 text-xs uppercase tracking-wider">
            {getStatusLabel(order.status)}
          </Badge>
          <Badge variant="secondary" className="bg-white text-black font-bold text-xs">
            {getOrderTypeLabel(order.order_type)}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Customer Info */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-1">
              <User size={18} className="text-gray-500" />
              <span className="font-bold text-lg text-gray-800 truncate">{order.customer_name}</span>
            </div>
             {order.customer_phone && (
              <div className="flex items-center gap-3 text-sm text-gray-600 pl-1">
                <Phone size={14} />
                <span>{order.customer_phone}</span>
              </div>
            )}
        </div>

        <Separator />

        <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1 py-1 border-b border-gray-100 last:border-0">
                <div className="flex justify-between items-start">
                   <div className="flex gap-2">
                      <span className="font-black text-lg text-gray-900 min-w-[24px]">{item.quantity}x</span>
                      <span className="font-bold text-gray-800 text-lg leading-tight">{item.name}</span>
                   </div>
                </div>

                {/* Variações e Opcionais */}
                {item.variations?.map((v, i) => (
                   <div key={i} className="pl-8 text-sm text-gray-600">
                      <span className="font-medium text-blue-600">{v.name}:</span> {v.selectedOptions.join(', ')}
                   </div>
                ))}
                
                {/* Observações em DESTAQUE */}
                {item.notes && (
                  <div className="mt-1 ml-8 text-sm font-bold text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-2">
                    <span className="uppercase text-[10px] bg-red-100 px-1 rounded text-red-700 mt-0.5">Obs</span>
                    {item.notes}
                  </div>
                )}
              </div>
            ))}
        </div>
      </CardContent>
      
      <Separator />
      
      <CardFooter className="p-4 bg-gray-50">
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
