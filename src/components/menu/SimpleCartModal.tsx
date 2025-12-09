
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [changeAmount, setChangeAmount] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [location, setLocation] = React.useState({
    latitude: null as number | null,
    longitude: null as number | null,
    accuracy: null as number | null,
    isLoading: false,
    error: null as string | null
  });


  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  // Remove this line:
  // const [extraFee, setExtraFee] = useState(0);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const { data, error } = await supabase
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
      }
    };
    if (isOpen) fetchPaymentMethods();
  }, [isOpen, userId]);
  const selectedZone = deliveryZones.find(zone => zone.id === deliveryZoneId);
  const deliveryFee = selectedZone?.delivery_fee || 0;
  // Calcular taxa extra como percentual, igual ao CheckoutModal
  const computedExtraFee = selectedPaymentMethod && selectedPaymentMethod.extra_fee_percent > 0 ? (total + deliveryFee) * (selectedPaymentMethod.extra_fee_percent / 100) : 0;
  const finalTotal = total + deliveryFee + computedExtraFee;
  const isPixSelected = (selectedPaymentMethod as any)?.id === 'pix';


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

    
    const valid = (
      customerName.trim() !== '' &&
      customerPhone.trim() !== '' &&
      customerAddress.trim() !== '' &&
      deliveryZoneId !== '' &&
      isPaymentValid &&
      (paymentMethod !== 'dinheiro' || changeAmount === '' || parseFloat(changeAmount) >= finalTotal)
    );
    
    console.log('💳 VALIDAÇÃO FORMULÁRIO:', {
      customerName: customerName.trim() !== '',
      customerPhone: customerPhone.trim() !== '',
      customerAddress: customerAddress.trim() !== '',
      deliveryZoneId: deliveryZoneId !== '',
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
        delivery_zone_id: deliveryZoneId,
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
        total: finalTotal,
        status: 'pending',
        order_type: 'delivery',
        order_number: 'PED' + Date.now().toString().slice(-6)
      };

      await onPlaceOrder(orderData);
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
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

            <div>
              <Label htmlFor="zone">Área de entrega *</Label>
              <Select value={deliveryZoneId} onValueChange={setDeliveryZoneId}>
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
            </div>

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
                    <div key={option.id} className="flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200">
                      <RadioGroupItem value={option.id} id={option.id} className="h-5 w-5" />
                      <IconComponent className={`h-5 w-5 ${isSelected ? 'text-boracume-orange' : 'text-gray-600'}`} />
                      <Label htmlFor={option.id} className={`flex-1 font-medium ${isSelected ? 'text-boracume-orange' : 'text-gray-900'}`}>{option.name}</Label>
                      {option.is_card && option.extra_fee_percent > 0 && (
                        <span className="ml-2 text-xs text-orange-600 font-bold">+{option.extra_fee_percent}%</span>
                      )}
                    </div>
                  );
                }) : <span className="text-muted-foreground">Nenhuma forma de pagamento cadastrada</span>}
              </RadioGroup>

              {isPixSelected && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                  PIX disponível, mas o pedido só será criado após confirmação via integração. Selecione outra forma para finalizar.
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
              disabled={!isFormValid() || isLoading || isPixSelected}
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
