
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Banknote, Smartphone, MapPin, Phone, User, Navigation, CheckCircle } from 'lucide-react';
import { useCustomerLookup } from '@/hooks/useCustomerLookup';
import { supabase } from '@/integrations/supabase/client';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedOptions?: string[];
  notes?: string;
  subtotal: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  deliveryZones: DeliveryZone[];
  onPlaceOrder: (orderData: any) => void;
  userId?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  total,
  deliveryZones,
  onPlaceOrder,
  userId
}) => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    neighborhood: '',
    notes: ''
  });
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [location, setLocation] = useState({
    latitude: null as number | null,
    longitude: null as number | null,
    accuracy: null as number | null,
    isLoading: false,
    error: null as string | null
  });
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [changeAmount, setChangeAmount] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Métodos de pagamento personalizados
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);

  useEffect(() => {
    if (isOpen && userId) {
      const fetchPaymentMethods = async () => {
        try {
          console.log('🔄 [MOBILE DEBUG] Buscando métodos de pagamento para userId:', userId);
          console.log('🔄 [MOBILE DEBUG] User Agent:', navigator.userAgent);
          console.log('🔄 [MOBILE DEBUG] Viewport:', window.innerWidth, 'x', window.innerHeight);
          
          const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('user_id', userId)
            .order('name');
          
          if (error) {
            console.error('❌ [MOBILE DEBUG] Erro ao buscar métodos de pagamento:', error);
            console.error('❌ [MOBILE DEBUG] Detalhes do erro:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            setPaymentMethods([]);
            return;
          }
          
          if (data && data.length > 0) {
            console.log('✅ [MOBILE DEBUG] Métodos de pagamento encontrados:', data.length);
            console.log('✅ [MOBILE DEBUG] Dados:', data);
            
            // Corrigir o mapeamento dos campos do banco para garantir que extra_fee_percent e is_card existam
            const mapped = data.map((m: any) => ({
              ...m,
              extra_fee_percent: m.extra_fee_percent ?? 0,
              is_card: m.is_card ?? false
            }));
            
            setPaymentMethods(mapped);
            setSelectedPaymentMethod(mapped[0] || null);
            
            // Definir método de pagamento padrão se não estiver definido
            if (!paymentMethod && mapped.length > 0) {
              setPaymentMethod(mapped[0].name);
            }
          } else {
            console.log('⚠️ [MOBILE DEBUG] Nenhum método de pagamento encontrado, usando padrões');
            setPaymentMethods([]);
            setSelectedPaymentMethod(null);
            // Definir PIX como padrão se não houver métodos personalizados
            if (!paymentMethod) {
              setPaymentMethod('pix');
            }
          }
        } catch (error) {
          console.error('💥 [MOBILE DEBUG] Erro crítico ao buscar métodos de pagamento:', error);
          setPaymentMethods([]);
          setSelectedPaymentMethod(null);
          // Fallback para PIX em caso de erro
          if (!paymentMethod) {
            setPaymentMethod('pix');
          }
        }
      };
      
      // Adicionar delay para mobile para garantir que a UI esteja pronta
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        console.log('📱 [MOBILE DEBUG] Detectado dispositivo móvel, adicionando delay');
        setTimeout(fetchPaymentMethods, 100);
      } else {
        fetchPaymentMethods();
      }
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (paymentMethods.length > 0) {
      const found = paymentMethods.find(m => m.name === paymentMethod);
      setSelectedPaymentMethod(found || null);
    }
  }, [paymentMethod, paymentMethods]);

  const extraFee = selectedPaymentMethod && selectedPaymentMethod.extra_fee_percent > 0 ? (total + deliveryFee) * (selectedPaymentMethod.extra_fee_percent / 100) : 0;
  const totalWithDeliveryAndFee = total + deliveryFee + extraFee;

  const selectedZoneData = deliveryZones.find(zone => zone.id === selectedZone);
  const deliveryFee = selectedZoneData?.delivery_fee || 0;
  const minimumOrder = selectedZoneData?.minimum_order || 0;
  const totalWithDelivery = total + deliveryFee;

  const { lookupCustomer, isLoading: isLookingUp } = useCustomerLookup(userId || '');

  const paymentOptions = [
    { value: 'pix', label: 'PIX', icon: Smartphone },
    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: CreditCard },
    { value: 'cartao_debito', label: 'Cartão de Débito', icon: CreditCard },
    { value: 'dinheiro', label: 'Dinheiro', icon: Banknote }
  ];

  const generateOrderNumber = () => {
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-6);
    return `PED-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${timestamp}`;
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, error: 'Geolocalização não é suportada neste dispositivo' }));
      return;
    }

    setLocation(prev => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          isLoading: false,
          error: null
        });
      },
      (error) => {
        let errorMessage = 'Erro ao obter localização';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permissão de localização negada';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Localização não disponível';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tempo limite para obter localização';
            break;
        }
        setLocation(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  const generateGoogleMapsLink = (lat: number, lng: number) => {
    return `https://maps.google.com/maps?q=${lat},${lng}`;
  };

  const handlePlaceOrder = async () => {
    if (!isFormValid()) {
      // Verificar cada campo individualmente para dar feedback específico
      const errors: string[] = [];
      if (!customerData.name.trim()) errors.push('Nome é obrigatório');
      if (!customerData.phone.trim()) errors.push('Telefone é obrigatório');
      if (!customerData.address.trim()) errors.push('Endereço é obrigatório');
      if (!customerData.neighborhood.trim()) errors.push('Bairro é obrigatório');
      if (!selectedZone) errors.push('Selecione uma área de entrega');
      if (total < minimumOrder) errors.push(`Pedido mínimo: R$ ${minimumOrder.toFixed(2)}`);
      if (!paymentMethod) errors.push('Selecione forma de pagamento');
      if (paymentMethod === 'dinheiro' && changeAmount && parseFloat(changeAmount) < totalWithDelivery) {
        errors.push('Valor para troco deve ser maior que o total');
      }
      
      alert('Por favor, corrija os seguintes campos:\n' + errors.join('\n'));
      return;
    }

    if (!userId) {
      alert('Erro interno: ID do usuário não encontrado');
      return;
    }

    setLoading(true);
    try {
      const orderNumber = generateOrderNumber();
      
      const orderData = {
        user_id: userId,
        order_number: orderNumber,
        customer_name: customerData.name.trim(),
        customer_phone: customerData.phone.trim(),
        customer_address: customerData.address.trim(),
        delivery_zone_id: selectedZone || null,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          options: Array.from(new Set((item.selectedOptions || []).map(opt => typeof opt === 'string' ? opt.trim() : '').filter(opt => opt && !opt.includes(',')))),
          notes: item.notes || ''
        })),
        total: totalWithDeliveryAndFee,
        delivery_fee: deliveryFee,
        payment_method: paymentMethod,
        change_amount: paymentMethod === 'dinheiro' ? parseFloat(changeAmount) || null : null,
        order_type: 'delivery',
        delivery_instructions: customerData.notes.trim() || null,
        estimated_time: selectedZoneData?.delivery_time || '30-45 min',
        status: 'pending',
        acceptance_status: 'pending_acceptance',
        customer_latitude: location.latitude,
        customer_longitude: location.longitude,
        customer_location_accuracy: location.accuracy ? Math.round(location.accuracy) : null,
        google_maps_link: location.latitude && location.longitude ? 
          generateGoogleMapsLink(location.latitude, location.longitude) : null
      };

      await onPlaceOrder(orderData);
    } catch (error) {
      let errorMessage = 'Erro desconhecido ao processar pedido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      alert(`Erro ao finalizar pedido: ${errorMessage}\n\nTente novamente ou entre em contato conosco.`);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    const isValid = (
      customerData.name.trim() !== '' &&
      customerData.phone.trim() !== '' &&
      customerData.address.trim() !== '' &&
      customerData.neighborhood.trim() !== '' &&
      selectedZone !== '' &&
      total >= minimumOrder &&
      paymentMethod !== '' &&
      (paymentMethod !== 'dinheiro' || changeAmount === '' || parseFloat(changeAmount) >= totalWithDelivery)
    );
    
    return isValid;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Resumo do Pedido */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Resumo do Pedido</h3>
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{item.quantity}x {item.name}</p>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {item.selectedOptions.join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-sm text-muted-foreground italic">
                          Obs: {item.notes}
                        </p>
                      )}
                    </div>
                    <span className="font-medium">R$ {item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
                
                <Separator />
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Entrega</span>
                  <span>R$ {deliveryFee.toFixed(2)}</span>
                </div>
                {extraFee > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa do Pagamento</span>
                    <span>R$ {extraFee.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>R$ {totalWithDeliveryAndFee.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Cliente */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Dados para Entrega</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lookupCustomer(customerData.phone)}
                  disabled={!customerData.phone || isLookingUp}
                >
                  {isLookingUp ? 'Buscando...' : 'Buscar Cliente'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Seu nome completo"
                      value={customerData.name}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    placeholder="Rua, número, complemento"
                    value={customerData.address}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input
                    id="neighborhood"
                    placeholder="Nome do bairro"
                    value={customerData.neighborhood}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, neighborhood: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery-zone">Área de Entrega *</Label>
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a área" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryZones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name} - R$ {zone.delivery_fee.toFixed(2)} ({zone.delivery_time})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedZoneData && total < minimumOrder && (
                    <p className="text-sm text-red-500">
                      Pedido mínimo para esta área: R$ {minimumOrder.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Localização GPS */}
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Localização GPS (Opcional)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestLocation}
                    disabled={location.isLoading}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    {location.isLoading ? 'Obtendo...' : 'Obter Localização'}
                  </Button>
                </div>
                
                {location.latitude && location.longitude && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    ✅ Localização obtida com precisão de {Math.round(location.accuracy || 0)}m
                  </div>
                )}
                
                {location.error && (
                  <div className="text-sm text-red-500">
                    ❌ {location.error}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  A localização GPS ajuda o entregador a encontrar você com mais facilidade
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações da Entrega</Label>
                <Textarea
                  id="notes"
                  placeholder="Instruções especiais para entrega..."
                  value={customerData.notes}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Forma de Pagamento</h3>
              
              <div className="space-y-3">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  {(() => {
                    console.log('🎯 [MOBILE DEBUG] Renderizando RadioGroup');
                    console.log('🎯 [MOBILE DEBUG] paymentMethods.length:', paymentMethods.length);
                    console.log('🎯 [MOBILE DEBUG] paymentMethod atual:', paymentMethod);
                    console.log('🎯 [MOBILE DEBUG] Viewport atual:', window.innerWidth, 'x', window.innerHeight);
                    
                    if (paymentMethods.length > 0) {
                      console.log('🎯 [MOBILE DEBUG] Usando métodos personalizados:', paymentMethods);
                      return paymentMethods.map((option) => (
                        <Label
                          key={option.id}
                          htmlFor={option.name}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors"
                          style={{ minHeight: '48px' }} // Garantir altura mínima para mobile
                        >
                          <RadioGroupItem value={option.name} id={option.name} />
                          <span className="flex-1">{option.name}</span>
                          {option.is_card && option.extra_fee_percent > 0 && (
                            <Badge variant="secondary" className="text-xs">Taxa {option.extra_fee_percent}%</Badge>
                          )}
                        </Label>
                      ));
                    } else {
                      console.log('🎯 [MOBILE DEBUG] Usando métodos padrão:', paymentOptions);
                      return paymentOptions.map((option) => {
                        const IconComponent = option.icon;
                        return (
                          <Label
                            key={option.value}
                            htmlFor={option.value}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent transition-colors"
                            style={{ minHeight: '48px' }} // Garantir altura mínima para mobile
                          >
                            <RadioGroupItem value={option.value} id={option.value} />
                            <IconComponent className="h-5 w-5" />
                            <span className="flex-1">{option.label}</span>
                            {option.value === 'pix' && (
                              <Badge variant="secondary" className="text-xs">Instantâneo</Badge>
                            )}
                          </Label>
                        );
                      });
                    }
                  })()}
                </RadioGroup>

                {paymentMethods.length === 0 && (
                  <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    ℹ️ Usando formas de pagamento padrão. Configure métodos personalizados nas configurações.
                  </div>
                )}
              </div>

              {paymentMethod === 'dinheiro' && (
                <div className="space-y-2">
                  <Label htmlFor="change">Troco para quanto? (opcional)</Label>
                  <Input
                    id="change"
                    type="number"
                    step="0.01"
                    placeholder={`Mínimo: R$ ${totalWithDeliveryAndFee.toFixed(2)}`}
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(e.target.value)}
                  />
                  {changeAmount && parseFloat(changeAmount) < totalWithDeliveryAndFee && (
                    <p className="text-sm text-red-500">
                      O valor deve ser maior ou igual ao total do pedido
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Voltar
            </Button>
            <Button 
              onClick={handlePlaceOrder} 
              disabled={!isFormValid() || loading}
              className="flex-1"
            >
              {loading ? 'Processando...' : 'Finalizar Pedido'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;

