import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandOrderReceivables,
  normalizePaymentMethod,
  orderPaymentLines,
  orderOrigin,
  receivableAccountRow,
  summarizeReceivables,
} from '../src/lib/finance/receivables';
import {
  convertedStockQuantity,
  invoiceItemNeedsUnitConfirmation,
  normalizePurchaseUnit,
} from '../src/lib/finance/purchaseInvoice';
import {
  catalogSimilarity,
  findBestCatalogMatch,
} from '../supabase/functions/_shared/catalogMatching';

const sale = (patch: Record<string, unknown> = {}) => ({
  id: 'sale-1', order_number: 'PED123', created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-02T10:05:00Z', customer_name: 'João', total: 200,
  payment_method: 'pix', status: 'completed', acceptance_status: 'accepted',
  variations: { source: 'PDV' }, ...patch,
});

test('normaliza unidades da nota sem perder embalagens', () => {
  assert.equal(normalizePurchaseUnit('KG'), 'kg');
  assert.equal(normalizePurchaseUnit('Caixa'), 'cx');
  assert.equal(normalizePurchaseUnit('PCT'), 'pct');
  assert.equal(normalizePurchaseUnit('Fardo'), 'fd');
  assert.equal(normalizePurchaseUnit('unidade inventada'), null);
});

test('conversão CX para UN preserva quantidade fracionada', () => {
  assert.equal(convertedStockQuantity(1, 12), 12);
  assert.equal(convertedStockQuantity(2.5, 10), 25);
});

test('produto sem unidade segura exige confirmação somente se movimentar estoque', () => {
  assert.equal(invoiceItemNeedsUnitConfirmation({ control_stock: true, unit_confirmed: false, unit_source: 'unknown', confidence: 0.5 }), true);
  assert.equal(invoiceItemNeedsUnitConfirmation({ control_stock: false, unit_confirmed: false, unit_source: 'unknown', confidence: 0.5 }), false);
  assert.equal(invoiceItemNeedsUnitConfirmation({ control_stock: true, unit_confirmed: true, unit_source: 'confirmed', confidence: 1 }), false);
});

test('venda do PDV gera recebível financeiro recebido', () => {
  const rows = expandOrderReceivables(sale());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].origin, 'PDV');
  assert.equal(rows[0].status, 'received');
  assert.equal(rows[0].paymentMethod, 'PIX');
});

test('delivery e iFood mantêm origem operacional', () => {
  assert.equal(orderOrigin(sale({ order_type: 'delivery', variations: {} })), 'Delivery');
  assert.equal(orderOrigin(sale({ source: 'IFOOD' })), 'iFood');
});

test('pagamento dividido vira três liquidações da mesma venda', () => {
  const rows = expandOrderReceivables(sale({
    variations: { source: 'PDV', payment_split: { lines: [
      { method: 'pix', amount: 80 }, { method: 'cartao_credito', amount: 70 }, { method: 'dinheiro', amount: 50 },
    ] } },
  }));
  assert.deepEqual(rows.map((row) => row.amount), [80, 70, 50]);
  assert.equal(new Set(rows.map((row) => row.sourceId)).size, 1);
});

test('venda aguardando PIX permanece pendente', () => {
  const [row] = expandOrderReceivables(sale({ status: 'pending', acceptance_status: 'awaiting_pix_payment' }));
  assert.equal(row.status, 'pending');
});

test('venda cancelada e reembolso confirmado têm status distintos', () => {
  assert.equal(expandOrderReceivables(sale({ status: 'cancelled' }))[0].status, 'cancelled');
  assert.equal(expandOrderReceivables(sale({ status: 'cancelled', financial_cancellation: { refund_status: 'completed' } }))[0].status, 'refunded');
});

test('pagar depois não duplica pedido e conta a receber', () => {
  assert.equal(expandOrderReceivables(sale({ payment_method: 'pagar_depois' })).length, 0);
  const row = receivableAccountRow({ id: 'account-1', employee_name: 'Maria', amount: 120, status: 'open', due_date: '2099-09-03', source_type: 'pdv', created_at: '2026-09-02T10:00:00Z' });
  assert.equal(row.status, 'pending');
  assert.equal(row.origin, 'PDV');
});

test('resumo separa recebido, pendente e vencido', () => {
  const received = expandOrderReceivables(sale({ total: 85 }))[0];
  const pending = receivableAccountRow({ id: 'a', employee_name: 'A', amount: 120, status: 'open', due_date: '2099-09-03', created_at: '2026-09-02T10:00:00Z' });
  const overdue = receivableAccountRow({ id: 'b', employee_name: 'B', amount: 50, status: 'open', due_date: '2020-01-01', created_at: '2026-09-02T10:00:00Z' });
  assert.deepEqual(summarizeReceivables([received, pending, overdue]), { total: 255, received: 85, pending: 120, overdue: 50 });
});

test('conversão inválida nunca gera entrada negativa ou infinita', () => {
  assert.equal(convertedStockQuantity(-1, 12), 0);
  assert.equal(convertedStockQuantity(1, 0), 0);
  assert.equal(convertedStockQuantity('inválido', 12), 0);
});

test('normaliza dúzia, balde e mililitro', () => {
  assert.equal(normalizePurchaseUnit('Dúzia'), 'dz');
  assert.equal(normalizePurchaseUnit('Balde'), 'bd');
  assert.equal(normalizePurchaseUnit('Mililitros'), 'ml');
});

test('venda sem divisão usa forma e total originais', () => {
  assert.deepEqual(orderPaymentLines(sale({ payment_method: 'dinheiro', total: 33.5 })), [{ method: 'dinheiro', amount: 33.5 }]);
});

test('divisão vazia ou inválida volta para o pagamento principal', () => {
  assert.deepEqual(orderPaymentLines(sale({ total: 42, variations: { payment_split: { lines: [{ method: 'pix', amount: 0 }] } } })), [{ method: 'pix', amount: 42 }]);
});

test('padroniza formas financeiras conhecidas', () => {
  assert.equal(normalizePaymentMethod('Cartão de Crédito'), 'CRÉDITO');
  assert.equal(normalizePaymentMethod('cartao_debito'), 'DÉBITO');
  assert.equal(normalizePaymentMethod('transferencia bancaria'), 'TRANSFERÊNCIA');
  assert.equal(normalizePaymentMethod('voucher refeição'), 'OUTROS');
});

test('identifica canais sem confundir mesa com delivery', () => {
  assert.equal(orderOrigin(sale({ source: 'WHATSAPP' })), 'WhatsApp');
  assert.equal(orderOrigin(sale({ source: 'CARDAPIO_DIGITAL' })), 'Cardápio Digital');
  assert.equal(orderOrigin(sale({ source: '', variations: {}, table_id: 'mesa-1', order_type: 'dine_in' })), 'Mesa');
});

test('conta parcialmente paga mantém status intermediário', () => {
  const row = receivableAccountRow({ id: 'partial', amount: 100, status: 'partially_paid', due_date: '2099-01-01' });
  assert.equal(row.status, 'partially_received');
});

test('conta cancelada não reaparece como vencida', () => {
  const row = receivableAccountRow({ id: 'cancelled', amount: 100, status: 'cancelled', due_date: '2020-01-01' });
  assert.equal(row.status, 'cancelled');
});

test('cancelados e reembolsados não inflam valores recebidos', () => {
  const cancelled = expandOrderReceivables(sale({ total: 40, status: 'cancelled' }))[0];
  const refunded = expandOrderReceivables(sale({ total: 60, status: 'cancelled', financial_cancellation: { refund_status: 'completed' } }))[0];
  assert.deepEqual(summarizeReceivables([cancelled, refunded]), { total: 100, received: 0, pending: 0, overdue: 0 });
});

test('catálogo reconhece abreviação segura do mesmo produto', () => {
  const match = findBestCatalogMatch('Coca Cola lata 350ml', [
    { id: '1', name: 'Coca-Cola Lata 350 ml', track_stock: true },
    { id: '2', name: 'Coca-Cola 2 litros', track_stock: true },
  ]);
  assert.equal(match?.candidate.id, '1');
  assert.equal(match?.score, 1);
});

test('catálogo não mistura embalagens com volumes diferentes', () => {
  assert.ok(catalogSimilarity('Coca-Cola lata 350 ml', 'Coca-Cola 2 litros') < 0.72);
  assert.equal(findBestCatalogMatch('Coca Cola 350ml', [{ id: '2', name: 'Coca-Cola 2 litros' }]), null);
});

test('catálogo rejeita correspondência genérica ambígua', () => {
  const match = findBestCatalogMatch('Leite integral', [
    { id: '1', name: 'Leite integral marca A' },
    { id: '2', name: 'Leite integral marca B' },
  ]);
  assert.equal(match, null);
});
