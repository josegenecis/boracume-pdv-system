/**
 * Serviço de fallback para integração com hardware quando APIs web não estão disponíveis
 * Oferece soluções alternativas como WebSocket, simulação e integração via aplicativo nativo
 */

export interface FallbackScaleReading {
  weight: number;
  unit: 'kg' | 'g' | 'lb';
  stable: boolean;
  timestamp: Date;
  source: 'websocket' | 'simulation' | 'native-app';
}

export interface FallbackPrintJob {
  text: string;
  fontSize?: 'small' | 'normal' | 'large';
  alignment?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  cutPaper?: boolean;
}

// Configurações para diferentes tipos de fallback
export interface FallbackConfig {
  websocketUrl?: string;
  nativeAppPort?: number;
  simulationEnabled?: boolean;
  pollingInterval?: number;
}

/**
 * Serviço de fallback para balanças via WebSocket
 * Conecta com um servidor local que faz a ponte com a balança
 */
export class WebSocketScaleFallback {
  private ws: WebSocket | null = null;
  private onDataCallback?: (reading: FallbackScaleReading) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 2000;
  private config: FallbackConfig;

  constructor(config: FallbackConfig) {
    this.config = config;
  }

  /**
   * Conecta via WebSocket
   */
  async connect(): Promise<boolean> {
    try {
      if (!this.config.websocketUrl) {
        throw new Error('URL do WebSocket não configurada');
      }

      this.ws = new WebSocket(this.config.websocketUrl);
      
      return new Promise((resolve) => {
        if (!this.ws) {
          resolve(false);
          return;
        }

        this.ws.onopen = () => {
          console.log('Conectado ao servidor de balança via WebSocket');
          this.reconnectAttempts = 0;
          resolve(true);
        };

        this.ws.onerror = (error) => {
          console.error('Erro na conexão WebSocket:', error);
          resolve(false);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'weight' && this.onDataCallback) {
              const reading: FallbackScaleReading = {
                weight: data.weight,
                unit: data.unit || 'kg',
                stable: data.stable || false,
                timestamp: new Date(),
                source: 'websocket'
              };
              this.onDataCallback(reading);
            }
          } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('Conexão WebSocket fechada');
          this.attemptReconnect();
        };

        // Timeout de 5 segundos para conexão
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            resolve(false);
          }
        }, 5000);
      });
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      return false;
    }
  }

  /**
   * Tenta reconectar automaticamente
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Máximo de tentativas de reconexão atingido');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Inicia a leitura de dados
   */
  startReading(onData: (reading: FallbackScaleReading) => void): void {
    this.onDataCallback = onData;
    
    // Solicita início da leitura ao servidor
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ command: 'start_reading' }));
    }
  }

  /**
   * Para a leitura de dados
   */
  stopReading(): void {
    this.onDataCallback = undefined;
    
    // Solicita parada da leitura ao servidor
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ command: 'stop_reading' }));
    }
  }

  /**
   * Desconecta
   */
  async disconnect(): Promise<void> {
    this.stopReading();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Simulador de balança para testes e demonstração
 */
export class ScaleSimulator {
  private isReading = false;
  private onDataCallback?: (reading: FallbackScaleReading) => void;
  private interval?: number;
  private currentWeight = 0;
  private targetWeight = 0;
  private weightVariation = 0.1;

  /**
   * Conecta o simulador
   */
  async connect(): Promise<boolean> {
    console.log('Simulador de balança conectado');
    return true;
  }

  /**
   * Inicia a simulação de leitura
   */
  startReading(onData: (reading: FallbackScaleReading) => void): void {
    this.onDataCallback = onData;
    this.isReading = true;
    
    // Gera peso aleatório inicial
    this.targetWeight = Math.random() * 10; // 0 a 10 kg
    this.currentWeight = this.targetWeight;
    
    this.interval = window.setInterval(() => {
      if (!this.isReading || !this.onDataCallback) {
        return;
      }

      // Simula variação natural do peso
      const variation = (Math.random() - 0.5) * this.weightVariation;
      this.currentWeight = Math.max(0, this.targetWeight + variation);
      
      // Simula estabilidade (80% das vezes estável)
      const stable = Math.random() > 0.2;
      
      const reading: FallbackScaleReading = {
        weight: Math.round(this.currentWeight * 1000) / 1000, // 3 casas decimais
        unit: 'kg',
        stable,
        timestamp: new Date(),
        source: 'simulation'
      };
      
      this.onDataCallback(reading);
      
      // Ocasionalmente muda o peso alvo
      if (Math.random() < 0.05) {
        this.targetWeight = Math.random() * 10;
      }
    }, 500); // Atualiza a cada 500ms
  }

  /**
   * Para a simulação
   */
  stopReading(): void {
    this.isReading = false;
    this.onDataCallback = undefined;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  /**
   * Desconecta o simulador
   */
  async disconnect(): Promise<void> {
    this.stopReading();
    console.log('Simulador de balança desconectado');
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return true; // Simulador sempre "conectado"
  }

  /**
   * Define um peso específico para simulação
   */
  setWeight(weight: number): void {
    this.targetWeight = weight;
    this.currentWeight = weight;
  }
}

/**
 * Fallback para impressora via aplicativo nativo
 * Usa protocolo HTTP local ou WebSocket para comunicar com app desktop
 */
export class NativeAppPrinterFallback {
  private config: FallbackConfig;
  private baseUrl: string;

  constructor(config: FallbackConfig) {
    this.config = config;
    this.baseUrl = `http://localhost:${config.nativeAppPort || 8765}`;
  }

  /**
   * Verifica se o aplicativo nativo está rodando
   */
  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Aplicativo nativo não encontrado:', error);
      return false;
    }
  }

  /**
   * Envia trabalho de impressão para o aplicativo nativo
   */
  async print(job: FallbackPrintJob): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Erro ao imprimir via aplicativo nativo:', error);
      return false;
    }
  }

  /**
   * Lista impressoras disponíveis
   */
  async listPrinters(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/printers`);
      if (response.ok) {
        const data = await response.json();
        return data.printers || [];
      }
      return [];
    } catch (error) {
      console.error('Erro ao listar impressoras:', error);
      return [];
    }
  }

  /**
   * Testa a impressora
   */
  async testPrint(): Promise<boolean> {
    return await this.print({
      text: 'Teste de Impressão\nConexão via aplicativo nativo funcionando!',
      alignment: 'center',
      cutPaper: true
    });
  }

  /**
   * Desconecta (não faz nada, pois é stateless)
   */
  async disconnect(): Promise<void> {
    // Não há conexão persistente para fechar
  }

  /**
   * Verifica se está conectado
   */
  async isConnected(): Promise<boolean> {
    return await this.connect();
  }
}

/**
 * Gerenciador principal de fallbacks
 */
export class HardwareFallbackManager {
  private config: FallbackConfig;
  private scaleServices: Map<string, WebSocketScaleFallback | ScaleSimulator> = new Map();
  private printerServices: Map<string, NativeAppPrinterFallback> = new Map();

  constructor(config: FallbackConfig = {}) {
    this.config = {
      websocketUrl: 'ws://localhost:8766',
      nativeAppPort: 8765,
      simulationEnabled: true,
      pollingInterval: 1000,
      ...config
    };
  }

  /**
   * Cria serviço de balança via WebSocket
   */
  createWebSocketScale(id: string): WebSocketScaleFallback {
    const service = new WebSocketScaleFallback(this.config);
    this.scaleServices.set(id, service);
    return service;
  }

  /**
   * Cria simulador de balança
   */
  createScaleSimulator(id: string): ScaleSimulator {
    const service = new ScaleSimulator();
    this.scaleServices.set(id, service);
    return service;
  }

  /**
   * Cria serviço de impressora via aplicativo nativo
   */
  createNativeAppPrinter(id: string): NativeAppPrinterFallback {
    const service = new NativeAppPrinterFallback(this.config);
    this.printerServices.set(id, service);
    return service;
  }

  /**
   * Remove serviço de balança
   */
  async removeScaleService(id: string): Promise<void> {
    const service = this.scaleServices.get(id);
    if (service) {
      await service.disconnect();
      this.scaleServices.delete(id);
    }
  }

  /**
   * Remove serviço de impressora
   */
  async removePrinterService(id: string): Promise<void> {
    const service = this.printerServices.get(id);
    if (service) {
      await service.disconnect();
      this.printerServices.delete(id);
    }
  }

  /**
   * Desconecta todos os serviços
   */
  async disconnectAll(): Promise<void> {
    // Desconecta balanças
    for (const [id, service] of this.scaleServices) {
      await service.disconnect();
    }
    this.scaleServices.clear();

    // Desconecta impressoras
    for (const [id, service] of this.printerServices) {
      await service.disconnect();
    }
    this.printerServices.clear();
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Verifica disponibilidade dos serviços de fallback
   */
  async checkAvailability(): Promise<{
    websocket: boolean;
    nativeApp: boolean;
    simulation: boolean;
  }> {
    const results = {
      websocket: false,
      nativeApp: false,
      simulation: this.config.simulationEnabled || false
    };

    // Testa WebSocket
    try {
      const wsTest = new WebSocketScaleFallback(this.config);
      results.websocket = await wsTest.connect();
      await wsTest.disconnect();
    } catch (error) {
      results.websocket = false;
    }

    // Testa aplicativo nativo
    try {
      const nativeTest = new NativeAppPrinterFallback(this.config);
      results.nativeApp = await nativeTest.connect();
    } catch (error) {
      results.nativeApp = false;
    }

    return results;
  }
}