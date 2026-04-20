import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { clearAllMenuCartStorage } from '@/hooks/useSimpleCart';

const BORACUME_LOGO_SRC = '/LOGOMARCA/logo-sistema.png';
const MERCADO_PAGO_LOGO_SRC = '/LOGOMARCA/mercado-pago-handshake.svg';

interface PixCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  correlationID: string;
  brCode: string;
  qrCodeImage?: string;
  paymentLinkUrl?: string;
  paymentId?: string;
  onPaid?: (orderId: string) => void;
}

export default function PixCheckoutModal(props: PixCheckoutModalProps) {
  const { isOpen, onClose, correlationID, brCode, qrCodeImage, paymentLinkUrl, paymentId, onPaid } = props;
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'CREATED' | 'PAID' | 'ERROR'>('CREATED');
  const [details, setDetails] = useState<{ mpStatus?: string; mpDetail?: string; mpDateApproved?: string; note?: string } | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string>('CREATED');
  const [errorText, setErrorText] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !correlationID) return;

    let active = true;
    const supabaseUrl = String((supabase as any).supabaseUrl || '');
    const supabaseKey = String((supabase as any).supabaseKey || '');
    const publicSupabase =
      supabaseUrl && supabaseKey
        ? createClient(supabaseUrl, supabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
            global: { headers: { 'x-pix-correlation': correlationID } }
          })
        : null;

    const poll = async () => {
      try {
        if (!publicSupabase) {
          setStatus('ERROR');
          setErrorText('Configuracao do Supabase indisponivel no navegador.');
          return;
        }

        const { data, error }: any = await publicSupabase
          .from('pix_checkouts')
          .select('status,order_id')
          .eq('correlation_id', correlationID)
          .maybeSingle();

        if (!active) return;

        if (error) {
          setStatus('ERROR');
          setErrorText(String(error?.message || 'Falha ao consultar status do pagamento.'));
          return;
        }

        if (!data) {
          setStatus('ERROR');
          setErrorText('Checkout nao encontrado.');
          return;
        }

        const nextStatus = String(data.status || '').toUpperCase();
        setRemoteStatus(nextStatus || 'CREATED');

        if (nextStatus === 'PAID' && data.order_id) {
          setStatus('PAID');
          const orderId = String(data.order_id);
          clearAllMenuCartStorage();
          if (onPaid) {
            active = false;
            onPaid(orderId);
            onClose();
            return;
          }
          window.location.href = `/track/${orderId}`;
          return;
        }

        setStatus('CREATED');
      } catch {
        if (active) {
          setStatus('ERROR');
        }
      }

      setTimeout(poll, 3000);
    };

    void poll();
    return () => {
      active = false;
    };
  }, [isOpen, correlationID, onClose, onPaid]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(brCode);
      setCopied(true);
      toast({ title: 'Codigo PIX copiado', description: 'Cole no seu app do banco para pagar.' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: 'Erro', description: 'Nao foi possivel copiar.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagamento via PIX</DialogTitle>
          <DialogDescription>Escaneie o QR Code ou copie o codigo para pagar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center p-4 space-y-4">
          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100 w-full relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#009EE3]" />

            <div className="flex flex-col items-center justify-center mb-4 mt-2">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mb-2">
                Processado por
              </span>
              <img
                src={MERCADO_PAGO_LOGO_SRC}
                alt="Mercado Pago"
                className="h-7 sm:h-8 object-contain"
                loading="eager"
              />
            </div>

            {qrCodeImage ? (
              <img
                src={qrCodeImage}
                alt="QR Code PIX"
                className="w-[200px] h-[200px] rounded-lg border bg-white p-2"
              />
            ) : (
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <QRCodeSVG value={brCode} size={200} />
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100 w-full flex flex-col items-center justify-center opacity-80">
              <img
                src={BORACUME_LOGO_SRC}
                alt="BoraCume"
                className="h-4 sm:h-5 object-contain"
                loading="eager"
              />
            </div>
          </div>

          <div className="w-full flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopy} disabled={!brCode}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Codigo'}
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
              Aguardando confirmacao do pagamento... ({remoteStatus})
            </div>
          )}

          {details?.mpStatus || details?.mpDetail ? (
            <div className="text-[11px] text-muted-foreground text-center">
              Mercado Pago: {details?.mpStatus || '-'}
              {details?.mpDetail ? ` - ${details.mpDetail}` : ''}
              {details?.note ? ` - ${details.note}` : ''}
            </div>
          ) : null}

          <div className="text-[11px] text-muted-foreground text-center">
            Checkout: {correlationID}
            {paymentId ? ` - Pagamento: ${paymentId}` : ''}
          </div>

          {status === 'ERROR' && (
            <div className="text-xs text-red-600">
              Erro ao verificar pagamento. {errorText ? String(errorText) : 'Tente novamente em instantes.'}
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
