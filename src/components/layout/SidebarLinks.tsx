
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  Download,
  Tag
} from 'lucide-react';

const SidebarLinks = () => {
  const location = useLocation();

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/produtos', icon: ShoppingBag, label: 'Produtos' },
    { to: '/variacoes-globais', icon: Tag, label: 'Variações Globais' },
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
    <nav className="mt-8 px-4">
      <ul className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          
          return (
            <li key={link.to}>
              <Link
                to={link.to}
                className={`flex items-center px-4 py-2 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} className="mr-3" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default SidebarLinks;
