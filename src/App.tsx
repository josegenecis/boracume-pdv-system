
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "@/components/ui/toaster"

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Login from './pages/Login';
import PDV from './pages/PDV';
import MenuDigital from './pages/MenuDigital';
import Configuracoes from './pages/Configuracoes';
import Mesas from './pages/Mesas';
import Relatorios from './pages/Relatorios';
import Downloads from './pages/Downloads';
import Entregadores from './pages/Entregadores';
import BairrosEntrega from './pages/BairrosEntrega';
import Loyalty from './pages/Loyalty';
import Financeiro from './pages/Financeiro';
import WhatsAppBot from './pages/WhatsAppBot';
import Subscription from './pages/Subscription';
import SecurityDashboard from './pages/SecurityDashboard';
import NFCe from './pages/NFCe';
import NotFound from './pages/NotFound';

import { AuthProvider } from './contexts/AuthContext';
import RouteGuard from './components/auth/RouteGuard';
import OrderTracking from '@/pages/OrderTracking';
import PWAInstallButton from '@/components/pwa/PWAInstallButton';

function App() {
  const queryClient = new QueryClient();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW registered: ', registration);
          })
          .catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
          });
      });
    }
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-background font-sans antialiased">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<RouteGuard><Dashboard /></RouteGuard>} />
              <Route path="/dashboard" element={<RouteGuard><Dashboard /></RouteGuard>} />
              <Route path="/produtos" element={<RouteGuard><Products /></RouteGuard>} />
              <Route path="/products" element={<RouteGuard><Products /></RouteGuard>} />
              <Route path="/pedidos" element={<RouteGuard><Orders /></RouteGuard>} />
              <Route path="/orders" element={<RouteGuard><Orders /></RouteGuard>} />
              <Route path="/cozinha" element={<RouteGuard><Kitchen /></RouteGuard>} />
              <Route path="/kitchen" element={<RouteGuard><Kitchen /></RouteGuard>} />
              <Route path="/pdv" element={<RouteGuard><PDV /></RouteGuard>} />
              <Route path="/mesas" element={<RouteGuard><Mesas /></RouteGuard>} />
              <Route path="/configuracoes" element={<RouteGuard><Configuracoes /></RouteGuard>} />
              <Route path="/relatorios" element={<RouteGuard><Relatorios /></RouteGuard>} />
              <Route path="/downloads" element={<RouteGuard><Downloads /></RouteGuard>} />
              <Route path="/entregadores" element={<RouteGuard><Entregadores /></RouteGuard>} />
              <Route path="/bairros-entrega" element={<RouteGuard><BairrosEntrega /></RouteGuard>} />
              <Route path="/loyalty" element={<RouteGuard><Loyalty /></RouteGuard>} />
              <Route path="/financeiro" element={<RouteGuard><Financeiro /></RouteGuard>} />
              <Route path="/whatsapp-bot" element={<RouteGuard><WhatsAppBot /></RouteGuard>} />
              <Route path="/subscription" element={<RouteGuard><Subscription /></RouteGuard>} />
              <Route path="/security" element={<RouteGuard><SecurityDashboard /></RouteGuard>} />
              <Route path="/nfce" element={<RouteGuard><NFCe /></RouteGuard>} />
              <Route path="/menu-digital" element={<MenuDigital />} />
              <Route path="/cardapio/:userId" element={<MenuDigital />} />
              <Route 
                path="/pedido/:orderNumber" 
                element={
                  <RouteGuard>
                    <OrderTracking />
                  </RouteGuard>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            
            <PWAInstallButton />
            <Toaster />
          </div>
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
