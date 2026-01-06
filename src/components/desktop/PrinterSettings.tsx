import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, Network, Save, TestTube, Zap } from 'lucide-react';

interface SystemPrinter {
  name: string;
  driver: string;
  path: string;
  status: number;
}

type Mode = 'system' | 'network';

export default function PrinterSettings() {
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  const [availablePrinters, setAvailablePrinters] = useState<SystemPrinter[]>([]);
  const [mode, setMode] = useState<Mode>('system');
  const [systemPrinter, setSystemPrinter] = useState<string>('');
  const [networkIP, setNetworkIP] = useState<string>('');
  const [networkPort, setNetworkPort] = useState<string>('9100');
  const [protocol, setProtocol] = useState<string>('epson');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('pdv_printer');
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        setMode(cfg.mode || 'system');
        setSystemPrinter(cfg.systemName || '');
        setNetworkIP(cfg.ip || '');
        setNetworkPort(String(cfg.port || '9100'));
        setProtocol(cfg.protocol || 'epson');
      } catch {}
    }
  }, []);

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    if (!isElectron) return;
    try {
      const result = await window.electronAPI.getAvailablePrinters();
      if (result.success) {
        setAvailablePrinters(result.printers || []);
      }
    } catch {}
  };

  const saveDefault = () => {
    const cfg = {
      mode,
      systemName: systemPrinter,
      ip: networkIP,
      port: parseInt(networkPort) || 9100,
      protocol
    };
    localStorage.setItem('pdv_printer', JSON.stringify(cfg));
    toast.success('Impressora padrão salva');
  };

  const connectAndTest = async (doCashDrawer: boolean = false) => {
    if (!isElectron) {
      toast.error('Disponível apenas no aplicativo desktop');
      return;
    }
    try {
      setLoading(true);
      let deviceId = '';
      if (mode === 'system') {
        if (!systemPrinter) {
          toast.error('Selecione uma impressora do sistema');
          setLoading(false);
          return;
        }
        deviceId = systemPrinter;
      } else {
        if (!networkIP) {
          toast.error('Informe o IP da impressora');
          setLoading(false);
          return;
        }
        deviceId = `tcp://${networkIP}:${parseInt(networkPort) || 9100}`;
      }
      const opts = { protocol };
      const conn = await window.electronAPI.connectPrinter(deviceId, protocol, opts);
      if (!conn.success) {
        toast.error(conn.error || 'Falha ao conectar impressora');
        setLoading(false);
        return;
      }
      if (doCashDrawer) {
        const r = await window.electronAPI.openCashDrawer(deviceId);
        if (r.success) toast.success('Gaveta aberta');
        else toast.error(r.error || 'Erro ao abrir gaveta');
      } else {
        const order = {
          order_number: 'TESTE',
          customer_name: 'Teste',
          items: [
            { product_name: 'Produto', quantity: 1, price: 10.0, subtotal: 10.0 }
          ],
          total: 10.0,
          payment_method: 'DINHEIRO'
        };
        const pr = await window.electronAPI.printReceipt(deviceId, order, 'receipt');
        if (pr.success) toast.success('Cupom de teste impresso');
        else toast.error(pr.error || 'Erro ao imprimir teste');
      }
    } catch {
      toast.error('Erro ao operar impressora');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5" />
          Configurar Impressora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Modo</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Sistema</SelectItem>
                <SelectItem value="network">Rede (IP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Protocolo</Label>
            <Select value={protocol} onValueChange={(v) => setProtocol(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="epson">Epson/ESC-POS</SelectItem>
                <SelectItem value="bematech">Bematech</SelectItem>
                <SelectItem value="daruma">Daruma</SelectItem>
                <SelectItem value="elgin">Elgin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Badge variant="outline" className="w-full justify-center">
              {mode === 'system' ? 'Impressora do Windows' : 'Impressora de Rede'}
            </Badge>
          </div>
        </div>

        {mode === 'system' ? (
          <div className="space-y-2">
            <Label>Impressoras do Sistema</Label>
            <Select value={systemPrinter} onValueChange={setSystemPrinter}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a impressora" />
              </SelectTrigger>
              <SelectContent>
                {availablePrinters.map((p, i) => (
                  <SelectItem key={`${p.name}-${i}`} value={p.name}>
                    {p.name} • {p.driver}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={loadPrinters} variant="outline" size="sm" className="mt-2">
              Atualizar lista
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>IP</Label>
              <div className="relative">
                <Network className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={networkIP} onChange={(e) => setNetworkIP(e.target.value)} className="pl-9" placeholder="192.168.0.100" />
              </div>
            </div>
            <div>
              <Label>Porta</Label>
              <Input value={networkPort} onChange={(e) => setNetworkPort(e.target.value)} placeholder="9100" />
            </div>
            <div className="flex items-end">
              <Badge variant="outline" className="w-full justify-center">TCP</Badge>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={saveDefault}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Padrão
          </Button>
          <Button onClick={() => connectAndTest(false)} disabled={loading} variant="outline">
            <TestTube className="h-4 w-4 mr-2" />
            Imprimir Teste
          </Button>
          <Button onClick={() => connectAndTest(true)} disabled={loading} variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Abrir Gaveta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
