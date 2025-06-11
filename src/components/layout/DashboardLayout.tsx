
import React from 'react';
import FixedHeader from './FixedHeader';
import CollapsibleSidebar from './CollapsibleSidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <FixedHeader />
      <div className="flex pt-16">
        <CollapsibleSidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
