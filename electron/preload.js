
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
<<<<<<< HEAD
  // Device scanning and management
  scanSerialPorts: () => ipcRenderer.invoke('scan-serial-ports'),
  getConnectedDevices: () => ipcRenderer.invoke('get-connected-devices'),
  getSupportedProtocols: (deviceType) => ipcRenderer.invoke('get-supported-protocols', deviceType),
  updateDeviceOptions: (deviceType, deviceId, options) => ipcRenderer.invoke('update-device-options', deviceType, deviceId, options),
  
  // Printer operations
  getAvailablePrinters: () => ipcRenderer.invoke('get-available-printers'),
  connectPrinter: (deviceId, protocol, options) => ipcRenderer.invoke('connect-printer', deviceId, protocol, options),
  disconnectPrinter: (deviceId) => ipcRenderer.invoke('disconnect-printer', deviceId),
  printReceipt: (deviceId, orderData, template) => ipcRenderer.invoke('print-receipt', deviceId, orderData, template),
  openCashDrawer: (deviceId) => ipcRenderer.invoke('open-cash-drawer', deviceId),
  printProductLabel: (deviceId, productData) => ipcRenderer.invoke('print-product-label', deviceId, productData),
  
  // Scale operations
  connectScale: (deviceId, protocol, options) => ipcRenderer.invoke('connect-scale', deviceId, protocol, options),
  disconnectScale: (deviceId) => ipcRenderer.invoke('disconnect-scale', deviceId),
  readWeight: (deviceId, timeout) => ipcRenderer.invoke('read-weight', deviceId, timeout),
  tareScale: (deviceId) => ipcRenderer.invoke('tare-scale', deviceId),
  zeroScale: (deviceId) => ipcRenderer.invoke('zero-scale', deviceId),
  calibrateScale: (deviceId, knownWeight, currentReading) => ipcRenderer.invoke('calibrate-scale', deviceId, knownWeight, currentReading),
  startAutoReading: (deviceId) => ipcRenderer.invoke('start-auto-reading', deviceId),
  stopAutoReading: (deviceId) => ipcRenderer.invoke('stop-auto-reading', deviceId),
=======
  // Device scanning
  scanSerialPorts: () => ipcRenderer.invoke('scan-serial-ports'),
  
  // Printer operations
  connectPrinter: (devicePath) => ipcRenderer.invoke('connect-printer', devicePath),
  printReceipt: (orderData) => ipcRenderer.invoke('print-receipt', orderData),
  disconnectPrinter: () => ipcRenderer.invoke('disconnect-printer'),
  
  // Scale operations
  connectScale: (devicePath) => ipcRenderer.invoke('connect-scale', devicePath),
  readWeight: () => ipcRenderer.invoke('read-weight'),
  disconnectScale: () => ipcRenderer.invoke('disconnect-scale'),
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  
  // System notifications
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  
  // Platform detection
  isElectron: true,
  platform: process.platform
});
