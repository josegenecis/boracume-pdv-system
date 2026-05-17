import { supabase } from '@/integrations/supabase/client';
import { getOrderItemDetailGroups } from '@/lib/orderDetails';
import { toast } from 'sonner';

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const CUT_PARTIAL = GS + 'V' + '\x41' + '\x00';
const CUT_FULL = GS + 'V' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_RIGHT = ESC + 'a' + '\x02';

// Variável global para manter a conexão ativa (singleton pattern simples)
let usbDevice: any = null;

type PrintOrderOptions = {
  onlyIfAuto?: boolean;
};

type NormalizedPrintConfig = {
  paper_width: '58mm' | '80mm';
  font_size: 'small' | 'normal' | 'large';
  print_header: string;
  print_footer: string;
  copies: number;
  receipt_logo_url: string;
  print_kitchen_ticket: boolean;
};

type ElectronTarget =
  | { type: 'system'; printerName: string }
  | { type: 'device'; deviceId: string; protocol: string };

function escapeHtml(value: any) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitLabelValue(line: string): { label: string; value: string } | null {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx <= 0) return null;
  const label = raw.slice(0, idx).trim();
  const value = raw.slice(idx + 1).trim();
  if (!label) return null;
  return { label, value };
}

function normalizeSingleLine(value: any) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function resolveReceiptLogoUrl(store: any, config: any) {
  return String(config?.receipt_logo_url || store?.receipt_logo_url || store?.logo_url || '').trim();
}

function resolveCustomerAddressLine(order: any) {
  const address = normalizeSingleLine(order?.customer_address);
  const neighborhood = normalizeSingleLine(order?.delivery_zone_name || order?.customer_neighborhood);
  if (!address) return neighborhood;
  if (!neighborhood) return address;

  const lowerAddress = address.toLowerCase();
  const lowerNeighborhood = neighborhood.toLowerCase();
  if (lowerAddress.includes(lowerNeighborhood)) return address;
  return `${address} - Bairro: ${neighborhood}`;
}

function getOrderTypeLabel(order: any) {
  const orderType = String(order?.order_type || '').trim().toLowerCase();
  if (orderType === 'delivery') return 'Delivery';
  if (orderType === 'pickup') return 'Retirada';
  if (orderType === 'dine_in') return 'Mesa';
  return 'Balcão';
}

function getKitchenCustomerLabel(order: any) {
  const customerName = normalizeSingleLine(order?.customer_name);
  if (customerName) return customerName;
  if (String(order?.order_type || '').trim().toLowerCase() === 'dine_in') return 'Mesa';
  return 'Balcão';
}

function shouldPrintTicketCode(order: any) {
  const orderType = String(order?.order_type || '').trim().toLowerCase();
  return orderType === 'dine_in' || orderType === 'counter' || (!orderType && !order?.delivery_zone_id);
}

function normalizePrintConfig(settings: any): NormalizedPrintConfig {
  const paperWidth = String(settings?.paper_width || '58mm').trim() === '80mm' ? '80mm' : '58mm';
  const fontSizeRaw = String(settings?.font_size || 'normal').trim();
  const fontSize: NormalizedPrintConfig['font_size'] =
    fontSizeRaw === 'small' || fontSizeRaw === 'large' ? fontSizeRaw : 'normal';

  return {
    paper_width: paperWidth,
    font_size: fontSize,
    print_header: String(settings?.print_header || 'BoraCumê PDV').trim() || 'BoraCumê PDV',
    print_footer: String(settings?.print_footer || 'Obrigado!').trim() || 'Obrigado!',
    copies: Math.max(1, Number(settings?.copies || 1) || 1),
    receipt_logo_url: String(settings?.receipt_logo_url || '').trim(),
    print_kitchen_ticket: Boolean(settings?.print_kitchen_ticket),
  };
}

async function fetchVariationOrderMaps(productIds: string[]) {
  const ids = Array.from(new Set((productIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const result = new Map<string, Map<string, number>>();
  if (ids.length === 0) return result;

  const [{ data: linkRows }, { data: productVarRows }] = await Promise.all([
    supabase
      .from('product_global_variation_links')
      .select('product_id,global_variation_id,display_order')
      .in('product_id', ids as any)
      .order('product_id', { ascending: true })
      .order('display_order', { ascending: true }) as any,
    supabase
      .from('product_variations')
      .select('product_id,name,receipt_label,display_order,created_at')
      .in('product_id', ids as any) as any
  ]);

  const links = Array.isArray(linkRows) ? linkRows : [];
  const globalIds = Array.from(new Set(links.map((l: any) => String(l.global_variation_id || '').trim()).filter(Boolean)));
  let globals: any[] = [];
  if (globalIds.length > 0) {
    const { data } = await supabase.from('global_variations').select('id,name,receipt_label').in('id', globalIds as any) as any;
    globals = Array.isArray(data) ? data : [];
  }
  const globalById = new Map(globals.map((g: any) => [String(g.id), g]));

  for (const pid of ids) result.set(pid, new Map<string, number>());

  for (const link of links) {
    const pid = String(link.product_id || '').trim();
    const gv = globalById.get(String(link.global_variation_id || ''));
    if (!pid || !gv) continue;
    const order = link.display_order !== undefined && link.display_order !== null ? Math.max(0, Math.floor(Number(link.display_order) || 0)) : 10000;
    const map = result.get(pid);
    if (!map) continue;
    const keys = [gv.receipt_label, gv.name].map((v: any) => String(v || '').trim().toLowerCase()).filter(Boolean);
    for (const k of keys) {
      if (!map.has(k) || (map.get(k) as number) > order) map.set(k, order);
    }
  }

  const prodVars = Array.isArray(productVarRows) ? productVarRows : [];
  const byProduct = new Map<string, any[]>();
  for (const row of prodVars) {
    const pid = String(row.product_id || '').trim();
    if (!pid) continue;
    const list = byProduct.get(pid) || [];
    list.push(row);
    byProduct.set(pid, list);
  }
  for (const [pid, list] of byProduct.entries()) {
    const map = result.get(pid);
    if (!map) continue;
    const sorted = [...list].sort((a, b) => {
      const ao = a.display_order !== undefined && a.display_order !== null ? Number(a.display_order) : 10_000;
      const bo = b.display_order !== undefined && b.display_order !== null ? Number(b.display_order) : 10_000;
      if (ao !== bo) return ao - bo;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      const order = row.display_order !== undefined && row.display_order !== null ? Math.max(0, Math.floor(Number(row.display_order) || 0)) : 20000 + i;
      const keys = [row.receipt_label, row.name].map((v: any) => String(v || '').trim().toLowerCase()).filter(Boolean);
      for (const k of keys) {
        if (!map.has(k) || (map.get(k) as number) > order) map.set(k, order);
      }
    }
  }

  return result;
}

function sortReceiptVariations(variations: any[], orderMap?: Map<string, number>) {
  const arr = Array.isArray(variations) ? variations.map((v) => String(v || '').trim()).filter(Boolean) : [];
  if (!orderMap || orderMap.size === 0) return arr;
  return arr
    .map((line, idx) => {
      const parsed = splitLabelValue(line);
      const key = String(parsed?.label || '').trim().toLowerCase();
      const order = orderMap.get(key);
      return { line, idx, order: order !== undefined ? order : 99999 };
    })
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.idx - b.idx))
    .map((x) => x.line);
}

function extractOptionNames(raw: any): string[] {
  const out: string[] = [];
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item) continue;
      if (typeof item === 'string') {
        const v = item.trim();
        if (v) out.push(v);
        continue;
      }
      const name = String((item as any).name || (item as any).label || '').trim();
      if (name) out.push(name);
    }
  } else if (typeof raw === 'string') {
    const v = raw.trim();
    if (v) out.push(v);
  }
  return out;
}

function parseGroupOptions(raw: any): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((o: any) => String(o?.name || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

type VariationGroupMeta = {
  order: number;
  receiptLabel: string;
  optionKeySet: Set<string>;
};

async function fetchVariationGroups(productIds: string[]) {
  const ids = Array.from(new Set((productIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const result = new Map<string, VariationGroupMeta[]>();
  if (ids.length === 0) return result;

  const [{ data: linkRows }, { data: productVarRows }] = await Promise.all([
    supabase
      .from('product_global_variation_links')
      .select('product_id,global_variation_id,display_order')
      .in('product_id', ids as any) as any,
    supabase
      .from('product_variations')
      .select('product_id,name,receipt_label,options,display_order,created_at')
      .in('product_id', ids as any) as any
  ]);

  const links = Array.isArray(linkRows) ? linkRows : [];
  const globalIds = Array.from(new Set(links.map((l: any) => String(l.global_variation_id || '').trim()).filter(Boolean)));
  let globals: any[] = [];
  if (globalIds.length > 0) {
    const { data } = await supabase.from('global_variations').select('id,name,receipt_label,options').in('id', globalIds as any) as any;
    globals = Array.isArray(data) ? data : [];
  }
  const globalById = new Map(globals.map((g: any) => [String(g.id), g]));

  for (const pid of ids) result.set(pid, []);

  for (const link of links) {
    const pid = String(link.product_id || '').trim();
    const gv = globalById.get(String(link.global_variation_id || ''));
    if (!pid || !gv) continue;
    const order = link.display_order !== undefined && link.display_order !== null ? Math.max(0, Math.floor(Number(link.display_order) || 0)) : 10000;
    const label = String(gv.receipt_label || gv.name || '').trim();
    const opts = parseGroupOptions(gv.options);
    const set = new Set(opts.map((o) => o.toLowerCase()));
    result.get(pid)?.push({ order, receiptLabel: label, optionKeySet: set });
  }

  const prodVars = Array.isArray(productVarRows) ? productVarRows : [];
  const byProduct = new Map<string, any[]>();
  for (const row of prodVars) {
    const pid = String(row.product_id || '').trim();
    if (!pid) continue;
    const list = byProduct.get(pid) || [];
    list.push(row);
    byProduct.set(pid, list);
  }
  for (const [pid, list] of byProduct.entries()) {
    const sorted = [...list].sort((a, b) => {
      const ao = a.display_order !== undefined && a.display_order !== null ? Number(a.display_order) : 10_000;
      const bo = b.display_order !== undefined && b.display_order !== null ? Number(b.display_order) : 10_000;
      if (ao !== bo) return ao - bo;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      const order = row.display_order !== undefined && row.display_order !== null ? Math.max(0, Math.floor(Number(row.display_order) || 0)) : 20000 + i;
      const label = String(row.receipt_label || row.name || '').trim();
      const opts = parseGroupOptions(row.options);
      const set = new Set(opts.map((o) => o.toLowerCase()));
      result.get(pid)?.push({ order, receiptLabel: label, optionKeySet: set });
    }
  }

  for (const [pid, groups] of result.entries()) {
    result.set(
      pid,
      [...groups].sort((a, b) => a.order - b.order || a.receiptLabel.localeCompare(b.receiptLabel, 'pt-BR'))
    );
  }

  return result;
}

function optionsToReceiptLines(optionNames: string[], groups?: VariationGroupMeta[]) {
  const names = (optionNames || []).map((s) => String(s || '').trim()).filter(Boolean);
  if (!groups || groups.length === 0) return names;

  const selectedByLabel = new Map<string, string[]>();
  const used = new Set<number>();

  for (let idx = 0; idx < names.length; idx++) {
    const name = names[idx];
    const key = name.toLowerCase();
    let matchedIndex = -1;
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].optionKeySet.has(key)) {
        matchedIndex = i;
        break;
      }
    }
    if (matchedIndex === -1) continue;
    used.add(idx);
    const label = groups[matchedIndex].receiptLabel || 'Complementos';
    const list = selectedByLabel.get(label) || [];
    list.push(name);
    selectedByLabel.set(label, list);
  }

  const lines: string[] = [];
  for (const g of groups) {
    const label = g.receiptLabel || 'Complementos';
    const selected = selectedByLabel.get(label);
    if (!selected || selected.length === 0) continue;
    lines.push(`${label}: ${selected.join(', ')}`);
  }

  const leftovers = names.filter((_, idx) => !used.has(idx));
  lines.push(...leftovers);

  return lines;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatCurrencyValue(value: number) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function padRight(value: string, width: number) {
  const text = String(value || '');
  if (text.length >= width) return text;
  return text + ' '.repeat(width - text.length);
}

function wrapTextLine(value: string, width: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return [''];
  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > width) {
    let cut = remaining.lastIndexOf(' ', width);
    if (cut <= 0) cut = width;
    lines.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) lines.push(remaining);
  return lines;
}

function formatColumns(left: string, right: string, width: number) {
  const safeRight = String(right || '').trim();
  const safeLeft = String(left || '').trim();
  const maxLeft = Math.max(8, width - safeRight.length - 1);
  const leftLines = wrapTextLine(safeLeft, maxLeft);
  const lines = leftLines.map((line, index) => {
    if (index !== leftLines.length - 1) return line;
    const spacing = Math.max(1, width - line.length - safeRight.length);
    return `${line}${' '.repeat(spacing)}${safeRight}`;
  });
  return lines;
}

function resolveElectronTarget(): ElectronTarget | null {
  try {
    const mode = (localStorage.getItem('hw.receipt.mode') || '').trim();
    const systemPrinterName = (localStorage.getItem('hw.report.printer') || '').trim();
    const serialDeviceId = (localStorage.getItem('hw.receipt.port') || '').trim();
    const serialProtocol = (localStorage.getItem('hw.receipt.protocol') || 'epson').trim() || 'epson';

    if (mode === 'serial') {
      if (serialDeviceId) return { type: 'device', deviceId: serialDeviceId, protocol: serialProtocol };
      if (systemPrinterName) return { type: 'system', printerName: systemPrinterName };
    }

    if (mode === 'system') {
      if (systemPrinterName) return { type: 'system', printerName: systemPrinterName };
      if (serialDeviceId) return { type: 'device', deviceId: serialDeviceId, protocol: serialProtocol };
    }

    if (systemPrinterName) return { type: 'system', printerName: systemPrinterName };
    if (serialDeviceId) return { type: 'device', deviceId: serialDeviceId, protocol: serialProtocol };

    const legacy = safeJsonParse<{
      mode?: 'system' | 'network';
      systemName?: string;
      ip?: string;
      port?: number;
      protocol?: string;
    }>(localStorage.getItem('pdv_printer'));

    if (legacy?.mode === 'system') {
      const printerName = String(legacy.systemName || '').trim();
      if (printerName) return { type: 'system', printerName };
    }

    if (legacy?.mode === 'network') {
      const ip = String(legacy.ip || '').trim();
      const port = Number(legacy.port || 9100) || 9100;
      const protocol = String(legacy.protocol || 'epson').trim() || 'epson';
      if (ip) return { type: 'device', deviceId: `tcp://${ip}:${port}`, protocol };
    }

    return null;
  } catch {
    return null;
  }
}

function buildOrderHtml(order: any, config: any, store?: any) {
  const width = config.paper_width === '58mm' ? '58mm' : '80mm';
  const bodyWidth = config.paper_width === '58mm' ? '46mm' : '68mm';
  const fontSize = config.font_size === 'small' ? '10px' : config.font_size === 'large' ? '14px' : '12px';
  const storeName = escapeHtml(store?.restaurant_name || store?.name || config.print_header || 'RESTAURANTE');
  const storeDesc = escapeHtml(store?.description || '');
  const storeLogo = resolveReceiptLogoUrl(store, config);
  const storeLogoHtml = storeLogo ? `<img src="${escapeHtml(storeLogo)}" alt="Logo" style="max-width: 160px; max-height: 68px; object-fit: contain; margin: 0 auto 8px auto; display:block;" />` : '';
  const storeAddress = escapeHtml(store?.address || '');
  const storePhone = escapeHtml(store?.phone || '');
  const storeCnpj = escapeHtml(store?.cnpj || '');
  const customerAddressLine = escapeHtml(resolveCustomerAddressLine(order));

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Imprimir Pedido #${order.order_number}</title>
        <style>
          @page { margin: 0; size: ${width} auto; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${bodyWidth};
            margin: 0;
            padding: 2mm 1mm 3mm 1mm;
            font-size: ${fontSize};
            color: #000;
            line-height: 1.28;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            text-rendering: geometricPrecision;
            font-smooth: never;
            -webkit-font-smoothing: none;
          }
          .container {
            width: 100%;
            max-width: none;
            margin: 0;
            overflow: hidden;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .divider { border-top: 1px dashed #000; margin: 9px 0; }
          .flex { display: flex; justify-content: space-between; gap: 8px; }
          .item-row { margin-bottom: 8px; }
          .brand-block { padding-bottom: 2px; }
          .ticket-code { font-size: 1.52em; letter-spacing: 0.08em; }
          .section-title { font-weight: 700; letter-spacing: 0.06em; }
          .item-title {
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
            font-weight: 700;
          }
          .item-meta,
          .total-line {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
          }
          .item-meta-left,
          .total-label {
            min-width: 0;
            flex: 1;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .item-meta-right,
          .total-value {
            flex: 0 0 auto;
            white-space: nowrap;
            text-align: right;
          }
          .notes {
            font-size: 0.9em;
            font-style: italic;
            margin-left: 10px;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .total-row { font-size: 1.2em; margin-top: 10px; }
          .muted { color: #111; font-size: 0.95em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="center brand-block">
            ${storeLogoHtml}
          </div>
          <div class="center bold" style="font-size: 1.2em; letter-spacing: 0.04em;">${storeName}</div>
          ${storeDesc ? `<div class="center muted" style="margin-top: 2px;">${storeDesc}</div>` : ''}
          ${storeAddress ? `<div class="center muted" style="margin-top: 2px;">${storeAddress}</div>` : ''}
          ${storePhone ? `<div class="center muted">Tel: ${storePhone}</div>` : ''}
          ${storeCnpj ? `<div class="center muted">CNPJ: ${storeCnpj}</div>` : ''}
          <div class="center">${new Date(order.created_at).toLocaleString('pt-BR')}</div>
          <div class="divider"></div>
          
          ${shouldPrintTicketCode(order) ? `<div class="center bold ticket-code">SENHA: ${order.order_number?.slice(-4) || '----'}</div>` : ''}
          <div class="center">Pedido #${order.order_number}</div>
          
          <div class="divider"></div>
          
          <div class="section-title">CLIENTE:</div>
          <div>${order.customer_name || 'Balcão'}</div>
          ${order.customer_phone ? `<div>Tel: ${order.customer_phone}</div>` : ''}
          ${customerAddressLine ? `<div>End: ${customerAddressLine}</div>` : ''}
          ${order.delivery_zone_id ? `<div>Entrega: ${order.order_type === 'delivery' ? 'Delivery' : 'Retirada'}</div>` : ''}
          
          <div class="divider"></div>
          
          <div class="section-title" style="margin-bottom: 5px;">ITENS:</div>
          ${(order.items || []).map((item: any) => `
            <div class="item-row">
              <div class="item-title bold">${item.quantity}x ${escapeHtml(item.product_name || item.name || 'Produto')}</div>
              <div class="item-meta">
                <span class="item-meta-left">${formatCurrencyValue(Number(item.price || item.unit_price || 0))} x ${Number(item.quantity || 1)}</span>
                <span class="item-meta-right">${formatCurrencyValue(Number(item.total || item.subtotal || item.price * item.quantity || 0))}</span>
              </div>
              ${(() => {
                const detailGroups = getOrderItemDetailGroups(item);
                return detailGroups.map((group) => `
                  ${group.label ? `<div class="notes"><span class="bold">${escapeHtml(group.label)}:</span></div>` : ''}
                  ${group.items.map((detail) => `
                    <div class="notes">
                      ${group.label ? '&nbsp;&nbsp;&bull; ' : ''}${escapeHtml(detail.text)}
                      ${detail.price && detail.price > 0 ? ` (${escapeHtml(formatCurrencyValue(detail.price))})` : ''}
                    </div>
                  `).join('')}
                `).join('');
              })()}
              ${item.notes ? `<div class="notes"><span class="bold">Obs:</span> ${escapeHtml(item.notes)}</div>` : ''}
            </div>
          `).join('')}
          
          <div class="divider"></div>
          
          <div class="total-line">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">${formatCurrencyValue(order.total - (order.delivery_fee || 0))}</span>
          </div>
          ${order.delivery_fee ? `
          <div class="total-line">
            <span class="total-label">Taxa Entrega:</span>
            <span class="total-value">${formatCurrencyValue(order.delivery_fee)}</span>
          </div>` : ''}
          ${order.discount ? `
          <div class="total-line">
            <span class="total-label">Desconto:</span>
            <span class="total-value">- ${formatCurrencyValue(order.discount)}</span>
          </div>` : ''}
          
          <div class="divider"></div>
          
          <div class="total-line total-row bold">
            <span class="total-label">TOTAL:</span>
            <span class="total-value">${formatCurrencyValue(order.total)}</span>
          </div>
          
          <div style="margin-top: 5px;">Pagamento: ${order.payment_method?.toUpperCase().replace('_', ' ') || 'N/A'}</div>
          ${order.change_amount ? `<div>Troco para: R$ ${order.change_amount.toFixed(2)}</div>` : ''}
          
          <div class="divider"></div>
          <div class="center" style="margin-top: 10px;">${config.print_footer}</div>
          <div class="center" style="font-size: 0.8em; margin-top: 5px;">Sistema BoraCumê</div>
        </div>
      </body>
      </html>
    `;
}

function buildKitchenTicketHtml(order: any, config: any) {
  const width = config.paper_width === '58mm' ? '58mm' : '80mm';
  const bodyWidth = config.paper_width === '58mm' ? '46mm' : '68mm';
  const fontSize = config.font_size === 'small' ? '10px' : config.font_size === 'large' ? '14px' : '12px';
  const customerName = escapeHtml(getKitchenCustomerLabel(order));
  const orderTypeLabel = escapeHtml(getOrderTypeLabel(order));
  const orderNumber = escapeHtml(order?.order_number || '----');
  const ticketCode = escapeHtml(order?.order_number?.slice(-4) || '----');

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Comanda Cozinha #${order.order_number || ''}</title>
        <style>
          @page { margin: 0; size: ${width} auto; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${bodyWidth};
            margin: 0;
            padding: 2mm 1mm 3mm 1mm;
            font-size: ${fontSize};
            color: #000;
            line-height: 1.28;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .container {
            width: 100%;
            max-width: none;
            margin: 0;
            overflow: hidden;
          }
          .center { text-align: center; }
          .bold { font-weight: 700; }
          .divider { border-top: 1px dashed #000; margin: 9px 0; }
          .title { font-size: 1.15em; letter-spacing: 0.06em; }
          .ticket-code { font-size: 1.52em; letter-spacing: 0.08em; }
          .section-title { font-weight: 700; letter-spacing: 0.06em; }
          .item-row { margin-bottom: 10px; }
          .item-title {
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
            font-weight: 700;
          }
          .notes {
            font-size: 0.92em;
            margin-left: 10px;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .muted { color: #111; font-size: 0.95em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="center bold title">COMANDA DA COZINHA</div>
          <div class="center muted">${new Date(order.created_at || Date.now()).toLocaleString('pt-BR')}</div>
          <div class="divider"></div>

          ${shouldPrintTicketCode(order) ? `<div class="center bold ticket-code">SENHA: ${ticketCode}</div>` : ''}
          <div class="center">Pedido #${orderNumber}</div>
          <div class="center">${orderTypeLabel}</div>

          <div class="divider"></div>

          <div class="section-title">CLIENTE:</div>
          <div class="bold">${customerName}</div>

          <div class="divider"></div>

          <div class="section-title" style="margin-bottom: 5px;">ITENS:</div>
          ${(order.items || []).map((item: any) => `
            <div class="item-row">
              <div class="item-title">${Number(item.quantity || 1)}x ${escapeHtml(item.product_name || item.name || 'Produto')}</div>
              ${(() => {
                const detailGroups = getOrderItemDetailGroups(item);
                return detailGroups.map((group) => `
                  ${group.label ? `<div class="notes"><span class="bold">${escapeHtml(group.label)}:</span></div>` : ''}
                  ${group.items.map((detail) => `
                    <div class="notes">${group.label ? '&nbsp;&nbsp;&bull; ' : ''}${escapeHtml(detail.text)}</div>
                  `).join('')}
                `).join('');
              })()}
              ${item.notes ? `<div class="notes"><span class="bold">Obs:</span> ${escapeHtml(item.notes)}</div>` : ''}
            </div>
          `).join('')}

          <div class="divider"></div>
        </div>
      </body>
      </html>
    `;
}

function extractBodyInnerHtml(documentHtml: string) {
  const match = String(documentHtml || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : documentHtml;
}

function buildCombinedTicketHtml(order: any, config: any, store?: any) {
  const primaryHtml = buildOrderHtml(order, config, store);
  const kitchenHtml = buildKitchenTicketHtml(order, config);
  const combinedBody = `${extractBodyInnerHtml(primaryHtml)}<div class="ticket-break"></div>${extractBodyInnerHtml(kitchenHtml)}`;

  return primaryHtml
    .replace(
      '</style>',
      `
          .ticket-break {
            page-break-before: always;
            break-before: page;
          }
        </style>`
    )
    .replace(/<body[^>]*>[\s\S]*<\/body>/i, `<body>${combinedBody}</body>`);
}

function buildKitchenEscPosCommands(order: any, lineWidth: number) {
  let commands = '';
  const text = (str: string) => str + '\n';
  const center = () => { commands += ALIGN_CENTER; };
  const left = () => { commands += ALIGN_LEFT; };
  const bold = (enabled: boolean) => { commands += enabled ? BOLD_ON : BOLD_OFF; };
  const line = () => { commands += `${'-'.repeat(lineWidth)}\n`; };

  commands += INIT;
  center();
  bold(true);
  commands += text('COMANDA DA COZINHA');
  bold(false);
  commands += text(new Date(order.created_at || Date.now()).toLocaleString('pt-BR'));
  line();

  bold(true);
  if (shouldPrintTicketCode(order)) commands += text(`SENHA: ${order.order_number?.slice(-4) || '----'}`);
  bold(false);
  commands += text(`Pedido #${order.order_number || '----'}`);
  commands += text(`Tipo: ${getOrderTypeLabel(order)}`);
  line();

  left();
  bold(true);
  commands += text('CLIENTE:');
  bold(false);
  commands += text(getKitchenCustomerLabel(order));
  line();

  bold(true);
  commands += text('ITENS:');
  bold(false);

  for (const item of Array.isArray(order.items) ? order.items : []) {
    const quantity = Number(item.quantity || 1);
    const productName = item.product_name || item.name || 'Produto';
    wrapTextLine(`${quantity}x ${productName}`, lineWidth).forEach((value) => {
      commands += text(value);
    });

    const detailGroups = getOrderItemDetailGroups(item);
    for (const group of detailGroups) {
      if (group.label) {
        wrapTextLine(`   ${group.label}:`, lineWidth).forEach((lineValue) => {
          commands += text(lineValue);
        });
      }
      for (const detail of group.items) {
        wrapTextLine(`   ${group.label ? '- ' : ''}${detail.text}`, lineWidth).forEach((lineValue) => {
          commands += text(lineValue);
        });
      }
    }

    if (item.notes) {
      wrapTextLine(`   Obs: ${String(item.notes)}`, lineWidth).forEach((value) => {
        commands += text(value);
      });
    }

    commands += '\n';
  }

  line();
  commands += '\n\n\n\n';
  commands += CUT_PARTIAL;

  return commands;
}

function buildReportHtml(title: string, lines: string[], store?: any) {
  const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const storeLogoHtml = store?.logo_url ? `<img src="${escapeHtml(store.logo_url)}" alt="Logo" style="max-width: 160px; max-height: 60px; object-fit: contain; margin: 0 auto 6px auto; display:block;" />` : '';
  const storeHeader = store ? `
    ${storeLogoHtml}
    <div class="center bold" style="font-size: 14px; margin-bottom: 4px;">${escapeHtml(store.restaurant_name || store.name || 'RESTAURANTE')}</div>
    ${store.address ? `<div class="center" style="font-size: 11px;">${escapeHtml(store.address)}</div>` : ''}
    ${store.phone ? `<div class="center" style="font-size: 11px;">Tel: ${escapeHtml(store.phone)}</div>` : ''}
    ${store.cnpj ? `<div class="center" style="font-size: 11px;">CNPJ: ${escapeHtml(store.cnpj)}</div>` : ''}
    <div class="divider"></div>
  ` : '';

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
            padding: 10px;
            font-size: 12px;
            color: #000;
            line-height: 1.25;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .line { white-space: pre-wrap; word-break: break-word; }
        </style>
      </head>
      <body>
        ${storeHeader}
        <div class="center bold" style="font-size: 13px; margin: 6px 0;">${title}</div>
        <div class="divider"></div>
        ${lines.map((l) => `<div class="line">${String(l).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('')}
        <div class="divider"></div>
        <div class="center" style="font-size: 0.8em; margin-top: 10px;">Sistema BoraCumê</div>
      </body>
      </html>
    `;
}

async function printReportElectron(html: string) {
  const api = (window as any)?.electronAPI;
  if (!api?.printSystem) return { success: false, error: 'API do Desktop indisponível' };
  const target = resolveElectronTarget();
  if (!target) return { success: false, error: 'Impressora não configurada em Configurações' };
  if (target.type !== 'system') return { success: false, error: 'Selecione uma impressora do sistema para imprimir relatórios' };
  const resp = await api.printSystem(target.printerName, html, true);
  if (!resp?.success) return { success: false, error: resp?.error || 'Falha ao imprimir' };
  return { success: true };
}

async function printElectron(order: any, config: any) {
  const api = (window as any)?.electronAPI;
  if (!api?.printSystem || !api?.printReceipt) return { success: false, error: 'API do Desktop indisponível' };

  const target = resolveElectronTarget();
  if (!target) return { success: false, error: 'Impressora não configurada em Configurações' };

  const copies = Math.max(1, Number(config.copies || 1) || 1);

  if (target.type === 'system') {
    const html = buildOrderHtml(order, config, order.store);
    for (let i = 0; i < copies; i++) {
      const resp = await api.printSystem(target.printerName, html, true);
      if (!resp?.success) return { success: false, error: resp?.error || 'Falha ao imprimir' };
    }

    if (config.print_kitchen_ticket) {
      const kitchenHtml = buildKitchenTicketHtml(order, config);
      const kitchenResp = await api.printSystem(target.printerName, kitchenHtml, true);
      if (!kitchenResp?.success) return { success: false, error: kitchenResp?.error || 'Falha ao imprimir comanda da cozinha' };
    }

    return { success: true };
  }

  const deviceId = target.deviceId;
  const protocol = target.protocol || 'epson';

  const normalized = {
    store: order.store || null,
    order_number: order.order_number,
    customer_name: order.customer_name || 'Balcão',
    customer_phone: order.customer_phone || '',
    customer_address: order.customer_address || '',
    customer_address_display: resolveCustomerAddressLine(order),
    delivery_zone_name: order.delivery_zone_name || '',
    order_type: order.order_type || '',
    date: order.created_at,
    items: (Array.isArray(order.items) ? order.items : []).map((it: any) => ({
      product_name: it.product_name || it.name,
      name: it.product_name || it.name,
      quantity: Number(it.quantity || 1),
      price: Number(it.price || it.unit_price || 0),
      subtotal: Number(it.subtotal || it.total || (Number(it.price || 0) * Number(it.quantity || 1)) || 0),
      notes: it.notes || it.observations || '',
      variations: Array.isArray(it.variations) ? it.variations : []
    })),
    total: Number(order.total || 0),
    subtotal: Number(order.total || 0) - Number(order.delivery_fee || 0),
    discount: Number(order.discount || 0),
    delivery_fee: Number(order.delivery_fee || 0),
    payment_method: String(order.payment_method || '').toUpperCase()
  };

  const conn = await api.connectPrinter(deviceId, protocol, { protocol, width: config.paper_width === '58mm' ? 32 : 48 });
  if (!conn?.success) return { success: false, error: conn?.error || conn?.message || 'Falha ao conectar impressora' };

  for (let i = 0; i < copies; i++) {
    const resp = await api.printReceipt(deviceId, normalized, 'receipt');
    if (!resp?.success) return { success: false, error: resp?.error || resp?.message || 'Falha ao imprimir' };
  }

  if (config.print_kitchen_ticket) {
    const kitchenResp = await api.printReceipt(deviceId, normalized, 'kitchen_ticket');
    if (!kitchenResp?.success) {
      return { success: false, error: kitchenResp?.error || kitchenResp?.message || 'Falha ao imprimir comanda da cozinha' };
    }
  }

  return { success: true };
}

export const PrinterService = {
  // Conectar Impressora USB
  async connectUsb() {
    if (!('usb' in navigator)) {
      console.error('WebUSB não suportado neste navegador.');
      return false;
    }

    try {
      // Solicita dispositivo USB (filtro genérico para impressoras)
      // Class 0x07 = Printer Interface
      usbDevice = await (navigator as any).usb.requestDevice({
        filters: [{ classCode: 0x07 }] 
      });

      await usbDevice.open();
      await usbDevice.selectConfiguration(1);
      await usbDevice.claimInterface(0);
      
      console.log('Impressora conectada:', usbDevice.productName);
      return true;
    } catch (error) {
      console.error('Erro ao conectar impressora USB:', error);
      return false;
    }
  },

  // Método principal de impressão
  async printOrder(order: any, options: PrintOrderOptions = {}) {
    const api = typeof window !== 'undefined' ? (window as any)?.electronAPI : null;
    const isElectron = Boolean(api?.printSystem && api?.printReceipt);

    // 1. Buscar configurações
    const { data: settings } = await (supabase as any)
      .from('printer_settings')
      .select('*')
      .eq('user_id', order.user_id)
      .maybeSingle();

    if (options.onlyIfAuto) {
      if (isElectron) {
        if (settings?.auto_print === false) return;
      } else {
        if (settings?.auto_print !== true) return;
      }
    }

    const config = normalizePrintConfig(settings);

    const { data: profile } = await supabase
      .from('profiles')
      .select('restaurant_name,description,logo_url,phone,address,website')
      .eq('id', order.user_id)
      .maybeSingle();

    const { data: fiscal } = await supabase
      .from('fiscal_settings')
      .select('cnpj,nome_fantasia,endereco_logradouro,endereco_numero,endereco_complemento,endereco_bairro,endereco_municipio,endereco_uf,endereco_cep')
      .eq('user_id', order.user_id)
      .maybeSingle();

    const { data: deliveryZone } = order?.delivery_zone_id
      ? await supabase
          .from('delivery_zones')
          .select('name')
          .eq('id', order.delivery_zone_id)
          .maybeSingle()
      : { data: null as any };

    const fiscalAddressParts = [
      fiscal?.endereco_logradouro,
      fiscal?.endereco_numero,
      fiscal?.endereco_complemento,
      fiscal?.endereco_bairro,
      fiscal?.endereco_municipio,
      fiscal?.endereco_uf,
      fiscal?.endereco_cep
    ]
      .map((v: any) => String(v || '').trim())
      .filter(Boolean);
    const fiscalAddress = fiscalAddressParts.length > 0 ? fiscalAddressParts.join(', ') : '';

    const store = profile
      ? {
          name: profile.restaurant_name || '',
          restaurant_name: profile.restaurant_name || '',
          description: profile.description || '',
          logo_url: profile.logo_url || '',
          receipt_logo_url: config.receipt_logo_url,
          phone: profile.phone || '',
          address: fiscalAddress || profile.address || '',
          website: profile.website || '',
          cnpj: String(fiscal?.cnpj || '').trim() || ''
        }
      : null;

    const enrichedOrder = {
      ...order,
      delivery_zone_name: String((deliveryZone as any)?.name || order?.delivery_zone_name || '').trim(),
      store
    };

    const productIds = Array.isArray(enrichedOrder.items)
      ? enrichedOrder.items.map((it: any) => String(it?.product_id || '').trim()).filter(Boolean)
      : [];

    const [groupsByProduct, orderMaps] = await Promise.all([fetchVariationGroups(productIds), fetchVariationOrderMaps(productIds)]);

    const itemsSorted = (Array.isArray(enrichedOrder.items) ? enrichedOrder.items : []).map((it: any) => {
      const pid = String(it?.product_id || '').trim();
      const groups = pid ? groupsByProduct.get(pid) : undefined;
      const orderMap = pid ? orderMaps.get(pid) : undefined;

      const rawVarLines = Array.isArray(it?.variations) ? it.variations.map((v: any) => String(v || '').trim()).filter(Boolean) : [];
      const labeled = rawVarLines.filter((l) => l.includes(':'));
      const unlabeled = rawVarLines.filter((l) => !l.includes(':'));
      const optionNames = [...extractOptionNames(it?.options), ...unlabeled];

      let finalLines: string[] = [];
      if (labeled.length > 0) {
        finalLines = sortReceiptVariations(labeled, orderMap);
      } else if (optionNames.length > 0) {
        finalLines = optionsToReceiptLines(optionNames, groups);
      }

      return { ...it, variations: finalLines };
    });
    (enrichedOrder as any).items = itemsSorted;

    if (isElectron) {
      const resp = await printElectron(enrichedOrder, config);
      if (!resp.success) {
        toast.error(resp.error || 'Falha ao imprimir');
      }
      return;
    }

    // 2. Tentar impressão via USB (Silenciosa)
    if (usbDevice && usbDevice.opened) {
      try {
        await this.printUsb(enrichedOrder, config);
        return; // Sucesso, não abre janela
      } catch (e) {
        console.error('Falha na impressão USB, tentando fallback HTML:', e);
        // Fallback para HTML se USB falhar
      }
    }

    // 3. Fallback: Janela de Impressão HTML (Navegador)
    this.printHtml(enrichedOrder, config);
  },

  async printOrderOnAccept(order: any) {
    const api = typeof window !== 'undefined' ? (window as any)?.electronAPI : null;
    const isElectron = Boolean(api?.printSystem && api?.printReceipt);
    return this.printOrder(order, { onlyIfAuto: !isElectron });
  },

  async printCashReport(report: { title: string; lines: string[]; userId?: string }) {
    const api = typeof window !== 'undefined' ? (window as any)?.electronAPI : null;
    const isElectron = Boolean(api?.printSystem);
    let store: any = null;
    const userId = String(report.userId || '').trim();
    if (userId) {
      try {
        const [{ data: profile }, { data: fiscal }] = await Promise.all([
          supabase
            .from('profiles')
            .select('restaurant_name,description,logo_url,phone,address,website')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('fiscal_settings')
            .select('cnpj,nome_fantasia,endereco_logradouro,endereco_numero,endereco_complemento,endereco_bairro,endereco_municipio,endereco_uf,endereco_cep')
            .eq('user_id', userId)
            .maybeSingle()
        ]);

        const fiscalAddressParts = [
          (fiscal as any)?.endereco_logradouro,
          (fiscal as any)?.endereco_numero,
          (fiscal as any)?.endereco_complemento,
          (fiscal as any)?.endereco_bairro,
          (fiscal as any)?.endereco_municipio,
          (fiscal as any)?.endereco_uf,
          (fiscal as any)?.endereco_cep
        ]
          .map((v: any) => String(v || '').trim())
          .filter(Boolean);
        const fiscalAddress = fiscalAddressParts.length > 0 ? fiscalAddressParts.join(', ') : '';

        store = profile
          ? {
              name: (profile as any).restaurant_name || '',
              restaurant_name: (profile as any).restaurant_name || '',
              description: (profile as any).description || '',
              logo_url: (profile as any).logo_url || '',
              phone: (profile as any).phone || '',
              address: fiscalAddress || (profile as any).address || '',
              website: (profile as any).website || '',
              cnpj: String((fiscal as any)?.cnpj || '').trim() || ''
            }
          : null;
      } catch {}
    }

    const htmlContent = buildReportHtml(report.title, report.lines, store).replace(
      '</body>',
      `<script>window.onload=function(){window.print();}</script></body>`
    );

    if (isElectron) {
      const resp = await printReportElectron(htmlContent);
      if (!resp.success) {
        toast.error(resp.error || 'Falha ao imprimir');
      }
      return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      toast.error('Pop-up bloqueado! Permita pop-ups para imprimir.');
    }
  },

  // Impressão USB (ESC/POS)
  async printUsb(order: any, config: any) {
    if (!usbDevice) return;

    const encoder = new TextEncoder();
    let commands = '';
    const lineWidth = config.paper_width === '58mm' ? 32 : 48;

    // Helpers
    const text = (str: string) => str + '\n';
    const center = () => commands += ALIGN_CENTER;
    const left = () => commands += ALIGN_LEFT;
    const bold = (enabled: boolean) => commands += (enabled ? BOLD_ON : BOLD_OFF);
    const line = () => commands += `${'-'.repeat(lineWidth)}\n`;
    
    // Init
    commands += INIT;
    
    // Cabeçalho
    center();
    bold(true);
    const storeName = String(order?.store?.restaurant_name || order?.store?.name || config.print_header || 'RESTAURANTE').trim();
    commands += text(storeName || (config.print_header || 'RESTAURANTE'));
    bold(false);
    const storeDesc = String(order?.store?.description || '').trim();
    if (storeDesc) commands += text(storeDesc);
    const storeAddress = String(order?.store?.address || '').trim();
    if (storeAddress) commands += text(storeAddress);
    const storePhone = String(order?.store?.phone || '').trim();
    if (storePhone) commands += text(`Tel: ${storePhone}`);
    const storeCnpj = String(order?.store?.cnpj || '').trim();
    if (storeCnpj) commands += text(`CNPJ: ${storeCnpj}`);
    commands += text(new Date(order.created_at).toLocaleString('pt-BR'));
    line();

    // Senha/Pedido
    bold(true);
    if (shouldPrintTicketCode(order)) commands += text(`SENHA: ${order.order_number?.slice(-4) || '----'}`);
    bold(false);
    commands += text(`Pedido #${order.order_number}`);
    line();

    // Cliente
    left();
    bold(true);
    commands += text('CLIENTE:');
    bold(false);
    commands += text(order.customer_name || 'Balcão');
    if (order.customer_phone) commands += text(`Tel: ${order.customer_phone}`);
    const customerAddressLine = resolveCustomerAddressLine(order);
    if (customerAddressLine) commands += text(`End: ${customerAddressLine}`);
    if (order.delivery_zone_id) commands += text(`Entrega: ${order.order_type === 'delivery' ? 'Delivery' : 'Retirada'}`);
    line();

    // Itens
    bold(true);
    commands += text('ITENS:');
    bold(false);
    order.items.forEach((item: any) => {
      const quantity = Number(item.quantity || 1);
      const productName = item.product_name || item.name || 'Produto';
      const unitPrice = Number(item.price || item.unit_price || 0);
      const itemTotal = Number(item.total || item.subtotal || unitPrice * quantity || 0);

      wrapTextLine(`${quantity}x ${productName}`, lineWidth).forEach((value) => {
        commands += text(value);
      });
      // Preço e total alinhar à direita é chato em ESC/POS puro sem tabelas, vou deixar simples
      formatColumns(
        `${formatCurrencyValue(unitPrice)} x ${quantity}`,
        formatCurrencyValue(itemTotal),
        lineWidth
      ).forEach((value) => {
        commands += text(value);
      });
      const detailGroups = getOrderItemDetailGroups(item);
      for (const group of detailGroups) {
        if (group.label) {
          wrapTextLine(`   ${group.label}:`, lineWidth).forEach((lineValue) => {
            commands += text(lineValue);
          });
        }
        for (const detail of group.items) {
          wrapTextLine(
            `   ${group.label ? '- ' : ''}${detail.text}${detail.price && detail.price > 0 ? ` (${formatCurrencyValue(detail.price)})` : ''}`,
            lineWidth
          ).forEach((lineValue) => {
            commands += text(lineValue);
          });
        }
      }
      if (item.notes) {
        wrapTextLine(`   Obs: ${String(item.notes)}`, lineWidth).forEach((value) => {
          commands += text(value);
        });
      }
      commands += '\n';
    });
    line();

    // Totais
    formatColumns(
      'Subtotal',
      formatCurrencyValue(Number(order.total || 0) - Number(order.delivery_fee || 0)),
      lineWidth
    ).forEach((value) => {
      commands += text(value);
    });
    if (order.delivery_fee) {
      formatColumns('Taxa Entrega', formatCurrencyValue(Number(order.delivery_fee || 0)), lineWidth).forEach((value) => {
        commands += text(value);
      });
    }
    if (order.discount) {
      formatColumns('Desconto', `- ${formatCurrencyValue(Number(order.discount || 0))}`, lineWidth).forEach((value) => {
        commands += text(value);
      });
    }
    
    bold(true);
    formatColumns('TOTAL', formatCurrencyValue(Number(order.total || 0)), lineWidth).forEach((value) => {
      commands += text(value);
    });
    bold(false);
    
    commands += text(`Pagamento: ${order.payment_method?.toUpperCase() || 'N/A'}`);
    if (order.change_amount) {
      formatColumns('Troco para', formatCurrencyValue(Number(order.change_amount || 0)), lineWidth).forEach((value) => {
        commands += text(value);
      });
    }
    
    line();
    center();
    commands += text(config.print_footer);
    commands += text('Sistema BoraCumê');
    
    // Feed e Corte
    commands += '\n\n\n\n'; // Feed
    commands += CUT_PARTIAL;

    if (config.print_kitchen_ticket) {
      commands += buildKitchenEscPosCommands(order, lineWidth);
    }

    // Enviar dados
    const data = encoder.encode(commands);
    // Endpoint 1 geralmente é OUT em impressoras (mas pode variar, ideal é descobrir dinamicamente)
    // Vou tentar endpoint 1, se falhar, tenta outros ou itera interfaces.
    // Para simplificar: endpointNumber 1 é o padrão da maioria.
    await usbDevice.transferOut(1, data);
  },

  // Impressão HTML (Fallback)
  printHtml(order: any, config: any) {
    const printableHtml = config.print_kitchen_ticket
      ? buildCombinedTicketHtml(order, config, order.store)
      : buildOrderHtml(order, config, order.store);

    const htmlContent = printableHtml.replace(
      '</body>',
      `<script>window.onload=function(){window.print();}</script></body>`
    );

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Pop-up bloqueado! Permita pop-ups para imprimir.');
    }
  }
};
