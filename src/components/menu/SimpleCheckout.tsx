
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
  totalPrice: number;
  uniqueId: string;
}

interface SimpleCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  onClearCart: () => void;
  userId: string;
}

export const SimpleCheckout: React.FC<SimpleCheckoutProps> = ({
  isOpen,
  onClose,
  cart,
  total,
  onClearCart,
  userId
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const generateOrderNumber = () => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: "Dados obrigatórios",
        description: "Por favor, informe seu nome e telefone.",
        variant: "destructive"
      });
      return;
    }

    if (deliveryType === 'delivery' && !customerAddress.trim()) {
      toast({
        title: "Endereço obrigatório",
        description: "Por favor, informe seu endereço para entrega.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        user_id: userId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: deliveryType === 'delivery' ? customerAddress.trim() : 'Retirada no Local',
        delivery_type: deliveryType,
        payment_method: paymentMethod,
        items: cart.map(item => ({
          product_id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.totalPrice
        })),
        total: total,
        status: 'pending',
        order_number: generateOrderNumber(),
        order_type: 'delivery',
        acceptance_status: 'pending_acceptance'
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) {
        throw error;
      }

      onClearCart();
      onClose();
      
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setDeliveryType('delivery');
      setPaymentMethod('cash');
      
      toast({
        title: "Pedido enviado!",
        description: "Seu pedido foi enviado com sucesso!",
      });
      
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      toast({
        title: "Erro ao finalizar pedido",
        description: "Tente novamente.",
        variant: "destructive"
      });
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
              Seu carrinho está vazio.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Resumo do Pedido */}
          <div className="space-y-2">
            <Label className="font-semibold">Seu Pedido</Label>
            {cart.map((item) => (
              <div key={item.uniqueId} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.product.name}</span>
                <span>R$ {item.totalPrice.toFixed(2)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total:</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </div>

          <Separator />

          {/* Dados do Cliente */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div>
              <Label>Tipo de Entrega</Label>
              <Select value={deliveryType} onValueChange={setDeliveryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">🛵 Entrega</SelectItem>
                  <SelectItem value="pickup">📦 Retirada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deliveryType === 'delivery' && (
              <div>
                <Label htmlFor="address">Endereço *</Label>
                <Input
                  id="address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Rua, número, bairro"
                  required
                />
              </div>
            )}

            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">💵 Dinheiro</SelectItem>
                  <SelectItem value="card">💳 Cartão</SelectItem>
                  <SelectItem value="pix">📱 PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Finalizar Pedido'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
