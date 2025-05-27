
import React from 'react';
import { Badge } from '@/components/ui/badge';

export type OrderStatusType = 'new' | 'confirmed' | 'preparing' | 'ready' | 'in_delivery' | 'delivered' | 'cancelled';

interface OrderStatusBadgeProps {
  status: OrderStatusType;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const getStatusConfig = (status: OrderStatusType) => {
    switch (status) {
      case 'new':
        return {
          label: 'Novo',
          className: 'bg-red-500 hover:bg-red-600 text-white animate-pulse',
        };
      case 'confirmed':
        return {
          label: 'Confirmado',
          className: 'bg-blue-500 hover:bg-blue-600 text-white',
        };
      case 'preparing':
        return {
          label: 'Preparando',
          className: 'bg-amber-500 hover:bg-amber-600 text-white',
        };
      case 'ready':
        return {
          label: 'Pronto',
          className: 'bg-purple-500 hover:bg-purple-600 text-white',
        };
      case 'in_delivery':
        return {
          label: 'Em Entrega',
          className: 'bg-indigo-500 hover:bg-indigo-600 text-white',
        };
      case 'delivered':
        return {
          label: 'Entregue',
          className: 'bg-green-500 hover:bg-green-600 text-white',
        };
      case 'cancelled':
        return {
          label: 'Cancelado',
          className: 'bg-gray-500 hover:bg-gray-600 text-white',
        };
      default:
        return {
          label: 'Desconhecido',
          className: 'bg-gray-400 hover:bg-gray-500 text-white',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
};

export default OrderStatusBadge;
