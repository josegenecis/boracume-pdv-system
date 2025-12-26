
interface PrinterOptions {
  width?: number; // 58mm or 80mm
  characterSet?: string;
}

export interface ReceiptData {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    options?: string[];
    notes?: string;
  }[];
  subtotal: number;
  deliveryFee?: number;
  total: number;
  paymentMethod: string;
  change?: number;
  date: string;
  type: 'delivery' | 'pickup' | 'dine_in';
  tableNumber?: string;
}

export const printerService = {
  // Gera um HTML simples para impressão via navegador (método mais compatível)
  generateReceiptHtml: (data: ReceiptData, width: '58mm' | '80mm' = '80mm') => {
    const widthStyle = width === '58mm' ? 'width: 58mm; font-size: 10px;' : 'width: 80mm; font-size: 12px;';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Recibo #${data.orderNumber}</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', Courier, monospace;
            ${widthStyle}
            color: #000;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .title { font-weight: bold; font-size: 1.2em; }
          .subtitle { font-size: 0.9em; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .info-row { display: flex; justify-content: space-between; }
          .item-row { margin-bottom: 5px; }
          .item-name { font-weight: bold; }
          .item-details { padding-left: 10px; font-size: 0.9em; }
          .total-section { margin-top: 10px; text-align: right; }
          .footer { text-align: center; margin-top: 15px; font-size: 0.8em; }
          .big-text { font-size: 1.5em; font-weight: bold; }
          @media print {
            @page { margin: 0; }
            body { margin: 5px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${data.restaurantName}</div>
          ${data.restaurantAddress ? `<div>${data.restaurantAddress}</div>` : ''}
          ${data.restaurantPhone ? `<div>${data.restaurantPhone}</div>` : ''}
        </div>
        
        <div class="divider"></div>
        
        <div style="text-align: center; margin: 10px 0;">
          <div style="font-size: 0.9em;">PEDIDO</div>
          <div class="big-text">#${data.orderNumber}</div>
          <div>${data.date}</div>
        </div>

        <div class="divider"></div>

        <div>
          <div><strong>Cliente:</strong> ${data.customerName}</div>
          ${data.customerPhone ? `<div><strong>Tel:</strong> ${data.customerPhone}</div>` : ''}
          ${data.customerAddress ? `<div><strong>End:</strong> ${data.customerAddress}</div>` : ''}
          ${data.type === 'delivery' ? '<div><strong>Tipo:</strong> ENTREGA</div>' : ''}
          ${data.type === 'pickup' ? '<div><strong>Tipo:</strong> RETIRADA</div>' : ''}
          ${data.type === 'dine_in' ? `<div><strong>Mesa:</strong> ${data.tableNumber || 'N/A'}</div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="items">
          ${data.items.map(item => `
            <div class="item-row">
              <div class="item-name">${item.quantity}x ${item.name}</div>
              <div style="text-align: right;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}</div>
              ${item.options && item.options.length > 0 ? `<div class="item-details">+ ${item.options.join(', ')}</div>` : ''}
              ${item.notes ? `<div class="item-details">Obs: ${item.notes}</div>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="divider"></div>

        <div class="total-section">
          <div class="info-row">
            <span>Subtotal:</span>
            <span>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.subtotal)}</span>
          </div>
          ${data.deliveryFee ? `
          <div class="info-row">
            <span>Taxa de Entrega:</span>
            <span>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.deliveryFee)}</span>
          </div>
          ` : ''}
          <div class="info-row" style="font-weight: bold; font-size: 1.1em; margin-top: 5px;">
            <span>TOTAL:</span>
            <span>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.total)}</span>
          </div>
        </div>

        <div class="divider"></div>

        <div>
          <div><strong>Pagamento:</strong> ${data.paymentMethod.toUpperCase()}</div>
          ${data.change ? `<div><strong>Troco para:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.change + data.total)} (Troco: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.change)})</div>` : ''}
        </div>

        <div class="footer">
          <p>Obrigado pela preferência!</p>
          <p>Sistema BoraCumê</p>
        </div>
      </body>
      </html>
    `;
  },

  print: (data: ReceiptData) => {
    const html = printerService.generateReceiptHtml(data);
    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Aguarda carregamento para imprimir
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      alert('Pop-up bloqueado. Permita pop-ups para imprimir.');
    }
  }
};
