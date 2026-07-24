import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { clearAllMenuCartStorage } from '@/hooks/useSimpleCart';

const SDK_SRC = 'https://sdk.mercadopago.com/js/v2';

type BrickController = {
  unmount?: () => void | Promise<void>;
};

type CardFormData = {
  token?: string;
  installments?: number;
  payment_method_id?: string;
  issuer_id?: string | number;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

type MercadoPagoInstance = {
  bricks: () => {
    create: (
      brick: string,
      container: string,
      settings: Record<string, unknown>,
    ) => Promise<BrickController>;
  };
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  restaurantUserId: string;
  publicKey: string;
  amount: number;
  orderPayload: Record<string, unknown>;
  onPaid?: (orderId: string) => void;
};

const loadMercadoPagoSdk = () =>
  new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar o checkout seguro.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o checkout seguro.'));
    document.head.appendChild(script);
  });

export default function PopPayCardCheckoutModal({
  isOpen,
  onClose,
  restaurantUserId,
  publicKey,
  amount,
  orderPayload,
  onPaid,
}: Props) {
  const controllerRef = useRef<BrickController | null>(null);
  const attemptIdRef = useRef('');
  const activeRef = useRef(true);
  const processingRef = useRef(false);
  const orderPayloadRef = useRef(orderPayload);
  const onPaidRef = useRef(onPaid);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [correlationID, setCorrelationID] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    orderPayloadRef.current = orderPayload;
    onPaidRef.current = onPaid;
  }, [orderPayload, onPaid]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !publicKey || !Number.isFinite(amount) || amount <= 0) return;
    let cancelled = false;
    setReady(false);
    setError('');
    setCorrelationID('');
    setPaymentStatus('');
    setOrderId('');
    attemptIdRef.current = '';

    const mount = async () => {
      try {
        await loadMercadoPagoSdk();
        if (cancelled) return;
        const MercadoPago = window.MercadoPago;
        if (!MercadoPago) throw new Error('Checkout seguro indisponível.');
        const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
        const bricksBuilder = mp.bricks();
        controllerRef.current = await bricksBuilder.create('cardPayment', 'poppay-card-payment-brick', {
          initialization: {
            amount: Number(amount.toFixed(2)),
          },
          customization: {
            visual: {
              style: {
                theme: 'default',
                customVariables: {
                  baseColor: '#087A55',
                  baseColorFirstVariant: '#006747',
                  baseColorSecondVariant: '#004B36',
                },
              },
            },
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: 1,
              types: {
                excluded: ['debit_card', 'prepaid_card'],
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onError: (brickError: unknown) => {
              console.error('[PopPay Card Brick]', brickError);
              if (!cancelled) setError('Não foi possível carregar o formulário do cartão. Tente novamente.');
            },
            onSubmit: async (formData: CardFormData) => {
              if (processingRef.current) return;
              processingRef.current = true;
              setProcessing(true);
              setError('');
              if (!attemptIdRef.current) attemptIdRef.current = crypto.randomUUID();
              try {
                if (Number(formData?.installments || 1) !== 1) {
                  throw new Error('O crédito online está disponível somente à vista.');
                }
                const { data, status } = await invokeEdgeFunction('poppay-card-payment', {
                  restaurantUserId,
                  orderPayload: { ...orderPayloadRef.current, payment_method: 'cartao_online' },
                  attemptId: attemptIdRef.current,
                  cardToken: formData?.token,
                  paymentMethodId: formData?.payment_method_id,
                  issuerId: formData?.issuer_id,
                  payer: {
                    email: formData?.payer?.email,
                    identification: formData?.payer?.identification,
                  },
                  installments: 1,
                }, { timeoutMs: 90000 });

                if (status >= 400 || !data?.ok) {
                  throw new Error(String(data?.message || data?.error || 'O pagamento não foi aprovado.'));
                }

                const nextCorrelation = String(data?.correlationID || '');
                const nextStatus = String(data?.status || '').toUpperCase();
                const nextOrderId = String(data?.orderId || '');
                setCorrelationID(nextCorrelation);
                setPaymentStatus(nextStatus);
                setOrderId(nextOrderId);

                if (nextOrderId) {
                  clearAllMenuCartStorage();
                  onPaidRef.current?.(nextOrderId);
                }
              } catch (submitError) {
                attemptIdRef.current = '';
                setError(submitError instanceof Error ? submitError.message : 'O pagamento não foi aprovado.');
                throw submitError;
              } finally {
                processingRef.current = false;
                if (activeRef.current) setProcessing(false);
              }
            },
          },
        });
      } catch (mountError) {
        if (!cancelled) setError(mountError instanceof Error ? mountError.message : 'Checkout indisponível.');
      }
    };

    void mount();
    return () => {
      cancelled = true;
      const controller = controllerRef.current;
      controllerRef.current = null;
      if (controller?.unmount) {
        try {
          void controller.unmount();
        } catch (unmountError) {
          console.warn('[PopPay Card Brick] Falha ao desmontar checkout.', unmountError);
        }
      }
    };
  }, [isOpen, publicKey, amount, restaurantUserId]);

  useEffect(() => {
    if (!isOpen || !correlationID || orderId) return;
    let active = true;
    const publicSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { 'x-pix-correlation': correlationID } },
    });

    const poll = async () => {
      const { data } = await publicSupabase
        .from('pix_checkouts')
        .select('status,order_id')
        .eq('correlation_id', correlationID)
        .maybeSingle();
      if (!active) return;
      const nextStatus = String(data?.status || '').toUpperCase();
      setPaymentStatus(nextStatus);
      const nextOrderId = String(data?.order_id || '');
      if (nextStatus === 'PAID' && nextOrderId) {
        setOrderId(nextOrderId);
        clearAllMenuCartStorage();
        onPaidRef.current?.(nextOrderId);
        return;
      }
      window.setTimeout(() => void poll(), 2500);
    };
    void poll();
    return () => {
      active = false;
    };
  }, [isOpen, correlationID, orderId]);

  const paid = paymentStatus === 'PAID' && Boolean(orderId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !processing) onClose(); }}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-950">
            <CreditCard className="h-5 w-5 text-orange-500" />
            Crédito online
          </DialogTitle>
          <DialogDescription>
            Pagamento seguro à vista, processado pelo Mercado Pago sem sair do PopSystem.
          </DialogDescription>
        </DialogHeader>

        {paid ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-600" />
            <h3 className="mt-4 text-xl font-black text-emerald-950">Pagamento aprovado</h3>
            <p className="mt-2 text-sm text-muted-foreground">Seu pedido foi enviado ao restaurante.</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-950">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Seus dados são protegidos e não ficam armazenados no PopSystem.
              </div>
              <p className="mt-1 text-xs">Valor: R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • somente 1x</p>
            </div>
            {!ready && !error ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Carregando checkout seguro...
              </div>
            ) : null}
            <div id="poppay-card-payment-brick" className={processing ? 'pointer-events-none opacity-60' : ''} />
            {processing ? (
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-800">
                <Loader2 className="h-4 w-4 animate-spin" />Processando pagamento...
              </div>
            ) : null}
            {correlationID && !paid && !error ? (
              <p className="text-center text-xs text-muted-foreground">
                Confirmando pedido... {paymentStatus || 'PROCESSANDO'}
              </p>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}
          </>
        )}

        <Button variant="outline" onClick={onClose} disabled={processing}>
          {paid ? 'Acompanhar pedido' : 'Fechar'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
