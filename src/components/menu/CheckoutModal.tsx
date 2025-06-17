
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import CustomerLocationInput from '@/components/customer/CustomerLocationInput';
import { useCustomerLookup } from '@/hooks/useCustomerLookup';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: any[];
  total: number;
  onOrderSubmit: (orderData: any) => void;
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
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    addressReference: '',
    neighborhood: '',
    latitude: null,
    longitude: null,
  });
  const [deliveryType, setDeliveryType] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchNeighborhoods = async () => {
      if (!user) return;

      try {
        // Use delivery_zones table instead of delivery_neighborhoods
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('name')
          .eq('user_id', userId)
          .eq('active', true);

        if (error) {
          console.error('Erro ao buscar bairros:', error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar os bairros de entrega.",
            variant: "destructive"
          });
          return;
        }

        const neighborhoodNames = data?.map(item => item.name) || [];
        setNeighborhoods(neighborhoodNames);
      } catch (error) {
        console.error('Erro ao buscar bairros:', error);
        toast({
          title: "Erro",
          description: "Ocorreu um erro ao carregar os bairros de entrega.",
          variant: "destructive"
        });
      }
    };

    fetchNeighborhoods();
  }, [userId, user, toast]);

  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value;
    setCustomerPhone(phone);

    if (phone.length >= 10) {
      const customer = await lookupCustomer(phone);
      if (customer) {
        setCustomerData({
          ...customerData,
          ...customer,
          phone: customer.phone || phone
        });
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const orderData = {
      customer_name: customerData.name,
      customer_phone: customerData.phone,
      customer_address: customerData.address,
      customer_address_reference: customerData.addressReference,
      customer_neighborhood: customerData.neighborhood,
      latitude: customerData.latitude,
      longitude: customerData.longitude,
      delivery_type: deliveryType,
      payment_method: paymentMethod,
      notes: notes,
      items: cartItems,
      total: total,
      user_id: userId,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onOrderSubmit(orderData);
    onClose();
    toast({
      title: "Pedido enviado!",
      description: "O pedido foi enviado com sucesso.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Finalizar Pedido</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info Section */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Informações do Cliente</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Telefone</Label>
                <Input
                  id="customer-phone"
                  placeholder="(00) 00000-0000"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-name">Nome</Label>
                <Input
                  id="customer-name"
                  placeholder="Nome do cliente"
                  value={customerData.name}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
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
                <SelectItem value="pickup">Retirada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Delivery Address Section */}
          {deliveryType === 'delivery' && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Endereço de Entrega</Label>
              
              {/* Neighborhood Selection */}
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro de Entrega</Label>
                <Select value={customerData.neighborhood} onValueChange={(value) => 
                  setCustomerData(prev => ({ ...prev, neighborhood: value }))
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    {neighborhoods.map(neighborhood => (
                      <SelectItem key={neighborhood} value={neighborhood}>
                        {neighborhood}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location Input - Moved below neighborhood */}
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
                <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                  🛵 Facilite a vida do nosso motoboy!
                </p>
              </div>

              {/* Address Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço Completo</Label>
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
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
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

          {/* Order Summary */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Resumo do Pedido</Label>
            <div className="rounded-md border">
              {cartItems.map((item) => (
                <div key={item.id} className="px-4 py-2 border-b last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span>
                      {item.quantity} x R$ {item.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="px-4 py-2 font-semibold">
                Total: R$ {total.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full">
            Finalizar Pedido
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
