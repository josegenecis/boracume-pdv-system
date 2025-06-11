
export interface ElectronDevice {
  id: string;
  name: string;
  type: 'usb' | 'bluetooth';
  manufacturer?: string;
  connected: boolean;
}

export class ElectronDeviceService {
  private connectedPrinter: ElectronDevice | null = null;
  private connectedScale: ElectronDevice | null = null;

  async scanForDevices(): Promise<ElectronDevice[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      const ports = await window.electronAPI.scanSerialPorts();
      return ports.map(port => ({
        id: port.id,
        name: port.name,
        type: port.type === 'bluetooth' ? 'bluetooth' as const : 'usb' as const,
        manufacturer: port.manufacturer,
        connected: port.connected
      }));
    } catch (error) {
      console.error('Error scanning devices:', error);
      return [];
    }
  }

  async connectPrinter(device: ElectronDevice): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      const result = await window.electronAPI.connectPrinter(device.id);
      
      if (result.success) {
        this.connectedPrinter = { ...device, connected: true };
        return true;
      } else {
        console.error('Failed to connect printer:', result.message);
        return false;
      }
    } catch (error) {
      console.error('Error connecting printer:', error);
      return false;
    }
  }

  async connectScale(device: ElectronDevice): Promise<boolean> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    try {
      const result = await window.electronAPI.connectScale(device.id);
      
      if (result.success) {
        this.connectedScale = { ...device, connected: true };
        return true;
      } else {
        console.error('Failed to connect scale:', result.message);
        return false;
      }
    } catch (error) {
      console.error('Error connecting scale:', error);
      return false;
    }
  }

  async printReceipt(orderData: any): Promise<boolean> {
    if (!window.electronAPI || !this.connectedPrinter) {
      throw new Error('Printer not connected');
    }

    try {
      const result = await window.electronAPI.printReceipt(orderData);
      
      if (result.success) {
        await window.electronAPI.showNotification(
          'Comprovante Impresso',
          `Pedido #${orderData.order_number} impresso com sucesso`
        );
        return true;
      } else {
        console.error('Failed to print:', result.message);
        return false;
      }
    } catch (error) {
      console.error('Error printing:', error);
      return false;
    }
  }

  async readWeight(): Promise<number> {
    if (!window.electronAPI || !this.connectedScale) {
      throw new Error('Scale not connected');
    }

    try {
      const result = await window.electronAPI.readWeight();
      
      if (result.success) {
        return result.weight;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error reading weight:', error);
      throw error;
    }
  }

  async disconnectPrinter(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.disconnectPrinter();
    }
    this.connectedPrinter = null;
  }

  async disconnectScale(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.disconnectScale();
    }
    this.connectedScale = null;
  }

  getConnectedPrinter(): ElectronDevice | null {
    return this.connectedPrinter;
  }

  getConnectedScale(): ElectronDevice | null {
    return this.connectedScale;
  }

  isElectronEnvironment(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI;
  }
}
