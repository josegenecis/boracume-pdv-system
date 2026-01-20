import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Monitor, 
  Settings, 
  ShoppingCart, 
  Receipt, 
  Scale,
  Printer,
  Package,
  Users,
  BarChart3,
  Wifi
} from 'lucide-react';

// Componentes específicos do desktop
import DeviceManager from '@/components/desktop/DeviceManager';
import DeviceStatus from '@/components/desktop/DeviceStatus';
import WeightInput from '@/components/WeightInput';
import DesktopStatus from '@/components/desktop/DesktopStatus';
import DesktopIndicator from '@/components/desktop/DesktopIndicator';
import PrinterSettings from '@/components/desktop/PrinterSettings';

// Componentes do Sistema (Reutilizados)
import PDV from '@/pages/PDV';
import Products from '@/pages/Products';
import LoyaltyManager from '@/components/loyalty/LoyaltyManager';

const DesktopApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);

  // Verificar se está no Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  const testPrint = async () => {
    try {
      const result = await window.electronAPI?.printReceipt(null, {
        order_number: 'TESTE-001',
        customer_name: 'Cliente Teste',
        items: [
          { quantity: 1, product_name: 'Item de Teste', subtotal: 10.00 }
        ],
        total: 10.00
      });

      if (result?.success) {
        toast.success('Impressão de teste enviada com sucesso!');
      } else {
        toast.error('Erro ao enviar impressão de teste: ' + (result?.error || 'Desconhecido'));
      }
    } catch (error) {
      console.error('Erro no teste de impressão:', error);
      toast.error('Erro ao comunicar com o serviço de impressão');
    }
  };

  if (!isElectron) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Monitor className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Aplicativo Desktop</h2>
            <p className="text-muted-foreground mb-4">
              Esta página está disponível apenas no aplicativo desktop do Bora Cume Hub.
            </p>
            <p className="text-sm text-muted-foreground">
              Baixe e instale o aplicativo desktop para acessar as funcionalidades de PDV, 
              integração com balanças e impressoras de cupons.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Monitor className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold">Bora Cume Hub Desktop</h1>
              </div>
              <DesktopIndicator />
            </div>
            
            <div className="flex items-center space-x-4">
              <DesktopStatus />
              <DeviceStatus onManageDevices={() => setShowDeviceManager(true)} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
          <div className="border-b bg-muted/40 px-4 shrink-0">
            <TabsList className="grid w-full max-w-2xl grid-cols-5 h-10">
              <TabsTrigger value="dashboard" className="flex items-center space-x-2 text-xs">
                <BarChart3 className="h-3 w-3" />
                <span>Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="pos" className="flex items-center space-x-2 text-xs">
                <ShoppingCart className="h-3 w-3" />
                <span>PDV</span>
              </TabsTrigger>
              <TabsTrigger value="products" className="flex items-center space-x-2 text-xs">
                <Package className="h-3 w-3" />
                <span>Produtos</span>
              </TabsTrigger>
              <TabsTrigger value="customers" className="flex items-center space-x-2 text-xs">
                <Users className="h-3 w-3" />
                <span>Clientes</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center space-x-2 text-xs">
                <Settings className="h-3 w-3" />
                <span>Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="flex-1 overflow-auto p-4 space-y-6 m-0">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ 1.234,56</div>
                  <p className="text-xs text-muted-foreground">+12% em relação a ontem</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">23</div>
                  <p className="text-xs text-muted-foreground">+5 novos pedidos</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Produtos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">Produtos cadastrados</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Clientes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">89</div>
                  <p className="text-xs text-muted-foreground">Clientes ativos</p>
                </CardContent>
              </Card>
            </div>

            {/* Status dos Dispositivos */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Scale className="h-5 w-5" />
                    <span>Teste de Balança</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <WeightInput 
                    value={0}
                    onChange={() => {}}
                    placeholder="Peso será lido automaticamente"
                    className="mb-4"
                  />
                  <p className="text-sm text-muted-foreground">
                    Coloque um item na balança para ver o peso automaticamente.
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Printer className="h-5 w-5" />
                    <span>Teste de Impressora</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button onClick={testPrint} className="w-full mb-4">
                    <Receipt className="h-4 w-4 mr-2" />
                    Imprimir Cupom de Teste
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Teste a impressora com um cupom de exemplo.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PDV (Full Height) */}
          <TabsContent value="pos" className="flex-1 overflow-hidden m-0">
             <div className="h-full w-full">
               <PDV />
             </div>
          </TabsContent>

          {/* Produtos */}
          <TabsContent value="products" className="flex-1 overflow-auto p-4 m-0">
            <div className="container mx-auto">
              <Products />
            </div>
          </TabsContent>

          {/* Clientes */}
          <TabsContent value="customers" className="flex-1 overflow-auto p-4 m-0">
            <div className="container mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Fidelidade e Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <LoyaltyManager />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configurações */}
          <TabsContent value="settings" className="flex-1 overflow-auto p-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Gerenciador de Dispositivos</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure impressoras, balanças e outros periféricos
                      </p>
                    </div>
                    <Button onClick={() => setShowDeviceManager(true)}>
                      Abrir Gerenciador
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Configurações de Impressão</h4>
                      <p className="text-sm text-muted-foreground">
                        Defina layouts de recibos e opções de corte
                      </p>
                    </div>
                    <Button onClick={() => setShowPrinterSettings(true)}>
                      Configurar Impressão
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      <Dialog open={showDeviceManager} onOpenChange={setShowDeviceManager}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciamento de Dispositivos</DialogTitle>
          </DialogHeader>
          <DeviceManager />
        </DialogContent>
      </Dialog>

      <Dialog open={showPrinterSettings} onOpenChange={setShowPrinterSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurações de Impressão</DialogTitle>
          </DialogHeader>
          <PrinterSettings />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesktopApp;
