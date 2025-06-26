
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/hooks/useUnifiedCart';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  userId: string;
  onSuccess: () => void;
  context: 'digital-menu' | 'pdv'; // Different contexts might need different fields
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  total,
  userId,
  onSuccess,
  context
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: "Dados obrigatórios",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (orderType === 'delivery' && !customerAddress.trim()) {
      toast({
        title: "Endereço obrigatório",
        description: "Endereço é obrigatório para entrega",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create order
      const orderData = {
        user_id: userId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: orderType === 'delivery' ? customerAddress.trim() : 'Retirada no Local',
        order_type: orderType,
        payment_method: paymentMethod,
        total: total,
        status: 'pending',
        acceptance_status: 'pending_acceptance',
        delivery_fee: 0, // Can be enhanced later
        items: items.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.totalPrice,
          variations: item.variations.map(v => v.name),
          notes: item.notes
        })),
        delivery_instructions: notes
      };

      console.log('🚀 Enviando pedido:', orderData);

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError) {
        console.error('❌ Erro ao criar pedido:', orderError);
        throw orderError;
      }

      console.log('✅ Pedido criado:', order);

      // Create kitchen order for items that should go to kitchen
      const kitchenItems = items.filter(item => 
        // For now, send all items to kitchen - can be enhanced with product.send_to_kds flag
        true
      );

      if (kitchenItems.length > 0) {
        const kitchenOrderData = {
          user_id: userId,
          order_number: order.order_number || 'N/A',
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          items: kitchenItems.map(item => ({
            product_id: item.product.id,
            product_name: item.product.name,
            quantity: item.quantity,
            variations: item.variations.map(v => v.name),
            notes: item.notes
          })),
          status: 'pending',
          priority: 'normal'
        };

        console.log('🍳 Enviando para cozinha:', kitchenOrderData);

        const { error: kitchenError } = await supabase
          .from('kitchen_orders')
          .insert([kitchenOrderData]);

        if (kitchenError) {
          console.error('⚠️ Erro ao enviar para cozinha:', kitchenError);
          // Don't fail the whole order if kitchen fails
        } else {
          console.log('✅ Enviado para cozinha');
        }
      }

      toast({
        title: "Pedido finalizado!",
        description: `Pedido #${order.order_number || 'N/A'} criado com sucesso`,
      });

      onSuccess();
      onClose();

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setOrderType('delivery');
      setPaymentMethod('cash');
      setNotes('');

    } catch (error: any) {
      console.error('💥 Erro geral:', error);
      toast({
        title: "Erro ao finalizar pedido",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome do cliente"
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
            <Label>Tipo de Pedido</Label>
            <Select value={orderType} onValueChange={(value: 'delivery' | 'pickup') => setOrderType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">🛵 Entrega</SelectItem>
                <SelectItem value="pickup">📦 Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType === 'delivery' && (
            <div>
              <Label htmlFor="address">Endereço Completo *</Label>
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

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações especiais..."
              rows={3}
            />
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center text-lg font-bold mb-4">
              <span>Total:</span>
              <span className="text-green-600">R$ {total.toFixed(2)}</span>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={submitting}
              size="lg"
            >
              {submitting ? 'Finalizando...' : 'Finalizar Pedido'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
