
import React from 'react';
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-4 flex flex-wrap justify-start overflow-x-auto scrollbar-hide">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="menu">Cardápio</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
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
