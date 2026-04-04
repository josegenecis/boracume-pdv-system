

import React, { useState, useEffect, useCallback } from 'react';

import RecentOrdersTable from '@/components/dashboard/RecentOrdersTable';
import { Users, ClipboardList, ShoppingBag, Settings, MessageCircle, ChevronRight, Search, Sparkles, Activity, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

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

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const weeklyRevenueTotal = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const strongestRevenueDay = revenueData.reduce((best, item) => item.revenue > best.revenue ? item : best, revenueData[0] || { name: '—', revenue: 0 });
  const expenseRatio = stats.todaySales > 0 ? (stats.monthlyExpenses / Math.max(stats.todaySales, 1)) * 100 : 0;
  const operationalHealth = Math.max(18, Math.min(94, Math.round(
    52 +
    Math.min(stats.todayOrders * 2, 20) +
    Math.min(stats.newCustomers * 3, 10) -
    Math.min(stats.pendingOrders * 4, 24)
  )));
  const analyticsSeries = revenueData.map((item) => ({
    name: item.name,
    receita: item.revenue,
    meta: item.revenue * 1.15,
  }));
  const mixSeries = [
    { name: 'Faturamento', value: Math.max(stats.todaySales, 1), color: '#FF6400' },
    { name: 'Ticket', value: Math.max(stats.averageTicket * 6, 1), color: '#8CC850' },
    { name: 'Pendentes', value: Math.max(stats.pendingOrders * 45, 1), color: '#7C3AED' },
    { name: 'Despesas', value: Math.max(stats.monthlyExpenses, 1), color: '#0EA5E9' },
  ];
  const pulseSeries = [
    { label: 'Conversão', value: Math.min(96, 58 + stats.todayOrders) },
    { label: 'Retenção', value: Math.min(92, 46 + stats.newCustomers * 4) },
    { label: 'Agilidade', value: Math.max(24, 88 - stats.pendingOrders * 9) },
    { label: 'Margem', value: Math.max(16, 74 - Math.min(expenseRatio / 2, 40)) },
  ];
  const topOrderCards = recentOrders.slice(0, 4).map((order) => ({
    id: order.id,
    customer: order.customer_name || 'Cliente não informado',
    amount: order.total,
    status: order.status,
  }));

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
      <div className="rounded-[30px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] backdrop-blur dark:border-white/10 dark:bg-[#101a16]/92 dark:shadow-[0_26px_60px_-36px_rgba(0,0,0,0.8)] md:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-[#FF6400]/15 bg-[#FFF1E6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FF6400] dark:border-[#FF6400]/25 dark:bg-[#FF6400]/10">
              Resumo executivo
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Painel Inicial</h1>
            <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Acompanhe vendas, pedidos e clientes em uma visão rápida para tomar decisões com mais agilidade.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[520px]">
            <div className="rounded-2xl border border-[#8CC850]/20 bg-white px-4 py-3 dark:border-[#8CC850]/15 dark:bg-[#0c1512]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Pedidos</div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{stats.todayOrders}</div>
            </div>
            <div className="rounded-2xl border border-[#FF6400]/20 bg-white px-4 py-3 dark:border-[#FF6400]/15 dark:bg-[#0c1512]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Pendentes</div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{stats.pendingOrders}</div>
            </div>
            <div className="rounded-2xl border border-[#003223]/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#0c1512]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Clientes</div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{stats.totalCustomers}</div>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-white px-4 py-3 dark:border-violet-500/20 dark:bg-[#0c1512]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Produtos</div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{stats.productsSold}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:hidden">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => navigate('/pedidos')} className="rounded-[26px] border border-[#FF6400]/12 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-[#101a16]/95">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#FF6400]/10 p-2 text-[#FF6400]">
                <ClipboardList className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">Pedidos do dia</div>
            <div className="mt-1 text-xs text-slate-500">acompanhe novos e em preparo</div>
          </button>
          <button type="button" onClick={() => navigate('/produtos')} className="rounded-[26px] border border-[#8CC850]/20 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-[#101a16]/95">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#8CC850]/15 p-2 text-[#003223]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">Cardápio</div>
            <div className="mt-1 text-xs text-slate-500">produtos, categorias e complementos</div>
          </button>
          <button type="button" onClick={() => navigate('/configuracoes?tab=whatsapp')} className="rounded-[26px] border border-[#003223]/10 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-[#101a16]/95">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl bg-[#003223]/8 p-2 text-[#003223]">
                <MessageCircle className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">WhatsApp</div>
            <div className="mt-1 text-xs text-slate-500">conexão, QR code e automações</div>
          </button>
          <button type="button" onClick={() => navigate('/configuracoes')} className="rounded-[26px] border border-slate-200 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98] dark:border-white/10 dark:bg-[#101a16]/95">
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

      <div className="hidden gap-5 md:grid xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_28px_70px_-36px_rgba(0,50,35,0.32)] dark:border-white/10 dark:bg-[#101a16]/96 dark:shadow-[0_26px_60px_-36px_rgba(0,0,0,0.82)]">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6400]/15 bg-[#FFF1E6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FF6400] dark:border-[#FF6400]/25 dark:bg-[#FF6400]/10">
                    <Sparkles className="h-3.5 w-3.5" />
                    Central BoraCumê
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{greeting}, bora operar melhor hoje</h1>
                  <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                    Um painel mais analítico para decisões rápidas sobre vendas, clientes, ticket e saúde da operação.
                  </p>
                </div>
                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="flex items-center gap-3 rounded-2xl border border-[#003223]/8 bg-[#F8FAF8] px-4 py-2.5 dark:border-white/10 dark:bg-[#0c1512]">
                    <Search className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">Análise executiva em tempo real</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <Activity className="h-4 w-4 text-[#8CC850]" />
                    atualização ativa
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-4">
                <div className="rounded-[26px] border border-[#8CC850]/18 bg-gradient-to-br from-white to-[#F5FBED] p-4 dark:border-[#8CC850]/15 dark:from-[#0c1512] dark:to-[#112017]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Faturamento</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.todaySales)}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-[#0B5137] dark:text-[#8CC850]">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {stats.todayOrders} pedidos confirmados
                  </div>
                </div>
                <div className="rounded-[26px] border border-[#FF6400]/18 bg-gradient-to-br from-white to-[#FFF3EA] p-4 dark:border-[#FF6400]/15 dark:from-[#0c1512] dark:to-[#1e1510]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Ticket médio</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.averageTicket)}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">melhor dia: {strongestRevenueDay.name}</div>
                </div>
                <div className="rounded-[26px] border border-[#003223]/10 bg-gradient-to-br from-white to-[#F5F8F7] p-4 dark:border-white/10 dark:from-[#0c1512] dark:to-[#141b18]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Clientes ativos</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{stats.totalCustomers}</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">+{stats.newCustomers} novos hoje</div>
                </div>
                <div className="rounded-[26px] border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-4 dark:border-violet-500/20 dark:from-[#0c1512] dark:to-[#171325]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Saúde operacional</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{operationalHealth}%</div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stats.pendingOrders} pedidos aguardando ação</div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                <div className="rounded-[28px] border border-[#003223]/8 bg-[#F8FAF8] p-4 dark:border-white/10 dark:bg-[#0c1512]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Receita da semana</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(weeklyRevenueTotal)} acumulados nos últimos dias</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#003223] dark:bg-[#101a16] dark:text-slate-300">
                      pico em {strongestRevenueDay.name}
                    </div>
                  </div>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsSeries}>
                        <defs>
                          <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8CC850" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#8CC850" stopOpacity={0.03} />
                          </linearGradient>
                          <linearGradient id="dashboardGoal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF6400" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#FF6400" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7e1dc" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} width={46} />
                        <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                        <Area type="monotone" dataKey="meta" stroke="#FF6400" fill="url(#dashboardGoal)" strokeWidth={2} />
                        <Area type="monotone" dataKey="receita" stroke="#8CC850" fill="url(#dashboardRevenue)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[28px] border border-[#003223]/8 bg-[#F8FAF8] p-4 dark:border-white/10 dark:bg-[#0c1512]">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Composição operacional</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Distribuição entre vendas, ticket, pendências e despesas</div>
                    <div className="mt-4 h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={mixSeries} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={3}>
                            {mixSeries.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid gap-2">
                      {mixSeries.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[#003223]/8 bg-[#F8FAF8] p-4 dark:border-white/10 dark:bg-[#0c1512]">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Pulso da operação</div>
                    <div className="mt-4 space-y-3">
                      {pulseSeries.map((item, index) => (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{item.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/10">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${item.value}%`,
                                background: ['#8CC850', '#FF6400', '#7C3AED', '#0EA5E9'][index % 4],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Pedidos em destaque</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Últimos tickets relevantes do dia</div>
                </div>
              </div>
              <div className="space-y-3">
                {topOrderCards.length > 0 ? topOrderCards.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => navigate('/pedidos')}
                    className="w-full rounded-[22px] border border-[#003223]/8 bg-[#F8FAF8] p-4 text-left transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-[#0c1512]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{order.customer}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">#{order.id.slice(0, 8)}</div>
                      </div>
                      <div className="rounded-full bg-[#FFF1E6] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#003223] dark:bg-[#1b1510] dark:text-slate-300">
                        {order.status}
                      </div>
                    </div>
                    <div className="mt-4 text-lg font-bold text-[#0B5137] dark:text-[#8CC850]">{formatCurrency(order.amount)}</div>
                  </button>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-[#003223]/12 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    Ainda não há pedidos recentes para destacar.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Cadência semanal</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Leitura compacta da força comercial nos últimos dias</div>
                </div>
                <div className="rounded-full bg-[#F5EBE1] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#003223] dark:bg-[#1b1510] dark:text-slate-300">
                  BoraCumê Analytics
                </div>
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7e1dc" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={44} />
                    <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                    <Bar dataKey="receita" radius={[10, 10, 0, 0]} fill="#7C3AED" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Resumo rápido</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[22px] bg-[#F8FAF8] p-4 dark:bg-[#0c1512]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Novos clientes</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.newCustomers}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">base atual: {stats.totalCustomers}</div>
              </div>
              <div className="rounded-[22px] bg-[#F8FAF8] p-4 dark:bg-[#0c1512]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Produtos vendidos</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stats.productsSold}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">itens liberados hoje</div>
              </div>
              <div className="rounded-[22px] bg-[#F8FAF8] p-4 dark:bg-[#0c1512]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Despesas do mês</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.monthlyExpenses)}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{expenseRatio.toFixed(1).replace('.', ',')}% sobre o faturamento do dia</div>
              </div>
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
            <button key={order.id} type="button" onClick={() => navigate('/pedidos')} className="w-full rounded-[26px] border border-slate-200/80 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.99] dark:border-white/10 dark:bg-[#101a16]/95">
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

      <div className="hidden w-full overflow-x-auto rounded-[30px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95 md:block">
        <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Pedidos Recentes</h2>
        <RecentOrdersTable orders={recentOrders} />
      </div>
    </div>
  );
};

export default Dashboard;
