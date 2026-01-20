import { supabase } from '@/integrations/supabase/client';

export const PrinterService = {
  async printOrder(order: any) {
    // 1. Buscar configurações do usuário
    const { data: settings } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('user_id', order.user_id) // Assumindo que order tem user_id do restaurante
      .maybeSingle();

    const config = settings || {
      paper_width: '80mm',
      font_size: 'normal',
      print_header: 'BoraCumê PDV',
      print_footer: 'Obrigado!',
      copies: 1
    };

    // 2. Definir Estilos Baseados na Configuração
    const width = config.paper_width === '58mm' ? '58mm' : '80mm';
    const bodyWidth = config.paper_width === '58mm' ? '210px' : '280px'; // Margem de segurança
    const fontSize = config.font_size === 'small' ? '10px' : config.font_size === 'large' ? '14px' : '12px';

    // 3. Gerar HTML da Nota
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Pedido #${order.order_number}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: 'Courier New', Courier, monospace; /* Fonte monoespaçada alinha melhor */
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
            // Opcional: window.close() após imprimir, mas alguns browsers bloqueiam
          }
        </script>
      </body>
      </html>
    `;

    // 4. Abrir Janela de Impressão
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Pop-up bloqueado! Permita pop-ups para imprimir.');
    }
  }
};
