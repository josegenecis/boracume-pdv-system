
import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { Toaster as ShadcnToaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { RouteGuard } from '@/components/auth/RouteGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlobalNotificationSystem from '@/components/notifications/GlobalNotificationSystem';
import { soundNotifications } from '@/utils/soundUtils';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialogProvider } from '@/contexts/ConfirmDialogContext';

import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ResetPassword from '@/pages/ResetPassword';
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
import Totem from '@/pages/Totem';
import NotFound from '@/pages/NotFound';
import Loyalty from '@/pages/Loyalty';
import BairrosEntrega from '@/pages/BairrosEntrega';
import Entregadores from '@/pages/Entregadores';
import Garcons from '@/pages/Garcons';
import Ingredientes from '@/pages/Ingredientes';
import InteligenciaCMV from '@/pages/InteligenciaCMV';
import NFCe from '@/pages/NFCe';
import Financeiro from '@/pages/Financeiro';
import Despesas from '@/pages/Despesas';
import SecurityDashboard from '@/pages/SecurityDashboard';
import WhatsAppBot from '@/pages/WhatsAppBot';
import Downloads from '@/pages/Downloads';
import Menu from '@/pages/Menu';
import DesktopApp from '@/pages/DesktopApp';
import PixSetup from '@/pages/PixSetup';
import SystemCheck from '@/pages/SystemCheck';
import TestPage from '@/pages/TestPage';
import AuthCallback from '@/pages/AuthCallback';
import OrderTracking from '@/pages/OrderTracking';
import MercadoPagoReturn from '@/pages/MercadoPagoReturn';
import MpCallback from '@/pages/MpCallback';
import AgentDashboard from '@/pages/AgentDashboard';
import WaiterLogin from '@/pages/WaiterLogin';
import WaiterDashboard from '@/pages/WaiterDashboard';
import WaiterSession from '@/pages/WaiterSession';
import KDSView from '@/pages/KDSView';
import CustomerView from '@/pages/CustomerView';
import DebugPix from '@/pages/DebugPix';
import ErrorBoundary from '@/components/ErrorBoundary';
import Marketing from '@/pages/Marketing';
import './App.css';
import './styles/responsive.css';

const queryClient = new QueryClient();

const Router = (() => {
  try {
    const isElectron = !!(window as any)?.electronAPI?.isElectron;
    if (isElectron) return HashRouter;
    if (window.location.protocol === 'file:') return HashRouter;
    return BrowserRouter;
  } catch {
    return HashRouter;
  }
})();

function AppContent() {
  return (
    <Routes>
      {/* Rotas públicas para o menu digital - aceita ambos os formatos */}
      <Route path="/menu/:userId" element={<MenuDigital />} />
      <Route path="/menu-digital" element={<MenuDigital />} />
      <Route path="/totem/:userId" element={<Totem />} />
      <Route path="/totem" element={<Totem />} />
      <Route path="/track/:orderId" element={<OrderTracking />} />
      <Route path="/mp/return" element={<MercadoPagoReturn />} />
      <Route path="/mp/callback" element={<MpCallback />} />
      
      {/* Rotas do Garçom */}
      <Route path="/waiter-login" element={<WaiterLogin />} />
      <Route path="/waiter-dashboard" element={<WaiterDashboard />} />
      <Route path="/waiter-session/:sessionId" element={<WaiterSession />} />

      {/* Rota de callback OAuth */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Rotas Públicas/Standalone */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/debug-pix" element={<DebugPix />} />
      
      {/* KDS e TV Standalone (Sem Menu Lateral) */}
      <Route path="/kds-view" element={
        <RouteGuard>
          <KDSView />
        </RouteGuard>
      } />
      <Route path="/tv-view" element={
        <RouteGuard>
          <CustomerView />
        </RouteGuard>
      } />
      
      {/* Rotas que precisam de autenticação */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Rota específica para o aplicativo desktop - sem layout padrão */}
      <Route element={<RouteGuard><Outlet /></RouteGuard>}>
        <Route path="/desktop" element={<DesktopApp />} />
      </Route>


      <Route element={<RouteGuard><Outlet /></RouteGuard>}>
        <Route element={<DashboardLayout><Outlet /></DashboardLayout>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/produtos" element={<Products />} />
          <Route path="/estoque" element={<Ingredientes />} />
          <Route path="/inteligencia/cmv" element={<InteligenciaCMV />} />
          <Route path="/inteligencia/curva-abc" element={<InteligenciaCMV />} />
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
          <Route path="/motoboys" element={<Navigate to="/entregadores" replace />} />
          <Route path="/garcons" element={<Garcons />} />
          <Route path="/nfce" element={<NFCe />} />
          <Route path="/caixa" element={<Financeiro />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/financeiro/despesas" element={<Navigate to="/despesas" replace />} />
          <Route path="/despesas" element={<Despesas />} />
          <Route path="/security" element={<SecurityDashboard />} />
          <Route path="/whatsapp-bot" element={<WhatsAppBot />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/pix" element={<PixSetup />} />
          {/* <Route path="/debug-pix" element={<DebugPix />} /> MOVIDO PARA PÚBLICO */}
          <Route path="/cardapio" element={<Menu />} />
          <Route path="/agente" element={<AgentDashboard />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/loyalty" element={<Navigate to="/marketing?tab=loyalty" replace />} />

          <Route path="/system-check" element={<SystemCheck />} />
          <Route path="/test" element={<TestPage />} />

        </Route>
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Removido helper de permissão de som; habilitar automaticamente

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SubscriptionProvider>
            <ThemeProvider defaultTheme="light" storageKey="boracume-ui-theme">
              <ConfirmDialogProvider>
                <Router>
                  <ErrorBoundary>
                    <AppContent />
                    <GlobalNotificationSystem />
                    <SonnerToaster />
                    <ShadcnToaster />
                  </ErrorBoundary>
                </Router>
              </ConfirmDialogProvider>
            </ThemeProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

// DebugPanel removido para não aparecer em produção nem para clientes

export default App;
