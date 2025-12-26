
export interface ScaleData {
  weight: number;
  unit: 'kg' | 'g';
  stable: boolean;
}

export const scaleService = {
  port: null as SerialPort | null,
  reader: null as ReadableStreamDefaultReader | null,
  isReading: false,

  async connect(): Promise<boolean> {
    if (!('serial' in navigator)) {
      console.error('Web Serial API não suportada neste navegador.');
      return false;
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 }); // Configuração padrão comum (Toledo/Filizola costumam usar 9600 ou 2400)
      return true;
    } catch (error) {
      console.error('Erro ao conectar balança:', error);
      return false;
    }
  },

  async disconnect() {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
    this.isReading = false;
  },

  async readWeight(callback: (data: ScaleData) => void) {
    if (!this.port || !this.port.readable) return;
    
    this.isReading = true;
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      let buffer = '';
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          buffer += value;
          // Protocolo Toledo P03 / Filizola comum: STX + PESO + ETX ou CR/LF
          // Vamos tentar extrair números do buffer
          
          // Exemplo simples: procurar por quebras de linha que delimitam leituras
          const lines = buffer.split(/\r\n|\r|\n/);
          if (lines.length > 1) {
            // Processa linhas completas
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i];
              const weight = this.parseWeight(line);
              if (weight !== null) {
                callback({ weight, unit: 'kg', stable: true });
              }
            }
            // Mantém o resto no buffer
            buffer = lines[lines.length - 1];
          }
        }
      }
    } catch (error) {
      console.error('Erro na leitura da balança:', error);
    } finally {
      this.reader.releaseLock();
    }
  },

  parseWeight(raw: string): number | null {
    // Tenta extrair apenas números e ponto decimal
    // Exemplo Toledo: \x02005.000\x0D
    const clean = raw.replace(/[^\d.]/g, '');
    const weight = parseFloat(clean);
    
    // Filtros de sanidade (evitar leituras erradas de bytes de controle)
    if (!isNaN(weight) && weight < 1000) { // Assumindo balança de varejo < 1000kg
      return weight;
    }
    return null;
  }
};
