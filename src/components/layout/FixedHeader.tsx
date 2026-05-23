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
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
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
import { FeatureKey } from '@/lib/featureAccess';
import { useFeatureGate } from '@/components/subscription/FeatureGateProvider';
import { clearLocalOperatorSession } from '@/services/operatorAuth';

const FixedHeader = () => {
  const { signOut, user } = useAuth();
  const { isMobile, toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const { canAccessFeature, openFeatureDialog } = useFeatureGate();
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
    clearLocalOperatorSession();
    await signOut();
    navigate('/login');
  };

  const goToFeature = (path: string, feature: FeatureKey) => {
    if (!canAccessFeature(feature)) {
      openFeatureDialog(feature);
      return;
    }
    navigate(path);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#E7ECE8] bg-white shadow-[0_12px_30px_-24px_rgba(0,50,35,0.16)]">
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
          <Logo size="sm" className={isMobile ? 'max-w-[112px]' : ''} />
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
            onClick={() => goToFeature('/caixa', 'finance')}
          >
            <Wallet size={16} className={isMobile ? '' : 'mr-2'} />
            {!isMobile && 'Caixa'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 rounded-xl border-[#DCE6DF] bg-white px-4 font-semibold text-[#003223] shadow-sm hover:bg-[#F5F8F6] md:inline-flex"
            onClick={() => goToFeature('/relatorios', 'reports')}
          >
            Abrir relatorio diario
          </Button>
          <Button
            size="sm"
            className="hidden h-9 rounded-xl bg-[#FF6400] px-4 font-semibold text-white hover:bg-[#E85C00] sm:inline-flex"
            onClick={() => goToFeature('/pdv', 'pdv')}
          >
            + Novo pedido
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-9 rounded-xl border-[#DCE6DF] bg-white font-semibold text-[#003223] shadow-sm hover:bg-[#F5F8F6] ${isMobile ? 'h-8 w-8 rounded-[16px] p-0' : 'px-4'}`}
              >
                {isMobile ? <User size={16} /> : 'Gerencial'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Gerencial</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => goToFeature('/caixa', 'finance')}>
                <Wallet className="mr-2 h-4 w-4" />
                Caixa Geral
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goToFeature('/financeiro', 'finance')}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Financeiro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goToFeature('/pdv', 'pdv')}>
                <Wallet className="mr-2 h-4 w-4" />
                Caixa / PDV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => goToFeature('/produtos', 'products')}>
                <Package className="mr-2 h-4 w-4" />
                Produtos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goToFeature('/produtos?tab=categories', 'products')}>
                <Layers className="mr-2 h-4 w-4" />
                Categorias
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goToFeature('/cozinha', 'kds')}>
                <CookingPot className="mr-2 h-4 w-4" />
                Cozinha (KDS)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => goToFeature('/configuracoes', 'settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Configuracoes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goToFeature('/configuracoes?tab=whatsapp', 'whatsapp')}>
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
            onClick={() => goToFeature('/configuracoes?tab=whatsapp', 'whatsapp')}
          >
            <MessageCircle size={18} />
            <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white ${whatsAppConnected ? 'bg-[#22c55e]' : 'bg-red-500'}`} />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default FixedHeader;
