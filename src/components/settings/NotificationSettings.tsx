
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, Bell, Mail, MessageSquare, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  const { toast } = useToast();

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

  const playTestSound = () => {
    // Simular som de notificação
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSqR2vjNfS0FJHfI2+WRQQ0XXr3p6a1VFAxEn+Dzu2oiBSqM2frQg');
    audio.volume = parseInt(notifications.volume) / 100;
    audio.play().catch(() => {
      toast({
        title: "Teste de som",
        description: "Som de notificação reproduzido (se disponível no navegador).",
      });
    });
  };

  const handleSave = () => {
    // Aqui salvaria no banco de dados
    console.log('Configurações de notificação:', notifications);
    
    toast({
      title: "Configurações salvas!",
      description: "As configurações de notificação foram atualizadas com sucesso.",
    });
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
                      <SelectItem value="bell">Sino</SelectItem>
                      <SelectItem value="chime">Carrilhão</SelectItem>
                      <SelectItem value="ding">Ding</SelectItem>
                      <SelectItem value="notification">Notificação</SelectItem>
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

      <div className="flex justify-end">
        <Button onClick={handleSave} className="w-full md:w-auto">
          <Save size={16} className="mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettings;
