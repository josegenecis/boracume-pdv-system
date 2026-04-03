
import React from 'react';

import { Bell, User, LogOut, Menu, Wallet, Settings, Package, Layers, CookingPot, BarChart3, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useCashRegister } from '@/contexts/CashRegisterContext';
import { useState, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Logo from '@/components/Logo';
import OperatorSwitcher from '@/components/OperatorSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const FixedHeader = () => {
  const { signOut, user } = useAuth();
  const { isMobile, toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Custom hook ou lógica para pegar o estado do caixa globalmente (se não existir um contexto, podemos usar fetch direto, mas o ideal é mover a lógica do PDV para um context)
  // Como não sabemos se existe um CashRegisterContext, vamos usar um estado local com fetch inicial por enquanto para o header.
  const [cashStatus, setCashStatus] = useState<'open' | 'closed'>('closed');
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Escutar eventos de abertura/fechamento de caixa se disparados via evento customizado
    const handleCashChange = () => {
      // Refresh logic here if needed
    };
    window.addEventListener('cash-session-changed', handleCashChange);
    return () => window.removeEventListener('cash-session-changed', handleCashChange);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const mobileTitle = (() => {
    if (location.pathname.startsWith('/dashboard')) return 'Início';
    if (location.pathname.startsWith('/pedidos')) return 'Pedidos';
    if (location.pathname.startsWith('/produtos')) return 'Cardápio';
    if (location.pathname.startsWith('/marketing')) return 'Clientes';
    if (location.pathname.startsWith('/configuracoes')) return 'Mais';
    return 'BoraCumê';
  })();

  const desktopNavItems = [
    { label: 'Início', path: '/dashboard', active: location.pathname === '/dashboard' },
    { label: 'Pedidos', path: '/pedidos', active: location.pathname === '/pedidos' },
    { label: 'Produtos', path: '/produtos', active: location.pathname === '/produtos' },
    { label: 'Configurações', path: '/configuracoes', active: location.pathname === '/configuracoes' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#FF6400]/10 bg-gradient-to-r from-[#FFF8F2] via-white to-[#F5EBE1]/70 shadow-sm">
      <div className={`flex items-center justify-between ${isMobile ? 'px-4 py-2.5' : 'px-3 py-3 sm:px-6'}`}>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleSidebar}
            className="h-9 w-9 rounded-xl p-0 text-[#003223] hover:bg-[#F5EBE1]"
          >
            <Menu size={18} />
          </Button>
          {isMobile ? (
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FF6400]">BoraCumê</div>
              <div className="truncate text-base font-bold text-[#003223]">{mobileTitle}</div>
            </div>
          ) : (
            <Logo size="md" />
          )}
        </div>

        <div className="hidden md:flex flex-1 px-4 justify-center items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-[#FF6400]/12 bg-white/80 px-2 py-1 shadow-[0_10px_30px_-24px_rgba(0,50,35,0.24)]">
            {desktopNavItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${item.active ? 'bg-[#003223] text-white' : 'text-[#003223]/72 hover:bg-[#F5EBE1] hover:text-[#003223]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden lg:block">
            <OperatorSwitcher />
          </div>
          <Button variant="outline" size="sm" className="hidden h-9 rounded-xl border-[#FF6400]/15 bg-white/85 px-4 font-semibold text-[#003223] hover:bg-[#F5EBE1] md:inline-flex" onClick={() => navigate('/relatorios')}>
            Abrir relatório diário
          </Button>
          <Button size="sm" className="hidden h-9 rounded-xl bg-[#FF6400] px-4 font-semibold text-white hover:bg-[#E85C00] sm:inline-flex" onClick={() => navigate('/pdv')}>
            + Novo pedido
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`h-9 rounded-xl border-[#FF6400]/15 bg-white/85 font-semibold text-[#003223] hover:bg-[#F5EBE1] ${isMobile ? 'w-9 p-0' : 'px-4'}`}>
                {isMobile ? <User size={18} /> : 'Gerencial'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Gerencial</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/financeiro')}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Financeiro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/pdv')}>
                <Wallet className="mr-2 h-4 w-4" />
                Caixa / PDV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/produtos')}>
                <Package className="mr-2 h-4 w-4" />
                Produtos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/produtos?tab=categories')}>
                <Layers className="mr-2 h-4 w-4" />
                Categorias
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/cozinha')}>
                <CookingPot className="mr-2 h-4 w-4" />
                Cozinha (KDS)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-9 w-9 rounded-xl border-[#FF6400]/15 bg-white/85 p-0 text-[#003223] hover:bg-[#F5EBE1]" onClick={() => navigate('/pedidos')}>
            <Bell size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default FixedHeader;
