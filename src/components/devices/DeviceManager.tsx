
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Scale, Printer, Bluetooth, Wifi, Usb, Search, Power, PowerOff } from 'lucide-react';
import { useDeviceIntegration, Device } from '@/hooks/useDeviceIntegration';

const DeviceManager = () => {
  const { 
    devices, 
    isScanning, 
    scanForDevices, 
    connectDevice, 
    disconnectDevice 
  } = useDeviceIntegration();

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'scale': return <Scale size={20} />;
      case 'printer': return <Printer size={20} />;
      default: return null;
    }
  };

  const getConnectionIcon = (connectionType: Device['connectionType']) => {
    switch (connectionType) {
      case 'bluetooth': return <Bluetooth size={16} />;
      case 'wifi': return <Wifi size={16} />;
      case 'usb': return <Usb size={16} />;
      default: return null;
    }
  };

  const getStatusBadge = (status: Device['status']) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500 text-white">Conectado</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500 text-white">Conectando...</Badge>;
      case 'disconnected':
        return <Badge variant="outline">Desconectado</Badge>;
      default:
        return <Badge variant="destructive">Offline</Badge>;
    }
  };

  const scales = devices.filter(d => d.type === 'scale');
  const printers = devices.filter(d => d.type === 'printer');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Gerenciamento de Dispositivos</h2>
        <Button 
          onClick={scanForDevices} 
          disabled={isScanning}
          className="flex items-center gap-2"
        >
          <Search size={16} />
          {isScanning ? 'Escaneando...' : 'Escanear Dispositivos'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Balanças */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale size={24} />
              Balanças
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scales.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma balança encontrada
                </p>
              ) : (
                scales.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getDeviceIcon(device.type)}
                      <div>
                        <p className="font-medium">{device.name}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          {getConnectionIcon(device.connectionType)}
                          <span className="capitalize">{device.connectionType}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(device.status)}
                      {device.status === 'connected' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectDevice(device.id)}
                          className="flex items-center gap-1"
                        >
                          <PowerOff size={14} />
                          Desconectar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => connectDevice(device.id)}
                          disabled={device.status === 'connecting'}
                          className="flex items-center gap-1"
                        >
                          <Power size={14} />
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Impressoras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer size={24} />
              Impressoras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {printers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma impressora encontrada
                </p>
              ) : (
                printers.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getDeviceIcon(device.type)}
                      <div>
                        <p className="font-medium">{device.name}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          {getConnectionIcon(device.connectionType)}
                          <span className="capitalize">{device.connectionType}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(device.status)}
                      {device.status === 'connected' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectDevice(device.id)}
                          className="flex items-center gap-1"
                        >
                          <PowerOff size={14} />
                          Desconectar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => connectDevice(device.id)}
                          disabled={device.status === 'connecting'}
                          className="flex items-center gap-1"
                        >
                          <Power size={14} />
                          Conectar
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeviceManager;
