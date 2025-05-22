
import React, { useState } from 'react';
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard';

// Define types for our order data
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  options?: string[];
  notes?: string;
}

interface KitchenOrder {
  id: string;
  orderNumber: string;
  customer: string;
  items: OrderItem[];
  priority: 'normal' | 'high';
  timestamp: Date;
}

// Sample data
const initialOrders: KitchenOrder[] = [
  {
    id: '1',
    orderNumber: '8765',
    customer: 'João Silva',
    items: [
      {
        id: '101',
        name: 'X-Burger Especial',
        quantity: 2,
        options: ['Sem cebola', 'Bacon extra'],
        notes: 'Ponto bem passado'
      },
      {
        id: '102',
        name: 'Batata Frita Grande',
        quantity: 1
      }
    ],
    priority: 'normal',
    timestamp: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
  },
  {
    id: '2',
    orderNumber: '8764',
    customer: 'Maria Souza',
    items: [
      {
        id: '201',
        name: 'Pizza Margherita',
        quantity: 1,
        notes: 'Borda recheada com catupiry'
      },
      {
        id: '202',
        name: 'Refrigerante Cola 2L',
        quantity: 1
      }
    ],
    priority: 'high',
    timestamp: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
  },
  {
    id: '3',
    orderNumber: '8763',
    customer: 'Carlos Oliveira',
    items: [
      {
        id: '301',
        name: 'Combo X-Salada',
        quantity: 2,
        options: ['Sem picles', 'Maionese à parte']
      },
      {
        id: '302',
        name: 'Milk Shake Chocolate',
        quantity: 2
      }
    ],
    priority: 'normal',
    timestamp: new Date(Date.now() - 8 * 60 * 1000) // 8 minutes ago
  }
];

const Kitchen = () => {
  const [pendingOrders, setPendingOrders] = useState<KitchenOrder[]>([...initialOrders]);
  const [preparingOrders, setPreparingOrders] = useState<KitchenOrder[]>([]);
  const [readyOrders, setReadyOrders] = useState<KitchenOrder[]>([]);
  
  const handleStatusChange = (id: string, status: 'preparing' | 'ready') => {
    if (status === 'preparing') {
      const order = pendingOrders.find(o => o.id === id);
      if (order) {
        setPendingOrders(pendingOrders.filter(o => o.id !== id));
        setPreparingOrders([...preparingOrders, order]);
      }
    } else if (status === 'ready') {
      const order = preparingOrders.find(o => o.id === id);
      if (order) {
        setPreparingOrders(preparingOrders.filter(o => o.id !== id));
        setReadyOrders([...readyOrders, order]);
      }
    }
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Painel da Cozinha (KDS)</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h2 className="font-semibold text-lg flex items-center">
            <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            Pendentes ({pendingOrders.length})
          </h2>
          {pendingOrders.map(order => (
            <KitchenOrderCard 
              key={order.id}
              order={order}
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
              order={order}
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
              order={order}
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
