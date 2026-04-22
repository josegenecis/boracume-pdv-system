import React, { useEffect, useState } from 'react';
import {
  User,
  Menu,
  Wallet,
  Settings,
  Package,
  Layers,
  CookingPot,
  BarChart3,
  ClipboardList,
  MessageCircle,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '@/components/Logo';
import OperatorSwitcher from '@/components/OperatorSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const FixedHeader = () => {
  const { signOut, user } = useAuth();
  const { isMobile, toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [cashStatus, setCashStatus] = useState<'open' | 'closed'>('closed');
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const loadCashStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('cash_register_sessions' as any)
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!active) return;
        if (error) throw error;
        setCashStatus(data?.id ? 'open' : 'closed');
      } catch {
        if (!active) return;
        setCashStatus('closed');
      }
    };

    void loadCashStatus();

    const handleCashChange = () => {
      void loadCashStatus();
    };

    window.addEventListener('cash-session-changed', handleCashChange);
    return () => {
      active = false;
      window.removeEventListener('cash-session-changed', handleCashChange);
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    const loadWhatsAppStatus = async () => {
      try {
        const { data } = await supabase.functions.invoke('whatsapp-status', { method: 'GET' });
        if (!active) return;
        setWhatsAppConnected(data?.status === 'connected');
      } catch {
        if (!active) return;
        setWhatsAppConnected(false);
      }
    };

    void loadWhatsAppStatus();
    const timer = window.setInterval(loadWhatsAppStatus, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const mobileTitle = (() => {
    if (location.pathname.startsWith('/dashboard')) return 'Início';
    if (location.pathname.startsWith('/pedidos')) return 'Pedidos';
    if (location.pathname.startsWith('/pdv')) return 'PDV';
    if (location.pathname.startsWith('/caixa') || location.pathname.startsWith('/financeiro')) return 'Caixa';
    if (location.pathname.startsWith('/cozinha')) return 'Cozinha';
    if (location.pathname.startsWith('/produtos')) return 'Cardápio';
    if (location.pathname.startsWith('/marketing')) return 'Clientes';
    if (location.pathname.startsWith('/configuracoes')) return 'Mais';
    return 'BoraCumê';
  })();

  const mobileQuickActions = [
    { key: 'orders', label: 'Pedidos', icon: ClipboardList, to: '/pedidos', active: location.pathname.startsWith('/pedidos') },
    { key: 'pdv', label: 'PDV', icon: CreditCard, to: '/pdv', active: location.pathname.startsWith('/pdv') },
    { key: 'cash', label: cashStatus === 'open' ? 'Caixa aberto' : 'Abrir caixa', icon: Wallet, to: '/caixa', active: location.pathname.startsWith('/caixa') || location.pathname.startsWith('/financeiro') },
    { key: 'menu', label: 'Cardápio', icon: Package, to: '/produtos', active: location.pathname.startsWith('/produtos') },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#E7ECE8] bg-white shadow-[0_12px_30px_-24px_rgba(0,50,35,0.16)]">
      <div className={`flex items-center justify-between ${isMobile ? 'mobile-safe-x px-3 py-2' : 'px-3 py-3 sm:px-6'}`}>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="h-8 w-8 rounded-[16px] border border-[#DCE6DF] bg-white p-0 text-[#003223] shadow-sm hover:bg-[#F5F8F6]"
          >
            <Menu size={16} />
          </Button>
          {isMobile ? (
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#FF6400]">BoraCumê</div>
              <div className="truncate text-[14px] font-bold text-[#003223]">{mobileTitle}</div>
            </div>
          ) : (
            <Logo size="sm" />
          )}
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden lg:block">
            <OperatorSwitcher />
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 rounded-xl border font-semibold shadow-sm hover:bg-[#F5F8F6] ${
              cashStatus === 'open'
                ? 'border-[#8CC850] bg-[#F4FAEC] text-[#245B2B]'
                : 'border-[#DCE6DF] bg-white text-[#003223]'
            } ${isMobile ? 'h-8 w-8 rounded-[16px] p-0 md:hidden' : 'hidden px-4 md:inline-flex'}`}
            onClick={() => navigate('/caixa')}
          >
            <Wallet size={16} className={isMobile ? '' : 'mr-2'} />
            {!isMobile && 'Caixa'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 rounded-xl border-[#DCE6DF] bg-white px-4 font-semibold text-[#003223] shadow-sm hover:bg-[#F5F8F6] md:inline-flex"
            onClick={() => navigate('/relatorios')}
          >
            Abrir relatório diário
          </Button>
          <Button
            size="sm"
            className="hidden h-9 rounded-xl bg-[#FF6400] px-4 font-semibold text-white hover:bg-[#E85C00] sm:inline-flex"
            onClick={() => navigate('/pdv')}
          >
            + Novo pedido
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`h-9 rounded-xl border-[#DCE6DF] bg-white font-semibold text-[#003223] shadow-sm hover:bg-[#F5F8F6] ${isMobile ? 'h-8 w-8 rounded-[16px] p-0' : 'px-4'}`}>
                {isMobile ? <User size={16} /> : 'Gerencial'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Gerencial</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/caixa')}>
                <Wallet className="mr-2 h-4 w-4" />
                Caixa Geral
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/financeiro')}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Financeiro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/pdv')}>
                <Wallet className="mr-2 h-4 w-4" />
                Caixa / PDV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/produtos')}>
                <Package className="mr-2 h-4 w-4" />
                Produtos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/produtos?tab=categories')}>
                <Layers className="mr-2 h-4 w-4" />
                Categorias
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/cozinha')}>
                <CookingPot className="mr-2 h-4 w-4" />
                Cozinha (KDS)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracoes?tab=whatsapp')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <User className="mr-2 h-4 w-4" />
                Sair do sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="relative hidden h-9 w-9 rounded-xl border-[#DCE6DF] bg-white p-0 text-[#003223] shadow-sm hover:bg-[#F5F8F6] md:inline-flex"
            onClick={() => navigate('/configuracoes?tab=whatsapp')}
          >
            <MessageCircle size={18} />
            <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white ${whatsAppConnected ? 'bg-[#22c55e]' : 'bg-red-500'}`} />
          </Button>
        </div>
      </div>
      {isMobile && (
        <div className="mobile-safe-x border-t border-[#E7ECE8] bg-[#F8FBF8]/95 px-3 pb-1.5 pt-1.5 backdrop-blur">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {mobileQuickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-[18px] border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition-colors ${
                    action.active
                      ? 'border-[#003223] bg-[#003223] text-white'
                      : action.key === 'cash' && cashStatus === 'open'
                        ? 'border-[#8CC850]/50 bg-[#F4FAEC] text-[#245B2B]'
                        : 'border-[#DCE6DF] bg-white text-[#003223]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{action.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => navigate('/configuracoes?tab=whatsapp')}
              className="relative inline-flex shrink-0 items-center gap-1.5 rounded-[18px] border border-[#DCE6DF] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#003223] shadow-sm"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
              <span className={`h-2.5 w-2.5 rounded-full ${whatsAppConnected ? 'bg-[#22c55e]' : 'bg-red-500'}`} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default FixedHeader;
