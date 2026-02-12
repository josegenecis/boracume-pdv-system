
import React, { useMemo, useState } from 'react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';
import { useKDS } from '@/hooks/useKDS';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Kitchen = () => {
  const { orders, updateOrderStatus, recallOrder, loading, refresh } = useKDS();
  const [selectedKitchen, setSelectedKitchen] = useState('main');

  const ordered = useMemo(() => {
    return [...orders].sort((a: any, b: any) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return ta - tb;
    });
  }, [orders]);

  const preparingCount = orders.filter(o => o.status === 'preparing').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;

  const markAllAsReady = async () => {
    const preparing = orders.filter(o => o.status === 'preparing');
    await Promise.all(preparing.map(o => updateOrderStatus(o.id, 'ready')));
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col p-3 sm:p-4 overflow-hidden">
      <div className="flex-none mb-3">
        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <select
              className="h-9 px-3 border rounded-md bg-white text-sm"
              value={selectedKitchen}
              onChange={(e) => setSelectedKitchen(e.target.value)}
            >
              <option value="main">Cozinha principal</option>
            </select>
            <div className="text-xs text-muted-foreground">
              {orders.length} pedidos • {preparingCount} em preparo • {readyCount} prontos
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button size="sm" onClick={markAllAsReady} disabled={preparingCount === 0}>
              Marcar todos como pronto
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="h-full overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full items-start pb-3">
            {ordered.map((order: any) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onStatusChange={updateOrderStatus}
                onRecall={recallOrder}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kitchen;
