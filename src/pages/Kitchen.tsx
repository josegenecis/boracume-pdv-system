
import React, { useMemo, useState } from 'react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';
import { useKDS } from '@/hooks/useKDS';
import { RefreshCw, Monitor, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Kitchen = () => {
  const { orders, updateOrderStatus, recallOrder, loading, refreshing, refresh } = useKDS();
  const [selectedKitchen, setSelectedKitchen] = useState('main');
  const navigate = useNavigate();

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
    <div className="h-full flex flex-col p-4 space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cozinha (KDS)</h1>
          <p className="text-muted-foreground">
            {orders.length} pedidos na fila • {preparingCount} em preparo
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => window.open('/kds-view', '_blank')}
            className="border-gray-300"
          >
            <Monitor className="mr-2 h-4 w-4" />
            Modo Tela Cheia
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => window.open('/tv-view', '_blank')}
            className="border-gray-300"
          >
            <Tv className="mr-2 h-4 w-4" />
            Painel TV Cliente
          </Button>

          <Button size="sm" onClick={() => refresh()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando' : 'Atualizar'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 h-full min-w-max px-1">
          {ordered.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full h-64 text-gray-400">
              <p>Nenhum pedido na cozinha no momento.</p>
            </div>
          ) : (
            ordered.map((order: any) => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onStatusChange={updateOrderStatus}
                onRecall={recallOrder}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Kitchen;
