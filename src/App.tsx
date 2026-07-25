
import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import { OperatorRoute } from '@/components/auth/OperatorRoute';
import { OperatorGate } from '@/components/auth/OperatorGate';
import { PrinterService } from '@/utils/printerService';
import { toast } from 'sonner';

import Index from '@/pages/Index';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import LandingPage from '@/pages/LandingPage';
import LegalPage from '@/pages/LegalPage';
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
import ControlePonto from '@/pages/ControlePonto';
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
import { PopPayCallback } from '@/pages/PopPayCallback';
import AgentDashboard from '@/pages/AgentDashboard';
import WaiterLogin from '@/pages/WaiterLogin';
import EmployeeLogin from '@/pages/EmployeeLogin';
import OperatorLogin from '@/pages/OperatorLogin';
import WaiterDashboard from '@/pages/WaiterDashboard';
import WaiterSession from '@/pages/WaiterSession';
import EmployeeTimeClock from '@/pages/EmployeeTimeClock';
import KDSView from '@/pages/KDSView';
import CustomerView from '@/pages/CustomerView';
import DebugPix from '@/pages/DebugPix';
import ErrorBoundary from '@/components/ErrorBoundary';
import Marketing from '@/pages/Marketing';
import SystemAdminDashboard from '@/pages/SystemAdminDashboard';
import ChecklistPublic from '@/pages/ChecklistPublic';
import MotoboyLogin from '@/pages/MotoboyLogin';
import MotoboyApp from '@/pages/MotoboyApp';
import Stores from '@/pages/Stores';
import StoreInvitation from '@/pages/StoreInvitation';
import PaymentMethodsSettings from '@/components/settings/PaymentMethodsSettings';
import TableOrderFlowSettings from '@/components/settings/TableOrderFlowSettings';
import { useGlobalOrderAutoAccept } from '@/hooks/useGlobalOrderAutoAccept';
import LicenseExpiredLock from '@/components/license/LicenseExpiredLock';
import './App.css';
import './styles/responsive.css';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';

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
      <Route path="/checklist/:token" element={<ChecklistPublic />} />
      <Route path="/menu-digital" element={<MenuDigital />} />
      <Route path="/totem/:userId" element={<Totem />} />
      <Route path="/totem" element={<Totem />} />
      <Route path="/track/:orderId" element={<OrderTracking />} />
      <Route path="/mp/return" element={<MercadoPagoReturn />} />
      <Route path="/mp/callback" element={<MpCallback />} />
      <Route path="/poppay/callback" element={<PopPayCallback />} />
      <Route path="/admin-popsystem" element={<SystemAdminDashboard />} />
      
      {/* Rotas do Garçom */}
      <Route path="/garcom" element={<Navigate to="/waiter-login" replace />} />
      <Route path="/waiter-login" element={<WaiterLogin />} />
      <Route path="/waiter-dashboard" element={<WaiterDashboard />} />
      <Route path="/waiter-session/:sessionId" element={<WaiterSession />} />
      <Route path="/funcionario-login" element={<EmployeeLogin />} />
      <Route path="/funcionario-ponto" element={<EmployeeTimeClock />} />
      <Route path="/motoboy-login" element={<MotoboyLogin />} />
      <Route path="/motoboy-app" element={<MotoboyApp />} />

      {/* Rota de callback OAuth */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Rotas Públicas/Standalone */}
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/termos" element={<LegalPage />} />
      <Route path="/privacidade" element={<LegalPage />} />
      <Route path="/lgpd" element={<LegalPage />} />
      
      {/* KDS e TV Standalone (Sem Menu Lateral) */}
      <Route path="/kds-view" element={
        <RouteGuard>
          <OperatorGate><FeatureRoute feature="kds"><KDSView /></FeatureRoute></OperatorGate>
        </RouteGuard>
      } />
      <Route path="/tv-view" element={
        <RouteGuard>
          <OperatorGate><FeatureRoute feature="kds"><CustomerView /></FeatureRoute></OperatorGate>
        </RouteGuard>
      } />
      
      {/* Rotas que precisam de autenticação */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Navigate to="/login?tab=register" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/lojas/convite" element={<StoreInvitation />} />
      <Route path="/operator-login" element={<RouteGuard><OperatorLogin /></RouteGuard>} />
      
      {/* Rota específica para o aplicativo desktop - sem layout padrão */}
      <Route element={<RouteGuard><OperatorGate><Outlet /></OperatorGate></RouteGuard>}>
        <Route path="/desktop" element={<FeatureRoute feature="desktop"><DesktopApp /></FeatureRoute>} />
      </Route>


      <Route element={<RouteGuard><OperatorGate><Outlet /></OperatorGate></RouteGuard>}>
        <Route element={<DashboardLayout><Outlet /></DashboardLayout>}>
          <Route path="/dashboard" element={<OperatorRoute area="dashboard"><FeatureRoute feature="dashboard"><Dashboard /></FeatureRoute></OperatorRoute>} />
          <Route path="/produtos" element={<OperatorRoute area="products"><FeatureRoute feature="products"><Products /></FeatureRoute></OperatorRoute>} />
          <Route path="/estoque" element={<OperatorRoute area="stock"><FeatureRoute feature="stock"><Ingredientes /></FeatureRoute></OperatorRoute>} />
          <Route path="/inteligencia/cmv" element={<OperatorRoute area="stock"><FeatureRoute feature="cmv"><InteligenciaCMV /></FeatureRoute></OperatorRoute>} />
          <Route path="/inteligencia/curva-abc" element={<OperatorRoute area="stock"><FeatureRoute feature="cmv"><InteligenciaCMV /></FeatureRoute></OperatorRoute>} />
          <Route path="/pedidos" element={<OperatorRoute area="orders"><FeatureRoute feature="orders"><Orders /></FeatureRoute></OperatorRoute>} />
          <Route path="/orders" element={<Navigate to="/pedidos" replace />} />
          <Route path="/cozinha" element={<OperatorRoute area="kds"><FeatureRoute feature="kds"><Kitchen /></FeatureRoute></OperatorRoute>} />
          <Route path="/pdv" element={<OperatorRoute area="pdv"><FeatureRoute feature="pdv"><PDV /></FeatureRoute></OperatorRoute>} />
          <Route path="/mesas" element={<OperatorRoute area="tables"><FeatureRoute feature="tables"><Mesas /></FeatureRoute></OperatorRoute>} />
          <Route path="/mesas/regras" element={<OperatorRoute area="tables"><FeatureRoute feature="tables"><div className="space-y-4"><h1 className="text-2xl font-bold tracking-tight">Regras de Mesa/Comanda</h1><TableOrderFlowSettings /></div></FeatureRoute></OperatorRoute>} />
          <Route path="/relatorios" element={<OperatorRoute area="reports"><FeatureRoute feature="reports"><Relatorios /></FeatureRoute></OperatorRoute>} />
          <Route path="/configuracoes" element={<OperatorRoute area="settings"><FeatureRoute feature="settings"><Configuracoes /></FeatureRoute></OperatorRoute>} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/lojas" element={<FeatureRoute feature="multiStore"><Stores /></FeatureRoute>} />
          <Route path="/multilojas" element={<Navigate to="/lojas" replace />} />
          <Route path="/rede" element={<Navigate to="/lojas" replace />} />
          <Route path="/loyalty" element={<FeatureRoute feature="marketing"><Loyalty /></FeatureRoute>} />
          <Route path="/bairros-entrega" element={<OperatorRoute area="delivery"><FeatureRoute feature="delivery"><BairrosEntrega /></FeatureRoute></OperatorRoute>} />
          <Route path="/entregadores" element={<OperatorRoute area="delivery"><FeatureRoute feature="deliveryTeam"><Entregadores /></FeatureRoute></OperatorRoute>} />
          <Route path="/motoboys" element={<Navigate to="/entregadores" replace />} />
          <Route path="/garcons" element={<OperatorRoute area="team"><FeatureRoute feature="team"><Garcons /></FeatureRoute></OperatorRoute>} />
          <Route path="/ponto" element={<OperatorRoute area="team"><FeatureRoute feature="team"><ControlePonto /></FeatureRoute></OperatorRoute>} />
          <Route path="/nfce" element={<OperatorRoute area="nfce"><FeatureRoute feature="nfce"><NFCe /></FeatureRoute></OperatorRoute>} />
          <Route path="/caixa" element={<OperatorRoute area="finance"><FeatureRoute feature="finance"><Financeiro /></FeatureRoute></OperatorRoute>} />
          <Route path="/financeiro" element={<OperatorRoute area="finance"><FeatureRoute feature="finance"><Financeiro /></FeatureRoute></OperatorRoute>} />
          <Route path="/financeiro/despesas" element={<Navigate to="/despesas" replace />} />
          <Route path="/despesas" element={<OperatorRoute area="finance"><FeatureRoute feature="finance"><Despesas /></FeatureRoute></OperatorRoute>} />
          <Route path="/pagamentos" element={<OperatorRoute area="pix"><FeatureRoute feature="pix"><div className="space-y-4"><h1 className="text-2xl font-bold tracking-tight">Formas de Pagamento</h1><PaymentMethodsSettings /></div></FeatureRoute></OperatorRoute>} />
          <Route path="/security" element={<OperatorRoute area="security"><FeatureRoute feature="security"><SecurityDashboard /></FeatureRoute></OperatorRoute>} />
          <Route path="/whatsapp-bot" element={<OperatorRoute area="marketing"><FeatureRoute feature="whatsapp"><WhatsAppBot /></FeatureRoute></OperatorRoute>} />
          <Route path="/downloads" element={<OperatorRoute area="desktop"><FeatureRoute feature="desktop"><Downloads /></FeatureRoute></OperatorRoute>} />
          <Route path="/pix" element={<OperatorRoute area="pix"><FeatureRoute feature="pix"><PixSetup /></FeatureRoute></OperatorRoute>} />
          {import.meta.env.DEV && <Route path="/debug-pix" element={<DebugPix />} />}
          <Route path="/cardapio" element={<OperatorRoute area="products"><FeatureRoute feature="menu"><Menu /></FeatureRoute></OperatorRoute>} />
          <Route path="/agente" element={<OperatorRoute area="agent"><FeatureRoute feature="agent"><AgentDashboard /></FeatureRoute></OperatorRoute>} />
          <Route path="/marketing" element={<OperatorRoute area="marketing"><FeatureRoute feature="marketing"><Marketing /></FeatureRoute></OperatorRoute>} />

          {import.meta.env.DEV && <Route path="/system-check" element={<SystemCheck />} />}
          {import.meta.env.DEV && <Route path="/test" element={<TestPage />} />}

        </Route>
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Removido helper de permissão de som; habilitar automaticamente

function HardwareAutoConnect() {
  useEffect(() => {
    const api = (window as any)?.electronAPI;
    if (!api?.isElectron || !api?.connectPrinter || !api?.connectScale) return;

    let cancelled = false;
    const connectSavedDevices = async () => {
      try {
        const portsResp = await api.listSerialPorts?.();
        if (cancelled) return;

        const ports = Array.isArray(portsResp?.ports) ? portsResp.ports : [];
        const savedReceiptMode = String(localStorage.getItem('hw.receipt.mode') || 'serial');
        const savedReceiptPort = String(localStorage.getItem('hw.receipt.port') || '').trim();
        const savedReceiptProtocol = String(localStorage.getItem('hw.receipt.protocol') || 'epson').trim() || 'epson';
        const savedScalePort = String(localStorage.getItem('hw.scale.port') || '').trim();
        const savedScaleProtocol = String(localStorage.getItem('hw.scale.protocol') || 'generic').trim() || 'generic';
        const savedScaleBaudRate = Number(localStorage.getItem('hw.scale.baudRate') || '9600') || 9600;

        const recognizedPrinter = ports.find((port: any) => port?.recognizedType === 'printer');
        const recognizedScale = ports.find((port: any) => port?.recognizedType === 'scale');

        const receiptPort = savedReceiptPort || String(recognizedPrinter?.id || recognizedPrinter?.port || '').trim();
        const receiptProtocol = savedReceiptPort ? savedReceiptProtocol : String(recognizedPrinter?.recognizedProtocol || 'epson');
        if (savedReceiptMode === 'serial' && receiptPort) {
          const resp = await api.connectPrinter(receiptPort, receiptProtocol, { protocol: receiptProtocol, width: 48, autoConnect: true });
          if (!cancelled && resp?.success && !savedReceiptPort) {
            localStorage.setItem('hw.receipt.port', receiptPort);
            localStorage.setItem('hw.receipt.protocol', receiptProtocol);
          }
        }

        const scalePort = savedScalePort || String(recognizedScale?.id || recognizedScale?.port || '').trim();
        const scaleProtocol = savedScalePort ? savedScaleProtocol : String(recognizedScale?.recognizedProtocol || 'generic');
        if (scalePort) {
          const resp = await api.connectScale(scalePort, scaleProtocol, { baudRate: savedScaleBaudRate, autoConnect: true });
          if (!cancelled && resp?.success && !savedScalePort) {
            localStorage.setItem('hw.scale.port', scalePort);
            localStorage.setItem('hw.scale.protocol', scaleProtocol);
            localStorage.setItem('hw.scale.baudRate', String(savedScaleBaudRate));
          }
        }
      } catch (error) {
        console.warn('Auto conexão de hardware falhou:', error);
      }
    };

    const timer = window.setTimeout(connectSavedDevices, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}

function CashDrawerShortcut() {
  useEffect(() => {
    const api = (window as any)?.electronAPI;
    if (!api?.isElectron) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(String(target?.tagName || '')) || Boolean(target?.isContentEditable);
      if (isTyping) return;
      if (!(event.ctrlKey && event.altKey && event.key.toLowerCase() === 'g')) return;

      event.preventDefault();
      const result = await PrinterService.openCashDrawer();
      if (result?.success) {
        toast.success('Gaveta aberta');
      } else {
        toast.error(result?.error || 'Não foi possível abrir a gaveta');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}

function GlobalOrderAutoAccept() {
  useGlobalOrderAutoAccept();
  return null;
}

function DesktopOAuthCallbackBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.isElectron || !api.onOAuthCallback) return;

    let active = true;
    const completeOAuth = async (callbackUrl: string) => {
      if (!active || !callbackUrl) return;
      try {
        const url = new URL(callbackUrl);
        const query = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        const errorMessage = query.get('error_description') || query.get('error') || hash.get('error_description') || hash.get('error');
        if (errorMessage) throw new Error(errorMessage);

        const accessToken = hash.get('access_token') || query.get('access_token');
        const refreshToken = hash.get('refresh_token') || query.get('refresh_token');
        const code = query.get('code');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          throw new Error('O provedor não devolveu uma sessão válida.');
        }

        toast.success('Login concluído. Bem-vindo ao PopSystem!');
        navigate('/dashboard', { replace: true });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.');
      }
    };

    const unsubscribe = api.onOAuthCallback((url) => void completeOAuth(url));
    void api.getPendingOAuthCallback?.().then((url) => {
      if (url) void completeOAuth(url);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [navigate]);

  return null;
}

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
                      <HardwareAutoConnect />
                      <DesktopOAuthCallbackBridge />
                      <CashDrawerShortcut />
                      <GlobalOrderAutoAccept />
                      <LicenseExpiredLock />
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
