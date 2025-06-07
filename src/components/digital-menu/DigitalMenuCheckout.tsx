
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

interface CheckoutProps {
  cart: CartItem[];
  deliveryZones: DeliveryZone[];
  userId: string;
  onBack: () => void;
  onSuccess: () => void;
}

const DigitalMenuCheckout: React.FC<CheckoutProps> = ({ 
  cart, 
  deliveryZones, 
  userId, 
  onBack, 
  onSuccess 
}) => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    deliveryZoneId: '',
    paymentMethod: 'pix',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getTotalValue = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getDeliveryFee = () => {
    if (!customerData.deliveryZoneId) return 0;
    const zone = deliveryZones.find(z => z.id === customerData.deliveryZoneId);
    return zone?.delivery_fee || 0;
  };

  const getFinalTotal = () => {
    return getTotalValue() + getDeliveryFee();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const generateOrderNumber = () => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerData.name || !customerData.phone || !customerData.address) {
      toast({
        title: "Dados obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    if (!customerData.deliveryZoneId) {
      toast({
        title: "Bairro obrigatório",
        description: "Por favor, selecione o bairro para entrega.",
        variant: "destructive"
      });
      return;
    }

    // Verificar valor mínimo
    const selectedZone = deliveryZones.find(z => z.id === customerData.deliveryZoneId);
    if (selectedZone && getTotalValue() < selectedZone.minimum_order) {
      toast({
        title: "Valor mínimo não atingido",
        description: `O valor mínimo para entrega neste bairro é ${formatCurrency(selectedZone.minimum_order)}.`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const orderNumber = generateOrderNumber();
      
      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      }));

      const orderData = {
        user_id: userId,
        order_number: orderNumber,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        customer_email: customerData.email || null,
        customer_address: customerData.address,
        delivery_zone_id: customerData.deliveryZoneId,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: customerData.paymentMethod,
        status: 'pending',
        order_type: 'delivery',
        notes: customerData.notes || null,
        estimated_time: '30-45 min'
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) throw error;

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Pedido #${orderNumber} foi registrado. Você receberá confirmação em breve.`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: "Erro ao finalizar pedido",
        description: "Não foi possível processar seu pedido. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.quantity}x {item.name}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(getTotalValue())}</span>
            </div>
            {getDeliveryFee() > 0 && (
              <div className="flex justify-between text-sm">
                <span>Taxa de entrega:</span>
                <span>{formatCurrency(getDeliveryFee())}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>{formatCurrency(getFinalTotal())}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({...prev, name: e.target.value}))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData(prev => ({...prev, phone: e.target.value}))}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={customerData.email}
                onChange={(e) => setCustomerData(prev => ({...prev, email: e.target.value}))}
                placeholder="seu@email.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereço de Entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="address">Endereço Completo *</Label>
              <Textarea
                id="address"
                value={customerData.address}
                onChange={(e) => setCustomerData(prev => ({...prev, address: e.target.value}))}
                placeholder="Rua, número, complemento, bairro"
                required
              />
            </div>
            <div>
              <Label htmlFor="deliveryZone">Bairro *</Label>
              <Select 
                value={customerData.deliveryZoneId} 
                onValueChange={(value) => setCustomerData(prev => ({...prev, deliveryZoneId: value}))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o bairro" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryZones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      <div className="flex flex-col">
                        <div className="flex justify-between items-center w-full">
                          <span>{zone.name}</span>
                          <span className="ml-2 text-green-600 font-medium">
                            {formatCurrency(zone.delivery_fee)}
                          </span>
                        </div>
                        {zone.minimum_order > 0 && (
                          <div className="text-xs text-gray-500">
                            Mínimo: {formatCurrency(zone.minimum_order)}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={customerData.paymentMethod}
              onValueChange={(value) => setCustomerData(prev => ({...prev, paymentMethod: value}))}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pix" id="pix" />
                <Label htmlFor="pix">PIX</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cartao" id="cartao" />
                <Label htmlFor="cartao">Cartão (na entrega)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dinheiro" id="dinheiro" />
                <Label htmlFor="dinheiro">Dinheiro (na entrega)</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customerData.notes}
              onChange={(e) => setCustomerData(prev => ({...prev, notes: e.target.value}))}
              placeholder="Alguma observação especial? (opcional)"
            />
          </CardContent>
        </Card>

        <Button 
          type="submit" 
          className="w-full" 
          size="lg"
          disabled={loading}
        >
          <CreditCard size={16} className="mr-2" />
          {loading ? 'Processando...' : `Finalizar Pedido - ${formatCurrency(getFinalTotal())}`}
        </Button>
      </form>
    </div>
  );
};

export default DigitalMenuCheckout;
