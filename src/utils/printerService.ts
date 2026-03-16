import { supabase } from '@/integrations/supabase/client';
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

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
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
  const bodyWidth = config.paper_width === '58mm' ? '210px' : '280px';
  const fontSize = config.font_size === 'small' ? '10px' : config.font_size === 'large' ? '14px' : '12px';
  const storeName = escapeHtml(store?.restaurant_name || store?.name || config.print_header || 'RESTAURANTE');
  const storeDesc = escapeHtml(store?.description || '');
  const storeLogo = String(store?.logo_url || '').trim();
  const storeLogoHtml = storeLogo ? `<img src="${escapeHtml(storeLogo)}" alt="Logo" style="max-width: 160px; max-height: 60px; object-fit: contain; margin: 0 auto 6px auto; display:block;" />` : '';

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Imprimir Pedido #${order.order_number}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${width};
            margin: 0;
            padding: 5px;
            font-size: ${fontSize};
            color: #000;
            line-height: 1.2;
          }
          .container {
            width: 100%;
            max-width: ${bodyWidth};
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .flex { display: flex; justify-content: space-between; }
          .item-row { margin-bottom: 4px; }
          .notes { font-size: 0.9em; font-style: italic; margin-left: 10px; }
          .total-row { font-size: 1.2em; margin-top: 10px; }
          .muted { color: #333; font-size: 0.95em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="center">
            ${storeLogoHtml}
          </div>
          <div class="center bold" style="font-size: 1.2em;">${storeName}</div>
          ${storeDesc ? `<div class="center muted" style="margin-top: 2px;">${storeDesc}</div>` : ''}
          <div class="center">${new Date(order.created_at).toLocaleString('pt-BR')}</div>
          <div class="divider"></div>
          
          <div class="center bold" style="font-size: 1.4em;">SENHA: ${order.order_number?.slice(-4) || '----'}</div>
          <div class="center">Pedido #${order.order_number}</div>
          
          <div class="divider"></div>
          
          <div class="bold">CLIENTE:</div>
          <div>${order.customer_name || 'Balcão'}</div>
          ${order.customer_phone ? `<div>Tel: ${order.customer_phone}</div>` : ''}
          ${order.customer_address ? `<div>End: ${order.customer_address}</div>` : ''}
          ${order.delivery_zone_id ? `<div>Entrega: ${order.order_type === 'delivery' ? 'Delivery' : 'Retirada'}</div>` : ''}
          
          <div class="divider"></div>
          
          <div class="bold" style="margin-bottom: 5px;">ITENS:</div>
          ${(order.items || []).map((item: any) => `
            <div class="item-row">
              <div class="flex">
                <span style="width: 10%;">${item.quantity}x</span>
                <span style="width: 65%;">${item.product_name || item.name}</span>
                <span style="width: 25%; text-align: right;">${(item.total || item.subtotal || item.price * item.quantity).toFixed(2)}</span>
              </div>
              ${item.variations && item.variations.length ? item.variations.map((v: any) => `<div class="notes">${escapeHtml(v)}</div>`).join('') : ''}
              ${item.notes ? `<div class="notes">Obs: ${escapeHtml(item.notes)}</div>` : ''}
            </div>
          `).join('')}
          
          <div class="divider"></div>
          
          <div class="flex">
            <span>Subtotal:</span>
            <span>R$ ${(order.total - (order.delivery_fee || 0)).toFixed(2)}</span>
          </div>
          ${order.delivery_fee ? `
          <div class="flex">
            <span>Taxa Entrega:</span>
            <span>R$ ${order.delivery_fee.toFixed(2)}</span>
          </div>` : ''}
          ${order.discount ? `
          <div class="flex">
            <span>Desconto:</span>
            <span>- R$ ${order.discount.toFixed(2)}</span>
          </div>` : ''}
          
          <div class="divider"></div>
          
          <div class="flex total-row bold">
            <span>TOTAL:</span>
            <span>R$ ${order.total.toFixed(2)}</span>
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

function buildReportHtml(title: string, lines: string[]) {
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
        <div class="center bold">${title}</div>
        <div class="divider"></div>
        ${lines.map((l) => `<div class="line">${String(l).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('')}
        <div class="divider"></div>
        <div class="center" style="font-size: 0.8em;">Sistema BoraCumê</div>
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
    date: order.created_at,
    items: (Array.isArray(order.items) ? order.items : []).map((it: any) => ({
      product_name: it.product_name || it.name,
      name: it.product_name || it.name,
      quantity: Number(it.quantity || 1),
      price: Number(it.price || it.unit_price || 0),
      subtotal: Number(it.subtotal || it.total || (Number(it.price || 0) * Number(it.quantity || 1)) || 0),
      notes: it.notes || it.observations || ''
    })),
    total: Number(order.total || 0),
    subtotal: Number(order.total || 0) - Number(order.delivery_fee || 0),
    discount: Number(order.discount || 0),
    delivery_fee: Number(order.delivery_fee || 0),
    payment_method: String(order.payment_method || '').toUpperCase()
  };

  const conn = await api.connectPrinter(deviceId, protocol, { protocol, width: 48 });
  if (!conn?.success) return { success: false, error: conn?.error || conn?.message || 'Falha ao conectar impressora' };

  for (let i = 0; i < copies; i++) {
    const resp = await api.printReceipt(deviceId, normalized, 'receipt');
    if (!resp?.success) return { success: false, error: resp?.error || resp?.message || 'Falha ao imprimir' };
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
    const { data: settings } = await supabase
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

    const config = settings || {
      paper_width: '80mm',
      font_size: 'normal',
      print_header: 'BoraCumê PDV',
      print_footer: 'Obrigado!',
      copies: 1
    };

    const { data: profile } = await supabase
      .from('profiles')
      .select('restaurant_name,description,logo_url,phone,address,website')
      .eq('id', order.user_id)
      .maybeSingle();

    const store = profile
      ? {
          name: profile.restaurant_name || '',
          restaurant_name: profile.restaurant_name || '',
          description: profile.description || '',
          logo_url: profile.logo_url || '',
          phone: profile.phone || '',
          address: profile.address || '',
          website: profile.website || ''
        }
      : null;

    const enrichedOrder = { ...order, store };

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

  async printCashReport(report: { title: string; lines: string[] }) {
    const api = typeof window !== 'undefined' ? (window as any)?.electronAPI : null;
    const isElectron = Boolean(api?.printSystem);
    const htmlContent = buildReportHtml(report.title, report.lines).replace(
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

    // Helpers
    const text = (str: string) => str + '\n';
    const center = () => commands += ALIGN_CENTER;
    const left = () => commands += ALIGN_LEFT;
    const bold = (enabled: boolean) => commands += (enabled ? BOLD_ON : BOLD_OFF);
    const line = () => commands += '--------------------------------\n'; // Ajustar para 58mm/80mm se quiser
    
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
    commands += text(new Date(order.created_at).toLocaleString('pt-BR'));
    line();

    // Senha/Pedido
    bold(true);
    commands += text(`SENHA: ${order.order_number?.slice(-4) || '----'}`);
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
    if (order.customer_address) commands += text(`End: ${order.customer_address}`);
    if (order.delivery_zone_id) commands += text(`Entrega: ${order.order_type === 'delivery' ? 'Delivery' : 'Retirada'}`);
    line();

    // Itens
    bold(true);
    commands += text('ITENS:');
    bold(false);
    order.items.forEach((item: any) => {
      commands += text(`${item.quantity}x ${item.product_name || item.name}`);
      // Preço e total alinhar à direita é chato em ESC/POS puro sem tabelas, vou deixar simples
      commands += text(`   R$ ${(item.total || item.price * item.quantity).toFixed(2)}`);
      if (item.variations && item.variations.length) {
        for (const v of item.variations) {
          if (!v) continue;
          commands += text(`   ${String(v)}`);
        }
      }
      if (item.notes) commands += text(`   Obs: ${item.notes}`);
      commands += '\n';
    });
    line();

    // Totais
    commands += text(`Subtotal: R$ ${(order.total - (order.delivery_fee || 0)).toFixed(2)}`);
    if (order.delivery_fee) commands += text(`Taxa Entrega: R$ ${order.delivery_fee.toFixed(2)}`);
    if (order.discount) commands += text(`Desconto: - R$ ${order.discount.toFixed(2)}`);
    
    bold(true);
    commands += text(`TOTAL: R$ ${order.total.toFixed(2)}`);
    bold(false);
    
    commands += text(`Pagamento: ${order.payment_method?.toUpperCase() || 'N/A'}`);
    if (order.change_amount) commands += text(`Troco para: R$ ${order.change_amount.toFixed(2)}`);
    
    line();
    center();
    commands += text(config.print_footer);
    commands += text('Sistema BoraCumê');
    
    // Feed e Corte
    commands += '\n\n\n\n'; // Feed
    commands += CUT_PARTIAL;

    // Enviar dados
    const data = encoder.encode(commands);
    // Endpoint 1 geralmente é OUT em impressoras (mas pode variar, ideal é descobrir dinamicamente)
    // Vou tentar endpoint 1, se falhar, tenta outros ou itera interfaces.
    // Para simplificar: endpointNumber 1 é o padrão da maioria.
    await usbDevice.transferOut(1, data);
  },

  // Impressão HTML (Fallback)
  printHtml(order: any, config: any) {
    const htmlContent = buildOrderHtml(order, config, order.store).replace(
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
