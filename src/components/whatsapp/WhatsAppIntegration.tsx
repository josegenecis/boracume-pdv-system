
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QrCode, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const WhatsAppIntegration: React.FC = () => {
  const [settings, setSettings] = useState({
    phone_number: '',
    connected: false,
    qr_code_data: '',
    auto_messages: {
      order_received: '',
      preparing: '',
      ready: '',
      out_for_delivery: '',
      delivered: '',
      menu_link: '',
      welcome: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Carregar configurações do localStorage
    const saved = localStorage.getItem('whatsapp_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // Salvar no localStorage
      localStorage.setItem('whatsapp_settings', JSON.stringify(settings));

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  const generateQRCode = async () => {
    try {
      setLoading(true);
      setQrCodeUrl(null); // Limpar QR anterior
      
      // Aqui você chamaria sua Evolution API
      // Configurações Globais Hardcoded (Chumbadas) da Evolution API
      // O sistema agora sempre baterá nesta VPS para gerar os QR Codes de qualquer cliente
      const evolutionUrl = "https://api.boracume.com";
      const evolutionApiKey = "BoraCumeMasterKey2024!";

      console.log("Tentando conectar com as chaves hardcoded:", {
        url: evolutionUrl,
        keyExists: !!evolutionApiKey
      });

      // Nome da instância baseado no ID do usuário
      const instanceName = `boracume_${user?.id.replace(/-/g, '')}`;

      // Vamos usar uma Edge Function do Supabase como proxy para evitar erros de Mixed Content (HTTP vs HTTPS)
      // 1. Criar a instância
      const createRes = await supabase.functions.invoke('evolution-proxy', {
        body: {
          endpoint: `${evolutionUrl}/instance/create`,
          method: 'POST',
          headers: { 'apikey': evolutionApiKey },
          payload: {
            instanceName: instanceName,
            token: "",
            qrcode: true
          }
        }
      });

      console.log("Create Res:", createRes);

      // Se a instância já existir, a Evolution pode retornar um erro genérico na nossa edge function. 
      // Então, em vez de parar o código aqui e dar erro, vamos tentar buscar o QR Code logo em seguida.
      // Se a busca do QR Code falhar, aí sim nós damos o erro.

      // 2. Pedir o QRCode (Connect)
      const connectRes = await supabase.functions.invoke('evolution-proxy', {
        body: {
          endpoint: `${evolutionUrl}/instance/connect/${instanceName}`,
          method: 'GET',
          headers: { 'apikey': evolutionApiKey }
        }
      });

      if (connectRes.error) {
         console.error("Connect Res Error:", connectRes.error);
         throw new Error('Falha ao obter QR Code da API');
      }

      const connectData = connectRes.data?.data;
      console.log("Connect Data Received:", connectData);
      
      if (connectData && connectData.base64) {
         setQrCodeUrl(connectData.base64);
         setSettings(prev => ({ ...prev, qr_code_data: connectData.base64 }));
         
         toast({
           title: "QR Code gerado",
           description: "Escaneie o QR Code no seu WhatsApp para conectar.",
         });

         // Iniciar polling para ver se conectou
         const checkInterval = setInterval(async () => {
            try {
              const statusRes = await supabase.functions.invoke('evolution-proxy', {
                body: {
                  endpoint: `${evolutionUrl}/instance/connectionState/${instanceName}`,
                  method: 'GET',
                  headers: { 'apikey': evolutionApiKey }
                }
              });
              const statusData = statusRes.data?.data;
              if (statusData && statusData.instance?.state === 'open') {
                clearInterval(checkInterval);
                setSettings(prev => ({ ...prev, connected: true }));
                toast({ title: "Conectado!", description: "WhatsApp conectado com sucesso." });
              }
            } catch (e) {}
         }, 3000);

         // Limpar interval após 2 minutos
         setTimeout(() => clearInterval(checkInterval), 120000);

      } else if (connectData?.instance?.state === 'open') {
         setSettings(prev => ({ ...prev, connected: true }));
         toast({ title: "Aviso", description: "Esta instância já está conectada!" });
      } else {
         // Tentar forçar um restart da instância e pegar o QR code
         console.log("Tentando reiniciar a instância para gerar novo QR...");
         try {
             await supabase.functions.invoke('evolution-proxy', {
                body: {
                  endpoint: `${evolutionUrl}/instance/restart/${instanceName}`,
                  method: 'PUT',
                  headers: { 'apikey': evolutionApiKey }
                }
             });
             toast({ title: "Reiniciando", description: "Preparando novo QR Code, tente novamente em 5 segundos." });
         } catch(e) {
             throw new Error('Não foi possível gerar o QR Code.');
         }
      }

    } catch (error: any) {
      console.error('Erro ao gerar QR Code:', error);
      toast({
        title: "Erro de Conexão",
        description: error.message || "Verifique se a Evolution API está online e configurada.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Integração WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <div className="flex gap-2">
              <Input
                id="phone"
                value={settings.phone_number}
                onChange={(e) => setSettings(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="(11) 99999-9999 (Opcional para o QR)"
              />
              <Button onClick={generateQRCode} disabled={loading}>
                <QrCode className="w-4 h-4 mr-2" />
                Gerar QR
              </Button>
            </div>
          </div>

          {settings.qr_code_data && (
            <div className="p-4 border rounded-lg text-center bg-white shadow-sm">
              <div className="mx-auto mb-4 flex items-center justify-center">
                 {qrCodeUrl ? (
                   <img src={qrCodeUrl} alt="QR Code WhatsApp" className="w-64 h-64 border-4 border-white shadow-md rounded-lg" />
                 ) : (
                   <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                     <QrCode className="w-16 h-16 text-gray-400 animate-pulse" />
                   </div>
                 )}
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                Escaneie com o WhatsApp
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Abra o WhatsApp {'>'} Configurações {'>'} Aparelhos conectados {'>'} Conectar aparelho
              </p>
              
              <div className="flex items-center justify-center gap-2 mt-4 p-2 bg-gray-50 rounded-full w-fit mx-auto">
                <div className={`w-3 h-3 rounded-full ${settings.connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                <span className="text-sm font-medium text-gray-700">
                  {settings.connected ? 'Conectado com sucesso!' : 'Aguardando leitura do QR Code...'}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Mensagens Automáticas</h3>
            
            <div className="space-y-2">
              <Label>Pedido Recebido</Label>
              <Textarea
                value={settings.auto_messages.order_received}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  auto_messages: { ...prev.auto_messages, order_received: e.target.value }
                }))}
                placeholder="🎉 Pedido recebido! Número: {order_number}. Tempo estimado: {estimated_time}"
              />
            </div>

            <div className="space-y-2">
              <Label>Em Preparo</Label>
              <Textarea
                value={settings.auto_messages.preparing}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  auto_messages: { ...prev.auto_messages, preparing: e.target.value }
                }))}
                placeholder="👨‍🍳 Seu pedido #{order_number} está sendo preparado!"
              />
            </div>

            <div className="space-y-2">
              <Label>Pronto</Label>
              <Textarea
                value={settings.auto_messages.ready}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  auto_messages: { ...prev.auto_messages, ready: e.target.value }
                }))}
                placeholder="✅ Pedido #{order_number} pronto para retirada!"
              />
            </div>

            <div className="space-y-2">
              <Label>Saiu para Entrega</Label>
              <Textarea
                value={settings.auto_messages.out_for_delivery}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  auto_messages: { ...prev.auto_messages, out_for_delivery: e.target.value }
                }))}
                placeholder="🚗 Pedido #{order_number} saiu para entrega!"
              />
            </div>

            <div className="space-y-2">
              <Label>Entregue</Label>
              <Textarea
                value={settings.auto_messages.delivered}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  auto_messages: { ...prev.auto_messages, delivered: e.target.value }
                }))}
                placeholder="✅ Pedido #{order_number} foi entregue!"
              />
            </div>

            <div className="space-y-2">
              <Label>Link do Cardápio</Label>
              <Textarea
                value={settings.auto_messages.menu_link}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  auto_messages: { ...prev.auto_messages, menu_link: e.target.value }
                }))}
                placeholder="📋 Confira nosso cardápio: {menu_link}"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem de Boas-vindas</Label>
              <Textarea
                value={settings.auto_messages.welcome}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  auto_messages: { ...prev.auto_messages, welcome: e.target.value }
                }))}
                placeholder="Olá! Bem-vindo ao {restaurant_name}! Como posso ajudar?"
              />
            </div>

            <Button onClick={saveSettings} disabled={loading} className="w-full">
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppIntegration;
