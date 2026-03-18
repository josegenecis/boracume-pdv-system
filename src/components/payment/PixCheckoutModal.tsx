import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PixCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  correlationID: string;
  brCode: string;
  qrCodeImage?: string;
  paymentLinkUrl?: string;
  paymentId?: string;
}

export default function PixCheckoutModal(props: PixCheckoutModalProps) {
  const { isOpen, onClose, correlationID, brCode, qrCodeImage, paymentLinkUrl, paymentId } = props;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'CREATED' | 'PAID' | 'ERROR'>('CREATED');
  const [details, setDetails] = useState<{ mpStatus?: string; mpDetail?: string; mpDateApproved?: string; note?: string } | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string>('CREATED');

  useEffect(() => {
    if (!isOpen || !correlationID) return;
    let active = true;
    const poll = async () => {
      try {
        const { data, error }: any = await supabase.functions.invoke('pix-checkout-status', { body: { correlationID } as any });
        if (!active) return;
        if (error) {
          setStatus('ERROR');
          return;
        }
        if (data?.ok) {
          if ((data.status === 'PAID' || data.status === 'APPROVED') && data.orderId) {
            setStatus('PAID');
            window.location.href = `/track/${data.orderId}`;
            return;
          }
          const mpStatus = data?.mp?.status ? String(data.mp.status) : '';
          const mpDetail = data?.mp?.status_detail ? String(data.mp.status_detail) : '';
          const mpDateApproved = data?.mp?.date_approved ? String(data.mp.date_approved) : '';
          const note = data?.mp?.note ? String(data.mp.note) : '';
          const rs = data?.status ? String(data.status) : '';
          if (rs) setRemoteStatus(rs);
          if (mpStatus || mpDetail || mpDateApproved) {
            setDetails({ mpStatus, mpDetail, mpDateApproved, note });
          }
          setStatus('CREATED');
        } else {
          setStatus('ERROR');
        }
      } catch {
        if (active) setStatus('ERROR');
      }
      setTimeout(poll, 3000);
    };
    poll();
    return () => { active = false; };
  }, [isOpen, correlationID]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      toast({ title: 'Código PIX copiado', description: 'Cole no seu app do banco para pagar.' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento via PIX</DialogTitle>
          <DialogDescription>Escaneie o QR Code ou copie o código para pagar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 space-y-4">
          {qrCodeImage ? (
            <img src={qrCodeImage} alt="QR Code PIX" className="w-[200px] h-[200px] rounded-lg border bg-white p-2" />
          ) : (
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <QRCodeSVG value={brCode} size={200} />
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
              Aguardando confirmação do pagamento... ({remoteStatus})
            </div>
          )}
          {details?.mpStatus || details?.mpDetail ? (
            <div className="text-[11px] text-muted-foreground text-center">
              Mercado Pago: {details?.mpStatus || '-'}{details?.mpDetail ? ` • ${details.mpDetail}` : ''}
              {details?.note ? ` • ${details.note}` : ''}
            </div>
          ) : null}
          <div className="text-[11px] text-muted-foreground text-center">
            Checkout: {correlationID}{paymentId ? ` • Pagamento: ${paymentId}` : ''}
          </div>
          {status === 'ERROR' && (
            <div className="text-xs text-red-600">
              Erro ao verificar pagamento. Tente novamente em instantes.
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

