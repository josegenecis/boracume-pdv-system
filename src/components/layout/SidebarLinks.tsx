
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChefHat,
  ShoppingCart,
  BarChart4,
  Truck,
  DollarSign,
  FileText,
  Settings,
  CreditCard,
  Home
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarLink {
  title: string;
  icon: JSX.Element;
  href: string;
  badge?: string;
}

const SidebarLinks: React.FC = () => {
  const { subscription } = useAuth();
  const location = useLocation();
  
  // Check if a feature is available based on subscription
  const hasFeature = (feature: string): boolean => {
    // During trial, all features are available
    if (subscription?.status === 'trial') {
      return true;
    }
    
    // If active subscription with Elite plan, all features are available
    if (subscription?.status === 'active' && subscription?.plan?.name === 'Elite') {
      return true;
    }
    
    // For Basic plan, only specific features are available
    if (subscription?.status === 'active' && subscription?.plan?.name === 'Basic') {
      const basicFeatures = ['cardápio digital', 'PDV', 'recebimento de pedidos'];
      return basicFeatures.includes(feature);
    }
    
    // Default to false if no subscription or expired
    return false;
  };

  const links: SidebarLink[] = [
    {
      title: 'Dashboard',
      icon: <Home className="h-5 w-5" />,
      href: '/dashboard',
    },
    {
      title: 'Cozinha',
      icon: <ChefHat className="h-5 w-5" />,
      href: '/cozinha',
    },
    {
      title: 'Produtos',
      icon: <ShoppingCart className="h-5 w-5" />,
      href: '/produtos',
    },
  ];
  
  // Add premium features based on subscription
  if (hasFeature('gestão de entregadores')) {
    links.push({
      title: 'Entregadores',
      icon: <Truck className="h-5 w-5" />,
      href: '/entregadores',
    });
  }
  
  if (hasFeature('financeiro')) {
    links.push({
      title: 'Financeiro',
      icon: <DollarSign className="h-5 w-5" />,
      href: '/financeiro',
    });
  }
  
  if (hasFeature('relatórios')) {
    links.push({
      title: 'Relatórios',
      icon: <BarChart4 className="h-5 w-5" />,
      href: '/relatorios',
    });
  }
  
  links.push({
    title: 'Configurações',
    icon: <Settings className="h-5 w-5" />,
    href: '/configuracoes',
  });
  
  links.push({
    title: 'Assinatura',
    icon: <CreditCard className="h-5 w-5" />,
    href: '/assinatura',
    badge: subscription?.status === 'trial' ? 'Teste' : undefined
  });

  return (
    <nav className="space-y-1">
      {links.map((link) => (
        <Link
          key={link.href}
          to={link.href}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            location.pathname === link.href
              ? 'bg-boracume-orange text-white'
              : 'text-gray-700 hover:bg-gray-100'
          } group`}
        >
          <span className={`mr-3 ${location.pathname === link.href ? 'text-white' : 'text-gray-500'}`}>
            {link.icon}
          </span>
          <span className="flex-1">{link.title}</span>
          {link.badge && (
            <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-boracume-orange text-white">
              {link.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
};

export default SidebarLinks;
