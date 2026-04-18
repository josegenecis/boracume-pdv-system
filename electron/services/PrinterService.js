const ThermalPrinter = require('node-thermal-printer').printer;
const PrinterTypes = require('node-thermal-printer').types;
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class PrinterService extends EventEmitter {
  constructor(deviceManager) {
    super();
    this.deviceManager = deviceManager;
    this.connectedPrinters = new Map();
    this.templates = new Map();
    
    // Carregar templates padrão
    this.loadDefaultTemplates();
  }

  loadDefaultTemplates() {
    // Template padrão para cupom fiscal
    this.templates.set('receipt', {
      name: 'Cupom Padrão',
      width: 48,
      sections: [
        { type: 'header', align: 'center' },
        { type: 'order_info', align: 'left' },
        { type: 'items', align: 'left' },
        { type: 'totals', align: 'right' },
        { type: 'footer', align: 'center' }
      ]
    });

    // Template para etiqueta de produto
    this.templates.set('product_label', {
      name: 'Etiqueta de Produto',
      width: 32,
      sections: [
        { type: 'product_name', align: 'center' },
        { type: 'barcode', align: 'center' },
        { type: 'price', align: 'center' }
      ]
    });
  }

  async connectPrinter(deviceId, options = {}) {
    try {
      // Verificar se já está conectado
      if (this.connectedPrinters.has(deviceId)) {
        return { success: true, message: 'Impressora já conectada' };
      }

      // Conectar dispositivo via DeviceManager
      const connectionResult = await this.deviceManager.connectDevice(deviceId, 'printer', options);
      
      if (!connectionResult.success) {
        return connectionResult;
      }

      // Configurar impressora térmica
      const printerConfig = {
        type: this.getPrinterType(options.protocol || 'epson'),
        interface: deviceId,
        options: {
          timeout: options.timeout || 5000,
          width: options.width || 48
        }
      };

      const printer = new ThermalPrinter(printerConfig);
      
      // Testar conexão
      const isConnected = await printer.isPrinterConnected();
      
      if (!isConnected) {
        await this.deviceManager.disconnectDevice(deviceId);
        return { success: false, message: 'Falha na comunicação com a impressora' };
      }

      // Armazenar informações da impressora
      this.connectedPrinters.set(deviceId, {
        printer,
        config: printerConfig,
        options,
        lastPrint: null,
        status: 'ready'
      });

      this.emit('printerConnected', { deviceId, config: printerConfig });
      return { success: true, message: 'Impressora conectada com sucesso' };
      
    } catch (error) {
      console.error('Erro ao conectar impressora:', error);
      return { success: false, message: error.message };
    }
  }

  async disconnectPrinter(deviceId) {
    try {
      const printerInfo = this.connectedPrinters.get(deviceId);
      
      if (printerInfo) {
        this.connectedPrinters.delete(deviceId);
      }

      const result = await this.deviceManager.disconnectDevice(deviceId);
      
      if (result.success) {
        this.emit('printerDisconnected', { deviceId });
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao desconectar impressora:', error);
      return { success: false, message: error.message };
    }
  }

  getPrinterType(protocol) {
    const typeMap = {
      'epson': PrinterTypes.EPSON,
      'bematech': PrinterTypes.EPSON, // Compatível com ESC/POS
      'daruma': PrinterTypes.EPSON,
      'elgin': PrinterTypes.EPSON,
      'tanca': PrinterTypes.EPSON,
      'pos': PrinterTypes.EPSON,
      'generic': PrinterTypes.EPSON
    };
    
    return typeMap[protocol] || PrinterTypes.EPSON;
  }

  async printReceipt(deviceId, orderData, templateName = 'receipt') {
    try {
      const printerInfo = this.connectedPrinters.get(deviceId);
      
      if (!printerInfo) {
        return { success: false, message: 'Impressora não conectada' };
      }

      const { printer } = printerInfo;
      const template = this.templates.get(templateName);
      
      if (!template) {
        return { success: false, message: 'Template não encontrado' };
      }

      // Limpar buffer da impressora
      printer.clear();
      
      // Aplicar template
      await this.applyTemplate(printer, template, orderData);
      
      // Executar impressão
      await printer.execute();
      
      // Atualizar status
      printerInfo.lastPrint = Date.now();
      printerInfo.status = 'ready';
      
      this.emit('printCompleted', { deviceId, orderData });
      return { success: true, message: 'Cupom impresso com sucesso' };
      
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      
      // Atualizar status de erro
      const printerInfo = this.connectedPrinters.get(deviceId);
      if (printerInfo) {
        printerInfo.status = 'error';
      }
      
      this.emit('printError', { deviceId, error: error.message });
      return { success: false, message: error.message };
    }
  }

  async applyTemplate(printer, template, data) {
    for (const section of template.sections) {
      const sectionConfig = {
        ...section,
        width: section.width || template.width
      };

      switch (section.type) {
        case 'header':
          await this.printHeader(printer, data, sectionConfig);
          break;
        case 'order_info':
          await this.printOrderInfo(printer, data, sectionConfig);
          break;
        case 'items':
          await this.printItems(printer, data, sectionConfig);
          break;
        case 'totals':
          await this.printTotals(printer, data, sectionConfig);
          break;
        case 'footer':
          await this.printFooter(printer, data, sectionConfig);
          break;
        case 'product_name':
          await this.printProductName(printer, data, sectionConfig);
          break;
        case 'barcode':
          await this.printBarcode(printer, data, sectionConfig);
          break;
        case 'price':
          await this.printPrice(printer, data, sectionConfig);
          break;
      }
    }
  }

  getSectionWidth(section) {
    const width = Number(section?.width || section?.charsPerLine || 48);
    return Number.isFinite(width) && width > 0 ? width : 48;
  }

  formatCurrency(value) {
    const amount = Number(value || 0);
    return `R$ ${amount.toFixed(2)}`;
  }

  wrapText(text, width) {
    const content = String(text || '').replace(/\s+/g, ' ').trim();
    if (!content) return [''];

    const safeWidth = Math.max(8, Number(width) || 48);
    const words = content.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= safeWidth) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
      }

      if (word.length <= safeWidth) {
        current = word;
        continue;
      }

      let remaining = word;
      while (remaining.length > safeWidth) {
        lines.push(remaining.slice(0, safeWidth));
        remaining = remaining.slice(safeWidth);
      }
      current = remaining;
    }

    if (current) {
      lines.push(current);
    }

    return lines.length ? lines : [''];
  }

  formatColumns(left, right, width) {
    const safeWidth = Math.max(8, Number(width) || 48);
    const leftText = String(left || '').trim();
    const rightText = String(right || '').trim();

    if (!rightText) {
      return this.wrapText(leftText, safeWidth);
    }

    const minGap = 2;
    const maxLeftWidth = Math.max(8, safeWidth - rightText.length - minGap);
    const leftLines = this.wrapText(leftText, maxLeftWidth);
    const lastLeftLine = leftLines[leftLines.length - 1] || '';

    if (lastLeftLine.length + minGap + rightText.length <= safeWidth) {
      const gap = Math.max(minGap, safeWidth - lastLeftLine.length - rightText.length);
      leftLines[leftLines.length - 1] = `${lastLeftLine}${' '.repeat(gap)}${rightText}`;
      return leftLines;
    }

    return [...leftLines, rightText.padStart(safeWidth)];
  }

  async printHeader(printer, data, section) {
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    
    const storeName = data.store?.name || 'BORA CUME HUB';
    printer.println(storeName);
    
    if (data.store?.description) {
      printer.bold(false);
      printer.setTextNormal();
      printer.println(String(data.store.description));
    }
    
    if (data.store?.address) {
      printer.bold(false);
      printer.setTextNormal();
      printer.println(data.store.address);
    }
    
    if (data.store?.phone) {
      printer.println(`Tel: ${data.store.phone}`);
    }

    if (data.store?.cnpj) {
      printer.println(`CNPJ: ${data.store.cnpj}`);
    }
    
    printer.drawLine();
    printer.newLine();
  }

  async printOrderInfo(printer, data, section) {
    printer.alignLeft();
    printer.bold(false);
    printer.setTextNormal();
    
    if (data.order_number) {
      printer.println(`Pedido: #${data.order_number}`);
    }
    
    if (data.customer_name) {
      printer.println(`Cliente: ${data.customer_name}`);
    }
    
    if (data.customer_phone) {
      printer.println(`Telefone: ${data.customer_phone}`);
    }
    
    if (data.date) {
      const date = new Date(data.date);
      printer.println(`Data: ${date.toLocaleString('pt-BR')}`);
    }
    
    printer.drawLine();
  }

  async printItems(printer, data, section) {
    printer.alignLeft();
    printer.bold(false);
    printer.setTextNormal();
    const width = this.getSectionWidth(section);
    
    if (!data.items || data.items.length === 0) {
      printer.println('Nenhum item encontrado');
      return;
    }
    
    for (const item of data.items) {
      // Nome do produto
      const productName = item.product_name || item.name || 'Produto';
      const quantity = Number(item.quantity || 1);

      this.wrapText(`${quantity}x ${productName}`, width).forEach((line) => {
        printer.println(line);
      });
      
      // Preço unitário e subtotal
      const unitPrice = Number(item.price || item.unit_price || 0);
      const subtotal = Number(item.subtotal || item.total || (quantity * unitPrice) || 0);

      this.formatColumns(
        `${this.formatCurrency(unitPrice)} x ${quantity}`,
        this.formatCurrency(subtotal),
        width
      ).forEach((line) => {
        printer.println(line);
      });
      
      if (Array.isArray(item.variations) && item.variations.length > 0) {
        for (const v of item.variations) {
          if (!v) continue;
          const raw = String(v);
          const idx = raw.indexOf(':');
          if (idx > 0) {
            this.wrapText(`  ${raw.slice(0, idx).trim()}: ${raw.slice(idx + 1).trim()}`, width).forEach((line) => {
              printer.println(line);
            });
          } else {
            this.wrapText(`  ${raw}`, width).forEach((line) => {
              printer.println(line);
            });
          }
        }
      }

      if (item.notes || item.observations) {
        this.wrapText(`Obs: ${item.notes || item.observations}`, width).forEach((line) => {
          printer.println(line);
        });
      }
      
      printer.newLine();
    }
  }

  async printTotals(printer, data, section) {
    printer.drawLine();
    printer.alignLeft();
    const width = this.getSectionWidth(section);
    
    // Subtotal
    if (data.subtotal && data.subtotal !== data.total) {
      this.formatColumns('Subtotal', this.formatCurrency(data.subtotal), width).forEach((line) => {
        printer.println(line);
      });
    }
    
    // Desconto
    if (data.discount && data.discount > 0) {
      this.formatColumns('Desconto', `- ${this.formatCurrency(data.discount)}`, width).forEach((line) => {
        printer.println(line);
      });
    }
    
    // Taxa de entrega
    if (data.delivery_fee && data.delivery_fee > 0) {
      this.formatColumns('Taxa Entrega', this.formatCurrency(data.delivery_fee), width).forEach((line) => {
        printer.println(line);
      });
    }
    
    // Total
    printer.bold(true);
    printer.setTextSize(1, 1);
    this.formatColumns('TOTAL', this.formatCurrency(data.total), width).forEach((line) => {
      printer.println(line);
    });
    printer.bold(false);
    printer.setTextNormal();
  }

  async printFooter(printer, data, section) {
    printer.alignCenter();
    printer.drawLine();
    
    if (data.payment_method) {
      printer.println(`Pagamento: ${data.payment_method}`);
    }
    
    printer.newLine();
    printer.println('Obrigado pela preferência!');
    
    if (data.store?.website) {
      printer.println(data.store.website);
    }
    
    printer.newLine();
    printer.newLine();
    printer.cut();
  }

  async printProductName(printer, data, section) {
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println(data.name || 'Produto');
    printer.bold(false);
    printer.setTextNormal();
  }

  async printBarcode(printer, data, section) {
    if (data.barcode) {
      printer.alignCenter();
      printer.code128(data.barcode);
      printer.println(data.barcode);
    }
  }

  async printPrice(printer, data, section) {
    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(2, 2);
    printer.println(`R$ ${(data.price || 0).toFixed(2)}`);
    printer.bold(false);
    printer.setTextNormal();
    printer.cut();
  }

  async testPrint(deviceId) {
    try {
      const testData = {
        store: {
          name: 'BORA CUME HUB - TESTE',
          address: 'Rua Teste, 123',
          phone: '(11) 99999-9999'
        },
        order_number: 'TEST001',
        date: new Date(),
        items: [
          {
            quantity: 1,
            product_name: 'Produto Teste',
            price: 10.00,
            subtotal: 10.00
          }
        ],
        total: 10.00,
        payment_method: 'Dinheiro'
      };
      
      return await this.printReceipt(deviceId, testData);
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async openCashDrawer(deviceId) {
    try {
      const device = this.deviceManager.getDevice(deviceId);
      
      if (!device) {
        return { success: false, message: 'Dispositivo não conectado' };
      }

      // Comando ESC/POS para abrir gaveta (padrão)
      const openDrawerCommand = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
      
      await this.deviceManager.sendData(deviceId, openDrawerCommand);
      
      this.emit('cashDrawerOpened', { deviceId });
      return { success: true, message: 'Gaveta aberta' };
      
    } catch (error) {
      console.error('Erro ao abrir gaveta:', error);
      return { success: false, message: error.message };
    }
  }

  getConnectedPrinters() {
    const printers = [];
    
    for (const [deviceId, info] of this.connectedPrinters) {
      printers.push({
        deviceId,
        status: info.status,
        lastPrint: info.lastPrint,
        config: info.config
      });
    }
    
    return printers;
  }

  getPrinterStatus(deviceId) {
    const printerInfo = this.connectedPrinters.get(deviceId);
    return printerInfo ? printerInfo.status : 'disconnected';
  }

  getSupportedProtocols() {
    return [
      { id: 'epson', name: 'ESC/POS (Epson)', baudRate: 9600 },
      { id: 'bematech', name: 'ESC/POS (Bematech)', baudRate: 9600 },
      { id: 'daruma', name: 'ESC/POS (Daruma)', baudRate: 9600 },
      { id: 'elgin', name: 'ESC/POS (Elgin)', baudRate: 9600 },
      { id: 'tanca', name: 'ESC/POS (Tanca)', baudRate: 9600 },
      { id: 'pos', name: 'ESC/POS (POS Genérica)', baudRate: 9600 },
      { id: 'generic', name: 'ESC/POS (Genérico)', baudRate: 9600 }
    ];
  }

  async updatePrinterOptions(deviceId, newOptions) {
    const printerInfo = this.connectedPrinters.get(deviceId);
    if (!printerInfo) {
      return { success: false, message: 'Impressora não conectada' };
    }

    const merged = { ...(printerInfo.options || {}), ...(newOptions || {}) };
    printerInfo.options = merged;

    const requiresReconnect = Boolean(
      (newOptions && typeof newOptions === 'object') &&
      ('protocol' in newOptions || 'baudRate' in newOptions || 'dataBits' in newOptions || 'stopBits' in newOptions || 'parity' in newOptions || 'timeout' in newOptions || 'width' in newOptions)
    );

    if (requiresReconnect) {
      await this.disconnectPrinter(deviceId);
      return await this.connectPrinter(deviceId, merged);
    }

    return { success: true, message: 'Opções atualizadas com sucesso' };
  }

  async createCustomTemplate(name, templateConfig) {
    try {
      this.templates.set(name, templateConfig);
      
      // Salvar template em arquivo
      const templatesDir = path.join(__dirname, '../config/templates');
      await fs.mkdir(templatesDir, { recursive: true });
      
      const templatePath = path.join(templatesDir, `${name}.json`);
      await fs.writeFile(templatePath, JSON.stringify(templateConfig, null, 2));
      
      return { success: true, message: 'Template criado com sucesso' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  getAvailableTemplates() {
    const templates = [];
    
    for (const [name, config] of this.templates) {
      templates.push({
        name,
        displayName: config.name,
        width: config.width,
        sections: config.sections.length
      });
    }
    
    return templates;
  }

  async getAvailablePrinters() {
    try {
      // Obter impressoras do sistema Windows
      const systemPrinters = await this.getSystemPrinters();
      
      return systemPrinters;
    } catch (error) {
      console.error('Erro ao listar impressoras:', error);
      return [];
    }
  }

  async getSystemPrinters() {
    try {
      // Comando PowerShell para listar impressoras instaladas
      const command = 'powershell "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"';
      const { stdout } = await execAsync(command);
      
      let printers = [];
      if (stdout.trim()) {
        const result = JSON.parse(stdout);
        // Se há apenas uma impressora, o resultado não é um array
        printers = Array.isArray(result) ? result : [result];
      }

      return printers.map(printer => ({
        name: printer.Name,
        path: printer.PortName,
        driver: printer.DriverName,
        status: printer.PrinterStatus,
        type: 'system'
      }));
    } catch (error) {
      console.error('Erro ao obter impressoras do sistema:', error);
      return [];
    }
  }
}

module.exports = PrinterService;
