
import { Capacitor } from '@capacitor/core';

// Conditional imports for Capacitor plugins
let Serial: any = null;
let BluetoothLe: any = null;

// Only import native plugins when running on native platform
if (Capacitor.isNativePlatform()) {
  import('@capacitor-community/serial').then(module => {
    Serial = module.Serial;
  }).catch(() => {
    console.log('Serial plugin not available');
  });
  
  import('@capacitor-community/bluetooth-le').then(module => {
    BluetoothLe = module.BluetoothLe;
  }).catch(() => {
    console.log('BluetoothLe plugin not available');
  });
}

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

    if (Capacitor.isNativePlatform() && Serial) {
      // Scan for USB Serial devices
      try {
        const serialDevices = await Serial.requestPort();
        if (serialDevices) {
          devices.push({
            id: 'usb_printer',
            name: 'Impressora USB',
            type: 'usb',
            connected: false
          });
        }
      } catch (error) {
        console.log('Nenhuma impressora USB encontrada');
      }
    }

    if (Capacitor.isNativePlatform() && BluetoothLe) {
      // Scan for Bluetooth devices
      try {
        await BluetoothLe.initialize();
        // Mock Bluetooth printers for now - in production, filter by service UUIDs
        devices.push({
          id: 'bt_printer_1',
          name: 'Impressora Bluetooth MP-4200',
          type: 'bluetooth',
          address: '00:11:22:33:44:55',
          connected: false
        });
      } catch (error) {
        console.log('Erro ao escanear Bluetooth:', error);
      }
    }

    // Web fallback or if no native devices found
    if (!Capacitor.isNativePlatform() || devices.length === 0) {
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
      if (printer.type === 'usb' && Capacitor.isNativePlatform() && Serial) {
        await Serial.open({
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        });
      } else if (printer.type === 'bluetooth' && Capacitor.isNativePlatform() && BluetoothLe) {
        await BluetoothLe.connect({
          deviceId: printer.id
        });
      }

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
      if (this.connectedPrinter.type === 'usb' && Capacitor.isNativePlatform() && Serial) {
        await Serial.close();
      } else if (this.connectedPrinter.type === 'bluetooth' && Capacitor.isNativePlatform() && BluetoothLe) {
        await BluetoothLe.disconnect({
          deviceId: this.connectedPrinter.id
        });
      }
    } catch (error) {
      console.error('Erro ao desconectar impressora:', error);
    }

    this.connectedPrinter = null;
  }

  async printReceipt(orderData: any): Promise<boolean> {
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
      orderData.items.forEach((item: any) => {
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

      // Send to printer
      if (Capacitor.isNativePlatform()) {
        if (this.connectedPrinter.type === 'usb' && Serial) {
          const dataArray = Array.from(new TextEncoder().encode(escposData));
          await Serial.write({
            data: dataArray.join(',')
          });
        } else if (this.connectedPrinter.type === 'bluetooth' && BluetoothLe) {
          const dataArray = new TextEncoder().encode(escposData);
          await BluetoothLe.write({
            deviceId: this.connectedPrinter.id,
            service: '000018f0-0000-1000-8000-00805f9b34fb',
            characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
            value: btoa(String.fromCharCode.apply(null, Array.from(dataArray)))
          });
        }
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
