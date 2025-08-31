import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Printer, 
  Scale, 
  Wifi, 
  WifiOff, 
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import type { ConnectedDevices, WeightReading } from '@/types/electron';

interface DeviceStatusProps {
  className?: string;
  onManageDevices?: () => void;
}

const DeviceStatus: React.FC<DeviceStatusProps> = ({ className, onManageDevices }) => {
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevices>({ printers: [], scales: [] });
  const [weightReadings, setWeightReadings] = useState<Record<string, WeightReading>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Verificar se está no Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  useEffect(() => {
    if (isElectron) {
      loadConnectedDevices();
      
      // Atualizar status a cada 5 segundos
      const interval = setInterval(loadConnectedDevices, 5000);
      return () => clearInterval(interval);
    }
  }, [isElectron]);

  const loadConnectedDevices = async () => {
    if (!isElectron) return;

    try {
      const result = await window.electronAPI.getConnectedDevices();
      
      if (result.success && result.devices) {
        setConnectedDevices(result.devices);
        
        // Ler peso das balanças conectadas
        for (const scale of result.devices.scales) {
          try {
            const weightResult = await window.electronAPI.readWeight(scale.id, 2000);
            if (weightResult.success && weightResult.weight !== undefined) {
              setWeightReadings(prev => ({
                ...prev,
                [scale.id]: {
                  weight: weightResult.weight,
                  unit: weightResult.unit || 'g',
                  stable: weightResult.stable || false,
                  timestamp: Date.now()
                }
              }));
            }
          } catch (error) {
            // Silenciar erros de leitura para não poluir o console
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos conectados:', error);
    }
  };

  const refreshDevices = async () => {
    setIsLoading(true);
    await loadConnectedDevices();
    setIsLoading(false);
  };

  const getTotalDevices = () => {
    return connectedDevices.printers.length + connectedDevices.scales.length;
  };

  const getDeviceStatusColor = (deviceCount: number) => {
    if (deviceCount === 0) return 'text-red-500';
    return 'text-green-500';
  };

  if (!isElectron) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <WifiOff className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Status de dispositivos disponível apenas no desktop
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalDevices = getTotalDevices();

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {totalDevices > 0 ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            
            <div>
              <h3 className="font-medium">Dispositivos</h3>
              <p className="text-sm text-muted-foreground">
                {totalDevices > 0 
                  ? `${totalDevices} dispositivo${totalDevices > 1 ? 's' : ''} conectado${totalDevices > 1 ? 's' : ''}`
                  : 'Nenhum dispositivo conectado'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={refreshDevices}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            
            {onManageDevices && (
              <Button variant="outline" size="sm" onClick={onManageDevices}>
                Gerenciar
              </Button>
            )}
          </div>
        </div>

        {totalDevices > 0 && (
          <div className="mt-4 space-y-2">
            {/* Impressoras */}
            {connectedDevices.printers.map((printer) => (
              <div key={printer.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <div className="flex items-center space-x-2">
                  <Printer className="h-4 w-4" />
                  <span className="text-sm font-medium">{printer.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    Impressora
                  </Badge>
                </div>
                <div className="flex items-center space-x-1">
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">Online</span>
                </div>
              </div>
            ))}

            {/* Balanças */}
            {connectedDevices.scales.map((scale) => {
              const reading = weightReadings[scale.id];
              return (
                <div key={scale.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex items-center space-x-2">
                    <Scale className="h-4 w-4" />
                    <span className="text-sm font-medium">{scale.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      Balança
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    {reading && (
                      <Badge 
                        variant={reading.stable ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {reading.weight}{reading.unit}
                      </Badge>
                    )}
                    <div className="flex items-center space-x-1">
                      <Wifi className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500">Online</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceStatus;