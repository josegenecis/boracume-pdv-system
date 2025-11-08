
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { RouteGuard } from '@/components/auth/RouteGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlobalNotificationSystem from '@/components/notifications/GlobalNotificationSystem';
import SoundPermissionHelper from '@/components/notifications/SoundPermissionHelper';
import DebugPanel from '@/components/debug/DebugPanel';

import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import LandingPage from '@/pages/LandingPage';
import Dashboard from '@/pages/Dashboard';
import DashboardSimple from '@/pages/DashboardSimple';
import Products from '@/pages/Products';
import Orders from '@/pages/Orders';
import Kitchen from '@/pages/Kitchen';
import PDV from '@/pages/PDV';
import Mesas from '@/pages/Mesas';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes';
import Subscription from '@/pages/Subscription';
import MenuDigital from '@/pages/MenuDigital';
import NotFound from '@/pages/NotFound';
import Loyalty from '@/pages/Loyalty';
import BairrosEntrega from '@/pages/BairrosEntrega';
import Entregadores from '@/pages/Entregadores';
import NFCe from '@/pages/NFCe';
import Financeiro from '@/pages/Financeiro';
import SecurityDashboard from '@/pages/SecurityDashboard';
import WhatsAppBot from '@/pages/WhatsAppBot';
import Downloads from '@/pages/Downloads';
import Menu from '@/pages/Menu';
import DesktopApp from '@/pages/DesktopApp';
import { HardwareTestPage } from '@/pages/HardwareTestPage';
import TestPage from '@/pages/TestPage';
import AuthCallback from '@/pages/AuthCallback';
import './App.css';
import './styles/responsive.css';

const queryClient = new QueryClient();

function AppContent() {
  return (
    <Routes>
      {/* Rotas públicas para o menu digital - aceita ambos os formatos */}
      <Route path="/menu/:userId" element={<MenuDigital />} />
      <Route path="/menu-digital" element={<MenuDigital />} />
      

      {/* Rota de callback OAuth */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Landing Page - Rota pública */}
      <Route path="/landing" element={<LandingPage />} />
      
      {/* Rotas que precisam de autenticação */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Rota específica para o aplicativo desktop - sem layout padrão */}
      <Route element={<RouteGuard><Outlet /></RouteGuard>}>
        <Route path="/desktop" element={<DesktopApp />} />
      </Route>


      <Route element={<RouteGuard><Outlet /></RouteGuard>}>
        <Route element={<DashboardLayout><Outlet /></DashboardLayout>}>
          <Route path="/dashboard" element={<DashboardSimple />} />
          <Route path="/dashboard-full" element={<Dashboard />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/pedidos" element={<Orders />} />
          <Route path="/orders" element={<Navigate to="/pedidos" replace />} />
          <Route path="/cozinha" element={<Kitchen />} />
          <Route path="/pdv" element={<PDV />} />
          <Route path="/mesas" element={<Mesas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/loyalty" element={<Loyalty />} />
          <Route path="/bairros-entrega" element={<BairrosEntrega />} />
          <Route path="/entregadores" element={<Entregadores />} />
          <Route path="/nfce" element={<NFCe />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/security" element={<SecurityDashboard />} />
          <Route path="/whatsapp-bot" element={<WhatsAppBot />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/cardapio" element={<Menu />} />

          <Route path="/hardware-test" element={<HardwareTestPage />} />
          <Route path="/test" element={<TestPage />} />

        </Route>
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const SoundPermissionManager = () => {
  const location = useLocation();
  const isDigitalMenu = location.pathname.includes('/menu');
  
  // Não mostrar no cardápio digital
  if (isDigitalMenu) return null;
  
  return <SoundPermissionHelper />;
};

function App() {
  useEffect(() => {
    // Temporarily disable service worker to avoid conflicts
    // Will re-enable after fixing core loading issues
    console.log('App loaded successfully');
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SubscriptionProvider>
            <ThemeProvider defaultTheme="light" storageKey="boracume-ui-theme">
              <Router>
                <AppContent />
                <GlobalNotificationSystem />
                <SoundPermissionManager />
                <DebugPanel />
                <Toaster />
              </Router>
            </ThemeProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
