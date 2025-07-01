
import React from 'react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';
import BulkActionButton from '@/components/kitchen/BulkActionButton';
import { useKitchenOrders } from '@/hooks/useKitchenOrders';

const Kitchen = () => {
  const { orders, updateOrderStatus, updateMultipleOrdersStatus, loading } = useKitchenOrders();

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

  return (
    <div className="h-[calc(100vh-120px)] overflow-y-auto">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Cozinha (KDS)</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-yellow-600">
                Pendentes ({pendingOrders.length})
              </h2>
              <BulkActionButton
                orderIds={pendingOrders.map(o => o.id)}
                action="preparing"
                onBulkAction={updateMultipleOrdersStatus}
              />
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {pendingOrders.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={updateOrderStatus}
                />
              ))}
              {pendingOrders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum pedido pendente
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-blue-600">
                Preparando ({preparingOrders.length})
              </h2>
              <BulkActionButton
                orderIds={preparingOrders.map(o => o.id)}
                action="ready"
                onBulkAction={updateMultipleOrdersStatus}
              />
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {preparingOrders.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={updateOrderStatus}
                />
              ))}
              {preparingOrders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum pedido em preparo
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-green-600">
                Prontos ({readyOrders.length})
              </h2>
              <BulkActionButton
                orderIds={readyOrders.map(o => o.id)}
                action="completed"
                onBulkAction={updateMultipleOrdersStatus}
              />
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {readyOrders.map((order) => (
                <KitchenOrderCard
                  key={order.id}
                  order={order}
                  onStatusChange={updateOrderStatus}
                />
              ))}
              {readyOrders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum pedido pronto
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kitchen;
