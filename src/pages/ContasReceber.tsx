import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Eye, RefreshCw, Search, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHero } from '@/components/layout/PageHero';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  expandOrderReceivables,
  receivableAccountRow,
  ReceivableRow,
  ReceivableStatus,
  summarizeReceivables,
} from '@/lib/finance/receivables';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateLabel = (value?: string | null) => value
  ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('pt-BR')
  : '—';

const STATUS_LABELS: Record<ReceivableStatus, string> = {
  pending: 'Pendente',
  received: 'Recebido',
  partially_received: 'Parcialmente recebido',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const statusClass: Record<ReceivableStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  received: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  partially_received: 'border-blue-200 bg-blue-50 text-blue-800',
  overdue: 'border-red-200 bg-red-50 text-red-800',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-700',
  refunded: 'border-violet-200 bg-violet-50 text-violet-800',
};

const periodRange = (days?: number) => {
  const end = new Date();
  const start = new Date();
  if (days) start.setDate(start.getDate() - (days - 1));
  else start.setDate(1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

export default function ContasReceber() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const initialRange = periodRange(30);
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(initialRange.start);
  const [dateTo, setDateTo] = useState(initialRange.end);
  const [status, setStatus] = useState('all');
  const [method, setMethod] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [category, setCategory] = useState('all');
  const [operator, setOperator] = useState('all');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [ordersResult, accountsResult, cancellationResult] = await Promise.all([
        (supabase as any).from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3000),
        (supabase as any).from('staff_consumptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3000),
        (supabase as any).from('finance_sale_cancellations').select('order_id,refund_status,refund_requested').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3000),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (accountsResult.error) throw accountsResult.error;

      const cancellationByOrder = new Map<string, any>();
      for (const audit of cancellationResult.data || []) {
        const id = String(audit.order_id || '');
        if (id && !cancellationByOrder.has(id)) cancellationByOrder.set(id, audit);
      }
      const orders = (ordersResult.data || []).map((order: any) => ({
        ...order,
        financial_cancellation: cancellationByOrder.get(String(order.id)) || null,
      }));
      const saleRows = orders.flatMap(expandOrderReceivables);
      const accountRows = (accountsResult.data || []).map(receivableAccountRow);
      setRows([...saleRows, ...accountRows].sort((a, b) => b.date.localeCompare(a.date)));
    } catch (error: any) {
      toast({ title: 'Não foi possível carregar as contas a receber', description: error?.message || 'Atualize a página e tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const origins = useMemo(() => [...new Set(rows.map((row) => row.origin))].sort(), [rows]);
  const methods = useMemo(() => [...new Set(rows.map((row) => row.paymentMethod))].sort(), [rows]);
  const operators = useMemo(() => [...new Set(rows.map((row) => row.operator))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const date = row.date.slice(0, 10);
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return (!dateFrom || date >= dateFrom)
      && (!dateTo || date <= dateTo)
      && (status === 'all' || row.status === status)
      && (method === 'all' || row.paymentMethod === method)
      && (origin === 'all' || row.origin === origin)
      && (category === 'all' || row.category === category)
      && (operator === 'all' || row.operator === operator)
      && (!needle || `${row.saleNumber} ${row.customer} ${row.origin} ${row.paymentMethod}`.toLocaleLowerCase('pt-BR').includes(needle));
  }), [category, dateFrom, dateTo, method, operator, origin, rows, search, status]);

  const summary = useMemo(() => summarizeReceivables(filtered), [filtered]);
  const setPreset = (days?: number) => {
    const range = periodRange(days);
    setDateFrom(range.start);
    setDateTo(range.end);
  };

  return (
    <div className="container mx-auto space-y-6 p-4 sm:p-6">
      <PageHero
        eyebrow="Financeiro"
        title="Contas a receber"
        description="Vendas recebidas e valores pendentes em uma única visão, sem duplicar pedidos."
        icon={WalletCards}
        actions={<Button className="border-white/20 bg-white/15 text-white hover:bg-white/25" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total do período', summary.total, WalletCards, 'text-slate-800'],
          ['Recebido', summary.received, TrendingUp, 'text-emerald-700'],
          ['Pendente', summary.pending, CalendarDays, 'text-amber-700'],
          ['Vencido', summary.overdue, TrendingDown, 'text-red-700'],
          ['Lançamentos', filtered.length, WalletCards, 'text-blue-700'],
        ].map(([label, value, Icon, color]) => (
          <Card key={String(label)}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label as string}</p><p className={`mt-2 text-xl font-black ${color}`}>{label === 'Lançamentos' ? String(value) : money.format(Number(value))}</p></div><Icon className={`h-5 w-5 ${color}`} /></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreset(1)}>Hoje</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(7)}>7 dias</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(30)}>30 dias</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset()}>Este mês</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 xl:col-span-2"><Label>Buscar</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pedido, cliente, origem..." /></div></div>
            <div className="space-y-1.5"><Label>De</Label><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Até</Label><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
            <FilterSelect label="Status" value={status} onChange={setStatus} options={Object.entries(STATUS_LABELS)} />
            <FilterSelect label="Forma de pagamento" value={method} onChange={setMethod} options={methods.map((value) => [value, value])} />
            <FilterSelect label="Origem" value={origin} onChange={setOrigin} options={origins.map((value) => [value, value])} />
            <FilterSelect label="Categoria" value={category} onChange={setCategory} options={['Vendas', 'Contas a receber'].map((value) => [value, value])} />
            <FilterSelect label="Caixa / operador" value={operator} onChange={setOperator} options={operators.map((value) => [value, value])} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recebíveis ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-12 text-center text-muted-foreground">Carregando movimentações...</div> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">Nenhum recebível encontrado para os filtros.</div> : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Venda / pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Origem</TableHead><TableHead>Forma</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead><TableHead>Recebimento</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>{filtered.map((row) => <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{dateLabel(row.date)}</TableCell>
                  <TableCell><div className="font-semibold">{row.saleNumber}</div><div className="text-xs text-muted-foreground">{row.category}</div></TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell><Badge variant="outline">{row.origin}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap">{row.paymentMethod}</TableCell>
                  <TableCell className="whitespace-nowrap font-bold">{money.format(row.amount)}</TableCell>
                  <TableCell>{dateLabel(row.dueDate)}</TableCell>
                  <TableCell>{dateLabel(row.receivedAt)}</TableCell>
                  <TableCell><Badge variant="outline" className={statusClass[row.status]}>{STATUS_LABELS[row.status]}</Badge></TableCell>
                  <TableCell className="text-right">{row.sourceKind === 'sale' ? <Button size="sm" variant="ghost" onClick={() => navigate('/pedidos')}><Eye className="mr-1.5 h-4 w-4" />Ver pedido</Button> : <span className="text-xs text-muted-foreground">Conta vinculada</span>}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{options.map(([optionValue, optionLabel]) => <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>)}</SelectContent></Select></div>;
}
