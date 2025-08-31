
import { Capacitor } from '@capacitor/core';

export interface PrinterDevice {
  id: string;
  name: string;
  type: 'usb' | 'bluetooth' | 'wifi';
  address?: string;
  connected: boolean;
}

export class PrinterService {
  private connectedPrinter: PrinterDevice | null = null;

  async scanForPrinters(): Promise<PrinterDevice[]> {
    const devices: PrinterDevice[] = [];

    // For now, provide mock devices since we don't have the native plugins installed
    // In a real mobile build, you would install @capacitor-community/serial and @capacitor-community/bluetooth-le
    if (Capacitor.isNativePlatform()) {
      // Mock native devices for demo purposes
      devices.push(
        {
          id: 'usb_printer',
          name: 'Impressora USB',
          type: 'usb',
          connected: false
        },
        {
          id: 'bt_printer_1',
          name: 'Impressora Bluetooth MP-4200',
          type: 'bluetooth',
          address: '00:11:22:33:44:55',
          connected: false
        }
      );
    } else {
      // Web fallback - return mock devices
      devices.push({
        id: 'mock_printer',
        name: 'Impressora Simulada',
        type: 'usb',
        connected: false
      });
    }

    return devices;
  }

  async connectToPrinter(printer: PrinterDevice): Promise<boolean> {
    try {
      // In a real implementation with native plugins, you would:
      // - Import and use @capacitor-community/serial for USB
      // - Import and use @capacitor-community/bluetooth-le for Bluetooth
      
      console.log(`Conectando à impressora ${printer.name}...`);
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.connectedPrinter = { ...printer, connected: true };
      return true;
    } catch (error) {
      console.error('Erro ao conectar impressora:', error);
      return false;
    }
  }

  async disconnectPrinter(): Promise<void> {
    if (!this.connectedPrinter) return;

    try {
      console.log(`Desconectando impressora ${this.connectedPrinter.name}...`);
      
      // Simulate disconnection delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Erro ao desconectar impressora:', error);
    }

    this.connectedPrinter = null;
  }

  async printReceipt(orderData: {
    order_number: string;
    customer_name: string;
    customer_phone?: string;
    items: Array<{
      quantity: number;
      product_name: string;
      subtotal: number;
      notes?: string;
    }>;
    total: number;
  }): Promise<boolean> {
    if (!this.connectedPrinter) {
      throw new Error('Nenhuma impressora conectada');
    }

    try {
      // Create simple ESC/POS commands as string
      let escposData = '';
      
      // Header
      escposData += '\x1B\x61\x01'; // Center align
      escposData += '\x1B\x45\x01'; // Bold on
      escposData += 'BORA CUME HUB\n';
      escposData += '\x1B\x45\x00'; // Bold off
      escposData += '--------------------------------\n';
      escposData += '\x1B\x61\x00'; // Left align
      escposData += `Pedido: #${orderData.order_number}\n`;
      escposData += `Cliente: ${orderData.customer_name}\n`;

      if (orderData.customer_phone) {
        escposData += `Telefone: ${orderData.customer_phone}\n`;
      }

      escposData += '--------------------------------\n';

      // Items
      orderData.items.forEach((item) => {
        escposData += `${item.quantity}x ${item.product_name}\n`;
        escposData += '\x1B\x61\x02'; // Right align
        escposData += `R$ ${item.subtotal.toFixed(2)}\n`;
        escposData += '\x1B\x61\x00'; // Left align

        if (item.notes) {
          escposData += `Obs: ${item.notes}\n`;
        }
      });

      escposData += '--------------------------------\n';
      escposData += '\x1B\x61\x02'; // Right align
      escposData += '\x1B\x45\x01'; // Bold on
      escposData += `TOTAL: R$ ${orderData.total.toFixed(2)}\n`;
      escposData += '\x1B\x45\x00'; // Bold off
      escposData += '\x1B\x61\x01'; // Center align
      escposData += '--------------------------------\n';
      escposData += 'Obrigado pela preferência!\n\n\n';
      
      // Cut paper command
      escposData += '\x1D\x56\x00';

      // Simulate printing in web environment or send to native printer
      if (Capacitor.isNativePlatform()) {
        // In a real implementation, you would use the native plugins here
        console.log('Enviando para impressora nativa:', this.connectedPrinter.name);
      } else {
        // Web fallback - simulate printing
        console.log('Imprimindo (simulado):', orderData);
        console.log('ESC/POS Data:', escposData);
      }

      return true;
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      return false;
    }
  }

  getConnectedPrinter(): PrinterDevice | null {
    return this.connectedPrinter;
  }
}
