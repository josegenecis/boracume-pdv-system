import React from 'react';
import { Barcode, ReceiptText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface ElectronicCommandLookup {
  found: boolean;
  occupied?: boolean;
  code: string;
  label?: string | null;
  accountName?: string | null;
  accountNumber?: number | null;
  tableNumber?: number | null;
  total?: number;
  paidTotal?: number;
  dueAmount?: number;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    status?: string;
    notes?: string;
    options?: Array<{ name: string; quantity: number; price: number }>;
  }>;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ElectronicCommandLookup | null;
}

const ElectronicCommandDialog: React.FC<Props> = ({ open, onOpenChange, data }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-2xl text-[#003223]">
          <Barcode className="h-6 w-6 text-[#FF6400]" />
          Comanda {data?.code || ''}
        </DialogTitle>
      </DialogHeader>

      {data && !data.occupied ? (
        <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center">
          <div className="font-black text-emerald-950">Comanda livre</div>
          <p className="mt-1 text-sm text-emerald-700">Ela não está vinculada a nenhuma conta aberta.</p>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#003223] p-4 text-white">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-white/60">Conta atual</div>
              <div className="mt-1 text-xl font-black">{data.accountName || `Conta ${data.accountNumber || ''}`}</div>
              {data.tableNumber ? <Badge className="mt-2 bg-white/15 text-white">Mesa {data.tableNumber}</Badge> : null}
            </div>
            <div className="text-right">
              <div className="text-xs text-white/60">Saldo pendente</div>
              <div className="text-3xl font-black">{money.format(Number(data.dueAmount || 0))}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-slate-500">Total</div>
              <div className="font-black text-[#003223]">{money.format(Number(data.total || 0))}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-slate-500">Recebido</div>
              <div className="font-black text-emerald-700">{money.format(Number(data.paidTotal || 0))}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-slate-500">Itens</div>
              <div className="font-black text-[#003223]">{data.items?.length || 0}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-black text-[#003223]">
              <ReceiptText className="h-4 w-4" />
              Consumo da comanda
            </div>
            {(data.items || []).map((item) => (
              <div key={item.id} className="rounded-xl border bg-white p-3">
                <div className="flex justify-between gap-3">
                  <div className="font-bold text-[#003223]">{item.quantity}x {item.name}</div>
                  <div className="font-black">{money.format(Number(item.total || 0))}</div>
                </div>
                {item.options?.length ? (
                  <div className="mt-1 text-xs text-slate-500">
                    {item.options.map((option) => option.name).join(' · ')}
                  </div>
                ) : null}
                {item.notes ? <div className="mt-1 text-xs text-amber-700">Obs.: {item.notes}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>Fechar</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ElectronicCommandDialog;
