
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Kitchen from "./pages/Kitchen";
import Products from "./pages/Products";
import Entregadores from "./pages/Entregadores";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import WhatsAppButton from "./components/chat/WhatsAppButton";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          
          {/* Rotas protegidas dentro do layout de dashboard */}
          <Route path="/" element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cozinha" element={<Kitchen />} />
            <Route path="/produtos" element={<Products />} />
            <Route path="/entregadores" element={<Entregadores />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            
            {/* Placeholder para outras rotas em desenvolvimento */}
            <Route path="/pedidos" element={<div className="p-4">Página de Pedidos - Em desenvolvimento</div>} />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
        
        {/* WhatsApp Button for global access */}
        <WhatsAppButton 
          phoneNumber="5511999999999" 
          message="Olá! Estou com uma dúvida sobre o BoraCumê." 
        />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
