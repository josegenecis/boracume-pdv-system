
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CustomerLocationInput from '@/components/customer/CustomerLocationInput';

interface CartProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface CartItem {
  product: CartProduct;
  quantity: number;
  variations: string[];
  notes: string;
  totalPrice: number;
  uniqueId: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

interface SimpleCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  onUpdateQuantity: (uniqueId: string, quantity: number) => void;
  onRemoveItem: (uniqueId: string) => void;
  onPlaceOrder: (orderData: any) => Promise<void>;
  deliveryZones: DeliveryZone[];
  userId: string;
}

const SimpleCartModal: React.FC<SimpleCartModalProps> = ({
  isOpen,
  onClose,
  cart,
  total,
  onUpdateQuantity,
  onRemoveItem,
  onPlaceOrder,
  deliveryZones,
  userId
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [selectedZone, setSelectedZone] = useState<string>('');

  const deliveryFee = selectedZone 
    ? deliveryZones.find(zone => zone.id === selectedZone)?.delivery_fee || 0 
    : 0;
  
  const finalTotal = deliveryType === 'delivery' ? total + deliveryFee : total;

  const generateOrderNumber = () => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cart.length === 0) {
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
        items: cart.map(item => ({
          id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          variations: item.variations || [],
          notes: item.notes || ''
        })),
        total: finalTotal,
        delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
        delivery_zone_id: deliveryType === 'delivery' ? selectedZone : null,
        status: 'pending',
        order_number: generateOrderNumber(),
        order_type: 'delivery'
      };

      await onPlaceOrder(orderData);
      
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

  if (cart.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Carrinho Vazio</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Seu carrinho está vazio. Adicione alguns produtos para continuar.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cart Items */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Itens do Pedido</Label>
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.uniqueId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.product.name}</h4>
                    {item.variations.length > 0 && (
                      <p className="text-sm text-gray-600">
                        {item.variations.join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-gray-500 italic">
                        Obs: {item.notes}
                      </p>
                    )}
                    <p className="text-sm font-medium">
                      R$ {item.product.price.toFixed(2)} cada
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(item.uniqueId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(item.uniqueId, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveItem(item.uniqueId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Informações do Cliente</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Nome *</Label>
                <Input
                  id="customer-name"
                  placeholder="Seu nome"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Telefone *</Label>
                <Input
                  id="customer-phone"
                  placeholder="(00) 00000-0000"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Delivery Type */}
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

          {/* Delivery Address */}
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

              <div className="space-y-2">
                <Label>Localização no Mapa</Label>
                <CustomerLocationInput
                  onLocationSelect={(address, lat, lng) => {
                    setCustomerData(prev => ({
                      ...prev,
                      address: address,
                      latitude: lat,
                      longitude: lng
                    }));
                  }}
                  defaultAddress={customerData.address}
                />
              </div>

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

          {/* Payment Method */}
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Alguma observação para o pedido?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Order Total */}
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            {deliveryType === 'delivery' && deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>Taxa de entrega:</span>
                <span>R$ {deliveryFee.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total:</span>
              <span>R$ {finalTotal.toFixed(2)}</span>
            </div>
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

export default SimpleCartModal;
