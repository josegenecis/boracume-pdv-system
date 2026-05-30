export interface PopAiOrderDraftItem {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  complements?: string[];
  variation?: string | null;
  notes?: string | null;
}

export interface PopAiOrderDraft {
  customer_name?: string | null;
  customer_phone: string;
  type: 'delivery' | 'pickup' | 'counter' | 'table';
  items: PopAiOrderDraftItem[];
  delivery_fee?: number;
  payment_method?: string | null;
  address?: string | null;
  notes?: string | null;
}

export function calculateOrderDraftTotals(draft: PopAiOrderDraft) {
  const subtotal = (draft.items || []).reduce((acc, item) => {
    return acc + Number(item.quantity || 0) * Number(item.unit_price || 0);
  }, 0);
  const deliveryFee = Number(draft.delivery_fee || 0);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    total: Number((subtotal + deliveryFee).toFixed(2))
  };
}

export function summarizeOrderDraft(draft: PopAiOrderDraft) {
  const totals = calculateOrderDraftTotals(draft);
  const items = (draft.items || []).map((item, index) => {
    const extras = [
      item.variation ? `- ${item.variation}` : '',
      ...(item.complements || []).map((name) => `- ${name}`),
      item.notes ? `Obs: ${item.notes}` : ''
    ].filter(Boolean).join('\n  ');

    return `${index + 1}. ${item.quantity}x ${item.name} - R$ ${(item.quantity * item.unit_price).toFixed(2)}${extras ? `\n  ${extras}` : ''}`;
  }).join('\n');

  return [
    'Seu pedido ficou assim:',
    items,
    `Subtotal: R$ ${totals.subtotal.toFixed(2)}`,
    totals.deliveryFee > 0 ? `Entrega: R$ ${totals.deliveryFee.toFixed(2)}` : '',
    `Total: R$ ${totals.total.toFixed(2)}`,
    'Posso confirmar?'
  ].filter(Boolean).join('\n');
}

export function validateOrderDraft(draft: PopAiOrderDraft) {
  const errors: string[] = [];
  if (!draft.customer_phone) errors.push('Telefone do cliente ausente.');
  if (!Array.isArray(draft.items) || draft.items.length === 0) errors.push('Nenhum item no pedido.');
  for (const item of draft.items || []) {
    if (!item.name) errors.push('Item sem nome.');
    if (Number(item.quantity || 0) <= 0) errors.push(`Quantidade inválida em ${item.name || 'item'}.`);
    if (Number(item.unit_price || 0) < 0) errors.push(`Preço inválido em ${item.name || 'item'}.`);
  }
  return { valid: errors.length === 0, errors };
}
