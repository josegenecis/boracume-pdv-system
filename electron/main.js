const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;
const { SerialPort } = require('serialport');
const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;

const DeviceManager = require('./services/DeviceManager');
const PrinterService = require('./services/PrinterService');
const ScaleService = require('./services/ScaleService');
const PrintAgentServer = require('./server');

let mainWindow;
let tray = null;
let deviceManager;
let printerService;
let scaleService;
let printAgentServer;

// Verificar se deve rodar em modo "Agente" (sem janela principal, apenas Tray)
// Pode ser passado via linha de comando: --agent-mode
const isAgentMode = process.argv.includes('--agent-mode');

function createWindow() {
  // Se for modo agente, não criar janela principal imediatamente, ou criar oculta
  if (isAgentMode) {
    createTray();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon-512x512.png'),
    show: false,
    titleBarStyle: 'default'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:8080/desktop');
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      dialog.showErrorBox('Erro ao iniciar', `Arquivo não encontrado:\n${indexPath}`);
    } else {
      mainWindow.loadFile(indexPath, { hash: 'desktop' });
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Falha ao carregar UI:', { errorCode, errorDescription, validatedURL });
    dialog.showErrorBox('Erro ao carregar interface', `${errorDescription}\n\nURL:\n${validatedURL}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Criar Tray icon mesmo com janela aberta, para acesso rápido
  if (!tray) {
    createTray();
  }

  initializeServices();
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../public/favicon.ico'); // Ajustar caminho se necessário
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'BoraCumê Print Agent', enabled: false },
      { type: 'separator' },
      { label: 'Status: Rodando', enabled: false },
      { label: 'Porta: 17171', enabled: false },
      { type: 'separator' },
      { 
        label: 'Abrir Painel', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
          } else {
            // Se estiver em modo agente e usuário clicar em abrir, recria janela normal
            // mas navegando para uma página de status local se possível, ou recarregando app
             if (isAgentMode && !mainWindow) {
               // TODO: Implementar janela de status leve
               // Por enquanto, não faz nada ou abre app completo
             }
             if (!mainWindow) createWindow();
          }
        } 
      },
      { label: 'Sair', click: () => app.quit() }
    ]);

    tray.setToolTip('BoraCumê Print Agent');
    tray.setContextMenu(contextMenu);
    
    // Duplo clique abre
    tray.on('double-click', () => {
      if (mainWindow) mainWindow.show();
      else createWindow();
    });

  } catch (error) {
    console.error('Erro ao criar Tray:', error);
  }
}

app.whenReady().then(() => {
  createWindow();
  // Iniciar servidor local
  startPrintServer();
});

app.on('window-all-closed', () => {
  // No modo agente ou se tiver tray, manter rodando
  if (process.platform !== 'darwin' && !tray) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function initializeServices() {
  try {
    // Se já foi inicializado pelo Server, reaproveitar ou garantir singleton
    if (!deviceManager) {
      deviceManager = new DeviceManager();
      printerService = new PrinterService(deviceManager);
      scaleService = new ScaleService(deviceManager);
    }
    console.log('Serviços de dispositivos inicializados com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar serviços:', error);
  }
}

function startPrintServer() {
  try {
    printAgentServer = new PrintAgentServer(17171);
    printAgentServer.start();
    
    // Sincronizar instâncias de serviço se necessário
    // O PrintAgentServer cria suas próprias instâncias de DeviceManager, etc.
    // O ideal seria compartilhar, mas para simplificar MVP vamos deixar independentes
    // ou fazer o Server usar os globais se existirem.
    
    // Melhor: O Server instancia seus serviços. Vamos usar as referências dele para o IPC também
    // para evitar conflito de acesso às portas seriais.
    deviceManager = printAgentServer.deviceManager;
    printerService = printAgentServer.printerService;
    scaleService = printAgentServer.scaleService;
    
    console.log('Print Agent Server iniciado');
  } catch (error) {
    console.error('Erro ao iniciar Print Agent Server:', error);
  }
}

// IPC Handlers (mantidos iguais, agora usando as instâncias do Server)
ipcMain.handle('scan-serial-ports', async () => {
  try {
    if (!deviceManager) return { success: false, error: 'Serviços não inicializados' };
    return await deviceManager.scanForDevices(); // Corrigido nome do método se necessário
  } catch (error) {
    console.error('Error scanning serial ports:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-serial-ports', async () => {
  try {
    if (!deviceManager) return { success: false, error: 'Serviços não inicializados', ports: [] };
    const ports = await deviceManager.listSerialPorts();
    return { success: true, ports };
  } catch (error) {
    console.error('Error listing serial ports:', error);
    return { success: false, error: error.message, ports: [] };
  }
});

ipcMain.handle('connect-printer', async (event, deviceId, protocol = 'epson', options = {}) => {
  try {
    if (!printerService) return { success: false, error: 'Serviço de impressora não inicializado' };
    const merged = { ...(options || {}), protocol };
    return await printerService.connectPrinter(deviceId, merged);
  } catch (error) {
    console.error('Error connecting to printer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-receipt', async (event, deviceId, orderData, template = 'receipt') => {
  try {
    if (!printerService) return { success: false, error: 'Serviço de impressora não inicializado' };
    return await printerService.printReceipt(deviceId, orderData, template);
  } catch (error) {
    console.error('Error printing receipt:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('connect-scale', async (event, deviceId, protocol = 'generic', options = {}) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    return await scaleService.connectScale(deviceId, protocol, options);
  } catch (error) {
    console.error('Error connecting to scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-weight', async (event, deviceId, timeout = 5000) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    return await scaleService.readWeight(deviceId, timeout);
  } catch (error) {
    console.error('Error reading weight:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-printer', async (event, deviceId) => {
  try {
    if (!printerService) return { success: false, error: 'Serviço de impressora não inicializado' };
    return await printerService.disconnectPrinter(deviceId);
  } catch (error) {
    console.error('Error disconnecting printer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-scale', async (event, deviceId) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    return await scaleService.disconnectScale(deviceId);
  } catch (error) {
    console.error('Error disconnecting scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('show-notification', async (event, title, body) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: path.join(__dirname, '../assets/icon.png') }).show();
    }
    return { success: true };
  } catch (error) {
    console.error('Error showing notification:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('tare-scale', async (event, deviceId) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    return await scaleService.tareScale(deviceId);
  } catch (error) {
    console.error('Error taring scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('zero-scale', async (event, deviceId) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    return await scaleService.zeroScale(deviceId);
  } catch (error) {
    console.error('Error zeroing scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('calibrate-scale', async (event, deviceId, knownWeight, currentReading) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    return await scaleService.calibrateScale(deviceId, knownWeight, currentReading);
  } catch (error) {
    console.error('Error calibrating scale:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-auto-reading', async (event, deviceId) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    scaleService.startAutoReading(deviceId);
    return { success: true, message: 'Leitura automática iniciada' };
  } catch (error) {
    console.error('Error starting auto reading:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-auto-reading', async (event, deviceId) => {
  try {
    if (!scaleService) return { success: false, error: 'Serviço de balança não inicializado' };
    scaleService.stopAutoReading(deviceId);
    return { success: true, message: 'Leitura automática parada' };
  } catch (error) {
    console.error('Error stopping auto reading:', error);
    return { success: false, error: error.message };
  }
});

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

ipcMain.handle('get-available-printers', async () => {
  try {
    if (!printerService) throw new Error('Serviço de impressora não inicializado');
    const printers = await printerService.getAvailablePrinters();
    return { success: true, printers };
  } catch (error) {
    console.error('Erro ao listar impressoras:', error);
    return { success: false, error: error.message, printers: [] };
  }
});

ipcMain.handle('print-system', async (event, { deviceName, html, silent = true } = {}) => {
  try {
    if (!html || typeof html !== 'string') {
      return { success: false, error: 'HTML inválido' };
    }

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const encoded = encodeURIComponent(html);
    await win.loadURL(`data:text/html;charset=utf-8,${encoded}`);

    const printResult = await new Promise((resolve) => {
      win.webContents.print(
        {
          silent: !!silent,
          deviceName: deviceName || undefined,
          printBackground: true
        },
        (success, failureReason) => resolve({ success, failureReason })
      );
    });

    try {
      win.close();
    } catch {}

    if (!printResult.success) {
      return { success: false, error: String(printResult.failureReason || 'Falha ao imprimir') };
    }

    return { success: true };
  } catch (error) {
    console.error('Erro ao imprimir via sistema:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-cash-drawer', async (event, deviceId) => {
  try {
    if (!printerService) return { success: false, error: 'Serviço de impressora não inicializado' };
    return await printerService.openCashDrawer(deviceId);
  } catch (error) {
    console.error('Error opening cash drawer:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-product-label', async (event, deviceId, productData) => {
  try {
    if (!printerService) return { success: false, error: 'Serviço de impressora não inicializado' };
    return await printerService.printReceipt(deviceId, productData, 'product_label');
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
