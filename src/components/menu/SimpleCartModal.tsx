
import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trash2, Plus, Minus, Navigation, MapPin, Phone, User, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCustomerLookup } from '@/hooks/useCustomerLookup';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import PixCheckoutModal from '@/components/payment/PixCheckoutModal';

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
  };
  quantity: number;
  variations: string[];
  notes: string;
  totalPrice: number;
  uniqueId: string;
}

type UpsellOffer = {
  ruleId: string;
  triggerProductId: string | null;
  message: string | null;
  product: { id: string; name: string; price: number; description?: string; image_url?: string };
};

interface SimpleCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  onUpdateQuantity: (uniqueId: string, quantity: number) => void;
  onRemoveItem: (uniqueId: string) => void;
  onPlaceOrder: (orderData: any) => void;
  deliveryZones?: any[];
  userId: string;
}

export const SimpleCartModal: React.FC<SimpleCartModalProps> = ({
  isOpen,
  onClose,
  cart,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  deliveryZones = [],
  userId
}) => {
  const formatBRL = (value: number) =>
    `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
  const [customerNeighborhood, setCustomerNeighborhood] = React.useState('');
  const [customerAddress, setCustomerAddress] = React.useState('');
  const [isExistingCustomer, setIsExistingCustomer] = React.useState(false);
  const [deliveryZoneId, setDeliveryZoneId] = React.useState('');
  const [isDetectingZone, setIsDetectingZone] = React.useState(false);
  const [detectZoneError, setDetectZoneError] = React.useState<string | null>(null);
  const [deliveryQuote, setDeliveryQuote] = React.useState<any | null>(null);
  const detectTimerRef = useRef<number | null>(null);
  const zoneWasAutoRef = useRef(false);
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [changeAmount, setChangeAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [pixCheckout, setPixCheckout] = React.useState<null | { correlationID: string; brCode: string; qrCodeImage?: string; paymentLinkUrl?: string }>(null);
  const [upsellOpen, setUpsellOpen] = React.useState(false);
  const [upsellOffers, setUpsellOffers] = React.useState<UpsellOffer[]>([]);
  const [pendingOrderData, setPendingOrderData] = React.useState<any | null>(null);
  const [upsellSelectedProduct, setUpsellSelectedProduct] = React.useState<any | null>(null);
  const [upsellVariationOpen, setUpsellVariationOpen] = React.useState(false);
  const [upsellBusy, setUpsellBusy] = React.useState(false);
  
  // Coupon State
  const [couponCode, setCouponCode] = React.useState('');
  const [couponError, setCouponError] = React.useState('');
  const [discount, setDiscount] = React.useState(0);
  const [appliedCoupon, setAppliedCoupon] = React.useState<{ code: string; type: string } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = React.useState(false);

  const [location, setLocation] = React.useState({
    latitude: null as number | null,
    longitude: null as number | null,
    accuracy: null as number | null,
    isLoading: false,
    error: null as string | null
  });


  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const isPixSelected = (selectedPaymentMethod as any)?.id === 'pix';
  const [step, setStep] = useState<'bag' | 'checkout'>('bag');
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const phoneLookupTimerRef = useRef<number | null>(null);
  const lastLookupDigitsRef = useRef<string>('');

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('payment_methods')
          .select('*')
          .eq('user_id', userId)
          .order('name');

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((m: any) => ({
            ...m,
            extra_fee_percent: m.extra_fee_percent ?? 0,
            is_card: m.is_card ?? false,
            icon: m.icon || (m.id === 'pix' ? 'pix' : m.is_card ? 'cartao_credito' : 'dinheiro')
          }));
          setPaymentMethods(mapped);
          setSelectedPaymentMethod(mapped[0] || null);
          setPaymentMethod(mapped[0]?.id || '');
        } else {
          // Fallback para ambientes onde o fetch falha ou não há métodos cadastrados
          const fallback = [
            { id: 'pix', name: 'PIX', is_card: false, extra_fee_percent: 0, icon: 'pix' },
            { id: 'cartao_credito', name: 'Cartão de Crédito', is_card: true, extra_fee_percent: 0, icon: 'cartao_credito' },
            { id: 'cartao_debito', name: 'Cartão de Débito', is_card: true, extra_fee_percent: 0, icon: 'cartao_debito' },
            { id: 'dinheiro', name: 'Dinheiro', is_card: false, extra_fee_percent: 0, icon: 'dinheiro' }
          ];
          setPaymentMethods(fallback as any);
          setSelectedPaymentMethod(fallback[0] as any);
          setPaymentMethod((fallback[0] as any)?.id || '');
        }
      } catch (e) {
        const fallback = [
          { id: 'pix', name: 'PIX', is_card: false, extra_fee_percent: 0, icon: 'pix' },
          { id: 'cartao_credito', name: 'Cartão de Crédito', is_card: true, extra_fee_percent: 0, icon: 'cartao_credito' },
          { id: 'cartao_debito', name: 'Cartão de Débito', is_card: true, extra_fee_percent: 0, icon: 'cartao_debito' },
          { id: 'dinheiro', name: 'Dinheiro', is_card: false, extra_fee_percent: 0, icon: 'dinheiro' }
        ];
        setPaymentMethods(fallback as any);
        setSelectedPaymentMethod(fallback[0] as any);
        setPaymentMethod((fallback[0] as any)?.id || '');
      }
    };
    if (isOpen) fetchPaymentMethods();
  }, [isOpen, userId]);

  useEffect(() => {
    if (isOpen) setStep('bag');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (step !== 'checkout') return;
    window.setTimeout(() => {
      try {
        phoneInputRef.current?.focus();
      } catch {}
    }, 0);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    if (!userId) return;

    const addr = String(customerAddress || '').trim();
    const hasGps = typeof location.latitude === 'number' && typeof location.longitude === 'number';
    if (!hasGps && addr.length < 8) return;

    if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current);
    detectTimerRef.current = window.setTimeout(async () => {
      try {
        setIsDetectingZone(true);
        setDetectZoneError(null);

        const { data } = await invokeEdgeFunction('delivery-quote', {
          userId,
          address: addr || undefined,
          lat: hasGps ? location.latitude : undefined,
          lng: hasGps ? location.longitude : undefined,
          cartTotal: total
        }, { timeoutMs: 8000 });

        if (data?.ok) {
          setDeliveryQuote(data);
          const mode = String(data?.mode || '');
          if (mode === 'neighborhood' && data?.zone?.id) {
            if (!deliveryZoneId || zoneWasAutoRef.current) {
              zoneWasAutoRef.current = true;
              setDeliveryZoneId(String(data.zone.id));
            }
          } else {
            if (zoneWasAutoRef.current) setDeliveryZoneId('');
          }
          return;
        }

        const message = String(data?.error || 'Não foi possível detectar a área de entrega.')
        setDetectZoneError(message);
        setDeliveryQuote(null);
      } catch (e: any) {
        setDetectZoneError(e?.message || 'Falha ao detectar área de entrega. Tente novamente.')
        setDeliveryQuote(null);
      } finally {
        setIsDetectingZone(false);
      }
    }, 650);

    return () => {
      if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current);
      detectTimerRef.current = null;
    };
  }, [isOpen, userId, customerAddress, location.latitude, location.longitude, total, deliveryZoneId]);
  const selectedZone = deliveryZones.find(zone => zone.id === deliveryZoneId);
  const quoteMode = String(deliveryQuote?.mode || '');
  const quoteZone = deliveryQuote?.zone || null;
  const deliveryFee = deliveryZoneId !== '' ? (selectedZone?.delivery_fee || 0) : (Number(quoteZone?.delivery_fee || 0) || 0);
  // Calcular taxa extra como percentual, igual ao CheckoutModal
  const computedExtraFee = selectedPaymentMethod && selectedPaymentMethod.extra_fee_percent > 0 ? (total + deliveryFee) * (selectedPaymentMethod.extra_fee_percent / 100) : 0;
  
  // Calcular Total Final com Desconto
  const preTotal = total + deliveryFee + computedExtraFee;
  const finalTotal = Math.max(0, preTotal - discount);

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setIsValidatingCoupon(true);
    setCouponError('');
    setDiscount(0);
    setAppliedCoupon(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { 
          code: couponCode, 
          cartTotal: total, 
          userId: userId,
          // customerId: ??? (Se tivéssemos o ID do cliente logado, passaria aqui)
        }
      });

      if (error) throw error;

      if (!data.valid) {
        setCouponError(data.message);
        return;
      }

      setDiscount(data.discountAmount);
      setAppliedCoupon({ code: couponCode, type: data.type });
      
      // Se for frete grátis e o desconto veio 0 da API (porque ela não sabe o frete), aplicamos aqui
      if (data.type === 'shipping' || data.type === 'free_shipping') {
        setDiscount(deliveryFee);
      }

    } catch (err: any) {
      console.error('Erro cupom:', err);
      setCouponError('Erro ao validar cupom');
    } finally {
      setIsValidatingCoupon(false);
    }
  };



  const { lookupCustomer, isLoading: isLookingUp } = useCustomerLookup(userId);

  const paymentOptions = [
    { value: 'pix', label: 'PIX', icon: Smartphone },
    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: CreditCard },
    { value: 'cartao_debito', label: 'Cartão de Débito', icon: CreditCard },
    { value: 'dinheiro', label: 'Dinheiro', icon: Banknote }
  ];

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, error: 'Geolocalização não é suportada neste dispositivo' }));
      return;
    }

    setLocation(prev => ({ ...prev, isLoading: true, error: null }));

    // Request permission first for mobile devices
    const requestPermission = async () => {
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          console.log('📍 Permissão de geolocalização:', permission.state);
          
          if (permission.state === 'denied') {
            setLocation(prev => ({ 
              ...prev, 
              isLoading: false, 
              error: "Permissão de localização negada. Ative nas configurações do navegador." 
            }));
            return;
          }
        } catch (permError) {
          console.log('⚠️ Não foi possível verificar permissões:', permError);
        }
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Localização obtida:', position.coords);
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            isLoading: false,
            error: null
          });
        },
        (error) => {
          console.error('❌ Erro de geolocalização:', error);
          let errorMessage = "Erro desconhecido ao obter localização";
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permissão de localização negada. Verifique as configurações do seu navegador/celular.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Informações de localização não disponíveis. Tente novamente.";
              break;
            case error.TIMEOUT:
              errorMessage = "Tempo esgotado ao obter localização. Tente novamente.";
              break;
          }
          
          setLocation(prev => ({ ...prev, isLoading: false, error: errorMessage }));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased timeout for mobile
          maximumAge: 300000 // 5 minutes cache
        }
      );
    };

    requestPermission();
  };

  const generateGoogleMapsLink = (lat: number, lng: number) => {
    return `https://maps.google.com/maps?q=${lat},${lng}`;
  };

  const isFormValid = () => {

    const isPaymentValid = paymentMethod !== '';

    const hasDelivery = deliveryZoneId !== '' || (deliveryQuote && quoteMode && quoteMode !== 'neighborhood');
    
    const valid = (
      customerName.trim() !== '' &&
      customerPhone.trim() !== '' &&
      customerAddress.trim() !== '' &&
      hasDelivery &&
      isPaymentValid &&
      (paymentMethod !== 'dinheiro' || changeAmount === '' || parseFloat(changeAmount) >= finalTotal)
    );
    
    console.log('💳 VALIDAÇÃO FORMULÁRIO:', {
      customerName: customerName.trim() !== '',
      customerPhone: customerPhone.trim() !== '',
      customerAddress: customerAddress.trim() !== '',
      deliveryZoneId: deliveryZoneId !== '',
      quoteMode,
      paymentMethod: paymentMethod,
      isPaymentValid,
      changeValid: paymentMethod !== 'dinheiro' || changeAmount === '' || parseFloat(changeAmount) >= finalTotal,
      finalValid: valid
    });
    
    return valid;
  };

  const placeOrderNow = async (data: any) => {
    await onPlaceOrder(data);
  };

  const startPixCheckout = async (orderData: any) => {
    const { data, status } = await invokeEdgeFunction('pix-start-checkout', {
      restaurantUserId: userId,
      orderPayload: orderData,
      preferredMethod: 'pix'
    }, { timeoutMs: 60000 });

    if (!data) throw new Error(`Erro na conexão com checkout (HTTP ${status})`);
    if (!data.ok) {
      const providerMessage =
        data?.details?.message ||
        data?.details?.error ||
        data?.details?.cause?.[0]?.description ||
        data?.details?.cause?.[0]?.message ||
        '';
      const cid = data?.correlationID ? ` (cid: ${String(data.correlationID)})` : '';
      const msg = providerMessage ? `Mercado Pago: ${String(providerMessage)}${cid}` : `${String(data.error || data.message || 'Não foi possível iniciar pagamento')}${cid}`;
      throw new Error(msg);
    }

    if (data.initPoint) {
      window.location.href = String(data.initPoint);
      return;
    }

    setPixCheckout({
      correlationID: String(data.correlationID),
      brCode: String(data.brCode || ''),
      qrCodeImage: data.qrCodeImage ? String(data.qrCodeImage) : undefined,
      paymentLinkUrl: data.paymentLinkUrl ? String(data.paymentLinkUrl) : undefined
    });
  };

  const finalizeOrder = async (orderData: any) => {
    if (String(orderData?.payment_method || '') === 'pix') {
      await startPixCheckout(orderData);
      onClose();
      return;
    }
    await placeOrderNow(orderData);
  };

  const hasProductVariations = async (productId: string) => {
    try {
      const [{ count: c1 }, { count: c2 }] = await Promise.all([
        (supabase.from('product_variations') as any)
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId),
        (supabase.from('product_global_variation_links') as any)
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
      ]);
      return Number(c1 || 0) > 0 || Number(c2 || 0) > 0;
    } catch {
      return false;
    }
  };

  const applyUpsellAndPlace = async (product: any, quantity: number, variations: string[], itemNotes: string, variationPrice: number) => {
    const base = pendingOrderData;
    if (!base) return;
    const unitPrice = Number(product?.price || 0) + Number(variationPrice || 0);
    const lineTotal = unitPrice * Math.max(1, Number(quantity || 1));
    const next = {
      ...base,
      items: [
        ...(Array.isArray(base.items) ? base.items : []),
        {
          product_id: String(product.id),
          product_name: String(product.name || ''),
          quantity: Math.max(1, Number(quantity || 1)),
          price: Number(product.price || 0),
          variations: Array.isArray(variations) ? variations : [],
          notes: String(itemNotes || ''),
          total: Number(lineTotal || 0)
        }
      ],
      total: Number(base.total || 0) + Number(lineTotal || 0)
    };
    setUpsellOpen(false);
    setUpsellOffers([]);
    setPendingOrderData(null);
    setUpsellSelectedProduct(null);
    setUpsellVariationOpen(false);
    await finalizeOrder(next);
  };

  const skipUpsellAndPlace = async () => {
    const base = pendingOrderData;
    if (!base) return;
    if (upsellBusy) return;
    setUpsellBusy(true);
    try {
      setUpsellOpen(false);
      setUpsellOffers([]);
      setPendingOrderData(null);
      await finalizeOrder(base);
    } finally {
      setUpsellBusy(false);
    }
  };

  const chooseUpsellOffer = async (offer: UpsellOffer) => {
    if (!offer?.product?.id) return;
    if (upsellBusy) return;
    setUpsellBusy(true);
    try {
      const hasVars = await hasProductVariations(String(offer.product.id));
      if (!hasVars) {
        await applyUpsellAndPlace(offer.product, 1, [], '', 0);
        return;
      }
      setUpsellSelectedProduct(offer.product);
      setUpsellVariationOpen(true);
      setUpsellOpen(false);
    } finally {
      setUpsellBusy(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!isFormValid()) return;
    setIsLoading(true);

    try {
      const phoneDigits = String(customerPhone || '').replace(/\D/g, '');
      const neighborhood = String(customerNeighborhood || '').trim() || String(selectedZone?.name || '').trim() || String(quoteZone?.name || '').trim() || '';
      const baseOrderData = {
        user_id: userId,
        customer_name: customerName,
        customer_phone: phoneDigits,
        customer_address: customerAddress,
        customer_neighborhood: neighborhood,
        delivery_zone_id: deliveryZoneId || null,
        payment_method: paymentMethod,
        change_amount: paymentMethod === 'dinheiro' ? parseFloat(changeAmount) || null : null,
        delivery_instructions: notes,
        customer_latitude: location.latitude,
        customer_longitude: location.longitude,
        customer_location_accuracy: location.accuracy ? Math.round(location.accuracy) : null,
        google_maps_link: location.latitude && location.longitude ? generateGoogleMapsLink(location.latitude, location.longitude) : null,
        items: cart.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          variations: item.variations,
          notes: item.notes,
          total: item.totalPrice
        })),
        delivery_fee: deliveryFee,
        discount: discount,
        coupon_code: appliedCoupon?.code,
        total: finalTotal,
        status: 'pending',
        order_type: 'delivery',
        order_number: 'PED' + Date.now().toString().slice(-6)
      };

      const offers = await (async (): Promise<UpsellOffer[]> => {
        try {
          const rulesRes = await supabase
            .from('upsell_rules')
            .select('id,trigger_product_id,suggested_product_id,message,active,display_order')
            .eq('user_id', userId)
            .eq('active', true)
            .order('display_order', { ascending: true }) as any;
          if (rulesRes.error) {
            if (String(rulesRes.error.code || '') === '42P01') return [];
            return [];
          }
          const rules = Array.isArray(rulesRes.data) ? rulesRes.data : [];
          const cartProductIds = new Set(cart.map((i) => String(i.product.id)));
          const applicable = rules.filter((r: any) => !r.trigger_product_id || cartProductIds.has(String(r.trigger_product_id)));
          const suggestedIds = Array.from(new Set(applicable.map((r: any) => String(r.suggested_product_id || '')).filter(Boolean)));
          if (suggestedIds.length === 0) return [];

          const productsRes = await (supabase.from('products') as any)
            .select('id,name,description,price,image_url')
            .eq('user_id', userId)
            .eq('is_available', true)
            .eq('show_in_delivery', true)
            .in('id', suggestedIds);
          if (productsRes.error) return [];
          const byId = new Map((productsRes.data || []).map((p: any) => [String(p.id), p]));

          const out: UpsellOffer[] = [];
          for (const r of applicable) {
            const pid = String(r.suggested_product_id || '');
            const p = byId.get(pid);
            if (!p) continue;
            out.push({
              ruleId: String(r.id),
              triggerProductId: r.trigger_product_id ? String(r.trigger_product_id) : null,
              message: r.message ? String(r.message) : null,
              product: {
                id: String(p.id),
                name: String(p.name || ''),
                description: p.description ? String(p.description) : '',
                price: Number(p.price || 0),
                image_url: p.image_url ? String(p.image_url) : ''
              }
            });
          }
          return out.slice(0, 3);
        } catch {
          return [];
        }
      })();

      if (offers.length === 0) {
        await finalizeOrder(baseOrderData);
        return;
      }

      setPendingOrderData(baseOrderData);
      setUpsellOffers(offers);
      setUpsellOpen(true);
    } catch (error: any) {
      console.error('Erro ao finalizar pedido:', error);
      alert(`Erro ao finalizar pedido: ${error.message || error}. Se for pagamento online, verifique se o PIX/checkout está configurado para o restaurante.`);
    } finally {
      setIsLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Carrinho</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Seu carrinho está vazio</p>
            <Button onClick={onClose} className="mt-4">
              Continuar comprando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {pixCheckout ? (
        <PixCheckoutModal
          isOpen={!!pixCheckout}
          onClose={() => setPixCheckout(null)}
          correlationID={pixCheckout.correlationID}
          brCode={pixCheckout.brCode}
          qrCodeImage={pixCheckout.qrCodeImage}
          paymentLinkUrl={pixCheckout.paymentLinkUrl}
        />
      ) : null}
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden bg-white shadow-2xl border border-gray-100 rounded-none sm:rounded-xl p-0">
        <div className="flex flex-col h-full min-h-0">
          <DialogHeader className="border-b border-gray-100 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-lg font-bold text-gray-900">
                {step === 'bag' ? 'SACOLA' : 'Finalizar pedido'}
              </DialogTitle>
              {step === 'checkout' ? (
                <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={() => setStep('bag')}>
                  Voltar
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={onClose}>
                  Fechar
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-4 space-y-6">
            {step === 'bag' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Itens adicionados</h3>
                  <Button variant="ghost" className="text-boracume-orange" onClick={onClose}>
                    Adicionar mais itens
                  </Button>
                </div>

                <div className="space-y-4">
                  {cart.map((item) => (
                    <Card key={item.uniqueId} className="p-4 border border-gray-100 shadow-sm rounded-xl">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{item.product.name}</h4>
                          {item.variations.length > 0 && (
                            <p className="text-sm text-gray-600 mt-1">{item.variations.join(', ')}</p>
                          )}
                          {item.notes && (
                            <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded-lg mt-2">Obs: {item.notes}</p>
                          )}
                          <p className="text-sm font-bold text-boracume-orange mt-2">{formatBRL(item.totalPrice)}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdateQuantity(item.uniqueId, item.quantity - 1)}
                            className="rounded-lg border-gray-200"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUpdateQuantity(item.uniqueId, item.quantity + 1)}
                            className="rounded-lg border-gray-200"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRemoveItem(item.uniqueId)}
                            className="rounded-lg border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Subtotal</span>
                    <span className="font-bold">{formatBRL(total)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                    <span className="text-gray-900">Total</span>
                    <span className="text-boracume-orange">{formatBRL(total)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">

          {/* Dados do cliente */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Dados para entrega:</h3>
            
            <div>
              <Label htmlFor="phone">WhatsApp *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  ref={phoneInputRef}
                  value={customerPhone}
                  onChange={async (e) => {
                    const phone = e.target.value;
                    setCustomerPhone(phone);
                    
                    // Auto-lookup customer if phone has enough digits
                    const digits = phone.replace(/\D/g, '');
                    if (digits.length < 10) {
                      setIsExistingCustomer(false);
                      lastLookupDigitsRef.current = '';
                      if (phoneLookupTimerRef.current) window.clearTimeout(phoneLookupTimerRef.current);
                      phoneLookupTimerRef.current = null;
                      return;
                    }

                    if (digits === lastLookupDigitsRef.current) return;
                    lastLookupDigitsRef.current = digits;
                    if (phoneLookupTimerRef.current) window.clearTimeout(phoneLookupTimerRef.current);
                    phoneLookupTimerRef.current = window.setTimeout(async () => {
                      const customer = await lookupCustomer(digits);
                      if (customer) {
                        setCustomerName((prev) => prev.trim() ? prev : customer.name);
                        setCustomerAddress((prev) => prev.trim() ? prev : customer.address);
                        setCustomerNeighborhood((prev) => prev.trim() ? prev : String((customer as any)?.neighborhood || ''));
                        const zoneId = String((customer as any)?.deliveryZoneId || '');
                        if (zoneId && (!deliveryZoneId || zoneWasAutoRef.current)) {
                          zoneWasAutoRef.current = true;
                          setDeliveryZoneId(zoneId);
                        }
                        setIsExistingCustomer(true);
                      } else {
                        setIsExistingCustomer(false);
                      }
                    }, 350);
                  }}
                  placeholder="(11) 99999-9999"
                  className="pl-10"
                />
                {isLookingUp && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin h-4 w-4 border-2 border-boracume-orange border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
              {isExistingCustomer && (
                <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                  <CheckCircle className="h-4 w-4" />
                  Cliente encontrado! Dados preenchidos automaticamente.
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="name">Nome completo *</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                value={customerNeighborhood}
                onChange={(e) => setCustomerNeighborhood(e.target.value)}
                placeholder="Ex: Centro"
              />
            </div>

            <div>
              <Label htmlFor="address">Endereço completo *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Rua, número, complemento, bairro"
                  rows={2}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Localização Exata (GPS)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={requestLocation}
                  disabled={location.isLoading}
                  className="flex items-center gap-2"
                >
                  <Navigation className="h-4 w-4" />
                  {location.isLoading ? 'Obtendo localização...' : 'Usar minha localização'}
                </Button>
              </div>
              
              {location.latitude && location.longitude && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                  ✅ Localização capturada com precisão de {Math.round(location.accuracy || 0)}m
                </div>
              )}
              
              {location.error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  ❌ {location.error}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                A localização GPS ajuda o entregador a encontrar você com mais facilidade
              </p>
            </div>

            {quoteMode !== 'neighborhood' && deliveryQuote?.ok ? (
              <div className="p-3 border rounded-lg bg-gray-50">
                <div className="text-sm font-medium">Frete calculado automaticamente</div>
                <div className="text-sm text-muted-foreground">
                  R$ {Number(quoteZone?.delivery_fee || 0).toFixed(2)}
                  {typeof deliveryQuote?.distanceKm === 'number' ? ` • ${Number(deliveryQuote.distanceKm).toFixed(2)} km` : ''}
                </div>
              </div>
            ) : (
              <div>
                <Label htmlFor="zone">Área de entrega *</Label>
                <Select
                  value={deliveryZoneId}
                  onValueChange={(v) => {
                    zoneWasAutoRef.current = false;
                    setDeliveryQuote(null);
                    setDeliveryZoneId(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua área" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryZones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name} - R$ {zone.delivery_fee.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isDetectingZone && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Detectando bairro automaticamente...
                  </div>
                )}
                {detectZoneError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    ❌ {detectZoneError}
                  </div>
                )}
              </div>
            )}

            <div>

              <RadioGroup 
                value={selectedPaymentMethod?.id || ''} 
                onValueChange={(value) => {
                  const method = paymentMethods.find((m) => m.id === value);
                  setSelectedPaymentMethod(method);
                  setPaymentMethod(method?.id || '');
                }}
                className="space-y-2"
              >
                {paymentMethods.length > 0 ? paymentMethods.map((option) => {
                  const IconComponent = option.icon === 'cartao_credito' || option.icon === 'cartao_debito' ? CreditCard : Banknote;
                  const isSelected = selectedPaymentMethod?.id === option.id;
                  return (
                    <div
                      key={option.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${isSelected ? 'border-boracume-orange bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
                      onClick={() => {
                        setSelectedPaymentMethod(option as any)
                        setPaymentMethod(option.id)
                      }}
                    >
                      <RadioGroupItem value={option.id} id={option.id} className="h-5 w-5" />
                      <IconComponent className={`h-5 w-5 ${isSelected ? 'text-boracume-orange' : 'text-gray-600'}`} />
                      <Label className={`flex-1 font-medium cursor-pointer ${isSelected ? 'text-boracume-orange' : 'text-gray-900'}`}>{option.name}</Label>
                      {option.is_card && option.extra_fee_percent > 0 && (
                        <span className="ml-2 text-xs text-orange-600 font-bold">+{option.extra_fee_percent}%</span>
                      )}
                    </div>
                  );
                }) : <span className="text-muted-foreground">Nenhuma forma de pagamento cadastrada</span>}
              </RadioGroup>

              {isPixSelected && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 space-y-2">
                  <div className="text-sm font-medium text-gray-900">PIX</div>
                  <div className="text-sm text-gray-700">
                    Pagamento via PIX será exibido com QR Code e copia e cola para pagamento online.
                  </div>
                </div>
              )}

              {/* Campo de Troco */}
              {selectedPaymentMethod?.id === 'dinheiro' && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <Label htmlFor="change" className="text-sm font-medium mb-1 block">
                    Precisa de troco para quanto?
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R$</span>
                    <Input
                      id="change"
                      type="number"
                      step="0.01"
                      min={finalTotal}
                      placeholder={finalTotal.toFixed(2)}
                      value={changeAmount}
                      onChange={(e) => setChangeAmount(e.target.value)}
                      className="pl-9 bg-white"
                    />
                  </div>
                  {changeAmount && parseFloat(changeAmount) < finalTotal && (
                    <p className="text-xs text-red-600 mt-1">
                      O valor deve ser maior ou igual ao total do pedido (R$ {finalTotal.toFixed(2)})
                    </p>
                  )}
                  {changeAmount && parseFloat(changeAmount) >= finalTotal && (
                    <p className="text-xs text-green-600 mt-1">
                      Troco: R$ {(parseFloat(changeAmount) - finalTotal).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

            </div>

            <div>
              <Label htmlFor="notes">Observações da entrega</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instruções especiais para entrega..."
                rows={2}
              />
            </div>
          </div>

          {/* Cupom de Desconto */}
          <div className="border-t border-gray-100 pt-4">
             <Label htmlFor="coupon">Cupom de Desconto</Label>
             <div className="flex gap-2 mt-1">
               <Input 
                 id="coupon" 
                 placeholder="Digite seu código" 
                 value={couponCode}
                 onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                 className="uppercase"
                 disabled={!!appliedCoupon}
               />
               {appliedCoupon ? (
                 <Button variant="outline" onClick={() => {
                   setAppliedCoupon(null); 
                   setDiscount(0); 
                   setCouponCode('');
                 }} className="border-red-200 text-red-600 hover:bg-red-50">
                   Remover
                 </Button>
               ) : (
                 <Button onClick={handleApplyCoupon} disabled={!couponCode || isValidatingCoupon}>
                   {isValidatingCoupon ? '...' : 'Aplicar'}
                 </Button>
               )}
             </div>
             {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
             {appliedCoupon && <p className="text-xs text-green-600 mt-1">Cupom {appliedCoupon.code} aplicado!</p>}
          </div>

          {/* Resumo */}
          <div className="border-t border-gray-100 pt-6 space-y-3">
            <div className="bg-gray-50 p-4 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-bold">{formatBRL(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Taxa de entrega:</span>
                <span className="font-bold">{formatBRL(deliveryFee)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="font-medium">Desconto:</span>
                  <span className="font-bold">- {formatBRL(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                <span className="text-gray-900">Total:</span>
                <span className="text-boracume-orange">{formatBRL(finalTotal)}</span>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('bag')} className="flex-1 rounded-xl">
              Voltar
            </Button>
            <Button 
              onClick={handlePlaceOrder}
              disabled={!isFormValid() || isLoading}
              className="flex-1 bg-boracume-orange hover:bg-boracume-orange/90 rounded-xl font-bold"
            >
              {isLoading ? 'Processando...' : 'Finalizar Pedido'}
            </Button>
          </div>
              </div>
            )}
          </div>

          {step === 'bag' && (
            <div className="border-t border-gray-100 p-4 bg-white">
              <Button
                onClick={() => setStep('checkout')}
                className="w-full bg-boracume-orange hover:bg-boracume-orange/90 rounded-xl font-bold h-12"
              >
                Continuar • {formatBRL(total)}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>

      <Dialog open={upsellOpen} onOpenChange={setUpsellOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Antes de finalizar…</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Quer aproveitar alguma oferta?
            </div>
            <div className="space-y-3">
              {upsellOffers.map((offer) => (
                <Card key={offer.ruleId} className="p-3 border border-gray-100">
                  <div className="flex gap-3 items-start">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      {offer.product.image_url ? (
                        <img src={offer.product.image_url} alt={offer.product.name} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{offer.product.name}</div>
                      {offer.message ? (
                        <div className="text-xs text-muted-foreground mt-1">{offer.message}</div>
                      ) : offer.product.description ? (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{offer.product.description}</div>
                      ) : null}
                      <div className="flex items-center justify-between mt-2">
                        <div className="font-extrabold text-boracume-orange">R$ {Number(offer.product.price || 0).toFixed(2)}</div>
                        <Button onClick={() => chooseUpsellOffer(offer)} disabled={upsellBusy}>
                          Add oferta
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {upsellOffers.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma oferta disponível.</div>
              ) : null}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={skipUpsellAndPlace} disabled={upsellBusy}>
                Pular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SimpleVariationModal
        isOpen={upsellVariationOpen}
        onClose={() => {
          setUpsellVariationOpen(false);
          setUpsellSelectedProduct(null);
          setUpsellOpen(true);
        }}
        product={upsellSelectedProduct}
        onAddToCart={(product, quantity, variations, notes, variationPrice) =>
          applyUpsellAndPlace(product, quantity, variations, notes, variationPrice)
        }
      />
    </>
  );
};
