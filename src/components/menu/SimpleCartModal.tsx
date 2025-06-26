
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  variations: string[];
  notes: string;
  variationPrice: number;
}

interface SimpleCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onPlaceOrder: (orderData: any) => Promise<void>;
  deliveryZones: any[];
  userId: string | null;
}

export const SimpleCartModal: React.FC<SimpleCartModalProps> = ({
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
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    neighborhood: '',
    paymentMethod: 'pix',
    changeAmount: '',
    deliveryInstructions: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitOrder = async () => {
    try {
      // Validações básicas
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

      if (cart.length === 0) {
        toast({
          title: "Carrinho vazio",
          description: "Adicione itens ao carrinho antes de finalizar.",
          variant: "destructive"
        });
        return;
      }

      setIsSubmitting(true);

      // Gerar número do pedido
      const orderNumber = `${Date.now().toString().slice(-6)}`;

      // Preparar itens do pedido
      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: (item.price + item.variationPrice) * item.quantity,
        variations: item.variations,
        notes: item.notes
      }));

      // Preparar dados do pedido
      const orderData = {
        user_id: userId,
        order_number: orderNumber,
        customer_name: customerData.name.trim(),
        customer_phone: customerData.phone.trim(),
        customer_address: customerData.address.trim(),
        customer_neighborhood: customerData.neighborhood.trim(),
        items: orderItems,
        total: total,
        delivery_fee: 0,
        payment_method: customerData.paymentMethod,
        change_amount: customerData.paymentMethod === 'dinheiro' ? parseFloat(customerData.changeAmount) || 0 : 0,
        order_type: 'delivery',
        delivery_instructions: customerData.deliveryInstructions.trim() || null,
        estimated_time: '30-45 min'
      };

      console.log('🔄 CHECKOUT - Enviando dados do pedido:', orderData);

      await onPlaceOrder(orderData);
      
      // Resetar formulário após sucesso
      setCustomerData({
        name: '',
        phone: '',
        address: '',
        neighborhood: '',
        paymentMethod: 'pix',
        changeAmount: '',
        deliveryInstructions: ''
      });

    } catch (error) {
      console.error('❌ CHECKOUT - Erro ao processar pedido:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      toast({
        title: "Erro ao finalizar pedido",
        description: errorMessage,
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
            <DialogTitle>Carrinho</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Seu carrinho está vazio</p>
            <Button onClick={onClose} className="mt-4">
              Voltar ao cardápio
            </Button>
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

        <div className="space-y-6">
          {/* Itens do carrinho */}
          <div>
            <h3 className="font-medium mb-3">Seus itens</h3>
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    {item.variations.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {item.variations.join(', ')}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-sm text-muted-foreground">
                        Obs: {item.notes}
                      </p>
                    )}
                    <p className="text-sm font-medium">
                      R$ {((item.price + item.variationPrice) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Dados do cliente */}
          <div className="space-y-4">
            <h3 className="font-medium">Seus dados</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={customerData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={customerData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={customerData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                value={customerData.neighborhood}
                onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                placeholder="Seu bairro"
              />
            </div>

            <div>
              <Label htmlFor="payment">Forma de pagamento</Label>
              <Select
                value={customerData.paymentMethod}
                onValueChange={(value) => handleInputChange('paymentMethod', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {customerData.paymentMethod === 'dinheiro' && (
              <div>
                <Label htmlFor="change">Troco para quanto?</Label>
                <Input
                  id="change"
                  type="number"
                  step="0.01"
                  value={customerData.changeAmount}
                  onChange={(e) => handleInputChange('changeAmount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            <div>
              <Label htmlFor="instructions">Observações da entrega</Label>
              <Textarea
                id="instructions"
                value={customerData.deliveryInstructions}
                onChange={(e) => handleInputChange('deliveryInstructions', e.target.value)}
                placeholder="Observações especiais para a entrega..."
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Voltar
            </Button>
            <Button 
              onClick={handleSubmitOrder} 
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Processando...' : `Finalizar Pedido - R$ ${total.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
