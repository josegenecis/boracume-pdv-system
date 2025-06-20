
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, Settings, FileText } from 'lucide-react';
import FiscalSettings from '@/components/fiscal/FiscalSettings';
import NFCeManager from '@/components/nfce/NFCeManager';

const NFCe = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Receipt className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">NFC-e - Cupom Fiscal Eletrônico</h1>
        </div>

        <Tabs defaultValue="manager" className="w-full">
          <TabsList>
            <TabsTrigger value="manager" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Gerenciar Cupons
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manager">
            <NFCeManager />
          </TabsContent>
          
          <TabsContent value="settings">
            <FiscalSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default NFCe;
