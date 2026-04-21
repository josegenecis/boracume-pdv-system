import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, CreditCard, Wallet, Ellipsis } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleSidebar } = useSidebar();

  const items = [
    { key: 'home', label: 'Início', icon: Home, onClick: () => navigate('/dashboard'), active: location.pathname === '/dashboard' },
    { key: 'orders', label: 'Pedidos', icon: ClipboardList, onClick: () => navigate('/pedidos'), active: location.pathname === '/pedidos' },
    { key: 'pdv', label: 'PDV', icon: CreditCard, onClick: () => navigate('/pdv'), active: location.pathname === '/pdv' },
    { key: 'cash', label: 'Caixa', icon: Wallet, onClick: () => navigate('/caixa'), active: location.pathname === '/caixa' || location.pathname === '/financeiro' },
    { key: 'more', label: 'Mais', icon: Ellipsis, onClick: () => toggleSidebar(), active: false },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#FF6400]/10 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 shadow-[0_-16px_40px_-24px_rgba(0,50,35,0.28)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-[28px] border border-[#FF6400]/10 bg-gradient-to-r from-[#FFF8F2] via-white to-[#F5EBE1]/85 px-2 py-2 shadow-[0_14px_30px_-22px_rgba(0,50,35,0.24)]">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-all ${
                item.active
                  ? 'bg-[#003223] text-white shadow-[0_12px_24px_-16px_rgba(0,50,35,0.7)]'
                  : 'text-[#003223]/68 hover:bg-[#F5EBE1] hover:text-[#003223]'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="text-[11px] font-semibold tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
