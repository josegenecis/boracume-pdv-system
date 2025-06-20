
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LoyaltyManager from '@/components/loyalty/LoyaltyManager';

const Loyalty = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <LoyaltyManager />
      </div>
    </DashboardLayout>
  );
};

export default Loyalty;
