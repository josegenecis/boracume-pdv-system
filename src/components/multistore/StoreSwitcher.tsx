import { Building2, Check, ChevronDown, Network } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function StoreSwitcher() {
  const navigate = useNavigate();
  const { stores, activeStore, switchStore, canManageStores, storesLoading } = useAuth();

  if (!activeStore || (stores.length <= 1 && !canManageStores)) return null;

  const handleSwitch = async (storeUserId: string) => {
    if (storeUserId === activeStore.store_user_id) return;
    try {
      await switchStore(storeUserId);
      toast.success('Unidade alterada. Identifique o operador desta loja.');
      navigate('/operator-login', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível trocar de loja.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={storesLoading}
          className="hidden h-9 max-w-[230px] rounded-xl border-[#B8D7CA] bg-[#F3FBF7] px-3 font-semibold text-[#003223] shadow-sm hover:bg-[#E8F7EF] sm:inline-flex"
        >
          <Building2 className="mr-2 h-4 w-4 shrink-0 text-[#087A55]" />
          <span className="truncate">{activeStore.store_name}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-65" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          <span className="block text-xs font-medium text-muted-foreground">Unidade em operação</span>
          <span className="block truncate text-sm text-[#003223]">{activeStore.network_name}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stores.map((store) => (
          <DropdownMenuItem
            key={store.store_user_id}
            onClick={() => void handleSwitch(store.store_user_id)}
            className="flex cursor-pointer items-center gap-2 py-2.5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF7F0] text-[#087A55]">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{store.store_name}</span>
              <span className="block truncate text-xs text-muted-foreground">{store.store_email || 'Unidade da rede'}</span>
            </span>
            {store.store_user_id === activeStore.store_user_id && <Check className="h-4 w-4 text-[#087A55]" />}
          </DropdownMenuItem>
        ))}
        {canManageStores && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/lojas')} className="cursor-pointer py-2.5 font-semibold text-[#003223]">
              <Network className="mr-2 h-4 w-4 text-[#FF6400]" />
              Gerenciar rede e lojas
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
