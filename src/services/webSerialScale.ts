/**
 * Serviço para integração com balanças via Web Serial API
 * Suporta balanças que se comunicam via porta serial
 */

export interface ScaleReading {
  weight: number;
  unit: 'kg' | 'g' | 'lb';
  stable: boolean;
  timestamp: Date;
}

export interface ScaleConfig {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  flowControl: 'none' | 'hardware';
}

// Configurações padrão para diferentes marcas de balanças
export const SCALE_CONFIGS: Record<string, ScaleConfig> = {
  toledo: {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  filizola: {
    baudRate: 9600,
    dataBits: 7,
    stopBits: 1,
    parity: 'even',
    flowControl: 'none'
  },
  urano: {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  },
  generic: {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none'
  }
};

export class WebSerialScale {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private isReading = false;
  private onDataCallback?: (reading: ScaleReading) => void;
  private config: ScaleConfig;

  constructor(config: ScaleConfig = SCALE_CONFIGS.generic) {
    this.config = config;
  }

  /**
   * Verifica se o navegador suporta Web Serial API
   */
  static isSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Solicita permissão e conecta com uma balança
   */
  async connect(): Promise<boolean> {
    try {
      if (!WebSerialScale.isSupported()) {
        throw new Error('Web Serial API não é suportada neste navegador');
      }

      // Solicita ao usuário para selecionar uma porta serial
      this.port = await navigator.serial.requestPort();
      
      // Abre a conexão com a configuração especificada
      await this.port.open(this.config);
      
      // Configura os streams de leitura e escrita
      if (this.port.readable) {
        this.reader = this.port.readable.getReader();
      }
      
      if (this.port.writable) {
        this.writer = this.port.writable.getWriter();
      }

      console.log('Balança conectada via Web Serial API');
      return true;
    } catch (error) {
      console.error('Erro ao conectar com a balança:', error);
      return false;
    }
  }

  /**
   * Desconecta da balança
   */
  async disconnect(): Promise<void> {
    try {
      this.stopReading();
      
      if (this.reader) {
        await this.reader.cancel();
        await this.reader.releaseLock();
        this.reader = null;
      }
      
      if (this.writer) {
        await this.writer.releaseLock();
        this.writer = null;
      }
      
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      
      console.log('Balança desconectada');
    } catch (error) {
      console.error('Erro ao desconectar da balança:', error);
    }
  }

  /**
   * Inicia a leitura contínua de dados da balança
   */
  startReading(onData: (reading: ScaleReading) => void): void {
    if (!this.reader || this.isReading) {
      return;
    }

    this.onDataCallback = onData;
    this.isReading = true;
    this.readLoop();
  }

  /**
   * Para a leitura de dados
   */
  stopReading(): void {
    this.isReading = false;
    this.onDataCallback = undefined;
  }

  /**
   * Loop de leitura contínua
   */
  private async readLoop(): Promise<void> {
    if (!this.reader || !this.isReading) {
      return;
    }

    try {
      while (this.isReading && this.reader) {
        const { value, done } = await this.reader.read();
        
        if (done) {
          break;
        }
        
        if (value && this.onDataCallback) {
          const reading = this.parseScaleData(value);
          if (reading) {
            this.onDataCallback(reading);
          }
        }
      }
    } catch (error) {
      console.error('Erro na leitura da balança:', error);
      this.isReading = false;
    }
  }

  /**
   * Interpreta os dados recebidos da balança
   */
  private parseScaleData(data: Uint8Array): ScaleReading | null {
    try {
      // Converte bytes para string
      const text = new TextDecoder().decode(data).trim();
      
      // Padrões comuns de balanças brasileiras
      // Formato típico: "ST,GS,+00001.234kg" ou "US,GS,+00001234g"
      const patterns = [
        /([SU]T),([GN]S),([+-]?\d+\.?\d*)kg/i,  // Toledo/Urano kg
        /([SU]T),([GN]S),([+-]?\d+)g/i,         // Toledo/Urano g
        /([+-]?\d+\.?\d*)\s*(kg|g|lb)/i,        // Formato simples
        /W\s*([+-]?\d+\.?\d*)\s*(kg|g|lb)/i     // Formato com W
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const weightStr = match[match.length - 2];
          const unit = match[match.length - 1].toLowerCase() as 'kg' | 'g' | 'lb';
          const weight = parseFloat(weightStr);
          
          if (!isNaN(weight)) {
            return {
              weight,
              unit,
              stable: match[2] ? match[2].toUpperCase() === 'GS' : true,
              timestamp: new Date()
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao interpretar dados da balança:', error);
      return null;
    }
  }

  /**
   * Envia comando para a balança (se suportado)
   */
  async sendCommand(command: string): Promise<boolean> {
    if (!this.writer) {
      return false;
    }

    try {
      const encoder = new TextEncoder();
      await this.writer.write(encoder.encode(command + '\r\n'));
      return true;
    } catch (error) {
      console.error('Erro ao enviar comando para balança:', error);
      return false;
    }
  }

  /**
   * Solicita leitura única do peso
   */
  async requestWeight(): Promise<ScaleReading | null> {
    // Comando comum para solicitar peso
    const success = await this.sendCommand('P');
    if (!success) {
      return null;
    }

    // Aguarda resposta por até 2 segundos
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 2000);

      const originalCallback = this.onDataCallback;
      this.onDataCallback = (reading) => {
        clearTimeout(timeout);
        this.onDataCallback = originalCallback;
        resolve(reading);
      };
    });
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.port !== null && this.port.readable !== null;
  }

  /**
   * Obtém informações da porta conectada
   */
  getPortInfo(): SerialPortInfo | null {
    return this.port?.getInfo() || null;
  }
}