

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/SidebarContext';

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
  Bot,

  Download,
  X
} from 'lucide-react';

const CollapsibleSidebar = () => {
  const { isOpen, isMobile, toggleSidebar, closeSidebar } = useSidebar();

  const location = useLocation();

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/produtos', icon: ShoppingBag, label: 'Produtos' },
    { to: '/pedidos', icon: FileText, label: 'Pedidos' },
    { to: '/pdv', icon: CreditCard, label: 'PDV (Ponto de Venda)' },
    { to: '/pix', icon: CreditCard, label: 'Pix' },
    { to: '/mesas', icon: Utensils, label: 'Mesas' },
    { to: '/cozinha', icon: ChefHat, label: 'Cozinha (KDS)' },
    { to: '/agente', icon: Bot, label: 'Assistente de Comandos' },
    { to: '/entregadores', icon: Users, label: 'Entregadores' },
    { to: '/garcons', icon: Users, label: 'Garçons' },
    { to: '/bairros-entrega', icon: MapPin, label: 'Bairros de Entrega' },
    { to: '/loyalty', icon: Crown, label: 'Programa de Fidelidade' },
    { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
    { to: '/financeiro', icon: CreditCard, label: 'Financeiro' },
    { to: '/whatsapp-bot', icon: MessageCircle, label: 'WhatsApp Bot' },
    { to: '/downloads', icon: Download, label: 'App Desktop' },
    { to: '/configuracoes', icon: Settings, label: 'Configurações' },
    { to: '/subscription', icon: Crown, label: 'Planos' },
  ];


  const handleLinkClick = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  return (
    <aside className={`
      bg-white shadow-md fixed left-0 top-16 bottom-0 z-50 transition-all duration-300
      ${isMobile 
        ? `${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64` 
        : `${isOpen ? 'w-64' : 'w-16'}`
      }
    `}>

      <div className="p-2 border-b">
        <Button
          variant="ghost"
          size="sm"

          onClick={toggleSidebar}
          className="w-full flex justify-center hover:bg-white text-gray-400 hover:text-gray-600"
        >
          {isMobile ? (
            <X size={16} />
          ) : (
            isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />
          )}

        </Button>
      </div>
      
      <nav className="mt-4 px-2 h-full overflow-y-auto overscroll-contain touch-pan-y pb-20">
        <ul className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            
            return (
              <li key={link.to}>
                <Link
                  to={link.to}

                  onClick={handleLinkClick}

                  className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-700 hover:bg-white'
                  }`}
                  title={(!isOpen && !isMobile) ? link.label : undefined}
                >
                  <Icon size={18} className={`${(!isOpen && !isMobile) ? '' : 'mr-3'} flex-shrink-0`} />
                  {(isOpen || isMobile) && <span className="truncate">{link.label}</span>}

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
