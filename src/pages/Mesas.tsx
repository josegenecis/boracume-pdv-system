
import React from 'react';
import TableManager from '@/components/tables/TableManager';
import DashboardLayout from '@/components/layout/DashboardLayout';

const Mesas = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Mesas</h1>
        </div>
        
        <TableManager />
      </div>
    </DashboardLayout>
  );
};

export default Mesas;
