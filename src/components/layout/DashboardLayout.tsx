
import React from 'react';
import DashboardHeader from './DashboardHeader';
import SidebarLinks from './SidebarLinks';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="flex">
        <aside className="w-64 bg-white shadow-md min-h-screen">
          <SidebarLinks />
        </aside>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
