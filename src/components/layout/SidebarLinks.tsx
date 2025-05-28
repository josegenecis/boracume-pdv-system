
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ChefHat, 
  Package, 
  ShoppingCart, 
  CreditCard,
  Truck,
  DollarSign,
  BarChart3,
  Settings,
  CreditCard as SubscriptionIcon,
  Menu,
  Globe
} from 'lucide-react';

const SidebarLinks = () => {
  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/cozinha', icon: ChefHat, label: 'Cozinha' },
    { to: '/produtos', icon: Package, label: 'Produtos' },
    { to: '/cardapio', icon: Menu, label: 'Cardápio Digital' },
    { to: '/menu', icon: Globe, label: 'Ver Cardápio Público', external: true },
    { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
    { to: '/pdv', icon: CreditCard, label: 'PDV' },
    { to: '/entregadores', icon: Truck, label: 'Entregadores' },
    { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
    { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
    { to: '/configuracoes', icon: Settings, label: 'Configurações' },
    { to: '/assinatura', icon: SubscriptionIcon, label: 'Planos & Upgrade' },
  ];

  return (
    <nav className="space-y-2">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          target={item.external ? '_blank' : undefined}
          className={({ isActive }) =>
            `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              isActive && !item.external
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`
          }
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default SidebarLinks;
