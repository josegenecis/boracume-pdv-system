import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Wifi, 
  Monitor, 
  Play, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Download,
  ExternalLink
} from 'lucide-react';

import { 
  HardwareFallbackManager,
  WebSocketScaleFallback,
  ScaleSimulator,
  NativeAppPrinterFallback,
  FallbackScaleReading,
  FallbackConfig
} from '@/services/hardwareFallback';

interface FallbackDevice {
  id: string;
  name: string;
  type: 'scale' | 'printer';
  method: 'websocket' | 'simulation' | 'native-app';
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastReading?: FallbackScaleReading;
  service?: WebSocketScaleFallback | ScaleSimulator | NativeAppPrinterFallback;
}

interface HardwareFallbackManagerProps {
  onWeightChange?: (weight: number, unit: string) => void;
  onPrintRequest?: (text: string) => void;
}

export function HardwareFallbackManagerComponent({ onWeightChange, onPrintRequest }: HardwareFallbackManagerProps) {
  const [devices, setDevices] = useState<FallbackDevice[]>([]);
  const [fallbackManager] = useState(() => new HardwareFallbackManager());
  const [availability, setAvailability] = useState({
    websocket: false,
    nativeApp: false,
    simulation: true
  });
  const [config, setConfig] = useState<FallbackConfig>({
    websocketUrl: 'ws://localhost:8766',
    nativeAppPort: 8765,
    simulationEnabled: true,
    pollingInterval: 1000
  });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // Verifica disponibilidade dos serviços ao montar
  useEffect(() => {
    checkAvailability();
  }, []);

  // Atualiza dispositivo na lista
  const updateDevice = (deviceId: string, updates: Partial<FallbackDevice>) => {
    setDevices(prev => prev.map(device => 
      device.id === deviceId ? { ...device, ...updates } : device
    ));
  };

  // Adiciona novo dispositivo
  const addDevice = (device: FallbackDevice) => {
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

  // Verifica disponibilidade dos serviços
  const checkAvailability = async () => {
    setIsCheckingAvailability(true);
    try {
      fallbackManager.updateConfig(config);
      const result = await fallbackManager.checkAvailability();
      setAvailability(result);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Conecta balança via WebSocket
  const connectWebSocketScale = async () => {
    try {
      const deviceId = `websocket-scale-${Date.now()}`;
      const service = fallbackManager.createWebSocketScale(deviceId);
      
      addDevice({
        id: deviceId,
        name: 'Balança WebSocket',
        type: 'scale',
        method: 'websocket',
        status: 'connecting',
        service
      });

      const connected = await service.connect();
      
      if (connected) {
        updateDevice(deviceId, { status: 'connected' });
        
        service.startReading((reading) => {
          updateDevice(deviceId, { lastReading: reading });
          onWeightChange?.(reading.weight, reading.unit);
        });
      } else {
        updateDevice(deviceId, { status: 'error' });
      }
    } catch (error) {
      console.error('Erro ao conectar balança WebSocket:', error);
    }
  };

  // Conecta simulador de balança
  const connectScaleSimulator = async () => {
    try {
      const deviceId = `simulator-scale-${Date.now()}`;
      const service = fallbackManager.createScaleSimulator(deviceId);
      
      addDevice({
        id: deviceId,
        name: 'Simulador de Balança',
        type: 'scale',
        method: 'simulation',
        status: 'connecting',
        service
      });

      const connected = await service.connect();
      
      if (connected) {
        updateDevice(deviceId, { status: 'connected' });
        
        service.startReading((reading) => {
          updateDevice(deviceId, { lastReading: reading });
          onWeightChange?.(reading.weight, reading.unit);
        });
      } else {
        updateDevice(deviceId, { status: 'error' });
      }
    } catch (error) {
      console.error('Erro ao conectar simulador:', error);
    }
  };

  // Conecta impressora via aplicativo nativo
  const connectNativeAppPrinter = async () => {
    try {
      const deviceId = `native-printer-${Date.now()}`;
      const service = fallbackManager.createNativeAppPrinter(deviceId);
      
      addDevice({
        id: deviceId,
        name: 'Impressora (App Nativo)',
        type: 'printer',
        method: 'native-app',
        status: 'connecting',
        service
      });

      const connected = await service.connect();
      
      if (connected) {
        updateDevice(deviceId, { status: 'connected' });
      } else {
        updateDevice(deviceId, { status: 'error' });
      }
    } catch (error) {
      console.error('Erro ao conectar impressora nativa:', error);
    }
  };

  // Desconecta dispositivo
  const disconnectDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device?.service) return;

    try {
      await device.service.disconnect();
      
      if (device.type === 'scale') {
        await fallbackManager.removeScaleService(deviceId);
      } else {
        await fallbackManager.removePrinterService(deviceId);
      }
      
      removeDevice(deviceId);
    } catch (error) {
      console.error('Erro ao desconectar dispositivo:', error);
    }
  };

  // Testa impressora
  const testPrinter = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device?.service || device.type !== 'printer') return;

    const printer = device.service as NativeAppPrinterFallback;
    await printer.testPrint();
  };

  // Define peso no simulador
  const setSimulatorWeight = (deviceId: string, weight: number) => {
    const device = devices.find(d => d.id === deviceId);
    if (device?.service && device.method === 'simulation') {
      const simulator = device.service as ScaleSimulator;
      simulator.setWeight(weight);
    }
  };

  // Atualiza configuração
  const updateConfig = (newConfig: Partial<FallbackConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    fallbackManager.updateConfig(updatedConfig);
  };

  // Renderiza status do serviço
  const renderServiceStatus = (available: boolean, isChecking: boolean = false) => {
    if (isChecking) {
      return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Verificando</Badge>;
    }
    
    return available ? (
      <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Disponível</Badge>
    ) : (
      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Indisponível</Badge>
    );
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
      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Fallback
          </CardTitle>
          <CardDescription>
            Configure as opções de conexão alternativas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="websocket-url">URL do WebSocket</Label>
              <Input
                id="websocket-url"
                value={config.websocketUrl}
                onChange={(e) => updateConfig({ websocketUrl: e.target.value })}
                placeholder="ws://localhost:8766"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="native-port">Porta do App Nativo</Label>
              <Input
                id="native-port"
                type="number"
                value={config.nativeAppPort}
                onChange={(e) => updateConfig({ nativeAppPort: parseInt(e.target.value) })}
                placeholder="8765"
              />
            </div>
          </div>
          
          <Button onClick={checkAvailability} disabled={isCheckingAvailability}>
            {isCheckingAvailability ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verificar Disponibilidade
          </Button>
        </CardContent>
      </Card>

      {/* Status dos Serviços */}
      <Card>
        <CardHeader>
          <CardTitle>Status dos Serviços de Fallback</CardTitle>
          <CardDescription>
            Verifique quais soluções alternativas estão disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                <span className="font-medium">WebSocket</span>
              </div>
              {renderServiceStatus(availability.websocket, isCheckingAvailability)}
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span className="font-medium">App Nativo</span>
              </div>
              {renderServiceStatus(availability.nativeApp, isCheckingAvailability)}
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                <span className="font-medium">Simulação</span>
              </div>
              {renderServiceStatus(availability.simulation)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conectar Dispositivos Alternativos */}
      <Card>
        <CardHeader>
          <CardTitle>Soluções Alternativas</CardTitle>
          <CardDescription>
            Use estas opções quando as APIs web não estiverem disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balanças */}
          <div>
            <h4 className="font-medium mb-3">Balanças</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  <span className="font-medium">Via WebSocket</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Conecta via servidor local que faz ponte com a balança
                </p>
                <Button
                  variant="outline"
                  onClick={connectWebSocketScale}
                  disabled={!availability.websocket}
                  className="w-full"
                >
                  Conectar WebSocket
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  <span className="font-medium">Simulador</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Simula uma balança para testes e demonstração
                </p>
                <Button
                  variant="outline"
                  onClick={connectScaleSimulator}
                  disabled={!availability.simulation}
                  className="w-full"
                >
                  Iniciar Simulador
                </Button>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Impressoras */}
          <div>
            <h4 className="font-medium mb-3">Impressoras</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span className="font-medium">Via Aplicativo Nativo</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Usa aplicativo desktop para acessar impressoras do sistema
              </p>
              <Button
                variant="outline"
                onClick={connectNativeAppPrinter}
                disabled={!availability.nativeApp}
                className="w-full"
              >
                Conectar App Nativo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instruções de Instalação */}
      {(!availability.websocket || !availability.nativeApp) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Instalação de Componentes
            </CardTitle>
            <CardDescription>
              Para usar todas as funcionalidades, instale os componentes adicionais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!availability.websocket && (
              <Alert>
                <Wifi className="h-4 w-4" />
                <AlertDescription>
                  <strong>Servidor WebSocket:</strong> Baixe e execute o servidor local para conectar balanças seriais.
                  <Button variant="link" className="p-0 h-auto ml-2">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {!availability.nativeApp && (
              <Alert>
                <Monitor className="h-4 w-4" />
                <AlertDescription>
                  <strong>Aplicativo Desktop:</strong> Instale o aplicativo nativo para acessar impressoras do sistema.
                  <Button variant="link" className="p-0 h-auto ml-2">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dispositivos Conectados */}
      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos Alternativos Conectados</CardTitle>
            <CardDescription>
              Gerencie os dispositivos conectados via soluções alternativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {devices.map((device, index) => (
                <div key={device.id}>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {device.method === 'websocket' && <Wifi className="h-5 w-5" />}
                      {device.method === 'simulation' && <Play className="h-5 w-5" />}
                      {device.method === 'native-app' && <Monitor className="h-5 w-5" />}
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{device.name}</span>
                          <Badge variant="outline">{device.method}</Badge>
                        </div>
                        
                        {device.lastReading && (
                          <div className="text-sm text-muted-foreground">
                            Peso: {device.lastReading.weight} {device.lastReading.unit}
                            {device.lastReading.stable ? ' (Estável)' : ' (Instável)'}
                            <span className="ml-2 text-xs">({device.lastReading.source})</span>
                          </div>
                        )}
                        
                        {device.method === 'simulation' && device.status === 'connected' && (
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              type="number"
                              placeholder="Peso (kg)"
                              className="w-24 h-6 text-xs"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  const weight = parseFloat((e.target as HTMLInputElement).value);
                                  if (!isNaN(weight)) {
                                    setSimulatorWeight(device.id, weight);
                                  }
                                }
                              }}
                            />
                            <span className="text-xs text-muted-foreground">Enter para definir</span>
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