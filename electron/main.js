
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
<<<<<<< HEAD
const isDev = !app.isPackaged;
=======
const isDev = process.env.NODE_ENV === 'development';
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
const { SerialPort } = require('serialport');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

<<<<<<< HEAD
// Importar novos serviços
const DeviceManager = require('./services/DeviceManager');
const PrinterService = require('./services/PrinterService');
const ScaleService = require('./services/ScaleService');

=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
let mainWindow;
let connectedPrinter = null;
let connectedScale = null;

<<<<<<< HEAD
// Instanciar serviços
let deviceManager;
let printerService;
let scaleService;

=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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

<<<<<<< HEAD
  // Load the app - redirecionar para página desktop
  const startUrl = isDev 
    ? 'http://localhost:8080/desktop' 
    : `file://${path.join(__dirname, '../dist/index.html')}/desktop`;
=======
  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  
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
<<<<<<< HEAD

  // Inicializar serviços após criar a janela
  initializeServices();
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
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

<<<<<<< HEAD
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

=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
// IPC Handlers for device integration

// Scan for available serial ports (printers and scales)
ipcMain.handle('scan-serial-ports', async () => {
  try {
<<<<<<< HEAD
    if (!deviceManager) {
      return { success: false, error: 'Serviços não inicializados' };
    }
    
    const result = await deviceManager.scanDevices();
    return result;
  } catch (error) {
    console.error('Error scanning serial ports:', error);
    return { success: false, error: error.message };
=======
    const ports = await SerialPort.list();
    return ports.map(port => ({
      id: port.path,
      name: port.friendlyName || port.path,
      type: 'usb',
      manufacturer: port.manufacturer,
      connected: false
    }));
  } catch (error) {
    console.error('Error scanning ports:', error);
    return [];
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  }
});

// Connect to printer
<<<<<<< HEAD
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
=======
ipcMain.handle('connect-printer', async (event, devicePath) => {
  try {
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: devicePath,
      options: {
        timeout: 5000
      }
    });

    const isConnected = await printer.isPrinterConnected();
    
    if (isConnected) {
      connectedPrinter = printer;
      return { success: true, message: 'Impressora conectada com sucesso' };
    } else {
      return { success: false, message: 'Não foi possível conectar à impressora' };
    }
  } catch (error) {
    console.error('Error connecting printer:', error);
    return { success: false, message: error.message };
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  }
});

// Print receipt
<<<<<<< HEAD
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
=======
ipcMain.handle('print-receipt', async (event, orderData) => {
  if (!connectedPrinter) {
    return { success: false, message: 'Nenhuma impressora conectada' };
  }

  try {
    connectedPrinter.clear();
    
    // Header
    connectedPrinter.alignCenter();
    connectedPrinter.bold(true);
    connectedPrinter.println('BORA CUME HUB');
    connectedPrinter.bold(false);
    connectedPrinter.drawLine();
    
    // Order info
    connectedPrinter.alignLeft();
    connectedPrinter.println(`Pedido: #${orderData.order_number}`);
    connectedPrinter.println(`Cliente: ${orderData.customer_name}`);
    
    if (orderData.customer_phone) {
      connectedPrinter.println(`Telefone: ${orderData.customer_phone}`);
    }
    
    connectedPrinter.drawLine();
    
    // Items
    orderData.items.forEach(item => {
      connectedPrinter.println(`${item.quantity}x ${item.product_name}`);
      connectedPrinter.alignRight();
      connectedPrinter.println(`R$ ${item.subtotal.toFixed(2)}`);
      connectedPrinter.alignLeft();
      
      if (item.notes) {
        connectedPrinter.println(`Obs: ${item.notes}`);
      }
    });
    
    connectedPrinter.drawLine();
    
    // Total
    connectedPrinter.alignRight();
    connectedPrinter.bold(true);
    connectedPrinter.println(`TOTAL: R$ ${orderData.total.toFixed(2)}`);
    connectedPrinter.bold(false);
    
    connectedPrinter.alignCenter();
    connectedPrinter.drawLine();
    connectedPrinter.println('Obrigado pela preferência!');
    connectedPrinter.newLine();
    connectedPrinter.newLine();
    connectedPrinter.cut();
    
    await connectedPrinter.execute();
    
    return { success: true, message: 'Comprovante impresso com sucesso' };
  } catch (error) {
    console.error('Error printing:', error);
    return { success: false, message: error.message };
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  }
});

// Connect to scale
<<<<<<< HEAD
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
=======
ipcMain.handle('connect-scale', async (event, devicePath) => {
  try {
    const scale = new SerialPort({
      path: devicePath,
      baudRate: 9600
    });

    connectedScale = scale;
    
    return { success: true, message: 'Balança conectada com sucesso' };
  } catch (error) {
    console.error('Error connecting scale:', error);
    return { success: false, message: error.message };
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  }
});

// Read weight from scale
<<<<<<< HEAD
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
=======
ipcMain.handle('read-weight', async () => {
  if (!connectedScale) {
    return { success: false, message: 'Nenhuma balança conectada' };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, message: 'Timeout na leitura do peso' });
    }, 5000);

    connectedScale.write('\x05'); // ENQ command for most scales

    connectedScale.once('data', (data) => {
      clearTimeout(timeout);
      const dataStr = data.toString();
      const weightMatch = dataStr.match(/\+?(\d+\.?\d*)/);
      
      if (weightMatch) {
        const weight = parseFloat(weightMatch[1]);
        resolve({ success: true, weight });
      } else {
        resolve({ success: false, message: 'Não foi possível ler o peso' });
      }
    });
  });
});

// Disconnect devices
ipcMain.handle('disconnect-printer', async () => {
  if (connectedPrinter) {
    connectedPrinter = null;
  }
  return { success: true };
});

ipcMain.handle('disconnect-scale', async () => {
  if (connectedScale && connectedScale.isOpen) {
    connectedScale.close();
    connectedScale = null;
  }
  return { success: true };
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
});

// Show system notification
ipcMain.handle('show-notification', async (event, title, body) => {
<<<<<<< HEAD
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
=======
  const { Notification } = require('electron');
  
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  
  return { success: true };
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
});
