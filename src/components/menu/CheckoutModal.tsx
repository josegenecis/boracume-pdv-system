
import React, { useState } from 'react';
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
import { CreditCard, Banknote, Smartphone, MapPin, Phone, User, Navigation } from 'lucide-react';

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
    notes: ''
  });
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

  const selectedZoneData = deliveryZones.find(zone => zone.id === selectedZone);
  const deliveryFee = selectedZoneData?.delivery_fee || 0;
  const minimumOrder = selectedZoneData?.minimum_order || 0;
  const totalWithDelivery = total + deliveryFee;

  const paymentOptions = [
    { value: 'pix', label: 'PIX', icon: Smartphone },
    { value: 'credit', label: 'Cartão de Crédito', icon: CreditCard },
    { value: 'debit', label: 'Cartão de Débito', icon: CreditCard },
    { value: 'cash', label: 'Dinheiro', icon: Banknote }
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
    console.log('🔄 Validando formulário...');
    
    if (!isFormValid()) {
      console.log('❌ Formulário inválido');
      
      // Verificar cada campo individualmente para dar feedback específico
      const errors: string[] = [];
      if (!customerData.name.trim()) errors.push('Nome é obrigatório');
      if (!customerData.phone.trim()) errors.push('Telefone é obrigatório');
      if (!customerData.address.trim()) errors.push('Endereço é obrigatório');
      if (!selectedZone) errors.push('Selecione uma área de entrega');
      if (total < minimumOrder) errors.push(`Pedido mínimo: R$ ${minimumOrder.toFixed(2)}`);
      if (!paymentMethod) errors.push('Selecione forma de pagamento');
      if (paymentMethod === 'cash' && changeAmount && parseFloat(changeAmount) < totalWithDelivery) {
        errors.push('Valor para troco deve ser maior que o total');
      }
      
      console.log('❌ Erros encontrados:', errors);
      alert('Por favor, corrija os seguintes campos:\n' + errors.join('\n'));
      return;
    }

    if (!userId) {
      console.log('❌ userId não encontrado');
      alert('Erro interno: ID do usuário não encontrado');
      return;
    }

    setLoading(true);
    try {
      const orderNumber = generateOrderNumber();
      
      console.log('🔄 Preparando dados do pedido...');
      console.log('📝 Dados do cliente:', customerData);
      console.log('📦 Itens do carrinho:', cart);
      console.log('💳 Método de pagamento:', paymentMethod);
      console.log('🚚 Zona selecionada:', selectedZoneData);
      
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
          options: item.selectedOptions || [],
          notes: item.notes || ''
        })),
        total: totalWithDelivery,
        delivery_fee: deliveryFee,
        payment_method: paymentMethod,
        change_amount: paymentMethod === 'cash' ? parseFloat(changeAmount) || null : null,
        order_type: 'delivery',
        delivery_instructions: customerData.notes.trim() || null,
        estimated_time: selectedZoneData?.delivery_time || '30-45 min',
        status: 'pending',
        customer_latitude: location.latitude,
        customer_longitude: location.longitude,
        customer_location_accuracy: location.accuracy,
        google_maps_link: location.latitude && location.longitude ? 
          generateGoogleMapsLink(location.latitude, location.longitude) : null
      };

      console.log('🔄 Enviando pedido:', JSON.stringify(orderData, null, 2));
      await onPlaceOrder(orderData);
    } catch (error) {
      console.error('❌ Erro ao processar pedido:', error);
      
      let errorMessage = 'Erro desconhecido ao processar pedido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      console.log('❌ Mensagem de erro para usuário:', errorMessage);
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
      selectedZone !== '' &&
      total >= minimumOrder &&
      paymentMethod !== '' &&
      (paymentMethod !== 'cash' || changeAmount === '' || parseFloat(changeAmount) >= totalWithDelivery)
    );
    
    return isValid;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>R$ {totalWithDelivery.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seleção de Zona de Entrega */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Área de Entrega</h3>
              
              {deliveryZones.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-500">Nenhuma área de entrega disponível.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Entre em contato conosco para verificar se atendemos sua região.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="delivery-zone">Selecione seu bairro</Label>
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha sua área de entrega" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryZones.map(zone => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name} - R$ {zone.delivery_fee.toFixed(2)} 
                          (Mín: R$ {zone.minimum_order.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedZoneData && (
                    <div className="text-sm text-muted-foreground">
                      <p>Tempo estimado: {selectedZoneData.delivery_time}</p>
                      {total < minimumOrder && (
                        <p className="text-red-500">
                          Pedido mínimo para esta área: R$ {minimumOrder.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dados do Cliente */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold">Dados de Entrega</h3>
              
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
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
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="address"
                   placeholder="Rua, número, bairro, complemento..."
                    value={customerData.address}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                    className="pl-10 min-h-[80px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
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
              
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                {paymentOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="flex items-center gap-2 cursor-pointer">
                        <IconComponent className="h-4 w-4" />
                        {option.label}
                        {option.value === 'pix' && (
                          <Badge variant="secondary" className="text-xs">Instantâneo</Badge>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>

              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <Label htmlFor="change">Troco para quanto? (opcional)</Label>
                  <Input
                    id="change"
                    type="number"
                    step="0.01"
                    placeholder={`Mínimo: R$ ${totalWithDelivery.toFixed(2)}`}
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(e.target.value)}
                  />
                  {changeAmount && parseFloat(changeAmount) < totalWithDelivery && (
                    <p className="text-sm text-red-500">
                      O valor deve ser maior ou igual ao total do pedido
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
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
