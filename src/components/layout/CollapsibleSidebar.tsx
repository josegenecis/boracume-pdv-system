
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/contexts/SidebarContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IfoodLogo } from '@/components/icons/IfoodLogo';

import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  FileText, 
  Settings, 
  Users, 
  MapPin, 
  CreditCard,
  BarChart3,
  DollarSign,
  MessageCircle,
  ChefHat,
  Utensils,
  Crown,
  Lock,
  LockOpen,
  ChevronLeft,
  ChevronRight,
  Bot,
  User,
  LogOut,
  Package,
  Download,
  Megaphone,
  X
} from 'lucide-react';

const CollapsibleSidebar = () => {
  const { isOpen, isMobile, isPinned, setPinned, toggleSidebar, closeSidebar, openSidebar } = useSidebar();
  const { profile, subscription, user, signOut } = useAuth();
  const [ifoodStatus, setIfoodStatus] = useState<'online' | 'offline' | 'paused' | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const location = useLocation();

  useEffect(() => {
    if (user) {
      const checkIfoodStatus = async () => {
        const { data } = await supabase
          .from('ifood_settings')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) {
          setIfoodStatus(data.status as any);
        }
      };
      
      checkIfoodStatus();

      // Subscribe to changes
      const channel = supabase
        .channel('sidebar-ifood-status')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ifood_settings', filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            if (payload.new) {
              setIfoodStatus(payload.new.status);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const mainLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Painel Inicial' },
  ];

  const groups = [
    {
      id: 'caixa',
      icon: CreditCard,
      label: 'Caixa & PDV',
      items: [
        { to: '/pdv', label: 'PDV / Frente de Caixa' },
        { to: '/mesas', label: 'Gestão de Mesas' },
      ]
    },
    {
      id: 'financeiro',
      icon: DollarSign,
      label: 'Financeiro',
      items: [
        { to: '/financeiro', label: 'Resumo' },
        { to: '/despesas', label: 'Despesas' },
      ]
    },
    {
      id: 'estoque',
      icon: Package,
      label: 'Estoque & Insumos',
      items: [
        { to: '/estoque', label: 'Gestão de Insumos' },
      ]
    },
    {
      id: 'inteligencia',
      icon: BarChart3,
      label: 'Inteligência',
      items: [
        { to: '/inteligencia/cmv', label: 'Dashboard CMV & ABC' },
      ]
    },
    {
      id: 'pedidos',
      icon: FileText,
      label: 'Pedidos',
      items: [
        { to: '/pedidos', label: 'Gestor de pedidos' },
        { to: '/cozinha', label: 'Cozinha (KDS)' },
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
      id: 'relatorios',
      icon: BarChart3,
      label: 'Relatórios',
      items: [
        { to: '/relatorios', label: 'Relatórios' },
      ]
    },
    {
      id: 'marketing',
      icon: Megaphone,
      label: 'Marketing',
      items: [
        { to: '/marketing?tab=banners', label: 'Banners' },
        { to: '/marketing?tab=coupons', label: 'Cupons' },
        { to: '/marketing?tab=highlights', label: 'Destaques' },
        { to: '/marketing?tab=upsells', label: 'Upsells' },
        { to: '/marketing?tab=loyalty', label: 'Fidelidade' },
        { to: '/marketing?tab=pixels', label: 'Pixels' },
        { to: '/whatsapp-bot', label: 'WhatsApp Bot' },
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
        { to: '/motoboys', label: 'Motoboys & Entregas' },
        { to: '/configuracoes?tab=whatsapp', label: 'WhatsApp' },
        { to: '/configuracoes?tab=fiscal', label: 'Fiscal' },
        { to: '/configuracoes?tab=payment-methods', label: 'Pagamentos' },
        { to: '/configuracoes?tab=ifood', label: <div className="flex items-center"><IfoodLogo className="h-4 w-auto" /></div> },
        { to: '/configuracoes?tab=users', label: 'Usuários e Equipe' },
      ]
    },
  ];

  const currentPlanLabel = useMemo(() => {
    const status = String(subscription?.status || '').toLowerCase();
    if (status.includes('trial')) return 'Teste';
    if ((subscription?.plan_id || 0) >= 3) return 'Elite';
    if ((subscription?.plan_id || 0) === 2) return 'Pro';
    if ((subscription?.plan_id || 0) === 1) return 'Essencial';
    return 'Plano';
  }, [subscription]);

  const standaloneLinks = [
    { to: '/agente', icon: Bot, label: 'Assistente' },
    { to: '/downloads', icon: Download, label: 'App Desktop' },
    { to: '/subscription', icon: Crown, label: 'Planos', detail: currentPlanLabel, accent: true },
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

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (isMobile || isPinned) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openSidebar();
  };

  const handleMouseLeave = () => {
    if (isMobile || isPinned) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeSidebar();
    }, 2000);
  };

  return (
    <aside className={`
      fixed left-0 top-16 bottom-0 z-50 border-r border-[#FF6400]/25 bg-gradient-to-b from-[#003223] via-[#003223] to-[#0B5137] shadow-[8px_0_30px_-24px_rgba(0,50,35,0.45)] transition-all duration-300
      ${isMobile 
        ? `${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64` 
        : `${isOpen ? 'w-64' : 'w-16'}`
      }
    `}
    onMouseEnter={handleMouseEnter}
    onMouseLeave={handleMouseLeave}
    >
      <nav className="h-full overflow-y-auto overscroll-contain touch-pan-y px-2 pb-20 pt-4 scrollbar-hide flex flex-col justify-between">
        <div className="flex-1">
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
                    className={`flex items-center justify-center px-3 py-2 text-sm rounded-xl transition-colors ${
                      isActive
                        ? 'bg-[#FF6400] text-white shadow-[0_12px_24px_-18px_rgba(255,100,0,0.7)]'
                        : `${(link as any).accent ? 'text-[#8CC850]' : 'text-[#F5EBE1]'} hover:bg-[#8CC850] hover:text-[#003223]`
                    }`}
                    title={typeof link.label === 'string' ? `${link.label}${(link as any).detail ? ` - ${(link as any).detail}` : ''}` : ''}
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
                      className={`flex items-center px-3 py-2 text-sm rounded-xl transition-colors ${
                        isActive
                          ? 'bg-[#FF6400] font-medium text-white shadow-[0_12px_24px_-18px_rgba(255,100,0,0.7)]'
                          : 'text-[#F5EBE1] hover:bg-[#8CC850] hover:text-[#003223]'
                      }`}
                    >
                      <Icon size={18} className="mr-3 flex-shrink-0" />
                      <span className="truncate flex items-center">{link.label}</span>
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
                      className="rounded-xl px-3 py-2 text-sm text-[#F5EBE1] hover:bg-[#8CC850] hover:text-[#003223] hover:no-underline data-[state=open]:bg-[#8CC850] data-[state=open]:text-[#003223] data-[state=open]:shadow-[0_12px_24px_-18px_rgba(140,200,80,0.8)]"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="truncate">{group.label}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0" style={{ animationDuration: '0.35s' }}>
                      <div className="mt-1 space-y-1 rounded-xl border border-[#8CC850]/30 bg-[#8CC850]/12 p-2 backdrop-blur-sm">
                        {group.items.map((item) => {
                          const isActive = isActivePath(item.to);
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={handleLinkClick}
                              className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                                isActive
                                  ? 'bg-[#FF6400] font-medium text-white shadow-[0_10px_20px_-18px_rgba(255,100,0,0.65)]'
                                  : 'text-[#F5EBE1]/95 hover:bg-[#8CC850] hover:text-[#003223]'
                              }`}
                            >
                              <span className="truncate flex items-center">{item.label}</span>
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
                      className={`flex items-center px-3 py-2 text-sm rounded-xl transition-colors ${
                        isActive
                          ? 'bg-[#FF6400] font-medium text-white shadow-[0_12px_24px_-18px_rgba(255,100,0,0.7)]'
                          : `${link.accent ? 'text-[#8CC850]' : 'text-[#F5EBE1]'} hover:bg-[#8CC850] hover:text-[#003223]`
                      }`}
                    >
                      <Icon size={18} className="mr-3 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="block truncate">{link.label}</span>
                        {link.detail && (
                          <span className={`block truncate text-[10px] font-semibold ${isActive ? 'text-white/85' : 'text-[#F5EBE1]/70'}`}>
                            {link.detail}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        </div>

        <div className={`mt-auto border-t border-white/10 pt-4 pb-4 ${isOpen ? 'px-2' : 'px-0'}`}>
          {isOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-[#8CC850]/60 bg-white/8 px-3 py-2 shadow-[0_0_0_1px_rgba(140,200,80,0.08),0_0_24px_-14px_rgba(140,200,80,0.8)]">
                <Avatar className="h-8 w-8 border-2 border-boracume-orange/20 flex-shrink-0">
                  <AvatarImage src={profile?.logo_url} />
                  <AvatarFallback className="bg-boracume-orange/10 text-boracume-orange font-bold text-xs">
                    {profile?.restaurant_name?.substring(0, 2).toUpperCase() || 'BC'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-white" title={profile?.restaurant_name}>
                    {profile?.restaurant_name || 'Seu Restaurante'}
                  </p>
                  <p className="truncate text-xs text-[#F5EBE1]/70" title={user?.email}>
                    {user?.email}
                  </p>
                  {ifoodStatus && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-tight text-[#F5EBE1]/75">
                      <span className="relative flex h-2 w-2">
                         <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ifoodStatus === 'online' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                         <span className={`relative inline-flex rounded-full h-2 w-2 ${ifoodStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                       </span>
                      <IfoodLogo className="h-3 w-auto" />
                      {ifoodStatus === 'online' ? 'ON' : 'OFF'}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-[#8CC850] hover:bg-[#8CC850] hover:text-[#003223]"
                onClick={() => setPinned(!isPinned)}
              >
                {isPinned ? <Lock size={18} className="mr-2" /> : <LockOpen size={18} className="mr-2" />}
                {isPinned ? 'Sidebar fixa' : 'Fixar sidebar'}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-[#F5EBE1] hover:bg-[#8CC850] hover:text-[#003223]"
                onClick={handleSignOut}
              >
                <LogOut size={18} className="mr-2" />
                Sair do sistema
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-10 w-full rounded-none p-0 text-[#8CC850] hover:bg-[#8CC850] hover:text-[#003223]"
                onClick={() => setPinned(!isPinned)}
                title={isPinned ? 'Destravar sidebar' : 'Fixar sidebar'}
              >
                {isPinned ? <Lock size={18} /> : <LockOpen size={18} />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-10 w-full rounded-none p-0 text-[#F5EBE1]/80 hover:bg-[#8CC850] hover:text-[#003223]"
                onClick={() => {
                  if (isMobile) {
                    closeSidebar();
                  }
                  navigate('/configuracoes?tab=profile');
                }}
                title={user?.email}
              >
                <User size={18} />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-10 w-full rounded-none p-0 text-[#F5EBE1]/80 hover:bg-[#8CC850] hover:text-[#003223]"
                onClick={handleSignOut}
                title="Sair"
              >
                <LogOut size={18} />
              </Button>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default CollapsibleSidebar;
