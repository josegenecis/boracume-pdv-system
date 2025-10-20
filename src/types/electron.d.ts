
<<<<<<< HEAD
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'printer' | 'scale';
  manufacturer?: string;
  connected: boolean;
  protocol?: string;
  status?: string;
}

export interface ProtocolInfo {
  id: string;
  name: string;
  baudRate: number;
}

export interface WeightReading {
  success: boolean;
  weight?: number;
  stable?: boolean;
  unit?: string;
  message?: string;
  error?: string;
}

export interface DeviceResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ConnectedDevices {
  printers: DeviceInfo[];
  scales: DeviceInfo[];
}

export interface ElectronAPI {
  // Device scanning and management
  scanSerialPorts: () => Promise<{ success: boolean; devices?: DeviceInfo[]; error?: string }>;
  getConnectedDevices: () => Promise<{ success: boolean; devices?: ConnectedDevices; error?: string }>;
  getSupportedProtocols: (deviceType: 'printer' | 'scale') => Promise<{ success: boolean; protocols?: ProtocolInfo[]; error?: string }>;
  updateDeviceOptions: (deviceType: 'printer' | 'scale', deviceId: string, options: any) => Promise<DeviceResponse>;
  
  // Printer operations
  getAvailablePrinters: () => Promise<{ success: boolean, printers: any[], error?: string }>;
  connectPrinter: (deviceId: string, protocol?: string, options?: any) => Promise<DeviceResponse>;
  disconnectPrinter: (deviceId: string) => Promise<DeviceResponse>;
  printReceipt: (deviceId: string, orderData: any, template?: string) => Promise<DeviceResponse>;
  openCashDrawer: (deviceId: string) => Promise<DeviceResponse>;
  printProductLabel: (deviceId: string, productData: any) => Promise<DeviceResponse>;
  
  // Scale operations
  connectScale: (deviceId: string, protocol?: string, options?: any) => Promise<DeviceResponse>;
  disconnectScale: (deviceId: string) => Promise<DeviceResponse>;
  readWeight: (deviceId: string, timeout?: number) => Promise<WeightReading>;
  tareScale: (deviceId: string) => Promise<DeviceResponse>;
  zeroScale: (deviceId: string) => Promise<DeviceResponse>;
  calibrateScale: (deviceId: string, knownWeight: number, currentReading: number) => Promise<DeviceResponse>;
  startAutoReading: (deviceId: string) => Promise<DeviceResponse>;
  stopAutoReading: (deviceId: string) => Promise<DeviceResponse>;
  
  // System notifications
  showNotification: (title: string, body: string) => Promise<DeviceResponse>;
  
  // Platform detection
=======
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
  
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  isElectron: boolean;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
