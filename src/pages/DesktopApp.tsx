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

const DesktopApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showDeviceManager, setShowDeviceManager] = useState(false);

  // Verificar se está no Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  const testPrint = async () => {
    if (!isElectron) {
      toast.error('Função disponível apenas no aplicativo desktop');
      return;
    }

    try {
      const testOrder = {
        id: 'TEST-001',
        items: [
          {
            name: 'Produto Teste',
            quantity: 1,
            price: 10.50,
            weight: 0.5
          }
        ],
        total: 10.50,
        customer: {
          name: 'Cliente Teste',
          phone: '(11) 99999-9999'
        },
        createdAt: new Date().toISOString()
      };

      const result = await window.electronAPI.printReceipt(testOrder);
      
      if (result.success) {
        toast.success('Cupom de teste impresso com sucesso!');
      } else {
        toast.error(result.error || 'Erro ao imprimir cupom de teste');
      }
    } catch (error) {
      console.error('Erro ao imprimir cupom de teste:', error);
      toast.error('Erro ao imprimir cupom de teste');
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Monitor className="h-6 w-6" />
                <h1 className="text-xl font-bold">Bora Cume Hub Desktop</h1>
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
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="pos" className="flex items-center space-x-2">
              <ShoppingCart className="h-4 w-4" />
              <span>PDV</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
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

          {/* PDV */}
          <TabsContent value="pos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ponto de Venda (PDV)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">PDV em Desenvolvimento</h3>
                  <p className="text-muted-foreground">
                    O sistema de PDV integrado com balanças e impressoras estará disponível em breve.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Produtos */}
          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Produtos</h3>
                  <p className="text-muted-foreground">
                    Gerencie seu catálogo de produtos com integração para pesagem automática.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clientes */}
          <TabsContent value="customers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Clientes</h3>
                  <p className="text-muted-foreground">
                    Gerencie informações de clientes e histórico de compras.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={() => setShowDeviceManager(true)}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Gerenciar Dispositivos
                  </Button>
                  
                  <div className="text-center py-8">
                    <Settings className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Configurações</h3>
                    <p className="text-muted-foreground">
                      Configure impressoras, balanças e outras preferências do sistema.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Device Manager Dialog */}
      <Dialog open={showDeviceManager} onOpenChange={setShowDeviceManager}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciador de Dispositivos</DialogTitle>
          </DialogHeader>
          <DeviceManager />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesktopApp;