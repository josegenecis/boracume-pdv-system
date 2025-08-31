const { SerialPort } = require('serialport');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

// Configuração de dispositivos conhecidos
const KNOWN_DEVICES = {
  printers: [
    { vid: '04b8', pid: '0202', name: 'Epson TM-T20', protocol: 'epson' },
    { vid: '04b8', pid: '0e15', name: 'Epson TM-T88V', protocol: 'epson' },
    { vid: '04b8', pid: '0e28', name: 'Epson TM-T88VI', protocol: 'epson' },
    { vid: '0b95', pid: '1790', name: 'Bematech MP-4200', protocol: 'bematech' },
    { vid: '0471', pid: '0055', name: 'Daruma DR700', protocol: 'daruma' }
  ],
  scales: [
    { vid: '0eb8', pid: 'f000', name: 'Toledo Prix 3/4/5', protocol: 'toledo' },
    { vid: '1a86', pid: '7523', name: 'Filizola BP Series', protocol: 'filizola' },
    { vid: '10c4', pid: 'ea60', name: 'Urano POP-S', protocol: 'urano' },
    { vid: '067b', pid: '2303', name: 'Magna M2000/M3000', protocol: 'magna' }
  ]
};

class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.connectedDevices = new Map();
    this.deviceWatchers = new Map();
    this.configPath = path.join(__dirname, '../config/devices.json');
    this.isScanning = false;
    this.scanInterval = null;
    
    // Inicializar configuração
    this.initializeConfig();
  }

  async initializeConfig() {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // Verificar se arquivo de configuração existe
      try {
        await fs.access(this.configPath);
      } catch {
        // Criar configuração padrão
        const defaultConfig = {
          autoConnect: true,
          scanInterval: 5000,
          retryAttempts: 3,
          devices: {
            printers: [],
            scales: []
          }
        };
        await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
      }
    } catch (error) {
      console.error('Erro ao inicializar configuração:', error);
    }
  }

  async loadConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      return null;
    }
  }

  async saveConfig(config) {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      return false;
    }
  }

  async scanForDevices() {
    try {
      const ports = await SerialPort.list();
      const detectedDevices = [];
      
      for (const port of ports) {
        const device = this.identifyDevice(port);
        if (device) {
          detectedDevices.push({
            id: port.path,
            name: device.name,
            type: device.type,
            protocol: device.protocol,
            manufacturer: port.manufacturer,
            vendorId: port.vendorId,
            productId: port.productId,
            connected: this.connectedDevices.has(port.path),
            port: port.path
          });
        }
      }
      
      this.emit('devicesScanned', detectedDevices);
      return detectedDevices;
    } catch (error) {
      console.error('Erro ao escanear dispositivos:', error);
      this.emit('scanError', error);
      return [];
    }
  }

  identifyDevice(port) {
    const vid = port.vendorId?.toLowerCase();
    const pid = port.productId?.toLowerCase();
    
    if (!vid || !pid) return null;
    
    // Verificar impressoras
    for (const printer of KNOWN_DEVICES.printers) {
      if (printer.vid === vid && printer.pid === pid) {
        return { ...printer, type: 'printer' };
      }
    }
    
    // Verificar balanças
    for (const scale of KNOWN_DEVICES.scales) {
      if (scale.vid === vid && scale.pid === pid) {
        return { ...scale, type: 'scale' };
      }
    }
    
    // Dispositivo genérico baseado no fabricante
    if (port.manufacturer) {
      const manufacturer = port.manufacturer.toLowerCase();
      if (manufacturer.includes('epson') || manufacturer.includes('bematech')) {
        return { name: `${port.manufacturer} Printer`, type: 'printer', protocol: 'generic' };
      }
      if (manufacturer.includes('toledo') || manufacturer.includes('filizola')) {
        return { name: `${port.manufacturer} Scale`, type: 'scale', protocol: 'generic' };
      }
    }
    
    return null;
  }

  async connectDevice(deviceId, deviceType, options = {}) {
    try {
      if (this.connectedDevices.has(deviceId)) {
        return { success: true, message: 'Dispositivo já conectado' };
      }

      const deviceConfig = {
        path: deviceId,
        baudRate: options.baudRate || 9600,
        dataBits: options.dataBits || 8,
        stopBits: options.stopBits || 1,
        parity: options.parity || 'none',
        autoOpen: false
      };

      const serialPort = new SerialPort(deviceConfig);
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, message: 'Timeout na conexão' });
        }, 10000);

        serialPort.open((error) => {
          clearTimeout(timeout);
          
          if (error) {
            resolve({ success: false, message: error.message });
            return;
          }

          // Configurar device info
          const deviceInfo = {
            id: deviceId,
            type: deviceType,
            port: serialPort,
            connected: true,
            lastActivity: Date.now(),
            options
          };

          this.connectedDevices.set(deviceId, deviceInfo);
          this.startDeviceWatcher(deviceId);
          
          this.emit('deviceConnected', deviceInfo);
          resolve({ success: true, message: 'Dispositivo conectado com sucesso' });
        });
      });
    } catch (error) {
      console.error('Erro ao conectar dispositivo:', error);
      return { success: false, message: error.message };
    }
  }

  async disconnectDevice(deviceId) {
    try {
      const device = this.connectedDevices.get(deviceId);
      
      if (!device) {
        return { success: true, message: 'Dispositivo não estava conectado' };
      }

      // Parar watcher
      this.stopDeviceWatcher(deviceId);
      
      // Fechar porta serial
      if (device.port && device.port.isOpen) {
        await new Promise((resolve) => {
          device.port.close(resolve);
        });
      }

      this.connectedDevices.delete(deviceId);
      this.emit('deviceDisconnected', { id: deviceId, type: device.type });
      
      return { success: true, message: 'Dispositivo desconectado' };
    } catch (error) {
      console.error('Erro ao desconectar dispositivo:', error);
      return { success: false, message: error.message };
    }
  }

  startDeviceWatcher(deviceId) {
    if (this.deviceWatchers.has(deviceId)) {
      return;
    }

    const watcher = setInterval(async () => {
      const device = this.connectedDevices.get(deviceId);
      
      if (!device || !device.port) {
        this.stopDeviceWatcher(deviceId);
        return;
      }

      // Verificar se a porta ainda está aberta
      if (!device.port.isOpen) {
        console.log(`Dispositivo ${deviceId} desconectado inesperadamente`);
        await this.disconnectDevice(deviceId);
        
        // Tentar reconectar se configurado
        const config = await this.loadConfig();
        if (config?.autoConnect) {
          setTimeout(() => {
            this.connectDevice(deviceId, device.type, device.options);
          }, 2000);
        }
      }
    }, 3000);

    this.deviceWatchers.set(deviceId, watcher);
  }

  stopDeviceWatcher(deviceId) {
    const watcher = this.deviceWatchers.get(deviceId);
    if (watcher) {
      clearInterval(watcher);
      this.deviceWatchers.delete(deviceId);
    }
  }

  startAutoScan() {
    if (this.isScanning) return;
    
    this.isScanning = true;
    this.scanInterval = setInterval(() => {
      this.scanForDevices();
    }, 5000);
    
    // Scan inicial
    this.scanForDevices();
  }

  stopAutoScan() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
  }

  getConnectedDevices() {
    const devices = [];
    for (const [id, device] of this.connectedDevices) {
      devices.push({
        id,
        type: device.type,
        connected: device.connected,
        lastActivity: device.lastActivity
      });
    }
    return devices;
  }

  getDevice(deviceId) {
    return this.connectedDevices.get(deviceId);
  }

  async disconnectAll() {
    const disconnectPromises = [];
    
    for (const deviceId of this.connectedDevices.keys()) {
      disconnectPromises.push(this.disconnectDevice(deviceId));
    }
    
    await Promise.all(disconnectPromises);
    this.stopAutoScan();
  }

  // Método para enviar dados para um dispositivo
  async sendData(deviceId, data) {
    const device = this.connectedDevices.get(deviceId);
    
    if (!device || !device.port || !device.port.isOpen) {
      throw new Error('Dispositivo não conectado');
    }

    return new Promise((resolve, reject) => {
      device.port.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          device.lastActivity = Date.now();
          resolve(true);
        }
      });
    });
  }

  // Método para ler dados de um dispositivo
  async readData(deviceId, timeout = 5000) {
    const device = this.connectedDevices.get(deviceId);
    
    if (!device || !device.port || !device.port.isOpen) {
      throw new Error('Dispositivo não conectado');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout na leitura'));
      }, timeout);

      device.port.once('data', (data) => {
        clearTimeout(timeoutId);
        device.lastActivity = Date.now();
        resolve(data);
      });
    });
  }
}

module.exports = DeviceManager;