
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingSettings from '@/components/marketing/MarketingSettings';
import { useAuth } from '@/contexts/AuthContext';

const Configuracoes: React.FC = () => {
  const { subscription } = useAuth();
  
  // Check if marketing feature is available
  const hasMarketingFeature = () => {
    // During trial, all features are available
    if (subscription?.status === 'trial') {
      return true;
    }
    
    // If elite plan, all features are available
    if (subscription?.status === 'active' && subscription?.plan?.name === 'Elite') {
      return true;
    }
    
    return false;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          {hasMarketingFeature() && (
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
          )}
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Configure as opções gerais do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">WhatsApp</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure o botão de WhatsApp que aparece em todas as páginas.
                    </p>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Número de Telefone</label>
                      <input 
                        type="text" 
                        placeholder="5511999999999" 
                        className="w-full p-2 border rounded-md"
                      />
                      <p className="text-xs text-muted-foreground">
                        Formato: código do país + DDD + número (ex: 5511999999999)
                      </p>
                    </div>
                    
                    <div className="space-y-2 mt-4">
                      <label className="text-sm font-medium">Mensagem Padrão</label>
                      <input 
                        type="text" 
                        placeholder="Olá! Estou com uma dúvida sobre o restaurante." 
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Integração com Balanças</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure a integração com balanças de pesagem para produtos vendidos por peso.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="enableScales" className="rounded" />
                        <label htmlFor="enableScales" className="text-sm font-medium">
                          Habilitar integração com balanças
                        </label>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        Esta funcionalidade permite conectar balanças de pesagem via Bluetooth ou USB para produtos vendidos por peso.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Perfil do Restaurante</CardTitle>
              <CardDescription>
                Atualize as informações do seu restaurante
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Conteúdo em desenvolvimento</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificações</CardTitle>
              <CardDescription>
                Configure como você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Conteúdo em desenvolvimento</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {hasMarketingFeature() && (
          <TabsContent value="marketing">
            <MarketingSettings />
          </TabsContent>
        )}
        
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Personalize a aparência do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Conteúdo em desenvolvimento</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
