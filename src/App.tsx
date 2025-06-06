
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/login" element={
                <RouteGuard requireAuth={false}>
                  <Login />
                </RouteGuard>
              } />
              <Route path="/menu-digital" element={<MenuDigital />} />
              
              {/* Routes that use DashboardLayout */}
              <Route path="/" element={
                <RouteGuard>
                  <DashboardLayout />
                </RouteGuard>
              }>
                <Route index element={<Index />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="produtos" element={<Products />} />
                <Route path="orders" element={<Orders />} />
                <Route path="kitchen" element={<Kitchen />} />
                <Route path="cozinha" element={<Kitchen />} />
                <Route path="pdv" element={<PDV />} />
                <Route path="menu" element={<Menu />} />
                <Route path="cardapio" element={<Menu />} />
                <Route path="loyalty" element={<Loyalty />} />
                <Route path="whatsapp-bot" element={<WhatsAppBot />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="bairros-entrega" element={<BairrosEntrega />} />
                <Route path="entregadores" element={<Entregadores />} />
                <Route path="mesas" element={<Mesas />} />
                <Route path="relatorios" element={<Relatorios />} />
                <Route path="financeiro" element={<Financeiro />} />
                <Route path="subscription" element={<Subscription />} />
                <Route path="assinatura" element={<Subscription />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
