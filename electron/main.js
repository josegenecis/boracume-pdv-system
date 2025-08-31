
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const { SerialPort } = require('serialport');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

// Importar novos serviços
const DeviceManager = require('./services/DeviceManager');
const PrinterService = require('./services/PrinterService');
const ScaleService = require('./services/ScaleService');

let mainWindow;
let connectedPrinter = null;
let connectedScale = null;

// Instanciar serviços
let deviceManager;
let printerService;
let scaleService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    show: false,
    titleBarStyle: 'default'
  });

  // Load the app - redirecionar para página desktop
  const startUrl = isDev 
    ? 'http://localhost:8080/desktop' 
    : `file://${path.join(__dirname, '../dist/index.html')}/desktop`;
  
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Inicializar serviços após criar a janela
  initializeServices();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Função para inicializar serviços
function initializeServices() {
  try {
    deviceManager = new DeviceManager();
    printerService = new PrinterService(deviceManager);
    scaleService = new ScaleService(deviceManager);
    
    console.log('Serviços de dispositivos inicializados com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar serviços:', error);
  }
}

// IPC Handlers for device integration

// Scan for available serial ports (printers and scales)
ipcMain.handle('scan-serial-ports', async () => {
  try {
    if (!deviceManager) {
      return { success: false, error: 'Serviços não inicializados' };
    }
    
    const result = await deviceManager.scanDevices();
    return result;
  } catch (error) {
    console.error('Error scanning serial ports:', error);
    return { success: false, error: error.message };
  }
});

// Connect to printer
ipcMain.handle('connect-printer', async (event, deviceId, protocol = 'epson', options = {}) => {
  try {
    if (!printerService) {
      return { success: false, error: 'Serviço de impressora não inicializado' };
    }
    
    const result = await printerService.connectPrinter(deviceId, protocol, options);
    return result;
  } catch (error) {
    console.error('Error connecting to printer:', error);
    return { success: false, error: error.message };
  }
});

// Print receipt
ipcMain.handle('print-receipt', async (event, deviceId, orderData, template = 'receipt') => {
  try {
    if (!printerService) {
      return { success: false, error: 'Serviço de impressora não inicializado' };
    }
    
    const result = await printerService.printReceipt(deviceId, orderData, template);
    return result;
  } catch (error) {
    console.error('Error printing receipt:', error);
    return { success: false, error: error.message };
  }
});

// Connect to scale
ipcMain.handle('connect-scale', async (event, deviceId, protocol = 'generic', options = {}) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    const result = await scaleService.connectScale(deviceId, protocol, options);
    return result;
  } catch (error) {
    console.error('Error connecting to scale:', error);
    return { success: false, error: error.message };
  }
});

// Read weight from scale
ipcMain.handle('read-weight', async (event, deviceId, timeout = 5000) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    const result = await scaleService.readWeight(deviceId, timeout);
    return result;
  } catch (error) {
    console.error('Error reading weight:', error);
    return { success: false, error: error.message };
  }
});

// Disconnect printer
ipcMain.handle('disconnect-printer', async (event, deviceId) => {
  try {
    if (!printerService) {
      return { success: false, error: 'Serviço de impressora não inicializado' };
    }
    
    const result = await printerService.disconnectPrinter(deviceId);
    return result;
  } catch (error) {
    console.error('Error disconnecting printer:', error);
    return { success: false, error: error.message };
  }
});

// Disconnect scale
ipcMain.handle('disconnect-scale', async (event, deviceId) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    const result = await scaleService.disconnectScale(deviceId);
    return result;
  } catch (error) {
    console.error('Error disconnecting scale:', error);
    return { success: false, error: error.message };
  }
});

// Show system notification
ipcMain.handle('show-notification', async (event, title, body) => {
  try {
    const { Notification } = require('electron');
    
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        icon: path.join(__dirname, '../assets/icon.png')
      });
      
      notification.show();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error showing notification:', error);
    return { success: false, error: error.message };
  }
});

// Advanced Scale Operations
ipcMain.handle('tare-scale', async (event, deviceId) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    const result = await scaleService.tareScale(deviceId);
    return result;
  } catch (error) {
    console.error('Error taring scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('zero-scale', async (event, deviceId) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    const result = await scaleService.zeroScale(deviceId);
    return result;
  } catch (error) {
    console.error('Error zeroing scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('calibrate-scale', async (event, deviceId, knownWeight, currentReading) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    const result = await scaleService.calibrateScale(deviceId, knownWeight, currentReading);
    return result;
  } catch (error) {
    console.error('Error calibrating scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-auto-reading', async (event, deviceId) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    scaleService.startAutoReading(deviceId);
    return { success: true, message: 'Leitura automática iniciada' };
  } catch (error) {
    console.error('Error starting auto reading:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-auto-reading', async (event, deviceId) => {
  try {
    if (!scaleService) {
      return { success: false, error: 'Serviço de balança não inicializado' };
    }
    
    scaleService.stopAutoReading(deviceId);
    return { success: true, message: 'Leitura automática parada' };
  } catch (error) {
    console.error('Error stopping auto reading:', error);
    return { success: false, error: error.message };
  }
});

// Device Management
ipcMain.handle('get-connected-devices', async () => {
  try {
    const devices = {
      printers: printerService ? printerService.getConnectedPrinters() : [],
      scales: scaleService ? scaleService.getConnectedScales() : []
    };
    
    return { success: true, devices };
  } catch (error) {
    console.error('Error getting connected devices:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-supported-protocols', async (event, deviceType) => {
  try {
    let protocols = [];
    
    if (deviceType === 'printer' && printerService) {
      protocols = printerService.getSupportedProtocols();
    } else if (deviceType === 'scale' && scaleService) {
      protocols = scaleService.getSupportedProtocols();
    }
    
    return { success: true, protocols };
  } catch (error) {
    console.error('Error getting supported protocols:', error);
    return { success: false, error: error.message };
  }
});

// Printer Advanced Operations
ipcMain.handle('get-available-printers', async () => {
  try {
    if (!printerService) {
      throw new Error('Serviço de impressora não inicializado');
    }
    const printers = await printerService.getAvailablePrinters();
    return { success: true, printers };
  } catch (error) {
    console.error('Erro ao listar impressoras:', error);
    return { success: false, error: error.message, printers: [] };
  }
});

ipcMain.handle('open-cash-drawer', async (event, deviceId) => {
  try {
    if (!printerService) {
      return { success: false, error: 'Serviço de impressora não inicializado' };
    }
    
    const result = await printerService.openCashDrawer(deviceId);
    return result;
  } catch (error) {
    console.error('Error opening cash drawer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-product-label', async (event, deviceId, productData) => {
  try {
    if (!printerService) {
      return { success: false, error: 'Serviço de impressora não inicializado' };
    }
    
    const result = await printerService.printReceipt(deviceId, productData, 'product_label');
    return result;
  } catch (error) {
    console.error('Error printing product label:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-device-options', async (event, deviceType, deviceId, options) => {
  try {
    let result;
    
    if (deviceType === 'printer' && printerService) {
      result = await printerService.updatePrinterOptions(deviceId, options);
    } else if (deviceType === 'scale' && scaleService) {
      result = await scaleService.updateScaleOptions(deviceId, options);
    } else {
      return { success: false, error: 'Tipo de dispositivo inválido ou serviço não disponível' };
    }
    
    return result;
  } catch (error) {
    console.error('Error updating device options:', error);
    return { success: false, error: error.message };
  }
});
