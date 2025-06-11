
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { QrCode, Phone, Settings, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_real_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          phone_number: data.phone_number || '',
          connected: data.connected || false,
          qr_code_data: data.qr_code_data || '',
          auto_messages: data.auto_messages || settings.auto_messages
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('whatsapp_real_settings')
        .upsert({
          user_id: user?.id,
          phone_number: settings.phone_number,
          auto_messages: settings.auto_messages,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

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

  const generateQRCode = async () => {
    try {
      setLoading(true);
      
      // Simular geração de QR Code para conexão
      const qrData = `whatsapp://connect/${user?.id}/${Date.now()}`;
      
      const { error } = await supabase
        .from('whatsapp_real_settings')
        .upsert({
          user_id: user?.id,
          phone_number: settings.phone_number,
          qr_code_data: qrData,
          connected: false,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, qr_code_data: qrData }));
      
      toast({
        title: "QR Code gerado",
        description: "Escaneie o QR Code no seu WhatsApp para conectar.",
      });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar QR Code.",
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
                placeholder="(11) 99999-9999"
              />
              <Button onClick={generateQRCode} disabled={loading || !settings.phone_number}>
                <QrCode className="w-4 h-4 mr-2" />
                Gerar QR
              </Button>
            </div>
          </div>

          {settings.qr_code_data && (
            <div className="p-4 border rounded-lg text-center">
              <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <QrCode className="w-24 h-24 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600">
                Escaneie este QR Code no seu WhatsApp Business
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${settings.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">
                  {settings.connected ? 'Conectado' : 'Aguardando conexão'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Mensagens Automáticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppIntegration;
