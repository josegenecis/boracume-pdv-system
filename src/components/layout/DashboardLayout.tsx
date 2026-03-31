import React, { useEffect, useState } from 'react';
import FixedHeader from './FixedHeader';
import CollapsibleSidebar from './CollapsibleSidebar';
import SoundPermissionHelper from '@/components/notifications/SoundPermissionHelper';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import SupportFab from '@/components/support/SupportFab';
import { SupportChatProvider } from '@/contexts/SupportChatContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayoutContent: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { isOpen, isMobile, closeSidebar } = useSidebar();
  const { user, loading, refreshUser } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkOnboardingStatus = async () => {
      if (!user) {
        if (mounted) setChecking(false);
        return;
      }
      
      try {
        // Verifica produtos e status do perfil em paralelo
        const [productsResult, profileResult] = await Promise.all([
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('profiles').select('onboarding_completed').eq('id', user.id).maybeSingle()
        ]);
        
        if (!mounted) return;

        const hasProducts = (productsResult.count || 0) > 0;
        const isCompleted = profileResult.data?.onboarding_completed === true;
        
        // Se tem produtos OU marcou como completado, não mostra wizard
        if (hasProducts || isCompleted) {
          setShowWizard(false);
        } else {
          setShowWizard(true);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    if (!loading) {
      checkOnboardingStatus();
    }

    return () => {
      mounted = false;
    };
  }, [user, loading]);

  const handleOnboardingComplete = () => {
    refreshUser();
    setShowWizard(false);
  };

  // Se estiver carregando auth ou verificando status
  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-emerald-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-boracume-orange mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50 w-full overflow-x-hidden relative">
      {/* Onboarding Overlay */}
      {showWizard && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}

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
          <div className="h-[calc(100vh-64px)] w-full">
            <div className="w-full max-w-full h-full mobile-safe-x px-4 py-4 sm:px-6 sm:py-6">
              {children}
            </div>
          </div>
        </main>
      </div>
      <SoundPermissionHelper />
      <SupportChatProvider>
        <SupportFab />
      </SupportChatProvider>
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
