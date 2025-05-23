
import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Bell, Settings, ShoppingCart, Package, CreditCard, 
  FileText, Users, LogOut, Menu, Home, Clock
} from 'lucide-react';
import { 
  Sheet, SheetContent, SheetTrigger 
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Logo from '@/components/Logo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import SidebarLinks from './SidebarLinks';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  href: string;
}

const NavItem: React.FC<NavItemProps> = ({ 
  icon, label, active = false, href 
}) => {
  const location = useLocation();
  const isActive = location.pathname === href;
  
  return (
    <Link 
      to={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
        isActive 
          ? 'bg-boracume-orange text-white' 
          : 'hover:bg-boracume-orange/10 text-gray-700'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { 
        size: 20,
        className: isActive ? 'text-white' : 'text-boracume-orange'
      })}
      <span>{label}</span>
    </Link>
  );
};

const Sidebar: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col h-full bg-white border-r ${className}`}>
      <div className="p-4">
        <Logo />
      </div>
      
      <div className="px-2 pt-4 flex-1 overflow-y-auto">
        <SidebarLinks />
      </div>
      
      <div className="mt-auto p-4">
        <Separator className="mb-4" />
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Avatar className="h-8 w-8 mr-2">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>RS</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">Restaurante Silva</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <LogOut size={18} className="text-gray-500" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const TopBar: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get page title based on current path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Painel de Controle';
    if (path === '/cozinha') return 'KDS (Cozinha)';
    if (path === '/produtos') return 'Produtos';
    if (path === '/pedidos') return 'Pedidos';
    if (path === '/entregadores') return 'Entregadores';
    if (path === '/financeiro') return 'Financeiro';
    if (path === '/relatorios') return 'Relatórios';
    if (path === '/configuracoes') return 'Configurações';
    if (path === '/assinatura') return 'Assinatura';
    return 'BoraCumê';
  };
  
  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };
  
  return (
    <header className="border-b bg-white h-16 px-4 flex items-center justify-between">
      <div className="flex items-center md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <Logo variant="icon" className="ml-2" />
      </div>
      
      <div className="md:flex items-center gap-4 hidden">
        <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </Button>
        
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut size={20} />
        </Button>
        
        <Avatar className="h-8 w-8">
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>RS</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
};

const DashboardLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  
  // Effect to handle page loading
  useEffect(() => {
    // Set loading to true when route changes
    setIsLoading(true);
    
    // Set loading to false after a small delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [location.pathname]);
  
  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && (
        <aside className="w-64 hidden md:block">
          <Sidebar className="w-64" />
        </aside>
      )}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <main className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-boracume-orange"></div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
