import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type WaiterStatus =
  | 'free'
  | 'occupied'
  | 'preparing'
  | 'ready'
  | 'check_requested'
  | 'partially_paid'
  | 'open'
  | 'paid'
  | 'draft'
  | 'sent'
  | 'delivered'
  | 'idle';

type WaiterStatusBadgeProps = {
  status: WaiterStatus;
  className?: string;
};

const labelByStatus: Record<WaiterStatus, string> = {
  free: 'Livre',
  occupied: 'Ocupada',
  preparing: 'Em preparo',
  ready: 'Pronto',
  check_requested: 'Conta solicitada',
  partially_paid: 'Pagamento parcial',
  open: 'Aberta',
  paid: 'Fechada',
  draft: 'Rascunho',
  sent: 'Enviado',
  delivered: 'Entregue',
  idle: 'Sem envio',
};

const toneByStatus: Record<WaiterStatus, string> = {
  free: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  occupied: 'border-slate-200 bg-slate-100 text-slate-700',
  preparing: 'border-amber-200 bg-amber-50 text-amber-700',
  ready: 'border-lime-200 bg-lime-50 text-lime-700',
  check_requested: 'border-orange-200 bg-orange-50 text-orange-700',
  partially_paid: 'border-sky-200 bg-sky-50 text-sky-700',
  open: 'border-slate-200 bg-slate-100 text-slate-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-slate-200 bg-slate-100 text-slate-600',
  sent: 'border-amber-200 bg-amber-50 text-amber-700',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  idle: 'border-slate-200 bg-slate-100 text-slate-500',
};

export function WaiterStatusBadge({ status, className }: WaiterStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase',
        toneByStatus[status],
        className,
      )}
    >
      {labelByStatus[status]}
    </Badge>
  );
}
