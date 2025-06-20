
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import CustomerLocationInput from '@/components/customer/CustomerLocationInput';
import { useCustomerLookup } from '@/hooks/useCustomerLookup';
import { supabase } from '@/integrations/supabase/client';

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
  variations: string[];
  notes: string;
  totalPrice: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  total: number;
  onOrderSubmit: (orderData: any) => Promise<void>;
  userId: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  total,
  onOrderSubmit,
  userId
}) => {
  const { toast } = useToast();
  const { lookupCustomer, isLoading } = useCustomerLookup(userId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    addressReference: '',
    neighborhood: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZone, setSelectedZone] = useState('');

  useEffect(() => {
    const fetchDeliveryZones = async () => {
      if (!userId) return;

      try {
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('*')
          .eq('user_id', userId)
          .eq('active', true)
          .order('name');

        if (error) {
          console.error('Erro ao buscar zonas de entrega:', error);
          return;
        }

        setDeliveryZones(data || []);
      } catch (error) {
        console.error('Erro ao buscar zonas de entrega:', error);
      }
    };

    fetchDeliveryZones();
  }, [userId]);

  const deliveryFee = selectedZone 
    ? deliveryZones.find(zone => zone.id === selectedZone)?.delivery_fee || 0 
    : 0;
  
  const finalTotal = deliveryType === 'delivery' ? total + deliveryFee : total;

  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value;
    setCustomerPhone(phone);
    setCustomerData(prev => ({ ...prev, phone }));

    if (phone.length >= 10) {
      const customer = await lookupCustomer(phone);
      if (customer) {
        setCustomerData(prev => ({
          ...prev,
          name: customer.name || '',
          address: customer.address || '',
          neighborhood: customer.neighborhood || ''
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cartItems.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione itens ao carrinho antes de finalizar o pedido.",
        variant: "destructive"
      });
      return;
    }

    if (!customerData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe seu nome.",
        variant: "destructive"
      });
      return;
    }

    if (!customerData.phone.trim()) {
      toast({
        title: "Telefone obrigatório",
        description: "Por favor, informe seu telefone.",
        variant: "destructive"
      });
      return;
    }

    if (deliveryType === 'delivery') {
      if (!selectedZone) {
        toast({
          title: "Área de entrega obrigatória",
          description: "Por favor, selecione sua área de entrega.",
          variant: "destructive"
        });
        return;
      }

      if (!customerData.address.trim()) {
        toast({
          title: "Endereço obrigatório",
          description: "Por favor, informe seu endereço para entrega.",
          variant: "destructive"
        });
        return;
      }

      const zone = deliveryZones.find(z => z.id === selectedZone);
      if (zone && total < zone.minimum_order) {
        toast({
          title: "Pedido mínimo não atingido",
          description: `O pedido mínimo para esta área é R$ ${zone.minimum_order.toFixed(2)}.`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        user_id: userId,
        customer_name: customerData.name.trim(),
        customer_phone: customerData.phone.trim(),
        customer_address: deliveryType === 'delivery' ? customerData.address.trim() : 'Retirada no Local',
        customer_address_reference: customerData.addressReference?.trim() || '',
        customer_neighborhood: deliveryType === 'delivery' ? customerData.neighborhood || '' : '',
        latitude: customerData.latitude,
        longitude: customerData.longitude,
        delivery_type: deliveryType,
        payment_method: paymentMethod,
        notes: notes.trim(),
        delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
        delivery_zone_id: deliveryType === 'delivery' ? selectedZone : null,
      };

      await onOrderSubmit(orderData);
      
      // Reset form
      setCustomerData({
        name: '',
        phone: '',
        address: '',
        addressReference: '',
        neighborhood: '',
        latitude: null,
        longitude: null,
      });
      setCustomerPhone('');
      setDeliveryType('delivery');
      setPaymentMethod('cash');
      setNotes('');
      setSelectedZone('');
      
    } catch (error) {
      console.error('❌ Erro ao finalizar pedido:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumo do Pedido */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Resumo do Pedido</Label>
            <div className="rounded-md border">
              {cartItems.map((item, index) => (
                <div key={index} className="px-4 py-3 border-b last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-medium">{item.quantity}x {item.product.name}</span>
                      {item.variations.length > 0 && (
                        <div className="text-sm text-gray-600 mt-1">
                          {item.variations.join(', ')}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-sm text-gray-500 italic mt-1">
                          Obs: {item.notes}
                        </div>
                      )}
                    </div>
                    <span className="font-medium">
                      R$ {item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 bg-gray-50">
                <div className="flex justify-between items-center">
                  <span>Subtotal:</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
                {deliveryType === 'delivery' && deliveryFee > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Taxa de entrega:</span>
                    <span>R$ {deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between items-center font-semibold text-lg">
                  <span>Total:</span>
                  <span>R$ {finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Info Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Informações do Cliente</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Telefone *</Label>
                <Input
                  id="customer-phone"
                  placeholder="(00) 00000-0000"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-name">Nome *</Label>
                <Input
                  id="customer-name"
                  placeholder="Nome do cliente"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Delivery Type Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Tipo de Entrega</Label>
            <Select value={deliveryType} onValueChange={setDeliveryType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de entrega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">🛵 Entrega</SelectItem>
                <SelectItem value="pickup">📦 Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Address Section */}
          {deliveryType === 'delivery' && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Endereço de Entrega</Label>
              
              <div className="space-y-2">
                <Label htmlFor="delivery-zone">Área de Entrega *</Label>
                <Select value={selectedZone} onValueChange={setSelectedZone} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua área" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryZones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name} - Taxa: R$ {zone.delivery_fee.toFixed(2)}
                        {zone.minimum_order > 0 && ` (Mín: R$ ${zone.minimum_order.toFixed(2)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Input */}
              <div className="space-y-2">
                <Label>Localização no Mapa</Label>
                <CustomerLocationInput
                  onLocationSelect={(address, lat, lng) => {
                    setCustomerData(prev => ({
                      ...prev,
                      address: address,
                      latitude: lat || null,
                      longitude: lng || null
                    }));
                  }}
                  defaultAddress={customerData.address}
                />
              </div>

              {/* Address Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço Completo *</Label>
                  <Input
                    id="address"
                    value={customerData.address}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Rua, número, complemento"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address-reference">Ponto de Referência</Label>
                  <Input
                    id="address-reference"
                    value={customerData.addressReference}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, addressReference: e.target.value }))}
                    placeholder="Ex: Próximo ao mercado"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 Dinheiro</SelectItem>
                <SelectItem value="card">💳 Cartão</SelectItem>
                <SelectItem value="pix">📱 PIX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Alguma observação para o pedido?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Finalizar Pedido'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
