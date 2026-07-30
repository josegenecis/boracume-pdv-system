import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, DollarSign, Upload, FileText, Search, Undo2, Sparkles, PackageCheck, Tags, ListFilter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CurrencyTextInput } from '@/components/ui/currency-text-input';
import { parseBRL } from '@/lib/currency';
import { useLocation } from 'react-router-dom';
import { friendlyErrorMessage } from '@/lib/friendly-error';
import { ReverseExpenseDialog } from '@/components/finance/ReverseExpenseDialog';

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
  reversed_by_waiter_id?: string | null;
  reversed_by_name?: string | null;
}

interface SmartInvoiceItem {
  id?: string;
  description: string;
  normalized_name: string;
  category: string;
  subcategory?: string | null;
  quantity: number;
  unit: string;
  stock_unit: string;
  unit_price: number;
  total_price: number;
  confidence: number;
  similar_to?: string | null;
  control_stock: boolean;
}

interface SmartInvoiceImport {
  id: string;
  supplier_name?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  total_amount: number;
  expense_category: string;
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
  const location = useLocation();
  const smartInvoiceRef = useRef<HTMLDivElement | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expenseToReverse, setExpenseToReverse] = useState<Expense | null>(null);
  
  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [smartInvoiceFile, setSmartInvoiceFile] = useState<File | null>(null);
  const [smartInvoiceImport, setSmartInvoiceImport] = useState<SmartInvoiceImport | null>(null);
  const [smartInvoiceItems, setSmartInvoiceItems] = useState<SmartInvoiceItem[]>([]);
  const [smartInvoiceLoading, setSmartInvoiceLoading] = useState(false);
  const [smartInvoiceCommitting, setSmartInvoiceCommitting] = useState(false);
  const [smartLaunchExpense, setSmartLaunchExpense] = useState(true);
  const [smartLaunchStock, setSmartLaunchStock] = useState(true);

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
  }, [expenses, searchTerm, selectedCategory, dateFrom, dateTo]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('smartInvoice') !== '1') return;

    window.setTimeout(() => {
      smartInvoiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, [location.search]);

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
    let filtered = expenses.filter((exp) => exp.is_active !== false);

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

  const reverseExpense = async (pin: string, reason: string) => {
    if (!expenseToReverse) return false;
    try {
      if (!user?.id) return false;
      const { error } = await (supabase as any).rpc('reverse_expense_authorized', {
        p_expense_id: expenseToReverse.id,
        p_reason: reason,
        p_admin_pin: pin,
      });

      if (error) {
        toast({
          title: 'Erro ao estornar',
          description: friendlyErrorMessage(error, 'Não foi possível estornar esta despesa.'),
          variant: 'destructive'
        });
        return false;
      }

      toast({
        title: 'Despesa estornada',
        description: 'O lançamento saiu dos totais e foi preservado no histórico de estornos.'
      });
      setExpenseToReverse(null);
      await loadExpenses();
      return true;
    } catch (err: any) {
      toast({
        title: 'Erro ao estornar',
        description: friendlyErrorMessage(err, 'Não foi possível estornar esta despesa.'),
        variant: 'destructive'
      });
      return false;
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
    const amountValue = parseBRL(amount);
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

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleSmartInvoiceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const maxSize = 8 * 1024 * 1024;
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Arquivo inválido',
        description: 'Envie imagem JPG/PNG ou PDF da nota.',
        variant: 'destructive'
      });
      return;
    }
    if (file.size > maxSize) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A nota deve ter no máximo 8MB.',
        variant: 'destructive'
      });
      return;
    }
    setSmartInvoiceFile(file);
    setSmartInvoiceImport(null);
    setSmartInvoiceItems([]);
  };

  const analyzeSmartInvoice = async () => {
    if (!smartInvoiceFile) {
      toast({
        title: 'Selecione a nota',
        description: 'Envie uma imagem ou PDF para a IA processar.',
        variant: 'destructive'
      });
      return;
    }

    setSmartInvoiceLoading(true);
    try {
      const fileBase64 = await fileToBase64(smartInvoiceFile);
      const { data, error } = await supabase.functions.invoke('smart-invoice-import', {
        body: {
          operation: 'analyze',
          fileBase64,
          mimeType: smartInvoiceFile.type
        }
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));

      setSmartInvoiceImport((data as any).import);
      setSmartInvoiceItems(((data as any).items || []).map((item: any) => ({
        ...item,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        total_price: Number(item.total_price || 0),
        confidence: Number(item.confidence || 0),
        control_stock: item.control_stock !== false
      })));
      toast({
        title: 'Nota processada',
        description: 'Confira os itens antes de lançar no financeiro e estoque.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao processar nota',
        description: error?.message || 'A IA não conseguiu ler essa nota.',
        variant: 'destructive'
      });
    } finally {
      setSmartInvoiceLoading(false);
    }
  };

  const updateSmartInvoiceItem = (index: number, patch: Partial<SmartInvoiceItem>) => {
    setSmartInvoiceItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...patch };
      if (patch.quantity !== undefined || patch.unit_price !== undefined) {
        next.total_price = Number(next.quantity || 0) * Number(next.unit_price || 0);
      }
      return next;
    }));
  };

  const commitSmartInvoice = async () => {
    if (!smartInvoiceImport?.id || smartInvoiceItems.length === 0) return;
    setSmartInvoiceCommitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-invoice-import', {
        body: {
          operation: 'commit',
          importId: smartInvoiceImport.id,
          launchExpense: smartLaunchExpense,
          launchStock: smartLaunchStock,
          items: smartInvoiceItems
        }
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      toast({
        title: 'Nota lançada',
        description: `Despesa e ${((data as any)?.stock || []).length} item(ns) de estoque processados.`
      });
      setSmartInvoiceFile(null);
      setSmartInvoiceImport(null);
      setSmartInvoiceItems([]);
      loadExpenses();
    } catch (error: any) {
      toast({
        title: 'Erro ao lançar nota',
        description: error?.message || 'Não foi possível concluir o lançamento.',
        variant: 'destructive'
      });
    } finally {
      setSmartInvoiceCommitting(false);
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

  const categorySummary = Object.values(
    filteredExpenses.reduce((acc, expense) => {
      const key = expense.category || 'outros';
      if (!acc[key]) {
        acc[key] = {
          category: key,
          total: 0,
          count: 0,
          lastDate: '',
          expenses: [] as Expense[],
        };
      }
      acc[key].total += Number(expense.amount || 0);
      acc[key].count += 1;
      acc[key].expenses.push(expense);
      const dateKey = getExpenseDateKey(expense);
      if (!acc[key].lastDate || dateKey > acc[key].lastDate) acc[key].lastDate = dateKey;
      return acc;
    }, {} as Record<string, { category: string; total: number; count: number; lastDate: string; expenses: Expense[] }>)
  ).sort((a, b) => b.total - a.total);

  const totalForCategoryShare = Math.max(getTotalExpenses(), 1);
  const smartInvoiceTotal = smartInvoiceItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const reversedExpenses = expenses
    .filter((expense) => expense.is_active === false)
    .filter((expense) => !searchTerm || expense.description.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((expense) => !selectedCategory || expense.category === selectedCategory)
    .filter((expense) => !dateFrom || getExpenseDateKey(expense) >= dateFrom)
    .filter((expense) => !dateTo || getExpenseDateKey(expense) <= dateTo)
    .sort((a, b) => new Date(b.reversed_at || b.created_at).getTime() - new Date(a.reversed_at || a.created_at).getTime());

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

      <Card ref={smartInvoiceRef} className="border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-950">
            <Sparkles className="h-5 w-5 text-orange-600" />
            Nota inteligente para financeiro e estoque
          </CardTitle>
          <CardDescription>
            Envie uma nota fiscal, cupom ou recibo. A IA lê os itens, classifica por categoria/subcategoria e prepara o lançamento de despesa e estoque.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <Input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleSmartInvoiceFile}
              className="h-11 bg-white"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={analyzeSmartInvoice}
              disabled={smartInvoiceLoading || !smartInvoiceFile}
            >
              {smartInvoiceLoading ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-emerald-800" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Processar com IA
            </Button>
            <Button
              type="button"
              className="h-11 bg-emerald-800 hover:bg-emerald-900"
              onClick={commitSmartInvoice}
              disabled={smartInvoiceCommitting || !smartInvoiceImport || smartInvoiceItems.length === 0}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              {smartInvoiceCommitting ? 'Lançando...' : 'Lançar nota'}
            </Button>
          </div>

          {smartInvoiceFile && (
            <div className="text-sm text-slate-600">
              Arquivo selecionado: <span className="font-semibold">{smartInvoiceFile.name}</span>
            </div>
          )}

          {smartInvoiceImport && (
            <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-4">
              <div>
                <div className="text-xs uppercase text-slate-500">Fornecedor</div>
                <div className="font-semibold">{smartInvoiceImport.supplier_name || 'Não identificado'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Nota</div>
                <div className="font-semibold">{smartInvoiceImport.invoice_number || '-'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Data</div>
                <div className="font-semibold">{smartInvoiceImport.invoice_date ? formatDate(smartInvoiceImport.invoice_date) : '-'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Total lido</div>
                <div className="font-semibold">{formatCurrency(smartInvoiceTotal || Number(smartInvoiceImport.total_amount || 0))}</div>
              </div>
            </div>
          )}

          {smartInvoiceItems.length > 0 && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                  <div>
                    <div className="font-semibold text-emerald-950">Lançar no financeiro</div>
                    <div className="text-xs text-slate-500">Cria uma despesa com o total da nota.</div>
                  </div>
                  <Switch checked={smartLaunchExpense} onCheckedChange={setSmartLaunchExpense} />
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                  <div>
                    <div className="font-semibold text-emerald-950">Lançar no estoque</div>
                    <div className="text-xs text-slate-500">Cria/atualiza insumos e movimentações de entrada.</div>
                  </div>
                  <Switch checked={smartLaunchStock} onCheckedChange={setSmartLaunchStock} />
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Subcategoria</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Un</TableHead>
                      <TableHead>Custo un.</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Conf.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smartInvoiceItems.map((item, index) => (
                      <TableRow key={item.id || index}>
                        <TableCell className="min-w-[220px]">
                          <Input
                            value={item.normalized_name}
                            onChange={(event) => updateSmartInvoiceItem(index, { normalized_name: event.target.value })}
                            className="h-9"
                          />
                          <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                          {item.similar_to && <div className="text-xs text-emerald-700">Parecido com: {item.similar_to}</div>}
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <Input value={item.category} onChange={(event) => updateSmartInvoiceItem(index, { category: event.target.value })} className="h-9" />
                        </TableCell>
                        <TableCell className="min-w-[160px]">
                          <Input value={item.subcategory || ''} onChange={(event) => updateSmartInvoiceItem(index, { subcategory: event.target.value })} className="h-9" />
                        </TableCell>
                        <TableCell className="min-w-[110px]">
                          <Input
                            type="number"
                            step="0.001"
                            value={item.quantity}
                            onChange={(event) => updateSmartInvoiceItem(index, { quantity: Number(event.target.value || 0) })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="min-w-[100px]">
                          <Select value={item.stock_unit || item.unit || 'un'} onValueChange={(value) => updateSmartInvoiceItem(index, { stock_unit: value, unit: value })}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['un', 'kg', 'g', 'l', 'ml'].map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(event) => updateSmartInvoiceItem(index, { unit_price: Number(event.target.value || 0) })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(Number(item.total_price || 0))}</TableCell>
                        <TableCell>
                          <Switch checked={item.control_stock} onCheckedChange={(checked) => updateSmartInvoiceItem(index, { control_stock: checked })} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.confidence >= 0.8 ? 'default' : 'secondary'}>
                            {Math.round(Number(item.confidence || 0) * 100)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <CurrencyTextInput
                      id="amount"
                      value={amount}
                      onValueChange={setAmount}
                      placeholder="R$ 0,00"
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
              <Select value={selectedCategory || 'all'} onValueChange={(val) => setSelectedCategory(val === 'all' ? '' : val)}>
                <SelectTrigger id="filterCategory">
                  <SelectValue placeholder="Todas categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
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

      <Tabs defaultValue="lancamentos" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="lancamentos" className="gap-2">
            <FileText className="h-4 w-4" />
            Lançamentos
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-2">
            <Tags className="h-4 w-4" />
            Por categoria
          </TabsTrigger>
          <TabsTrigger value="estornos" className="gap-2">
            <Undo2 className="h-4 w-4" />
            Histórico de estornos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos">
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
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setExpenseToReverse(expense)}>
                              <Undo2 className="h-3 w-3 mr-1" />
                              Estornar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListFilter className="h-5 w-5" />
                Despesas por categoria
              </CardTitle>
              <CardDescription>
                Os mesmos filtros acima controlam esta visão, facilitando a conferência por período.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categorySummary.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tags className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma categoria encontrada no período.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {categorySummary.map((item) => {
                    const percentage = Math.round((item.total / totalForCategoryShare) * 100);
                    return (
                      <div key={item.category} className="rounded-2xl border bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className="capitalize">{item.category}</Badge>
                              <span className="text-sm text-muted-foreground">{item.count} lançamento(s)</span>
                            </div>
                            <div className="mt-2 text-2xl font-bold">{formatCurrency(item.total)}</div>
                            <div className="text-xs text-muted-foreground">
                              {percentage}% do total filtrado
                              {item.lastDate ? ` - último lançamento em ${formatDate(item.lastDate)}` : ''}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSelectedCategory(item.category)}
                          >
                            Filtrar categoria
                          </Button>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.min(percentage, 100)}%` }} />
                        </div>
                        <div className="mt-4 grid gap-2">
                          {item.expenses.slice(0, 4).map((expense) => (
                            <div key={expense.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                              <span className="truncate pr-4">{expense.description}</span>
                              <span className="whitespace-nowrap font-semibold">{formatCurrency(expense.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estornos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Undo2 className="h-5 w-5" />
                Histórico de estornos ({reversedExpenses.length})
              </CardTitle>
              <CardDescription>
                Registro permanente de despesas retiradas dos totais, com motivo, responsável e horário.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reversedExpenses.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-10 text-center text-muted-foreground">
                  <PackageCheck className="mx-auto mb-2 h-10 w-10 opacity-50" />
                  <p>Nenhum estorno encontrado para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Despesa original</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Estornada em</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reversedExpenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            <div className="font-medium">{expense.description}</div>
                            <div className="text-xs text-muted-foreground">
                              Lançada em {formatDate(getExpenseDateKey(expense))}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(expense.amount)}</TableCell>
                          <TableCell>
                            {expense.reversed_at
                              ? format(new Date(expense.reversed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : 'Data não registrada'}
                          </TableCell>
                          <TableCell>{expense.reversed_by_name || 'Administrador'}</TableCell>
                          <TableCell className="max-w-[360px] whitespace-normal">
                            {expense.reversal_reason || 'Motivo não registrado em lançamento antigo'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReverseExpenseDialog
        open={Boolean(expenseToReverse)}
        description={expenseToReverse?.description}
        amountLabel={expenseToReverse ? formatCurrency(expenseToReverse.amount) : undefined}
        onCancel={() => setExpenseToReverse(null)}
        onConfirm={reverseExpense}
      />
    </div>
  );
}
