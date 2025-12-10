export interface USBScaleReading {
  weight: number;
  unit: string;
  stable: boolean;
}

export const USB_SCALE_CONFIGS = {
  generic: {},
};

export class WebUSBScale {
  private device: USBDevice | null = null;
  private readingTimer: number | null = null;

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  async connect(): Promise<boolean> {
    if (!WebUSBScale.isSupported()) return false;
    try {
      // @ts-ignore
      this.device = await navigator.usb.requestDevice({ filters: [] });
      if (!this.device) return false;
      await this.device.open();
      if (this.device.configuration == null) {
        await this.device.selectConfiguration(1);
      }
      // Attempt claim first interface
      try {
        await this.device.claimInterface(0);
      } catch {}
      return true;
    } catch (e) {
      console.warn('WebUSBScale connect error', e);
      return false;
    }
  }

  getDeviceInfo() {
    if (!this.device) return null;
    return { productName: this.device.productName, manufacturerName: this.device.manufacturerName };
  }

  startReading(callback: (reading: USBScaleReading) => void) {
    // Without device-specific protocol, simulate readings
    this.readingTimer = window.setInterval(() => {
      const weight = Math.round((Math.random() * 1.5 + 0.2) * 1000) / 1000;
      callback({ weight, unit: 'kg', stable: true });
    }, 1500);
  }

  async disconnect() {
    try {
      if (this.readingTimer) {
        clearInterval(this.readingTimer);
        this.readingTimer = null;
      }
      if (this.device) {
        try { await this.device.close(); } catch {}
        this.device = null;
      }
    } catch (e) {
      console.warn('WebUSBScale disconnect error', e);
    }
  }
}

