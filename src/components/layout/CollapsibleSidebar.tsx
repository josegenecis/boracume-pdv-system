
<<<<<<< HEAD
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/SidebarContext';
=======
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
import { 
  LayoutDashboard, 
  ShoppingBag, 
  FileText, 
  Settings, 
  Users, 
  MapPin, 
  CreditCard,
  BarChart3,
  MessageCircle,
  ChefHat,
  Utensils,
  Crown,
  ChevronLeft,
  ChevronRight,
<<<<<<< HEAD
  Download,
  X
} from 'lucide-react';

const CollapsibleSidebar = () => {
  const { isOpen, isMobile, toggleSidebar, closeSidebar } = useSidebar();
=======
  Download
} from 'lucide-react';

const CollapsibleSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
  const location = useLocation();

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/produtos', icon: ShoppingBag, label: 'Produtos' },
    { to: '/pedidos', icon: FileText, label: 'Pedidos' },
    { to: '/pdv', icon: CreditCard, label: 'PDV (Ponto de Venda)' },
    { to: '/mesas', icon: Utensils, label: 'Mesas' },
    { to: '/cozinha', icon: ChefHat, label: 'Cozinha (KDS)' },
    { to: '/entregadores', icon: Users, label: 'Entregadores' },
    { to: '/bairros-entrega', icon: MapPin, label: 'Bairros de Entrega' },
    { to: '/loyalty', icon: Crown, label: 'Programa de Fidelidade' },
    { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
    { to: '/financeiro', icon: CreditCard, label: 'Financeiro' },
    { to: '/whatsapp-bot', icon: MessageCircle, label: 'WhatsApp Bot' },
    { to: '/downloads', icon: Download, label: 'App Desktop' },
    { to: '/configuracoes', icon: Settings, label: 'Configurações' },
    { to: '/subscription', icon: Crown, label: 'Planos' },
  ];

<<<<<<< HEAD
  const handleLinkClick = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  return (
    <aside className={`
      bg-white shadow-md h-screen fixed left-0 top-16 z-50 transition-all duration-300
      ${isMobile 
        ? `${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64` 
        : `${isOpen ? 'w-64' : 'w-16'}`
      }
    `}>
=======
  return (
    <aside className={`bg-white shadow-md h-screen fixed left-0 top-16 z-30 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
      <div className="p-2 border-b">
        <Button
          variant="ghost"
          size="sm"
<<<<<<< HEAD
          onClick={toggleSidebar}
          className="w-full flex justify-center hover:bg-gray-50 text-gray-400 hover:text-gray-600"
        >
          {isMobile ? (
            <X size={16} />
          ) : (
            isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />
          )}
=======
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex justify-center hover:bg-gray-50 text-gray-400 hover:text-gray-600"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
        </Button>
      </div>
      
      <nav className="mt-4 px-2 h-full overflow-y-auto pb-20">
        <ul className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
<<<<<<< HEAD
                  onClick={handleLinkClick}
=======
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
                  className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
<<<<<<< HEAD
                  title={(!isOpen && !isMobile) ? link.label : undefined}
                >
                  <Icon size={18} className={`${(!isOpen && !isMobile) ? '' : 'mr-3'} flex-shrink-0`} />
                  {(isOpen || isMobile) && <span className="truncate">{link.label}</span>}
=======
                  title={isCollapsed ? link.label : undefined}
                >
                  <Icon size={18} className={`${isCollapsed ? '' : 'mr-3'} flex-shrink-0`} />
                  {!isCollapsed && <span className="truncate">{link.label}</span>}
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default CollapsibleSidebar;
