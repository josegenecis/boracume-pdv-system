
export interface ElectronAPI {
  scanSerialPorts: () => Promise<Array<{
    id: string;
    name: string;
    type: 'usb' | 'bluetooth';
    manufacturer?: string;
    connected: boolean;
  }>>;
  
  connectPrinter: (devicePath: string) => Promise<{
    success: boolean;
    message: string;
  }>;
  
  printReceipt: (orderData: any) => Promise<{
    success: boolean;
    message: string;
  }>;
  
  disconnectPrinter: () => Promise<{ success: boolean }>;
  
  connectScale: (devicePath: string) => Promise<{
    success: boolean;
    message: string;
  }>;
  
  readWeight: () => Promise<{
    success: boolean;
    weight?: number;
    message?: string;
  }>;
  
  disconnectScale: () => Promise<{ success: boolean }>;
  
  showNotification: (title: string, body: string) => Promise<{ success: boolean }>;
  
  isElectron: boolean;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
