import { supabase } from '@/integrations/supabase/client';

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
  async printOrder(order: any) {
    // 1. Buscar configurações
    const { data: settings } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('user_id', order.user_id)
      .maybeSingle();

    const config = settings || {
      paper_width: '80mm',
      font_size: 'normal',
      print_header: 'BoraCumê PDV',
      print_footer: 'Obrigado!',
      copies: 1
    };

    // 2. Tentar impressão via USB (Silenciosa)
    if (usbDevice && usbDevice.opened) {
      try {
        await this.printUsb(order, config);
        return; // Sucesso, não abre janela
      } catch (e) {
        console.error('Falha na impressão USB, tentando fallback HTML:', e);
        // Fallback para HTML se USB falhar
      }
    }

    // 3. Fallback: Janela de Impressão HTML (Navegador)
    this.printHtml(order, config);
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
    commands += text(config.print_header || 'RESTAURANTE');
    bold(false);
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
      if (item.variations && item.variations.length) commands += text(`   + ${item.variations.join(', ')}`);
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
    const width = config.paper_width === '58mm' ? '58mm' : '80mm';
    const bodyWidth = config.paper_width === '58mm' ? '210px' : '280px';
    const fontSize = config.font_size === 'small' ? '10px' : config.font_size === 'large' ? '14px' : '12px';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="center bold" style="font-size: 1.2em;">${config.print_header || 'RESTAURANTE'}</div>
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
          ${order.items.map((item: any) => `
            <div class="item-row">
              <div class="flex">
                <span style="width: 10%;">${item.quantity}x</span>
                <span style="width: 65%;">${item.product_name || item.name}</span>
                <span style="width: 25%; text-align: right;">${(item.total || item.price * item.quantity).toFixed(2)}</span>
              </div>
              ${item.variations && item.variations.length ? `<div class="notes">+ ${item.variations.join(', ')}</div>` : ''}
              ${item.notes ? `<div class="notes">Obs: ${item.notes}</div>` : ''}
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
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Pop-up bloqueado! Permita pop-ups para imprimir.');
    }
  }
};
