
import React from 'react';
import FixedHeader from './FixedHeader';
import CollapsibleSidebar from './CollapsibleSidebar';
import GlobalNotificationSystem from '@/components/notifications/GlobalNotificationSystem';
import SoundPermissionHelper from '@/components/notifications/SoundPermissionHelper';

import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';


interface DashboardLayoutProps {
  children: React.ReactNode;
}


const DashboardLayoutContent: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { isOpen, isMobile, closeSidebar } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      <FixedHeader />
      
      {/* Overlay para mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}
      
      <div className="flex w-full">
        <CollapsibleSidebar />
        <main className={`
          flex-1 pt-16 transition-all duration-300 min-w-0 w-full
          ${isMobile 
            ? 'ml-0' 
            : isOpen 
              ? 'ml-64' 
              : 'ml-16'
          }
        `}>
          <div className="p-3 sm:p-4 md:p-6 h-[calc(100vh-64px)] overflow-y-auto w-full">
            <div className="w-full max-w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
      <GlobalNotificationSystem />
      <SoundPermissionHelper />
    </div>
  );
};


const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
};


export default DashboardLayout;
