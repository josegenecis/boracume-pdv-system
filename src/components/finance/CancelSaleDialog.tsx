import { useEffect, useState } from 'react';
import { AlertTriangle, LockKeyhole, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CancelSaleDialogProps {
  open: boolean;
  orderLabel?: string;
  amountLabel?: string;
  supportsAutomaticRefund?: boolean;
  paymentLabel?: string;
  onCancel: () => void;
  onConfirm: (input: { pin: string; reason: string; refundRequested: boolean }) => Promise<boolean>;
}

export function CancelSaleDialog({
  open,
  orderLabel,
  amountLabel,
  supportsAutomaticRefund = false,
  paymentLabel,
  onCancel,
  onConfirm,
}: CancelSaleDialogProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [refundRequested, setRefundRequested] = useState(supportsAutomaticRefund);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPin('');
    setReason('');
    setRefundRequested(supportsAutomaticRefund);
  }, [open, supportsAutomaticRefund]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const completed = await onConfirm({ pin, reason: reason.trim(), refundRequested });
      if (completed) {
        setPin('');
        setReason('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !loading && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>Cancelar venda {orderLabel ?? ''}</DialogTitle>
          <DialogDescription>
            {amountLabel ? `O valor de ${amountLabel} ` : 'O valor '}
            sairá dos totais do caixa atual e o estoque baixado será devolvido. A venda não será apagada:
            ficará marcada como cancelada com motivo, responsável e horário. Se existir documento fiscal
            autorizado, ele será cancelado primeiro e a venda só será alterada após a confirmação da SEFAZ.
            O prazo é de 30 minutos para o modelo 65 e 720 horas para o modelo 55.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sale-cancellation-reason">Motivo do cancelamento</Label>
            <Textarea
              id="sale-cancellation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: pedido lançado em duplicidade, cliente desistiu..."
              maxLength={240}
              disabled={loading}
            />
          </div>

          {supportsAutomaticRefund ? (
            <label
              htmlFor="sale-refund-requested"
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4"
            >
              <Checkbox
                id="sale-refund-requested"
                checked={refundRequested}
                onCheckedChange={(checked) => setRefundRequested(checked === true)}
                disabled={loading}
              />
              <span>
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <RotateCcw className="h-4 w-4 text-blue-700" />
                  Solicitar devolução automática
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-600">
                  O pagamento via {paymentLabel || 'pagamento online'} será devolvido depois que o
                  cancelamento for autorizado.
                </span>
              </span>
            </label>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="sale-cancellation-pin" className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" />
              Senha/PIN do administrador
            </Label>
            <Input
              id="sale-cancellation-pin"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              maxLength={6}
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              type="password"
              disabled={loading}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && pin.length >= 4 && reason.trim()) {
                  event.preventDefault();
                  void handleConfirm();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Por segurança, somente vendas do caixa aberto atual podem ser canceladas aqui.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={loading || pin.length < 4 || !reason.trim()}
          >
            {loading ? 'Validando…' : 'Cancelar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
