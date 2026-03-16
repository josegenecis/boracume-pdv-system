import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, DollarSign, Calendar, Upload, FileText, Search, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  receipt_url?: string;
  user_id: string;
  created_at: string;
  is_active?: boolean;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  reversed_by?: string | null;
}

const getExpenseDateKey = (exp: any) => {
  const raw = exp?.expense_date ?? exp?.date ?? exp?.created_at ?? '';
  return String(raw || '').slice(0, 10);
};

const EXPENSE_CATEGORIES = [
  'alimentação',
  'transporte',
  'insumos',
  'outros',
  'aluguel',
  'água',
  'luz',
  'gás',
  'manutenção',
  'marketing',
  'equipamentos'
];

export default function Despesas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showReversed, setShowReversed] = useState(false);
  
  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    loadExpenses();
  }, [user]);

  useEffect(() => {
    filterExpenses();
  }, [expenses, searchTerm, selectedCategory, dateFrom, dateTo, showReversed]);

  const loadExpenses = async () => {
    try {
      if (!user?.id) return;
      setLoading(true);
      const base = () => supabase.from('expenses').select('*').eq('user_id', user.id);
      const first = await base().order('expense_date', { ascending: false });
      if (first.error) {
        const msg = String(first.error.message || '');
        const fallback = msg.includes('expense_date') || msg.includes('column') ? await base().order('created_at', { ascending: false }) : first;
        if (fallback.error) throw fallback.error;
        setExpenses((fallback.data as any[]) || []);
      } else {
        setExpenses((first.data as any[]) || []);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as despesas.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filterExpenses = () => {
    let filtered = expenses;
    if (!showReversed) {
      filtered = filtered.filter((exp) => exp.is_active !== false);
    }

    if (searchTerm) {
      filtered = filtered.filter(exp => 
        exp.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(exp => exp.category === selectedCategory);
    }

    if (dateFrom) {
      filtered = filtered.filter(exp => getExpenseDateKey(exp) >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(exp => getExpenseDateKey(exp) <= dateTo);
    }

    setFilteredExpenses(filtered);
  };

  const reverseExpense = async (expense: Expense) => {
    const reason = window.prompt('Motivo do estorno (opcional):') || '';
    try {
      if (!user?.id) return;
      const { error } = await supabase
        .from('expenses')
        .update({
          is_active: false,
          reversed_at: new Date().toISOString(),
          reversal_reason: reason.trim() || null,
          reversed_by: user.id
        })
        .eq('id', expense.id)
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: 'Erro ao estornar',
          description: error.message,
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Estornado',
        description: 'Lançamento estornado com sucesso.'
      });
      loadExpenses();
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível estornar a despesa.',
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) return;
    if (!description.trim() || !amount || !category || !expenseDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive'
      });
      return;
    }
    const parseMoney = (raw: string) => {
      const cleaned = String(raw || '')
        .replace(/\s/g, '')
        .replace(/[^\d,.-]/g, '')
        .replace(/-/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      return Number(cleaned);
    };
    const amountValue = parseMoney(amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'A despesa deve ser maior que zero.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let receiptUrl = undefined;

      // Upload receipt if provided
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(filePath, receiptFile);

        if (uploadError) {
          console.error('Error uploading receipt:', uploadError);
          toast({
            title: 'Aviso',
            description: 'Comprovante não foi salvo, mas a despesa foi registrada.',
            variant: 'destructive'
          });
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('expense-receipts')
            .getPublicUrl(filePath);
          receiptUrl = publicUrl;
        }
      }

      // Create expense
      const payloadBase: any = {
        description: description.trim(),
        amount: amountValue,
        category,
        receipt_url: receiptUrl,
        user_id: user.id
      };

      const firstInsert = await supabase
        .from('expenses')
        .insert({ ...payloadBase, expense_date: expenseDate } as any);

      if (firstInsert.error) {
        const msg = String(firstInsert.error.message || '').toLowerCase();
        const mentionsExpenseDate = msg.includes('expense_date') || (msg.includes('column') && msg.includes('expense'));
        if (mentionsExpenseDate) {
          const retry = await supabase
            .from('expenses')
            .insert({ ...payloadBase, date: expenseDate } as any);
          if (retry.error) throw retry.error;
        } else {
          throw firstInsert.error;
        }
      }

      toast({
        title: 'Sucesso',
        description: 'Despesa registrada com sucesso.'
      });

      // Reset form
      setDescription('');
      setAmount('');
      setCategory('');
      setExpenseDate(format(new Date(), 'yyyy-MM-dd'));
      setReceiptFile(null);
      
      // Reload expenses
      loadExpenses();
    } catch (error) {
      console.error('Error registering expense:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível registrar a despesa.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Tipo de arquivo inválido',
          description: 'Aceitamos apenas JPG, PNG e PDF.',
          variant: 'destructive'
        });
        return;
      }

      if (file.size > maxSize) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O comprovante deve ter no máximo 5MB.',
          variant: 'destructive'
        });
        return;
      }

      setReceiptFile(file);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const raw = String(dateString || '');
    const d = raw ? new Date(raw) : new Date();
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  };

  const getTotalExpenses = () => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lançamento de Despesas</h1>
        <p className="text-muted-foreground">
          Registre e acompanhe suas despesas mensais
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expense Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Despesa
            </CardTitle>
            <CardDescription>
              Preencha os dados da despesa abaixo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Compra de ingredientes para pizza"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$) *</Label>
                  <Input
                    id="amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/-/g, '').replace(/[^\d,.-]/g, ''))}
                    placeholder="0,00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenseDate">Data *</Label>
                  <Input
                    id="expenseDate"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={category} onValueChange={setCategory} required>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt">Comprovante (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="receipt"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  {receiptFile && (
                    <Badge variant="secondary">
                      {receiptFile.name}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Aceita JPG, PNG e PDF (máx. 5MB)
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Registrando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Despesa
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Resumo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total de despesas:</span>
              <span className="text-2xl font-bold">{formatCurrency(getTotalExpenses())}</span>
            </div>
            
            <div className="grid gap-2">
              {EXPENSE_CATEGORIES.map(cat => {
                const categoryTotal = filteredExpenses
                  .filter(exp => exp.category === cat)
                  .reduce((sum, exp) => sum + exp.amount, 0);
                
                if (categoryTotal === 0) return null;
                
                return (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="capitalize">{cat}:</span>
                    <span>{formatCurrency(categoryTotal)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium">Mostrar estornadas</div>
            <Switch checked={showReversed} onCheckedChange={setShowReversed} />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="searchExpenses">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="searchExpenses"
                  placeholder="Descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filterCategory">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="filterCategory">
                  <SelectValue placeholder="Todas categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas categorias</SelectItem>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">De</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Até</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Despesas ({filteredExpenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma despesa encontrada</p>
              <p className="text-sm mt-1">Tente ajustar os filtros ou registrar uma nova despesa</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Comprovante</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>
                        {expense.receipt_url ? (
                          <Button variant="outline" size="sm" asChild>
                            <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                              <Upload className="h-3 w-3 mr-1" />
                              Ver
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {expense.is_active === false ? (
                          <Badge variant="secondary">Estornado</Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => reverseExpense(expense)}>
                            <Undo2 className="h-3 w-3 mr-1" />
                            Estornar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
