
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.411cc844ef394277a88e574f3069317f',
  appName: 'PopSystem Garcom',
  webDir: 'dist',
  server: {
    url: 'https://popsystem.com.br/waiter-login',
    cleartext: false
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
    },
    StonePos: {
      enabled: true,
      provider: 'stone',
      appMode: 'waiter-pos'
    }
  }
};

export default config;
