
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MapPin, Phone, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface RestaurantProfile {
  restaurant_name?: string;
  description?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  logo_url?: string;
  delivery_fee?: number;
  minimum_order?: number;
}

interface DigitalMenuCheckoutProps {
  cart: CartItem[];
  restaurant?: RestaurantProfile;
  deliveryZones: DeliveryZone[];
  userId: string;
  onBack: () => void;
  onSuccess: () => void;
}

const DigitalMenuCheckout: React.FC<DigitalMenuCheckoutProps> = ({
  cart,
  restaurant,
  deliveryZones,
  userId,
  onBack,
  onSuccess
}) => {
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    deliveryZoneId: '',
    deliveryInstructions: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getTotalValue = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getSelectedZone = () => {
    return deliveryZones.find(zone => zone.id === customerData.deliveryZoneId);
  };

  const getDeliveryFee = () => {
    const zone = getSelectedZone();
    return zone ? zone.delivery_fee : (restaurant?.delivery_fee || 0);
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
    const now = new Date();
    const formattedDate = format(now, 'yyMMdd', { locale: ptBR });
    const randomNumber = Math.floor(Math.random() * 1000);
    return `WEB-${formattedDate}-${randomNumber.toString().padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerData.name || !customerData.phone || !customerData.address) {
      toast({
        title: "Dados obrigatórios",
        description: "Preencha nome, telefone e endereço.",
        variant: "destructive",
      });
      return;
    }

    if (!customerData.deliveryZoneId) {
      toast({
        title: "Zona de entrega obrigatória",
        description: "Selecione uma zona de entrega.",
        variant: "destructive",
      });
      return;
    }

    const selectedZone = getSelectedZone();
    if (selectedZone && getTotalValue() < selectedZone.minimum_order) {
      toast({
        title: "Pedido mínimo não atingido",
        description: `O pedido mínimo para ${selectedZone.name} é ${formatCurrency(selectedZone.minimum_order)}.`,
        variant: "destructive",
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
        subtotal: item.price * item.quantity,
        options: [],
        notes: ''
      }));

      const orderData = {
        user_id: userId,
        order_number: orderNumber,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        customer_address: customerData.address,
        delivery_zone_id: customerData.deliveryZoneId,
        delivery_instructions: customerData.deliveryInstructions || null,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: 'pending',
        status: 'new',
        order_type: 'delivery',
        estimated_time: '30-45 min'
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) throw error;

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Pedido #${orderNumber} foi enviado. Você receberá confirmação em breve.`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: "Erro ao realizar pedido",
        description: error.message || "Não foi possível processar o pedido.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="outline" size="icon">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
        </div>

        {/* Resumo do Pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
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
              <div className="flex justify-between">
                <span>Taxa de entrega:</span>
                <span>{formatCurrency(getDeliveryFee())}</span>
              </div>
            )}
            
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total:</span>
              <span className="text-green-600">{formatCurrency(getFinalTotal())}</span>
            </div>
          </CardContent>
        </Card>

        {/* Formulário de Dados */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} />
                Seus Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerData.phone}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin size={20} />
                Endereço de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="address">Endereço completo *</Label>
                <Input
                  id="address"
                  value={customerData.address}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, número, bairro, complemento"
                  required
                />
              </div>

              <div>
                <Label htmlFor="deliveryZone">Zona de Entrega *</Label>
                <Select
                  value={customerData.deliveryZoneId}
                  onValueChange={(value) => setCustomerData(prev => ({ ...prev, deliveryZoneId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua zona de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryZones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>
                        <div className="flex flex-col">
                          <span>{zone.name}</span>
                          <span className="text-xs text-gray-500">
                            Taxa: {formatCurrency(zone.delivery_fee)} • 
                            Mín: {formatCurrency(zone.minimum_order)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="instructions">Instruções de entrega</Label>
                <Textarea
                  id="instructions"
                  value={customerData.deliveryInstructions}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, deliveryInstructions: e.target.value }))}
                  placeholder="Ponto de referência, observações..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={loading}
          >
            {loading ? 'Processando...' : `Confirmar Pedido - ${formatCurrency(getFinalTotal())}`}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DigitalMenuCheckout;
