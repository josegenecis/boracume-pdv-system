
import React from 'react';
import FixedHeader from './FixedHeader';
import CollapsibleSidebar from './CollapsibleSidebar';
import GlobalNotificationSystem from '@/components/notifications/GlobalNotificationSystem';
import SoundPermissionHelper from '@/components/notifications/SoundPermissionHelper';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <FixedHeader />
      <div className="flex">
        <CollapsibleSidebar />
        <main className="flex-1 ml-64 pt-16 transition-all duration-300">
          <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
      <GlobalNotificationSystem />
      <SoundPermissionHelper />
    </div>
  );
};

export default DashboardLayout;
