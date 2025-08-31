import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Scale, 
  Printer, 
  Bluetooth, 
  Usb, 
  Cable, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

import { WebSerialScale, ScaleReading, SCALE_CONFIGS } from '@/services/webSerialScale';
import { WebUSBScale, USBScaleReading, USB_SCALE_CONFIGS } from '@/services/webUSBScale';
import { WebBluetoothPrinter, PrintJob, PRINTER_CONFIGS } from '@/services/webBluetoothPrinter';

interface HardwareDevice {
  id: string;
  name: string;
  type: 'scale' | 'printer';
  connection: 'serial' | 'usb' | 'bluetooth';
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastReading?: ScaleReading | USBScaleReading;
  service?: WebSerialScale | WebUSBScale | WebBluetoothPrinter;
}

interface HardwareManagerProps {
  onWeightChange?: (weight: number, unit: string) => void;
  onPrintRequest?: (printJob: PrintJob) => void;
}

export function HardwareManager({ onWeightChange, onPrintRequest }: HardwareManagerProps) {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [supportStatus, setSupportStatus] = useState({
    webSerial: false,
    webUSB: false,
    webBluetooth: false
  });

  // Verifica suporte das APIs ao montar o componente
  useEffect(() => {
    setSupportStatus({
      webSerial: WebSerialScale.isSupported(),
      webUSB: WebUSBScale.isSupported(),
      webBluetooth: WebBluetoothPrinter.isSupported()
    });
  }, []);

  // Atualiza dispositivo na lista
  const updateDevice = (deviceId: string, updates: Partial<HardwareDevice>) => {
    setDevices(prev => prev.map(device => 
      device.id === deviceId ? { ...device, ...updates } : device
    ));
  };

  // Adiciona novo dispositivo
  const addDevice = (device: HardwareDevice) => {
    setDevices(prev => {
      const existing = prev.find(d => d.id === device.id);
      if (existing) {
        return prev.map(d => d.id === device.id ? device : d);
      }
      return [...prev, device];
    });
  };

  // Remove dispositivo
  const removeDevice = (deviceId: string) => {
    setDevices(prev => prev.filter(device => device.id !== deviceId));
  };

  // Conecta balança serial
  const connectSerialScale = async (brand: string = 'generic') => {
    try {
      const config = SCALE_CONFIGS[brand];
      const scale = new WebSerialScale(config);
      
      const deviceId = `serial-scale-${Date.now()}`;
      addDevice({
        id: deviceId,
        name: `Balança Serial (${brand})`,
        type: 'scale',
        connection: 'serial',
        status: 'connecting',
        service: scale
      });

      const connected = await scale.connect();
      
      if (connected) {
        updateDevice(deviceId, { status: 'connected' });
        
        // Inicia leitura contínua
        scale.startReading((reading) => {
          updateDevice(deviceId, { lastReading: reading });
          onWeightChange?.(reading.weight, reading.unit);
        });
      } else {
        updateDevice(deviceId, { status: 'error' });
      }
    } catch (error) {
      console.error('Erro ao conectar balança serial:', error);
    }
  };

  // Conecta balança USB
  const connectUSBScale = async () => {
    try {
      const scale = new WebUSBScale();
      
      const deviceId = `usb-scale-${Date.now()}`;
      addDevice({
        id: deviceId,
        name: 'Balança USB',
        type: 'scale',
        connection: 'usb',
        status: 'connecting',
        service: scale
      });

      const connected = await scale.connect();
      
      if (connected) {
        const deviceInfo = scale.getDeviceInfo();
        updateDevice(deviceId, { 
          status: 'connected',
          name: `Balança USB (${deviceInfo?.productName || 'Desconhecida'})`
        });
        
        // Inicia leitura contínua
        scale.startReading((reading) => {
          updateDevice(deviceId, { lastReading: reading });
          onWeightChange?.(reading.weight, reading.unit);
        });
      } else {
        updateDevice(deviceId, { status: 'error' });
      }
    } catch (error) {
      console.error('Erro ao conectar balança USB:', error);
    }
  };

  // Conecta impressora Bluetooth
  const connectBluetoothPrinter = async (brand: string = 'generic') => {
    try {
      const config = PRINTER_CONFIGS[brand];
      const printer = new WebBluetoothPrinter(config);
      
      const deviceId = `bluetooth-printer-${Date.now()}`;
      addDevice({
        id: deviceId,
        name: `Impressora Bluetooth (${brand})`,
        type: 'printer',
        connection: 'bluetooth',
        status: 'connecting',
        service: printer
      });

      const connected = await printer.connect();
      
      if (connected) {
        const deviceInfo = printer.getDeviceInfo();
        updateDevice(deviceId, { 
          status: 'connected',
          name: `Impressora Bluetooth (${deviceInfo?.name || brand})`
        });
      } else {
        updateDevice(deviceId, { status: 'error' });
      }
    } catch (error) {
      console.error('Erro ao conectar impressora Bluetooth:', error);
    }
  };

  // Desconecta dispositivo
  const disconnectDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device?.service) return;

    try {
      await device.service.disconnect();
      removeDevice(deviceId);
    } catch (error) {
      console.error('Erro ao desconectar dispositivo:', error);
    }
  };

  // Testa impressora
  const testPrinter = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device?.service || device.type !== 'printer') return;

    const printer = device.service as WebBluetoothPrinter;
    await printer.testPrint();
  };

  // Renderiza ícone de conexão
  const renderConnectionIcon = (connection: string) => {
    switch (connection) {
      case 'serial': return <Cable className="h-4 w-4" />;
      case 'usb': return <Usb className="h-4 w-4" />;
      case 'bluetooth': return <Bluetooth className="h-4 w-4" />;
      default: return null;
    }
  };

  // Renderiza status do dispositivo
  const renderDeviceStatus = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'connecting':
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Conectando</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">Desconectado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status de Suporte das APIs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Suporte do Navegador
          </CardTitle>
          <CardDescription>
            Verifique quais APIs web estão disponíveis no seu navegador
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Cable className="h-4 w-4" />
                <span className="font-medium">Web Serial API</span>
              </div>
              {supportStatus.webSerial ? (
                <Badge variant="default" className="bg-green-500">Suportado</Badge>
              ) : (
                <Badge variant="destructive">Não Suportado</Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Usb className="h-4 w-4" />
                <span className="font-medium">Web USB API</span>
              </div>
              {supportStatus.webUSB ? (
                <Badge variant="default" className="bg-green-500">Suportado</Badge>
              ) : (
                <Badge variant="destructive">Não Suportado</Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Bluetooth className="h-4 w-4" />
                <span className="font-medium">Web Bluetooth API</span>
              </div>
              {supportStatus.webBluetooth ? (
                <Badge variant="default" className="bg-green-500">Suportado</Badge>
              ) : (
                <Badge variant="destructive">Não Suportado</Badge>
              )}
            </div>
          </div>
          
          {(!supportStatus.webSerial && !supportStatus.webUSB && !supportStatus.webBluetooth) && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Seu navegador não suporta nenhuma das APIs necessárias. 
                Recomendamos usar Chrome, Edge ou Opera mais recentes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Conectar Dispositivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Conectar Balanças
          </CardTitle>
          <CardDescription>
            Conecte balanças via porta serial ou USB
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supportStatus.webSerial && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Cable className="h-4 w-4" />
                  Balança Serial
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(SCALE_CONFIGS).map(brand => (
                    <Button
                      key={brand}
                      variant="outline"
                      size="sm"
                      onClick={() => connectSerialScale(brand)}
                      disabled={isScanning}
                    >
                      {brand.charAt(0).toUpperCase() + brand.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {supportStatus.webUSB && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Usb className="h-4 w-4" />
                  Balança USB
                </h4>
                <Button
                  variant="outline"
                  onClick={connectUSBScale}
                  disabled={isScanning}
                  className="w-full"
                >
                  Conectar Balança USB
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conectar Impressoras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Conectar Impressoras
          </CardTitle>
          <CardDescription>
            Conecte impressoras térmicas via Bluetooth
          </CardDescription>
        </CardHeader>
        <CardContent>
          {supportStatus.webBluetooth ? (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Bluetooth className="h-4 w-4" />
                Impressora Bluetooth
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.keys(PRINTER_CONFIGS).map(brand => (
                  <Button
                    key={brand}
                    variant="outline"
                    size="sm"
                    onClick={() => connectBluetoothPrinter(brand)}
                    disabled={isScanning}
                  >
                    {brand.charAt(0).toUpperCase() + brand.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Web Bluetooth API não é suportada neste navegador.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Dispositivos Conectados */}
      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos Conectados</CardTitle>
            <CardDescription>
              Gerencie os dispositivos conectados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices.map((device, index) => (
                <div key={device.id}>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {device.type === 'scale' ? (
                        <Scale className="h-5 w-5" />
                      ) : (
                        <Printer className="h-5 w-5" />
                      )}
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{device.name}</span>
                          {renderConnectionIcon(device.connection)}
                        </div>
                        
                        {device.lastReading && (
                          <div className="text-sm text-muted-foreground">
                            Último peso: {device.lastReading.weight} {device.lastReading.unit}
                            {device.lastReading.stable ? ' (Estável)' : ' (Instável)'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {renderDeviceStatus(device.status)}
                      
                      {device.type === 'printer' && device.status === 'connected' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testPrinter(device.id)}
                        >
                          Testar
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectDevice(device.id)}
                      >
                        Desconectar
                      </Button>
                    </div>
                  </div>
                  
                  {index < devices.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}