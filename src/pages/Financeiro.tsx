import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  DollarSign, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Filter,
  Percent,
  Lock,
  Unlock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PrinterService } from '@/utils/printerService';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PaymentMethod = 'pix' | 'dinheiro' | 'cartao';
type PaymentMethodFilter = '' | 'all' | PaymentMethod;
type TxTypeFilter = '' | 'all' | 'entrada' | 'saida';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
  category: string;
  paymentMethod?: PaymentMethod;
}

interface CashSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  initial_amount: number;
  final_amount: number | null;
  status: 'open' | 'closed';
}

const Financeiro = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ordersRaw, setOrdersRaw] = useState<any[]>([]);
  const [expensesRaw, setExpensesRaw] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [sessionOrders, setSessionOrders] = useState<any[]>([]);
  const [sessionMovements, setSessionMovements] = useState<any[]>([]);
  const [loadingSessionDetails, setLoadingSessionDetails] = useState(false);
  
  // States for new expense
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Geral' });
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  // States for Cash Register
  const [cashAmount, setCashAmount] = useState('');
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [cashOperation, setCashOperation] = useState<'open' | 'close' | 'in' | 'out'>('open');
  const [cashDescription, setCashDescription] = useState('');

  const [filters, setFilters] = useState({
    paymentMethod: '' as PaymentMethodFilter,
    type: '' as TxTypeFilter,
    startDate: null as Date | null,
    endDate: null as Date | null,
    searchTerm: ''
  });
  
  // Fetch transactions and session
  useEffect(() => {
    if (user) {
      fetchData();
      checkOpenSession();
      fetchCashSessions();
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && selectedSessionId) {
      fetchSessionDetails(selectedSessionId);
    }
  }, [user?.id, selectedSessionId]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch Orders (Income)
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id);

      const ordersList = (orders as any[]) || [];
      setOrdersRaw(ordersList);
      
      const incomeTx = ordersList
        .filter((order) => String((order as any)?.status || '') !== 'cancelled')
        .map(order => ({
        id: order.id,
        date: new Date(order.created_at),
        description: `Pedido #${order.id.substring(0, 8)}`,
        amount: order.total,
        type: 'entrada' as 'entrada',
        category: 'Vendas',
        paymentMethod: order.payment_method as PaymentMethod
      }));

      // 2. Fetch Expenses (Outcome)
      const { data: expenses } = await (supabase as any)
        .from('expenses')
        .select('*')
        .eq('user_id', user.id);

      const expensesList = (expenses as any[]) || [];
      setExpensesRaw(expensesList);

      const expenseTx = expensesList.map(exp => ({
        id: exp.id,
        date: new Date(exp.expense_date || exp.date || exp.created_at),
        description: exp.description,
        amount: exp.amount,
        type: 'saida' as 'saida',
        category: exp.category || 'Geral',
        paymentMethod: 'dinheiro' as PaymentMethod // Assuming expenses are paid in cash for simplicity or add field later
      }));

      const all = [...incomeTx, ...expenseTx].sort((a, b) => b.date.getTime() - a.date.getTime());
      setTransactions(all);
      setFilteredTransactions(all);

    } catch (error: any) {
      console.error(error);
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const checkOpenSession = async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('cash_register_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking open session:', error);
        return;
      }
      
      setCurrentSession(data);
      if (data?.id) setSelectedSessionId(data.id);
    } catch (err) {
      console.error('Unexpected error checking session:', err);
    }
  };

  const fetchCashSessions = async () => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any)
        .from('cash_register_sessions')
        .select('id, opened_at, closed_at, initial_amount, final_amount, status')
        .eq('user_id', user.id)
        .order('opened_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setCashSessions((data as any) || []);
    } catch (e: any) {
      console.error(e);
      setCashSessions([]);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    if (!user?.id) return;
    if (!sessionId) {
      setSessionOrders([]);
      setSessionMovements([]);
      return;
    }
    try {
      setLoadingSessionDetails(true);
      const movementsReq = (supabase as any)
        .from('cash_movements')
        .select('id, created_at, type, amount, description')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      const ordersReq = (supabase as any)
        .from('orders')
        .select('id, order_number, created_at, total, payment_method, status')
        .eq('user_id', user.id)
        .eq('cash_register_session_id', sessionId)
        .order('created_at', { ascending: false });

      const [{ data: orders, error: ordersError }, { data: movements, error: movementsError }] = await Promise.all([
        ordersReq,
        movementsReq,
      ]);

      if (movementsError) throw movementsError;
      setSessionMovements((movements as any) || []);

      if (ordersError && String(ordersError.message || '').includes('cash_register_session_id')) {
        setSessionOrders([]);
      } else if (ordersError) {
        throw ordersError;
      } else {
        setSessionOrders((orders as any) || []);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e?.message || 'Erro ao carregar sessão', variant: 'destructive' });
      setSessionOrders([]);
      setSessionMovements([]);
    } finally {
      setLoadingSessionDetails(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    try {
      const { error } = await (supabase as any).from('expenses').insert({
        user_id: user?.id,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
        date: new Date().toISOString()
      });
      if (error) throw error;
      
      toast({ title: 'Despesa registrada' });
      setIsExpenseDialogOpen(false);
      setNewExpense({ description: '', amount: '', category: 'Geral' });
      fetchData();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleCashOperation = async () => {
    if (!user) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount)) return;

    try {
      if (cashOperation === 'open') {
        if (currentSession?.id) {
          toast({ title: 'Caixa já está aberto' });
          setIsCashDialogOpen(false);
          return;
        }
        const { error } = await (supabase as any).from('cash_register_sessions').insert({
          user_id: user.id,
          initial_amount: amount,
          status: 'open',
          opened_at: new Date().toISOString()
        });
        if (error && (error.code === '23505' || String(error.message || '').toLowerCase().includes('cash_register_sessions_one_open_per_user'))) {
          await checkOpenSession();
          toast({ title: 'Caixa já está aberto' });
          setIsCashDialogOpen(false);
          return;
        }
        if (error) throw error;
        toast({ title: 'Caixa aberto com sucesso' });
        await PrinterService.printCashReport({
          title: 'Abertura de Caixa',
          lines: [`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, `Valor inicial: R$ ${Number(amount).toFixed(2)}`]
        });
      } else if (cashOperation === 'close') {
        if (!currentSession) return;
        const { error } = await (supabase as any).from('cash_register_sessions').update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          final_amount: amount,
          notes: cashDescription
        }).eq('id', currentSession.id);
        if (error) throw error;
        toast({ title: 'Caixa fechado com sucesso' });
        await PrinterService.printCashReport({
          title: 'Fechamento de Caixa',
          lines: [
            `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
            `Valor final: R$ ${Number(amount).toFixed(2)}`,
            cashDescription ? `Obs: ${cashDescription}` : ''
          ].filter(Boolean) as string[]
        });
      } else {
        // Suprimento ou Sangria
        if (!currentSession) {
          toast({ title: 'Caixa fechado', description: 'Abra o caixa primeiro', variant: 'destructive' });
          return;
        }
        const { error } = await (supabase as any).from('cash_movements').insert({
          session_id: currentSession.id,
          user_id: user.id,
          type: cashOperation,
          amount: amount,
          description: cashDescription
        });
        if (error) throw error;
        toast({ title: cashOperation === 'in' ? 'Suprimento registrado' : 'Sangria registrada' });
        await PrinterService.printCashReport({
          title: cashOperation === 'in' ? 'Suprimento' : 'Sangria',
          lines: [
            `Data/Hora: ${new Date().toLocaleString('pt-BR')}`,
            `Valor: R$ ${Number(amount).toFixed(2)}`,
            cashDescription ? `Descrição: ${cashDescription}` : ''
          ].filter(Boolean) as string[]
        });
      }
      
      setIsCashDialogOpen(false);
      setCashAmount('');
      setCashDescription('');
      checkOpenSession();
      fetchCashSessions();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };
  
  // Calculate financial summaries
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'entrada')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
    
  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'saida')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
    
  const balance = totalIncome - totalExpenses;
  
  // Payment method breakdown
  const pixTotal = filteredTransactions
    .filter(t => t.paymentMethod === 'pix' && t.type === 'entrada')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
    
  const cardTotal = filteredTransactions
    .filter(t => t.paymentMethod === 'cartao' && t.type === 'entrada')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
    
  const cashTotal = filteredTransactions
    .filter(t => t.paymentMethod === 'dinheiro' && t.type === 'entrada')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  
  // Apply filters
  const applyFilters = () => {
    let result = [...transactions];
    
    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      result = result.filter(t => t.paymentMethod === filters.paymentMethod);
    }
    
    if (filters.type && filters.type !== 'all') {
      result = result.filter(t => t.type === filters.type);
    }
    
    if (filters.startDate) {
      result = result.filter(t => t.date >= filters.startDate!);
    }
    
    if (filters.endDate) {
      result = result.filter(t => t.date <= filters.endDate!);
    }
    
    if (filters.searchTerm) {
      result = result.filter(t => 
        t.description.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }
    
    setFilteredTransactions(result);
  };
  
  const generateCSV = () => {
    const rows = [
      ['Data', 'Hora', 'Descrição', 'Categoria', 'Método', 'Valor', 'Tipo'],
      ...filteredTransactions.map(t => [
        formatDate(t.date),
        formatTime(t.date),
        t.description,
        t.category,
        getPaymentMethodLabel(t.paymentMethod),
        String(t.amount).replace('.', ','),
        t.type
      ])
    ];
    const csvContent = rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const start = filters.startDate ? formatDate(filters.startDate) : 'inicio';
    const end = filters.endDate ? formatDate(filters.endDate) : 'fim';
    a.download = `relatorio_${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const resetFilters = () => {
    setFilters({
      paymentMethod: '',
      type: '',
      startDate: null,
      endDate: null,
      searchTerm: ''
    });
    setFilteredTransactions(transactions);
  };
  
  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters({
      ...filters,
      [field]: value
    });
  };
  
  useEffect(() => {
    applyFilters();
  }, [filters.startDate, filters.endDate]);
  
  const formatDate = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '-';
    try {
      return new Intl.DateTimeFormat('pt-BR').format(date);
    } catch (e) {
      return '-';
    }
  };
  
  const formatTime = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '-';
    try {
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (e) {
      return '-';
    }
  };
  
  const formatCurrency = (amount: number) => {
    if (amount === undefined || amount === null || isNaN(amount)) return 'R$ 0,00';
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(amount);
    } catch (e) {
      return 'R$ 0,00';
    }
  };

  const reportStart = filters.startDate ? new Date(filters.startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  reportStart.setHours(0, 0, 0, 0);
  const reportEnd = filters.endDate ? new Date(filters.endDate) : new Date();
  reportEnd.setHours(23, 59, 59, 999);

  const enumerateDays = (from: Date, to: Date) => {
    const out: Date[] = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  };

  const dateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dailySeries = (() => {
    const days = enumerateDays(reportStart, reportEnd);
    const map: Record<string, { income: number; expenses: number }> = {};
    for (const t of filteredTransactions) {
      if (!t?.date) continue;
      if (t.date < reportStart || t.date > reportEnd) continue;
      const k = dateKey(t.date);
      if (!map[k]) map[k] = { income: 0, expenses: 0 };
      if (t.type === 'entrada') map[k].income += Number(t.amount || 0);
      if (t.type === 'saida') map[k].expenses += Number(t.amount || 0);
    }
    return days.map((d) => {
      const k = dateKey(d);
      const v = map[k] || { income: 0, expenses: 0 };
      const profit = v.income - v.expenses;
      const label = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
      return { date: k, label, income: Number(v.income.toFixed(2)), expenses: Number(v.expenses.toFixed(2)), profit: Number(profit.toFixed(2)) };
    });
  })();

  const expenseByCategory = (() => {
    const map: Record<string, number> = {};
    for (const t of filteredTransactions) {
      if (t.type !== 'saida') continue;
      if (t.date < reportStart || t.date > reportEnd) continue;
      const key = String(t.category || 'Geral');
      map[key] = (map[key] || 0) + Number(t.amount || 0);
    }
    const rows = Object.entries(map).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
    rows.sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 6);
    const rest = rows.slice(6);
    const restSum = rest.reduce((acc, r) => acc + r.value, 0);
    return restSum > 0 ? [...top, { name: 'Outros', value: Number(restSum.toFixed(2)) }] : top;
  })();

  const COLORS = ['#7c3aed', '#22c55e', '#ef4444', '#0ea5e9', '#f59e0b', '#64748b', '#a855f7'];

  const dre = (() => {
    const ordersInRange = (ordersRaw || []).filter((o: any) => {
      const created = new Date(o?.created_at);
      if (created < reportStart || created > reportEnd) return false;
      if (String(o?.status || '') === 'cancelled') return false;
      return true;
    });
    const receitaLiquida = ordersInRange.reduce((acc: number, o: any) => acc + Number(o?.total || 0), 0);
    const descontos = ordersInRange.reduce((acc: number, o: any) => acc + Number(o?.discount || 0), 0);
    const receitaBruta = receitaLiquida + descontos;
    const taxaEntrega = ordersInRange.reduce((acc: number, o: any) => acc + Number(o?.delivery_fee || 0), 0);
    const receitaProdutos = Math.max(0, receitaLiquida - taxaEntrega);

    const despesas = (expensesRaw || []).filter((e: any) => {
      const d = new Date(e?.expense_date || e?.date || e?.created_at);
      return d >= reportStart && d <= reportEnd;
    }).reduce((acc: number, e: any) => acc + Number(e?.amount || 0), 0);
    const lucroOperacional = receitaLiquida - despesas;
    return {
      receitaBruta: Number(receitaBruta.toFixed(2)),
      descontos: Number(descontos.toFixed(2)),
      receitaLiquida: Number(receitaLiquida.toFixed(2)),
      receitaProdutos: Number(receitaProdutos.toFixed(2)),
      taxaEntrega: Number(taxaEntrega.toFixed(2)),
      despesas: Number(despesas.toFixed(2)),
      lucroOperacional: Number(lucroOperacional.toFixed(2)),
    };
  })();

  const margemOperacional = dre.receitaLiquida > 0 ? (dre.lucroOperacional / dre.receitaLiquida) * 100 : 0;
  
  const getPaymentMethodLabel = (method?: PaymentMethod) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'dinheiro': return 'DINHEIRO';
      case 'cartao': return 'CARTÃO';
      default: return method || '-';
    }
  };

  const selectedSession = cashSessions.find(s => s.id === selectedSessionId) || currentSession || null;
  const sessionSales = sessionOrders.filter(o => o?.status !== 'cancelled');
  const sessionTotal = sessionSales.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const sessionPix = sessionSales.filter(o => o.payment_method === 'pix').reduce((sum, o) => sum + Number(o.total || 0), 0);
  const sessionCard = sessionSales.filter(o => o.payment_method === 'cartao').reduce((sum, o) => sum + Number(o.total || 0), 0);
  const sessionCash = sessionSales.filter(o => o.payment_method === 'dinheiro').reduce((sum, o) => sum + Number(o.total || 0), 0);
  const sessionIn = sessionMovements.filter(m => m.type === 'in').reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const sessionOut = sessionMovements.filter(m => m.type === 'out').reduce((sum, m) => sum + Number(m.amount || 0), 0);
  
  return (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 text-white">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-bold tracking-tight">Financeiro</div>
              <div className="text-white/90 text-sm">
                Acompanhe receitas, despesas, lucro e DRE no período selecionado
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
           <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white/15 hover:bg-white/25 text-white border border-white/20" variant="outline" onClick={() => {
                setCashOperation(currentSession ? 'close' : 'open');
                setCashAmount('');
              }}>
                {currentSession ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                {currentSession ? 'Gerenciar Caixa' : 'Abrir Caixa'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {cashOperation === 'open' && 'Abertura de Caixa'}
                  {cashOperation === 'close' && 'Fechamento de Caixa'}
                  {cashOperation === 'in' && 'Suprimento (Entrada)'}
                  {cashOperation === 'out' && 'Sangria (Saída)'}
                </DialogTitle>
                <DialogDescription>
                  {currentSession && (
                    <div className="flex gap-2 mb-4">
                      <Button variant={cashOperation === 'close' ? 'default' : 'outline'} size="sm" onClick={() => setCashOperation('close')}>Fechar</Button>
                      <Button variant={cashOperation === 'in' ? 'default' : 'outline'} size="sm" onClick={() => setCashOperation('in')}>Suprimento</Button>
                      <Button variant={cashOperation === 'out' ? 'default' : 'outline'} size="sm" onClick={() => setCashOperation('out')}>Sangria</Button>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Valor</Label>
                  <Input 
                    type="number" 
                    value={cashAmount} 
                    onChange={(e) => setCashAmount(e.target.value)} 
                    placeholder="0.00"
                  />
                </div>
                {cashOperation !== 'open' && (
                   <div>
                   <Label>Observação / Descrição</Label>
                   <Input 
                     value={cashDescription} 
                     onChange={(e) => setCashDescription(e.target.value)} 
                     placeholder="Motivo..."
                   />
                 </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleCashOperation}>Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white">
                <ArrowDown className="mr-2 h-4 w-4" />
                Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Despesa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Descrição</Label>
                  <Input value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})} />
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={newExpense.category} onValueChange={(v) => setNewExpense({...newExpense, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Geral">Geral</SelectItem>
                      <SelectItem value="Insumos">Insumos/Compras</SelectItem>
                      <SelectItem value="Aluguel">Aluguel</SelectItem>
                      <SelectItem value="Funcionários">Funcionários</SelectItem>
                      <SelectItem value="Manutenção">Manutenção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddExpense}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-green-500" />
              Receitas
            </CardTitle>
            <CardDescription>Total de vendas e entradas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-rose-500 bg-rose-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-red-500" />
              Despesas
            </CardTitle>
            <CardDescription>Total de custos e saídas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-violet-600 bg-violet-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-boracume-green" />
              Saldo
            </CardTitle>
            <CardDescription>Balanço atual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-md flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              PIX
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(pixTotal)}</div>
            <div className="text-sm text-muted-foreground">
              {totalIncome ? Math.round((pixTotal / totalIncome) * 100) : 0}% das receitas
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-md flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              CARTÃO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(cardTotal)}</div>
            <div className="text-sm text-muted-foreground">
              {totalIncome ? Math.round((cardTotal / totalIncome) * 100) : 0}% das receitas
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-md flex items-center gap-2">
              <Percent className="h-4 w-4" />
              DINHEIRO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(cashTotal)}</div>
            <div className="text-sm text-muted-foreground">
              {totalIncome ? Math.round((cashTotal / totalIncome) * 100) : 0}% das receitas
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="fluxo-caixa" className="w-full">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="fluxo-caixa">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
        
        <TabsContent value="fluxo-caixa" className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentSession ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                Sessão de Caixa
              </CardTitle>
              <CardDescription>Selecione uma sessão para ver o histórico de vendas e movimentações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Sessão</Label>
                  <Select
                    value={selectedSessionId}
                    onValueChange={(v) => {
                      setSelectedSessionId(v);
                      fetchSessionDetails(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma sessão" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashSessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {new Date(s.opened_at).toLocaleString('pt-BR')} — {s.status === 'open' ? 'ABERTO' : 'FECHADO'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="h-10 flex items-center">
                    <Badge variant={selectedSession?.status === 'open' ? 'default' : 'outline'}>
                      {selectedSession?.status === 'open' ? 'ABERTO' : 'FECHADO'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-end justify-end">
                  <Button variant="outline" onClick={() => selectedSessionId && fetchSessionDetails(selectedSessionId)} disabled={!selectedSessionId || loadingSessionDetails}>
                    {loadingSessionDetails ? 'Atualizando...' : 'Atualizar sessão'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Total Vendas</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionTotal)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">PIX</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionPix)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cartão</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionCard)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Dinheiro</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionCash)}</div></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Abertura</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-semibold">{formatCurrency(Number(selectedSession?.initial_amount || 0))}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Suprimentos</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-semibold">{formatCurrency(sessionIn)}</div></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Sangrias</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-semibold">{formatCurrency(sessionOut)}</div></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Vendas da Sessão</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingSessionDetails ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
                        ) : sessionOrders.length > 0 ? (
                          sessionOrders.map((o) => (
                            <TableRow key={o.id}>
                              <TableCell>
                                <div>{formatDate(new Date(o.created_at))}</div>
                                <div className="text-xs text-muted-foreground">{formatTime(new Date(o.created_at))}</div>
                              </TableCell>
                              <TableCell>{o.order_number ? `#${o.order_number}` : o.id?.slice(0, 8)}</TableCell>
                              <TableCell><Badge variant="outline">{getPaymentMethodLabel(o.payment_method)}</Badge></TableCell>
                              <TableCell className="font-medium">{formatCurrency(Number(o.total || 0))}</TableCell>
                              <TableCell><Badge variant={o.status === 'cancelled' ? 'destructive' : 'outline'}>{String(o.status || '').toUpperCase()}</Badge></TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sem vendas nessa sessão</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Movimentações (Suprimento/Sangria)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingSessionDetails ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
                        ) : sessionMovements.length > 0 ? (
                          sessionMovements.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>
                                <div>{formatDate(new Date(m.created_at))}</div>
                                <div className="text-xs text-muted-foreground">{formatTime(new Date(m.created_at))}</div>
                              </TableCell>
                              <TableCell>
                                <Badge className={m.type === 'in' ? 'bg-green-500' : 'bg-red-500'}>
                                  {m.type === 'in' ? 'SUPRIMENTO' : 'SANGRIA'}
                                </Badge>
                              </TableCell>
                              <TableCell>{m.description || '-'}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(Number(m.amount || 0))}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem movimentações</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-xl">Transações</CardTitle>
              <CardDescription>
                Gerencie todas as transações financeiras
              </CardDescription>
              
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 mt-4">
                <div className="lg:col-span-2">
                  <Input
                    placeholder="Buscar transações..."
                    value={filters.searchTerm}
                    onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Select
                    value={filters.paymentMethod}
                    onValueChange={(value) => handleFilterChange('paymentMethod', value as PaymentMethod | '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Forma de Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Select
                    value={filters.type}
                    onValueChange={(value) => handleFilterChange('type', value as 'entrada' | 'saida' | '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="entrada">Receitas</SelectItem>
                      <SelectItem value="saida">Despesas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2 justify-end lg:col-span-2">
                  <Button variant="outline" onClick={resetFilters}>
                    Limpar
                  </Button>
                  <Button onClick={applyFilters}>
                    <Filter className="mr-2 h-4 w-4" />
                    Aplicar Filtros
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Carregando transações...
                      </TableCell>
                    </TableRow>
                  ) : filteredTransactions.length > 0 ? (
                    filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div>{formatDate(transaction.date)}</div>
                          <div className="text-xs text-muted-foreground">{formatTime(transaction.date)}</div>
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getPaymentMethodLabel(transaction.paymentMethod)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={transaction.type === 'entrada' ? 'bg-green-500' : 'bg-red-500'}>
                            {transaction.type === 'entrada' ? 'Receita' : 'Despesa'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma transação encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="relatorios" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-emerald-50/60 border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Receita Líquida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-emerald-700">{formatCurrency(dre.receitaLiquida)}</div>
              </CardContent>
            </Card>
            <Card className="bg-rose-50/60 border-l-4 border-l-rose-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-rose-700">{formatCurrency(dre.despesas)}</div>
              </CardContent>
            </Card>
            <Card className="bg-violet-50/60 border-l-4 border-l-violet-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Lucro Operacional</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-bold ${dre.lucroOperacional >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(dre.lucroOperacional)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-sky-50/60 border-l-4 border-l-sky-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Margem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-bold ${margemOperacional >= 0 ? 'text-sky-700' : 'text-rose-700'}`}>
                  {Number(margemOperacional.toFixed(1)).toString().replace('.', ',')}%
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Receitas vs Despesas</CardTitle>
                <CardDescription>
                  {new Intl.DateTimeFormat('pt-BR').format(reportStart)} até {new Intl.DateTimeFormat('pt-BR').format(reportEnd)}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="income" name="Receitas" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expenses" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="profit" name="Lucro" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Despesas por Categoria</CardTitle>
                <CardDescription>
                  Distribuição das saídas no período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[320px]">
                {expenseByCategory.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Sem despesas no período
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                      <Legend />
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {expenseByCategory.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-l-4 border-l-violet-600">
            <CardHeader>
              <CardTitle>DRE (simplificada)</CardTitle>
              <CardDescription>
                {new Intl.DateTimeFormat('pt-BR').format(reportStart)} até {new Intl.DateTimeFormat('pt-BR').format(reportEnd)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Receita Bruta</TableCell>
                    <TableCell className="text-right">{formatCurrency(dre.receitaBruta)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">(-) Descontos</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(dre.descontos)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Receita Líquida</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(dre.receitaLiquida)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Receita de Produtos</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(dre.receitaProdutos)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">Taxa de Entrega</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(dre.taxaEntrega)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-muted-foreground">(-) Despesas</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(dre.despesas)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Lucro Operacional</TableCell>
                    <TableCell className={`text-right font-bold ${dre.lucroOperacional >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(dre.lucroOperacional)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exportar Relatórios</CardTitle>
              <CardDescription>Gere relatórios financeiros personalizados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Data Inicial</div>
                  <DatePicker
                    date={filters.startDate}
                    setDate={(date) => handleFilterChange('startDate', date)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Data Final</div>
                  <DatePicker
                    date={filters.endDate}
                    setDate={(date) => handleFilterChange('endDate', date)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Tipo de Relatório</div>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de relatório" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completo">Relatório Completo</SelectItem>
                    <SelectItem value="receitas">Somente Receitas</SelectItem>
                    <SelectItem value="despesas">Somente Despesas</SelectItem>
                    <SelectItem value="pagamentos">Por Forma de Pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button className="w-full mt-4" onClick={generateCSV}>
                <Download className="mr-2 h-4 w-4" />
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Financeiro;
