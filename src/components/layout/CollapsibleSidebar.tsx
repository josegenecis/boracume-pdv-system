

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/SidebarContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

  const mainLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Painel Inicial' },
  ];

  const groups = [
    {
      id: 'caixa',
      icon: CreditCard,
      label: 'Caixa',
      items: [
        { to: '/pdv', label: 'PDV' },
        { to: '/financeiro', label: 'Financeiro' },
        { to: '/pix', label: 'PIX' },
      ]
    },
    {
      id: 'pedidos',
      icon: FileText,
      label: 'Pedidos',
      items: [
        { to: '/pedidos', label: 'Gestor de pedidos' },
        { to: '/cozinha', label: 'Cozinha (KDS)' },
        { to: '/mesas', label: 'Mesas' },
      ]
    },
    {
      id: 'cardapio',
      icon: ShoppingBag,
      label: 'Cardápio',
      items: [
        { to: '/produtos', label: 'Produtos' },
        { to: '/produtos?tab=categories', label: 'Categorias' },
        { to: '/produtos?tab=global-variations', label: 'Variações' },
        { to: '/cardapio', label: 'Acessar cardápio' },
      ]
    },
    {
      id: 'entrega',
      icon: MapPin,
      label: 'Entrega',
      items: [
        { to: '/entregadores', label: 'Entregadores' },
        { to: '/bairros-entrega', label: 'Bairros de entrega' },
      ]
    },
    {
      id: 'relatorios',
      icon: BarChart3,
      label: 'Relatórios',
      items: [
        { to: '/relatorios', label: 'Relatórios' },
        { to: '/loyalty', label: 'Fidelização' },
      ]
    },
    {
      id: 'config',
      icon: Settings,
      label: 'Configurações',
      items: [
        { to: '/configuracoes?tab=general', label: 'Geral' },
        { to: '/configuracoes?tab=hardware', label: 'Impressão / Balanças' },
        { to: '/configuracoes?tab=menu', label: 'QR Code & Links' },
        { to: '/configuracoes?tab=devices', label: 'Sessões ativas' },
        { to: '/configuracoes?tab=profile', label: 'Perfil' },
        { to: '/configuracoes?tab=notifications', label: 'Notificações' },
        { to: '/configuracoes?tab=appearance', label: 'Aparência' },
        { to: '/configuracoes?tab=delivery', label: 'Delivery' },
        { to: '/configuracoes?tab=whatsapp', label: 'WhatsApp' },
        { to: '/configuracoes?tab=fiscal', label: 'Fiscal' },
        { to: '/configuracoes?tab=payment-methods', label: 'Pagamentos' },
        { to: '/configuracoes?tab=pix', label: 'PIX' },
        { to: '/configuracoes?tab=users', label: 'Usuários e Equipe' },
      ]
    },
  ];

  const standaloneLinks = [
    { to: '/agente', icon: Bot, label: 'Assistente' },
    { to: '/whatsapp-bot', icon: MessageCircle, label: 'WhatsApp Bot' },
    { to: '/downloads', icon: Download, label: 'App Desktop' },
    { to: '/subscription', icon: Crown, label: 'Planos' },
  ];


  const handleLinkClick = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  const isActivePath = (to: string) => {
    const [path, search] = to.split('?');
    if (location.pathname !== path) return false;

    const currentParams = new URLSearchParams(location.search);

    if (!search) {
      if (path === '/produtos') {
        const t = currentParams.get('tab');
        return !t || t === 'products';
      }
      if (path === '/configuracoes') {
        const t = currentParams.get('tab');
        return !t || t === 'general';
      }
      return true;
    }

    const targetParams = new URLSearchParams(search);
    for (const [key, value] of targetParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  };

  const groupForCurrentPath = useMemo(() => {
    for (const group of groups) {
      if (group.items.some(i => i.to.split('?')[0] === location.pathname)) return group.id;
    }
    return '';
  }, [groups, location.pathname]);

  const [openGroup, setOpenGroup] = useState<string>(groupForCurrentPath);

  useEffect(() => {
    if (!groupForCurrentPath) return;
    setOpenGroup(groupForCurrentPath);
  }, [location.pathname, groupForCurrentPath]);

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
        {!isOpen && !isMobile ? (
          <ul className="space-y-1">
            {[...mainLinks, ...groups.flatMap(g => g.items.slice(0, 1).map(i => ({ ...i, icon: g.icon, label: g.label }))), ...standaloneLinks].map((link) => {
              const Icon = (link as any).icon;
              const isActive = isActivePath(link.to);
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={handleLinkClick}
                    className={`flex items-center justify-center px-3 py-2 text-sm rounded-lg transition-colors ${
                      isActive
                        ? 'bg-orange-100 text-orange-900'
                        : 'text-gray-700 hover:bg-orange-50'
                    }`}
                    title={link.label}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="space-y-2">
            <ul className="space-y-1 pb-2">
              {mainLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isActivePath(link.to);
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={handleLinkClick}
                      className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? 'bg-orange-100 text-orange-900 font-medium border border-orange-200'
                          : 'text-gray-700 hover:bg-orange-50'
                      }`}
                    >
                      <Icon size={18} className="mr-3 flex-shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Accordion type="single" collapsible value={openGroup} onValueChange={(v) => setOpenGroup(v)} className="w-full space-y-1">
              {groups.map((group) => {
                const Icon = group.icon;
                return (
                  <AccordionItem key={group.id} value={group.id} className="border-none">
                    <AccordionTrigger
                      className="px-3 py-2 rounded-lg text-sm hover:no-underline data-[state=open]:bg-orange-600 data-[state=open]:text-white text-gray-700 hover:bg-orange-50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="truncate">{group.label}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="rounded-lg bg-orange-50 border border-orange-100 p-2 space-y-1">
                        {group.items.map((item) => {
                          const isActive = isActivePath(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={handleLinkClick}
                              className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                                isActive
                                  ? 'bg-orange-100 text-orange-900 font-medium border border-orange-200'
                                  : 'text-gray-700 hover:bg-orange-100'
                              }`}
                            >
                              <span className="truncate">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            <ul className="space-y-1 pt-2">
              {standaloneLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isActivePath(link.to);
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={handleLinkClick}
                      className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? 'bg-orange-100 text-orange-900 font-medium border border-orange-200'
                          : 'text-gray-700 hover:bg-orange-50'
                      }`}
                    >
                      <Icon size={18} className="mr-3 flex-shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
    </aside>
  );
};

export default CollapsibleSidebar;
