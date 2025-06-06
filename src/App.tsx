
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import RouteGuard from "@/components/auth/RouteGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Login from "@/pages/Login";
import Index from "@/pages/Index";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import Kitchen from "@/pages/Kitchen";
import PDV from "@/pages/PDV";
import Configuracoes from "@/pages/Configuracoes";
import BairrosEntrega from "@/pages/BairrosEntrega";
import Entregadores from "@/pages/Entregadores";
import Mesas from "@/pages/Mesas";
import Relatorios from "@/pages/Relatorios";
import Financeiro from "@/pages/Financeiro";
import Menu from "@/pages/Menu";
import MenuDigital from "@/pages/MenuDigital";
import Subscription from "@/pages/Subscription";
import Loyalty from "@/pages/Loyalty";
import WhatsAppBot from "@/pages/WhatsAppBot";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/menu-digital" element={<MenuDigital />} />
              <Route path="/" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Index />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/dashboard" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/products" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Products />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/orders" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Orders />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/kitchen" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Kitchen />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/pdv" element={
                <RouteGuard>
                  <DashboardLayout>
                    <PDV />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/menu" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Menu />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/loyalty" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Loyalty />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/whatsapp-bot" element={
                <RouteGuard>
                  <DashboardLayout>
                    <WhatsAppBot />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/configuracoes" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Configuracoes />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/bairros-entrega" element={
                <RouteGuard>
                  <DashboardLayout>
                    <BairrosEntrega />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/entregadores" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Entregadores />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/mesas" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Mesas />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/relatorios" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Relatorios />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/financeiro" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Financeiro />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="/subscription" element={
                <RouteGuard>
                  <DashboardLayout>
                    <Subscription />
                  </DashboardLayout>
                </RouteGuard>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SubscriptionProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
