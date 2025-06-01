
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
                  path="/*" 
                  element={
                    <RouteGuard>
                      <DashboardLayout />
                    </RouteGuard>
                  }
                >
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="pedidos" element={<Orders />} />
                  <Route path="produtos" element={<Products />} />
                  <Route path="pdv" element={<PDV />} />
                  <Route path="cozinha" element={<Kitchen />} />
                  <Route path="mesas" element={<Mesas />} />
                  <Route path="bairros-entrega" element={<BairrosEntrega />} />
                  <Route path="entregadores" element={<Entregadores />} />
                  <Route path="financeiro" element={<Financeiro />} />
                  <Route path="relatorios" element={<Relatorios />} />
                  <Route path="configuracoes" element={<Configuracoes />} />
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
}

export default App;
