
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import RouteGuard from "./components/auth/RouteGuard";
import DashboardLayout from "./components/layout/DashboardLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import PDV from "./pages/PDV";
import Kitchen from "./pages/Kitchen";
import MenuDigital from "./pages/MenuDigital";
import Menu from "./pages/Menu";
import Entregadores from "./pages/Entregadores";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Subscription from "./pages/Subscription";
import Mesas from "./pages/Mesas";
import BairrosEntrega from "./pages/BairrosEntrega";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/menu" element={<MenuDigital />} />
                <Route path="/menu/:restaurantId" element={<MenuDigital />} />
                <Route path="/cardapio" element={<Menu />} />
                
                {/* Protected Routes with DashboardLayout */}
                <Route 
                  path="/dashboard" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Dashboard />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/pedidos" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Orders />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/produtos" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Products />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/pdv" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <PDV />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/cozinha" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Kitchen />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/mesas" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Mesas />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/bairros-entrega" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <BairrosEntrega />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/entregadores" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Entregadores />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/financeiro" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Financeiro />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/relatorios" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Relatorios />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/configuracoes" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Configuracoes />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                <Route 
                  path="/assinatura" 
                  element={
                    <RouteGuard>
                      <DashboardLayout>
                        <Subscription />
                      </DashboardLayout>
                    </RouteGuard>
                  } 
                />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
