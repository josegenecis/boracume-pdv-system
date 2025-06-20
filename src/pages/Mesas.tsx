
import React from 'react';
import TableManager from '@/components/tables/TableManager';
import DashboardLayout from '@/components/layout/DashboardLayout';

const Mesas = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TableManager />
      </div>
    </DashboardLayout>
  );
};

export default Mesas;
