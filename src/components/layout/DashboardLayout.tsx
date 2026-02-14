
import React, { useEffect, useState } from 'react';
import FixedHeader from './FixedHeader';
import CollapsibleSidebar from './CollapsibleSidebar';
import SoundPermissionHelper from '@/components/notifications/SoundPermissionHelper';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayoutContent: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { isOpen, isMobile, closeSidebar } = useSidebar();
  const { user, profile, loading, refreshUser } = useAuth();
  const [hasProducts, setHasProducts] = useState<boolean | null>(null);

  useEffect(() => {
    const checkProducts = async () => {
      if (!user) return;
      
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
        
      setHasProducts(count !== null && count > 0);
    };

    checkProducts();
  }, [user]);

  // Se estiver carregando auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Carregando informações...</p>
        </div>
      </div>
    );
  }

  // Verifica se o usuário precisa passar pelo onboarding
  // Mostra se:
  // 1. Perfil não existe
  // 2. OU não tem produtos cadastrados (mesmo que onboarding_completed seja true)
  const showOnboarding = user && (!profile || hasProducts === false);

  const handleOnboardingComplete = () => {
    refreshUser();
    setHasProducts(true); // Assume que o onboarding criou produtos
  };

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden relative">
      {/* Onboarding Overlay */}
      {showOnboarding && (
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
            <div className="w-full max-w-full h-full mobile-safe-x sm:px-6">
              {children}
            </div>
          </div>
        </main>
      </div>
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
