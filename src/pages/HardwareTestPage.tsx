import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Scale, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { scaleService, ScaleData } from '@/utils/scaleService';
import { PrinterService } from '@/utils/printerService';
import { useToast } from '@/hooks/use-toast';

const HardwareTestPage = () => {
  const [scaleConnected, setScaleConnected] = useState(false);
  const [weightData, setWeightData] = useState<ScaleData | null>(null);
  const { toast } = useToast();

  const handleConnectScale = async () => {
    // ... (mantém igual)
    const success = await scaleService.connect();
    if (success) {
      setScaleConnected(true);
      toast({ title: 'Balança conectada!' });
      scaleService.readWeight((data) => {
        setWeightData(data);
      });
    } else {
      toast({ title: 'Falha ao conectar balança', variant: 'destructive' });
    }
  };

  const handleDisconnectScale = async () => {
    await scaleService.disconnect();
    setScaleConnected(false);
    setWeightData(null);
  };

  const handleTestPrint = () => {
    // Adaptação para o formato esperado pelo PrinterService.printOrder
    PrinterService.printOrder({
      order_number: 'TEST-1234',
      created_at: new Date().toISOString(),
      customer_name: 'Cliente Teste',
      customer_phone: '(11) 99999-9999',
      items: [
        { product_name: 'Hambúrguer X-Tudo', quantity: 2, price: 25.00, total: 50.00 },
        { product_name: 'Coca-Cola 350ml', quantity: 2, price: 5.00, total: 10.00 }
      ],
      total: 60.00,
      subtotal: 60.00,
      delivery_fee: 5.00,
      discount: 0,
      payment_method: 'dinheiro',
      change_amount: 100.00,
      order_type: 'dine_in',
      status: 'completed',
      user_id: 'test-user' // Vai usar config default
    });
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Configuração de Hardware</h1>
      <p className="text-muted-foreground">Teste e configure impressoras e balanças conectadas.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Impressora */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-6 w-6" />
              Impressora Térmica
            </CardTitle>
            <CardDescription>
              O sistema utiliza a impressão nativa do navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 text-sm text-yellow-800 flex gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-bold">Dica Importante:</p>
                <p>Nas configurações de impressão do navegador, marque a opção "Margens Mínimas" e desmarque "Cabeçalhos e Rodapés".</p>
              </div>
            </div>
            
            <Button onClick={handleTestPrint} className="w-full">
              Testar Impressão (80mm)
            </Button>
          </CardContent>
        </Card>

        {/* Balança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-6 w-6" />
              Balança (Serial/USB)
            </CardTitle>
            <CardDescription>
              Conecte balanças compatíveis (Toledo/Filizola) via USB.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!scaleConnected ? (
              <Button onClick={handleConnectScale} variant="outline" className="w-full">
                Conectar Balança
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-green-50 p-3 rounded border border-green-200 text-green-800">
                  <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Conectado</span>
                  <Button variant="ghost" size="sm" onClick={handleDisconnectScale} className="h-6 text-red-600 hover:text-red-700 hover:bg-red-50">Desconectar</Button>
                </div>
                
                <div className="text-center py-8 bg-gray-100 rounded-lg border-2 border-gray-300">
                  <p className="text-sm text-gray-500 mb-1">Peso Atual</p>
                  <p className="text-5xl font-mono font-bold tracking-tighter">
                    {weightData ? weightData.weight.toFixed(3) : '0.000'}
                    <span className="text-xl text-gray-400 ml-2">kg</span>
                  </p>
                </div>
              </div>
            )}
            
            {!('serial' in navigator) && (
              <p className="text-xs text-red-500 text-center">
                Seu navegador não suporta Web Serial API. Use Chrome ou Edge.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HardwareTestPage;