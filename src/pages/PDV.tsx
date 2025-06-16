
import React, { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PDVForm from '@/components/pdv/PDVForm';
import TableAccountManager from '@/components/pdv/TableAccountManager';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Users } from 'lucide-react';

const PDV = () => {
  const [activeTab, setActiveTab] = useState('pdv');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PDV - Ponto de Venda</h1>
            <p className="text-muted-foreground">
              Sistema de vendas para atendimento no balcão e mesas.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pdv" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Vendas Diretas
            </TabsTrigger>
            <TabsTrigger value="mesas" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contas de Mesa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdv" className="space-y-6">
            <PDVForm />
          </TabsContent>

          <TabsContent value="mesas" className="space-y-6">
            <TableAccountManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PDV;
