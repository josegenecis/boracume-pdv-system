
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';
import { useKitchenOrders } from '@/hooks/useKitchenOrders';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';

const Kitchen = () => {
  const { orders, loading, error, updateOrderStatus, createSampleOrder, refetch } = useKitchenOrders();
  const { toast } = useToast();

  const handleStatusChange = async (id: string, status: 'preparing' | 'ready') => {
    try {
      await updateOrderStatus(id, status);
      toast({
        title: "Status atualizado",
        description: `Pedido marcado como ${status === 'preparing' ? 'em preparo' : 'pronto'}`,
      });
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do pedido",
        variant: "destructive"
      });
    }
  };

  const handleCreateSampleOrder = async () => {
    try {
      await createSampleOrder();
      toast({
        title: "Pedido criado",
        description: "Pedido de teste criado com sucesso",
      });
    } catch (error) {
      console.error('Erro ao criar pedido teste:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar pedido de teste",
        variant: "destructive"
      });
    }
  };

  const pendingOrders = orders.filter(order => order.status === 'pending');
  const preparingOrders = orders.filter(order => order.status === 'preparing');
  const readyOrders = orders.filter(order => order.status === 'ready');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Painel da Cozinha (KDS)</h1>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((col) => (
            <div key={col} className="space-y-4">
              <Skeleton className="h-8 w-40" />
              {[1, 2].map((item) => (
                <Skeleton key={item} className="h-48 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Painel da Cozinha (KDS)</h1>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Erro ao carregar pedidos: {error}</p>
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Painel da Cozinha (KDS)</h1>
        <div className="flex gap-2">
          <Button onClick={handleCreateSampleOrder} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Pedido Teste
          </Button>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h2 className="font-semibold text-lg flex items-center">
            <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            Pendentes ({pendingOrders.length})
          </h2>
          {pendingOrders.map(order => (
            <KitchenOrderCard 
              key={order.id}
              order={{
                ...order,
                timestamp: new Date(order.created_at)
              }}
              onStatusChange={handleStatusChange}
            />
          ))}
          {pendingOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Não há pedidos pendentes
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <h2 className="font-semibold text-lg flex items-center">
            <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            Em Preparo ({preparingOrders.length})
          </h2>
          {preparingOrders.map(order => (
            <KitchenOrderCard 
              key={order.id}
              order={{
                ...order,
                timestamp: new Date(order.created_at)
              }}
              onStatusChange={handleStatusChange}
            />
          ))}
          {preparingOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Não há pedidos em preparo
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <h2 className="font-semibold text-lg flex items-center">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Prontos ({readyOrders.length})
          </h2>
          {readyOrders.map(order => (
            <KitchenOrderCard 
              key={order.id}
              order={{
                ...order,
                timestamp: new Date(order.created_at)
              }}
              onStatusChange={handleStatusChange}
            />
          ))}
          {readyOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Não há pedidos prontos
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Kitchen;
