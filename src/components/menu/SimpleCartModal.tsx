
import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PixCheckoutModal from '@/components/payment/PixCheckoutModal';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trash2, Plus, Minus, Navigation, MapPin, Phone, User, CreditCard, Banknote, Smartphone, CheckCircle, Copy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCustomerLookup } from '@/hooks/useCustomerLookup';

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
  const [customerName, setCustomerName] = React.useState('');
  const [customerPhone, setCustomerPhone] = React.useState('');
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
  const [pixPublicSettings, setPixPublicSettings] = useState<any | null>(null);
  const [pixPublicLoading, setPixPublicLoading] = useState(false);
  const [pixPublicError, setPixPublicError] = useState<string | null>(null);
  const [pixCheckout, setPixCheckout] = useState<{ correlationID: string; brCode: string; qrCodeImage?: string; paymentLinkUrl?: string } | null>(null);
  // Remove this line:
  // const [extraFee, setExtraFee] = useState(0);

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

  const isPixSelected = (selectedPaymentMethod as any)?.id === 'pix';
  const canUseManualPix = Boolean(pixPublicSettings?.pix_key);

  useEffect(() => {
    if (!isOpen || !isPixSelected || !userId) return;
    setPixPublicLoading(true);
    setPixPublicSettings(null);
    setPixPublicError(null);
    invokeEdgeFunction('pix-settings-public', { userId }, { timeoutMs: 6000 })
      .then(({ data, status }) => {
        if (status === 200 && data?.ok && data?.settings) {
          setPixPublicSettings(data.settings);
          return;
        }
        const msg = String(data?.error || data?.message || 'Não foi possível carregar os dados do PIX.');
        setPixPublicError(msg);
      })
      .catch((e: any) => {
        setPixPublicError(String(e?.message || 'Não foi possível carregar os dados do PIX.'));
      })
      .finally(() => setPixPublicLoading(false));
  }, [isOpen, isPixSelected, userId]);

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

  const handlePlaceOrder = async () => {
    if (!isFormValid()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const orderData = {
        user_id: userId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        delivery_zone_id: deliveryZoneId || null,
        payment_method: paymentMethod,
        change_amount: paymentMethod === 'dinheiro' ? parseFloat(changeAmount) || null : null,
        delivery_instructions: notes,
        customer_latitude: location.latitude,
        customer_longitude: location.longitude,
        customer_location_accuracy: location.accuracy ? Math.round(location.accuracy) : null,
        google_maps_link: location.latitude && location.longitude ? 
          generateGoogleMapsLink(location.latitude, location.longitude) : null,
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
        discount: discount, // Add Discount
        coupon_code: appliedCoupon?.code, // Add Coupon Code
        total: finalTotal,
        status: 'pending',
        order_type: 'delivery',
        order_number: 'PED' + Date.now().toString().slice(-6)
      };

      if (paymentMethod === 'pix') {
        const manualKey = String(pixPublicSettings?.pix_key || '').trim();
        if (manualKey) {
          await onPlaceOrder({ ...orderData, acceptance_status: 'awaiting_pix_payment' });
          return;
        }
        if (!pixPublicLoading && !pixPublicSettings) {
          const { data: sData, status: sStatus } = await invokeEdgeFunction('pix-settings-public', { userId }, { timeoutMs: 6000 });
          const key = String(sStatus === 200 && sData?.ok ? sData?.settings?.pix_key : '').trim();
          if (key) {
            setPixPublicSettings(sData.settings);
            await onPlaceOrder({ ...orderData, acceptance_status: 'awaiting_pix_payment' });
            return;
          }
        }
        const { data, status } = await invokeEdgeFunction<any>('pix-start-checkout', {
          restaurantUserId: userId,
          orderPayload: orderData,
          preferredMethod: paymentMethod
        }, { timeoutMs: 20000 })

        if (!data) {
          throw new Error(`Erro na conexão com checkout (HTTP ${status})`)
        }

        if (!data.ok) {
          const code = String(data.error || '').trim();
          if (code === 'pix_not_configured' || code === 'pix_disabled') {
            throw new Error('PIX não foi configurado para este restaurante. Cadastre a chave PIX ou configure o Mercado Pago.')
          }
          if (code === 'missing_provider_credentials') {
            throw new Error('Mercado Pago não configurado. Cadastre a chave PIX para pagamento manual ou configure o Mercado Pago.')
          }
          throw new Error(data.error || `Não foi possível iniciar pagamento (HTTP ${status})`)
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
        return;
      }
      await onPlaceOrder(orderData);
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white shadow-2xl border border-gray-100 rounded-xl">
        <DialogHeader className="border-b border-gray-100 pb-4">
          <DialogTitle className="text-xl font-bold text-gray-900">Finalizar Pedido</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-2">
          {pixCheckout && (
            <PixCheckoutModal
              isOpen={!!pixCheckout}
              onClose={() => setPixCheckout(null)}
              correlationID={pixCheckout.correlationID}
              brCode={pixCheckout.brCode}
              qrCodeImage={pixCheckout.qrCodeImage}
              paymentLinkUrl={pixCheckout.paymentLinkUrl}
            />
          )}
          {/* Itens do carrinho */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Seus itens:</h3>
            {cart.map((item) => (
              <Card key={item.uniqueId} className="p-4 border border-gray-100 shadow-sm rounded-xl">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{item.product.name}</h4>
                    {item.variations.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {item.variations.join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-gray-600 italic bg-gray-50 p-2 rounded-lg mt-2">
                        Obs: {item.notes}
                      </p>
                    )}
                    <p className="text-sm font-bold text-boracume-orange mt-2">
                      R$ {item.totalPrice.toFixed(2)}
                    </p>
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

          {/* Dados do cliente */}
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Dados para entrega:</h3>
            
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
              <Label htmlFor="phone">WhatsApp *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={customerPhone}
                  onChange={async (e) => {
                    const phone = e.target.value;
                    setCustomerPhone(phone);
                    
                    // Auto-lookup customer if phone has enough digits
                    if (phone.replace(/\D/g, '').length >= 10) {
                      const customer = await lookupCustomer(phone);
                      if (customer) {
                        setCustomerName(customer.name);
                        setCustomerAddress(customer.address);
                        setIsExistingCustomer(true);
                      } else {
                        setIsExistingCustomer(false);
                      }
                    } else {
                      setIsExistingCustomer(false);
                    }
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
                  {pixPublicLoading ? (
                    <div className="text-sm text-gray-700">Carregando dados do PIX…</div>
                  ) : pixPublicError ? (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-700">Não foi possível carregar os dados do PIX.</div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          onClick={() => {
                            setPixPublicSettings(null);
                            setPixPublicError(null);
                            setPixPublicLoading(true);
                            invokeEdgeFunction('pix-settings-public', { userId }, { timeoutMs: 6000 })
                              .then(({ data, status }) => {
                                if (status === 200 && data?.ok && data?.settings) {
                                  setPixPublicSettings(data.settings);
                                  return;
                                }
                                const msg = String(data?.error || data?.message || 'Não foi possível carregar os dados do PIX.');
                                setPixPublicError(msg);
                              })
                              .catch((e: any) => setPixPublicError(String(e?.message || 'Não foi possível carregar os dados do PIX.')))
                              .finally(() => setPixPublicLoading(false));
                          }}
                        >
                          Tentar novamente
                        </Button>
                      </div>
                    </div>
                  ) : canUseManualPix ? (
                    <>
                      <div className="text-sm text-gray-700">
                        Copie a chave PIX abaixo para fazer o pagamento. O pedido ficará aguardando confirmação.
                      </div>
                      <div className="flex items-center gap-2">
                        <Input value={pixPublicSettings.pix_key} readOnly className="h-9 bg-white" />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(String(pixPublicSettings.pix_key));
                              alert('Chave PIX copiada!');
                            } catch {
                              alert('Não foi possível copiar. Selecione e copie manualmente.');
                            }
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {(pixPublicSettings.merchant_name || pixPublicSettings.merchant_city) && (
                        <div className="text-xs text-gray-600">
                          {pixPublicSettings.merchant_name ? String(pixPublicSettings.merchant_name) : ''}
                          {pixPublicSettings.merchant_city ? ` • ${String(pixPublicSettings.merchant_city)}` : ''}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-700">
                      Ao selecionar PIX, vamos gerar o QR Code e liberar o pedido apenas após confirmação do pagamento.
                    </div>
                  )}
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
                <span className="font-bold">R$ {total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Taxa de entrega:</span>
                <span className="font-bold">R$ {deliveryFee.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="font-medium">Desconto:</span>
                  <span className="font-bold">- R$ {discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                <span className="text-gray-900">Total:</span>
                <span className="text-boracume-orange">R$ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
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
      </DialogContent>
    </Dialog>
  );
};
