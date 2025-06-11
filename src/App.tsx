
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import RouteGuard from '@/components/auth/RouteGuard';

// Pages
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Orders from '@/pages/Orders';
import PDV from '@/pages/PDV';
import Kitchen from '@/pages/Kitchen';
import Menu from '@/pages/Menu';
import MenuDigital from '@/pages/MenuDigital';
import MenuDigitalEnhanced from '@/pages/MenuDigitalEnhanced';
import Promocoes from '@/pages/Promocoes';
import WhatsAppBot from '@/pages/WhatsAppBot';
import WhatsAppEnhanced from '@/pages/WhatsAppEnhanced';
import Entregadores from '@/pages/Entregadores';
import BairrosEntrega from '@/pages/BairrosEntrega';
import Mesas from '@/pages/Mesas';
import Loyalty from '@/pages/Loyalty';
import Relatorios from '@/pages/Relatorios';
import Financeiro from '@/pages/Financeiro';
import SecurityDashboard from '@/pages/SecurityDashboard';
import Configuracoes from '@/pages/Configuracoes';
import Subscription from '@/pages/Subscription';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
          <Router>
            <div className="min-h-screen bg-background">
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/menu-digital" element={<MenuDigital />} />
                <Route path="/menu-enhanced" element={<MenuDigitalEnhanced />} />
                
                {/* Protected routes */}
                <Route path="/dashboard" element={
                  <RouteGuard>
                    <Dashboard />
                  </RouteGuard>
                } />
                
                <Route path="/products" element={
                  <RouteGuard>
                    <Products />
                  </RouteGuard>
                } />
                
                <Route path="/orders" element={
                  <RouteGuard>
                    <Orders />
                  </RouteGuard>
                } />
                
                <Route path="/pdv" element={
                  <RouteGuard>
                    <PDV />
                  </RouteGuard>
                } />
                
                <Route path="/kitchen" element={
                  <RouteGuard>
                    <Kitchen />
                  </RouteGuard>
                } />
                
                <Route path="/menu" element={
                  <RouteGuard>
                    <Menu />
                  </RouteGuard>
                } />
                
                <Route path="/promocoes" element={
                  <RouteGuard>
                    <Promocoes />
                  </RouteGuard>
                } />
                
                <Route path="/whatsapp-bot" element={
                  <RouteGuard>
                    <WhatsAppBot />
                  </RouteGuard>
                } />
                
                <Route path="/whatsapp-enhanced" element={
                  <RouteGuard>
                    <WhatsAppEnhanced />
                  </RouteGuard>
                } />
                
                <Route path="/entregadores" element={
                  <RouteGuard>
                    <Entregadores />
                  </RouteGuard>
                } />
                
                <Route path="/bairros-entrega" element={
                  <RouteGuard>
                    <BairrosEntrega />
                  </RouteGuard>
                } />
                
                <Route path="/mesas" element={
                  <RouteGuard>
                    <Mesas />
                  </RouteGuard>
                } />
                
                <Route path="/loyalty" element={
                  <RouteGuard>
                    <Loyalty />
                  </RouteGuard>
                } />
                
                <Route path="/relatorios" element={
                  <RouteGuard>
                    <Relatorios />
                  </RouteGuard>
                } />
                
                <Route path="/financeiro" element={
                  <RouteGuard>
                    <Financeiro />
                  </RouteGuard>
                } />
                
                <Route path="/security-dashboard" element={
                  <RouteGuard>
                    <SecurityDashboard />
                  </RouteGuard>
                } />
                
                <Route path="/configuracoes" element={
                  <RouteGuard>
                    <Configuracoes />
                  </RouteGuard>
                } />
                
                <Route path="/subscription" element={
                  <RouteGuard>
                    <Subscription />
                  </RouteGuard>
                } />
                
                {/* Catch all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              
              <Toaster />
            </div>
          </Router>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
