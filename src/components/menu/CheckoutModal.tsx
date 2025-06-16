
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, CreditCard, Truck, Clock, Phone, User, Home, MapPin as LocationIcon } from 'lucide-react';
import { CustomerLocationInput } from '@/components/customer/CustomerLocationInput';
import { useCustomerLookup } from '@/hooks/useCustomerLookup';

interface CheckoutModalProps {
  cart: any[];
  total: number;
  deliveryZones: any[];
  userId: string;
  onPlaceOrder: (orderData: any) => Promise<void>;
  onClose: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  cart,
  total,
  deliveryZones,
  userId,
  onPlaceOrder,
  onClose
}) => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    neighborhood: '',
    notes: '',
    paymentMethod: 'dinheiro',
    changeAmount: 0
  });
  
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const { lookupCustomer, isLoading: isLookingUp } = useCustomerLookup(userId);

  // Buscar dados do cliente quando o telefone for preenchido
  useEffect(() => {
    const searchCustomer = async () => {
      if (customerData.phone.length >= 10) {
        const customer = await lookupCustomer(customerData.phone);
        if (customer) {
          setCustomerData(prev => ({
            ...prev,
            name: customer.name || prev.name,
            address: customer.address || prev.address,
            neighborhood: customer.neighborhood || prev.neighborhood
          }));
        }
      }
    };

    const timeoutId = setTimeout(searchCustomer, 500);
    return () => clearTimeout(timeoutId);
  }, [customerData.phone, lookupCustomer]);

  // Calcular taxa de entrega quando zona for selecionada
  useEffect(() => {
    if (selectedZone) {
      setDeliveryFee(Number(selectedZone.delivery_fee) || 0);
    }
  }, [selectedZone]);

  const handleInputChange = (field: string, value: string) => {
    setCustomerData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleZoneChange = (zoneId: string) => {
    const zone = deliveryZones.find(z => z.id === zoneId);
    setSelectedZone(zone);
  };

  const handleLocationSelect = (locationData: any) => {
    setLocation({ lat: locationData.lat, lng: locationData.lng });
    if (locationData.address) {
      setCustomerData(prev => ({
        ...prev,
        address: locationData.address
      }));
    }
  };

  const validateForm = () => {
    const errors = [];
    
    if (!customerData.name.trim()) errors.push('Nome é obrigatório');
    if (!customerData.phone.trim()) errors.push('Telefone é obrigatório');
    if (!customerData.address.trim()) errors.push('Endereço é obrigatório');
    if (!selectedZone) errors.push('Selecione uma área de entrega');
    
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      alert('Por favor, preencha todos os campos obrigatórios:\n' + errors.join('\n'));
      return;
    }

    setIsLoading(true);
    
    try {
      const orderData = {
        user_id: userId,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        customer_address: customerData.address,
        customer_neighborhood: customerData.neighborhood,
        delivery_zone_id: selectedZone.id,
        delivery_fee: deliveryFee,
        payment_method: customerData.paymentMethod,
        change_amount: customerData.paymentMethod === 'dinheiro' ? customerData.changeAmount : null,
        delivery_instructions: customerData.notes,
        total: total + deliveryFee,
        order_type: 'delivery',
        status: 'pending',
        customer_latitude: location?.lat || null,
        customer_longitude: location?.lng || null,
        items: cart.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.variationPrice || item.product.price,
          variations: item.variations || [],
          notes: item.notes || '',
          total: (item.variationPrice || item.product.price) * item.quantity
        }))
      };

      await onPlaceOrder(orderData);
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const finalTotal = total + deliveryFee;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Finalizar Pedido</h2>
          
          {/* Dados do Cliente */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    disabled={isLookingUp}
                  />
                  {isLookingUp && (
                    <p className="text-sm text-blue-600 mt-1">
                      Buscando dados do cliente...
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={customerData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Digite seu nome"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entrega */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Dados de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="zone">Área de Entrega *</Label>
                <Select onValueChange={handleZoneChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua área de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryZones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name} - R$ {Number(zone.delivery_fee).toFixed(2)} 
                        {zone.minimum_order > 0 && ` (Mín. R$ ${Number(zone.minimum_order).toFixed(2)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="address">Endereço Completo *</Label>
                <Textarea
                  id="address"
                  value={customerData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Rua, número, complemento, bairro"
                  rows={3}
                />
              </div>

              {/* Campo de Localização Movido para Baixo */}
              <div>
                <Label>Localização no Mapa</Label>
                <CustomerLocationInput
                  onLocationSelect={handleLocationSelect}
                  initialAddress={customerData.address}
                />
                <p className="text-sm text-orange-600 mt-2 flex items-center gap-1">
                  🛵 Facilite a vida do nosso motoboy!
                </p>
              </div>

              <div>
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={customerData.neighborhood}
                  onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                  placeholder="Nome do bairro"
                />
              </div>

              <div>
                <Label htmlFor="notes">Observações para Entrega</Label>
                <Textarea
                  id="notes"
                  value={customerData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Ponto de referência, observações especiais..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select 
                value={customerData.paymentMethod} 
                onValueChange={(value) => handleInputChange('paymentMethod', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao-debito">Cartão de Débito</SelectItem>
                  <SelectItem value="cartao-credito">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>

              {customerData.paymentMethod === 'dinheiro' && (
                <div>
                  <Label htmlFor="change">Troco para quanto?</Label>
                  <Input
                    id="change"
                    type="number"
                    step="0.01"
                    value={customerData.changeAmount || ''}
                    onChange={(e) => handleInputChange('changeAmount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo do Pedido */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Entrega:</span>
                  <span>R$ {deliveryFee.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Voltar
            </Button>
            <Button 
              onClick={handleSubmit}
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? 'Finalizando...' : `Finalizar Pedido - R$ ${finalTotal.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
