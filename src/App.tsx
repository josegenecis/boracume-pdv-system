
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
import { FeatureGateProvider } from '@/components/subscription/FeatureGateProvider';
import { FeatureRoute } from '@/components/subscription/FeatureRoute';

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
      
      {/* KDS e TV Standalone (Sem Menu Lateral) */}
      <Route path="/kds-view" element={
        <RouteGuard>
          <FeatureRoute feature="kds"><KDSView /></FeatureRoute>
        </RouteGuard>
      } />
      <Route path="/tv-view" element={
        <RouteGuard>
          <FeatureRoute feature="kds"><CustomerView /></FeatureRoute>
        </RouteGuard>
      } />
      
      {/* Rotas que precisam de autenticação */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Rota específica para o aplicativo desktop - sem layout padrão */}
      <Route element={<RouteGuard><Outlet /></RouteGuard>}>
        <Route path="/desktop" element={<FeatureRoute feature="desktop"><DesktopApp /></FeatureRoute>} />
      </Route>


      <Route element={<RouteGuard><Outlet /></RouteGuard>}>
        <Route element={<DashboardLayout><Outlet /></DashboardLayout>}>
          <Route path="/dashboard" element={<FeatureRoute feature="dashboard"><Dashboard /></FeatureRoute>} />
          <Route path="/produtos" element={<FeatureRoute feature="products"><Products /></FeatureRoute>} />
          <Route path="/estoque" element={<FeatureRoute feature="stock"><Ingredientes /></FeatureRoute>} />
          <Route path="/inteligencia/cmv" element={<FeatureRoute feature="cmv"><InteligenciaCMV /></FeatureRoute>} />
          <Route path="/inteligencia/curva-abc" element={<FeatureRoute feature="cmv"><InteligenciaCMV /></FeatureRoute>} />
          <Route path="/pedidos" element={<FeatureRoute feature="orders"><Orders /></FeatureRoute>} />
          <Route path="/orders" element={<Navigate to="/pedidos" replace />} />
          <Route path="/cozinha" element={<FeatureRoute feature="kds"><Kitchen /></FeatureRoute>} />
          <Route path="/pdv" element={<FeatureRoute feature="pdv"><PDV /></FeatureRoute>} />
          <Route path="/mesas" element={<FeatureRoute feature="tables"><Mesas /></FeatureRoute>} />
          <Route path="/relatorios" element={<FeatureRoute feature="reports"><Relatorios /></FeatureRoute>} />
          <Route path="/configuracoes" element={<FeatureRoute feature="settings"><Configuracoes /></FeatureRoute>} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/loyalty" element={<FeatureRoute feature="marketing"><Loyalty /></FeatureRoute>} />
          <Route path="/bairros-entrega" element={<FeatureRoute feature="delivery"><BairrosEntrega /></FeatureRoute>} />
          <Route path="/entregadores" element={<FeatureRoute feature="deliveryTeam"><Entregadores /></FeatureRoute>} />
          <Route path="/motoboys" element={<Navigate to="/entregadores" replace />} />
          <Route path="/garcons" element={<FeatureRoute feature="team"><Garcons /></FeatureRoute>} />
          <Route path="/nfce" element={<FeatureRoute feature="nfce"><NFCe /></FeatureRoute>} />
          <Route path="/caixa" element={<FeatureRoute feature="finance"><Financeiro /></FeatureRoute>} />
          <Route path="/financeiro" element={<FeatureRoute feature="finance"><Financeiro /></FeatureRoute>} />
          <Route path="/financeiro/despesas" element={<Navigate to="/despesas" replace />} />
          <Route path="/despesas" element={<FeatureRoute feature="finance"><Despesas /></FeatureRoute>} />
          <Route path="/security" element={<FeatureRoute feature="security"><SecurityDashboard /></FeatureRoute>} />
          <Route path="/whatsapp-bot" element={<FeatureRoute feature="whatsapp"><WhatsAppBot /></FeatureRoute>} />
          <Route path="/downloads" element={<FeatureRoute feature="desktop"><Downloads /></FeatureRoute>} />
          <Route path="/pix" element={<FeatureRoute feature="pix"><PixSetup /></FeatureRoute>} />
          {import.meta.env.DEV && <Route path="/debug-pix" element={<DebugPix />} />}
          <Route path="/cardapio" element={<FeatureRoute feature="menu"><Menu /></FeatureRoute>} />
          <Route path="/agente" element={<FeatureRoute feature="agent"><AgentDashboard /></FeatureRoute>} />
          <Route path="/marketing" element={<FeatureRoute feature="marketing"><Marketing /></FeatureRoute>} />

          {import.meta.env.DEV && <Route path="/system-check" element={<SystemCheck />} />}
          {import.meta.env.DEV && <Route path="/test" element={<TestPage />} />}

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
                    <FeatureGateProvider>
                      <AppContent />
                      <GlobalNotificationSystem />
                      <SonnerToaster />
                      <ShadcnToaster />
                    </FeatureGateProvider>
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
