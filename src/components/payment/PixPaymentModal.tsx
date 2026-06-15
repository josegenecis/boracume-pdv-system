import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { buildPixPayload } from '@/utils/pix';

interface PixPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    orderId?: string;
    onPaymentConfirmed?: () => void;
}

const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
    isOpen,
    onClose,
    amount,
    orderId,
    onPaymentConfirmed
}) => {
    const [pixCode, setPixCode] = useState('');
    const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
    const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'awaiting' | 'paid' | 'error'>('idle');
    const { toast } = useToast();

    const generatePixCode = async () => {
        if (!orderId) {
            setStatus('error');
            toast({ title: 'PIX', description: 'Pedido não encontrado para gerar o PIX.', variant: 'destructive' });
            return;
        }
        setLoading(true);
        setStatus('awaiting');
        try {
            const { data: order, error: orderErr } = await supabase
                .from('orders')
                .select('id, order_number, user_id, acceptance_status, customer_name, customer_phone, order_type, delivery_fee, items, total')
                .eq('id', orderId)
                .maybeSingle();
            if (orderErr || !order) throw new Error('Não foi possível carregar o pedido');

            const { data: pixDb, error: pixDbErr } = await supabase
                .from('pix_settings')
                .select('enabled, bank, client_id, mp_access_token, mp_refresh_token, mp_pdv_enabled')
                .eq('user_id', order.user_id)
                .maybeSingle();

            if (pixDbErr) {
                throw new Error(pixDbErr.message || 'Falha ao carregar configuração do PIX.');
            }

            const providerKey = String((pixDb as any)?.bank || 'mercadopago')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
            const isMercadoPagoProvider = !providerKey || providerKey === 'mp' || providerKey.includes('mercadopago');
            const canUseMercadoPago =
                Boolean((pixDb as any)?.enabled) &&
                isMercadoPagoProvider &&
                Boolean((pixDb as any)?.mp_pdv_enabled) &&
                Boolean((pixDb as any)?.client_id || (pixDb as any)?.mp_access_token || (pixDb as any)?.mp_refresh_token);
            if (canUseMercadoPago) {
                const payload: any = {
                    order_id: order.id,
                    order_number: order.order_number,
                    total: amount,
                    delivery_fee: Number(order.delivery_fee || 0) || 0,
                    payment_method: 'pix_online',
                    customer_name: order.customer_name || 'Cliente',
                    customer_phone: order.customer_phone || '',
                    order_type: order.order_type || 'counter',
                    items: Array.isArray(order.items) ? order.items : [],
                };

                const { data: mpData, error: mpErr }: any = await supabase.functions.invoke('pix-start-checkout', {
                    body: { restaurantUserId: order.user_id, orderPayload: payload, preferredMethod: 'pix', orderId: order.id } as any
                });

                if (!mpErr && mpData?.ok && mpData?.brCode) {
                    setPixCode(String(mpData.brCode));
                    setQrCodeImage(mpData.qrCodeImage ? String(mpData.qrCodeImage) : null);
                    setPaymentLinkUrl(mpData.paymentLinkUrl ? String(mpData.paymentLinkUrl) : null);
                    setStatus(order.acceptance_status === 'pending_acceptance' ? 'paid' : 'awaiting');
                    return;
                }
            }

            const { data: pixSettings }: any = await supabase.functions.invoke('pix-settings-public', { body: { userId: order.user_id } as any })
            const settings = pixSettings?.settings
            if (!settings?.pix_key) {
                throw new Error('PIX não está configurado para este restaurante');
            }

            const code = buildPixPayload({
                pixKey: settings.pix_key,
                amount,
                merchantName: settings.merchant_name || 'PopSystem',
                merchantCity: settings.merchant_city || 'BRASIL',
                txid: order.order_number || order.id,
                description: `Pedido ${order.order_number || ''}`.trim()
            });
            setPixCode(code);
            setQrCodeImage(null);
            setPaymentLinkUrl(null);
            setStatus(order.acceptance_status === 'pending_acceptance' ? 'paid' : 'awaiting');
        } catch (e: any) {
            setStatus('error');
            toast({ title: 'PIX', description: e?.message || 'Falha ao gerar o PIX', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            generatePixCode();
        } else {
            setPixCode('');
            setQrCodeImage(null);
            setPaymentLinkUrl(null);
            setCopied(false);
            setStatus('idle');
        }
    }, [isOpen, amount]);

    useEffect(() => {
        if (!isOpen || !orderId) return;
        const channel = supabase.channel(`pix-order-${orderId}`);
        channel
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${orderId}`,
            }, (payload: any) => {
                const next = payload?.new?.acceptance_status;
                if (next === 'pending_acceptance' || next === 'accepted') {
                    setStatus('paid');
                }
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [isOpen, orderId]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(pixCode);
            setCopied(true);
            toast({
                title: "Código PIX copiado",
                description: "Cole no seu aplicativo de banco para pagar.",
            });

            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleConfirm = () => {
        if (onPaymentConfirmed) {
            onPaymentConfirmed();
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pagamento via PIX</DialogTitle>
                    <DialogDescription>
                        Escaneie o QR Code ou copie o código para pagar.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center p-6 space-y-4">
                    {loading ? (
                        <div className="h-48 w-48 flex items-center justify-center border-2 border-dashed rounded-lg">
                            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        qrCodeImage ? (
                            <img src={qrCodeImage} alt="QR Code PIX" className="w-[200px] h-[200px] rounded-lg border bg-white p-2" />
                        ) : (
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                                <QRCodeSVG value={pixCode} size={200} />
                            </div>
                        )
                    )}

                    <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-1">Valor a pagar</p>
                        <p className="text-2xl font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                        </p>
                    </div>
                    {status === 'paid' && (
                        <div className="text-center text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 w-full">
                            Pagamento confirmado. Aguarde o restaurante aceitar o pedido.
                        </div>
                    )}
                    {status === 'awaiting' && (
                        <div className="text-center text-xs text-muted-foreground w-full">
                            Após pagar, o pedido será liberado automaticamente quando o pagamento for confirmado.
                        </div>
                    )}

                    <div className="w-full flex gap-2">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={handleCopy}
                            disabled={loading || !pixCode}
                        >
                            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {copied ? 'Copiado!' : 'Copiar Código'}
                        </Button>
                        {paymentLinkUrl ? (
                            <Button variant="outline" onClick={() => window.open(paymentLinkUrl, '_blank')}>
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700" disabled={status !== 'paid'}>
                        Concluir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PixPaymentModal;
