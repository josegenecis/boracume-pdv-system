
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

export interface ScaleDevice {
  id: string;
  name: string;
  type: 'usb' | 'bluetooth';
  protocol: 'toledo' | 'filizola' | 'urano';
  address?: string;
  connected: boolean;
}

export class ScaleService {
  private connectedScale: ScaleDevice | null = null;
  private weightCallback: ((weight: number) => void) | null = null;

  async scanForScales(): Promise<ScaleDevice[]> {
    const devices: ScaleDevice[] = [];

    if (Capacitor.isNativePlatform() && Serial) {
      // Scan for USB Serial devices
      try {
        const serialDevices = await Serial.requestPort();
        if (serialDevices) {
          devices.push(
            {
              id: 'usb_scale_toledo',
              name: 'Balança Toledo USB',
              type: 'usb',
              protocol: 'toledo',
              connected: false
            },
            {
              id: 'usb_scale_filizola',
              name: 'Balança Filizola USB',
              type: 'usb',
              protocol: 'filizola',
              connected: false
            }
          );
        }
      } catch (error) {
        console.log('Nenhuma balança USB encontrada');
      }
    }

    if (Capacitor.isNativePlatform() && BluetoothLe) {
      // Scan for Bluetooth devices
      try {
        await BluetoothLe.initialize();
        devices.push({
          id: 'bt_scale_urano',
          name: 'Balança Urano Bluetooth',
          type: 'bluetooth',
          protocol: 'urano',
          address: '00:11:22:33:44:66',
          connected: false
        });
      } catch (error) {
        console.log('Erro ao escanear Bluetooth:', error);
      }
    }

    // Web fallback or if no native devices found
    if (!Capacitor.isNativePlatform() || devices.length === 0) {
      devices.push({
        id: 'mock_scale',
        name: 'Balança Simulada',
        type: 'usb',
        protocol: 'toledo',
        connected: false
      });
    }

    return devices;
  }

  async connectToScale(scale: ScaleDevice): Promise<boolean> {
    try {
      if (scale.type === 'usb' && Capacitor.isNativePlatform() && Serial) {
        await Serial.open({
          baudRate: this.getBaudRate(scale.protocol),
          dataBits: 8,
          stopBits: 1,
          parity: 'none'
        });

        // Start listening for weight data
        this.startWeightListener(scale.protocol);
      } else if (scale.type === 'bluetooth' && Capacitor.isNativePlatform() && BluetoothLe) {
        await BluetoothLe.connect({
          deviceId: scale.id
        });
      }

      this.connectedScale = { ...scale, connected: true };
      return true;
    } catch (error) {
      console.error('Erro ao conectar balança:', error);
      return false;
    }
  }

  async disconnectScale(): Promise<void> {
    if (!this.connectedScale) return;

    try {
      if (this.connectedScale.type === 'usb' && Capacitor.isNativePlatform() && Serial) {
        await Serial.close();
      } else if (this.connectedScale.type === 'bluetooth' && Capacitor.isNativePlatform() && BluetoothLe) {
        await BluetoothLe.disconnect({
          deviceId: this.connectedScale.id
        });
      }
    } catch (error) {
      console.error('Erro ao desconectar balança:', error);
    }

    this.connectedScale = null;
    this.weightCallback = null;
  }

  async getWeight(): Promise<number> {
    if (!this.connectedScale) {
      throw new Error('Nenhuma balança conectada');
    }

    if (!Capacitor.isNativePlatform()) {
      // Web fallback - simulate weight
      return parseFloat((Math.random() * 5).toFixed(3));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout na leitura do peso'));
      }, 5000);

      this.weightCallback = (weight: number) => {
        clearTimeout(timeout);
        this.weightCallback = null;
        resolve(weight);
      };

      // Request weight from scale
      this.requestWeight();
    });
  }

  private getBaudRate(protocol: string): number {
    switch (protocol) {
      case 'toledo': return 9600;
      case 'filizola': return 4800;
      case 'urano': return 9600;
      default: return 9600;
    }
  }

  private async requestWeight(): Promise<void> {
    if (!this.connectedScale || !Capacitor.isNativePlatform()) return;

    const command = this.getWeightCommand(this.connectedScale.protocol);
    
    try {
      if (this.connectedScale.type === 'usb' && Serial) {
        await Serial.write({ data: command });
      } else if (this.connectedScale.type === 'bluetooth' && BluetoothLe) {
        await BluetoothLe.write({
          deviceId: this.connectedScale.id,
          service: '000018f0-0000-1000-8000-00805f9b34fb',
          characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
          value: btoa(command)
        });
      }
    } catch (error) {
      console.error('Erro ao solicitar peso:', error);
    }
  }

  private getWeightCommand(protocol: string): string {
    switch (protocol) {
      case 'toledo': return '\x05'; // ENQ command
      case 'filizola': return 'P\r\n'; // P command
      case 'urano': return '\x05'; // ENQ command
      default: return '\x05';
    }
  }

  private startWeightListener(protocol: string): void {
    if (!Capacitor.isNativePlatform() || !Serial) return;

    Serial.addListener('dataReceived', (data: any) => {
      try {
        const weight = this.parseWeight(data.data, protocol);
        if (weight !== null && this.weightCallback) {
          this.weightCallback(weight);
        }
      } catch (error) {
        console.error('Erro ao interpretar dados da balança:', error);
      }
    });
  }

  private parseWeight(data: string, protocol: string): number | null {
    try {
      switch (protocol) {
        case 'toledo':
          // Toledo format: "ST,GS,+00000.000kg"
          const toledoMatch = data.match(/\+?(\d+\.?\d*)/);
          return toledoMatch ? parseFloat(toledoMatch[1]) : null;

        case 'filizola':
          // Filizola format: "+00000.000"
          const filizMatch = data.match(/[+-](\d+\.?\d*)/);
          return filizMatch ? parseFloat(filizMatch[1]) : null;

        case 'urano':
          // Urano format similar to Toledo
          const uranoMatch = data.match(/\+?(\d+\.?\d*)/);
          return uranoMatch ? parseFloat(uranoMatch[1]) : null;

        default:
          return null;
      }
    } catch (error) {
      console.error('Erro ao fazer parse do peso:', error);
      return null;
    }
  }

  getConnectedScale(): ScaleDevice | null {
    return this.connectedScale;
  }

  setWeightCallback(callback: (weight: number) => void): void {
    this.weightCallback = callback;
  }
}
