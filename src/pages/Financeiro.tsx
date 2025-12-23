import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
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
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Filter,
  Percent,
  Plus,
  Trash2,
  Lock,
  Unlock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  
  // States for new expense
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Geral' });
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  // States for Cash Register
  const [cashAmount, setCashAmount] = useState('');
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [cashOperation, setCashOperation] = useState<'open' | 'close' | 'in' | 'out'>('open');
  const [cashDescription, setCashDescription] = useState('');

  const [filters, setFilters] = useState({
    paymentMethod: '' as '' | PaymentMethod,
    type: '' as '' | 'entrada' | 'saida',
    startDate: null as Date | null,
    endDate: null as Date | null,
    searchTerm: ''
  });
  
  // Fetch transactions and session
  useEffect(() => {
    if (user) {
      fetchData();
      checkOpenSession();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch Orders (Income)
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id);
      
      const incomeTx = (orders || []).map(order => ({
        id: order.id,
        date: new Date(order.created_at),
        description: `Pedido #${order.id.substring(0, 8)}`,
        amount: order.total,
        type: 'entrada' as 'entrada',
        category: 'Vendas',
        paymentMethod: order.payment_method as PaymentMethod
      }));

      // 2. Fetch Expenses (Outcome)
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id);

      const expenseTx = (expenses || []).map(exp => ({
        id: exp.id,
        date: new Date(exp.date),
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
    const { data } = await supabase
      .from('cash_register_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .maybeSingle();
    
    setCurrentSession(data);
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    try {
      const { error } = await supabase.from('expenses').insert({
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
        const { error } = await supabase.from('cash_register_sessions').insert({
          user_id: user.id,
          initial_amount: amount,
          status: 'open',
          opened_at: new Date().toISOString()
        });
        if (error) throw error;
        toast({ title: 'Caixa aberto com sucesso' });
      } else if (cashOperation === 'close') {
        if (!currentSession) return;
        const { error } = await supabase.from('cash_register_sessions').update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          final_amount: amount,
          notes: cashDescription
        }).eq('id', currentSession.id);
        if (error) throw error;
        toast({ title: 'Caixa fechado com sucesso' });
      } else {
        // Suprimento ou Sangria
        if (!currentSession) {
          toast({ title: 'Caixa fechado', description: 'Abra o caixa primeiro', variant: 'destructive' });
          return;
        }
        const { error } = await supabase.from('cash_movements').insert({
          session_id: currentSession.id,
          user_id: user.id,
          type: cashOperation,
          amount: amount,
          description: cashDescription
        });
        if (error) throw error;
        toast({ title: cashOperation === 'in' ? 'Suprimento registrado' : 'Sangria registrada' });
      }
      
      setIsCashDialogOpen(false);
      setCashAmount('');
      setCashDescription('');
      checkOpenSession();
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
    
    if (filters.paymentMethod) {
      result = result.filter(t => t.paymentMethod === filters.paymentMethod);
    }
    
    if (filters.type) {
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
  
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };
  
  const getPaymentMethodLabel = (method?: PaymentMethod) => {
    switch (method) {
      case 'pix': return 'PIX';
      case 'dinheiro': return 'DINHEIRO';
      case 'cartao': return 'CARTÃO';
      default: return method || '-';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Gestão Financeira</h1>
        <div className="flex gap-2">
           <Dialog open={isCashDialogOpen} onOpenChange={setIsCashDialogOpen}>
            <DialogTrigger asChild>
              <Button variant={currentSession ? "secondary" : "default"} onClick={() => {
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
              <Button variant="destructive">
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
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
        
        <Card>
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
        
        <Card>
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
        <Card>
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
        
        <Card>
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
        
        <Card>
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
        <TabsList>
          <TabsTrigger value="fluxo-caixa">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
        
        <TabsContent value="fluxo-caixa" className="space-y-4">
          <Card>
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
              <Table>
                <TableHeader>
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
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="relatorios" className="space-y-4">
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
              
              <Button className="w-full mt-4">
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
