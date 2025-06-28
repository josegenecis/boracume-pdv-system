import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from "@/components/theme-provider"
import { useTheme } from 'next-themes'
import { Toaster } from "@/components/ui/toaster"

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PDV from './pages/PDV';
import DigitalMenu from './pages/DigitalMenu';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import RouteGuard from './components/RouteGuard';
import GlobalNotificationSystem from './components/GlobalNotificationSystem';
import OrderTracking from '@/pages/OrderTracking';
import PWAInstallButton from '@/components/pwa/PWAInstallButton';

function App() {
  const queryClient = new QueryClient();
  const { theme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const { checkAuth } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  if (!isMounted) {
    return null;
  }

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

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background font-sans antialiased">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/" element={<RouteGuard><Dashboard /></RouteGuard>} />
            <Route path="/products" element={<RouteGuard><Products /></RouteGuard>} />
            <Route path="/categories" element={<RouteGuard><Categories /></RouteGuard>} />
            <Route path="/orders" element={<RouteGuard><Orders /></RouteGuard>} />
            <Route path="/kitchen" element={<RouteGuard><Kitchen /></RouteGuard>} />
            <Route path="/settings" element={<RouteGuard><Settings /></RouteGuard>} />
            <Route path="/pdv" element={<RouteGuard><PDV /></RouteGuard>} />
            <Route path="/menu" element={<RouteGuard><DigitalMenu /></RouteGuard>} />
            <Route 
              path="/pedido/:orderNumber" 
              element={
                <RouteGuard>
                  <OrderTracking />
                </RouteGuard>
              } 
            />
          </Routes>
          
          <PWAInstallButton />
          <GlobalNotificationSystem />
          <Toaster />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
