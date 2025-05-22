
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
import NotFound from "./pages/NotFound";

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
            
            {/* Placeholders para as demais rotas que serão implementadas */}
            <Route path="/pedidos" element={<div className="p-4">Página de Pedidos - Em desenvolvimento</div>} />
            <Route path="/entregadores" element={<div className="p-4">Página de Entregadores - Em desenvolvimento</div>} />
            <Route path="/financeiro" element={<div className="p-4">Página de Financeiro - Em desenvolvimento</div>} />
            <Route path="/relatorios" element={<div className="p-4">Página de Relatórios - Em desenvolvimento</div>} />
            <Route path="/configuracoes" element={<div className="p-4">Página de Configurações - Em desenvolvimento</div>} />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
