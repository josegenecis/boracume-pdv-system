const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

// Protocolos de comunicação para diferentes marcas de balança
const SCALE_PROTOCOLS = {
  toledo: {
    name: 'Toledo Prix Series',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    commands: {
      requestWeight: Buffer.from([0x05]), // ENQ
      tare: Buffer.from([0x54]), // T
      zero: Buffer.from([0x5A]) // Z
    },
    parseWeight: (data) => {
      const dataStr = data.toString().trim();
      // Formato Toledo: +00000.000kg ou similar
      const match = dataStr.match(/([+-]?\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    }
  },
  
  filizola: {
    name: 'Filizola BP Series',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    commands: {
      requestWeight: Buffer.from([0x05]), // ENQ
      tare: Buffer.from([0x02, 0x54, 0x03]), // STX T ETX
      zero: Buffer.from([0x02, 0x5A, 0x03]) // STX Z ETX
    },
    parseWeight: (data) => {
      const dataStr = data.toString().trim();
      // Formato Filizola: varia por modelo
      const match = dataStr.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    }
  },
  
  urano: {
    name: 'Urano POP-S',
    baudRate: 4800,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    commands: {
      requestWeight: Buffer.from([0x05]), // ENQ
      tare: Buffer.from('T\r\n'),
      zero: Buffer.from('Z\r\n')
    },
    parseWeight: (data) => {
      const dataStr = data.toString().trim();
      // Formato Urano: peso em gramas ou kg
      const match = dataStr.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    }
  },
  
  magna: {
    name: 'Magna M Series',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    commands: {
      requestWeight: Buffer.from([0x05]), // ENQ
      tare: Buffer.from('TARE\r'),
      zero: Buffer.from('ZERO\r')
    },
    parseWeight: (data) => {
      const dataStr = data.toString().trim();
      // Formato Magna: varia por modelo
      const match = dataStr.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    }
  },
  
  generic: {
    name: 'Protocolo Genérico',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    commands: {
      requestWeight: Buffer.from([0x05]), // ENQ padrão
      tare: Buffer.from('T'),
      zero: Buffer.from('Z')
    },
    parseWeight: (data) => {
      const dataStr = data.toString().trim();
      // Tentar extrair qualquer número decimal
      const match = dataStr.match(/([+-]?\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : null;
    }
  }
};

class ScaleService extends EventEmitter {
  constructor(deviceManager) {
    super();
    this.deviceManager = deviceManager;
    this.connectedScales = new Map();
    this.readingIntervals = new Map();
    this.calibrationData = new Map();
    
    // Configurações padrão
    this.defaultConfig = {
      autoRead: false,
      readInterval: 1000,
      stabilityThreshold: 0.01,
      stabilityTime: 2000,
      maxWeight: 30000, // 30kg padrão
      unit: 'g' // g, kg
    };
  }

  async connectScale(deviceId, protocol = 'generic', options = {}) {
    try {
      // Verificar se já está conectado
      if (this.connectedScales.has(deviceId)) {
        return { success: true, message: 'Balança já conectada' };
      }

      // Obter configuração do protocolo
      const protocolConfig = SCALE_PROTOCOLS[protocol] || SCALE_PROTOCOLS.generic;
      
      // Configurar opções de conexão
      const connectionOptions = {
        baudRate: options.baudRate || protocolConfig.baudRate,
        dataBits: options.dataBits || protocolConfig.dataBits,
        stopBits: options.stopBits || protocolConfig.stopBits,
        parity: options.parity || protocolConfig.parity
      };

      // Conectar dispositivo via DeviceManager
      const connectionResult = await this.deviceManager.connectDevice(
        deviceId, 
        'scale', 
        connectionOptions
      );
      
      if (!connectionResult.success) {
        return connectionResult;
      }

      // Configurar informações da balança
      const scaleInfo = {
        protocol,
        protocolConfig,
        options: { ...this.defaultConfig, ...options },
        lastReading: null,
        isStable: false,
        stabilityBuffer: [],
        status: 'ready',
        calibration: this.calibrationData.get(deviceId) || { offset: 0, factor: 1 }
      };

      this.connectedScales.set(deviceId, scaleInfo);
      
      // Testar comunicação
      const testResult = await this.testCommunication(deviceId);
      
      if (!testResult.success) {
        await this.disconnectScale(deviceId);
        return { success: false, message: 'Falha na comunicação com a balança' };
      }

      // Iniciar leitura automática se configurado
      if (scaleInfo.options.autoRead) {
        this.startAutoReading(deviceId);
      }

      this.emit('scaleConnected', { deviceId, protocol, options: scaleInfo.options });
      return { success: true, message: 'Balança conectada com sucesso' };
      
    } catch (error) {
      console.error('Erro ao conectar balança:', error);
      return { success: false, message: error.message };
    }
  }

  async disconnectScale(deviceId) {
    try {
      const scaleInfo = this.connectedScales.get(deviceId);
      
      if (scaleInfo) {
        // Parar leitura automática
        this.stopAutoReading(deviceId);
        this.connectedScales.delete(deviceId);
      }

      const result = await this.deviceManager.disconnectDevice(deviceId);
      
      if (result.success) {
        this.emit('scaleDisconnected', { deviceId });
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao desconectar balança:', error);
      return { success: false, message: error.message };
    }
  }

  async testCommunication(deviceId) {
    try {
      const reading = await this.readWeight(deviceId, 3000);
      return { success: reading.success, message: reading.message };
    } catch (error) {
      return { success: false, message: 'Falha no teste de comunicação' };
    }
  }

  async readWeight(deviceId, timeout = 5000) {
    try {
      const scaleInfo = this.connectedScales.get(deviceId);
      
      if (!scaleInfo) {
        return { success: false, message: 'Balança não conectada' };
      }

      const { protocolConfig } = scaleInfo;
      
      // Enviar comando de solicitação de peso
      await this.deviceManager.sendData(deviceId, protocolConfig.commands.requestWeight);
      
      // Aguardar resposta
      const data = await this.deviceManager.readData(deviceId, timeout);
      
      // Parsear peso usando o protocolo específico
      const rawWeight = protocolConfig.parseWeight(data);
      
      if (rawWeight === null) {
        return { success: false, message: 'Não foi possível interpretar o peso' };
      }

      // Aplicar calibração
      const calibratedWeight = this.applyCalibratio(rawWeight, scaleInfo.calibration);
      
      // Converter unidade se necessário
      const weight = this.convertUnit(calibratedWeight, scaleInfo.options.unit);
      
      // Atualizar informações da balança
      scaleInfo.lastReading = {
        weight,
        rawWeight,
        timestamp: Date.now(),
        stable: this.checkStability(deviceId, weight)
      };
      
      scaleInfo.status = 'ready';
      
      this.emit('weightRead', { deviceId, weight, stable: scaleInfo.lastReading.stable });
      
      return { 
        success: true, 
        weight, 
        stable: scaleInfo.lastReading.stable,
        unit: scaleInfo.options.unit
      };
      
    } catch (error) {
      console.error('Erro ao ler peso:', error);
      
      const scaleInfo = this.connectedScales.get(deviceId);
      if (scaleInfo) {
        scaleInfo.status = 'error';
      }
      
      this.emit('readError', { deviceId, error: error.message });
      return { success: false, message: error.message };
    }
  }

  applyCalibratio(rawWeight, calibration) {
    return (rawWeight + calibration.offset) * calibration.factor;
  }

  convertUnit(weight, targetUnit) {
    // Assumindo que o peso vem em gramas por padrão
    switch (targetUnit) {
      case 'kg':
        return weight / 1000;
      case 'g':
      default:
        return weight;
    }
  }

  checkStability(deviceId, currentWeight) {
    const scaleInfo = this.connectedScales.get(deviceId);
    
    if (!scaleInfo) return false;
    
    const { stabilityBuffer, options } = scaleInfo;
    const now = Date.now();
    
    // Adicionar leitura atual ao buffer
    stabilityBuffer.push({ weight: currentWeight, timestamp: now });
    
    // Remover leituras antigas (fora do tempo de estabilidade)
    const cutoffTime = now - options.stabilityTime;
    scaleInfo.stabilityBuffer = stabilityBuffer.filter(reading => reading.timestamp > cutoffTime);
    
    // Verificar se há leituras suficientes
    if (scaleInfo.stabilityBuffer.length < 3) {
      return false;
    }
    
    // Calcular variação
    const weights = scaleInfo.stabilityBuffer.map(r => r.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const variation = max - min;
    
    // Considerar estável se a variação está dentro do threshold
    const isStable = variation <= options.stabilityThreshold;
    scaleInfo.isStable = isStable;
    
    return isStable;
  }

  async tareScale(deviceId) {
    try {
      const scaleInfo = this.connectedScales.get(deviceId);
      
      if (!scaleInfo) {
        return { success: false, message: 'Balança não conectada' };
      }

      const { protocolConfig } = scaleInfo;
      
      // Enviar comando de tara
      await this.deviceManager.sendData(deviceId, protocolConfig.commands.tare);
      
      // Aguardar um pouco para o comando ser processado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.emit('scaleTared', { deviceId });
      return { success: true, message: 'Tara realizada com sucesso' };
      
    } catch (error) {
      console.error('Erro ao fazer tara:', error);
      return { success: false, message: error.message };
    }
  }

  async zeroScale(deviceId) {
    try {
      const scaleInfo = this.connectedScales.get(deviceId);
      
      if (!scaleInfo) {
        return { success: false, message: 'Balança não conectada' };
      }

      const { protocolConfig } = scaleInfo;
      
      // Enviar comando de zero
      await this.deviceManager.sendData(deviceId, protocolConfig.commands.zero);
      
      // Aguardar um pouco para o comando ser processado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.emit('scaleZeroed', { deviceId });
      return { success: true, message: 'Zero realizado com sucesso' };
      
    } catch (error) {
      console.error('Erro ao zerar balança:', error);
      return { success: false, message: error.message };
    }
  }

  startAutoReading(deviceId) {
    const scaleInfo = this.connectedScales.get(deviceId);
    
    if (!scaleInfo || this.readingIntervals.has(deviceId)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.readWeight(deviceId, 2000);
      } catch (error) {
        console.error('Erro na leitura automática:', error);
      }
    }, scaleInfo.options.readInterval);

    this.readingIntervals.set(deviceId, interval);
    this.emit('autoReadingStarted', { deviceId });
  }

  stopAutoReading(deviceId) {
    const interval = this.readingIntervals.get(deviceId);
    
    if (interval) {
      clearInterval(interval);
      this.readingIntervals.delete(deviceId);
      this.emit('autoReadingStopped', { deviceId });
    }
  }

  async calibrateScale(deviceId, knownWeight, currentReading) {
    try {
      const scaleInfo = this.connectedScales.get(deviceId);
      
      if (!scaleInfo) {
        return { success: false, message: 'Balança não conectada' };
      }

      // Calcular fator de calibração
      const factor = knownWeight / currentReading;
      
      // Atualizar calibração
      scaleInfo.calibration.factor = factor;
      this.calibrationData.set(deviceId, scaleInfo.calibration);
      
      // Salvar calibração em arquivo
      await this.saveCalibration(deviceId, scaleInfo.calibration);
      
      this.emit('scaleCalibrated', { deviceId, factor });
      return { success: true, message: 'Calibração realizada com sucesso' };
      
    } catch (error) {
      console.error('Erro ao calibrar balança:', error);
      return { success: false, message: error.message };
    }
  }

  async saveCalibration(deviceId, calibration) {
    try {
      const calibrationDir = path.join(__dirname, '../config/calibration');
      await fs.mkdir(calibrationDir, { recursive: true });
      
      const calibrationPath = path.join(calibrationDir, `${deviceId.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
      await fs.writeFile(calibrationPath, JSON.stringify(calibration, null, 2));
      
    } catch (error) {
      console.error('Erro ao salvar calibração:', error);
    }
  }

  async loadCalibration(deviceId) {
    try {
      const calibrationPath = path.join(
        __dirname, 
        '../config/calibration', 
        `${deviceId.replace(/[^a-zA-Z0-9]/g, '_')}.json`
      );
      
      const calibrationData = await fs.readFile(calibrationPath, 'utf8');
      const calibration = JSON.parse(calibrationData);
      
      this.calibrationData.set(deviceId, calibration);
      return calibration;
      
    } catch (error) {
      // Retornar calibração padrão se não encontrar arquivo
      const defaultCalibration = { offset: 0, factor: 1 };
      this.calibrationData.set(deviceId, defaultCalibration);
      return defaultCalibration;
    }
  }

  getConnectedScales() {
    const scales = [];
    
    for (const [deviceId, info] of this.connectedScales) {
      scales.push({
        deviceId,
        protocol: info.protocol,
        status: info.status,
        lastReading: info.lastReading,
        isStable: info.isStable,
        options: info.options
      });
    }
    
    return scales;
  }

  getScaleStatus(deviceId) {
    const scaleInfo = this.connectedScales.get(deviceId);
    return scaleInfo ? scaleInfo.status : 'disconnected';
  }

  getLastReading(deviceId) {
    const scaleInfo = this.connectedScales.get(deviceId);
    return scaleInfo ? scaleInfo.lastReading : null;
  }

  getSupportedProtocols() {
    return Object.keys(SCALE_PROTOCOLS).map(key => ({
      id: key,
      name: SCALE_PROTOCOLS[key].name,
      baudRate: SCALE_PROTOCOLS[key].baudRate
    }));
  }

  async updateScaleOptions(deviceId, newOptions) {
    const scaleInfo = this.connectedScales.get(deviceId);
    
    if (!scaleInfo) {
      return { success: false, message: 'Balança não conectada' };
    }

    // Atualizar opções
    scaleInfo.options = { ...scaleInfo.options, ...newOptions };
    
    // Reiniciar leitura automática se necessário
    if (newOptions.autoRead !== undefined) {
      if (newOptions.autoRead) {
        this.startAutoReading(deviceId);
      } else {
        this.stopAutoReading(deviceId);
      }
    }
    
    this.emit('scaleOptionsUpdated', { deviceId, options: scaleInfo.options });
    return { success: true, message: 'Opções atualizadas com sucesso' };
  }
}

module.exports = ScaleService;