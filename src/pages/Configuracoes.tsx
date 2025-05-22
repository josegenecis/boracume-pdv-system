
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Settings, Tag, Smartphone } from 'lucide-react';

const Configuracoes = () => {
  const { toast } = useToast();
  const [pixelId, setPixelId] = useState('');
  const [googleTagId, setGoogleTagId] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('Olá! Estou com uma dúvida sobre o cardápio.');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  
  const saveMarketingSettings = () => {
    // In a real app, this would save to a database
    toast({
      title: "Configurações salvas",
      description: "As configurações de marketing foram atualizadas com sucesso.",
    });
  };
  
  const saveWhatsappSettings = () => {
    // In a real app, this would save to a database
    toast({
      title: "Configurações salvas",
      description: "As configurações do ChatBot WhatsApp foram atualizadas com sucesso.",
    });
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      
      <Tabs defaultValue="marketing" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="marketing" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Marketing
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            ChatBot WhatsApp
          </TabsTrigger>
          <TabsTrigger value="sistema" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sistema
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="marketing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Marketing</CardTitle>
              <CardDescription>
                Configure integrações de marketing e analytics para seu estabelecimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="pixel-id">Facebook Pixel ID</Label>
                  <div className="flex items-center mt-1.5">
                    <Input
                      id="pixel-id"
                      placeholder="Exemplo: 123456789012345"
                      value={pixelId}
                      onChange={(e) => setPixelId(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID do seu Facebook Pixel para rastreamento de conversões
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="gtag-id">Google Tag ID</Label>
                  <div className="flex items-center mt-1.5">
                    <Input
                      id="gtag-id"
                      placeholder="Exemplo: G-XXXXXXXXXX ou UA-XXXXXXXX-X"
                      value={googleTagId}
                      onChange={(e) => setGoogleTagId(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID do Google Tag Manager para integração com Google Analytics
                  </p>
                </div>
                
                <Separator className="my-4" />
                
                <div>
                  <h3 className="text-sm font-medium mb-1">Banner Promocional</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Configure o banner promocional que aparecerá na página inicial do cardápio
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="banner-title">Título do Banner</Label>
                      <Input
                        id="banner-title"
                        placeholder="Ex: Super Promoção!"
                        className="mt-1.5"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="banner-link">Link do Banner</Label>
                      <Input
                        id="banner-link"
                        placeholder="https://seusite.com/promocao"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor="banner-desc">Descrição do Banner</Label>
                    <Textarea
                      id="banner-desc"
                      placeholder="Descreva sua promoção"
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                  
                  <div className="mt-4">
                    <Label htmlFor="banner-image">Imagem do Banner</Label>
                    <div className="mt-1.5 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md h-32">
                      <div className="space-y-1 text-center">
                        <div className="text-sm text-muted-foreground">
                          Arraste uma imagem ou clique para fazer upload
                        </div>
                        <Button size="sm" variant="outline">
                          Selecionar Arquivo
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveMarketingSettings}>Salvar Configurações</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do ChatBot WhatsApp</CardTitle>
              <CardDescription>
                Configure o botão de WhatsApp que aparecerá para seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="whatsapp-enabled"
                  checked={whatsappEnabled}
                  onCheckedChange={setWhatsappEnabled}
                />
                <Label htmlFor="whatsapp-enabled">Habilitar ChatBot WhatsApp</Label>
              </div>
              
              <div>
                <Label htmlFor="whatsapp-number">Número do WhatsApp</Label>
                <div className="flex items-center mt-1.5">
                  <Smartphone className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="whatsapp-number"
                    placeholder="5511999999999"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    disabled={!whatsappEnabled}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Digite o número com código do país (55) e DDD, sem espaços ou caracteres especiais
                </p>
              </div>
              
              <div>
                <Label htmlFor="whatsapp-message">Mensagem Padrão</Label>
                <Textarea
                  id="whatsapp-message"
                  placeholder="Digite a mensagem padrão que será enviada quando o cliente clicar no botão"
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                  disabled={!whatsappEnabled}
                />
              </div>
              
              <div>
                <Label htmlFor="whatsapp-position">Posição do Botão</Label>
                <Select defaultValue="right" disabled={!whatsappEnabled}>
                  <SelectTrigger id="whatsapp-position" className="mt-1.5">
                    <SelectValue placeholder="Selecione a posição" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Canto Inferior Direito</SelectItem>
                    <SelectItem value="left">Canto Inferior Esquerdo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <h3 className="text-sm font-medium mb-1">Aparência do Botão</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  <div>
                    <Label htmlFor="whatsapp-text">Texto do Botão</Label>
                    <Input
                      id="whatsapp-text"
                      placeholder="Fale Conosco"
                      defaultValue="Fale Conosco"
                      className="mt-1.5"
                      disabled={!whatsappEnabled}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="whatsapp-color">Cor do Botão</Label>
                    <div className="flex items-center mt-1.5">
                      <Input
                        id="whatsapp-color"
                        type="color"
                        defaultValue="#25D366"
                        className="w-12 h-10 p-1"
                        disabled={!whatsappEnabled}
                      />
                      <Input
                        value="#25D366"
                        className="ml-2 flex-1"
                        disabled={!whatsappEnabled}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="whatsapp-size">Tamanho do Botão</Label>
                    <Select defaultValue="md" disabled={!whatsappEnabled}>
                      <SelectTrigger id="whatsapp-size" className="mt-1.5">
                        <SelectValue placeholder="Selecione o tamanho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sm">Pequeno</SelectItem>
                        <SelectItem value="md">Médio</SelectItem>
                        <SelectItem value="lg">Grande</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveWhatsappSettings} disabled={!whatsappEnabled}>
                Salvar Configurações
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription>
                Veja como o botão de WhatsApp vai aparecer para seus clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-8 relative h-64">
                <div className="absolute right-4 bottom-4">
                  {whatsappEnabled && (
                    <Button className="bg-[#25D366] hover:bg-[#25D366]/90 rounded-full h-14 w-14 flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-white" />
                    </Button>
                  )}
                </div>
                <div className="text-center text-muted-foreground">
                  {whatsappEnabled 
                    ? "Botão de WhatsApp no canto inferior direito" 
                    : "O botão de WhatsApp está desabilitado"}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sistema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Sistema</CardTitle>
              <CardDescription>
                Gerencie as configurações gerais do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
                    <Input
                      id="restaurant-name"
                      defaultValue="Restaurante Silva"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="address">Endereço</Label>
                    <Textarea
                      id="address"
                      rows={3}
                      defaultValue="Av. Paulista, 1000, São Paulo - SP"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="operating-hours">Horário de Funcionamento</Label>
                    <Textarea
                      id="operating-hours"
                      rows={2}
                      defaultValue="Segunda a Sexta: 11h às 23h
Sábado e Domingo: 11h às 00h"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contact-phone">Telefone</Label>
                    <Input
                      id="contact-phone"
                      defaultValue="(11) 3456-7890"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contact-email">E-mail</Label>
                    <Input
                      id="contact-email"
                      defaultValue="contato@restaurantesilva.com.br"
                    />
                  </div>
                  
                  <div>
                    <Label>Logo do Restaurante</Label>
                    <div className="mt-1.5 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md h-32">
                      <div className="space-y-1 text-center">
                        <div className="text-sm text-muted-foreground">
                          Arraste uma imagem ou clique para fazer upload
                        </div>
                        <Button size="sm" variant="outline">
                          Selecionar Logo
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator className="my-2" />
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Configurações de Notificações</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="email-notifications" defaultChecked />
                    <Label htmlFor="email-notifications">Notificações por E-mail</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="push-notifications" defaultChecked />
                    <Label htmlFor="push-notifications">Notificações Push</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="order-sound" defaultChecked />
                    <Label htmlFor="order-sound">Som de Novos Pedidos</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="auto-print" defaultChecked />
                    <Label htmlFor="auto-print">Impressão Automática</Label>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Salvar Configurações</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;
