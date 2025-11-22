
import React from 'react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';
import BulkActionButton from '@/components/kitchen/BulkActionButton';
import { useKitchenOrders } from '@/hooks/useKitchenOrders';

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';

const Kitchen = () => {
  const { orders, updateOrderStatus, updateMultipleOrdersStatus, loading, error } = useKitchenOrders();

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as 'pending' | 'preparing' | 'ready';
    await updateOrderStatus(draggableId, newStatus);
  };


  const pendingOrders = orders.filter(order => order.status === 'pending');
  const preparingOrders = orders.filter(order => order.status === 'preparing');
  const readyOrders = orders.filter(order => order.status === 'ready');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        Erro ao carregar pedidos: {error}
      </div>
    );
  }


  return (
    <div className="h-[calc(100vh-120px)] overflow-y-auto">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Cozinha (KDS)</h1>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {orders.length} pedidos ativos
            </div>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="text-xl font-semibold text-yellow-600">
                  Pendentes ({pendingOrders.length})
                </h2>
                <div className="w-full sm:w-auto">
                  <BulkActionButton
                    orderIds={pendingOrders.map(o => o.id)}
                    action="preparing"
                    onBulkAction={updateMultipleOrdersStatus}
                  />
                </div>
              </div>
              <Droppable droppableId="pending">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3 max-h-[70vh] overflow-y-auto"
                  >
                    {pendingOrders.map((order, index) => (
                      <Draggable key={order.id} draggableId={order.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <KitchenOrderCard
                              order={order}
                              onStatusChange={updateOrderStatus}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {pendingOrders.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        Nenhum pedido pendente
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="text-xl font-semibold text-blue-600">
                  Preparando ({preparingOrders.length})
                </h2>
                <div className="w-full sm:w-auto">
                  <BulkActionButton
                    orderIds={preparingOrders.map(o => o.id)}
                    action="ready"
                    onBulkAction={updateMultipleOrdersStatus}
                  />
                </div>
              </div>
              <Droppable droppableId="preparing">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3 max-h-[70vh] overflow-y-auto"
                  >
                    {preparingOrders.map((order, index) => (
                      <Draggable key={order.id} draggableId={order.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <KitchenOrderCard
                              order={order}
                              onStatusChange={updateOrderStatus}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {preparingOrders.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        Nenhum pedido em preparo
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="text-xl font-semibold text-green-600">
                  Prontos ({readyOrders.length})
                </h2>
                <div className="w-full sm:w-auto">
                  <BulkActionButton
                    orderIds={readyOrders.map(o => o.id)}
                    action="completed"
                    onBulkAction={updateMultipleOrdersStatus}
                  />
                </div>
              </div>
              <Droppable droppableId="ready">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3 max-h-[70vh] overflow-y-auto"
                  >
                    {readyOrders.map((order, index) => (
                      <Draggable key={order.id} draggableId={order.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <KitchenOrderCard
                              order={order}
                              onStatusChange={updateOrderStatus}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {readyOrders.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        Nenhum pedido pronto
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </DragDropContext>

      </div>
    </div>
  );
};

export default Kitchen;
