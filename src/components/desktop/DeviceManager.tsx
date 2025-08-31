import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Printer, 
  Scale, 
  Usb, 
  Wifi, 
  Settings, 
  Power, 
  PowerOff,
  RefreshCw,
  Zap,
  Target,
  Play,
  Square
} from 'lucide-react';
import type { DeviceInfo, ProtocolInfo, ConnectedDevices } from '@/types/electron';

interface DeviceManagerProps {
  className?: string;
}

const DeviceManager: React.FC<DeviceManagerProps> = ({ className }) => {
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([]);
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevices>({ printers: [], scales: [] });
  const [printerProtocols, setPrinterProtocols] = useState<ProtocolInfo[]>([]);
  const [scaleProtocols, setScaleProtocols] = useState<ProtocolInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [connectionSettings, setConnectionSettings] = useState({
    protocol: '',
    baudRate: 9600,
    autoRead: false,
    readInterval: 1000
  });
  const [weightReading, setWeightReading] = useState<{ deviceId: string; weight: number; stable: boolean } | null>(null);
  const [calibrationData, setCalibrationData] = useState({ knownWeight: 0, currentReading: 0 });

  // Verificar se está no Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  useEffect(() => {
    if (isElectron) {
      loadProtocols();
      scanDevices();
      loadConnectedDevices();
      loadAvailablePrinters();
    }
  }, [isElectron]);

  const loadProtocols = async () => {
    try {
      const [printerResult, scaleResult] = await Promise.all([
        window.electronAPI.getSupportedProtocols('printer'),
        window.electronAPI.getSupportedProtocols('scale')
      ]);

      if (printerResult.success && printerResult.protocols) {
        setPrinterProtocols(printerResult.protocols);
      }

      if (scaleResult.success && scaleResult.protocols) {
        setScaleProtocols(scaleResult.protocols);
      }
    } catch (error) {
      console.error('Erro ao carregar protocolos:', error);
    }
  };

  const scanDevices = async () => {
    if (!isElectron) return;

    setIsScanning(true);
    try {
      const result = await window.electronAPI.scanSerialPorts();
      
      if (result.success && result.devices) {
        setAvailableDevices(result.devices);
        toast.success(`${result.devices.length} dispositivos encontrados`);
      } else {
        toast.error(result.error || 'Erro ao escanear dispositivos');
      }
    } catch (error) {
      console.error('Erro ao escanear dispositivos:', error);
      toast.error('Erro ao escanear dispositivos');
    } finally {
      setIsScanning(false);
    }
  };

  const loadAvailablePrinters = async () => {
    if (!isElectron || !window.electronAPI?.getAvailablePrinters) return;
    
    try {
      const result = await window.electronAPI.getAvailablePrinters();
      if (result.success) {
        setAvailablePrinters(result.printers);
      }
    } catch (error) {
      console.error('Erro ao carregar impressoras:', error);
    }
  };

  const loadConnectedDevices = async () => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.getConnectedDevices();
      
      if (result.success && result.devices) {
        setConnectedDevices(result.devices);
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos conectados:', error);
    }
  };

  const connectDevice = async (device: DeviceInfo) => {
    if (!isElectron) return;

    try {
      const options = {
        baudRate: connectionSettings.baudRate,
        autoRead: connectionSettings.autoRead,
        readInterval: connectionSettings.readInterval
      };

      let result;
      if (device.type === 'printer') {
        result = await window.electronAPI.connectPrinter(
          device.id, 
          connectionSettings.protocol || 'epson', 
          options
        );
      } else {
        result = await window.electronAPI.connectScale(
          device.id, 
          connectionSettings.protocol || 'generic', 
          options
        );
      }

      if (result.success) {
        toast.success(result.message || 'Dispositivo conectado com sucesso');
        await loadConnectedDevices();
        setSelectedDevice(null);
      } else {
        toast.error(result.error || 'Erro ao conectar dispositivo');
      }
    } catch (error) {
      console.error('Erro ao conectar dispositivo:', error);
      toast.error('Erro ao conectar dispositivo');
    }
  };

  const disconnectDevice = async (deviceId: string, type: 'printer' | 'scale') => {
    if (!isElectron) return;

    try {
      let result;
      if (type === 'printer') {
        result = await window.electronAPI.disconnectPrinter(deviceId);
      } else {
        result = await window.electronAPI.disconnectScale(deviceId);
      }

      if (result.success) {
        toast.success(result.message || 'Dispositivo desconectado');
        await loadConnectedDevices();
      } else {
        toast.error(result.error || 'Erro ao desconectar dispositivo');
      }
    } catch (error) {
      console.error('Erro ao desconectar dispositivo:', error);
      toast.error('Erro ao desconectar dispositivo');
    }
  };

  const readWeight = async (deviceId: string) => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.readWeight(deviceId, 5000);
      
      if (result.success && result.weight !== undefined) {
        setWeightReading({
          deviceId,
          weight: result.weight,
          stable: result.stable || false
        });
        toast.success(`Peso: ${result.weight}${result.unit || 'g'} ${result.stable ? '(Estável)' : '(Instável)'}`);
      } else {
        toast.error(result.error || 'Erro ao ler peso');
      }
    } catch (error) {
      console.error('Erro ao ler peso:', error);
      toast.error('Erro ao ler peso');
    }
  };

  const tareScale = async (deviceId: string) => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.tareScale(deviceId);
      
      if (result.success) {
        toast.success('Tara realizada com sucesso');
      } else {
        toast.error(result.error || 'Erro ao fazer tara');
      }
    } catch (error) {
      console.error('Erro ao fazer tara:', error);
      toast.error('Erro ao fazer tara');
    }
  };

  const zeroScale = async (deviceId: string) => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.zeroScale(deviceId);
      
      if (result.success) {
        toast.success('Zero realizado com sucesso');
      } else {
        toast.error(result.error || 'Erro ao zerar balança');
      }
    } catch (error) {
      console.error('Erro ao zerar balança:', error);
      toast.error('Erro ao zerar balança');
    }
  };

  const calibrateScale = async (deviceId: string) => {
    if (!isElectron || !calibrationData.knownWeight || !calibrationData.currentReading) {
      toast.error('Preencha os dados de calibração');
      return;
    }

    try {
      const result = await window.electronAPI.calibrateScale(
        deviceId, 
        calibrationData.knownWeight, 
        calibrationData.currentReading
      );
      
      if (result.success) {
        toast.success('Calibração realizada com sucesso');
        setCalibrationData({ knownWeight: 0, currentReading: 0 });
      } else {
        toast.error(result.error || 'Erro ao calibrar balança');
      }
    } catch (error) {
      console.error('Erro ao calibrar balança:', error);
      toast.error('Erro ao calibrar balança');
    }
  };

  const toggleAutoReading = async (deviceId: string, start: boolean) => {
    if (!isElectron) return;

    try {
      const result = start 
        ? await window.electronAPI.startAutoReading(deviceId)
        : await window.electronAPI.stopAutoReading(deviceId);
      
      if (result.success) {
        toast.success(result.message || `Leitura automática ${start ? 'iniciada' : 'parada'}`);
        await loadConnectedDevices();
      } else {
        toast.error(result.error || 'Erro ao alterar leitura automática');
      }
    } catch (error) {
      console.error('Erro ao alterar leitura automática:', error);
      toast.error('Erro ao alterar leitura automática');
    }
  };

  const openCashDrawer = async (deviceId: string) => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.openCashDrawer(deviceId);
      
      if (result.success) {
        toast.success('Gaveta de dinheiro aberta');
      } else {
        toast.error(result.error || 'Erro ao abrir gaveta');
      }
    } catch (error) {
      console.error('Erro ao abrir gaveta:', error);
      toast.error('Erro ao abrir gaveta');
    }
  };

  if (!isElectron) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Usb className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Gerenciador de dispositivos disponível apenas no aplicativo desktop</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gerenciador de Dispositivos</h2>
        <Button onClick={scanDevices} disabled={isScanning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Escaneando...' : 'Escanear Dispositivos'}
        </Button>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="available">Dispositivos Disponíveis</TabsTrigger>
          <TabsTrigger value="connected">Dispositivos Conectados</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {/* Lista de Impressoras do Sistema */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Impressoras do Sistema</h3>
              <Button onClick={loadAvailablePrinters} size="sm">
                <Printer className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>

            <div className="grid gap-3">
              {availablePrinters.map((printer, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Printer className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">{printer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {printer.driver} - {printer.path}
                        </p>
                        <Badge variant={printer.status === 3 ? 'default' : 'secondary'}>
                          {printer.status === 3 ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => connectDevice({ id: printer.name, name: printer.name, type: 'printer', manufacturer: printer.driver, connected: false })}
                        size="sm"
                        variant="outline"
                      >
                        <Power className="mr-2 h-4 w-4" />
                        Conectar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {availablePrinters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Printer className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Nenhuma impressora encontrada no sistema</p>
              </div>
            )}
          </div>

          <div className="grid gap-4">
            {availableDevices.map((device) => (
              <Card key={device.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {device.type === 'printer' ? (
                        <Printer className="h-5 w-5" />
                      ) : (
                        <Scale className="h-5 w-5" />
                      )}
                      <div>
                        <h3 className="font-medium">{device.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {device.manufacturer} • {device.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={device.connected ? 'default' : 'secondary'}>
                        {device.connected ? 'Conectado' : 'Disponível'}
                      </Badge>
                      {!device.connected && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setSelectedDevice(device);
                                setConnectionSettings({
                                  protocol: '',
                                  baudRate: 9600,
                                  autoRead: false,
                                  readInterval: 1000
                                });
                              }}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              Conectar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Conectar {device.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="protocol">Protocolo</Label>
                                <Select 
                                  value={connectionSettings.protocol} 
                                  onValueChange={(value) => setConnectionSettings(prev => ({ ...prev, protocol: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o protocolo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(device.type === 'printer' ? printerProtocols : scaleProtocols).map((protocol) => (
                                      <SelectItem key={protocol.id} value={protocol.id}>
                                        {protocol.name} ({protocol.baudRate} baud)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label htmlFor="baudRate">Taxa de Transmissão (Baud Rate)</Label>
                                <Input
                                  id="baudRate"
                                  type="number"
                                  value={connectionSettings.baudRate}
                                  onChange={(e) => setConnectionSettings(prev => ({ ...prev, baudRate: parseInt(e.target.value) }))}
                                />
                              </div>
                              
                              {device.type === 'scale' && (
                                <>
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="autoRead"
                                      checked={connectionSettings.autoRead}
                                      onChange={(e) => setConnectionSettings(prev => ({ ...prev, autoRead: e.target.checked }))}
                                    />
                                    <Label htmlFor="autoRead">Leitura Automática</Label>
                                  </div>
                                  
                                  {connectionSettings.autoRead && (
                                    <div>
                                      <Label htmlFor="readInterval">Intervalo de Leitura (ms)</Label>
                                      <Input
                                        id="readInterval"
                                        type="number"
                                        value={connectionSettings.readInterval}
                                        onChange={(e) => setConnectionSettings(prev => ({ ...prev, readInterval: parseInt(e.target.value) }))}
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                              
                              <Button onClick={() => connectDevice(device)} className="w-full">
                                Conectar Dispositivo
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="connected" className="space-y-4">
          <div className="grid gap-4">
            {/* Impressoras Conectadas */}
            {connectedDevices.printers.map((printer) => (
              <Card key={printer.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Printer className="h-5 w-5" />
                      <span>{printer.name}</span>
                      <Badge variant="default">Impressora</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => disconnectDevice(printer.id, 'printer')}
                    >
                      <PowerOff className="h-4 w-4 mr-1" />
                      Desconectar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      onClick={() => openCashDrawer(printer.id)}
                    >
                      <Zap className="h-4 w-4 mr-1" />
                      Abrir Gaveta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Balanças Conectadas */}
            {connectedDevices.scales.map((scale) => (
              <Card key={scale.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Scale className="h-5 w-5" />
                      <span>{scale.name}</span>
                      <Badge variant="default">Balança</Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => disconnectDevice(scale.id, 'scale')}
                    >
                      <PowerOff className="h-4 w-4 mr-1" />
                      Desconectar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Leitura de Peso */}
                  <div className="flex items-center space-x-2">
                    <Button 
                      size="sm" 
                      onClick={() => readWeight(scale.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Ler Peso
                    </Button>
                    {weightReading && weightReading.deviceId === scale.id && (
                      <Badge variant={weightReading.stable ? 'default' : 'secondary'}>
                        {weightReading.weight}g {weightReading.stable ? '(Estável)' : '(Instável)'}
                      </Badge>
                    )}
                  </div>

                  {/* Controles da Balança */}
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => tareScale(scale.id)}
                    >
                      <Target className="h-4 w-4 mr-1" />
                      Tara
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => zeroScale(scale.id)}
                    >
                      <Target className="h-4 w-4 mr-1" />
                      Zero
                    </Button>
                  </div>

                  {/* Leitura Automática */}
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toggleAutoReading(scale.id, true)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Iniciar Auto-Leitura
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toggleAutoReading(scale.id, false)}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Parar Auto-Leitura
                    </Button>
                  </div>

                  {/* Calibração */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Calibração</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <Label htmlFor="knownWeight">Peso Conhecido (g)</Label>
                        <Input
                          id="knownWeight"
                          type="number"
                          value={calibrationData.knownWeight}
                          onChange={(e) => setCalibrationData(prev => ({ ...prev, knownWeight: parseFloat(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="currentReading">Leitura Atual (g)</Label>
                        <Input
                          id="currentReading"
                          type="number"
                          value={calibrationData.currentReading}
                          onChange={(e) => setCalibrationData(prev => ({ ...prev, currentReading: parseFloat(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => calibrateScale(scale.id)}
                      disabled={!calibrationData.knownWeight || !calibrationData.currentReading}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Calibrar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DeviceManager;