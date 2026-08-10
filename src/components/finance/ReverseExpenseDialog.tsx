import { useEffect, useState } from 'react';
import { LockKeyhole, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

interface ReverseExpenseDialogProps {
  open: boolean;
  title?: string;
  entityLabel?: string;
  auditMessage?: string;
  description?: string;
  amountLabel?: string;
  onCancel: () => void;
  onConfirm: (pin: string, reason: string) => Promise<boolean>;
}

export function ReverseExpenseDialog({
  open,
  title = 'Estornar despesa',
  entityLabel = 'despesa',
  auditMessage = 'O lançamento permanecerá no histórico de auditoria e deixará de compor os totais financeiros.',
  description,
  amountLabel,
  onCancel,
  onConfirm,
}: ReverseExpenseDialogProps) {
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPin('');
    setReason('');
  }, [open]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const completed = await onConfirm(pin, reason.trim());
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Undo2 className="h-5 w-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ? (
              <>
                Você está estornando esta {entityLabel}: <strong>{description}</strong>
                {amountLabel ? ` no valor de ${amountLabel}` : ''}.
              </>
            ) : (
              `Confirme o estorno desta ${entityLabel}.`
            )}{' '}
            {auditMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-reversal-reason">Motivo do estorno</Label>
            <Textarea
              id="expense-reversal-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: lançamento duplicado, valor informado incorretamente..."
              maxLength={240}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-reversal-pin" className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" />
              Senha/PIN do administrador
            </Label>
            <Input
              id="expense-reversal-pin"
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
              A autorização é obrigatória mesmo quando o administrador já está logado.
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
            {loading ? 'Validando…' : 'Confirmar estorno'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
