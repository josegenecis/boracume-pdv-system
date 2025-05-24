
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingSettings from '@/components/marketing/MarketingSettings';
import ProfileSettings from '@/components/settings/ProfileSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import WhatsAppSettings from '@/components/settings/WhatsAppSettings';
import ScaleIntegrationSettings from '@/components/settings/ScaleIntegrationSettings';
import QRCodeGenerator from '@/components/products/QRCodeGenerator';
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
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
          <TabsTrigger value="qrcode">QR Code</TabsTrigger>
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
        
        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>
        
        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>
        
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
        
        <TabsContent value="qrcode">
          <QRCodeGenerator />
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
