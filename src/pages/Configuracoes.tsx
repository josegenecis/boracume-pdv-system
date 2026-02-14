
import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingSettings from '@/components/marketing/MarketingSettings';
import ProfileSettings from '@/components/settings/ProfileSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import WhatsAppSettings from '@/components/settings/WhatsAppSettings';
import DeliverySettings from '@/components/settings/DeliverySettings';
import QRCodeGenerator from '@/components/products/QRCodeGenerator';
import MenuLinkGenerator from '@/components/menu/MenuLinkGenerator';
import DeviceManager from '@/components/devices/DeviceManager';
import { ErrorBoundary } from '@/components/utils/ErrorBoundary';
import WhatsAppIntegration from '@/components/whatsapp/WhatsAppIntegration';
import FiscalSettings from '@/components/fiscal/FiscalSettings';
import { useAuth } from '@/contexts/AuthContext';

import IfoodSettings from '@/components/settings/IfoodSettings';
import PaymentMethodsSettings from '@/components/settings/PaymentMethodsSettings';
import PixIntegrationSettings from '@/components/payment/PixIntegrationSettings';
import HardwareSettings from '@/components/settings/HardwareSettings';
import Garcons from '@/pages/Garcons';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';


import { IfoodLogo } from '@/components/icons/IfoodLogo';

const Configuracoes: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscription } = useAuth();
  const { ensureSubscribed } = usePushNotifications();
  
  const hasMarketingFeature = () => {
    if (subscription?.status === 'trial') {
      return true;
    }
    
    if (subscription?.status === 'active' && subscription?.plan_id === 2) {
      return true;
    }
    
    return false;
  };

  const getInitialTab = () => {
    const requested = searchParams.get('tab') || 'general';
    const allowed = [
      'general',
      'hardware',
      'menu',
      'devices',
      'profile',
      'notifications',
      'appearance',
      'delivery',
      'whatsapp',
      'fiscal',
      'payment-methods',
      'pix',
      'ifood',
      'users',
      'marketing'
    ];
    if (!allowed.includes(requested)) return 'general';
    if (requested === 'marketing' && !hasMarketingFeature()) return 'general';
    return requested;
  };

  const [tab, setTab] = useState(getInitialTab);

  const setTabAndUrl = (nextTab: string) => {
    setTab(nextTab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', nextTab);
      return next;
    });
  };

  useEffect(() => {
    const requested = searchParams.get('tab');
    if (!requested) return;
    const next = getInitialTab();
    if (next !== tab) setTab(next);
  }, [searchParams, tab]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      
      {/* Seletor mobile */}
      <div className="sm:hidden">
        <Tabs value={tab} onValueChange={setTabAndUrl} className="w-full">
          <div className="mb-3">
            <select
              className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={tab}
              onChange={(e) => setTabAndUrl(e.target.value)}
            >
              <option value="general">Geral</option>
              <option value="hardware">Impressoras e Balanças</option>
              <option value="menu">Cardápio</option>
              <option value="devices">Dispositivos</option>
              <option value="profile">Perfil</option>
              <option value="notifications">Notificações</option>
              <option value="appearance">Aparência</option>
              <option value="delivery">Delivery</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="fiscal">Fiscal</option>
              <option value="payment-methods">Formas de Pagamento</option>
              <option value="pix">PIX</option>
              <option value="ifood">iFood</option>
              <option value="users">Usuários e Equipe</option>
              {hasMarketingFeature() && (<option value="marketing">Marketing</option>)}
            </select>
          </div>
        </Tabs>
      </div>

      <Tabs value={tab} onValueChange={setTabAndUrl} className="w-full">
        <TabsList className="mb-4 hidden sm:flex flex-wrap justify-start overflow-x-auto scrollbar-hide">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="hardware">Impressoras e Balanças</TabsTrigger>
          <TabsTrigger value="menu">Cardápio</TabsTrigger>
          <TabsTrigger value="devices">Sessões Ativas</TabsTrigger>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal</TabsTrigger>

          <TabsTrigger value="payment-methods">Formas de Pagamento</TabsTrigger>
          <TabsTrigger value="pix">PIX</TabsTrigger>
          <TabsTrigger value="ifood">
            <div className="flex items-center gap-2">
              <IfoodLogo className="h-4 w-auto" />
            </div>
          </TabsTrigger>
          <TabsTrigger value="users">Usuários e Equipe</TabsTrigger>

          {hasMarketingFeature() && (
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WhatsAppSettings />
            {/* Outras configs gerais */}
          </div>
        </TabsContent>

        <TabsContent value="hardware">
          <HardwareSettings />
        </TabsContent>
        
        <TabsContent value="menu">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MenuLinkGenerator />
            <QRCodeGenerator />
          </div>
        </TabsContent>
        
        <TabsContent value="devices">
          <ErrorBoundary fallback={<div className="p-4 text-sm">
            <p className="mb-2">Erro ao carregar Dispositivos. Tente atualizar a página.</p>
            <button
              className="h-9 px-3 rounded-md border"
              onClick={() => {
                try { window.location.reload(); } catch {}
              }}
            >
              Atualizar
            </button>
          </div>}>
            <DeviceManager />
          </ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>
        
        <TabsContent value="notifications">
          <div className="space-y-4">
            <NotificationSettings />
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Ative notificações push para receber alertas mesmo com o app fechado.</p>
              <div className="flex justify-end mt-2">
                <button className="h-9 px-3 rounded-md border" onClick={() => ensureSubscribed()}>Ativar Push</button>
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm">Teste rápido de push</p>
              <div className="flex justify-end mt-2">
                <button
                  className="h-9 px-3 rounded-md border hover:bg-gray-100"
                  onClick={async () => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser()
                      if (!user) {
                         alert('Usuário não logado');
                         return;
                      }
                      
                      const { data: subs, error: subError } = await supabase
                        .from('push_subscriptions' as any)
                        .select('endpoint, keys')
                        .eq('user_id', user.id)
                      
                      if (subError) {
                        alert('Erro ao buscar inscrições: ' + subError.message);
                        return;
                      }

                      if (Array.isArray(subs) && subs.length > 0) {
                        const { data, error } = await supabase.functions.invoke('send-push', {
                          body: {
                            subscriptions: subs,
                            title: 'Teste de Push',
                            body: 'Notificação de teste enviada com sucesso!',
                            url: '/pedidos'
                          }
                        });
                        
                        if (error) {
                          alert('Erro na função: ' + error.message);
                        } else {
                          console.log('Push result:', data);
                          alert('Push enviado! Verifique se recebeu.');
                        }
                      } else {
                        alert('Nenhuma inscrição encontrada. Clique em "Ativar Push" primeiro.');
                      }
                    } catch (e: any) {
                      alert('Erro inesperado: ' + e.message);
                    }
                  }}
                >Enviar teste</button>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
        
        <TabsContent value="delivery">
          <DeliverySettings />
        </TabsContent>
        
        <TabsContent value="whatsapp">
          <WhatsAppIntegration />
        </TabsContent>
        
        <TabsContent value="fiscal">
          <FiscalSettings />
        </TabsContent>

        <TabsContent value="payment-methods">
          <PaymentMethodsSettings />
        </TabsContent>

        <TabsContent value="pix">
          <PixIntegrationSettings />
        </TabsContent>

        <TabsContent value="ifood">
          <IfoodSettings />
        </TabsContent>

        <TabsContent value="users">
          <Garcons />
        </TabsContent>

        {hasMarketingFeature() && (
          <TabsContent value="marketing">
            <MarketingSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Configuracoes;
