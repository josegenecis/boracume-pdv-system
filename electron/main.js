
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const { SerialPort } = require('serialport');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

let mainWindow;
let connectedPrinter = null;
let connectedScale = null;

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

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
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

// IPC Handlers for device integration

// Scan for available serial ports (printers and scales)
ipcMain.handle('scan-serial-ports', async () => {
  try {
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
  }
});

// Connect to printer
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
  }
});

// Print receipt
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
  }
});

// Connect to scale
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
  }
});

// Read weight from scale
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
});

// Show system notification
ipcMain.handle('show-notification', async (event, title, body) => {
  const { Notification } = require('electron');
  
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  
  return { success: true };
});
