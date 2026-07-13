import { CreditCard, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TotemCheckoutBarProps {
  itemCount: number;
  total: number;
  onCheckout: () => void;
  onCancel: () => void;
}

const formatBRL = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TotemCheckoutBar({ itemCount, total, onCheckout, onCancel }: TotemCheckoutBarProps) {
  const hasItems = itemCount > 0;

  return (
    <div className="totem-checkout-shell fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/98 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-18px_45px_rgba(28,25,23,.16)] backdrop-blur-xl">
      <div className="totem-checkout-inner mx-auto flex max-w-[1600px] items-center gap-3">
        <div className="totem-checkout-summary flex min-w-0 flex-1 items-center gap-3">
          <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${hasItems ? 'bg-[#073a2d] text-white' : 'bg-stone-100 text-stone-400'}`}>
            <ShoppingBag className="h-7 w-7" />
            {hasItems ? <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-boracume-orange px-1 text-sm font-black text-white">{itemCount}</span> : null}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold uppercase tracking-wide text-stone-400">Seu pedido</div>
            <div className="totem-checkout-item-label truncate text-lg font-black text-stone-900">{hasItems ? `${itemCount} ${itemCount === 1 ? 'item' : 'itens'}` : 'Escolha seus produtos'}</div>
          </div>
        </div>

        <div className="totem-checkout-total hidden min-w-[180px] text-right sm:block">
          <div className="text-sm font-bold text-stone-400">Total do pedido</div>
          <div className="totem-checkout-total-value text-3xl font-black text-stone-950">{formatBRL(total)}</div>
        </div>

        {hasItems ? (
          <Button type="button" variant="ghost" onClick={onCancel} className="totem-checkout-cancel h-16 rounded-2xl px-5 font-extrabold text-stone-500 hover:bg-red-50 hover:text-red-600">
            <X className="mr-2 h-5 w-5" />
            Cancelar
          </Button>
        ) : null}

        <Button
          type="button"
          disabled={!hasItems}
          onClick={onCheckout}
          className="totem-checkout-button h-16 min-w-[260px] rounded-2xl bg-boracume-orange px-7 text-lg font-black text-white hover:bg-boracume-orange/90 disabled:bg-stone-200 disabled:text-stone-400"
        >
          <CreditCard className="mr-3 h-6 w-6" />
          {hasItems ? 'Revisar e pagar' : 'Aguardando pedido'}
        </Button>
      </div>
    </div>
  );
}
