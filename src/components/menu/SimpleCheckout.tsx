import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, MapPin, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  uniqueId: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  description?: string;
  logo_url?: string;
}

interface SimpleCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  onClearCart: () => void;
  onRemoveFromCart: (uniqueId: string) => void;
  userId: string;
  deliveryZones: DeliveryZone[];
  profile: Profile;
}

export const SimpleCheckout: React.FC<SimpleCheckoutProps> = ({
  isOpen,
  onClose,
  cart,
  total,
  onClearCart,
  onRemoveFromCart,
  userId,
  deliveryZones,
  profile
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState(0);

  const handleZoneChange = (zoneId: string) => {
    setSelectedZone(zoneId);
    const zone = deliveryZones.find(z => z.id === zoneId);
    if (zone) {
      setDeliveryFee(zone.delivery_fee);
    }
  };

  const finalTotal = total + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 Iniciando envio do pedido...');
    
    if (!customerName.trim() || !customerPhone.trim()) {
      console.log('❌ Validação falhou: nome ou telefone em branco');
      toast({
        title: "Dados obrigatórios",
        description: "Por favor, informe seu nome e telefone.",
        variant: "destructive"
      });
      return;
    }

    if (deliveryType === 'delivery') {
      if (!customerAddress.trim()) {
        console.log('❌ Validação falhou: endereço em branco para entrega');
        toast({
          title: "Endereço obrigatório",
          description: "Por favor, informe seu endereço para entrega.",
          variant: "destructive"
        });
        return;
      }
      
      if (!selectedZone) {
        console.log('❌ Validação falhou: zona de entrega não selecionada');
        toast({
          title: "Bairro obrigatório",
          description: "Por favor, selecione o bairro para entrega.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      console.log('📋 Preparando dados do pedido...');
      
      const orderData = {
        user_id: userId,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: deliveryType === 'delivery' ? customerAddress.trim() : 'Retirada no Local',
        order_type: deliveryType, // ✅ CORRIGIDO: Era delivery_type, agora é order_type
        payment_method: paymentMethod,
        delivery_zone_id: deliveryType === 'delivery' ? selectedZone : null,
        delivery_fee: deliveryType === 'delivery' ? deliveryFee : 0,
        items: cart.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.totalPrice,
          variations: item.variations,
          notes: item.notes
        })),
        total: finalTotal,
        status: 'pending',
        acceptance_status: 'pending_acceptance'
      };

      console.log('📤 Enviando pedido para o banco:', {
        ...orderData,
        items: orderData.items.length + ' items'
      });

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select();

      if (error) {
        console.error('❌ Erro específico do Supabase:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Erro no banco de dados: ${error.message}`);
      }

      console.log('✅ Pedido inserido com sucesso:', data);

      // Limpar carrinho e fechar modal
      onClearCart();
      onClose();
      
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setDeliveryType('delivery');
      setPaymentMethod('cash');
      setSelectedZone('');
      setDeliveryFee(0);
      
      console.log('🎉 Processo concluído com sucesso');
      
      toast({
        title: "Pedido enviado!",
        description: "Seu pedido foi enviado com sucesso! Em breve entraremos em contato.",
      });
      
    } catch (error: any) {
      console.error('💥 Erro geral ao finalizar pedido:', {
        message: error.message,
        stack: error.stack,
        error: error
      });
      
      toast({
        title: "Erro ao finalizar pedido",
        description: error.message || "Houve um erro ao enviar seu pedido. Tente novamente.",
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
              <div key={item.uniqueId} className="flex justify-between items-start text-sm border-b pb-2">
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{item.quantity}x {item.product.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFromCart(item.uniqueId)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {item.variations.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {item.variations.join(', ')}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-xs text-gray-500 mt-1">
                      Obs: {item.notes}
                    </div>
                  )}
                  <div className="text-right font-medium">
                    R$ {item.totalPrice.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
            
            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Taxa de entrega:</span>
                  <span>R$ {deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>R$ {finalTotal.toFixed(2)}</span>
              </div>
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
              <>
                <div>
                  <Label>Bairro/Zona de Entrega *</Label>
                  <Select value={selectedZone} onValueChange={handleZoneChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione seu bairro" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryZones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{zone.name}</span>
                            <span className="text-sm text-gray-500">
                              (R$ {zone.delivery_fee.toFixed(2)})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="address">Endereço Completo *</Label>
                  <Input
                    id="address"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Rua, número, complemento"
                    required
                  />
                </div>
              </>
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
            {isSubmitting ? 'Enviando...' : `Finalizar Pedido - R$ ${finalTotal.toFixed(2)}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
