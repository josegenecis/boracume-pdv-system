
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TableManager from '@/components/tables/TableManager';

const Mesas = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
          <p className="text-muted-foreground">
            Gerencie as mesas do seu estabelecimento e controle as contas abertas.
          </p>
        </div>
        
        <TableManager />
      </div>
    </DashboardLayout>
  );
};

export default Mesas;
