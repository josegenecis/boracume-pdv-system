
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Phone, User, CreditCard, Clock } from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: any[];
  total: number;
  onOrderSubmit: (orderData: any) => Promise<void>;
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
  const [loading, setLoading] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    customer_address_reference: '',
    customer_neighborhood: '',
    delivery_type: 'delivery',
    payment_method: 'cash',
    notes: '',
    delivery_zone_id: '',
    delivery_fee: 0,
    latitude: null,
    longitude: null
  });

  useEffect(() => {
    if (isOpen && userId) {
      fetchDeliveryZones();
    }
  }, [isOpen, userId]);

  const fetchDeliveryZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);

      if (error) throw error;
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar zonas de entrega:', error);
    }
  };

  const handleDeliveryZoneChange = (zoneId: string) => {
    const zone = deliveryZones.find(z => z.id === zoneId);
    setFormData(prev => ({
      ...prev,
      delivery_zone_id: zoneId,
      delivery_fee: zone ? zone.delivery_fee : 0
    }));
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.customer_name.trim()) {
      errors.push('Nome é obrigatório');
    }

    if (!formData.customer_phone.trim()) {
      errors.push('Telefone é obrigatório');
    }

    if (formData.delivery_type === 'delivery') {
      if (!formData.customer_address.trim()) {
        errors.push('Endereço é obrigatório para entrega');
      }
      if (!formData.delivery_zone_id) {
        errors.push('Selecione uma zona de entrega');
      }
    }

    if (cartItems.length === 0) {
      errors.push('Carrinho está vazio');
    }

    if (errors.length > 0) {
      toast({
        title: "Dados incompletos",
        description: errors.join(', '),
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        user_id: userId,
        customer_name: formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        customer_address: formData.delivery_type === 'delivery' ? formData.customer_address.trim() : 'Retirada no Local',
        customer_address_reference: formData.customer_address_reference.trim(),
        customer_neighborhood: formData.customer_neighborhood.trim(),
        latitude: formData.latitude,
        longitude: formData.longitude,
        delivery_type: formData.delivery_type,
        payment_method: formData.payment_method,
        notes: formData.notes.trim(),
        delivery_fee: formData.delivery_type === 'delivery' ? formData.delivery_fee : 0,
        delivery_zone_id: formData.delivery_type === 'delivery' ? formData.delivery_zone_id : null
      };

      await onOrderSubmit(orderData);
      
      // Reset form
      setFormData({
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        customer_address_reference: '',
        customer_neighborhood: '',
        delivery_type: 'delivery',
        payment_method: 'cash',
        notes: '',
        delivery_zone_id: '',
        delivery_fee: 0,
        latitude: null,
        longitude: null
      });
      
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      // Erro já é tratado no onOrderSubmit
    } finally {
      setLoading(false);
    }
  };

  const finalTotal = total + (formData.delivery_type === 'delivery' ? formData.delivery_fee : 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Finalizar Pedido
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumo do Carrinho */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Resumo do Pedido</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {cartItems.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.product.name}</span>
                  <span>R$ {item.totalPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-medium">
                <span>Subtotal:</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              {formData.delivery_type === 'delivery' && formData.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Taxa de entrega:</span>
                  <span>R$ {formData.delivery_fee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>R$ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Tipo de Entrega */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Tipo de Entrega</Label>
            <RadioGroup
              value={formData.delivery_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, delivery_type: value }))}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delivery" id="delivery" />
                <Label htmlFor="delivery">Entrega</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup">Retirada</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Dados do Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome Completo *
              </Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone *
              </Label>
              <Input
                id="customer_phone"
                value={formData.customer_phone}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                placeholder="(11) 99999-9999"
                required
              />
            </div>
          </div>

          {/* Endereço (apenas para entrega) */}
          {formData.delivery_type === 'delivery' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Endereço Completo *
                </Label>
                <Input
                  id="customer_address"
                  value={formData.customer_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
                  placeholder="Rua, número, bairro"
                  required={formData.delivery_type === 'delivery'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_address_reference">Referência</Label>
                  <Input
                    id="customer_address_reference"
                    value={formData.customer_address_reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, customer_address_reference: e.target.value }))}
                    placeholder="Próximo ao..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_zone">Zona de Entrega *</Label>
                  <Select
                    value={formData.delivery_zone_id}
                    onValueChange={handleDeliveryZoneChange}
                    required={formData.delivery_type === 'delivery'}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a zona" />
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
              </div>
            </div>
          )}

          {/* Método de Pagamento */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Método de Pagamento</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Finalizando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Finalizar Pedido
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
