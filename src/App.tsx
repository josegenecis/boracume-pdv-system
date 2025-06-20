
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import RouteGuard from '@/components/auth/RouteGuard';
import GlobalNotificationSystem from '@/components/notifications/GlobalNotificationSystem';

// Pages
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import Products from '@/pages/Products';
import Kitchen from '@/pages/Kitchen';
import Configuracoes from '@/pages/Configuracoes';
import DigitalMenu from '@/pages/DigitalMenu'; // Nova importação
import Mesas from '@/pages/Mesas';
import PDV from '@/pages/PDV';
import Financeiro from '@/pages/Financeiro';
import Relatorios from '@/pages/Relatorios';
import BairrosEntrega from '@/pages/BairrosEntrega';
import Entregadores from '@/pages/Entregadores';
import Loyalty from '@/pages/Loyalty';
import WhatsAppBot from '@/pages/WhatsAppBot';
import NFCe from '@/pages/NFCe';
import SecurityDashboard from '@/pages/SecurityDashboard';
import Subscription from '@/pages/Subscription';
import Downloads from '@/pages/Downloads';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SubscriptionProvider>
          <div className="min-h-screen bg-background">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              
              {/* Cardápio Digital - Nova Rota */}
              <Route path="/cardapio/:userId" element={<DigitalMenu />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <RouteGuard>
                  <Dashboard />
                </RouteGuard>
              } />
              <Route path="/pedidos" element={
                <RouteGuard>
                  <Orders />
                </RouteGuard>
              } />
              <Route path="/produtos" element={
                <RouteGuard>
                  <Products />
                </RouteGuard>
              } />
              <Route path="/cozinha" element={
                <RouteGuard>
                  <Kitchen />
                </RouteGuard>
              } />
              <Route path="/configuracoes" element={
                <RouteGuard>
                  <Configuracoes />
                </RouteGuard>
              } />
              <Route path="/mesas" element={
                <RouteGuard>
                  <Mesas />
                </RouteGuard>
              } />
              <Route path="/pdv" element={
                <RouteGuard>
                  <PDV />
                </RouteGuard>
              } />
              <Route path="/financeiro" element={
                <RouteGuard>
                  <Financeiro />
                </RouteGuard>
              } />
              <Route path="/relatorios" element={
                <RouteGuard>
                  <Relatorios />
                </RouteGuard>
              } />
              <Route path="/bairros-entrega" element={
                <RouteGuard>
                  <BairrosEntrega />
                </RouteGuard>
              } />
              <Route path="/entregadores" element={
                <RouteGuard>
                  <Entregadores />
                </RouteGuard>
              } />
              <Route path="/loyalty" element={
                <RouteGuard>
                  <Loyalty />
                </RouteGuard>
              } />
              <Route path="/whatsapp-bot" element={
                <RouteGuard>
                  <WhatsAppBot />
                </RouteGuard>
              } />
              <Route path="/nfce" element={
                <RouteGuard>
                  <NFCe />
                </RouteGuard>
              } />
              <Route path="/security" element={
                <RouteGuard>
                  <SecurityDashboard />
                </RouteGuard>
              } />
              <Route path="/subscription" element={
                <RouteGuard>
                  <Subscription />
                </RouteGuard>
              } />
              <Route path="/downloads" element={
                <RouteGuard>
                  <Downloads />
                </RouteGuard>
              } />
              
              {/* 404 page */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <GlobalNotificationSystem />
          <Toaster />
        </SubscriptionProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
