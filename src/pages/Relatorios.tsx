import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, TrendingUp, DollarSign, ShoppingCart, Package, BarChart3, Scale, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { PageHero } from '@/components/layout/PageHero';
import type { LucideIcon } from 'lucide-react';

type SaleUnit = 'un' | 'kg';

interface ProductSale {
  productId: string | null;
  name: string;
  unit: SaleUnit;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number | null;
  margin: number | null;
  orders: number;
  hasCompleteCost: boolean;
}

interface ReportData {
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  unitItemsSold: number;
  weightSoldKg: number;
  knownCost: number;
  knownGrossProfit: number;
  costCoverage: number;
  products: ProductSale[];
  salesByDay: Array<{ date: string; sales: number; orders: number }>;
  salesByCategory: Array<{ category: string; value: number }>;
}

interface ReportOrderItem {
  product_id?: string;
  id?: string;
  product_name?: string;
  name?: string;
  quantity?: number;
  price?: number;
  subtotal?: number;
  total_price?: number;
  sale_unit?: SaleUnit;
}

interface SnapshotItem {
  item_order?: number;
  product_id?: string;
  sale_unit?: SaleUnit;
  net_revenue?: number;
  total_cost?: number;
  has_cost?: boolean;
  has_recipe?: boolean;
}

interface ReportOrder {
  id: string;
  total: number;
  created_at: string;
  items?: ReportOrderItem[];
  cmv_snapshot?: { items?: SnapshotItem[] };
}

interface ReportProduct {
  id: string;
  name: string;
  category?: string | null;
  weight_based?: boolean | null;
}

const emptyReport: ReportData = {
  totalSales: 0,
  totalOrders: 0,
  averageTicket: 0,
  unitItemsSold: 0,
  weightSoldKg: 0,
  knownCost: 0,
  knownGrossProfit: 0,
  costCoverage: 0,
  products: [],
  salesByDay: [],
  salesByCategory: [],
};

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatQuantity = (value: number, unit: SaleUnit) =>
  unit === 'kg'
    ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
    : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un`;

const Relatorios = () => {
  const [reportData, setReportData] = useState<ReportData>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [showFromCalendar, setShowFromCalendar] = useState(false);
  const [showToCalendar, setShowToCalendar] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) void fetchReportData();
    // A consulta deve ser refeita somente quando a loja ou o período mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dateRange.from, dateRange.to]);

  const fetchReportData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const fromDate = dateRange.from.toISOString();
      const endDate = new Date(dateRange.to);
      endDate.setHours(23, 59, 59, 999);

      const orders: ReportOrder[] = [];
      const pageSize = 1000;
      for (let start = 0; ; start += pageSize) {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', fromDate)
          .lte('created_at', endDate.toISOString())
          .in('status', ['accepted', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed'])
          .order('created_at', { ascending: true })
          .range(start, start + pageSize - 1);
        if (error) throw error;
        orders.push(...((data || []) as unknown as ReportOrder[]));
        if (!data || data.length < pageSize) break;
      }

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id);
      if (productsError) throw productsError;

      const typedProducts = (products || []) as unknown as ReportProduct[];
      const productMap = new Map(typedProducts.map(product => [product.id, product]));
      const grouped = new Map<string, ProductSale & { orderIds: Set<string>; missingCost: boolean }>();
      const dayMap = new Map<string, { sales: number; orders: number }>();
      const categoryMap = new Map<string, number>();
      let coveredRevenue = 0;
      let knownCost = 0;

      for (const order of orders) {
        const date = format(new Date(order.created_at), 'dd/MM', { locale: ptBR });
        const day = dayMap.get(date) || { sales: 0, orders: 0 };
        day.sales += numberValue(order.total);
        day.orders += 1;
        dayMap.set(date, day);

        const items: ReportOrderItem[] = Array.isArray(order.items) ? order.items : [];
        const snapshotItems: SnapshotItem[] = Array.isArray(order.cmv_snapshot?.items) ? order.cmv_snapshot.items : [];

        items.forEach((item, index) => {
          const productId = item.product_id || item.id || null;
          const product = productId ? productMap.get(productId) : null;
          const snapshot = snapshotItems.find(entry => numberValue(entry.item_order) === index + 1)
            || snapshotItems.find(entry => Boolean(productId && entry.product_id === productId));
          const unit: SaleUnit = snapshot?.sale_unit === 'kg' || item.sale_unit === 'kg' || (!snapshot?.sale_unit && !item.sale_unit && product?.weight_based)
            ? 'kg'
            : 'un';
          const quantity = Math.max(0, numberValue(item.quantity || 1));
          const revenue = snapshot?.net_revenue != null
            ? numberValue(snapshot.net_revenue)
            : numberValue(item.subtotal ?? item.total_price ?? numberValue(item.price) * quantity);
          const hasCost = typeof snapshot?.has_cost === 'boolean'
            ? snapshot.has_cost
            : snapshot != null && snapshot.has_recipe === true;
          const cost = hasCost ? numberValue(snapshot?.total_cost) : 0;
          const name = product?.name || item.product_name || item.name || 'Produto';
          const key = `${productId || name}::${unit}`;
          const current = grouped.get(key) || {
            productId,
            name,
            unit,
            quantity: 0,
            revenue: 0,
            cost: 0,
            grossProfit: null,
            margin: null,
            orders: 0,
            hasCompleteCost: true,
            orderIds: new Set<string>(),
            missingCost: false,
          };
          current.quantity += quantity;
          current.revenue += revenue;
          current.cost += cost;
          current.orderIds.add(order.id);
          current.missingCost ||= !hasCost;
          grouped.set(key, current);

          if (hasCost) {
            coveredRevenue += revenue;
            knownCost += cost;
          }
          const category = product?.category || 'Sem categoria';
          categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
        });
      }

      const productRows = Array.from(grouped.values()).map((row) => {
        const complete = !row.missingCost;
        const grossProfit = complete ? row.revenue - row.cost : null;
        return {
          productId: row.productId,
          name: row.name,
          unit: row.unit,
          quantity: row.quantity,
          revenue: row.revenue,
          cost: row.cost,
          grossProfit,
          margin: complete && row.revenue > 0 ? (grossProfit! / row.revenue) * 100 : null,
          orders: row.orderIds.size,
          hasCompleteCost: complete,
        };
      }).sort((a, b) => b.revenue - a.revenue);

      const totalSales = orders.reduce((sum, order) => sum + numberValue(order.total), 0);
      const productRevenue = productRows.reduce((sum, row) => sum + row.revenue, 0);
      setReportData({
        totalSales,
        totalOrders: orders.length,
        averageTicket: orders.length ? totalSales / orders.length : 0,
        unitItemsSold: productRows.filter(row => row.unit === 'un').reduce((sum, row) => sum + row.quantity, 0),
        weightSoldKg: productRows.filter(row => row.unit === 'kg').reduce((sum, row) => sum + row.quantity, 0),
        knownCost,
        knownGrossProfit: coveredRevenue - knownCost,
        costCoverage: productRevenue > 0 ? (coveredRevenue / productRevenue) * 100 : 0,
        products: productRows,
        salesByDay: Array.from(dayMap, ([date, values]) => ({ date, ...values })),
        salesByCategory: Array.from(categoryMap, ([category, value]) => ({ category, value })),
      });
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      setReportData(emptyReport);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(value);

  const exportData = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Produto', 'Unidade', 'Quantidade', 'Receita líquida', 'CMV', 'Lucro bruto', 'Margem', 'Pedidos', 'Custo completo'],
      ...reportData.products.map(row => [
        row.name, row.unit, row.quantity.toFixed(row.unit === 'kg' ? 3 : 0), row.revenue.toFixed(2),
        row.hasCompleteCost ? row.cost.toFixed(2) : '', row.grossProfit?.toFixed(2) || '',
        row.margin?.toFixed(2) || '', row.orders, row.hasCompleteCost ? 'Sim' : 'Não',
      ]),
    ];
    const blob = new Blob([`\uFEFF${rows.map(row => row.map(escapeCsv).join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `produtos-${format(dateRange.from, 'dd-MM-yyyy')}-${format(dateRange.to, 'dd-MM-yyyy')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const COLORS = ['#0f7a55', '#84cc16', '#2563eb', '#f59e0b', '#8b5cf6', '#ef4444'];

  const summaryCards: Array<[string, string, LucideIcon]> = [
    ['Vendas totais', formatCurrency(reportData.totalSales), DollarSign],
    ['Pedidos', reportData.totalOrders.toLocaleString('pt-BR'), ShoppingCart],
    ['Ticket médio', formatCurrency(reportData.averageTicket), TrendingUp],
    ['Itens unitários', formatQuantity(reportData.unitItemsSold, 'un'), Package],
    ['Venda por peso', formatQuantity(reportData.weightSoldKg, 'kg'), Scale],
    ['CMV identificado', formatCurrency(reportData.knownCost), DollarSign],
    ['Lucro bruto identificado', formatCurrency(reportData.knownGrossProfit), TrendingUp],
  ];

  if (loading) return (
    <div className="space-y-5">
      <PageHero title="Análise de desempenho" description="Consolidando vendas, quantidades e custos." eyebrow="Relatórios" icon={BarChart3} />
      <div className="rounded-[28px] border bg-white py-16 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#003223]/15 border-t-[#0f7a55]" /></div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHero
        title="Análise de desempenho"
        description="Vendas por produto, separadas corretamente entre unidades e peso, com CMV e lucro bruto."
        eyebrow="Relatórios"
        icon={BarChart3}
        actions={<div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-black/10 p-1.5 shadow-inner backdrop-blur-sm">
          <Popover open={showFromCalendar} onOpenChange={setShowFromCalendar}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Selecionar data inicial"
                className="h-11 min-w-[154px] justify-start rounded-xl border-white/40 bg-white px-3 text-[#003223] shadow-sm hover:bg-[#f5fbf8] hover:text-[#003223]"
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-[#087A55]" />
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-[#003223]/50">De</span>
                <span className="font-bold tabular-nums">{format(dateRange.from, 'dd/MM/yyyy')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.from} onSelect={(date) => { if (date) { setDateRange(prev => ({ ...prev, from: date })); setShowFromCalendar(false); } }} locale={ptBR} /></PopoverContent>
          </Popover>
          <Popover open={showToCalendar} onOpenChange={setShowToCalendar}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Selecionar data final"
                className="h-11 min-w-[154px] justify-start rounded-xl border-white/40 bg-white px-3 text-[#003223] shadow-sm hover:bg-[#f5fbf8] hover:text-[#003223]"
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-[#087A55]" />
                <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-[#003223]/50">Até</span>
                <span className="font-bold tabular-nums">{format(dateRange.to, 'dd/MM/yyyy')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateRange.to} onSelect={(date) => { if (date) { setDateRange(prev => ({ ...prev, to: date })); setShowToCalendar(false); } }} locale={ptBR} /></PopoverContent>
          </Popover>
          <Button onClick={exportData} size="sm" className="h-11 rounded-xl bg-[#8bd229] px-5 font-bold text-[#003223] shadow-sm hover:bg-[#9be03c] hover:text-[#003223]"><Download className="mr-2 h-4 w-4" />Exportar</Button>
        </div>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(([label, value, Icon]) => (
          <Card key={label} className="group overflow-hidden rounded-[22px] border-[#003223]/8 bg-white shadow-[0_14px_35px_-28px_rgba(0,50,35,0.55)] transition-all hover:-translate-y-0.5 hover:border-[#087A55]/25 hover:shadow-[0_18px_40px_-26px_rgba(0,50,35,0.45)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
              <CardTitle className="text-sm font-semibold text-[#003223]/70">{label}</CardTitle>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9f6ef] text-[#087A55] transition-colors group-hover:bg-[#087A55] group-hover:text-white"><Icon className="h-4 w-4" /></span>
            </CardHeader>
            <CardContent className="pb-5"><div className="text-2xl font-extrabold tracking-tight text-[#003223]">{value}</div></CardContent>
          </Card>
        ))}
      </div>

      {reportData.costCoverage < 99.999 && reportData.products.length > 0 && (
        <div className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-gradient-to-r from-amber-50 to-[#fffdf5] p-4 text-sm text-amber-950 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100"><AlertTriangle className="h-5 w-5" /></span>
          <div><strong>Cobertura de custo: {reportData.costCoverage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%.</strong> Produtos sem ficha técnica ou custo direto aparecem como “Custo pendente” e não geram um lucro fictício.</div>
        </div>
      )}

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="h-12 rounded-2xl border border-[#003223]/8 bg-[#edf1ed] p-1"><TabsTrigger value="products" className="h-10 rounded-xl px-5 data-[state=active]:bg-white data-[state=active]:text-[#003223] data-[state=active]:shadow-sm">Produtos</TabsTrigger><TabsTrigger value="sales" className="h-10 rounded-xl px-5 data-[state=active]:bg-white data-[state=active]:text-[#003223] data-[state=active]:shadow-sm">Vendas</TabsTrigger><TabsTrigger value="categories" className="h-10 rounded-xl px-5 data-[state=active]:bg-white data-[state=active]:text-[#003223] data-[state=active]:shadow-sm">Categorias</TabsTrigger></TabsList>
        <TabsContent value="products" className="space-y-4">
          <Card className="overflow-hidden rounded-[24px] border-[#003223]/8 shadow-[0_18px_45px_-34px_rgba(0,50,35,0.45)]">
            <CardHeader className="border-b border-[#003223]/8 bg-[#fbfdfc]"><CardTitle className="text-2xl text-[#003223]">Resultado por produto</CardTitle><CardDescription>Receita líquida dos itens, custo congelado na venda, lucro bruto e margem.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="border-b border-[#003223]/10 text-left text-xs font-bold uppercase tracking-wide text-[#003223]/55"><th className="py-4">Produto</th><th className="py-4">Unidade</th><th className="py-4 text-right">Quantidade</th><th className="py-4 text-right">Receita</th><th className="py-4 text-right">CMV</th><th className="py-4 text-right">Lucro bruto</th><th className="py-4 text-right">Margem</th><th className="py-4 text-right">Pedidos</th></tr></thead>
                <tbody>{reportData.products.map(row => (
                  <tr key={`${row.productId || row.name}-${row.unit}`} className="border-b border-[#003223]/8 transition-colors last:border-0 hover:bg-[#f6fbf8]">
                    <td className="py-4 font-semibold text-[#003223]">{row.name}</td><td className="py-4"><span className="inline-flex rounded-lg bg-[#e9f6ef] px-2.5 py-1 text-xs font-bold uppercase text-[#087A55]">{row.unit}</span></td><td className="py-4 text-right font-semibold tabular-nums">{formatQuantity(row.quantity, row.unit)}</td><td className="py-4 text-right font-medium tabular-nums">{formatCurrency(row.revenue)}</td>
                    <td className="py-4 text-right">{row.hasCompleteCost ? formatCurrency(row.cost) : <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Custo pendente</span>}</td>
                    <td className="py-3 text-right font-semibold">{row.grossProfit == null ? '—' : formatCurrency(row.grossProfit)}</td><td className="py-3 text-right">{row.margin == null ? '—' : `${row.margin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</td><td className="py-3 text-right">{row.orders}</td>
                  </tr>
                ))}</tbody>
              </table>
              {!reportData.products.length && <div className="py-12 text-center text-muted-foreground">Nenhuma venda encontrada no período.</div>}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Produtos por receita</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={360}><BarChart data={reportData.products.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-35} textAnchor="end" height={100} fontSize={11} /><YAxis tickFormatter={value => formatCurrency(value)} /><Tooltip formatter={value => [formatCurrency(Number(value)), 'Receita']} /><Bar dataKey="revenue" fill="#0f7a55" /></BarChart></ResponsiveContainer></CardContent></Card>
        </TabsContent>
        <TabsContent value="sales"><Card><CardHeader><CardTitle>Vendas por dia</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={320}><LineChart data={reportData.salesByDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value, name) => [name === 'sales' ? formatCurrency(Number(value)) : value, name === 'sales' ? 'Receita' : 'Pedidos']} /><Line type="monotone" dataKey="sales" stroke="#0f7a55" strokeWidth={2} /><Line type="monotone" dataKey="orders" stroke="#84cc16" strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card></TabsContent>
        <TabsContent value="categories"><Card><CardHeader><CardTitle>Vendas por categoria</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={380}><PieChart><Pie data={reportData.salesByCategory} cx="50%" cy="50%" outerRadius={145} dataKey="value" nameKey="category" label={({ category, value }) => `${category}: ${formatCurrency(value)}`}>{reportData.salesByCategory.map((entry, index) => <Cell key={`${entry.category}-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={value => [formatCurrency(Number(value)), 'Receita']} /></PieChart></ResponsiveContainer></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
};

export default Relatorios;
