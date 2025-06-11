
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
  Calendar,
  Gift,
  ChefHat,
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
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <LayoutDashboard className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Boracumê</span>
            <span className="truncate text-xs">Sistema de Gestão</span>
          </div>
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
                        <Icon />
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
        <div className="px-4 py-2 text-xs text-sidebar-foreground/70">
          v1.0.0 - Sistema completo
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
