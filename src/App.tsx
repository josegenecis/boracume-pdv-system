
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import RouteGuard from "./components/auth/RouteGuard";
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
                
                {/* Protected Routes */}
                <Route path="/dashboard" element={<RouteGuard><Dashboard /></RouteGuard>} />
                <Route path="/pedidos" element={<RouteGuard><Orders /></RouteGuard>} />
                <Route path="/produtos" element={<RouteGuard><Products /></RouteGuard>} />
                <Route path="/pdv" element={<RouteGuard><PDV /></RouteGuard>} />
                <Route path="/cozinha" element={<RouteGuard><Kitchen /></RouteGuard>} />
                <Route path="/mesas" element={<RouteGuard><Mesas /></RouteGuard>} />
                <Route path="/bairros-entrega" element={<RouteGuard><BairrosEntrega /></RouteGuard>} />
                <Route path="/entregadores" element={<RouteGuard><Entregadores /></RouteGuard>} />
                <Route path="/financeiro" element={<RouteGuard><Financeiro /></RouteGuard>} />
                <Route path="/relatorios" element={<RouteGuard><Relatorios /></RouteGuard>} />
                <Route path="/configuracoes" element={<RouteGuard><Configuracoes /></RouteGuard>} />
                <Route path="/assinatura" element={<RouteGuard><Subscription /></RouteGuard>} />
                
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
