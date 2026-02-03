
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scale, Printer, Bluetooth, Wifi, Usb, Search, Power, PowerOff, Link as LinkIcon } from 'lucide-react';
import { useDeviceIntegration, Device } from '@/hooks/useDeviceIntegration';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { loadPrinterConfig, savePrinterConfig } from '@/services/printerConfig';
import { discoverBridgeWebsocketUrl } from '@/services/bridgeDiscovery';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createPrintAgentToken, enqueuePrintJob } from '@/services/printRelay';
import { supabase } from '@/integrations/supabase/client';
import { claimBridgePairing } from '@/services/printPairing';
import { getLatestBridgeWindowsExe } from '@/services/bridgeDownload';

const DeviceManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [detectingBridge, setDetectingBridge] = React.useState(false);
  const [tokenName, setTokenName] = React.useState('Bridge Impressão');
  const [generatedToken, setGeneratedToken] = React.useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = React.useState(false);
  const [cloudPrinters, setCloudPrinters] = React.useState<Array<{ agent_id: string; printer_id: string; name: string; transport: string; address?: string }>>([]);
  const [fetchingCloudPrinters, setFetchingCloudPrinters] = React.useState(false);
  const [selectedCloudPrinterId, setSelectedCloudPrinterId] = React.useState<string>(() => loadPrinterConfig().relay?.selectedPrinter?.printerId || '');
  const [pairingCode, setPairingCode] = React.useState('');
  const [claimingPairing, setClaimingPairing] = React.useState(false);
  const [downloadingBridge, setDownloadingBridge] = React.useState(false);

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
                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={detectingBridge}
                    onClick={async () => {
                      try {
                        setDetectingBridge(true);
                        const found = await discoverBridgeWebsocketUrl({ timeoutMs: 900 });
                        if (found) {
                          setBridgeConfig(prev => ({ ...prev, websocketUrl: found }));
                        }
                      } finally {
                        setDetectingBridge(false);
                      }
                    }}
                  >
                    {detectingBridge ? 'Detectando…' : 'Detectar bridge'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => connectBridgePrinter({ websocketUrl: bridgeConfig.websocketUrl, transport: bridgeConfig.transport as any, address: bridgeConfig.address })}>Conectar Bridge</Button>
                </div>
              </div>

              <div className="p-3 border rounded-lg">
                <div className="text-sm font-medium mb-2">Cloud Relay (sem configurar IP no PWA)</div>
                <div className="text-sm text-muted-foreground mb-3">
                  Instale o BoraCumê Bridge no computador/mini-pc, gere um código e vincule aqui.
                </div>
                <div className="flex justify-end mb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloadingBridge}
                    onClick={async () => {
                      try {
                        setDownloadingBridge(true);
                        const exe = await getLatestBridgeWindowsExe();
                        if (exe?.url) {
                          window.open(exe.url, '_blank', 'noopener,noreferrer');
                        } else {
                          window.open('https://github.com/josegenecis/boracume-pdv-system/releases', '_blank', 'noopener,noreferrer');
                        }
                      } finally {
                        setDownloadingBridge(false);
                      }
                    }}
                  >
                    {downloadingBridge ? 'Abrindo…' : 'Baixar Bridge (Windows .exe)'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <div className="sm:col-span-2">
                    <Input value={pairingCode} onChange={(e) => setPairingCode(e.target.value)} placeholder="Código do Bridge (6 dígitos)" />
                  </div>
                  <div className="sm:col-span-1">
                    <Button
                      className="w-full"
                      disabled={claimingPairing || !user?.id || !pairingCode.trim()}
                      onClick={async () => {
                        try {
                          setClaimingPairing(true);
                          await claimBridgePairing({ pairingCode: pairingCode.trim(), name: tokenName });
                          toast({ title: 'Bridge vinculado', description: 'Agora clique em “Buscar impressoras”.' });
                          setPairingCode('');
                        } catch (e: any) {
                          toast({ title: 'Falha ao vincular', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
                        } finally {
                          setClaimingPairing(false);
                        }
                      }}
                    >
                      {claimingPairing ? 'Vinculando…' : 'Vincular'}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <Input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Nome do token (ex.: Caixa 1)" />
                  </div>
                  <div className="sm:col-span-1">
                    <Button
                      className="w-full"
                      disabled={generatingToken || !user?.id}
                      onClick={async () => {
                        try {
                          setGeneratingToken(true);
                          const { token } = await createPrintAgentToken({ restaurantUserId: user?.id || '', name: tokenName });
                          setGeneratedToken(token);
                          toast({ title: 'Token gerado', description: 'Copie e cole no bridge (PRINT_AGENT_TOKEN).' });
                        } catch (e: any) {
                          toast({ title: 'Falha ao gerar token', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
                        } finally {
                          setGeneratingToken(false);
                        }
                      }}
                    >
                      {generatingToken ? 'Gerando…' : 'Gerar token'}
                    </Button>
                  </div>
                </div>
                {generatedToken && (
                  <div className="mt-3">
                    <Input readOnly value={generatedToken} />
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(generatedToken);
                            toast({ title: 'Copiado', description: 'Token copiado para a área de transferência.' });
                          } catch {
                            toast({ title: 'Não foi possível copiar', description: 'Copie manualmente o token.', variant: 'destructive' });
                          }
                        }}
                      >
                        Copiar token
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Impressoras disponíveis</div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fetchingCloudPrinters || !user?.id}
                      onClick={async () => {
                        try {
                          setFetchingCloudPrinters(true);
                          const { data, error } = await supabase
                            .from('print_agent_printers' as any)
                            .select('agent_id, printer_id, name, transport, address, updated_at')
                            .eq('restaurant_user_id', user?.id || '')
                            .order('updated_at', { ascending: false })
                            .limit(50);
                          if (error) throw error;
                          setCloudPrinters((data || []) as any);
                        } catch (e: any) {
                          toast({ title: 'Falha ao buscar impressoras', description: e?.message || 'Erro desconhecido', variant: 'destructive' });
                        } finally {
                          setFetchingCloudPrinters(false);
                        }
                      }}
                    >
                      {fetchingCloudPrinters ? 'Buscando…' : 'Buscar impressoras'}
                    </Button>
                  </div>

                  {cloudPrinters.length > 0 ? (
                    <Select
                      value={selectedCloudPrinterId}
                      onValueChange={(v) => {
                        setSelectedCloudPrinterId(v);
                        const p = cloudPrinters.find(x => x.printer_id === v);
                        if (p) {
                          const cfg = loadPrinterConfig();
                          savePrinterConfig({
                            ...cfg,
                            relay: {
                              ...cfg.relay,
                              selectedPrinter: {
                                printerId: p.printer_id,
                                name: p.name,
                                transport: p.transport as any,
                                address: p.address || '',
                              }
                            }
                          });
                          toast({ title: 'Impressora selecionada', description: p.name });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione uma impressora" />
                      </SelectTrigger>
                      <SelectContent>
                        {cloudPrinters.map((p) => (
                          <SelectItem key={`${p.agent_id}:${p.printer_id}`} value={p.printer_id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Clique em “Buscar impressoras”. O bridge precisa estar ligado e com token configurado.
                    </div>
                  )}
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
               <div className="flex justify-end gap-2">
                 <Button
                   variant="default"
                   size="sm"
                   className="flex items-center gap-2"
                    onClick={() => printReceipt({ order_number: 'TESTE', customer_name: 'Teste', items: [{ quantity: 1, product_name: 'Item', subtotal: 0 }], total: 0 }, { transport: bridgeConfig.transport, address: bridgeConfig.address })}
                  >
                    Imprimir teste
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!user?.id}
                    onClick={async () => {
                      try {
                        await enqueuePrintJob({
                          restaurantUserId: user?.id || '',
                          jobType: 'test_receipt',
                          payload: { order_number: 'TESTE', customer_name: 'Teste', items: [{ quantity: 1, product_name: 'Item', subtotal: 0 }], total: 0, date: new Date().toISOString() }
                        })
                        toast({ title: 'Enfileirado', description: 'Job enviado para a fila (cloud relay).' })
                      } catch (e: any) {
                        toast({ title: 'Falha ao enfileirar', description: e?.message || 'Erro desconhecido', variant: 'destructive' })
                      }
                    }}
                  >
                    Enviar teste (fila)
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
