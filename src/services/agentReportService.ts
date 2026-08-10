/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

export type AgentReportType = 'sales' | 'products' | 'cmv' | 'payments';

export interface AgentReportPeriod {
  from: Date;
  to: Date;
}

export interface AgentReportRow {
  productId: string | null;
  name: string;
  unit: 'un' | 'kg';
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number | null;
  margin: number | null;
  orders: number;
  hasCompleteCost: boolean;
}

export interface AgentReportData {
  restaurantName: string;
  period: AgentReportPeriod;
  totalSales: number;
  totalOrders: number;
  averageTicket: number;
  unitItemsSold: number;
  weightSoldKg: number;
  knownCost: number;
  knownGrossProfit: number;
  costCoverage: number;
  products: AgentReportRow[];
  salesByDay: Array<{ date: string; sales: number; orders: number }>;
  salesByCategory: Array<{ category: string; value: number }>;
  payments: Array<{ method: string; value: number }>;
}

const validStatuses = ['accepted', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'completed'];
const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const quantity = (value: number, unit: 'un' | 'kg') => unit === 'kg'
  ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
  : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} un`;

const paymentLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: 'Dinheiro', dinheiro: 'Dinheiro', pix: 'PIX', pix_online: 'PIX online',
    credit: 'Crédito', credito: 'Crédito', credit_card: 'Crédito',
    debit: 'Débito', debito: 'Débito', debit_card: 'Débito',
    meal_voucher: 'Vale-refeição', voucher: 'Vale', pending: 'Pendente', pendente: 'Pendente',
  };
  const normalized = String(method || 'Não informado').trim().toLowerCase();
  return labels[normalized] || normalized.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
};

const getPaymentLines = (order: any) => {
  const lines = order?.variations?.payment_split?.lines;
  if (Array.isArray(lines) && lines.length) {
    return lines.map((line: any) => ({ method: String(line?.method || line?.label || ''), amount: numberValue(line?.amount) }));
  }
  return [{ method: String(order?.payment_method || ''), amount: numberValue(order?.total) }];
};

export async function fetchAgentReportData(userId: string, period: AgentReportPeriod): Promise<AgentReportData> {
  const from = new Date(period.from); from.setHours(0, 0, 0, 0);
  const to = new Date(period.to); to.setHours(23, 59, 59, 999);
  const orders: any[] = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId)
      .gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
      .in('status', validStatuses).order('created_at', { ascending: true }).range(start, start + pageSize - 1);
    if (error) throw error;
    orders.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  const [{ data: products, error: productsError }, { data: profile }] = await Promise.all([
    supabase.from('products').select('*').eq('user_id', userId),
    supabase.from('profiles').select('restaurant_name').eq('id', userId).maybeSingle(),
  ]);
  if (productsError) throw productsError;

  const productMap = new Map((products || []).map((product: any) => [product.id, product]));
  const grouped = new Map<string, any>();
  const dayMap = new Map<string, { sales: number; orders: number }>();
  const categoryMap = new Map<string, number>();
  const paymentMap = new Map<string, number>();
  let coveredRevenue = 0;
  let knownCost = 0;

  for (const order of orders) {
    const date = format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR });
    const day = dayMap.get(date) || { sales: 0, orders: 0 };
    day.sales += numberValue(order.total); day.orders += 1; dayMap.set(date, day);
    getPaymentLines(order).forEach((line) => paymentMap.set(paymentLabel(line.method), (paymentMap.get(paymentLabel(line.method)) || 0) + line.amount));

    const items = Array.isArray(order.items) ? order.items : [];
    const snapshots = Array.isArray(order.cmv_snapshot?.items) ? order.cmv_snapshot.items : [];
    items.forEach((item: any, index: number) => {
      const productId = item.product_id || item.id || null;
      const product: any = productId ? productMap.get(productId) : null;
      const snapshot = snapshots.find((entry: any) => numberValue(entry.item_order) === index + 1)
        || snapshots.find((entry: any) => productId && entry.product_id === productId);
      const unit: 'un' | 'kg' = snapshot?.sale_unit === 'kg' || item.sale_unit === 'kg' || (!snapshot?.sale_unit && !item.sale_unit && product?.weight_based) ? 'kg' : 'un';
      const itemQuantity = Math.max(0, numberValue(item.quantity || 1));
      const revenue = snapshot?.net_revenue != null ? numberValue(snapshot.net_revenue) : numberValue(item.subtotal ?? item.total_price ?? numberValue(item.price) * itemQuantity);
      const hasCost = typeof snapshot?.has_cost === 'boolean' ? snapshot.has_cost : snapshot != null && snapshot.has_recipe === true;
      const cost = hasCost ? numberValue(snapshot?.total_cost) : 0;
      const name = product?.name || item.product_name || item.name || 'Produto';
      const key = `${productId || name}::${unit}`;
      const current = grouped.get(key) || { productId, name, unit, quantity: 0, revenue: 0, cost: 0, orderIds: new Set<string>(), missingCost: false };
      current.quantity += itemQuantity; current.revenue += revenue; current.cost += cost;
      current.orderIds.add(order.id); current.missingCost ||= !hasCost; grouped.set(key, current);
      if (hasCost) { coveredRevenue += revenue; knownCost += cost; }
      const category = product?.category || 'Sem categoria';
      categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
    });
  }

  const productRows: AgentReportRow[] = Array.from(grouped.values()).map((row) => {
    const complete = !row.missingCost;
    const grossProfit = complete ? row.revenue - row.cost : null;
    return { productId: row.productId, name: row.name, unit: row.unit, quantity: row.quantity, revenue: row.revenue, cost: row.cost,
      grossProfit, margin: complete && row.revenue > 0 ? (grossProfit / row.revenue) * 100 : null,
      orders: row.orderIds.size, hasCompleteCost: complete };
  }).sort((a, b) => b.revenue - a.revenue);
  const totalSales = orders.reduce((sum, order) => sum + numberValue(order.total), 0);
  const productRevenue = productRows.reduce((sum, row) => sum + row.revenue, 0);

  return {
    restaurantName: String((profile as any)?.restaurant_name || 'Restaurante'), period: { from, to }, totalSales,
    totalOrders: orders.length, averageTicket: orders.length ? totalSales / orders.length : 0,
    unitItemsSold: productRows.filter(row => row.unit === 'un').reduce((sum, row) => sum + row.quantity, 0),
    weightSoldKg: productRows.filter(row => row.unit === 'kg').reduce((sum, row) => sum + row.quantity, 0),
    knownCost, knownGrossProfit: coveredRevenue - knownCost, costCoverage: productRevenue ? coveredRevenue / productRevenue * 100 : 0,
    products: productRows, salesByDay: Array.from(dayMap, ([date, values]) => ({ date, ...values })),
    salesByCategory: Array.from(categoryMap, ([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value),
    payments: Array.from(paymentMap, ([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value),
  };
}

export const agentReportTitles: Record<AgentReportType, string> = {
  sales: 'Resumo de vendas', products: 'Produtos vendidos', cmv: 'CMV e lucro bruto', payments: 'Formas de pagamento',
};

export function buildAgentReportPdf(data: AgentReportData, type: AgentReportType): { blob: Blob; filename: string } {
  const landscape = type === 'products' || type === 'cmv';
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const green: [number, number, number] = [0, 82, 58];
  const lightGreen: [number, number, number] = [235, 247, 241];
  doc.setFillColor(...green); doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('PopSystem', 14, 14); doc.setFontSize(13); doc.text(agentReportTitles[type], 14, 24);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(data.restaurantName, pageWidth - 14, 14, { align: 'right' });
  doc.text(`${format(data.period.from, 'dd/MM/yyyy')} a ${format(data.period.to, 'dd/MM/yyyy')}`, pageWidth - 14, 22, { align: 'right' });

  const cards = [
    ['Vendas', money(data.totalSales)], ['Pedidos', String(data.totalOrders)], ['Ticket médio', money(data.averageTicket)],
    type === 'cmv' ? ['CMV identificado', money(data.knownCost)] : ['Itens', quantity(data.unitItemsSold, 'un')],
  ];
  const gap = 4; const cardWidth = (pageWidth - 28 - gap * 3) / 4;
  cards.forEach(([label, value], index) => {
    const x = 14 + index * (cardWidth + gap);
    doc.setFillColor(...lightGreen); doc.roundedRect(x, 40, cardWidth, 20, 2, 2, 'F');
    doc.setTextColor(70, 90, 82); doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(label, x + 4, 47);
    doc.setTextColor(...green); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(value, x + 4, 55);
  });

  let head: string[][] = []; let body: Array<Array<string | number>> = [];
  if (type === 'sales') {
    head = [['Data', 'Pedidos', 'Vendas']];
    body = data.salesByDay.map(row => [row.date, row.orders, money(row.sales)]);
  } else if (type === 'payments') {
    head = [['Forma de pagamento', 'Valor', 'Participação']];
    body = data.payments.map(row => [row.method, money(row.value), data.totalSales ? `${(row.value / data.totalSales * 100).toFixed(1)}%` : '0%']);
  } else if (type === 'cmv') {
    head = [['Produto', 'Qtd.', 'Receita', 'CMV', 'Lucro bruto', 'Margem']];
    body = data.products.map(row => [row.name, quantity(row.quantity, row.unit), money(row.revenue), row.hasCompleteCost ? money(row.cost) : 'Pendente', row.grossProfit == null ? '—' : money(row.grossProfit), row.margin == null ? '—' : `${row.margin.toFixed(1)}%`]);
  } else {
    head = [['Produto', 'Unidade', 'Quantidade', 'Receita', 'Pedidos']];
    body = data.products.map(row => [row.name, row.unit.toUpperCase(), quantity(row.quantity, row.unit), money(row.revenue), row.orders]);
  }
  autoTable(doc, { startY: 67, head, body: body.length ? body : [['Nenhum dado encontrado no período']], theme: 'grid',
    headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 250, 248] }, styles: { fontSize: 8, cellPadding: 2.6, textColor: [35, 55, 48] },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 115, 108);
      doc.text(`Gerado pelo Pop Agente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, pageHeight - 7);
      doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
    } });

  if (type === 'cmv') {
    const finalY = (doc as any).lastAutoTable?.finalY || 67;
    doc.setFontSize(8); doc.setTextColor(90, 105, 98);
    doc.text(`Cobertura de custo: ${data.costCoverage.toFixed(1)}%. Itens sem custo aparecem como pendentes e não geram lucro fictício.`, 14, Math.min(finalY + 7, doc.internal.pageSize.getHeight() - 14));
  }
  const filename = `popsystem-${type}-${format(data.period.from, 'dd-MM-yyyy')}-${format(data.period.to, 'dd-MM-yyyy')}.pdf`;
  return { blob: doc.output('blob'), filename };
}
