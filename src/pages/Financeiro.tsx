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
  Unlock,
  RefreshCw,
  ReceiptText,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PrinterService } from '@/utils/printerService';
import { getLocalOperatorSession } from '@/services/operatorAuth';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, BarChart, Bar } from 'recharts';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CurrencyTextInput } from '@/components/ui/currency-text-input';
import { parseBRL } from '@/lib/currency';

type PaymentMethod = 'pix' | 'dinheiro' | 'cartao';
type PaymentMethodFilter = '' | 'all' | PaymentMethod;
type TxTypeFilter = '' | 'all' | 'entrada' | 'saida';
type SupabaseQuery = {
  select: (columns: string) => SupabaseQuery;
  eq: (column: string, value: unknown) => SupabaseQuery;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery;
  limit: (count: number) => SupabaseQuery;
  maybeSingle: () => Promise<{ data: unknown; error?: unknown }>;
};
type SupabaseUntyped = {
  from: (table: string) => SupabaseQuery;
};

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
  notes?: string | null;
}

const Financeiro = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
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
  const [reprintingCashReport, setReprintingCashReport] = useState(false);
  
  // States for new expense
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Geral' });
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  // States for Cash Register
  const [cashAmount, setCashAmount] = useState('');
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [cashOperation, setCashOperation] = useState<'open' | 'close' | 'in' | 'out'>('open');
  const [cashDescription, setCashDescription] = useState('');
  const [mobileFinanceTab, setMobileFinanceTab] = useState<'caixa' | 'movimentos' | 'relatorios'>('caixa');

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
        .select('id, opened_at, closed_at, initial_amount, final_amount, status, notes')
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

  const getPaymentBucket = (paymentMethod: unknown) => {
    const value = String(paymentMethod || '').trim().toLowerCase();
    if (value.includes('pix')) return 'pix';
    if (value.includes('dinheiro') || value.includes('cash') || value.includes('especie')) return 'dinheiro';
    if (value.includes('credito') || value.includes('credit')) return 'credito';
    if (value.includes('debito') || value.includes('debit')) return 'debito';
    if (value.includes('voucher') || value.includes('refeicao') || value.includes('vale')) return 'voucher';
    if (value.includes('cart') || value.includes('card')) return 'cartao';
    return 'outros';
  };

  const averageMinutesFromOrders = (orders: Array<Record<string, unknown>>) => {
    const validDurations = (Array.isArray(orders) ? orders : [])
      .map((order) => {
        const createdAt = new Date(String(order?.created_at || '')).getTime();
        const updatedAt = new Date(String(order?.updated_at || '')).getTime();
        if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt) || updatedAt < createdAt) return null;
        return Math.round((updatedAt - createdAt) / 60000);
      })
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);

    if (validDurations.length === 0) return 0;
    return Math.round(validDurations.reduce((sum, value) => sum + value, 0) / validDurations.length);
  };

  const classifyOrderChannel = (order: Record<string, unknown>) => {
    const orderType = String(order?.order_type || '').trim().toLowerCase();
    const status = String(order?.status || '').trim().toLowerCase();
    const hasTable = Boolean(order?.table_id) || orderType === 'dine_in';
    if (hasTable) return 'dine_in';

    const hasDeliveryInfo =
      orderType === 'delivery' ||
      status === 'in_delivery' ||
      status === 'delivered' ||
      Boolean(order?.delivery_zone_id) ||
      String(order?.customer_address || '').trim().length > 0 ||
      String(order?.customer_neighborhood || '').trim().length > 0 ||
      Number(order?.delivery_fee || 0) > 0;

    if (hasDeliveryInfo) return 'delivery';
    return 'counter';
  };

  const buildCashCloseReportLines = async (
    session: CashSession,
    informedAmount: number,
    closedAt: string,
    notesOverride?: string | null
  ) => {
    if (!user?.id) return [];

    const db = supabase as unknown as SupabaseUntyped;
    const orderSelect = 'id, created_at, updated_at, total, discount, delivery_fee, payment_method, status, order_type, customer_name, customer_phone, customer_address, customer_neighborhood, delivery_zone_id, table_id';
    const [{ data: orders }, { data: unlinkedOrders }, { data: movements }, { data: profile }, { data: fiscal }] = await Promise.all([
      db
        .from('orders')
        .select(orderSelect)
        .eq('user_id', user.id)
        .eq('cash_register_session_id', session.id),
      db
        .from('orders')
        .select(orderSelect)
        .eq('user_id', user.id)
        .is('cash_register_session_id', null)
        .gte('created_at', session.opened_at)
        .lte('created_at', closedAt),
      db
        .from('cash_movements')
        .select('id, created_at, type, amount, description')
        .eq('user_id', user.id)
        .eq('session_id', session.id),
      supabase
        .from('profiles')
        .select('restaurant_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('fiscal_settings')
        .select('cnpj')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const orderMap = new Map<string, Record<string, unknown>>();
    for (const order of [
      ...(Array.isArray(orders) ? orders as Array<Record<string, unknown>> : []),
      ...(Array.isArray(unlinkedOrders) ? unlinkedOrders as Array<Record<string, unknown>> : []),
    ]) {
      const id = String(order?.id || '').trim();
      if (id) orderMap.set(id, order);
    }
    const orderList = Array.from(orderMap.values());
    const movementList = Array.isArray(movements) ? movements as Array<Record<string, unknown>> : [];
    const profileRow = (profile && typeof profile === 'object' ? profile : {}) as Record<string, unknown>;
    const fiscalRow = (fiscal && typeof fiscal === 'object' ? fiscal : {}) as Record<string, unknown>;
    const sales = orderList.filter((order) => String(order?.status || '').toLowerCase() !== 'cancelled');
    const cancelledCount = orderList.length - sales.length;
    const grossRevenue = sales.reduce((sum, order) => sum + Number(order?.total || 0), 0);
    const discounts = sales.reduce((sum, order) => sum + Number(order?.discount || 0), 0);
    const deliveryFee = sales.reduce((sum, order) => sum + Number(order?.delivery_fee || 0), 0);
    const netRevenue = grossRevenue - discounts + deliveryFee;

    const paymentTotals = sales.reduce<Record<string, number>>((acc, order) => {
      const bucket = getPaymentBucket(order?.payment_method);
      acc[bucket] = (acc[bucket] || 0) + Number(order?.total || 0);
      return acc;
    }, {});

    const inAmount = movementList
      .filter((movement) => movement?.type === 'in')
      .reduce((sum, movement) => sum + Number(movement?.amount || 0), 0);
    const outAmount = movementList
      .filter((movement) => movement?.type === 'out')
      .reduce((sum, movement) => sum + Number(movement?.amount || 0), 0);
    const initial = Number(session.initial_amount || 0);
    const expectedCash = initial + Number(paymentTotals.dinheiro || 0) + inAmount - outAmount;
    const difference = informedAmount - expectedCash;
    const operatorSession = getLocalOperatorSession();
    const customerKeys = new Set(
      sales
        .map((order) => String(order?.customer_phone || order?.customer_name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const lineWidth = 48;
    const divider = '='.repeat(lineWidth);
    const centerText = (value: string) => {
      const text = String(value || '').trim();
      const leftPadding = Math.max(0, Math.floor((lineWidth - text.length) / 2));
      return `${' '.repeat(leftPadding)}${text}`;
    };
    const row = (label: string, value: string) => {
      const safeLabel = String(label || '').trim();
      const safeValue = String(value || '').trim();
      const spacing = Math.max(1, lineWidth - safeLabel.length - safeValue.length);
      return `${safeLabel}${' '.repeat(spacing)}${safeValue}`;
    };
    const date = new Date(closedAt);
    const openedAt = new Date(session.opened_at);
    const deliveryOrders = sales.filter((order) => classifyOrderChannel(order) === 'delivery');
    const counterOrders = sales.filter((order) => classifyOrderChannel(order) === 'counter');
    const dineInOrders = sales.filter((order) => classifyOrderChannel(order) === 'dine_in');
    const productionOrders = sales.filter((order) => classifyOrderChannel(order) !== 'delivery');
    const formatMinutes = (value: number) => `${Math.max(0, Math.round(value || 0))} min`;
    const reportNotes = notesOverride ?? cashDescription;

    return [
      divider,
      centerText('POPSYSTEM PDV'),
      centerText('RELATÓRIO DE FECHAMENTO'),
      divider,
      '',
      `Empresa: ${String(profileRow.restaurant_name || 'PopSystem').trim() || 'PopSystem'}`,
      `CNPJ: ${String(fiscalRow.cnpj || '--').trim() || '--'}`,
      `Operador: ${operatorSession?.name || 'Operador'}`,
      'Caixa: CAIXA 01',
      '',
      `Data: ${date.toLocaleDateString('pt-BR')}`,
      `Hora Abertura: ${openedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      `Hora Fechamento: ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      '',
      divider,
      centerText('RESUMO GERAL'),
      divider,
      '',
      row('Pedidos Realizados:', String(sales.length)),
      row('Pedidos Cancelados:', String(cancelledCount)),
      row('Clientes Atendidos:', String(customerKeys.size)),
      '',
      row('Faturamento Bruto:', formatCurrency(grossRevenue)),
      row('Descontos:', formatCurrency(discounts)),
      row('Taxa Entrega:', formatCurrency(deliveryFee)),
      row('FATURAMENTO LÍQUIDO:', formatCurrency(netRevenue)),
      '',
      divider,
      centerText('FORMAS DE PAGAMENTO'),
      divider,
      '',
      row('PIX:', formatCurrency(paymentTotals.pix || 0)),
      row('Dinheiro:', formatCurrency(paymentTotals.dinheiro || 0)),
      row('Crédito:', formatCurrency(paymentTotals.credito || 0)),
      row('Débito:', formatCurrency(paymentTotals.debito || 0)),
      row('Voucher/Refeição:', formatCurrency(paymentTotals.voucher || 0)),
      ...(Number(paymentTotals.cartao || 0) > 0 ? [row('Cartão:', formatCurrency(paymentTotals.cartao || 0))] : []),
      ...(Number(paymentTotals.outros || 0) > 0 ? [row('Outros:', formatCurrency(paymentTotals.outros || 0))] : []),
      '',
      row('TOTAL RECEBIDO:', formatCurrency(grossRevenue)),
      '',
      divider,
      centerText('MOVIMENTO CAIXA'),
      divider,
      '',
      row('Valor Inicial:', formatCurrency(initial)),
      '',
      row('Entradas Extras:', formatCurrency(inAmount)),
      row('Sangrias/Saídas:', formatCurrency(outAmount)),
      '',
      row('Valor Esperado:', formatCurrency(expectedCash)),
      row('Valor Informado:', formatCurrency(informedAmount)),
      '',
      row('DIFERENÇA:', `${difference < 0 ? '-' : ''}${formatCurrency(Math.abs(difference))}`),
      '',
      divider,
      centerText('DELIVERY / LOJA'),
      divider,
      '',
      row('Pedidos Delivery:', String(deliveryOrders.length)),
      row('Pedidos Balcão:', String(counterOrders.length)),
      row('Pedidos Mesas:', String(dineInOrders.length)),
      '',
      row('Tempo Médio Produção:', formatMinutes(averageMinutesFromOrders(productionOrders))),
      row('Tempo Médio Entrega:', formatMinutes(averageMinutesFromOrders(deliveryOrders))),
      '',
      divider,
      centerText('OBSERVACOES'),
      divider,
      '',
      'Sistema: PopSystem PDV',
      `Versão: ${import.meta.env.VITE_APP_VERSION || '1.0.96'}`,
      '',
      reportNotes ? `Obs: ${reportNotes}` : '',
      'Fechamento realizado com sucesso.',
      '',
      divider,
      '',
      'Assinatura Operador:',
      '',
      '____________________________________________',
      '',
      divider,
      centerText('POPSYSTEM PDV'),
      divider,
    ];
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    try {
      const amountValue = parseBRL(newExpense.amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        toast({ title: 'Valor inválido', description: 'A despesa deve ser maior que zero.', variant: 'destructive' });
        return;
      }
      const { error } = await (supabase as any).from('expenses').insert({
        user_id: user?.id,
        description: newExpense.description,
        amount: amountValue,
        category: newExpense.category,
        expense_date: new Date().toISOString().slice(0, 10)
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

  const handleReprintCashCloseReport = async () => {
    if (!user?.id || !selectedSession) return;
    if (selectedSession.status !== 'closed') {
      toast({
        title: 'Caixa ainda aberto',
        description: 'Só é possível reimprimir fechamentos de sessões encerradas.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setReprintingCashReport(true);
      const closedAt = selectedSession.closed_at || new Date().toISOString();
      const informedAmount = Number(selectedSession.final_amount ?? selectedSession.initial_amount ?? 0);
      const reportLines = await buildCashCloseReportLines(
        selectedSession,
        informedAmount,
        closedAt,
        selectedSession.notes || ''
      );

      await PrinterService.printCashReport({
        title: '',
        userId: user.id,
        hideStoreHeader: true,
        footerText: '',
        lines: reportLines
      });

      toast({ title: 'Fechamento reimpresso' });
    } catch (e: any) {
      toast({
        title: 'Erro ao reimprimir',
        description: e?.message || 'Não foi possível reimprimir o fechamento.',
        variant: 'destructive'
      });
    } finally {
      setReprintingCashReport(false);
    }
  };

  const handleCashOperation = async () => {
    if (!user) return;
    const amount = parseBRL(cashAmount);
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
          userId: user.id,
          lines: [`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, `Valor inicial: R$ ${Number(amount).toFixed(2)}`]
        });
      } else if (cashOperation === 'close') {
        if (!currentSession) return;
        const closedAt = new Date().toISOString();
        const reportLines = await buildCashCloseReportLines(currentSession, amount, closedAt);
        const { error } = await (supabase as any).from('cash_register_sessions').update({
          status: 'closed',
          closed_at: closedAt,
          final_amount: amount,
          notes: cashDescription
        }).eq('id', currentSession.id);
        if (error) throw error;
        toast({ title: 'Caixa fechado com sucesso' });
        await PrinterService.printCashReport({
          title: '',
          userId: user.id,
          hideStoreHeader: true,
          footerText: '',
          lines: reportLines.length > 0 ? reportLines : [
            `Data/Hora: ${new Date(closedAt).toLocaleString('pt-BR')}`,
            `Valor final: ${formatCurrency(amount)}`,
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
          userId: user.id,
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
      window.dispatchEvent(new CustomEvent('cash-session-changed'));
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
  const paymentMix = [
    { name: 'PIX', value: Math.max(pixTotal, 1), color: '#8CC850' },
    { name: 'Cartão', value: Math.max(cardTotal, 1), color: '#FF6400' },
    { name: 'Dinheiro', value: Math.max(cashTotal, 1), color: '#7C3AED' },
  ];
  const financePulse = [
    { label: 'Margem', value: Math.max(10, Math.min(96, Math.round(margemOperacional))) },
    { label: 'Liquidez', value: Math.max(14, Math.min(95, totalIncome > 0 ? Math.round((balance / totalIncome) * 100) + 62 : 22)) },
    { label: 'Despesas', value: Math.max(12, Math.min(96, totalIncome > 0 ? 100 - Math.round((totalExpenses / totalIncome) * 100) : 18)) },
    { label: 'Caixa', value: Math.max(16, Math.min(94, currentSession ? 74 : 48)) },
  ];
  const topExpenseCards = expenseByCategory.slice(0, 4);
  const isCashRoute = location.pathname.startsWith('/caixa');
  const headerTitle = isCashRoute ? 'Caixa geral' : 'Financeiro';
  const headerSubtitle = isCashRoute
    ? 'Abertura, suprimento, sangria e conferência do caixa em uma visão operacional.'
    : 'Acompanhe receitas, despesas, lucro e DRE no período selecionado';

  const openCashActionDialog = (operation: 'open' | 'close' | 'in' | 'out') => {
    setCashOperation(operation);
    setCashAmount('');
    setCashDescription('');
    setIsCashDialogOpen(true);
  };

  const refreshFinanceData = async () => {
    await Promise.all([fetchData(), checkOpenSession(), fetchCashSessions()]);
    if (selectedSessionId) {
      await fetchSessionDetails(selectedSessionId);
    }
  };

  const mobileCashActions = [
    {
      key: currentSession ? 'close' : 'open',
      label: currentSession ? 'Fechar caixa' : 'Abrir caixa',
      icon: currentSession ? Unlock : Lock,
      onClick: () => openCashActionDialog(currentSession ? 'close' : 'open'),
      className: currentSession
        ? 'border-[#003223]/12 bg-[#003223] text-white'
        : 'border-[#8CC850]/25 bg-[#F5FBED] text-[#245B2B]',
    },
    {
      key: 'in',
      label: 'Suprimento',
      icon: ArrowUp,
      onClick: () => openCashActionDialog('in'),
      className: 'border-[#8CC850]/18 bg-white text-[#245B2B]',
    },
    {
      key: 'out',
      label: 'Sangria',
      icon: ArrowDown,
      onClick: () => openCashActionDialog('out'),
      className: 'border-[#FF6400]/18 bg-white text-[#C45E00]',
    },
    {
      key: 'expense',
      label: 'Despesa',
      icon: ReceiptText,
      onClick: () => setIsExpenseDialogOpen(true),
      className: 'border-[#003223]/10 bg-white text-[#003223]',
    },
    {
      key: 'refresh',
      label: 'Atualizar',
      icon: RefreshCw,
      onClick: () => { void refreshFinanceData(); },
      className: 'border-[#003223]/10 bg-white text-[#003223]',
    },
    {
      key: 'report',
      label: 'Relatório',
      icon: Download,
      onClick: generateCSV,
      className: 'border-[#003223]/10 bg-white text-[#003223]',
    },
  ];

  const mobileTypeFilters: Array<{ value: TxTypeFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'entrada', label: 'Receitas' },
    { value: 'saida', label: 'Despesas' },
  ];

  const mobilePaymentFilters: Array<{ value: PaymentMethodFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'pix', label: 'PIX' },
    { value: 'cartao', label: 'Cartão' },
    { value: 'dinheiro', label: 'Dinheiro' },
  ];
  
  return (
    <div className="space-y-6">
      <Card className="hidden overflow-hidden border-0 bg-gradient-to-br from-boracume-dark-green via-[#0b5137] to-[#003223] text-white shadow-[0_26px_60px_-34px_rgba(0,50,35,0.55)] dark:from-[#091510] dark:via-[#101a16] dark:to-[#151223] md:block">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-bold tracking-tight">{headerTitle}</div>
              <div className="text-white/90 text-sm mt-1">
                {headerSubtitle}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
           <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
            <DialogTrigger asChild>
              <Button className="border border-white/20 bg-white/15 text-white hover:bg-white/25" variant="outline" onClick={() => {
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
                  <CurrencyTextInput 
                    value={cashAmount} 
                    onValueChange={setCashAmount} 
                    placeholder="R$ 0,00"
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
              <Button className="bg-boracume-orange text-white hover:bg-boracume-orange/90">
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
                  <CurrencyTextInput value={newExpense.amount} onValueChange={(value) => setNewExpense({...newExpense, amount: value})} placeholder="R$ 0,00" />
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
      
      <div className="hidden gap-5 md:grid">
        <div className="space-y-5">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_28px_70px_-36px_rgba(0,50,35,0.32)] dark:border-white/10 dark:bg-[#101a16]/96 dark:shadow-[0_26px_60px_-36px_rgba(0,0,0,0.82)]">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6400]/15 bg-[#FFF1E6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FF6400] dark:border-[#FF6400]/25 dark:bg-[#FF6400]/10">
                    <DollarSign className="h-3.5 w-3.5" />
                    Financial cockpit
                  </div>
                  <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Visão financeira inteligente</div>
                  <div className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                    Um layout mais analítico para acompanhar caixa, margem, mix de pagamentos e pressão das despesas no período.
                  </div>
                </div>
                <div className="grid w-full shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:w-[420px] 2xl:w-[480px]">
                  <div className="min-w-0 rounded-[22px] border border-[#8CC850]/18 bg-gradient-to-br from-white to-[#F5FBED] p-4 dark:border-[#8CC850]/15 dark:from-[#0c1512] dark:to-[#112017]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Receitas</div>
                    <div className="mt-2 truncate text-[1.35rem] font-bold text-slate-900 dark:text-white 2xl:text-2xl">{formatCurrency(totalIncome)}</div>
                  </div>
                  <div className="min-w-0 rounded-[22px] border border-[#FF6400]/18 bg-gradient-to-br from-white to-[#FFF3EA] p-4 dark:border-[#FF6400]/15 dark:from-[#0c1512] dark:to-[#1e1510]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Despesas</div>
                    <div className="mt-2 truncate text-[1.35rem] font-bold text-slate-900 dark:text-white 2xl:text-2xl">{formatCurrency(totalExpenses)}</div>
                  </div>
                  <div className="min-w-0 rounded-[22px] border border-[#003223]/10 bg-gradient-to-br from-white to-[#F5F8F7] p-4 dark:border-white/10 dark:from-[#0c1512] dark:to-[#141b18]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Saldo</div>
                    <div className={`mt-2 truncate text-[1.35rem] font-bold 2xl:text-2xl ${balance >= 0 ? 'text-boracume-green' : 'text-boracume-orange'}`}>{formatCurrency(balance)}</div>
                  </div>
                  <div className="min-w-0 rounded-[22px] border border-violet-200 bg-gradient-to-br from-white to-violet-50 p-4 dark:border-violet-500/20 dark:from-[#0c1512] dark:to-[#171325]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Margem</div>
                    <div className="mt-2 truncate text-[1.35rem] font-bold text-slate-900 dark:text-white 2xl:text-2xl">{Number(margemOperacional.toFixed(1)).toString().replace('.', ',')}%</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_320px]">
                <div className="rounded-[28px] border border-[#003223]/8 bg-[#F8FAF8] p-4 dark:border-white/10 dark:bg-[#0c1512]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Fluxo do período</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Intl.DateTimeFormat('pt-BR').format(reportStart)} até {new Intl.DateTimeFormat('pt-BR').format(reportEnd)}
                      </div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#003223] dark:bg-[#101a16] dark:text-slate-300">
                      DRE viva
                    </div>
                  </div>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailySeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7e1dc" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis tickLine={false} axisLine={false} width={44} />
                        <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                        <Legend />
                        <Line type="monotone" dataKey="income" name="Receitas" stroke="#8CC850" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="expenses" name="Despesas" stroke="#FF6400" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="profit" name="Lucro" stroke="#7C3AED" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[28px] border border-[#003223]/8 bg-[#F8FAF8] p-4 dark:border-white/10 dark:bg-[#0c1512]">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Mix de pagamentos</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Como as receitas estão distribuídas hoje</div>
                    <div className="mt-4 h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentMix} dataKey="value" nameKey="name" innerRadius={42} outerRadius={72} paddingAngle={3}>
                            {paymentMix.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid gap-2">
                      {paymentMix.map((item) => (
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
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Pulso financeiro</div>
                    <div className="mt-4 space-y-3">
                      {financePulse.map((item, index) => (
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
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Pressão por categoria</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Categorias que mais pesam nas despesas</div>
                </div>
              </div>
              <div className="space-y-3">
                {topExpenseCards.length > 0 ? topExpenseCards.map((item, index) => (
                  <div key={item.name} className="rounded-[22px] border border-[#003223]/8 bg-[#F8FAF8] p-4 dark:border-white/10 dark:bg-[#0c1512]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">rank #{index + 1}</div>
                      </div>
                      <div className="text-lg font-bold text-[#003223] dark:text-white">{formatCurrency(item.value)}</div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-[#003223]/12 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    Sem despesas suficientes para ranquear categorias.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Distribuição de despesas</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Leitura visual do peso de cada categoria</div>
                </div>
                <div className="rounded-full bg-[#F5EBE1] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#003223] dark:bg-[#1b1510] dark:text-slate-300">
                  visão estratégica
                </div>
              </div>
              <div className="h-[240px]">
                {expenseByCategory.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                    Sem despesas no período para plotar o gráfico.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseByCategory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d7e1dc" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={44} />
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#FF6400" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="space-y-3 md:hidden">
        <section className="rounded-[16px] border border-white/70 bg-white/92 p-2 shadow-[0_18px_40px_-34px_rgba(0,50,35,0.24)]">
          <div className="space-y-2">
            <div className="inline-flex items-center rounded-full border border-[#FF6400]/15 bg-[#FFF1E6] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#FF6400]">
              {isCashRoute ? 'Caixa geral' : 'Financeiro mobile'}
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[1rem] font-bold tracking-tight text-slate-900">
                  {currentSession ? 'Caixa aberto agora' : 'Caixa pronto para abrir'}
                </h1>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  {currentSession
                    ? 'Use suprimento, sangria, conferência e sessão atual com poucos toques.'
                    : 'Abra o caixa e acompanhe vendas, pagamentos e movimentações direto do celular.'}
                </p>
              </div>
              <div className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${currentSession ? 'bg-[#F5FBED] text-[#245B2B]' : 'bg-[#FFF1E6] text-[#C45E00]'}`}>
                {currentSession ? 'Aberto' : 'Fechado'}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {mobileCashActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                className={`rounded-[14px] border p-2 text-left shadow-sm transition-transform active:scale-[0.98] ${action.className}`}
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-3 w-3" />
                  <ChevronRight className="h-2.5 w-2.5 opacity-40" />
                </div>
                <div className="mt-1.5 text-[10px] font-semibold">{action.label}</div>
              </button>
            );
          })}
        </section>

        <section className="rounded-[18px] border border-slate-200/80 bg-white/95 p-2.5 shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Sessão do caixa</div>
                <div className="text-xs text-slate-500">Escolha a sessão para conferir vendas e movimentações.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-[14px] border-[#003223]/10 bg-white px-2.5 text-[10px] text-[#003223] hover:bg-[#F5EBE1]"
                onClick={() => { void refreshFinanceData(); }}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Atualizar
              </Button>
            </div>
            <Select
              value={selectedSessionId}
              onValueChange={(value) => {
                setSelectedSessionId(value);
                void fetchSessionDetails(value);
              }}
            >
              <SelectTrigger className="h-8 rounded-[14px] border-[#003223]/10 bg-white text-[11px]">
                <SelectValue placeholder="Selecione uma sessão" />
              </SelectTrigger>
              <SelectContent>
                {cashSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {new Date(session.opened_at).toLocaleString('pt-BR')} - {session.status === 'open' ? 'ABERTO' : 'FECHADO'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between rounded-[16px] border border-[#003223]/8 bg-[#F8FAF8] px-2.5 py-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedSession?.status === 'open' ? 'Sessão aberta' : 'Sessão fechada'}
                </div>
              </div>
              <Badge variant={selectedSession?.status === 'open' ? 'default' : 'outline'}>
                {selectedSession?.status === 'open' ? 'ABERTO' : 'FECHADO'}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full rounded-[14px] border-[#003223]/10 bg-white text-xs text-[#003223] hover:bg-[#F5EBE1]"
              onClick={() => { void handleReprintCashCloseReport(); }}
              disabled={!selectedSession || selectedSession.status !== 'closed' || reprintingCashReport}
            >
              <ReceiptText className="mr-1.5 h-3.5 w-3.5" />
              {reprintingCashReport ? 'Reimprimindo...' : 'Reimprimir fechamento'}
            </Button>
          </div>
        </section>

        <Tabs value={mobileFinanceTab} onValueChange={(value) => setMobileFinanceTab(value as typeof mobileFinanceTab)} className="w-full">
          <TabsList className="grid h-auto grid-cols-3 rounded-[16px] border border-[#FF6400]/10 bg-white p-1">
            <TabsTrigger value="caixa" className="rounded-[12px] text-[9px]">Caixa</TabsTrigger>
            <TabsTrigger value="movimentos" className="rounded-[12px] text-[9px]">Movimentos</TabsTrigger>
            <TabsTrigger value="relatorios" className="rounded-[12px] text-[9px]">DRE</TabsTrigger>
          </TabsList>

          <TabsContent value="caixa" className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[18px] border border-[#8CC850]/20 bg-white/95 p-3 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Vendas</div>
                <div className="mt-1.5 text-[1rem] font-bold text-slate-900">{formatCurrency(sessionTotal)}</div>
              </div>
              <div className="rounded-[18px] border border-[#003223]/10 bg-white/95 p-3 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Abertura</div>
                <div className="mt-1.5 text-[1rem] font-bold text-slate-900">{formatCurrency(Number(selectedSession?.initial_amount || 0))}</div>
              </div>
              <div className="rounded-[18px] border border-[#8CC850]/20 bg-white/95 p-3 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">PIX</div>
                <div className="mt-1.5 text-[1rem] font-bold text-slate-900">{formatCurrency(sessionPix)}</div>
              </div>
              <div className="rounded-[18px] border border-[#FF6400]/18 bg-white/95 p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cartão</div>
                <div className="mt-1.5 text-[1rem] font-bold text-slate-900">{formatCurrency(sessionCard)}</div>
              </div>
              <div className="rounded-[18px] border border-[#7C3AED]/18 bg-white/95 p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dinheiro</div>
                <div className="mt-1.5 text-[1rem] font-bold text-slate-900">{formatCurrency(sessionCash)}</div>
              </div>
              <div className="rounded-[18px] border border-[#003223]/10 bg-white/95 p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Saldo</div>
                <div className="mt-1.5 text-[1rem] font-bold text-slate-900">{formatCurrency(sessionTotal + sessionIn - sessionOut)}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-[16px] border border-[#003223]/10 bg-white/95 p-2.5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Abertura</div>
                <div className="mt-1.5 text-[12px] font-bold text-slate-900">{formatCurrency(Number(selectedSession?.initial_amount || 0))}</div>
              </div>
              <div className="rounded-[16px] border border-[#8CC850]/20 bg-white/95 p-2.5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Suprimentos</div>
                <div className="mt-1.5 text-[12px] font-bold text-slate-900">{formatCurrency(sessionIn)}</div>
              </div>
              <div className="rounded-[16px] border border-[#FF6400]/18 bg-white/95 p-2.5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sangrias</div>
                <div className="mt-1.5 text-[12px] font-bold text-slate-900">{formatCurrency(sessionOut)}</div>
              </div>
            </div>

            <section className="rounded-[20px] border border-slate-200/80 bg-white/95 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Últimas vendas da sessão</div>
                <div className="text-xs text-slate-500">{sessionSales.length} venda(s)</div>
              </div>
              <div className="mt-2.5 space-y-2">
                {loadingSessionDetails ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Carregando sessão...</div>
                ) : sessionSales.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Sem vendas nessa sessão.</div>
                ) : (
                  sessionSales.slice(0, 5).map((order) => (
                    <div key={order.id} className="rounded-[16px] border border-[#003223]/8 bg-[#F8FAF8] p-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Pedido {order.order_number ? `#${order.order_number}` : order.id?.slice(0, 8)}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(new Date(order.created_at))} às {formatTime(new Date(order.created_at))}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">{formatCurrency(Number(order.total || 0))}</div>
                          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{getPaymentMethodLabel(order.payment_method)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Movimentações do caixa</div>
                <div className="text-xs text-slate-500">{sessionMovements.length} registro(s)</div>
              </div>
              <div className="mt-3 space-y-3">
                {loadingSessionDetails ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Carregando movimentações...</div>
                ) : sessionMovements.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">Sem movimentações nesta sessão.</div>
                ) : (
                  sessionMovements.slice(0, 6).map((movement) => (
                    <div key={movement.id} className="rounded-[22px] border border-[#003223]/8 bg-[#F8FAF8] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{movement.type === 'in' ? 'Suprimento' : 'Sangria'}</div>
                          <div className="mt-1 text-xs text-slate-500">{movement.description || 'Sem descrição'}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDate(new Date(movement.created_at))} às {formatTime(new Date(movement.created_at))}</div>
                        </div>
                        <div className={`text-sm font-bold ${movement.type === 'in' ? 'text-[#245B2B]' : 'text-[#C45E00]'}`}>
                          {formatCurrency(Number(movement.amount || 0))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="movimentos" className="mt-4 space-y-4">
            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-sm">
              <div className="space-y-3">
                <Input
                  placeholder="Buscar movimentações, categorias ou pedidos..."
                  value={filters.searchTerm}
                  onChange={(event) => handleFilterChange('searchTerm', event.target.value)}
                  className="h-11 rounded-2xl border-[#003223]/10 bg-white"
                />
                <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                  {mobileTypeFilters.map((filter) => (
                    <button
                      key={filter.value || 'all'}
                      type="button"
                      onClick={() => handleFilterChange('type', filter.value)}
                      className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        (filters.type || 'all') === filter.value
                          ? 'border-[#003223] bg-[#003223] text-white'
                          : 'border-[#DCE6DF] bg-white text-[#003223]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                  {mobilePaymentFilters.map((filter) => (
                    <button
                      key={filter.value || 'all'}
                      type="button"
                      onClick={() => handleFilterChange('paymentMethod', filter.value)}
                      className={`shrink-0 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        (filters.paymentMethod || 'all') === filter.value
                          ? 'border-[#003223] bg-[#003223] text-white'
                          : 'border-[#DCE6DF] bg-white text-[#003223]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1 rounded-2xl border-[#003223]/10 bg-white text-[#003223] hover:bg-[#F5EBE1]"
                    onClick={resetFilters}
                  >
                    Limpar
                  </Button>
                  <Button
                    type="button"
                    className="h-10 flex-1 rounded-2xl bg-[#003223] text-white hover:bg-[#0a4a34]"
                    onClick={applyFilters}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </section>

            <div className="space-y-3">
              {isLoading ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/90 px-4 py-10 text-center text-sm text-slate-500">Carregando transações...</div>
              ) : filteredTransactions.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/90 px-4 py-10 text-center text-sm text-slate-500">Nenhuma transação encontrada.</div>
              ) : (
                filteredTransactions.slice(0, 12).map((transaction) => (
                  <div key={transaction.id} className="rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{transaction.description}</div>
                        <div className="mt-1 text-xs text-slate-500">{transaction.category}</div>
                        <div className="mt-2 text-xs text-slate-500">{formatDate(transaction.date)} às {formatTime(transaction.date)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${transaction.type === 'entrada' ? 'text-[#245B2B]' : 'text-[#C45E00]'}`}>
                          {formatCurrency(transaction.amount)}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {getPaymentMethodLabel(transaction.paymentMethod)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="relatorios" className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[22px] border border-[#8CC850]/20 bg-white/95 p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Receita</div>
                <div className="mt-2 text-base font-bold text-slate-900">{formatCurrency(dre.receitaLiquida)}</div>
              </div>
              <div className="rounded-[22px] border border-[#FF6400]/18 bg-white/95 p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Despesas</div>
                <div className="mt-2 text-base font-bold text-slate-900">{formatCurrency(dre.despesas)}</div>
              </div>
              <div className="rounded-[22px] border border-[#003223]/10 bg-white/95 p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Lucro</div>
                <div className={`mt-2 text-base font-bold ${dre.lucroOperacional >= 0 ? 'text-[#245B2B]' : 'text-[#C45E00]'}`}>
                  {formatCurrency(dre.lucroOperacional)}
                </div>
              </div>
            </div>

            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">DRE simplificada</div>
                  <div className="text-xs text-slate-500">
                    {new Intl.DateTimeFormat('pt-BR').format(reportStart)} até {new Intl.DateTimeFormat('pt-BR').format(reportEnd)}
                  </div>
                </div>
                <div className="rounded-full bg-[#F5FBED] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#245B2B]">
                  {Number(margemOperacional.toFixed(1)).toString().replace('.', ',')}%
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Receita bruta</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(dre.receitaBruta)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Descontos</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(dre.descontos)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Receita líquida</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(dre.receitaLiquida)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Taxa de entrega</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(dre.taxaEntrega)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Despesas</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(dre.despesas)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="font-semibold text-slate-900">Lucro operacional</span>
                  <span className={`font-bold ${dre.lucroOperacional >= 0 ? 'text-[#245B2B]' : 'text-[#C45E00]'}`}>
                    {formatCurrency(dre.lucroOperacional)}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                className="mt-4 h-11 w-full rounded-2xl bg-[#003223] text-white hover:bg-[#0a4a34]"
                onClick={generateCSV}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar relatório
              </Button>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden">
        <Card className="rounded-[28px] border border-white/70 border-t-4 border-t-boracume-green bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <ArrowUp className="h-5 w-5 text-boracume-green" />
              Receitas
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Total de vendas e entradas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-boracume-dark-green">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-[28px] border border-white/70 border-t-4 border-t-boracume-orange bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <ArrowDown className="h-5 w-5 text-boracume-orange" />
              Despesas
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Total de custos e saídas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-boracume-orange">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-[28px] border border-white/70 border-t-4 border-t-boracume-dark-green bg-boracume-green/5 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <DollarSign className="h-5 w-5 text-boracume-dark-green" />
              Saldo
            </CardTitle>
            <CardDescription className="dark:text-slate-400">Balanço atual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-boracume-green' : 'text-boracume-orange'}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="hidden">
        <Card className="rounded-[26px] border border-white/70 bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.2)] dark:border-white/10 dark:bg-[#101a16]/95">
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
        
        <Card className="rounded-[26px] border border-white/70 bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.2)] dark:border-white/10 dark:bg-[#101a16]/95">
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
        
        <Card className="rounded-[26px] border border-white/70 bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.2)] dark:border-white/10 dark:bg-[#101a16]/95">
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
      
      <div className="hidden md:block">
      <Tabs defaultValue="fluxo-caixa" className="w-full">
        <TabsList className="bg-muted/60 dark:bg-white/5">
          <TabsTrigger value="fluxo-caixa">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
        
        <TabsContent value="fluxo-caixa" className="space-y-4">
          <Card className="rounded-[30px] border border-white/70 bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                {currentSession ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                Sessão de Caixa
              </CardTitle>
              <CardDescription className="dark:text-slate-400">Selecione uma sessão para ver o histórico de vendas e movimentações</CardDescription>
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
                <div className="flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-end">
                  <Button variant="outline" onClick={() => selectedSessionId && fetchSessionDetails(selectedSessionId)} disabled={!selectedSessionId || loadingSessionDetails}>
                    {loadingSessionDetails ? 'Atualizando...' : 'Atualizar sessão'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { void handleReprintCashCloseReport(); }}
                    disabled={!selectedSession || selectedSession.status !== 'closed' || reprintingCashReport}
                  >
                    <ReceiptText className="mr-2 h-4 w-4" />
                    {reprintingCashReport ? 'Reimprimindo...' : 'Reimprimir fechamento'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Card className="rounded-[22px] border border-[#8CC850]/15 bg-white dark:border-white/10 dark:bg-[#0c1512]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Total Vendas</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionTotal)}</div></CardContent>
                </Card>
                <Card className="rounded-[22px] border border-[#0ea5e9]/15 bg-white dark:border-white/10 dark:bg-[#0c1512]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">PIX</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionPix)}</div></CardContent>
                </Card>
                <Card className="rounded-[22px] border border-[#FF6400]/15 bg-white dark:border-white/10 dark:bg-[#0c1512]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Cartão</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionCard)}</div></CardContent>
                </Card>
                <Card className="rounded-[22px] border border-[#003223]/10 bg-white dark:border-white/10 dark:bg-[#0c1512]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Dinheiro</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">{formatCurrency(sessionCash)}</div></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="rounded-[22px] border border-[#003223]/10 bg-white dark:border-white/10 dark:bg-[#0c1512]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Abertura</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-semibold">{formatCurrency(Number(selectedSession?.initial_amount || 0))}</div></CardContent>
                </Card>
                <Card className="rounded-[22px] border border-[#8CC850]/15 bg-white dark:border-white/10 dark:bg-[#0c1512]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Suprimentos</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-semibold">{formatCurrency(sessionIn)}</div></CardContent>
                </Card>
                <Card className="rounded-[22px] border border-[#FF6400]/15 bg-white dark:border-white/10 dark:bg-[#0c1512]">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Sangrias</CardTitle></CardHeader>
                  <CardContent><div className="text-lg font-semibold">{formatCurrency(sessionOut)}</div></CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="rounded-[24px] border border-white/70 bg-white/95 dark:border-white/10 dark:bg-[#0c1512]">
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

                <Card className="rounded-[24px] border border-white/70 bg-white/95 dark:border-white/10 dark:bg-[#0c1512]">
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

          <Card className="rounded-[30px] border border-white/70 bg-white/90 shadow-[0_24px_60px_-36px_rgba(0,50,35,0.28)] dark:border-white/10 dark:bg-[#101a16]/95">
            <CardHeader>
              <CardTitle className="text-xl text-slate-900 dark:text-white">Transações</CardTitle>
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
    </div>
  );
};

export default Financeiro;
