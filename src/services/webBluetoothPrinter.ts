export interface PrintJob {
  text?: string;
}

export const PRINTER_CONFIGS: Record<string, any> = {
  generic: {},
  epson: {},
  bematech: {},
  daruma: {},
};

export class WebBluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async connect(): Promise<boolean> {
    if (!WebBluetoothPrinter.isSupported()) return false;
    try {
      // @ts-ignore
      this.device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      if (!this.device) return false;
      this.server = await this.device.gatt?.connect() || null;
      return !!this.server;
    } catch (e) {
      console.warn('WebBluetoothPrinter connect error', e);
      return false;
    }
  }

  getDeviceInfo() {
    return { name: this.device?.name };
  }

  async testPrint() {
    // Without ESC/POS characteristic, just simulate success
    console.log('Simulated test print');
  }

  async disconnect() {
    try {
      if (this.server?.connected) {
        this.server.disconnect();
      }
      this.server = null;
      this.device = null;
    } catch (e) {
      console.warn('WebBluetoothPrinter disconnect error', e);
    }
  }
}

