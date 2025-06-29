
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

import { AuthProvider, useAuth } from './contexts/AuthContext';
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
              <Route path="/products" element={<RouteGuard><Products /></RouteGuard>} />
              <Route path="/orders" element={<RouteGuard><Orders /></RouteGuard>} />
              <Route path="/kitchen" element={<RouteGuard><Kitchen /></RouteGuard>} />
              <Route path="/pdv" element={<RouteGuard><PDV /></RouteGuard>} />
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
            <Toaster />
          </div>
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
