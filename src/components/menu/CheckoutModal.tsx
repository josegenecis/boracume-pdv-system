
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
import { CreditCard, Banknote, Smartphone, MapPin, Phone, User } from 'lucide-react';
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
  onPlaceOrder: (orderData: any) => void;
  userId?: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  total,
  onPlaceOrder,
  userId
}) => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [changeAmount, setChangeAmount] = useState('');
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
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

  useEffect(() => {
    if (isOpen && userId) {
      fetchDeliveryZones();
    }
  }, [isOpen, userId]);

  const fetchDeliveryZones = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      console.log('🔄 Carregando zonas de entrega para usuário:', userId);

      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('❌ Erro ao carregar zonas de entrega:', error);
        throw error;
      }

      console.log('✅ Zonas de entrega carregadas:', data?.length || 0);
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar zonas de entrega:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = () => {
    const orderData = {
      user_id: userId,
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      customer_address: customerData.address,
      delivery_zone_id: selectedZone,
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
      delivery_instructions: customerData.notes,
      estimated_time: selectedZoneData?.delivery_time || '30-45 min'
    };

    console.log('🔄 Enviando pedido:', orderData);
    onPlaceOrder(orderData);
  };

  const isFormValid = () => {
    return (
      customerData.name.trim() !== '' &&
      customerData.phone.trim() !== '' &&
      customerData.address.trim() !== '' &&
      selectedZone !== '' &&
      total >= minimumOrder &&
      paymentMethod !== '' &&
      (paymentMethod !== 'cash' || changeAmount === '' || parseFloat(changeAmount) >= totalWithDelivery)
    );
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
              
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando áreas de entrega...</p>
              ) : deliveryZones.length === 0 ? (
                <p className="text-sm text-red-500">Nenhuma área de entrega disponível.</p>
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
            <Button variant="outline" onClick={onClose} className="flex-1">
              Voltar
            </Button>
            <Button 
              onClick={handlePlaceOrder} 
              disabled={!isFormValid()}
              className="flex-1"
            >
              Finalizar Pedido
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
