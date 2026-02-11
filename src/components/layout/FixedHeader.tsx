
import React from 'react';

import { Bell, User, LogOut, Menu, Wallet, Settings, Package, Layers, CookingPot, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';

import { useNavigate } from 'react-router-dom';
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b">

      <div className="flex items-center justify-between px-3 sm:px-6 py-3">
        <div className="flex items-center space-x-2 sm:space-x-4">
          {isMobile && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleSidebar}
              className="p-2"
            >
              <Menu size={18} />
            </Button>
          )}
          <Logo size="sm" />
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden lg:block">
            <OperatorSwitcher />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-3">
                Gerencial
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
              <DropdownMenuItem onClick={() => navigate('/produtos?tab=categorias')}>
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
          <Button variant="ghost" size="sm" className="p-2" onClick={() => navigate('/financeiro')} title="Caixa">
            <Wallet size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="p-2" onClick={() => navigate('/pedidos')}>
            <Bell size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="p-2" onClick={() => navigate('/configuracoes')}>
            <User size={16} />
            <span className="hidden md:inline truncate max-w-32 ml-2">{user?.email}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="p-2">

            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default FixedHeader;
