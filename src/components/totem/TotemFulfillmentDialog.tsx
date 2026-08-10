import { ShoppingBag, Utensils } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export type TotemOrderType = 'dine_in' | 'pickup';

export default function TotemFulfillmentDialog({ open, onSelect }: { open: boolean; onSelect: (type: TotemOrderType) => void }) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-3xl rounded-[32px] border-0 p-7 sm:p-10"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="text-center">
          <DialogTitle className="text-3xl font-black text-[#073a2d] sm:text-4xl">Como você quer receber?</DialogTitle>
          <DialogDescription className="mt-3 text-base font-semibold text-stone-500">Essa informação seguirá identificada no pedido da cozinha.</DialogDescription>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => onSelect('dine_in')} className="group flex min-h-56 flex-col items-center justify-center rounded-[28px] border-2 border-emerald-100 bg-emerald-50 p-6 text-center transition hover:-translate-y-1 hover:border-emerald-500 hover:shadow-xl">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#073a2d] text-white"><Utensils className="h-10 w-10" /></span>
            <span className="mt-5 text-2xl font-black text-[#073a2d]">Comer aqui</span>
            <span className="mt-2 text-sm font-semibold text-stone-500">Consumir no restaurante</span>
          </button>
          <button type="button" onClick={() => onSelect('pickup')} className="group flex min-h-56 flex-col items-center justify-center rounded-[28px] border-2 border-orange-100 bg-orange-50 p-6 text-center transition hover:-translate-y-1 hover:border-orange-500 hover:shadow-xl">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500 text-white"><ShoppingBag className="h-10 w-10" /></span>
            <span className="mt-5 text-2xl font-black text-[#073a2d]">Para levar</span>
            <span className="mt-2 text-sm font-semibold text-stone-500">Embalar o pedido para viagem</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
