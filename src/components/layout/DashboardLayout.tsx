
import React from 'react';
import FixedHeader from './FixedHeader';
import CollapsibleSidebar from './CollapsibleSidebar';
import GlobalNotificationSystem from '@/components/notifications/GlobalNotificationSystem';
import SoundPermissionHelper from '@/components/notifications/SoundPermissionHelper';
<<<<<<< HEAD
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44

interface DashboardLayoutProps {
  children: React.ReactNode;
}

<<<<<<< HEAD
const DashboardLayoutContent: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { isOpen, isMobile, closeSidebar } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50">
      <FixedHeader />
      
      {/* Overlay para mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}
      
      <div className="flex">
        <CollapsibleSidebar />
        <main className={`
          flex-1 pt-16 transition-all duration-300
          ${isMobile 
            ? 'ml-0' 
            : isOpen 
              ? 'ml-64' 
              : 'ml-16'
          }
        `}>
          <div className="p-3 sm:p-4 md:p-6 h-[calc(100vh-64px)] overflow-y-auto">
=======
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <FixedHeader />
      <div className="flex">
        <CollapsibleSidebar />
        <main className="flex-1 ml-64 pt-16 transition-all duration-300">
          <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto">
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
            {children}
          </div>
        </main>
      </div>
      <GlobalNotificationSystem />
      <SoundPermissionHelper />
    </div>
  );
};

<<<<<<< HEAD
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
};

=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
export default DashboardLayout;
