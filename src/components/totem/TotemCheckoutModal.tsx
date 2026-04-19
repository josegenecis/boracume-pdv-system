import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Trash2, Minus, Plus, CreditCard, Banknote, Smartphone, CheckCircle2, Printer } from 'lucide-react';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { supabase } from '@/integrations/supabase/client';
import TotemPixCheckoutModal from '@/components/totem/TotemPixCheckoutModal';
import { PrinterService } from '@/utils/printerService';

interface TotemCartItem {
  product: { id: string; name: string; price: number; image_url?: string };
  quantity: number;
  variations: string[];
  options?: Array<{
    key?: string;
    label?: string;
    value?: string;
    price?: number;
  }>;
  notes: string;
  totalPrice: number;
  uniqueId: string;
}

interface TotemCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  cart: TotemCartItem[];
  onUpdateQuantity: (uniqueId: string, quantity: number) => void;
  onRemoveItem: (uniqueId: string) => void;
  onClearCart: () => void;
  total: number;
}

type Payment = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';

export default function TotemCheckoutModal(props: TotemCheckoutModalProps) {
  const { isOpen, onClose, userId, cart, onUpdateQuantity, onRemoveItem, onClearCart, total } = props;
  const [payment, setPayment] = useState<Payment>('pix');
  const [changeAmount, setChangeAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixCheckout, setPixCheckout] = useState<{ correlationID: string; brCode: string; qrCodeImage?: string; paymentLinkUrl?: string } | null>(null);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);
  const [orderNumber, setOrderNumber] = useState(() => `TOT${Date.now().toString().slice(-6)}`);
  const senha = useMemo(() => String(orderNumber).slice(-4), [orderNumber]);

  useEffect(() => {
    if (!isOpen) return;
    if (pixCheckout || successOrder) return;
    setOrderNumber(`TOT${Date.now().toString().slice(-6)}`);
  }, [isOpen, pixCheckout, successOrder]);

  const cartItems = useMemo(() => {
    return cart.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      price: item.product.price,
      options: Array.isArray(item.options) ? item.options : [],
      variations: item.variations,
      notes: item.notes,
      total: item.totalPrice
    }));
  }, [cart]);

  const canSubmit = useMemo(() => {
    if (!userId || cart.length === 0) return false;
    if (payment === 'dinheiro' && changeAmount) {
      const ca = Number(changeAmount);
      if (!Number.isFinite(ca) || ca < total) return false;
    }
    return true;
  }, [userId, cart.length, payment, changeAmount, total]);

  const resetToNewOrder = () => {
    setPixCheckout(null);
    setSuccessOrder(null);
    setIsSubmitting(false);
    setPayment('pix');
    setChangeAmount('');
    setOrderNumber(`TOT${Date.now().toString().slice(-6)}`);
    onClearCart();
    onClose();
  };

  const printCoupon = async (order: any) => {
    try {
      await PrinterService.printOrder(order);
    } catch {}
  };

  const finalizeNonPix = async () => {
    setIsSubmitting(true);
    try {
      const orderData: any = {
        user_id: userId,
        customer_name: `Totem`,
        customer_phone: null,
        customer_address: null,
        order_type: 'pickup',
        items: cartItems,
        total: total,
        delivery_fee: 0,
        payment_method: payment,
        change_amount: payment === 'dinheiro' && changeAmount ? Number(changeAmount) : null,
        status: 'pending',
        acceptance_status: 'pending_acceptance',
        order_number: orderNumber,
        variations: { source: 'TOTEM' }
      };

      const { data, error } = await (supabase as any)
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      setSuccessOrder(data);
      onClearCart();
      await printCoupon(data);
    } catch (e: any) {
      const msg = String(e?.message || e || 'Erro ao criar pedido');
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startPix = async () => {
    setIsSubmitting(true);
    try {
      const orderData: any = {
        user_id: userId,
        customer_name: `Totem`,
        customer_phone: null,
        customer_address: null,
        order_type: 'pickup',
        items: cartItems,
        total: total,
        delivery_fee: 0,
        payment_method: 'pix',
        change_amount: null,
        status: 'pending',
        acceptance_status: 'awaiting_pix_payment',
        order_number: orderNumber,
        variations: { source: 'TOTEM' }
      };

      const { data, status } = await invokeEdgeFunction('pix-start-checkout', {
        restaurantUserId: userId,
        orderPayload: orderData,
        preferredMethod: 'pix'
      });

      if (!data) {
        throw new Error(`Erro na conexão com checkout (HTTP ${status})`);
      }
      if (!data.ok) {
        throw new Error(data.error || `Não foi possível iniciar pagamento (HTTP ${status})`);
      }
      if (data.initPoint) {
        window.location.href = data.initPoint;
        return;
      }
      setPixCheckout({
        correlationID: data.correlationID,
        brCode: data.brCode,
        qrCodeImage: data.qrCodeImage,
        paymentLinkUrl: data.paymentLinkUrl
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaidPix = async (orderId: string) => {
    try {
      const { data } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      if (data) {
        setSuccessOrder(data);
        onClearCart();
        await printCoupon(data);
      }
      setPixCheckout(null);
    } catch {
      setPixCheckout(null);
    }
  };

  const handleConfirm = async () => {
    if (!canSubmit || isSubmitting) return;
    try {
      if (payment === 'pix') {
        await startPix();
        return;
      }
      await finalizeNonPix();
    } catch {}
  };

  if (successOrder) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Pedido confirmado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="p-5 bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/90">Sua senha</div>
                  <div className="text-5xl font-extrabold tracking-widest">{senha}</div>
                </div>
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <div className="mt-3 text-white/90 text-sm">
                Pedido {successOrder?.order_number ? `#${successOrder.order_number}` : ''}
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" className="h-12" onClick={() => printCoupon(successOrder)}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir novamente
              </Button>
              <Button className="h-12 bg-boracume-orange hover:bg-boracume-orange/90" onClick={resetToNewOrder}>
                Novo pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Finalizar no Totem</DialogTitle>
        </DialogHeader>

        {pixCheckout && (
          <TotemPixCheckoutModal
            isOpen={!!pixCheckout}
            onClose={() => setPixCheckout(null)}
            correlationID={pixCheckout.correlationID}
            brCode={pixCheckout.brCode}
            qrCodeImage={pixCheckout.qrCodeImage}
            paymentLinkUrl={pixCheckout.paymentLinkUrl}
            onPaid={handlePaidPix}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Itens</div>
            <div className="space-y-2">
              {cart.map((item) => (
                <Card key={item.uniqueId} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{item.product.name}</div>
                      {item.variations?.length ? (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.variations.join(', ')}</div>
                      ) : null}
                      {item.notes ? (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">Obs: {item.notes}</div>
                      ) : null}
                      <div className="text-sm font-bold text-boracume-orange mt-2">R$ {Number(item.totalPrice || 0).toFixed(2)}</div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onRemoveItem(item.uniqueId)} disabled={isSubmitting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => onUpdateQuantity(item.uniqueId, item.quantity - 1)} disabled={isSubmitting || item.quantity <= 1}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="w-8 text-center font-semibold">{item.quantity}</div>
                        <Button variant="outline" size="icon" onClick={() => onUpdateQuantity(item.uniqueId, item.quantity + 1)} disabled={isSubmitting}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Card className="p-4 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total</div>
                <div className="text-2xl font-extrabold">R$ {Number(total || 0).toFixed(2)}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">Senha do pedido: {senha}</div>
            </Card>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Pagamento</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={payment === 'pix' ? 'default' : 'outline'}
                  className={payment === 'pix' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  onClick={() => setPayment('pix')}
                  disabled={isSubmitting}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  PIX
                </Button>
                <Button
                  type="button"
                  variant={payment === 'dinheiro' ? 'default' : 'outline'}
                  className={payment === 'dinheiro' ? 'bg-sky-600 hover:bg-sky-700' : ''}
                  onClick={() => setPayment('dinheiro')}
                  disabled={isSubmitting}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Dinheiro
                </Button>
                <Button
                  type="button"
                  variant={payment === 'cartao_credito' ? 'default' : 'outline'}
                  className={payment === 'cartao_credito' ? 'bg-violet-600 hover:bg-violet-700' : ''}
                  onClick={() => setPayment('cartao_credito')}
                  disabled={isSubmitting}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Crédito
                </Button>
                <Button
                  type="button"
                  variant={payment === 'cartao_debito' ? 'default' : 'outline'}
                  className={payment === 'cartao_debito' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                  onClick={() => setPayment('cartao_debito')}
                  disabled={isSubmitting}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Débito
                </Button>
              </div>
            </div>

            {payment === 'dinheiro' ? (
              <div className="space-y-2">
                <Label>Troco para</Label>
                <Input
                  type="number"
                  value={changeAmount}
                  onChange={(e) => setChangeAmount(e.target.value)}
                  placeholder="0,00"
                  disabled={isSubmitting}
                />
                <div className="text-xs text-muted-foreground">
                  Deixe em branco se não precisa de troco
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Voltar
          </Button>
          <Button
            className="bg-boracume-orange hover:bg-boracume-orange/90"
            onClick={handleConfirm}
            disabled={!canSubmit || isSubmitting}
          >
            {payment === 'pix' ? 'Pagar com PIX' : 'Confirmar e imprimir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
