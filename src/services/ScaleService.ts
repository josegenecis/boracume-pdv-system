
import { Capacitor } from '@capacitor/core';

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

    // For now, provide mock devices since we don't have the native plugins installed
    // In a real mobile build, you would install @capacitor-community/serial and @capacitor-community/bluetooth-le
    if (Capacitor.isNativePlatform()) {
      // Mock native devices for demo purposes
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
        },
        {
          id: 'bt_scale_urano',
          name: 'Balança Urano Bluetooth',
          type: 'bluetooth',
          protocol: 'urano',
          address: '00:11:22:33:44:66',
          connected: false
        }
      );
    } else {
      // Web fallback
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
      // In a real implementation with native plugins, you would:
      // - Import and use @capacitor-community/serial for USB
      // - Import and use @capacitor-community/bluetooth-le for Bluetooth
      
      console.log(`Conectando à balança ${scale.name}...`);
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));

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
      console.log(`Desconectando balança ${this.connectedScale.name}...`);
      
      // Simulate disconnection delay
      await new Promise(resolve => setTimeout(resolve, 500));
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

      // In a real implementation, you would request weight from the connected scale
      // For now, simulate a weight reading
      setTimeout(() => {
        if (this.weightCallback) {
          const simulatedWeight = parseFloat((Math.random() * 5).toFixed(3));
          this.weightCallback(simulatedWeight);
        }
      }, 1000);
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
      // In a real implementation, you would send the command to the scale
      console.log(`Solicitando peso da balança ${this.connectedScale.name} com comando:`, command);
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

  private parseWeight(data: string, protocol: string): number | null {
    try {
      switch (protocol) {
        case 'toledo': {
          // Toledo format: "ST,GS,+00000.000kg"
          const toledoMatch = data.match(/\+?(\d+\.?\d*)/);
          return toledoMatch ? parseFloat(toledoMatch[1]) : null;
        }

        case 'filizola': {
          // Filizola format: "+00000.000"
          const filizMatch = data.match(/[+-](\d+\.?\d*)/);
          return filizMatch ? parseFloat(filizMatch[1]) : null;
        }

        case 'urano': {
          // Urano format similar to Toledo
          const uranoMatch = data.match(/\+?(\d+\.?\d*)/);
          return uranoMatch ? parseFloat(uranoMatch[1]) : null;
        }

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
