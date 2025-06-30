
import React, { useState, useEffect } from 'react';
import StatsCard from '@/components/dashboard/StatsCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import RecentOrdersTable from '@/components/dashboard/RecentOrdersTable';
import { CreditCard, ShoppingCart, Users, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  pendingOrders: number;
  productsSold: number;
  newCustomers: number;
  totalCustomers: number;
}

interface RevenueData {
  name: string;
  revenue: number;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  customer_name: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    pendingOrders: 0,
    productsSold: 0,
    newCustomers: 0,
    totalCustomers: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Ativar notificações de pedidos
  useOrderNotifications();

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchRevenueData(),
        fetchRecentOrders()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Vendas de hoje
    const { data: todayOrders, error: todayError } = await supabase
      .from('orders')
      .select('total, items')
      .eq('user_id', user?.id)
      .gte('created_at', todayISO);

    if (todayError) throw todayError;

    const todaySales = todayOrders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
    const todayOrdersCount = todayOrders?.length || 0;

    // Produtos vendidos hoje
    const productsSold = todayOrders?.reduce((sum, order) => {
      const items = Array.isArray(order.items) ? order.items as any[] : [];
      return sum + items.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0);
    }, 0) || 0;

    // Pedidos pendentes
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user?.id)
      .in('status', ['new', 'confirmed', 'preparing']);

    if (pendingError) throw pendingError;

    // Novos clientes hoje
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('customer_name, created_at')
      .eq('user_id', user?.id);

    if (allOrdersError) throw allOrdersError;

    const customerFirstOrders = new Map();
    allOrders?.forEach(order => {
      const customerName = order.customer_name;
      if (!customerFirstOrders.has(customerName) || 
          new Date(order.created_at) < new Date(customerFirstOrders.get(customerName))) {
        customerFirstOrders.set(customerName, order.created_at);
      }
    });

    const newCustomers = Array.from(customerFirstOrders.values())
      .filter(date => new Date(date as string) >= today).length;

    const totalCustomers = customerFirstOrders.size;

    setStats({
      todaySales,
      todayOrders: todayOrdersCount,
      pendingOrders: pendingOrders?.length || 0,
      productsSold,
      newCustomers,
      totalCustomers,
    });
  };

  const fetchRevenueData = async () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const last7Days = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const { data: dayOrders, error } = await supabase
        .from('orders')
        .select('total')
        .eq('user_id', user?.id)
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDay.toISOString());

      if (error) throw error;

      const revenue = dayOrders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
      
      last7Days.push({
        name: days[date.getDay()],
        revenue
      });
    }

    setRevenueData(last7Days);
  };

  const fetchRecentOrders = async () => {
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    // Transform the data to match our Order interface
    const orders: Order[] = (ordersData || []).map(order => ({
      id: order.id,
      customer_name: order.customer_name || '',
      items: Array.isArray(order.items) ? (order.items as unknown as OrderItem[]) : [],
      total: Number(order.total),
      status: order.status,
      created_at: order.created_at
    }));

    setRecentOrders(orders);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatsTrend = (current: number, type: string) => {
    // Simular tendência baseada em dados atuais
    const trends = {
      sales: current > 1000 ? 12 : current > 500 ? 8 : 5,
      orders: current > 10 ? 15 : current > 5 ? 10 : 3,
      customers: current > 3 ? 25 : current > 1 ? 15 : 5,
    };
    
    return {
      value: trends[type as keyof typeof trends] || 0,
      positive: true
    };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando dados...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Vendas de Hoje" 
            value={formatCurrency(stats.todaySales)} 
            description={`${stats.todayOrders} pedidos realizados`}
            icon={<CreditCard />}
            trend={getStatsTrend(stats.todaySales, 'sales')}
          />
          <StatsCard 
            title="Pedidos Pendentes" 
            value={stats.pendingOrders.toString()} 
            description="Aguardando preparo/entrega"
            icon={<ShoppingCart />}
            trend={stats.pendingOrders > 5 ? { value: 2, positive: false } : undefined}
          />
          <StatsCard 
            title="Novos Clientes" 
            value={stats.newCustomers.toString()} 
            description={`Total: ${stats.totalCustomers} clientes`}
            icon={<Users />}
            trend={getStatsTrend(stats.newCustomers, 'customers')}
          />
          <StatsCard 
            title="Produtos Vendidos" 
            value={stats.productsSold.toString()} 
            description="Hoje"
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
    </DashboardLayout>
  );
};

export default Dashboard;
