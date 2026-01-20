import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Scale, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { scaleService, ScaleData } from '@/utils/scaleService';
import { PrinterService } from '@/utils/printerService';
import { PrinterConfig } from '@/components/printer/PrinterConfig';
import { useToast } from '@/hooks/use-toast';

const HardwareSettings = () => {
  const [scaleConnected, setScaleConnected] = useState(false);
  const [weightData, setWeightData] = useState<ScaleData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Tentar reconectar balança se já estava conectada antes (opcional, requer persistência)
    return () => {
      // Cleanup ao sair da tela
      scaleService.disconnect();
    };
  }, []);

  const handleConnectScale = async () => {
    const success = await scaleService.connect();
    if (success) {
      setScaleConnected(true);
      toast({ title: 'Balança conectada com sucesso!' });
      scaleService.readWeight((data) => {
        setWeightData(data);
      });
    } else {
      toast({ 
        title: 'Falha ao conectar balança', 
        description: 'Verifique se o cabo está conectado e se você permitiu o acesso à porta serial.',
        variant: 'destructive' 
      });
    }
  };

  const handleDisconnectScale = async () => {
    await scaleService.disconnect();
    setScaleConnected(false);
    setWeightData(null);
    toast({ title: 'Balança desconectada' });
  };

  const handleTestPrint = () => {
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
      user_id: 'test-user'
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Coluna 1: Impressora */}
        <div className="space-y-6">
          <PrinterConfig />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Teste de Impressão
              </CardTitle>
              <CardDescription>Verifique se a configuração está correta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 text-sm text-yellow-800 flex gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">Dica:</p>
                  <p>No navegador, configure: Margens = "Nenhuma" e desmarque "Cabeçalhos e Rodapés".</p>
                </div>
              </div>
              <Button onClick={handleTestPrint} className="w-full" variant="outline">
                Imprimir Nota de Teste
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 2: Balança */}
        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" /> Configuração de Balança
              </CardTitle>
              <CardDescription>Conecte balanças Toledo/Filizola via USB/Serial</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!scaleConnected ? (
                <div className="text-center py-8">
                  <Scale className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-6">Nenhuma balança conectada</p>
                  <Button onClick={handleConnectScale} className="w-full">
                    Conectar Balança
                  </Button>
                  { !('serial' in navigator) && (
                    <p className="text-xs text-red-500 mt-2">
                      Seu navegador não suporta Web Serial. Use Chrome, Edge ou Opera.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-green-50 p-4 rounded-lg border border-green-200 text-green-800">
                    <span className="flex items-center gap-2 font-medium">
                      <CheckCircle className="h-5 w-5" /> Balança Conectada
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleDisconnectScale} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      Desconectar
                    </Button>
                  </div>
                  
                  <div className="text-center py-12 bg-gray-100 rounded-xl border-2 border-gray-300 relative overflow-hidden">
                    <div className="absolute top-2 right-2 animate-pulse">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    </div>
                    <p className="text-sm text-gray-500 mb-2 font-medium uppercase tracking-wide">Peso Atual</p>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-6xl font-mono font-bold tracking-tighter text-gray-900">
                        {weightData ? weightData.weight.toFixed(3) : '0.000'}
                      </span>
                      <span className="text-2xl text-gray-500 font-medium">kg</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default HardwareSettings;
