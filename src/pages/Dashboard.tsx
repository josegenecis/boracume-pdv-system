

import React, { useState, useEffect, useCallback } from 'react';

import RecentOrdersTable from '@/components/dashboard/RecentOrdersTable';
import OperationalChecklistDialog from '@/components/dashboard/OperationalChecklistDialog';
import { Users, ClipboardList, ShoppingBag, Settings, MessageCircle, ChevronRight, Search, Activity, ArrowUpRight, CreditCard, Wallet, ChefHat, AlertTriangle, CalendarClock, UserCheck, UserX, ClipboardCheck } from 'lucide-react';
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

interface LowStockProduct {
  id: string;
  name: string;
  category?: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
}

interface DormantCustomer {
  key: string;
  name: string;
  phone?: string | null;
  lastOrderAt: string;
  daysWithoutOrder: number;
}

interface DueExpense {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  category?: string | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  pendingReview: number;
}

interface ChecklistSummary {
  enabled: boolean;
  completed: boolean;
  completedCount: number;
  totalTasks: number;
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
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [dormantCustomers, setDormantCustomers] = useState<DormantCustomer[]>([]);
  const [dueExpenses, setDueExpenses] = useState<DueExpense[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>({
    total: 0,
    present: 0,
    absent: 0,
    pendingReview: 0,
  });
  const [checklistSummary, setChecklistSummary] = useState<ChecklistSummary>({
    enabled: false,
    completed: false,
    completedCount: 0,
    totalTasks: 0,
  });
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchChecklistSummary = useCallback(async () => {
    if (!user?.id) return;

    const businessDate = new Date().toISOString().slice(0, 10);
    const [settingsResult, tasksResult, runResult] = await Promise.allSettled([
      (supabase as any)
        .from('restaurant_checklist_settings')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
      (supabase as any)
        .from('restaurant_checklist_tasks')
        .select('id')
        .eq('user_id', user.id)
        .eq('active', true),
      (supabase as any)
        .from('restaurant_checklist_runs')
        .select('status, checked_task_ids')
        .eq('user_id', user.id)
        .eq('business_date', businessDate)
        .maybeSingle(),
    ]);

    const settings = settingsResult.status === 'fulfilled' && !settingsResult.value.error ? settingsResult.value.data : null;
    const tasks = tasksResult.status === 'fulfilled' && !tasksResult.value.error ? (tasksResult.value.data || []) : [];
    const run = runResult.status === 'fulfilled' && !runResult.value.error ? runResult.value.data : null;
    const checkedIds = Array.isArray(run?.checked_task_ids) ? run.checked_task_ids : [];

    setChecklistSummary({
      enabled: Boolean(settings?.enabled),
      completed: run?.status === 'completed',
      completedCount: checkedIds.length,
      totalTasks: tasks.length || 6,
    });
  }, [user?.id]);

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
        fetchRecentOrders(),
        fetchOperationalInsights(),
        fetchChecklistSummary()
      ]);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout no carregamento dos dados do dashboard')), 10000)
      );
      
      await Promise.race([dataPromise, timeoutPromise]);
      console.log('✅ [DASHBOARD] Dados carregados com sucesso');
    } catch (error) {
      console.error('❌ [DASHBOARD] Erro ao carregar dados do dashboard:', error);
      console.error('❌ [DASHBOARD] Stack trace:', (error as any)?.stack);
    } finally {
      console.log('🔍 [DASHBOARD] Finalizando loading...');
      setLoading(false);
    }
  }, [user, fetchChecklistSummary]);


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

  const fetchOperationalInsights = async () => {
    if (!user?.id) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inFiveDays = new Date(today);
    inFiveDays.setDate(inFiveDays.getDate() + 5);
    inFiveDays.setHours(23, 59, 59, 999);
    const dormantSince = new Date(today);
    dormantSince.setDate(dormantSince.getDate() - 120);

    const [productsResult, ordersResult, expensesResult, waitersResult, timeClockResult] = await Promise.allSettled([
      supabase
        .from('products')
        .select('id, name, category, track_stock, stock_quantity, low_stock_threshold, available, is_available')
        .eq('user_id', user.id)
        .eq('track_stock', true)
        .limit(300),
      supabase
        .from('orders')
        .select('customer_name, customer_phone, created_at, status, acceptance_status')
        .eq('user_id', user.id)
        .gte('created_at', dormantSince.toISOString())
        .order('created_at', { ascending: false })
        .limit(1200),
      (supabase as any)
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .limit(500),
      (supabase as any)
        .from('waiters')
        .select('id, name, active')
        .eq('user_id', user.id)
        .eq('active', true),
      (supabase as any)
        .from('employee_time_clock_events')
        .select('waiter_id, event_type, status, occurred_at')
        .eq('user_id', user.id)
        .gte('occurred_at', today.toISOString())
        .order('occurred_at', { ascending: false })
        .limit(500),
    ]);

    if (productsResult.status === 'fulfilled' && !productsResult.value.error) {
      const products = (productsResult.value.data || []) as any[];
      setLowStockProducts(products
        .filter((product) => product.available !== false && product.is_available !== false)
        .map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          stock_quantity: Number(product.stock_quantity || 0),
          low_stock_threshold: Number(product.low_stock_threshold || 0),
        }))
        .filter((product) => product.stock_quantity <= product.low_stock_threshold)
        .sort((a, b) => a.stock_quantity - b.stock_quantity)
        .slice(0, 5));
    }

    if (ordersResult.status === 'fulfilled' && !ordersResult.value.error) {
      const customers = new Map<string, DormantCustomer>();
      const now = Date.now();
      ((ordersResult.value.data || []) as any[]).forEach((order) => {
        if (String(order.status || '') === 'cancelled') return;
        if (String(order.acceptance_status || '') === 'awaiting_pix_payment') return;
        const phone = String(order.customer_phone || '').replace(/\D/g, '');
        const name = String(order.customer_name || '').trim();
        const key = phone || name.toLowerCase();
        if (!key) return;
        const createdAt = String(order.created_at || '');
        const daysWithoutOrder = Math.floor((now - new Date(createdAt).getTime()) / 86400000);
        if (daysWithoutOrder < 30) return;
        if (!customers.has(key)) {
          customers.set(key, {
            key,
            name: name || 'Cliente sem nome',
            phone: phone || null,
            lastOrderAt: createdAt,
            daysWithoutOrder,
          });
        }
      });
      setDormantCustomers(Array.from(customers.values()).sort((a, b) => b.daysWithoutOrder - a.daysWithoutOrder).slice(0, 5));
    }

    if (expensesResult.status === 'fulfilled' && !expensesResult.value.error) {
      const expenses = ((expensesResult.value.data || []) as any[])
        .map((expense) => {
          const dueDate = String(expense.due_date || expense.expense_date || expense.date || '').slice(0, 10);
          return {
            id: expense.id,
            description: String(expense.description || 'Conta sem descrição'),
            amount: Number(expense.amount || 0),
            dueDate,
            category: expense.category || null,
            paid: Boolean(expense.paid_at || expense.paid || expense.status === 'paid'),
          };
        })
        .filter((expense) => {
          if (!expense.dueDate || expense.paid) return false;
          const due = new Date(`${expense.dueDate}T12:00:00`);
          return due >= today && due <= inFiveDays;
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5);
      setDueExpenses(expenses);
    }

    const waiters = waitersResult.status === 'fulfilled' && !waitersResult.value.error ? ((waitersResult.value.data || []) as any[]) : [];
    const events = timeClockResult.status === 'fulfilled' && !timeClockResult.value.error ? ((timeClockResult.value.data || []) as any[]) : [];
    const presentIds = new Set(events.filter((event) => event.event_type === 'clock_in' && event.status !== 'rejected').map((event) => event.waiter_id));
    const pendingReview = events.filter((event) => event.status === 'pending_review').length;
    setAttendanceSummary({
      total: waiters.length,
      present: presentIds.size,
      absent: Math.max(0, waiters.length - presentIds.size),
      pendingReview,
    });
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
  const dueTotal = dueExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const checklistNeedsAction = checklistSummary.enabled && !checklistSummary.completed;
  const operationalCards: Array<{
    title: string;
    value: string | number;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
    to: string;
    onClick?: () => void;
  }> = [
    {
      title: 'Estoque baixo',
      value: lowStockProducts.length,
      hint: lowStockProducts.length > 0 ? `${lowStockProducts[0].name} precisa de reposição` : 'Tudo dentro do mínimo',
      icon: AlertTriangle,
      tone: 'border-red-200 bg-red-50 text-red-700',
      to: '/produtos',
    },
    {
      title: 'Checklist do turno',
      value: checklistSummary.enabled
        ? checklistSummary.completed
          ? 'Concluído'
          : `${checklistSummary.completedCount}/${checklistSummary.totalTasks}`
        : 'Inativo',
      hint: checklistSummary.enabled
        ? checklistSummary.completed
          ? 'Conferência do dia registrada'
          : 'Concluir antes de liberar o turno'
        : 'Ative para exigir conferência diária',
      icon: ClipboardCheck,
      tone: checklistNeedsAction ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      to: '/dashboard',
      onClick: () => setChecklistOpen(true),
    },
    {
      title: 'Contas a vencer',
      value: formatCurrency(dueTotal),
      hint: `${dueExpenses.length} conta(s) até os próximos 5 dias`,
      icon: CalendarClock,
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
      to: '/financeiro',
    },
    {
      title: 'Ponto de hoje',
      value: `${attendanceSummary.present}/${attendanceSummary.total}`,
      hint: attendanceSummary.absent > 0 ? `${attendanceSummary.absent} sem ponto registrado` : 'Equipe registrada hoje',
      icon: attendanceSummary.absent > 0 ? UserX : UserCheck,
      tone: attendanceSummary.absent > 0 ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
      to: '/controle-ponto',
    },
  ];

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
      <div className="hidden">
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

      <div className="hidden">
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

      <div className="space-y-4 md:hidden">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_50px_-36px_rgba(0,50,35,0.28)]">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Painel Inicial</h1>
              <p className="mt-1 text-sm text-slate-500">
                O PopSystem mobile agora prioriza as ações do dia: aceitar pedido, vender rápido e cuidar do caixa.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[#FF6400]/12 bg-[#FFF8F2] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pedidos</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{stats.todayOrders}</div>
              </div>
              <div className="rounded-2xl border border-[#8CC850]/20 bg-[#F5FBED] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pendentes</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{stats.pendingOrders}</div>
              </div>
              <div className="rounded-2xl border border-[#003223]/10 bg-[#F6F8F7] px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ticket</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(stats.averageTicket)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {[
            { label: 'Gestor de pedidos', hint: 'aceitar e acompanhar fila', icon: ClipboardList, to: '/pedidos', accent: 'bg-[#FFF1E6] text-[#FF6400]' },
            { label: 'PDV mobile', hint: 'lançar venda com menos toques', icon: CreditCard, to: '/pdv', accent: 'bg-[#003223]/8 text-[#003223]' },
            { label: 'Caixa geral', hint: 'abertura, sangria e conferência', icon: Wallet, to: '/caixa', accent: 'bg-[#F5FBED] text-[#245B2B]' },
            { label: 'Cozinha', hint: 'acompanhar produção', icon: ChefHat, to: '/cozinha', accent: 'bg-[#FFF6E8] text-[#C46A00]' },
            { label: 'Cardápio', hint: 'produtos e complementos', icon: ShoppingBag, to: '/produtos', accent: 'bg-[#F2F7EF] text-[#245B2B]' },
            { label: 'WhatsApp', hint: 'atendimento e automações', icon: MessageCircle, to: '/configuracoes?tab=whatsapp', accent: 'bg-[#EEF4FF] text-[#0B4D8A]' },
          ].map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.to}
                type="button"
                onClick={() => navigate(action.to)}
                className="rounded-[24px] border border-slate-200/80 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className={`rounded-2xl p-2 ${action.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-900">{action.label}</div>
                <div className="mt-1 text-xs text-slate-500">{action.hint}</div>
              </button>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Fila operacional</div>
              <div className="text-xs text-slate-500">Visão rápida para agir no celular.</div>
            </div>
            <button type="button" className="text-sm font-semibold text-[#FF6400]" onClick={() => navigate('/pedidos')}>
              Abrir pedidos
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#FF6400]/12 bg-[#FFF8F2] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Novos</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{stats.pendingOrders}</div>
            </div>
            <div className="rounded-2xl border border-[#8CC850]/20 bg-[#F5FBED] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Receita hoje</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(stats.todaySales)}</div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {operationalCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => card.onClick ? card.onClick() : navigate(card.to)}
                className="rounded-[24px] border border-slate-200/80 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className={`rounded-2xl border p-2 ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.title}</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{card.value}</div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-500">{card.hint}</div>
              </button>
            );
          })}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Pedidos recentes</h2>
            <button type="button" className="text-sm font-semibold text-[#FF6400]" onClick={() => navigate('/pedidos')}>
              Ver tudo
            </button>
          </div>
          <div className="space-y-3">
            {recentOrders.slice(0, 4).map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => navigate('/pedidos')}
                className="w-full rounded-[24px] border border-slate-200/80 bg-white/95 p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
              >
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
        </section>
      </div>

      <div className="hidden gap-5 md:grid">
        <div className="space-y-5">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_28px_70px_-36px_rgba(0,50,35,0.32)] dark:border-white/10 dark:bg-[#101a16]/96 dark:shadow-[0_26px_60px_-36px_rgba(0,0,0,0.82)]">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Painel Inicial</h1>
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

              <div className="grid gap-4 xl:grid-cols-4">
                {operationalCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => card.onClick ? card.onClick() : navigate(card.to)}
                      className="rounded-[24px] border border-[#003223]/8 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-30px_rgba(0,50,35,0.35)] dark:border-white/10 dark:bg-[#0c1512]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`rounded-2xl border p-2 ${card.tone}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{card.title}</div>
                      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{card.value}</div>
                      <div className="mt-2 min-h-[34px] text-xs text-slate-500 dark:text-slate-400">{card.hint}</div>
                    </button>
                  );
                })}
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
                  PopSystem Analytics
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

      </div>
      
      <div className="hidden">
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

      <OperationalChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        onUpdated={fetchChecklistSummary}
      />
    </div>
  );
};

export default Dashboard;
