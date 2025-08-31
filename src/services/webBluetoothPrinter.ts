/**
 * Serviço para integração com impressoras térmicas via Web Bluetooth API
 * Suporta impressoras que usam protocolo ESC/POS
 */

export interface PrinterConfig {
  serviceUUID: string;
  characteristicUUID: string;
  name?: string;
}

export interface PrintJob {
  text: string;
  fontSize?: 'small' | 'normal' | 'large';
  alignment?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  cutPaper?: boolean;
}

// Configurações para impressoras Bluetooth conhecidas
export const PRINTER_CONFIGS: Record<string, PrinterConfig> = {
  generic: {
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb', // Serial Port Service
    characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb'
  },
  epson: {
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
    name: 'TM-'
  },
  bematech: {
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
    name: 'MP-'
  },
  daruma: {
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
    name: 'DR-'
  }
};

// Comandos ESC/POS
export class ESCPOSCommands {
  // Comandos básicos
  static readonly ESC = 0x1B;
  static readonly GS = 0x1D;
  static readonly LF = 0x0A;
  static readonly CR = 0x0D;
  static readonly CUT = new Uint8Array([0x1D, 0x56, 0x00]); // Cortar papel
  
  // Inicialização
  static init(): Uint8Array {
    return new Uint8Array([this.ESC, 0x40]); // ESC @
  }
  
  // Alinhamento
  static alignLeft(): Uint8Array {
    return new Uint8Array([this.ESC, 0x61, 0x00]); // ESC a 0
  }
  
  static alignCenter(): Uint8Array {
    return new Uint8Array([this.ESC, 0x61, 0x01]); // ESC a 1
  }
  
  static alignRight(): Uint8Array {
    return new Uint8Array([this.ESC, 0x61, 0x02]); // ESC a 2
  }
  
  // Tamanho da fonte
  static fontSizeNormal(): Uint8Array {
    return new Uint8Array([this.GS, 0x21, 0x00]); // GS ! 0
  }
  
  static fontSizeLarge(): Uint8Array {
    return new Uint8Array([this.GS, 0x21, 0x11]); // GS ! 17 (2x width and height)
  }
  
  static fontSizeSmall(): Uint8Array {
    return new Uint8Array([this.ESC, 0x4D, 0x01]); // ESC M 1
  }
  
  // Estilo
  static boldOn(): Uint8Array {
    return new Uint8Array([this.ESC, 0x45, 0x01]); // ESC E 1
  }
  
  static boldOff(): Uint8Array {
    return new Uint8Array([this.ESC, 0x45, 0x00]); // ESC E 0
  }
  
  static underlineOn(): Uint8Array {
    return new Uint8Array([this.ESC, 0x2D, 0x01]); // ESC - 1
  }
  
  static underlineOff(): Uint8Array {
    return new Uint8Array([this.ESC, 0x2D, 0x00]); // ESC - 0
  }
  
  // Quebra de linha
  static newLine(): Uint8Array {
    return new Uint8Array([this.LF]);
  }
  
  // Texto
  static text(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }
}

export class WebBluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private config: PrinterConfig;

  constructor(config: PrinterConfig = PRINTER_CONFIGS.generic) {
    this.config = config;
  }

  /**
   * Verifica se o navegador suporta Web Bluetooth API
   */
  static isSupported(): boolean {
    return 'bluetooth' in navigator;
  }

  /**
   * Solicita permissão e conecta com uma impressora Bluetooth
   */
  async connect(): Promise<boolean> {
    try {
      if (!WebBluetoothPrinter.isSupported()) {
        throw new Error('Web Bluetooth API não é suportada neste navegador');
      }

      // Opções de filtro para encontrar impressoras
      const options: RequestDeviceOptions = {
        filters: [
          { services: [this.config.serviceUUID] }
        ],
        optionalServices: [this.config.serviceUUID]
      };

      // Se há um nome específico, adiciona ao filtro
      if (this.config.name) {
        options.filters = [
          { 
            services: [this.config.serviceUUID],
            namePrefix: this.config.name
          }
        ];
      }

      // Solicita ao usuário para selecionar um dispositivo
      this.device = await navigator.bluetooth.requestDevice(options);
      
      if (!this.device) {
        throw new Error('Nenhum dispositivo selecionado');
      }

      // Conecta ao servidor GATT
      this.server = await this.device.gatt!.connect();
      
      // Obtém o serviço
      this.service = await this.server.getPrimaryService(this.config.serviceUUID);
      
      // Obtém a característica
      this.characteristic = await this.service.getCharacteristic(this.config.characteristicUUID);

      console.log('Impressora Bluetooth conectada:', {
        name: this.device.name,
        id: this.device.id
      });
      
      // Inicializa a impressora
      await this.sendCommand(ESCPOSCommands.init());
      
      return true;
    } catch (error) {
      console.error('Erro ao conectar com a impressora Bluetooth:', error);
      return false;
    }
  }

  /**
   * Desconecta da impressora
   */
  async disconnect(): Promise<void> {
    try {
      if (this.server && this.server.connected) {
        this.server.disconnect();
      }
      
      this.characteristic = null;
      this.service = null;
      this.server = null;
      this.device = null;
      
      console.log('Impressora Bluetooth desconectada');
    } catch (error) {
      console.error('Erro ao desconectar da impressora:', error);
    }
  }

  /**
   * Envia comando para a impressora
   */
  private async sendCommand(command: Uint8Array): Promise<boolean> {
    if (!this.characteristic) {
      return false;
    }

    try {
      // Divide comandos grandes em chunks menores (máximo 20 bytes por vez)
      const chunkSize = 20;
      for (let i = 0; i < command.length; i += chunkSize) {
        const chunk = command.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
        
        // Pequena pausa entre chunks para evitar overflow
        if (i + chunkSize < command.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao enviar comando para impressora:', error);
      return false;
    }
  }

  /**
   * Imprime texto simples
   */
  async printText(text: string): Promise<boolean> {
    const commands = [
      ESCPOSCommands.init(),
      ESCPOSCommands.text(text),
      ESCPOSCommands.newLine(),
      ESCPOSCommands.newLine()
    ];

    for (const command of commands) {
      const success = await this.sendCommand(command);
      if (!success) {
        return false;
      }
    }

    return true;
  }

  /**
   * Imprime com formatação avançada
   */
  async print(job: PrintJob): Promise<boolean> {
    try {
      const commands: Uint8Array[] = [];
      
      // Inicialização
      commands.push(ESCPOSCommands.init());
      
      // Alinhamento
      switch (job.alignment) {
        case 'center':
          commands.push(ESCPOSCommands.alignCenter());
          break;
        case 'right':
          commands.push(ESCPOSCommands.alignRight());
          break;
        default:
          commands.push(ESCPOSCommands.alignLeft());
      }
      
      // Tamanho da fonte
      switch (job.fontSize) {
        case 'small':
          commands.push(ESCPOSCommands.fontSizeSmall());
          break;
        case 'large':
          commands.push(ESCPOSCommands.fontSizeLarge());
          break;
        default:
          commands.push(ESCPOSCommands.fontSizeNormal());
      }
      
      // Negrito
      if (job.bold) {
        commands.push(ESCPOSCommands.boldOn());
      }
      
      // Sublinhado
      if (job.underline) {
        commands.push(ESCPOSCommands.underlineOn());
      }
      
      // Texto
      commands.push(ESCPOSCommands.text(job.text));
      commands.push(ESCPOSCommands.newLine());
      
      // Reset de formatação
      commands.push(ESCPOSCommands.boldOff());
      commands.push(ESCPOSCommands.underlineOff());
      commands.push(ESCPOSCommands.fontSizeNormal());
      commands.push(ESCPOSCommands.alignLeft());
      
      // Cortar papel se solicitado
      if (job.cutPaper) {
        commands.push(ESCPOSCommands.newLine());
        commands.push(ESCPOSCommands.CUT);
      }
      
      // Envia todos os comandos
      for (const command of commands) {
        const success = await this.sendCommand(command);
        if (!success) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      return false;
    }
  }

  /**
   * Imprime cupom fiscal simplificado
   */
  async printReceipt(items: Array<{name: string, quantity: number, price: number}>, total: number): Promise<boolean> {
    try {
      // Cabeçalho
      await this.print({
        text: 'CUPOM FISCAL',
        alignment: 'center',
        fontSize: 'large',
        bold: true
      });
      
      await this.print({
        text: '================================',
        alignment: 'center'
      });
      
      // Data e hora
      const now = new Date();
      await this.print({
        text: now.toLocaleString('pt-BR'),
        alignment: 'center'
      });
      
      await this.printText('\n');
      
      // Itens
      for (const item of items) {
        const line = `${item.name}\n${item.quantity}x R$ ${item.price.toFixed(2)} = R$ ${(item.quantity * item.price).toFixed(2)}`;
        await this.printText(line);
        await this.printText('--------------------------------');
      }
      
      // Total
      await this.print({
        text: `TOTAL: R$ ${total.toFixed(2)}`,
        alignment: 'right',
        fontSize: 'large',
        bold: true
      });
      
      await this.printText('\n');
      
      // Rodapé
      await this.print({
        text: 'Obrigado pela preferência!',
        alignment: 'center',
        cutPaper: true
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao imprimir cupom:', error);
      return false;
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.server !== null && this.server.connected;
  }

  /**
   * Obtém informações do dispositivo conectado
   */
  getDeviceInfo(): BluetoothDevice | null {
    return this.device;
  }

  /**
   * Testa a impressora com uma página de teste
   */
  async testPrint(): Promise<boolean> {
    return await this.print({
      text: 'Teste de Impressão\nImpressora conectada com sucesso!',
      alignment: 'center',
      cutPaper: true
    });
  }
}