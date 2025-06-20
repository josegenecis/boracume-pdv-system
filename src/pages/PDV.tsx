
import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PDVForm from '@/components/pdv/PDVForm';
import TableAccountManager from '@/components/pdv/TableAccountManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Users } from 'lucide-react';

const PDV = () => {
  const [activeTab, setActiveTab] = useState('pdv');

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pdv" className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Vendas Diretas
            </TabsTrigger>
            <TabsTrigger value="mesas" className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contas de Mesa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdv" className="space-y-4">
            <PDVForm />
          </TabsContent>

          <TabsContent value="mesas" className="space-y-4">
            <TableAccountManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PDV;
