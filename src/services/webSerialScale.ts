export interface ScaleReading {
  weight: number;
  unit: 'kg' | 'g';
  stable: boolean;
  raw?: string;
  readAt?: number;
}

export interface SerialScaleConfig {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  requestCommand?: string;
  defaultUnit?: 'kg' | 'g';
}

export const SCALE_CONFIGS: Record<string, SerialScaleConfig> = {
  generic: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', defaultUnit: 'kg' },
  toledo: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', requestCommand: '\u0005', defaultUnit: 'kg' },
  filizola: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', requestCommand: 'P\r\n', defaultUnit: 'kg' },
  urano: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', requestCommand: '\u0005', defaultUnit: 'kg' },
  elgin: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', requestCommand: 'P\r\n', defaultUnit: 'kg' },
};

type SerialNavigator = Navigator & {
  serial: {
    requestPort(options?: unknown): Promise<any>;
    getPorts(): Promise<any[]>;
  };
};

const normalizeNumber = (value: string) => {
  const compact = value.trim().replace(/\s/g, '');
  if (compact.includes(',') && compact.includes('.')) {
    return Number(compact.lastIndexOf(',') > compact.lastIndexOf('.')
      ? compact.replace(/\./g, '').replace(',', '.')
      : compact.replace(/,/g, ''));
  }
  return Number(compact.replace(',', '.'));
};

export const parseScaleFrame = (frame: string, defaultUnit: 'kg' | 'g' = 'kg'): ScaleReading | null => {
  const clean = frame.replace(/[\u0000-\u001f]/g, ' ').trim();
  if (!clean) return null;
  const match = clean.match(/([-+]?\s*\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gramas?)?/i);
  if (!match) return null;
  const weight = normalizeNumber(match[1]);
  if (!Number.isFinite(weight) || weight < 0) return null;
  const unit = /^g/i.test(match[2] || '') ? 'g' : (/kg/i.test(match[2] || '') ? 'kg' : defaultUnit);
  const unstable = /\b(US|UNST|MOTION|INST)\b/i.test(clean);
  const explicitlyStable = /\b(ST|STABLE|ESTAVEL|LQ)\b/i.test(clean);
  return { weight, unit, stable: explicitlyStable || !unstable, raw: frame, readAt: Date.now() };
};

export class WebSerialScale {
  private port: any = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reading = false;
  private buffer = '';
  private latest: ScaleReading | null = null;
  private listeners = new Set<(reading: ScaleReading) => void>();

  constructor(private config: SerialScaleConfig = SCALE_CONFIGS.generic) {}

  static isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator && window.isSecureContext;
  }

  get connected() { return Boolean(this.port?.readable); }
  get latestReading() { return this.latest; }

  async connect(options: { request?: boolean } = { request: true }): Promise<boolean> {
    if (!WebSerialScale.isSupported()) return false;
    const serial = (navigator as SerialNavigator).serial;
    try {
      if (!this.port) {
        if (options.request === false) {
          const ports = await serial.getPorts();
          this.port = ports[0] || null;
        } else {
          this.port = await serial.requestPort();
        }
      }
      if (!this.port) return false;
      if (!this.port.readable) await this.port.open(this.config);
      if (this.port.writable) this.writer = this.port.writable.getWriter();
      this.startLoop();
      return true;
    } catch (error) {
      console.warn('Falha ao conectar balança Web Serial', error);
      this.port = null;
      return false;
    }
  }

  async reconnectAuthorized() { return this.connect({ request: false }); }

  subscribe(callback: (reading: ScaleReading) => void) {
    this.listeners.add(callback);
    if (this.latest) callback(this.latest);
    return () => this.listeners.delete(callback);
  }

  async requestReading() {
    if (this.writer && this.config.requestCommand) {
      await this.writer.write(new TextEncoder().encode(this.config.requestCommand));
    }
    return this.latest;
  }

  private emit(reading: ScaleReading) {
    this.latest = reading;
    this.listeners.forEach(listener => listener(reading));
  }

  private consume(text: string) {
    this.buffer += text;
    const frames = this.buffer.split(/[\r\n]+/);
    this.buffer = frames.pop() || '';
    // Algumas balanças enviam um quadro completo sem CR/LF.
    if (!frames.length && this.buffer.length >= 6 && /(kg|\bg\b|ST|US)/i.test(this.buffer)) {
      frames.push(this.buffer);
      this.buffer = '';
    }
    for (const frame of frames) {
      const parsed = parseScaleFrame(frame, this.config.defaultUnit);
      if (parsed) this.emit(parsed);
    }
  }

  private async startLoop() {
    if (this.reading || !this.port?.readable) return;
    this.reading = true;
    try {
      this.reader = this.port.readable.getReader();
      while (this.reading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.consume(new TextDecoder().decode(value, { stream: true }));
      }
    } catch (error) {
      if (this.reading) console.warn('Leitura da balança interrompida', error);
    } finally {
      try { this.reader?.releaseLock(); } catch {}
      this.reader = null;
      this.reading = false;
    }
  }

  async disconnect() {
    this.reading = false;
    try { await this.reader?.cancel(); } catch {}
    try { this.reader?.releaseLock(); } catch {}
    try { this.writer?.releaseLock(); } catch {}
    this.reader = null;
    this.writer = null;
    try { await this.port?.close(); } catch {}
    this.port = null;
    this.latest = null;
  }
}
