
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, Bell, Mail, MessageSquare, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import SoundUploadManager from './SoundUploadManager';
import { soundNotifications } from '@/utils/soundUtils';

const NotificationSettings = () => {
  const [notifications, setNotifications] = useState({
    newOrders: true,
    orderUpdates: true,
    lowStock: true,
    dailyReports: false,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    soundEnabled: true,
    orderSound: 'bell',
    volume: '80'
  });

  const [customSoundUrls, setCustomSoundUrls] = useState({
    custom_bell_url: null as string | null,
    custom_chime_url: null as string | null,
    custom_ding_url: null as string | null,
    custom_notification_url: null as string | null,
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
        .from('notification_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', error);
        return;
      }

      if (data) {
        setNotifications({
          newOrders: data.new_orders,
          orderUpdates: data.order_updates,
          lowStock: data.low_stock,
          dailyReports: data.daily_reports,
          emailNotifications: data.email_notifications,
          smsNotifications: data.sms_notifications,
          pushNotifications: data.push_notifications,
          soundEnabled: data.sound_enabled,
          orderSound: data.order_sound,
          volume: data.volume
        });

        setCustomSoundUrls({
          custom_bell_url: data.custom_bell_url,
          custom_chime_url: data.custom_chime_url,
          custom_ding_url: data.custom_ding_url,
          custom_notification_url: data.custom_notification_url,
        });

        // Configurar sons personalizados no sistema de som
        soundNotifications.setCustomSoundUrls({
          custom_bell_url: data.custom_bell_url,
          custom_chime_url: data.custom_chime_url,
          custom_ding_url: data.custom_ding_url,
          custom_notification_url: data.custom_notification_url,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const handleToggle = (field: string) => {
    setNotifications(prev => ({
      ...prev,
      [field]: !prev[field as keyof typeof prev]
    }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setNotifications(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const playTestSound = async () => {
    if (!notifications.soundEnabled) {
      toast({
        title: "Som desabilitado",
        description: "Habilite o som nas configurações para testar.",
        variant: "destructive",
      });
      return;
    }

    try {
      await soundNotifications.playSound(notifications.orderSound);
      toast({
        title: "Som reproduzido",
        description: `Som "${notifications.orderSound}" com volume ${notifications.volume}%.`,
      });
    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
      toast({
        title: "Erro ao reproduzir som",
        description: "Não foi possível reproduzir o som.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: existingData } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const settingsData = {
        user_id: user.id,
        new_orders: notifications.newOrders,
        order_updates: notifications.orderUpdates,
        low_stock: notifications.lowStock,
        daily_reports: notifications.dailyReports,
        email_notifications: notifications.emailNotifications,
        sms_notifications: notifications.smsNotifications,
        push_notifications: notifications.pushNotifications,
        sound_enabled: notifications.soundEnabled,
        order_sound: notifications.orderSound,
        volume: notifications.volume,
        custom_bell_url: customSoundUrls.custom_bell_url,
        custom_chime_url: customSoundUrls.custom_chime_url,
        custom_ding_url: customSoundUrls.custom_ding_url,
        custom_notification_url: customSoundUrls.custom_notification_url,
        updated_at: new Date().toISOString()
      };

      if (existingData) {
        const { error } = await supabase
          .from('notification_settings')
          .update(settingsData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_settings')
          .insert(settingsData);

        if (error) throw error;
      }
      
      toast({
        title: "Configurações salvas!",
        description: "As configurações de notificação foram atualizadas com sucesso.",
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

  const handleSoundUploaded = (soundType: string, url: string | null) => {
    const urlKey = `custom_${soundType}_url` as keyof typeof customSoundUrls;
    const newCustomUrls = {
      ...customSoundUrls,
      [urlKey]: url
    };
    
    setCustomSoundUrls(newCustomUrls);

    // Atualizar sistema de som imediatamente
    soundNotifications.setCustomSoundUrls(newCustomUrls);
    
    // Recarregar configurações para garantir sincronização
    loadSettings();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={24} />
            Notificações de Pedidos
          </CardTitle>
          <CardDescription>
            Configure quando você quer ser notificado sobre novos pedidos e atualizações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="new-orders">Novos Pedidos</Label>
              <p className="text-sm text-muted-foreground">
                Receber notificação quando um novo pedido for feito
              </p>
            </div>
            <Switch
              id="new-orders"
              checked={notifications.newOrders}
              onCheckedChange={() => handleToggle('newOrders')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="order-updates">Atualizações de Pedidos</Label>
              <p className="text-sm text-muted-foreground">
                Notificar sobre mudanças de status dos pedidos
              </p>
            </div>
            <Switch
              id="order-updates"
              checked={notifications.orderUpdates}
              onCheckedChange={() => handleToggle('orderUpdates')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="low-stock">Estoque Baixo</Label>
              <p className="text-sm text-muted-foreground">
                Alertar quando produtos estiverem com estoque baixo
              </p>
            </div>
            <Switch
              id="low-stock"
              checked={notifications.lowStock}
              onCheckedChange={() => handleToggle('lowStock')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="daily-reports">Relatórios Diários</Label>
              <p className="text-sm text-muted-foreground">
                Receber resumo diário de vendas por e-mail
              </p>
            </div>
            <Switch
              id="daily-reports"
              checked={notifications.dailyReports}
              onCheckedChange={() => handleToggle('dailyReports')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare size={24} />
            Canais de Notificação
          </CardTitle>
          <CardDescription>
            Escolha como você quer receber as notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">E-mail</Label>
              <p className="text-sm text-muted-foreground">
                Receber notificações por e-mail
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={notifications.emailNotifications}
              onCheckedChange={() => handleToggle('emailNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms-notifications">SMS</Label>
              <p className="text-sm text-muted-foreground">
                Receber notificações por SMS (taxa adicional pode ser aplicada)
              </p>
            </div>
            <Switch
              id="sms-notifications"
              checked={notifications.smsNotifications}
              onCheckedChange={() => handleToggle('smsNotifications')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">Notificações Push</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar notificações na tela do computador/celular
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={notifications.pushNotifications}
              onCheckedChange={() => handleToggle('pushNotifications')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 size={24} />
            Configurações de Som
          </CardTitle>
          <CardDescription>
            Configure os sons de notificação para pedidos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sound-enabled">Som Habilitado</Label>
              <p className="text-sm text-muted-foreground">
                Reproduzir som quando receber notificações
              </p>
            </div>
            <Switch
              id="sound-enabled"
              checked={notifications.soundEnabled}
              onCheckedChange={() => handleToggle('soundEnabled')}
            />
          </div>

          {notifications.soundEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="order-sound">Som para Novos Pedidos</Label>
                <div className="flex gap-2">
                  <Select
                    value={notifications.orderSound}
                    onValueChange={(value) => handleSelectChange('orderSound', value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bell">
                        Sino {customSoundUrls.custom_bell_url ? '(personalizado)' : ''}
                      </SelectItem>
                      <SelectItem value="chime">
                        Carrilhão {customSoundUrls.custom_chime_url ? '(personalizado)' : ''}
                      </SelectItem>
                      <SelectItem value="ding">
                        Ding {customSoundUrls.custom_ding_url ? '(personalizado)' : ''}
                      </SelectItem>
                      <SelectItem value="notification">
                        Notificação {customSoundUrls.custom_notification_url ? '(personalizado)' : ''}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={playTestSound}>
                    Testar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="volume">Volume: {notifications.volume}%</Label>
                <input
                  type="range"
                  id="volume"
                  min="0"
                  max="100"
                  value={notifications.volume}
                  onChange={(e) => handleSelectChange('volume', e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SoundUploadManager 
        customUrls={customSoundUrls}
        onSoundUploaded={handleSoundUploaded}
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} className="w-full md:w-auto" disabled={loading}>
          <Save size={16} className="mr-2" />
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
