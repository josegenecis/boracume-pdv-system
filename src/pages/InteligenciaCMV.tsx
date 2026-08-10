import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarDays, PackageOpen, TrendingUp, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { buildCmvReport, type CmvReport } from '@/utils/cmvCalculations';

interface RecipeQueryRow {
  product_id: string;
  quantity: number | string | null;
  waste_percentage?: number | string | null;
  ingredient?: { cost_price?: number | string | null } | null;
}

interface OrderQueryRow {
  id: string;
  total: number;
  delivery_fee?: number | null;
  items: unknown;
  cmv_snapshot?: unknown;
}

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message
  : 'Não foi possível processar os custos deste período.';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value);

const formatQuantity = (value: number, unit: 'un' | 'kg') => `${new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: unit === 'kg' ? 3 : 0,
  maximumFractionDigits: 3,
}).format(value)} ${unit}`;

const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialDateRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: dateInputValue(from), to: dateInputValue(to) };
};

const emptyReport: CmvReport = {
  products: [],
  netRevenue: 0,
  realizedCmv: 0,
  grossContribution: 0,
  cmvPercentage: 0,
  ordersWithSnapshot: 0,
  totalOrders: 0,
};

const cmvBadgeClass = (cmv: number) => {
  if (cmv <= 0) return 'border-slate-200 bg-slate-50 text-slate-500';
  if (cmv <= 32) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (cmv <= 35) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
};

const abcBadgeClass = (abcClass: string) => {
  if (abcClass === 'A') return 'bg-emerald-700 text-white';
  if (abcClass === 'B') return 'bg-blue-600 text-white';
  if (abcClass === 'C') return 'bg-slate-500 text-white';
  return 'bg-slate-100 text-slate-500';
};

export default function InteligenciaCMV() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState(initialDateRange);
  const [report, setReport] = useState<CmvReport>(emptyReport);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const startDate = new Date(`${dateRange.from}T00:00:00`);
        const endDate = new Date(`${dateRange.to}T23:59:59.999`);
        if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || startDate > endDate) {
          throw new Error('Selecione um período válido.');
        }

        const [productsResult, recipesResult] = await Promise.all([
          supabase.from('products').select('id,name,price,weight_based,costing_mode,manual_unit_cost').eq('user_id', user.id).order('name'),
          // Generated database types are updated after the new migration is regenerated.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('product_recipes') as any)
            .select('product_id,quantity,waste_percentage,ingredient:ingredients(cost_price)'),
        ]);
        if (productsResult.error) throw productsResult.error;
        if (recipesResult.error) throw recipesResult.error;

        const orders: OrderQueryRow[] = [];
        const pageSize = 1000;
        for (let offset = 0; ; offset += pageSize) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (supabase.from('orders') as any)
            .select('id,total,delivery_fee,items,cmv_snapshot,created_at,status')
            .eq('user_id', user.id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .in('status', ['accepted', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed'])
            .order('created_at', { ascending: true })
            .range(offset, offset + pageSize - 1);
          if (result.error) throw result.error;
          const page = result.data || [];
          orders.push(...page);
          if (page.length < pageSize) break;
        }

        const nextReport = buildCmvReport(
          (productsResult.data || []).map(product => ({
            id: product.id,
            name: product.name,
            price: Number(product.price || 0),
            weight_based: Boolean(product.weight_based),
            costing_mode: product.costing_mode,
            manual_unit_cost: product.manual_unit_cost == null ? null : Number(product.manual_unit_cost),
          })),
          ((recipesResult.data || []) as RecipeQueryRow[]).map(recipe => ({
            product_id: String(recipe.product_id),
            quantity: Number(recipe.quantity || 0),
            waste_percentage: Number(recipe.waste_percentage || 0),
            ingredient: { cost_price: Number(recipe.ingredient?.cost_price || 0) },
          })),
          orders,
        );
        if (!cancelled) setReport(nextReport);
      } catch (error: unknown) {
        if (!cancelled) {
          setReport(emptyReport);
          toast({
            title: 'Erro ao calcular o CMV',
            description: errorMessage(error),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [dateRange.from, dateRange.to, toast, user?.id]);

  const snapshotCoverage = report.totalOrders > 0
    ? report.ordersWithSnapshot / report.totalOrders * 100
    : 100;
  const productsWithoutCost = report.products.filter(product => !product.hasCost).length;
  const alertProducts = report.products.filter(product => product.hasSales && product.cmvPercentage > 35).length;

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            <BarChart3 className="h-4 w-4" aria-hidden="true" /> Inteligência de custos
          </div>
          <h1 className="text-3xl font-black tracking-tight text-emerald-950">CMV e rentabilidade</h1>
          <p className="mt-1 text-sm text-slate-600">
            Compare o custo teórico da ficha com o custo registrado nas vendas reais.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <Label htmlFor="cmv-from" className="text-xs text-slate-500">De</Label>
            <Input id="cmv-from" type="date" value={dateRange.from} onChange={event => setDateRange(current => ({ ...current, from: event.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cmv-to" className="text-xs text-slate-500">Até</Label>
            <Input id="cmv-to" type="date" value={dateRange.to} onChange={event => setDateRange(current => ({ ...current, to: event.target.value }))} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do CMV">
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-950 to-emerald-700 text-white">
          <CardContent className="p-5">
            <WalletCards className="mb-4 h-6 w-6 text-emerald-200" aria-hidden="true" />
            <p className="text-sm text-emerald-100">Receita líquida dos produtos</p>
            <p className="mt-1 text-3xl font-black">{formatCurrency(report.netRevenue)}</p>
            <p className="mt-2 text-xs text-emerald-200">Frete excluído e descontos rateados nos itens.</p>
          </CardContent>
        </Card>
        <Card className="border-orange-100 bg-orange-50/60">
          <CardContent className="p-5">
            <PackageOpen className="mb-4 h-6 w-6 text-orange-600" aria-hidden="true" />
            <p className="text-sm text-slate-600">CMV realizado</p>
            <p className="mt-1 text-3xl font-black text-orange-700">{formatCurrency(report.realizedCmv)}</p>
            <Badge variant="outline" className={`mt-2 ${cmvBadgeClass(report.cmvPercentage)}`}>{report.cmvPercentage.toFixed(1)}% da receita</Badge>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/60">
          <CardContent className="p-5">
            <TrendingUp className="mb-4 h-6 w-6 text-emerald-700" aria-hidden="true" />
            <p className="text-sm text-slate-600">Margem bruta dos produtos</p>
            <p className={`mt-1 text-3xl font-black ${report.grossContribution >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{formatCurrency(report.grossContribution)}</p>
            <p className="mt-2 text-xs text-slate-500">Antes de despesas, impostos e taxas comerciais.</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardContent className="p-5">
            <CalendarDays className="mb-4 h-6 w-6 text-slate-600" aria-hidden="true" />
            <p className="text-sm text-slate-600">Pedidos analisados</p>
            <p className="mt-1 text-3xl font-black text-slate-800">{report.totalOrders}</p>
            <p className="mt-2 text-xs text-slate-500">{snapshotCoverage.toFixed(0)}% com custo histórico preservado.</p>
          </CardContent>
        </Card>
      </section>

      {(snapshotCoverage < 100 || productsWithoutCost > 0 || alertProducts > 0) ? (
        <section className="grid gap-3 lg:grid-cols-3" aria-label="Alertas de qualidade do CMV">
          {snapshotCoverage < 100 ? (
            <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <AlertTriangle className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
              <p><strong>Histórico em transição:</strong> pedidos anteriores à atualização usam o custo atual da ficha. As novas vendas ficam congeladas no custo do dia.</p>
            </div>
          ) : null}
          {productsWithoutCost > 0 ? (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <p><strong>{productsWithoutCost} produto(s) sem custo:</strong> cadastre uma ficha técnica ou informe o custo direto.</p>
            </div>
          ) : null}
          {alertProducts > 0 ? (
            <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <p><strong>{alertProducts} produto(s) acima de 35%:</strong> revise preço, porção, perda e custo de compra.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-slate-50/70">
          <CardTitle>Análise por produto</CardTitle>
          <CardDescription>
            A Curva ABC usa a participação real na receita do período. Nenhum dado é simulado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Produto</TableHead>
                  <TableHead>Curva</TableHead>
                  <TableHead className="text-right">Qtd. vendida</TableHead>
                  <TableHead className="text-right">Receita líquida</TableHead>
                  <TableHead className="text-right">Custo unitário atual</TableHead>
                  <TableHead className="text-right">Custo vendido</TableHead>
                  <TableHead className="text-right">Margem bruta</TableHead>
                  <TableHead className="pr-5 text-right">CMV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-slate-500">Calculando vendas e custos reais...</TableCell></TableRow>
                ) : report.products.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-slate-500">Nenhum produto encontrado.</TableCell></TableRow>
                ) : report.products.map(product => (
                  <TableRow key={product.key}>
                    <TableCell className="pl-5">
                      <div className="font-semibold text-emerald-950">{product.name}</div>
                      {product.costSource === 'recipe' ? <span className="text-xs font-medium text-emerald-700">Custo pela ficha técnica</span> : null}
                      {product.costSource === 'manual' ? <span className="text-xs font-medium text-blue-700">Custo direto informado</span> : null}
                      {!product.hasCost ? <span className="text-xs font-medium text-amber-600">Custo pendente</span> : null}
                    </TableCell>
                    <TableCell><Badge className={abcBadgeClass(product.abcClass)}>Curva {product.abcClass}</Badge></TableCell>
                    <TableCell className="text-right">{product.hasSales ? formatQuantity(product.quantitySold, product.saleUnit) : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{product.hasSales ? formatCurrency(product.netRevenue) : '—'}</TableCell>
                    <TableCell className="text-right">{product.hasCost ? `${formatCurrency(product.theoreticalUnitCost)}/${product.saleUnit}` : '—'}</TableCell>
                    <TableCell className="text-right text-orange-700">{product.hasSales ? formatCurrency(product.realizedCost) : '—'}</TableCell>
                    <TableCell className={`text-right font-semibold ${product.grossContribution >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{product.hasSales ? formatCurrency(product.grossContribution) : '—'}</TableCell>
                    <TableCell className="pr-5 text-right"><Badge variant="outline" className={cmvBadgeClass(product.cmvPercentage)}>{product.cmvPercentage > 0 ? `${product.cmvPercentage.toFixed(1)}%` : '—'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
