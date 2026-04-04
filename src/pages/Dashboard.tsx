

import React, { useState, useEffect, useCallback } from 'react';

import StatsCard from '@/components/dashboard/StatsCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import RecentOrdersTable from '@/components/dashboard/RecentOrdersTable';
import { CreditCard, Users, Package, TrendingUp, DollarSign, ClipboardList, ShoppingBag, Settings, MessageCircle, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  pendingOrders: number;
  productsSold: number;
  newCustomers: number;
  totalCustomers: number;
  averageTicket: number;
  monthlyExpenses: number;
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

const normalizeItems = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayOrders: 0,
    pendingOrders: 0,
    productsSold: 0,
    newCustomers: 0,
    totalCustomers: 0,
    averageTicket: 0,
    monthlyExpenses: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🔍 [DASHBOARD] useEffect executado, user:', user?.id);
    if (user) {
      console.log('🔍 [DASHBOARD] Iniciando fetchDashboardData...');
      fetchDashboardData();
    } else {
      console.log('🔍 [DASHBOARD] Usuário não encontrado, não carregando dados');
    }
  }, [user]);


  const fetchDashboardData = useCallback(async () => {
    console.log('🔍 [DASHBOARD] fetchDashboardData iniciado');
    try {
      setLoading(true);
      console.log('🔍 [DASHBOARD] Executando Promise.all para carregar dados...');
      
      // Implementar timeout para as queries do dashboard
      const dataPromise = Promise.all([
        fetchStats(),
        fetchRevenueData(),
        fetchRecentOrders()
      ]);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout no carregamento dos dados do dashboard')), 10000)
      );
      
      await Promise.race([dataPromise, timeoutPromise]);
      console.log('✅ [DASHBOARD] Dados carregados com sucesso');
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao carregar dados do dashboard:', error);
      console.error('❌ [DASHBOARD] Stack trace:', error.stack);
    } finally {
      console.log('🔍 [DASHBOARD] Finalizando loading...');
      setLoading(false);
    }
  }, [user]);


  const fetchStats = async () => {
    console.log('🔍 [DASHBOARD] fetchStats iniciado');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    console.log('🔍 [DASHBOARD] Buscando vendas de hoje...');
    // Vendas de hoje
    const { data: todayOrders, error: todayError } = await supabase
      .from('orders')
      .select('total, items, status, acceptance_status')
      .eq('user_id', user?.id)
      .gte('created_at', todayISO);

    if (todayError) throw todayError;

    const todayOrdersSafe = (todayOrders || []).filter((o: any) => {
      const status = String(o?.status || '');
      const acceptance = String(o?.acceptance_status || '');
      if (status === 'cancelled') return false;
      if (acceptance === 'awaiting_pix_payment') return false;
      return true;
    });

    const todaySales = todayOrdersSafe.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
    const todayOrdersCount = todayOrdersSafe.length;

    // Produtos vendidos hoje
    const productsSold = todayOrdersSafe.reduce((sum: number, order: any) => {
      const items = normalizeItems(order.items) as any[];
      return sum + items.reduce((itemSum: number, item: any) => itemSum + (Number(item?.quantity) || 0), 0);
    }, 0);

    // Pedidos pendentes
    const { data: pendingOrders, error: pendingError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', user?.id)
      .in('status', ['pending', 'accepted', 'preparing', 'ready', 'in_delivery']);

    if (pendingError) throw pendingError;

    // Novos clientes hoje
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('customer_name, created_at')
      .eq('user_id', user?.id);

    if (allOrdersError) throw allOrdersError;

    const customerFirstOrders = new Map();
    allOrders?.forEach(order => {
      const customerName = String(order.customer_name || '').trim();
      if (!customerName) return;
      if (!customerFirstOrders.has(customerName) || 
          new Date(order.created_at) < new Date(customerFirstOrders.get(customerName))) {
        customerFirstOrders.set(customerName, order.created_at);
      }
    });

    const newCustomers = Array.from(customerFirstOrders.values())
      .filter(date => new Date(date as string) >= today).length;

    const totalCustomers = customerFirstOrders.size;

    const averageTicket = todayOrdersCount > 0 ? todaySales / todayOrdersCount : 0;

    // Despesas do mês
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', user?.id)
      .gte('expense_date', firstDayOfMonth);

    const monthlyExpenses = (expenses || []).reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

    setStats({
      todaySales,
      todayOrders: todayOrdersCount,
      pendingOrders: pendingOrders?.length || 0,
      productsSold,
      newCustomers,
      totalCustomers,
      averageTicket,
      monthlyExpenses,
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
        .select('total, status, acceptance_status')
        .eq('user_id', user?.id)
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDay.toISOString());

      if (error) throw error;

      const safe = (dayOrders || []).filter((o: any) => {
        const status = String(o?.status || '');
        const acceptance = String(o?.acceptance_status || '');
        if (status === 'cancelled') return false;
        if (acceptance === 'awaiting_pix_payment') return false;
        return true;
      });
      const revenue = safe.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
      
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Painel Inicial</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Acompanhe vendas, pedidos e clientes em uma visão rápida para tomar decisões com mais agilidade.
        </p>
      </div>

      <div className="grid gap-3 md:hidden">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => navigate('/pedidos')} className="rounded-[26px] border border-[#FF6400]/12 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#FF6400]/10 p-2 text-[#FF6400]">
                <ClipboardList className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">Pedidos do dia</div>
            <div className="mt-1 text-xs text-slate-500">acompanhe novos e em preparo</div>
          </button>
          <button type="button" onClick={() => navigate('/produtos')} className="rounded-[26px] border border-[#8CC850]/20 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#8CC850]/15 p-2 text-[#003223]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">Cardápio</div>
            <div className="mt-1 text-xs text-slate-500">produtos, categorias e complementos</div>
          </button>
          <button type="button" onClick={() => navigate('/configuracoes?tab=whatsapp')} className="rounded-[26px] border border-[#003223]/10 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#003223]/8 p-2 text-[#003223]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">WhatsApp</div>
            <div className="mt-1 text-xs text-slate-500">conexão, QR code e automações</div>
          </button>
          <button type="button" onClick={() => navigate('/configuracoes')} className="rounded-[26px] border border-slate-200 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                <Settings className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">Mais ações</div>
            <div className="mt-1 text-xs text-slate-500">configurações e integrações</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard 
          title="Faturamento Hoje" 
          value={formatCurrency(stats.todaySales)} 
          description={`${stats.todayOrders} pedidos realizados`}
          icon={<CreditCard className="text-boracume-green" />}
          className="border-t-boracume-green"
          trend={getStatsTrend(stats.todaySales, 'sales')}
        />
        <StatsCard 
          title="Ticket Médio" 
          value={formatCurrency(stats.averageTicket)} 
          description="Por pedido hoje"
          icon={<TrendingUp className="text-boracume-orange" />}
          className="border-t-boracume-orange"
        />
        <StatsCard 
          title="Despesas Mês" 
          value={formatCurrency(stats.monthlyExpenses)} 
          description="Total de custos"
          icon={<DollarSign className="text-red-500" />}
          className="border-t-red-500"
        />
        <StatsCard 
          title="Novos Clientes" 
          value={stats.newCustomers.toString()} 
          description={`Total: ${stats.totalCustomers} clientes`}
          icon={<Users className="text-blue-500" />}
          className="border-t-blue-500"
          trend={getStatsTrend(stats.newCustomers, 'customers')}
        />
        <StatsCard 
          title="Produtos Vendidos" 
          value={stats.productsSold.toString()} 
          description="Unidades hoje"
          icon={<Package className="text-purple-500" />}
          className="border-t-purple-500"
        />
      </div>
      
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="w-full overflow-x-auto">
          <RevenueChart data={revenueData} />
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-orange-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Users className="h-4 w-4" />
            Resumo do dia
          </div>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Clientes novos</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{stats.newCustomers}</div>
              <div className="text-xs text-slate-500">base atual: {stats.totalCustomers} clientes</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Produtos vendidos</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{stats.productsSold}</div>
              <div className="text-xs text-slate-500">itens vendidos hoje</div>
            </div>
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Despesas do mês</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(stats.monthlyExpenses)}</div>
              <div className="text-xs text-slate-500">acompanhe custos e margem</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid gap-3 md:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Pedidos recentes</h2>
          <button type="button" className="text-sm font-semibold text-[#FF6400]" onClick={() => navigate('/pedidos')}>Ver tudo</button>
        </div>
        <div className="space-y-3">
          {recentOrders.slice(0, 4).map((order) => (
            <button key={order.id} type="button" onClick={() => navigate('/pedidos')} className="w-full rounded-[26px] border border-slate-200/80 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.99]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">#{order.id.slice(0, 8)}</div>
                  <div className="mt-1 text-sm text-slate-600">{order.customer_name || 'Cliente não informado'}</div>
                </div>
                <div className="rounded-full bg-[#F5EBE1] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#003223]">
                  {order.status}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="text-slate-500">{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="font-bold text-slate-900">{formatCurrency(order.total)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden w-full overflow-x-auto rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-sm md:block">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Pedidos Recentes</h2>
        <RecentOrdersTable orders={recentOrders} />
      </div>
    </div>
  );
};

export default Dashboard;
