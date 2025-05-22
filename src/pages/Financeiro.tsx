
import React, { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  Download, 
  Filter,
  Percent
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';

type PaymentMethod = 'PIX' | 'DINHEIRO' | 'CARTÃO';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
  category: string;
  paymentMethod: PaymentMethod;
}

const initialTransactions: Transaction[] = [
  {
    id: 'T1001',
    date: new Date(2024, 4, 22, 14, 30),
    description: 'Pedido #8765',
    amount: 89.90,
    type: 'entrada',
    category: 'Vendas',
    paymentMethod: 'PIX'
  },
  {
    id: 'T1002',
    date: new Date(2024, 4, 22, 15, 45),
    description: 'Pedido #8764',
    amount: 65.50,
    type: 'entrada',
    category: 'Vendas',
    paymentMethod: 'CARTÃO'
  },
  {
    id: 'T1003',
    date: new Date(2024, 4, 22, 16, 20),
    description: 'Pedido #8763',
    amount: 115.80,
    type: 'entrada',
    category: 'Vendas',
    paymentMethod: 'DINHEIRO'
  },
  {
    id: 'T1004',
    date: new Date(2024, 4, 22, 18, 10),
    description: 'Compra Ingredientes',
    amount: 350.75,
    type: 'saida',
    category: 'Compras',
    paymentMethod: 'PIX'
  },
  {
    id: 'T1005',
    date: new Date(2024, 4, 21, 13, 15),
    description: 'Pagamento Fornecedor',
    amount: 1200.00,
    type: 'saida',
    category: 'Fornecedores',
    paymentMethod: 'CARTÃO'
  },
  {
    id: 'T1006',
    date: new Date(2024, 4, 20, 19, 30),
    description: 'Pedido #8762',
    amount: 32.90,
    type: 'entrada',
    category: 'Vendas',
    paymentMethod: 'DINHEIRO'
  },
  {
    id: 'T1007',
    date: new Date(2024, 4, 20, 20, 45),
    description: 'Pagamento Entregador',
    amount: 120.00,
    type: 'saida',
    category: 'Despesas Operacionais',
    paymentMethod: 'PIX'
  }
];

const Financeiro = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(initialTransactions);
  const [filters, setFilters] = useState({
    paymentMethod: '' as '' | PaymentMethod,
    type: '' as '' | 'entrada' | 'saida',
    startDate: null as Date | null,
    endDate: null as Date | null,
    searchTerm: ''
  });
  
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
    .filter(t => t.paymentMethod === 'PIX' && t.type === 'entrada')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
    
  const cardTotal = filteredTransactions
    .filter(t => t.paymentMethod === 'CARTÃO' && t.type === 'entrada')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
    
  const cashTotal = filteredTransactions
    .filter(t => t.paymentMethod === 'DINHEIRO' && t.type === 'entrada')
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
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gestão Financeira</h1>
      
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
              {Math.round((pixTotal / totalIncome) * 100)}% das receitas
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
              {Math.round((cardTotal / totalIncome) * 100)}% das receitas
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
              {Math.round((cashTotal / totalIncome) * 100)}% das receitas
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
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                      <SelectItem value="CARTÃO">Cartão</SelectItem>
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
                      <SelectItem value="">Todos</SelectItem>
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
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div>{formatDate(transaction.date)}</div>
                          <div className="text-xs text-muted-foreground">{formatTime(transaction.date)}</div>
                        </TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{transaction.paymentMethod}</Badge>
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
