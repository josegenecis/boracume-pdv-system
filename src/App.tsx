import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { Toaster } from '@/components/ui/toaster';
import RouteGuard from '@/components/auth/RouteGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Orders from '@/pages/Orders';
import PDV from '@/pages/PDV';
import MenuDigital from '@/pages/MenuDigital';
import Subscription from '@/pages/Subscription';
import Configuracoes from '@/pages/Configuracoes';
import Mesas from '@/pages/Mesas';
import Kitchen from '@/pages/Kitchen';
import Entregadores from '@/pages/Entregadores';
import BairrosEntrega from '@/pages/BairrosEntrega';
import Loyalty from '@/pages/Loyalty';
import Relatorios from '@/pages/Relatorios';
import Financeiro from '@/pages/Financeiro';
import WhatsAppBot from '@/pages/WhatsAppBot';
import SecurityDashboard from '@/pages/SecurityDashboard';
import NotFound from '@/pages/NotFound';
import Index from '@/pages/Index';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import SupportChat from '@/components/support/SupportChat';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

function AppContent() {
  const { user, profile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && profile && !profile.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user, profile]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    window.location.reload(); // Refresh to load updated profile
  };

  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/menu-digital/:userId" element={<MenuDigital />} />
        
        <Route
          path="/dashboard"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/produtos"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Products />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/pedidos"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Orders />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/pdv"
          element={
            <RouteGuard>
              <DashboardLayout>
                <PDV />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/mesas"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Mesas />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/cozinha"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Kitchen />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/entregadores"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Entregadores />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/bairros-entrega"
          element={
            <RouteGuard>
              <DashboardLayout>
                <BairrosEntrega />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/loyalty"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Loyalty />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/relatorios"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Relatorios />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/financeiro"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Financeiro />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/whatsapp-bot"
          element={
            <RouteGuard>
              <DashboardLayout>
                <WhatsAppBot />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/subscription"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Subscription />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route
          path="/configuracoes"
          element={
            <RouteGuard>
              <DashboardLayout>
                <Configuracoes />
              </DashboardLayout>
            </RouteGuard>
          }
        />

        <Route
          path="/security-dashboard"
          element={
            <RouteGuard>
              <DashboardLayout>
                <SecurityDashboard />
              </DashboardLayout>
            </RouteGuard>
          }
        />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* Support Chat - Show only for authenticated users */}
      {user && <SupportChat />}
      
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <SubscriptionProvider>
            <AppContent />
          </SubscriptionProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
