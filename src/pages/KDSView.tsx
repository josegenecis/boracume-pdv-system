
import React, { useMemo } from 'react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';
import { useKDS, KitchenOrder } from '@/hooks/useKDS';
import { RefreshCw, Clock, ChefHat, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KDSView = () => {
  const { orders, updateOrderStatus, recallOrder, loading, refreshing, refresh } = useKDS();

  // Categorize orders
  const columns = useMemo(() => {
    const pending = orders.filter(o => o.status === 'pending' || o.status === 'accepted');
    const preparing = orders.filter(o => o.status === 'preparing');
    const ready = orders.filter(o => o.status === 'ready');

    return { pending, preparing, ready };
  }, [orders]);

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white"></div>
      </div>
    );
  }

  const renderColumn = (title: string, icon: React.ReactNode, items: KitchenOrder[], colorClass: string, targetStatus: string) => (
    <div className="flex-1 flex flex-col h-full min-w-[350px] bg-gray-50/50 rounded-xl border border-gray-200 overflow-hidden shadow-inner">
      <div className={`p-4 ${colorClass} text-white flex justify-between items-center shadow-md`}>
        <div className="flex items-center gap-2 font-bold text-lg">
          {icon}
          {title}
        </div>
        <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold shadow-sm backdrop-blur-sm">
          {items.length}
        </div>
      </div>
      {/* Centralização e Scroll Suave */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin flex flex-col items-center">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 w-full">
            {icon}
            <p className="mt-2 text-sm font-medium">Nenhum pedido</p>
          </div>
        ) : (
          items.map(order => (
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
  );

  return (
    <div className="h-screen w-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-orange-500" />
          <h1 className="text-2xl font-bold tracking-tight">KDS - Cozinha <span className="text-xs text-gray-500 ml-2">(v2.1)</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {new Date().toLocaleTimeString()}
          </div>
          <Button variant="outline" size="sm" onClick={() => refresh()} className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando' : 'Atualizar'}
          </Button>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex-1 p-4 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-[1000px]">
          {/* Coluna 1: Pendentes (Vermelho - Atenção!) */}
          {renderColumn(
            'Fila de Produção', 
            <Clock className="h-6 w-6" />, 
            columns.pending, 
            'bg-red-600', // Vermelho para chamar atenção
            'preparing'
          )}

          {/* Coluna 2: Em Preparo (Amarelo - Atenção/Processo) */}
          {renderColumn(
            'Em Preparo', 
            <ChefHat className="h-6 w-6" />, 
            columns.preparing, 
            'bg-yellow-500', // Amarelo
            'ready'
          )}

          {/* Coluna 3: Prontos (Verde - Sucesso) */}
          {renderColumn(
            'Prontos para Entrega', 
            <CheckCircle className="h-6 w-6" />, 
            columns.ready, 
            'bg-green-600', // Verde
            'delivered'
          )}
        </div>
      </div>
    </div>
  );
};

export default KDSView;
