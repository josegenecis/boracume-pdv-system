
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
  
  // System notifications
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', title, body),
  
  // Platform detection
  isElectron: true,
  platform: process.platform
});
