import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Printer, RefreshCw, Scale } from 'lucide-react';

type PrinterMode = 'serial' | 'system';

const HardwareSettings = () => {
  const { toast } = useToast();
  const isElectron = useMemo(() => !!window.electronAPI, []);

  const [loading, setLoading] = useState(false);

  const [serialPorts, setSerialPorts] = useState<any[]>([]);
  const [printerProtocols, setPrinterProtocols] = useState<any[]>([]);
  const [scaleProtocols, setScaleProtocols] = useState<any[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<any[]>([]);

  const [receiptMode, setReceiptMode] = useState<PrinterMode>(() => (localStorage.getItem('hw.receipt.mode') as PrinterMode) || 'serial');
  const [receiptPort, setReceiptPort] = useState(() => localStorage.getItem('hw.receipt.port') || '');
  const [receiptProtocol, setReceiptProtocol] = useState(() => localStorage.getItem('hw.receipt.protocol') || 'epson');
  const [receiptConnected, setReceiptConnected] = useState(false);

  const [reportPrinterName, setReportPrinterName] = useState(() => localStorage.getItem('hw.report.printer') || '');

  const [scalePort, setScalePort] = useState(() => localStorage.getItem('hw.scale.port') || '');
  const [scaleProtocol, setScaleProtocol] = useState(() => localStorage.getItem('hw.scale.protocol') || 'generic');
  const [scaleBaudRate, setScaleBaudRate] = useState(() => Number(localStorage.getItem('hw.scale.baudRate') || '9600'));
  const [scaleConnected, setScaleConnected] = useState(false);
  const [scaleWeight, setScaleWeight] = useState<number | null>(null);
  const [scaleUnit, setScaleUnit] = useState<string>('kg');

  const refreshAll = async () => {
    if (!window.electronAPI) return;
    try {
      setLoading(true);
      const [portsResp, printersResp, printerProtoResp, scaleProtoResp] = await Promise.all([
        window.electronAPI.listSerialPorts(),
        window.electronAPI.getAvailablePrinters(),
        window.electronAPI.getSupportedProtocols('printer'),
        window.electronAPI.getSupportedProtocols('scale')
      ]);

      setSerialPorts(portsResp?.success ? (portsResp.ports || []) : []);
      setSystemPrinters(printersResp?.success ? (printersResp.printers || []) : []);
      setPrinterProtocols(printerProtoResp?.success ? (printerProtoResp.protocols || []) : []);
      setScaleProtocols(scaleProtoResp?.success ? (scaleProtoResp.protocols || []) : []);

      if (!reportPrinterName) {
        const first = (printersResp?.printers || [])?.[0];
        if (first?.name) setReportPrinterName(String(first.name));
      }
    } catch (e: any) {
      toast({ title: 'Falha ao carregar hardware', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isElectron) return;
    refreshAll();
  }, [isElectron]);

  useEffect(() => {
    localStorage.setItem('hw.receipt.mode', receiptMode);
  }, [receiptMode]);
  useEffect(() => {
    localStorage.setItem('hw.receipt.port', receiptPort);
  }, [receiptPort]);
  useEffect(() => {
    localStorage.setItem('hw.receipt.protocol', receiptProtocol);
  }, [receiptProtocol]);
  useEffect(() => {
    localStorage.setItem('hw.report.printer', reportPrinterName);
  }, [reportPrinterName]);
  useEffect(() => {
    localStorage.setItem('hw.scale.port', scalePort);
  }, [scalePort]);
  useEffect(() => {
    localStorage.setItem('hw.scale.protocol', scaleProtocol);
  }, [scaleProtocol]);
  useEffect(() => {
    localStorage.setItem('hw.scale.baudRate', String(scaleBaudRate));
  }, [scaleBaudRate]);

  useEffect(() => {
    if (!isElectron || !scaleConnected || !scalePort) return;
    let cancelled = false;
    const t = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const resp = await window.electronAPI?.readWeight(scalePort, 1500);
        if (!resp?.success) return;
        setScaleWeight(Number(resp.weight || 0));
        setScaleUnit(String(resp.unit || 'kg'));
      } catch {}
    }, 700);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [isElectron, scaleConnected, scalePort]);

  const connectReceipt = async () => {
    if (!window.electronAPI) return;
    if (receiptMode === 'serial' && !receiptPort) {
      toast({ title: 'Selecione a porta', description: 'Escolha a porta (COM) da impressora térmica.', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      if (receiptMode === 'serial') {
        const resp = await window.electronAPI.connectPrinter(receiptPort, receiptProtocol, { width: 48 });
        if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao conectar impressora');
        setReceiptConnected(true);
        toast({ title: 'Impressora térmica conectada', description: receiptPort });
      } else {
        if (!reportPrinterName) {
          toast({ title: 'Selecione a impressora', description: 'Escolha a impressora de cupons do Windows.', variant: 'destructive' });
          return;
        }
        setReceiptConnected(true);
        toast({ title: 'Impressora de cupons selecionada', description: reportPrinterName });
      }
    } catch (e: any) {
      toast({ title: 'Falha ao conectar', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const disconnectReceipt = async () => {
    if (!window.electronAPI) return;
    try {
      setLoading(true);
      if (receiptMode === 'serial' && receiptPort) {
        await window.electronAPI.disconnectPrinter(receiptPort);
      }
      setReceiptConnected(false);
      toast({ title: 'Impressora desconectada' });
    } catch (e: any) {
      toast({ title: 'Falha ao desconectar', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const testReceipt = async () => {
    if (!window.electronAPI) return;
    try {
      setLoading(true);
      if (receiptMode === 'serial') {
        if (!receiptPort) throw new Error('Selecione a porta da impressora térmica');
        const orderData = {
          order_number: 'TESTE-0001',
          id: 'TESTE-0001',
          items: [
            { name: 'Produto Teste', quantity: 1, price: 10.0 },
            { name: 'Outro Item', quantity: 2, price: 5.0 }
          ],
          total: 20.0,
          customer: { name: 'Cliente', phone: '', address: '' }
        };
        const resp = await window.electronAPI.printReceipt(receiptPort, orderData, 'receipt');
        if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao imprimir');
        toast({ title: 'Cupom impresso', description: 'Teste enviado para a térmica.' });
      } else {
        if (!reportPrinterName) throw new Error('Selecione a impressora de cupons do Windows');
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cupom</title><style>body{font-family:Arial,sans-serif;font-size:12px}h1{font-size:14px;margin:0 0 8px}hr{border:none;border-top:1px solid #000;margin:8px 0}</style></head><body><h1>BoraCumê</h1><div>Cupom de teste</div><hr/><div>Total: R$ 20,00</div></body></html>`;
        const resp = await window.electronAPI.printSystem(reportPrinterName, html, true);
        if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao imprimir');
        toast({ title: 'Cupom impresso', description: reportPrinterName });
      }
    } catch (e: any) {
      toast({ title: 'Falha no teste', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openDrawer = async () => {
    if (!window.electronAPI) return;
    if (receiptMode !== 'serial' || !receiptPort) {
      toast({ title: 'Gaveta', description: 'Abrir gaveta disponível apenas na impressora térmica via porta serial.', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const resp = await window.electronAPI.openCashDrawer(receiptPort);
      if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao abrir gaveta');
      toast({ title: 'Gaveta acionada' });
    } catch (e: any) {
      toast({ title: 'Falha', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const connectScale = async () => {
    if (!window.electronAPI) return;
    if (!scalePort) {
      toast({ title: 'Selecione a porta', description: 'Escolha a porta (COM) da balança.', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const resp = await window.electronAPI.connectScale(scalePort, scaleProtocol, { baudRate: scaleBaudRate });
      if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao conectar balança');
      setScaleConnected(true);
      toast({ title: 'Balança conectada', description: scalePort });
    } catch (e: any) {
      toast({ title: 'Falha ao conectar', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const disconnectScale = async () => {
    if (!window.electronAPI) return;
    try {
      setLoading(true);
      if (scalePort) await window.electronAPI.disconnectScale(scalePort);
      setScaleConnected(false);
      setScaleWeight(null);
      toast({ title: 'Balança desconectada' });
    } catch (e: any) {
      toast({ title: 'Falha ao desconectar', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const tareScale = async () => {
    if (!window.electronAPI || !scalePort) return;
    try {
      setLoading(true);
      const resp = await window.electronAPI.tareScale(scalePort);
      if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao tarar');
      toast({ title: 'Tara enviada' });
    } catch (e: any) {
      toast({ title: 'Falha', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const zeroScale = async () => {
    if (!window.electronAPI || !scalePort) return;
    try {
      setLoading(true);
      const resp = await window.electronAPI.zeroScale(scalePort);
      if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao zerar');
      toast({ title: 'Zero enviado' });
    } catch (e: any) {
      toast({ title: 'Falha', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const testReportPrint = async () => {
    if (!window.electronAPI) return;
    if (!reportPrinterName) {
      toast({ title: 'Selecione a impressora', description: 'Escolha a impressora para relatórios.', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Relatório</title><style>body{font-family:Arial,sans-serif}h1{font-size:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}th{background:#f5f5f5}</style></head><body><h1>Relatório de Teste - BoraCumê</h1><p>Impressão A4 via spooler do Windows.</p><table><thead><tr><th>Item</th><th>Qtd</th><th>Total</th></tr></thead><tbody><tr><td>Pedido #1</td><td>1</td><td>R$ 100,00</td></tr><tr><td>Pedido #2</td><td>1</td><td>R$ 50,00</td></tr></tbody></table></body></html>`;
      const resp = await window.electronAPI.printSystem(reportPrinterName, html, true);
      if (!resp?.success) throw new Error(resp?.error || resp?.message || 'Falha ao imprimir');
      toast({ title: 'Relatório enviado', description: reportPrinterName });
    } catch (e: any) {
      toast({ title: 'Falha ao imprimir', description: e?.message || 'Erro desconhecido.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isElectron) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hardware</CardTitle>
          <CardDescription>Esta tela é disponível no app desktop para acessar impressoras e balanças do Windows.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={refreshAll} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Impressora de Cupons (Térmica)
              </CardTitle>
              <CardDescription>Configuração para imprimir pedidos/cupom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Modo</Label>
                  <Select value={receiptMode} onValueChange={(v) => setReceiptMode(v as PrinterMode)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serial">Porta Serial (ESC/POS)</SelectItem>
                      <SelectItem value="system">Impressora do Windows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {receiptMode === 'serial' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Porta (COM)</Label>
                      <Select value={receiptPort} onValueChange={setReceiptPort}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a porta" />
                        </SelectTrigger>
                        <SelectContent>
                          {serialPorts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.id}{p.recognizedName ? ` • ${p.recognizedName}` : ''}{p.manufacturer ? ` • ${p.manufacturer}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Protocolo</Label>
                      <Select value={receiptProtocol} onValueChange={setReceiptProtocol}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o protocolo" />
                        </SelectTrigger>
                        <SelectContent>
                          {(printerProtocols.length > 0 ? printerProtocols : [{ id: 'epson', name: 'ESC/POS (Epson)' }]).map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>Impressora do Windows</Label>
                    <Select value={reportPrinterName} onValueChange={setReportPrinterName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a impressora" />
                      </SelectTrigger>
                      <SelectContent>
                        {systemPrinters.map((p: any) => (
                          <SelectItem key={p.name} value={p.name}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {receiptConnected ? (
                <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg border border-green-200 text-green-800">
                  <span className="flex items-center gap-2 font-medium">
                    <CheckCircle className="h-5 w-5" /> Pronta
                  </span>
                  <Button variant="outline" onClick={disconnectReceipt} disabled={loading}>
                    Desconectar
                  </Button>
                </div>
              ) : (
                <Button onClick={connectReceipt} disabled={loading} className="w-full">
                  Conectar
                </Button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button onClick={testReceipt} variant="outline" disabled={loading || !receiptConnected}>
                  Testar Cupom
                </Button>
                <Button onClick={openDrawer} variant="outline" disabled={loading || !receiptConnected}>
                  Abrir Gaveta
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Impressora de Relatórios (Comum)
              </CardTitle>
              <CardDescription>Impressão A4 via spooler do Windows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Impressora</Label>
                <Select value={reportPrinterName} onValueChange={setReportPrinterName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a impressora" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemPrinters.map((p: any) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={testReportPrint} variant="outline" disabled={loading || !reportPrinterName}>
                Testar Relatório
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" /> Balança
              </CardTitle>
              <CardDescription>Conecte por porta serial (COM) e selecione o protocolo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Porta (COM)</Label>
                  <Select value={scalePort} onValueChange={setScalePort}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a porta" />
                    </SelectTrigger>
                    <SelectContent>
                      {serialPorts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.id}{p.recognizedName ? ` • ${p.recognizedName}` : ''}{p.manufacturer ? ` • ${p.manufacturer}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Protocolo</Label>
                  <Select value={scaleProtocol} onValueChange={setScaleProtocol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o protocolo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(scaleProtocols.length > 0 ? scaleProtocols : [{ id: 'generic', name: 'Genérico', baudRate: 9600 }]).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Baud rate</Label>
                  <Input
                    inputMode="numeric"
                    value={String(scaleBaudRate)}
                    onChange={(e) => setScaleBaudRate(Number(String(e.target.value || '').replace(/[^\d]/g, '')) || 0)}
                  />
                </div>
              </div>

              {scaleConnected ? (
                <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg border border-green-200 text-green-800">
                  <span className="flex items-center gap-2 font-medium">
                    <CheckCircle className="h-5 w-5" /> Conectada
                  </span>
                  <Button variant="outline" onClick={disconnectScale} disabled={loading}>
                    Desconectar
                  </Button>
                </div>
              ) : (
                <Button onClick={connectScale} disabled={loading} className="w-full">
                  Conectar
                </Button>
              )}

              <div className="text-center py-10 bg-gray-100 rounded-xl border-2 border-gray-300">
                <p className="text-sm text-gray-500 mb-2 font-medium uppercase tracking-wide">Peso Atual</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-6xl font-mono font-bold tracking-tighter text-gray-900">
                    {scaleWeight !== null ? scaleWeight.toFixed(3) : '0.000'}
                  </span>
                  <span className="text-2xl text-gray-500 font-medium">{scaleUnit}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button onClick={tareScale} variant="outline" disabled={loading || !scaleConnected}>
                  Tara
                </Button>
                <Button onClick={zeroScale} variant="outline" disabled={loading || !scaleConnected}>
                  Zero
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HardwareSettings;
