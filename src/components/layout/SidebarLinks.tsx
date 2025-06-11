
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  ClipboardList, 
  MapPin, 
  MessageCircle,
  Settings, 
  BarChart3, 
  CreditCard,
  Users,
  Calendar,
  Gift,
  Truck,
  ChefHat,
  QrCode,
  Heart,
  Menu,
  Bike,
  Shield,
  TrendingUp
} from 'lucide-react';

const SidebarLinks = () => {
  const location = useLocation();

  const menuItems = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard'
    },
    {
      title: 'Produtos',
      icon: ShoppingBag,
      path: '/products'
    },
    {
      title: 'Pedidos',
      icon: ClipboardList,
      path: '/orders'
    },
    {
      title: 'PDV',
      icon: CreditCard,
      path: '/pdv'
    },
    {
      title: 'Cozinha (KDS)',
      icon: ChefHat,
      path: '/kitchen'
    },
    {
      title: 'Cardápio Digital',
      icon: Menu,
      path: '/menu'
    },
    {
      title: 'Combos & Promoções',
      icon: Gift,
      path: '/promocoes'
    },
    {
      title: 'WhatsApp IA',
      icon: MessageCircle,
      path: '/whatsapp-enhanced'
    },
    {
      title: 'Entregadores',
      icon: Bike,
      path: '/entregadores'
    },
    {
      title: 'Zonas de Entrega',
      icon: MapPin,
      path: '/bairros-entrega'
    },
    {
      title: 'Mesas',
      icon: Calendar,
      path: '/mesas'
    },
    {
      title: 'Fidelidade',
      icon: Heart,
      path: '/loyalty'
    },
    {
      title: 'Relatórios',
      icon: BarChart3,
      path: '/relatorios'
    },
    {
      title: 'Financeiro',
      icon: TrendingUp,
      path: '/financeiro'
    },
    {
      title: 'Segurança',
      icon: Shield,
      path: '/security-dashboard'
    },
    {
      title: 'Configurações',
      icon: Settings,
      path: '/configuracoes'
    },
  ];

  return (
    <nav className="p-4">
      <div className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={18} className="mr-3" />
              {item.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default SidebarLinks;
