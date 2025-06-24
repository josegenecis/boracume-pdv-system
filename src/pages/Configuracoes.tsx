
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProfileSettings from '@/components/settings/ProfileSettings';
import DeliverySettings from '@/components/settings/DeliverySettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
import AppearanceSettings from '@/components/settings/AppearanceSettings';
import WhatsAppSettings from '@/components/settings/WhatsAppSettings';
import MenuLinkGenerator from '@/components/menu/MenuLinkGenerator';
import MenuLinkTester from '@/components/menu/MenuLinkTester';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Configuracoes = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie as configurações do seu restaurante
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="delivery">Entrega</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="menu">Cardápio Digital</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="delivery">
            <DeliverySettings />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppSettings />
          </TabsContent>

          <TabsContent value="menu" className="space-y-6">
            <MenuLinkTester />
            <MenuLinkGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Configuracoes;
