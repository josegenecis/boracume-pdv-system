
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
import { CreditCard, Banknote, Smartphone, MapPin, Phone, User } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  selectedOptions?: string[];
  notes?: string;
  subtotal: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  onPlaceOrder: (orderData: any) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cart,
  total,
  onPlaceOrder
}) => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [changeAmount, setChangeAmount] = useState('');

  const deliveryFee = 5.00;
  const totalWithDelivery = total + deliveryFee;

  const paymentOptions = [
    { value: 'pix', label: 'PIX', icon: Smartphone },
    { value: 'credit', label: 'Cartão de Crédito', icon: CreditCard },
    { value: 'debit', label: 'Cartão de Débito', icon: CreditCard },
    { value: 'cash', label: 'Dinheiro', icon: Banknote }
  ];

  const handlePlaceOrder = () => {
    const orderData = {
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      customer_address: customerData.address,
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
      delivery_instructions: customerData.notes
    };

    onPlaceOrder(orderData);
  };

  const isFormValid = () => {
    return (
      customerData.name.trim() !== '' &&
      customerData.phone.trim() !== '' &&
      customerData.address.trim() !== '' &&
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
