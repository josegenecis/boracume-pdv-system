import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';

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
  const [deliveryZoneId, setDeliveryZoneId] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const selectedZone = deliveryZones.find(zone => zone.id === deliveryZoneId);
  const deliveryFee = selectedZone?.delivery_fee || 0;
  const finalTotal = total + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!customerName || !customerPhone || !deliveryZoneId || !paymentMethod) {
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
        delivery_instructions: notes,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Itens do carrinho */}
          <div className="space-y-3">
            <h3 className="font-semibold">Seus itens:</h3>
            {cart.map((item) => (
              <Card key={item.uniqueId} className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.product.name}</h4>
                    {item.variations.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {item.variations.join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-muted-foreground italic">
                        Obs: {item.notes}
                      </p>
                    )}
                    <p className="text-sm font-medium text-primary">
                      R$ {item.totalPrice.toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(item.uniqueId, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(item.uniqueId, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveItem(item.uniqueId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Dados do cliente */}
          <div className="space-y-4">
            <h3 className="font-semibold">Dados para entrega:</h3>
            
            <div>
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <Label htmlFor="phone">WhatsApp *</Label>
              <Input
                id="phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <Label htmlFor="address">Endereço completo *</Label>
              <Textarea
                id="address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Rua, número, complemento, bairro"
                rows={2}
              />
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
              <Label htmlFor="payment">Forma de pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de entrega:</span>
              <span>R$ {deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>R$ {finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Voltar
            </Button>
            <Button 
              onClick={handlePlaceOrder}
              disabled={!customerName || !customerPhone || !deliveryZoneId || !paymentMethod || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Processando...' : 'Finalizar Pedido'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};