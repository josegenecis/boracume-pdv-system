
import { Capacitor } from '@capacitor/core';
import { Serial } from '@capacitor-community/serial';
import { BluetoothLe } from '@capacitor-community/bluetooth-le';
import * as escpos from 'escpos-buffer';

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

    if (Capacitor.isNativePlatform()) {
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

      // Scan for Bluetooth devices
      try {
        await BluetoothLe.initialize();
        const scanResult = await BluetoothLe.requestLEScan({
          services: [],
          allowDuplicates: false,
          scanMode: 1
        });

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
      if (printer.type === 'usb' && Capacitor.isNativePlatform()) {
        await Serial.open({
          baudRate: 9600,
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        });
      } else if (printer.type === 'bluetooth' && Capacitor.isNativePlatform()) {
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
      if (this.connectedPrinter.type === 'usb' && Capacitor.isNativePlatform()) {
        await Serial.close();
      } else if (this.connectedPrinter.type === 'bluetooth' && Capacitor.isNativePlatform()) {
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
      // Create ESC/POS buffer using the correct API
      const buffer = escpos()
        .align('center')
        .style('B')
        .text('BORA CUME HUB')
        .style('NORMAL')
        .text('\n--------------------------------\n')
        .align('left')
        .text(`Pedido: #${orderData.order_number}\n`)
        .text(`Cliente: ${orderData.customer_name}\n`);

      if (orderData.customer_phone) {
        buffer.text(`Telefone: ${orderData.customer_phone}\n`);
      }

      buffer.text('--------------------------------\n');

      // Items
      orderData.items.forEach((item: any) => {
        buffer
          .text(`${item.quantity}x ${item.product_name}\n`)
          .align('right')
          .text(`R$ ${item.subtotal.toFixed(2)}\n`)
          .align('left');

        if (item.notes) {
          buffer.text(`Obs: ${item.notes}\n`);
        }
      });

      buffer
        .text('--------------------------------\n')
        .align('right')
        .style('B')
        .text(`TOTAL: R$ ${orderData.total.toFixed(2)}\n`)
        .style('NORMAL')
        .align('center')
        .text('--------------------------------\n')
        .text('Obrigado pela preferência!\n\n\n');

      const data = buffer.encode();

      // Send to printer
      if (Capacitor.isNativePlatform()) {
        if (this.connectedPrinter.type === 'usb') {
          await Serial.write({
            data: Array.from(data).join(',')
          });
        } else if (this.connectedPrinter.type === 'bluetooth') {
          await BluetoothLe.write({
            deviceId: this.connectedPrinter.id,
            service: '000018f0-0000-1000-8000-00805f9b34fb',
            characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
            value: btoa(String.fromCharCode.apply(null, Array.from(data)))
          });
        }
      } else {
        // Web fallback - simulate printing
        console.log('Imprimindo (simulado):', orderData);
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
