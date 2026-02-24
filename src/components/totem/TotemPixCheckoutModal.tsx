import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TotemPixCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  correlationID: string;
  brCode: string;
  qrCodeImage?: string;
  paymentLinkUrl?: string;
  onPaid: (orderId: string) => void;
}

export default function TotemPixCheckoutModal(props: TotemPixCheckoutModalProps) {
  const { isOpen, onClose, correlationID, brCode, qrCodeImage, paymentLinkUrl, onPaid } = props;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'CREATED' | 'PAID' | 'ERROR'>('CREATED');

  useEffect(() => {
    if (!isOpen || !correlationID) return;
    let active = true;
    const poll = async () => {
      try {
        const { data }: any = await supabase.functions.invoke('pix-checkout-status', { body: { correlationID } as any });
        if (!active) return;
        if (data?.ok) {
          if (data.status === 'PAID' && data.orderId) {
            setStatus('PAID');
            onPaid(String(data.orderId));
            return;
          }
          setStatus(data.status || 'CREATED');
        }
      } catch {
        if (active) setStatus('ERROR');
      }
      window.setTimeout(poll, 2500);
    };
    poll();
    return () => {
      active = false;
    };
  }, [isOpen, correlationID, onPaid]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      toast({ title: 'Código PIX copiado', description: 'Cole no app do banco para pagar.' });
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Pagamento via PIX</DialogTitle>
          <DialogDescription>Escaneie o QR Code ou copie o código para pagar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-2 space-y-4">
          {qrCodeImage ? (
            <img src={qrCodeImage} alt="QR Code PIX" className="w-[240px] h-[240px] rounded-lg border bg-white p-2" />
          ) : (
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <QRCodeSVG value={brCode} size={220} />
            </div>
          )}

          <div className="w-full flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopy} disabled={!brCode}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Código'}
            </Button>
            {paymentLinkUrl && (
              <Button variant="outline" onClick={() => window.open(paymentLinkUrl, '_blank')}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>

          {status === 'CREATED' && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Aguardando confirmação do pagamento...
            </div>
          )}
          {status === 'ERROR' && (
            <div className="text-xs text-red-600">
              Erro ao verificar pagamento. Tente novamente.
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
