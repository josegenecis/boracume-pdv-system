
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Scale, Printer, Bluetooth, Wifi, Usb, Search, Power, PowerOff, Link as LinkIcon } from 'lucide-react';
import { useDeviceIntegration, Device } from '@/hooks/useDeviceIntegration';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { loadPrinterConfig, savePrinterConfig } from '@/services/printerConfig';

const DeviceManager = () => {
  const { 
    devices, 
    isScanning, 
    scanForDevices, 
    connectDevice, 
    disconnectDevice,
    printReceipt,
    bridgeConfig,
    setBridgeConfig,
    connectBridgePrinter
  } = useDeviceIntegration();

  const [autoPrintKds, setAutoPrintKds] = React.useState(() => loadPrinterConfig().autoPrintKds);

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
  const connectedPrinter = printers.find(d => d.status === 'connected');

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

      {isScanning && (
        <div className="text-sm text-muted-foreground">Procurando dispositivos…</div>
      )}

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
              {/* Configuração da Bridge */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon size={18} />
                  <span className="text-sm">Bridge de impressão (WebSocket)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-3">
                    <Input
                      placeholder="ws://localhost:8766 (ou ws://IP_DA_REDE:8766)"
                      value={bridgeConfig.websocketUrl}
                      onChange={(e) => setBridgeConfig(prev => ({ ...prev, websocketUrl: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Select value={['network','usb','bluetooth','system'].includes(bridgeConfig.transport as any) ? (bridgeConfig.transport as any) : 'network'} onValueChange={(v) => setBridgeConfig(prev => ({ ...prev, transport: v as any }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Transporte" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="network">Rede (IP)</SelectItem>
                        <SelectItem value="usb">USB</SelectItem>
                        <SelectItem value="bluetooth">Bluetooth</SelectItem>
                        <SelectItem value="system">Sistema (OS)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Input placeholder="Endereço/IP (ex.: 192.168.0.50)" value={bridgeConfig.address || ''} onChange={(e) => setBridgeConfig(prev => ({ ...prev, address: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 border-t pt-3">
                  <div className="text-sm">
                    <div className="font-medium">Impressão automática (Cozinha/KDS)</div>
                    <div className="text-muted-foreground">Imprime quando o pedido entrar em preparo</div>
                  </div>
                  <Switch
                    checked={autoPrintKds}
                    onCheckedChange={(checked) => {
                      setAutoPrintKds(checked);
                      const cfg = loadPrinterConfig();
                      savePrinterConfig({ ...cfg, autoPrintKds: checked, bridge: { ...cfg.bridge, websocketUrl: bridgeConfig.websocketUrl, transport: bridgeConfig.transport as any, address: bridgeConfig.address || '' } });
                    }}
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="outline" onClick={() => connectBridgePrinter({ websocketUrl: bridgeConfig.websocketUrl, transport: bridgeConfig.transport as any, address: bridgeConfig.address })}>Conectar Bridge</Button>
                </div>
              </div>
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
             {connectedPrinter && (
               <div className="flex justify-end">
                 <Button
                   variant="default"
                   size="sm"
                   className="flex items-center gap-2"
                    onClick={() => printReceipt({ order_number: 'TESTE', customer_name: 'Teste', items: [{ quantity: 1, product_name: 'Item', subtotal: 0 }], total: 0 }, { transport: bridgeConfig.transport, address: bridgeConfig.address })}
                  >
                    Imprimir teste
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeviceManager;
