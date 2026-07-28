import { useEffect, useState } from 'react';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
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

interface CancelTableAccountDialogProps {
  open: boolean;
  tableNumber?: number;
  onCancel: () => void;
  onConfirm: (pin: string, reason: string) => Promise<boolean>;
}

export function CancelTableAccountDialog({
  open,
  tableNumber,
  onCancel,
  onConfirm,
}: CancelTableAccountDialogProps) {
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
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>Cancelar conta e liberar Mesa {tableNumber ?? ''}</DialogTitle>
          <DialogDescription>
            Os itens sairão da operação e a mesa ficará livre. Nada será apagado: valor, itens, motivo,
            usuário e horário permanecerão no histórico de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="table-cancellation-reason">Motivo do cancelamento</Label>
            <Textarea
              id="table-cancellation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: lançamento incorreto, cliente desistiu..."
              maxLength={240}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="table-cancellation-pin" className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" />
              Senha/PIN do administrador
            </Label>
            <Input
              id="table-cancellation-pin"
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
            {loading ? 'Validando…' : 'Cancelar conta e liberar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
