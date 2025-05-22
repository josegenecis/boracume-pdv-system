
import React from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import RecentOrdersTable from '@/components/dashboard/RecentOrdersTable';
import { CreditCard, ShoppingCart, Users, Package } from 'lucide-react';

const revenueData = [
  { name: 'Seg', revenue: 4200 },
  { name: 'Ter', revenue: 3800 },
  { name: 'Qua', revenue: 5200 },
  { name: 'Qui', revenue: 4900 },
  { name: 'Sex', revenue: 7500 },
  { name: 'Sab', revenue: 9200 },
  { name: 'Dom', revenue: 8100 },
];

const recentOrders = [
  { 
    id: '#8765', 
    customer: 'João Silva', 
    items: 3, 
    total: 89.90, 
    status: 'delivered', 
    time: '20:45' 
  },
  { 
    id: '#8764', 
    customer: 'Maria Souza', 
    items: 2, 
    total: 65.50, 
    status: 'ready', 
    time: '20:32' 
  },
  { 
    id: '#8763', 
    customer: 'Carlos Oliveira', 
    items: 4, 
    total: 115.80, 
    status: 'preparing', 
    time: '20:25' 
  },
  { 
    id: '#8762', 
    customer: 'Ana Santos', 
    items: 1, 
    total: 32.90, 
    status: 'pending', 
    time: '20:10' 
  },
  { 
    id: '#8761', 
    customer: 'Roberto Lima', 
    items: 5, 
    total: 149.90, 
    status: 'cancelled', 
    time: '19:55' 
  },
] as const;

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Vendas de Hoje" 
          value="R$ 2.589,90" 
          description="12 pedidos realizados"
          icon={<CreditCard />}
          trend={{ value: 12, positive: true }}
        />
        <StatsCard 
          title="Pedidos Pendentes" 
          value="8" 
          description="4 em preparo, 4 a iniciar"
          icon={<ShoppingCart />}
          trend={{ value: 2, positive: false }}
        />
        <StatsCard 
          title="Novos Clientes" 
          value="5" 
          description="Total: 358 clientes"
          icon={<Users />}
          trend={{ value: 10, positive: true }}
        />
        <StatsCard 
          title="Produtos Vendidos" 
          value="47" 
          description="12 diferentes itens"
          icon={<Package />}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <RevenueChart data={revenueData} />
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-4">Pedidos Recentes</h2>
        <RecentOrdersTable orders={recentOrders} />
      </div>
    </div>
  );
};

export default Dashboard;
