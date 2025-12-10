export interface FallbackScaleReading {
  weight: number;
  unit: string;
  stable: boolean;
  source: string;
}

export interface FallbackConfig {
  websocketUrl: string;
  nativeAppPort: number;
  simulationEnabled: boolean;
  pollingInterval: number;
}

export class WebSocketScaleFallback {
  private url: string;
  private ws: WebSocket | null = null;
  private id: string;
  private interval: number | null = null;
  constructor(id: string, url: string) { this.id = id; this.url = url; }
  async connect(): Promise<boolean> {
    try {
      this.ws = new WebSocket(this.url);
      return await new Promise<boolean>((resolve) => {
        this.ws!.onopen = () => resolve(true);
        this.ws!.onerror = () => resolve(false);
      });
    } catch { return false; }
  }
  startReading(cb: (reading: FallbackScaleReading) => void) {
    if (this.ws) {
      this.ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          const weight = Number(data.weight) || 0;
          cb({ weight, unit: data.unit || 'kg', stable: !!data.stable, source: 'websocket' });
        } catch {}
      };
    } else {
      this.interval = window.setInterval(() => {
        const weight = Math.round((Math.random() * 2 + 0.3) * 1000) / 1000;
        cb({ weight, unit: 'kg', stable: true, source: 'simulation' });
      }, 1000);
    }
  }
  async disconnect() { try { if (this.ws) this.ws.close(); if (this.interval) clearInterval(this.interval); } catch {} }
}

export class ScaleSimulator {
  private weight = 1.0;
  private timer: number | null = null;
  setWeight(w: number) { this.weight = w; }
  async connect(): Promise<boolean> { return true; }
  startReading(cb: (reading: FallbackScaleReading) => void) {
    this.timer = window.setInterval(() => cb({ weight: this.weight, unit: 'kg', stable: true, source: 'simulator' }), 1000);
  }
  async disconnect() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

export class NativeAppPrinterFallback {
  private port: number;
  constructor(port: number) { this.port = port; }
  async connect(): Promise<boolean> { return true; }
  async testPrint() { console.log('Fallback native app print'); }
  async disconnect() {}
}

export class HardwareFallbackManager {
  private config: FallbackConfig = { websocketUrl: 'ws://localhost:8766', nativeAppPort: 8765, simulationEnabled: true, pollingInterval: 1000 };
  updateConfig(cfg: Partial<FallbackConfig>) { this.config = { ...this.config, ...cfg }; }
  async checkAvailability() { return { websocket: true, nativeApp: false, simulation: this.config.simulationEnabled }; }
  createWebSocketScale(id: string) { return new WebSocketScaleFallback(id, this.config.websocketUrl); }
  createScaleSimulator(id: string) { return new ScaleSimulator(); }
  createNativeAppPrinter(id: string) { return new NativeAppPrinterFallback(this.config.nativeAppPort); }
  async removeScaleService(id: string) {}
  async removePrinterService(id: string) {}
}

