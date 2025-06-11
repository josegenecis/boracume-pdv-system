
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.411cc844ef394277a88e574f3069317f',
  appName: 'bora-cume-hub',
  webDir: 'dist',
  server: {
    url: 'https://411cc844-ef39-4277-a88e-574f3069317f.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Serial: {
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    },
    BluetoothLe: {
      displayStrings: {
        scanning: "Procurando dispositivos...",
        cancel: "Cancelar",
        availableDevices: "Dispositivos disponíveis",
        noDeviceFound: "Nenhum dispositivo encontrado"
      }
    }
  }
};

export default config;
