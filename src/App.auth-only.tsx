import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
// import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import RouteGuard from '@/components/auth/RouteGuard';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GlobalNotificationSystem from '@/components/notifications/GlobalNotificationSystem';
import SoundPermissionHelper from '@/components/notifications/SoundPermissionHelper';

import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Dashboard from '@/pages/Dashboard';
import TestPage from '@/pages/TestPage';
import NotFound from '@/pages/NotFound';
import './App.css';
import './styles/responsive.css';

const queryClient = new QueryClient();

function AppContent() {
  return (
    <Routes>
      {/* Rotas que precisam de autenticação */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      <Route element={<RouteGuard><Outlet /></RouteGuard>}>
        <Route element={<DashboardLayout><Outlet /></DashboardLayout>}>
          <Route path="/dashboard" element={<Dashboard />} />
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

function AuthOnlyApp() {
  useEffect(() => {
    console.log('AuthOnlyApp loaded successfully');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          {/* <SubscriptionProvider> */}
            <AppContent />
            <GlobalNotificationSystem />
            <SoundPermissionManager />
            <Toaster />
          {/* </SubscriptionProvider> */}
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default AuthOnlyApp;