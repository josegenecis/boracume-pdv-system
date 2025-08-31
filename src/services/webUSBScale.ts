/**
 * Serviço para integração com balanças via Web USB API
 * Suporta balanças que se comunicam via USB HID ou USB Serial
 */

export interface USBScaleReading {
  weight: number;
  unit: 'kg' | 'g' | 'lb';
  stable: boolean;
  timestamp: Date;
}

export interface USBScaleConfig {
  vendorId: number;
  productId: number;
  interfaceNumber: number;
  endpointIn: number;
  endpointOut?: number;
}

// Configurações para balanças USB conhecidas
export const USB_SCALE_CONFIGS: Record<string, USBScaleConfig[]> = {
  toledo: [
    { vendorId: 0x0eb8, productId: 0xf000, interfaceNumber: 0, endpointIn: 0x81 },
    { vendorId: 0x24ea, productId: 0x0001, interfaceNumber: 0, endpointIn: 0x81 }
  ],
  filizola: [
    { vendorId: 0x1234, productId: 0x5678, interfaceNumber: 0, endpointIn: 0x81 }
  ],
  urano: [
    { vendorId: 0x04d8, productId: 0x000a, interfaceNumber: 0, endpointIn: 0x81 }
  ],
  generic: [
    // Filtros genéricos para balanças USB HID
    { vendorId: 0x0922, productId: 0x8003, interfaceNumber: 0, endpointIn: 0x81 },
    { vendorId: 0x0922, productId: 0x8004, interfaceNumber: 0, endpointIn: 0x81 }
  ]
};

export class WebUSBScale {
  private device: USBDevice | null = null;
  private config: USBScaleConfig | null = null;
  private isReading = false;
  private onDataCallback?: (reading: USBScaleReading) => void;
  private readingInterval?: number;

  /**
   * Verifica se o navegador suporta Web USB API
   */
  static isSupported(): boolean {
    return 'usb' in navigator;
  }

  /**
   * Solicita permissão e conecta com uma balança USB
   */
  async connect(): Promise<boolean> {
    try {
      if (!WebUSBScale.isSupported()) {
        throw new Error('Web USB API não é suportada neste navegador');
      }

      // Cria filtros para diferentes tipos de balanças
      const filters = Object.values(USB_SCALE_CONFIGS)
        .flat()
        .map(config => ({
          vendorId: config.vendorId,
          productId: config.productId
        }));

      // Solicita ao usuário para selecionar um dispositivo USB
      this.device = await navigator.usb.requestDevice({ filters });
      
      if (!this.device) {
        throw new Error('Nenhum dispositivo selecionado');
      }

      // Encontra a configuração correspondente
      this.config = this.findDeviceConfig(this.device);
      if (!this.config) {
        throw new Error('Configuração não encontrada para este dispositivo');
      }

      // Abre o dispositivo
      await this.device.open();
      
      // Seleciona a configuração (geralmente a primeira)
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }
      
      // Reivindica a interface
      await this.device.claimInterface(this.config.interfaceNumber);

      console.log('Balança USB conectada:', {
        vendorId: this.device.vendorId,
        productId: this.device.productId,
        productName: this.device.productName,
        manufacturerName: this.device.manufacturerName
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao conectar com a balança USB:', error);
      return false;
    }
  }

  /**
   * Desconecta da balança USB
   */
  async disconnect(): Promise<void> {
    try {
      this.stopReading();
      
      if (this.device && this.config) {
        await this.device.releaseInterface(this.config.interfaceNumber);
        await this.device.close();
      }
      
      this.device = null;
      this.config = null;
      
      console.log('Balança USB desconectada');
    } catch (error) {
      console.error('Erro ao desconectar da balança USB:', error);
    }
  }

  /**
   * Inicia a leitura contínua de dados da balança
   */
  startReading(onData: (reading: USBScaleReading) => void): void {
    if (!this.device || !this.config || this.isReading) {
      return;
    }

    this.onDataCallback = onData;
    this.isReading = true;
    this.startReadingLoop();
  }

  /**
   * Para a leitura de dados
   */
  stopReading(): void {
    this.isReading = false;
    this.onDataCallback = undefined;
    
    if (this.readingInterval) {
      clearInterval(this.readingInterval);
      this.readingInterval = undefined;
    }
  }

  /**
   * Inicia o loop de leitura
   */
  private startReadingLoop(): void {
    if (!this.device || !this.config) {
      return;
    }

    // Lê dados a cada 100ms
    this.readingInterval = window.setInterval(async () => {
      if (!this.isReading) {
        return;
      }

      try {
        const reading = await this.readWeight();
        if (reading && this.onDataCallback) {
          this.onDataCallback(reading);
        }
      } catch (error) {
        console.error('Erro na leitura USB:', error);
      }
    }, 100);
  }

  /**
   * Lê o peso da balança
   */
  async readWeight(): Promise<USBScaleReading | null> {
    if (!this.device || !this.config) {
      return null;
    }

    try {
      // Lê dados do endpoint de entrada
      const result = await this.device.transferIn(
        this.config.endpointIn,
        64 // Tamanho típico do buffer para balanças HID
      );

      if (result.status === 'ok' && result.data) {
        return this.parseUSBData(result.data);
      }
      
      return null;
    } catch (error) {
      // Erro silencioso para não poluir o console durante leitura contínua
      return null;
    }
  }

  /**
   * Interpreta os dados USB da balança
   */
  private parseUSBData(data: DataView): USBScaleReading | null {
    try {
      // Formato típico de balanças USB HID:
      // Byte 0: Status (0x03 = peso estável, 0x02 = peso instável)
      // Byte 1: Unidade (0x02 = gramas, 0x03 = quilos, 0x0B = libras)
      // Bytes 2-5: Peso (little-endian, signed)
      
      if (data.byteLength < 6) {
        return null;
      }

      const status = data.getUint8(0);
      const unitByte = data.getUint8(1);
      
      // Lê o peso como inteiro de 32 bits (little-endian)
      const weightRaw = data.getInt32(2, true);
      
      // Determina a unidade
      let unit: 'kg' | 'g' | 'lb';
      let weight: number;
      
      switch (unitByte) {
        case 0x02: // Gramas
          unit = 'g';
          weight = weightRaw / 100; // Divide por 100 para obter gramas com decimais
          break;
        case 0x03: // Quilos
          unit = 'kg';
          weight = weightRaw / 1000; // Divide por 1000 para obter quilos com decimais
          break;
        case 0x0B: // Libras
          unit = 'lb';
          weight = weightRaw / 100;
          break;
        default:
          // Tenta interpretar como gramas por padrão
          unit = 'g';
          weight = weightRaw / 100;
      }

      // Verifica se o peso é válido
      if (isNaN(weight) || weight < 0) {
        return null;
      }

      return {
        weight,
        unit,
        stable: (status & 0x01) === 0x01, // Bit 0 indica estabilidade
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Erro ao interpretar dados USB:', error);
      return null;
    }
  }

  /**
   * Encontra a configuração para o dispositivo conectado
   */
  private findDeviceConfig(device: USBDevice): USBScaleConfig | null {
    for (const configs of Object.values(USB_SCALE_CONFIGS)) {
      for (const config of configs) {
        if (config.vendorId === device.vendorId && config.productId === device.productId) {
          return config;
        }
      }
    }
    return null;
  }

  /**
   * Envia comando para a balança (se suportado)
   */
  async sendCommand(command: Uint8Array): Promise<boolean> {
    if (!this.device || !this.config || !this.config.endpointOut) {
      return false;
    }

    try {
      const result = await this.device.transferOut(this.config.endpointOut, command);
      return result.status === 'ok';
    } catch (error) {
      console.error('Erro ao enviar comando USB:', error);
      return false;
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.device !== null && this.device.opened;
  }

  /**
   * Obtém informações do dispositivo conectado
   */
  getDeviceInfo(): USBDevice | null {
    return this.device;
  }

  /**
   * Lista dispositivos USB conectados (requer permissão prévia)
   */
  static async getConnectedDevices(): Promise<USBDevice[]> {
    if (!WebUSBScale.isSupported()) {
      return [];
    }

    try {
      return await navigator.usb.getDevices();
    } catch (error) {
      console.error('Erro ao listar dispositivos USB:', error);
      return [];
    }
  }
}