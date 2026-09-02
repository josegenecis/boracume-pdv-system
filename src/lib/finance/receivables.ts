export type ReceivableStatus =
  | 'pending'
  | 'received'
  | 'partially_received'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export interface ReceivableRow {
  id: string;
  sourceId: string;
  sourceKind: 'sale' | 'account';
  date: string;
  saleNumber: string;
  customer: string;
  origin: string;
  category: string;
  paymentMethod: string;
  amount: number;
  dueDate: string | null;
  receivedAt: string | null;
  status: ReceivableStatus;
  operator: string;
}

const amount = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: unknown) => String(value || '').trim();

export const normalizePaymentMethod = (value: unknown) => {
  const normalized = text(value).toLocaleLowerCase('pt-BR');
  if (normalized.includes('pix')) return 'PIX';
  if (normalized.includes('dinheiro')) return 'DINHEIRO';
  if (normalized.includes('debito') || normalized.includes('débito')) return 'DÉBITO';
  if (normalized.includes('credito') || normalized.includes('crédito')) return 'CRÉDITO';
  if (normalized.includes('boleto')) return 'BOLETO';
  if (normalized.includes('transfer')) return 'TRANSFERÊNCIA';
  if (normalized.includes('voucher')) return 'OUTROS';
  if (normalized.includes('pagar_depois') || normalized.includes('receber')) return 'A DEFINIR';
  if (normalized.includes('cart')) return 'CARTÃO';
  return normalized ? normalized.toLocaleUpperCase('pt-BR') : 'NÃO INFORMADO';
};

export const orderOrigin = (order: any) => {
  const source = text(order?.source || order?.variations?.source).toLocaleUpperCase('pt-BR');
  if (source.includes('IFOOD')) return 'iFood';
  if (source.includes('WHATS')) return 'WhatsApp';
  if (source.includes('TOTEM')) return 'Totem';
  if (source.includes('CARDAP') || source.includes('MENU')) return 'Cardápio Digital';
  if (source.includes('PDV')) return 'PDV';
  if (order?.table_id || ['dine_in', 'mesa', 'table'].includes(text(order?.order_type).toLowerCase())) return 'Mesa';
  if (text(order?.order_type).toLowerCase() === 'delivery') return 'Delivery';
  return source || 'Venda manual';
};

export const orderPaymentLines = (order: any) => {
  const split = order?.variations?.payment_split?.lines;
  if (Array.isArray(split)) {
    const lines = split
      .map((line: any) => ({ method: text(line?.method), amount: amount(line?.amount) }))
      .filter((line: { method: string; amount: number }) => line.method && line.amount > 0);
    if (lines.length > 0) return lines;
  }
  return [{ method: text(order?.payment_method), amount: amount(order?.total) }];
};

const saleStatus = (order: any): ReceivableStatus => {
  const status = text(order?.status).toLowerCase();
  const acceptance = text(order?.acceptance_status).toLowerCase();
  const refundStatus = text(order?.financial_cancellation?.refund_status || order?.variations?.refund_status).toLowerCase();
  if (status === 'cancelled' && ['completed', 'refunded', 'approved'].includes(refundStatus)) return 'refunded';
  if (status === 'cancelled') return 'cancelled';
  if (acceptance === 'awaiting_pix_payment' || ['pending', 'awaiting_payment'].includes(status)) return 'pending';
  return 'received';
};

export const expandOrderReceivables = (order: any): ReceivableRow[] => {
  const method = text(order?.payment_method).toLowerCase();
  // O reflexo financeiro de "pagar depois" vem da conta vinculada, evitando
  // duplicar a venda e a obrigação na mesma lista.
  if (method.includes('pagar_depois')) return [];
  const status = saleStatus(order);
  const createdAt = text(order?.created_at) || new Date(0).toISOString();
  const receivedAt = status === 'received' ? text(order?.updated_at || order?.created_at) : null;
  return orderPaymentLines(order).map((line, index) => ({
    id: `sale:${order.id}:${index}`,
    sourceId: text(order?.id),
    sourceKind: 'sale',
    date: createdAt,
    saleNumber: text(order?.order_number) || `#${text(order?.id).slice(0, 8)}`,
    customer: text(order?.customer_name) || 'Cliente não informado',
    origin: orderOrigin(order),
    category: 'Vendas',
    paymentMethod: normalizePaymentMethod(line.method),
    amount: line.amount,
    dueDate: createdAt.slice(0, 10) || null,
    receivedAt,
    status,
    operator: text(order?.variations?.operator?.name || order?.waiter_name) || 'Sistema',
  }));
};

export const receivableAccountRow = (row: any): ReceivableRow => {
  const rawStatus = text(row?.status).toLowerCase();
  const dueDate = text(row?.due_date) || null;
  const today = new Date().toISOString().slice(0, 10);
  const status: ReceivableStatus = rawStatus === 'paid'
    ? 'received'
    : rawStatus === 'partially_paid'
      ? 'partially_received'
      : rawStatus === 'cancelled'
        ? 'cancelled'
        : dueDate && dueDate < today
          ? 'overdue'
          : 'pending';
  return {
    id: `account:${row.id}`,
    sourceId: text(row?.id),
    sourceKind: 'account',
    date: text(row?.created_at) || new Date(0).toISOString(),
    saleNumber: text(row?.order_number || row?.source_order_number) || 'Conta manual',
    customer: text(row?.employee_name) || 'Cliente não informado',
    origin: text(row?.source_type) === 'pdv' ? 'PDV' : text(row?.source_type) === 'table' ? 'Mesa' : 'Venda manual',
    category: 'Contas a receber',
    paymentMethod: normalizePaymentMethod(row?.payment_method),
    amount: amount(row?.amount),
    dueDate,
    receivedAt: text(row?.paid_at) || null,
    status,
    operator: text(row?.responsible_name) || 'Sistema',
  };
};

export const summarizeReceivables = (rows: ReceivableRow[]) => rows.reduce((summary, row) => {
  summary.total += row.amount;
  if (row.status === 'received') summary.received += row.amount;
  if (row.status === 'pending' || row.status === 'partially_received') summary.pending += row.amount;
  if (row.status === 'overdue') summary.overdue += row.amount;
  return summary;
}, { total: 0, received: 0, pending: 0, overdue: 0 });
