
import React from 'react';
import { Badge } from '@/components/ui/badge';

export type OrderStatusType = 
  | 'new'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'in_delivery'
  | 'delivered'
  | 'cancelled';

interface OrderStatusBadgeProps {
  status: OrderStatusType;
  className?: string;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, className = "" }) => {
  const getStatusConfig = (status: OrderStatusType) => {
    switch (status) {
      case 'new':
        return { label: 'Novo', color: 'bg-red-100 text-red-800 border-red-300' };
      case 'pending':
        return { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
      case 'confirmed':
        return { label: 'Confirmado', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'preparing':
        return { label: 'Em Produção', color: 'bg-green-100 text-green-800 border-green-300' };
      case 'ready':
        return { label: 'Pronto', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'in_delivery':
        return { label: 'Saiu para Entrega', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'delivered':
        return { label: 'Entregue', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'cancelled':
        return { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-300' };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge className={`${config.color} ${className}`} variant="outline">
      {config.label}
    </Badge>
  );
};

export default OrderStatusBadge;
