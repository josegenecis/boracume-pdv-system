
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageCircle, Save, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const WhatsAppSettings = () => {
  const [settings, setSettings] = useState({
    phoneNumber: '',
    defaultMessage: 'Olá! Gostaria de fazer um pedido.',
    enabled: true
  });
  
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', error);
        return;
      }

      if (data) {
        setSettings({
          phoneNumber: data.phone_number,
          defaultMessage: data.default_message,
          enabled: data.enabled
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: existingData } = await supabase
        .from('whatsapp_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const settingsData = {
        user_id: user.id,
        phone_number: settings.phoneNumber,
        default_message: settings.defaultMessage,
        enabled: settings.enabled,
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from('whatsapp_settings')
          .update(settingsData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Criar nova configuração
        const { error } = await supabase
          .from('whatsapp_settings')
          .insert(settingsData);

        if (error) throw error;
      }

      // Disparar evento personalizado para atualizar o componente WhatsApp
      window.dispatchEvent(new CustomEvent('whatsapp-settings-updated', { detail: settings }));
      
      toast({
        title: "Configurações salvas!",
        description: "As configurações do WhatsApp foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testWhatsApp = () => {
    const whatsappUrl = `https://wa.me/${settings.phoneNumber}?text=${encodeURIComponent(settings.defaultMessage)}`;
    window.open(whatsappUrl, '_blank');
    
    toast({
      title: "Teste enviado",
      description: "WhatsApp aberto com as configurações atuais.",
    });
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const limited = numbers.slice(0, 13);
    return limited;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle size={24} />
          Configurações do WhatsApp
        </CardTitle>
        <CardDescription>
          Configure o botão de WhatsApp que aparece em todas as páginas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone-number">Número de Telefone</Label>
          <Input
            id="phone-number"
            placeholder="5511999999999"
            value={settings.phoneNumber}
            onChange={(e) => handleInputChange('phoneNumber', formatPhoneNumber(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Formato: código do país + DDD + número (ex: 5511999999999)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default-message">Mensagem Padrão</Label>
          <Textarea
            id="default-message"
            placeholder="Olá! Gostaria de fazer um pedido."
            value={settings.defaultMessage}
            onChange={(e) => handleInputChange('defaultMessage', e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Esta mensagem será enviada automaticamente quando o cliente clicar no botão do WhatsApp
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            <Save size={16} className="mr-2" />
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
          <Button variant="outline" onClick={testWhatsApp}>
            <TestTube size={16} className="mr-2" />
            Testar
          </Button>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Como usar:</h4>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Digite seu número no formato internacional (país + DDD + número)</li>
            <li>2. Personalize a mensagem que será enviada automaticamente</li>
            <li>3. Clique em "Salvar Configurações"</li>
            <li>4. O botão do WhatsApp aparecerá automaticamente em todas as páginas</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppSettings;
