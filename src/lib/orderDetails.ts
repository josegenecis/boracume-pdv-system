export type OrderItemDetailLine = {
  key: string;
  text: string;
  price?: number;
};

const normalizeSpaces = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

export const toOrderNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    let safe = value.trim();
    safe = safe.replace(/[^0-9.,-]/g, '');
    const lastComma = safe.lastIndexOf(',');
    const lastDot = safe.lastIndexOf('.');
    const decimalPos = Math.max(lastComma, lastDot);

    if (decimalPos >= 0) {
      const integerPart = safe.slice(0, decimalPos).replace(/[^0-9-]/g, '');
      const fractionPart = safe.slice(decimalPos + 1).replace(/[^0-9]/g, '');
      safe = `${integerPart}.${fractionPart}`;
    } else {
      safe = safe.replace(/[^0-9-]/g, '');
    }

    const parsed = Number(safe);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrencyBRL = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toOrderNumber(value));

export const formatPaymentMethodLabel = (value: unknown) => {
  const raw = normalizeSpaces(value).toLowerCase();
  const labels: Record<string, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    credito: 'Cartão de Crédito',
    debito: 'Cartão de Débito',
  };

  if (labels[raw]) return labels[raw];
  if (!raw) return 'Não informado';
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const getOrderItemDisplayName = (item: any) =>
  normalizeSpaces(item?.product_name || item?.name || 'Produto não informado');

export const getOrderItemQuantity = (item: any) => {
  const quantity = toOrderNumber(item?.quantity);
  return quantity > 0 ? quantity : 1;
};

export const getOrderItemUnitPrice = (item: any) => {
  const price = toOrderNumber(item?.unit_price ?? item?.price);
  return price >= 0 ? price : 0;
};

const getOptionsExtra = (item: any) => {
  const options = Array.isArray(item?.options) ? item.options : [];
  return options.reduce((total: number, option: any) => {
    if (!option || typeof option === 'string') return total;
    const extra = toOrderNumber(option?.price ?? option?.additional_price);
    return total + (extra > 0 ? extra : 0);
  }, 0);
};

export const getOrderItemTotal = (item: any) => {
  const explicitTotal = toOrderNumber(item?.total_price ?? item?.subtotal ?? item?.total);
  if (explicitTotal > 0) return explicitTotal;

  const quantity = getOrderItemQuantity(item);
  const unitPrice = getOrderItemUnitPrice(item);
  return quantity * unitPrice + quantity * getOptionsExtra(item);
};

const appendDetailLine = (
  bucket: Map<string, OrderItemDetailLine>,
  text: string,
  price?: number
) => {
  const normalizedText = normalizeSpaces(text);
  if (!normalizedText) return;

  const normalizedPrice = typeof price === 'number' && price > 0 ? price : undefined;
  const key = `${normalizedText.toLowerCase()}|${normalizedPrice ?? ''}`;
  if (!bucket.has(key)) {
    bucket.set(key, { key, text: normalizedText, price: normalizedPrice });
  }
};

export const getOrderItemDetailLines = (item: any): OrderItemDetailLine[] => {
  const bucket = new Map<string, OrderItemDetailLine>();

  const variations = Array.isArray(item?.variations) ? item.variations : [];
  for (const variation of variations) {
    if (!variation) continue;

    if (typeof variation === 'string') {
      appendDetailLine(bucket, variation);
      continue;
    }

    if (typeof variation === 'object') {
      const label = normalizeSpaces(variation?.name || variation?.label || variation?.receipt_label);
      const value =
        Array.isArray(variation?.options) && variation.options.length > 0
          ? variation.options.map((option: any) => normalizeSpaces(option)).filter(Boolean).join(', ')
          : normalizeSpaces(variation?.value || variation?.selected_option || variation?.choice);

      appendDetailLine(bucket, label && value ? `${label}: ${value}` : label || value);
    }
  }

  const options = Array.isArray(item?.options) ? item.options : [];
  for (const option of options) {
    if (!option) continue;

    if (typeof option === 'string') {
      appendDetailLine(bucket, option);
      continue;
    }

    if (typeof option === 'object') {
      const label = normalizeSpaces(option?.name || option?.option_name || option?.title || option?.label || 'Variação');
      const value = normalizeSpaces(option?.value || option?.selected_option || option?.choice);
      const price = toOrderNumber(option?.price ?? option?.additional_price);
      appendDetailLine(bucket, value ? `${label}: ${value}` : label, price > 0 ? price : undefined);
    }
  }

  return Array.from(bucket.values());
};

export const getOrderMapsLink = (order: any) => {
  const explicitLink = normalizeSpaces(order?.google_maps_link);
  if (explicitLink) return explicitLink;

  const latitude = toOrderNumber(order?.customer_latitude);
  const longitude = toOrderNumber(order?.customer_longitude);
  if (latitude && longitude) {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  return '';
};

export const getOrderSubtotal = (order: any) => {
  const explicitSubtotal = toOrderNumber(order?.subtotal);
  if (explicitSubtotal > 0) return explicitSubtotal;

  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsSubtotal = items.reduce((total: number, item: any) => total + getOrderItemTotal(item), 0);
  if (itemsSubtotal > 0) return itemsSubtotal;

  const total = toOrderNumber(order?.total);
  const deliveryFee = toOrderNumber(order?.delivery_fee);
  return Math.max(0, total - deliveryFee);
};

export const buildTrackUrl = (order: any, origin?: string) => {
  const orderId = normalizeSpaces(order?.id);
  if (!orderId) return '';
  const safeOrigin =
    normalizeSpaces(origin) ||
    (typeof window !== 'undefined' ? normalizeSpaces(window.location.origin) : '');
  if (!safeOrigin) return '';
  return `${safeOrigin.replace(/\/+$/, '')}/track/${orderId}`;
};

export const buildDetailedOrderWhatsappMessage = (order: any, options?: { origin?: string; trackingUrl?: string }) => {
  const lines: string[] = [];
  const orderNumber = normalizeSpaces(order?.order_number || order?.id || '');
  const customerName = normalizeSpaces(order?.customer_name || 'Cliente');
  const customerPhone = normalizeSpaces(order?.customer_phone);
  const customerAddress = normalizeSpaces(order?.customer_address);
  const deliveryInstructions = normalizeSpaces(order?.delivery_instructions);
  const mapsLink = getOrderMapsLink(order);
  const trackingUrl = normalizeSpaces(options?.trackingUrl) || buildTrackUrl(order, options?.origin);
  const items = Array.isArray(order?.items) ? order.items : [];
  const subtotal = getOrderSubtotal(order);
  const deliveryFee = Math.max(0, toOrderNumber(order?.delivery_fee));
  const discount = Math.max(0, toOrderNumber(order?.discount));
  const total = toOrderNumber(order?.total) || Math.max(0, subtotal + deliveryFee - discount);
  const paymentMethod = formatPaymentMethodLabel(order?.payment_method);

  lines.push(`*Pedido #${orderNumber || 'sem número'}*`);
  if (trackingUrl) lines.push(`Acompanhe: ${trackingUrl}`);
  lines.push(`Cliente: ${customerName}`);
  if (customerPhone) lines.push(`Telefone: ${customerPhone}`);
  if (customerAddress) lines.push(`Endereço: ${customerAddress}`);
  if (mapsLink) lines.push(`Maps: ${mapsLink}`);
  if (deliveryInstructions) lines.push(`Instruções: ${deliveryInstructions}`);

  lines.push('', '*Itens:*');

  if (items.length === 0) {
    lines.push('- Nenhum item informado');
  } else {
    items.forEach((item: any) => {
      const quantity = getOrderItemQuantity(item);
      const unitPrice = getOrderItemUnitPrice(item);
      const itemTotal = getOrderItemTotal(item);
      const detailLines = getOrderItemDetailLines(item);
      const notes = normalizeSpaces(item?.notes || item?.observations);

      lines.push(`${quantity}x ${getOrderItemDisplayName(item)}`);
      detailLines.forEach((detail) => {
        lines.push(
          detail.price && detail.price > 0
            ? `   - ${detail.text} (+${formatCurrencyBRL(detail.price)})`
            : `   - ${detail.text}`
        );
      });
      if (notes) lines.push(`   - Obs: ${notes}`);
      lines.push(`   ${formatCurrencyBRL(unitPrice)} x ${quantity} = ${formatCurrencyBRL(itemTotal)}`);
    });
  }

  lines.push('', '*Resumo:*');
  lines.push(`Subtotal: ${formatCurrencyBRL(subtotal)}`);
  if (deliveryFee > 0) lines.push(`Taxa de entrega: ${formatCurrencyBRL(deliveryFee)}`);
  if (discount > 0) lines.push(`Desconto: -${formatCurrencyBRL(discount)}`);
  lines.push(`*Total: ${formatCurrencyBRL(total)}*`);
  lines.push(`Pagamento: ${paymentMethod}`);

  return lines.join('\n').trim();
};
