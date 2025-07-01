
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
  Download
} from 'lucide-react';

const CollapsibleSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
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

  return (
    <aside className={`bg-white shadow-md h-screen fixed left-0 top-16 z-30 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="p-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex justify-center hover:bg-gray-50 text-gray-400 hover:text-gray-600"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
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
                  className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={isCollapsed ? link.label : undefined}
                >
                  <Icon size={18} className={`${isCollapsed ? '' : 'mr-3'} flex-shrink-0`} />
                  {!isCollapsed && <span className="truncate">{link.label}</span>}
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
