
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
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';

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

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-4 py-2">
          <h2 className="text-lg font-semibold">Boracumê</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.path}>
                        <Icon size={18} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-4 py-2 text-sm text-gray-500">
          v1.0.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
