
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingSettings from '@/components/marketing/MarketingSettings';
import ProfileSettings from '@/components/settings/ProfileSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import WhatsAppSettings from '@/components/settings/WhatsAppSettings';
import ScaleIntegrationSettings from '@/components/settings/ScaleIntegrationSettings';
import DeliverySettings from '@/components/settings/DeliverySettings';
import QRCodeGenerator from '@/components/products/QRCodeGenerator';
import MenuLinkGenerator from '@/components/menu/MenuLinkGenerator';
import DeviceManager from '@/components/devices/DeviceManager';
import WhatsAppIntegration from '@/components/whatsapp/WhatsAppIntegration';
import FiscalSettings from '@/components/fiscal/FiscalSettings';
import { useAuth } from '@/contexts/AuthContext';

import PaymentMethodsSettings from '@/components/settings/PaymentMethodsSettings';
import PixIntegrationSettings from '@/components/payment/PixIntegrationSettings';


const Configuracoes: React.FC = () => {
  const { subscription } = useAuth();
  
  const hasMarketingFeature = () => {
    if (subscription?.status === 'trial') {
      return true;
    }
    
    if (subscription?.status === 'active' && subscription?.plan_id === 2) {
      return true;
    }
    
    return false;
  };

  const [tab, setTab] = useState('general');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      
      {/* Seletor mobile */}
      <div className="sm:hidden">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="mb-3">
            <select
              className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
            >
              <option value="general">Geral</option>
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
              {hasMarketingFeature() && (<option value="marketing">Marketing</option>)}
            </select>
          </div>
        </Tabs>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4 hidden sm:flex flex-wrap justify-start overflow-x-auto scrollbar-hide">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="menu">Cardápio</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal</TabsTrigger>

          <TabsTrigger value="payment-methods">Formas de Pagamento</TabsTrigger>
          <TabsTrigger value="pix">PIX</TabsTrigger>

          {hasMarketingFeature() && (
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WhatsAppSettings />
            <ScaleIntegrationSettings />
          </div>
        </TabsContent>
        
        <TabsContent value="menu">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MenuLinkGenerator />
            <QRCodeGenerator />
          </div>
        </TabsContent>
        
        <TabsContent value="devices">
          <DeviceManager />
        </TabsContent>
        
        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>
        
        <TabsContent value="notifications">
          <NotificationSettings />
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
