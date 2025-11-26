
import React from 'react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';
import { useKDS } from '@/hooks/useKDS';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Kitchen = () => {
  const { orders, updateOrderStatus, recallOrder, loading, refresh } = useKDS();

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    // Map droppable IDs to status
    const newStatus = destination.droppableId;
    await updateOrderStatus(draggableId, newStatus);
  };

  const preparingOrders = orders.filter(order => order.status === 'preparing');
  const readyOrders = orders.filter(order => order.status === 'ready');

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] overflow-y-auto p-4">
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              Cozinha (KDS)
              <span className="text-sm font-normal text-muted-foreground ml-2 bg-gray-100 px-2 py-1 rounded-full">
                {orders.length} pedidos
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div> Preparando
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div> Prontos
              </span>
            </div>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">

            {/* PREPARING COLUMN */}
            <div className="flex flex-col h-full bg-gray-50/50 rounded-xl p-4 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-blue-700 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    {preparingOrders.length}
                  </div>
                  Em Preparo
                </h2>
              </div>

              <Droppable droppableId="preparing">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 space-y-3 overflow-y-auto min-h-[500px] transition-colors rounded-lg p-2 ${snapshot.isDraggingOver ? 'bg-blue-50 ring-2 ring-blue-200' : ''
                      }`}
                  >
                    {preparingOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                        <AlertCircle className="w-12 h-12 mb-2 opacity-20" />
                        <p>Sem pedidos em preparo</p>
                      </div>
                    ) : (
                      preparingOrders.map((order, index) => (
                        <Draggable key={order.id} draggableId={order.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`transform transition-transform ${snapshot.isDragging ? 'scale-105 rotate-1' : ''}`}
                            >
                              <KitchenOrderCard
                                order={order as any}
                                onStatusChange={updateOrderStatus}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* READY COLUMN */}
            <div className="flex flex-col h-full bg-gray-50/50 rounded-xl p-4 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-green-700 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    {readyOrders.length}
                  </div>
                  Prontos / Aguardando Entrega
                </h2>
              </div>

              <Droppable droppableId="ready">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 space-y-3 overflow-y-auto min-h-[500px] transition-colors rounded-lg p-2 ${snapshot.isDraggingOver ? 'bg-green-50 ring-2 ring-green-200' : ''
                      }`}
                  >
                    {readyOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                        <AlertCircle className="w-12 h-12 mb-2 opacity-20" />
                        <p>Sem pedidos prontos</p>
                      </div>
                    ) : (
                      readyOrders.map((order, index) => (
                        <Draggable key={order.id} draggableId={order.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`transform transition-transform ${snapshot.isDragging ? 'scale-105 rotate-1' : ''}`}
                            >
                              <KitchenOrderCard
                                order={order as any}
                                onStatusChange={updateOrderStatus}
                                onRecall={recallOrder}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
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
