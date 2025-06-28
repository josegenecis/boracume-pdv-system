
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Phone, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface KitchenOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  items: any[];
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface DragDropKitchenBoardProps {
  orders: KitchenOrder[];
  onOrderUpdate: (orderId: string, newStatus: string) => void;
}

const statusColumns = [
  { key: 'pending', title: 'Pendentes', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'preparing', title: 'Preparando', color: 'bg-blue-50 border-blue-200' },
  { key: 'ready', title: 'Prontos', color: 'bg-green-50 border-green-200' }
];

export const DragDropKitchenBoard: React.FC<DragDropKitchenBoardProps> = ({
  orders,
  onOrderUpdate
}) => {
  const { toast } = useToast();
  const [draggedOrder, setDraggedOrder] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, orderId: string) => {
    setDraggedOrder(orderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', orderId);
    
    // Adicionar estilo visual ao item sendo arrastado
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedOrder(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    
    const orderId = e.dataTransfer.getData('text/plain');
    if (!orderId || !draggedOrder) return;

    const order = orders.find(o => o.id === orderId);
    if (!order || order.status === newStatus) return;

    try {
      const { error } = await supabase
        .from('kitchen_orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      onOrderUpdate(orderId, newStatus);
      
      toast({
        title: "Status Atualizado!",
        description: `Pedido #${order.order_number} movido para ${getStatusTitle(newStatus)}`,
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do pedido.",
        variant: "destructive"
      });
    }

    setDraggedOrder(null);
    setDragOverColumn(null);
  }, [orders, draggedOrder, onOrderUpdate, toast]);

  const getStatusTitle = (status: string) => {
    const column = statusColumns.find(col => col.key === status);
    return column?.title || status;
  };

  const getOrdersByStatus = (status: string) => {
    return orders.filter(order => order.status === status);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} min atrás`;
    } else {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
      {statusColumns.map((column) => (
        <div
          key={column.key}
          className={`border-2 rounded-lg p-4 h-full transition-colors ${
            column.color
          } ${
            dragOverColumn === column.key ? 'border-dashed border-blue-400 bg-blue-50' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, column.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.key)}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{column.title}</h3>
            <Badge variant="secondary">
              {getOrdersByStatus(column.key).length}
            </Badge>
          </div>
          
          <div className="space-y-3 min-h-[200px]">
            {getOrdersByStatus(column.key).map((order) => (
              <Card
                key={order.id}
                draggable
                onDragStart={(e) => handleDragStart(e, order.id)}
                onDragEnd={handleDragEnd}
                className={`cursor-move hover:shadow-lg transition-all duration-200 ${
                  draggedOrder === order.id ? 'rotate-2 scale-105' : ''
                } ${
                  order.priority === 'high' ? 'border-red-300 shadow-red-100' : ''
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      #{order.order_number}
                    </CardTitle>
                    <div className="flex gap-1">
                      {order.priority !== 'normal' && (
                        <Badge className={getPriorityColor(order.priority)}>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {order.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{order.customer_name}</span>
                    </div>
                    
                    {order.customer_phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{order.customer_phone}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatTime(order.created_at)}</span>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        ITENS:
                      </p>
                      <div className="space-y-1">
                        {order.items.slice(0, 3).map((item: any, index: number) => (
                          <div key={index} className="text-xs">
                            <span className="font-medium">{item.quantity}x</span> {item.product_name}
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{order.items.length - 3} mais...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {getOrdersByStatus(column.key).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhum pedido</p>
                <p className="text-xs">Arraste pedidos aqui</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
