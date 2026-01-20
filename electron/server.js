const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const DeviceManager = require('./services/DeviceManager');
const PrinterService = require('./services/PrinterService');
const ScaleService = require('./services/ScaleService');

class PrintAgentServer {
  constructor(port = 17171) {
    this.app = express();
    this.port = port;
    this.server = null;
    this.wss = null;
    
    // Inicializar serviços
    this.deviceManager = new DeviceManager();
    this.printerService = new PrinterService(this.deviceManager);
    this.scaleService = new ScaleService(this.deviceManager);
    
    this.setupExpress();
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());

    // Rotas de Status
    this.app.get('/status', (req, res) => {
      res.json({
        status: 'running',
        version: '1.0.0',
        services: {
          printer: this.printerService.connectedPrinters.size,
          scale: this.scaleService.connectedScales.size
        }
      });
    });

    // Rotas de Impressora
    this.app.get('/printers', async (req, res) => {
      try {
        const printers = await this.printerService.getAvailablePrinters();
        res.json({ success: true, printers });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    this.app.post('/print', async (req, res) => {
      try {
        const { printerName, content, options } = req.body;
        
        // Se for nome de impressora do sistema, usar método específico (futuro)
        // Por enquanto, assumimos impressão direta ou ESC/POS via serial/USB
        
        // Simulação para o MVP: conectar, imprimir, desconectar
        // Na prática, manteríamos conexão persistente ou usaríamos fila
        
        // Aqui precisaríamos mapear "printerName" (do Windows) para porta/dispositivo
        // ou usar um adaptador "SystemPrinter" no PrinterService.
        
        // Por enquanto, vamos tentar imprimir via comando direto se for USB
        // ou via driver do sistema (que o PrinterService.getSystemPrinters lista)
        
        // TODO: Implementar impressão via driver do sistema no PrinterService
        // this.printerService.printToSystemPrinter(printerName, content)
        
        res.json({ success: true, message: 'Job enviado para fila' });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });
    
    // Rotas de Balança
    this.app.get('/scales', async (req, res) => {
      try {
        const scales = await this.deviceManager.scanForDevices();
        const connected = this.scaleService.getConnectedScales();
        res.json({ success: true, available: scales, connected });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });

    this.app.get('/weight/:deviceId', async (req, res) => {
      try {
        const { deviceId } = req.params;
        const result = await this.scaleService.readWeight(deviceId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      }
    });
  }

  start() {
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.wss.on('connection', (ws) => {
      console.log('Cliente PWA conectado via WebSocket');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (e) {
          console.error('Erro no WebSocket:', e);
        }
      });
    });

    // Encaminhar eventos dos serviços para o WebSocket
    this.setupEventForwarding();

    this.server.listen(this.port, () => {
      console.log(`Print Agent rodando em http://localhost:${this.port}`);
    });
  }

  handleWebSocketMessage(ws, data) {
    // Processar comandos via WS se necessário
    if (data.type === 'GET_WEIGHT') {
      // Exemplo
    }
  }

  setupEventForwarding() {
    // Quando a balança ler peso, enviar para todos clientes conectados
    this.scaleService.on('weightRead', (data) => {
      this.broadcast({ type: 'WEIGHT_READ', data });
    });
    
    this.printerService.on('printCompleted', (data) => {
      this.broadcast({ type: 'PRINT_COMPLETED', data });
    });
  }

  broadcast(data) {
    if (!this.wss) return;
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

module.exports = PrintAgentServer;
