import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OrderStatusSelectProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
}

const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({ currentStatus, onStatusChange }) => {
  const statusOptions = [
    { value: 'pending', label: 'Pendente' },
    { value: 'confirmed', label: 'Confirmado' },
    { value: 'preparing', label: 'Preparando' },
    { value: 'ready', label: 'Pronto' },
    { value: 'in_delivery', label: 'Saiu para Entrega' },
    { value: 'delivered', label: 'Finalizado' },
    { value: 'completed', label: 'Finalizado' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  const getCurrentStatusLabel = () => {
    const status = statusOptions.find(option => option.value === currentStatus);
    return status ? status.label : currentStatus;
  };

  return (
    <Select value={currentStatus} onValueChange={onStatusChange}>
      <SelectTrigger className="w-32">
        <SelectValue>{getCurrentStatusLabel()}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default OrderStatusSelect;
