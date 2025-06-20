
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDigitalCart } from '@/hooks/useDigitalCart';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Plus, Minus, Trash2, Phone, User } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category: string;
}

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  description?: string;
  logo_url?: string;
}

const DigitalMenu = () => {
  const { userId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCartModal, setShowCartModal] = useState(false);
  const [orderData, setOrderData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    order_type: 'delivery',
    payment_method: 'cash',
    notes: ''
  });

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useDigitalCart();

  useEffect(() => {
    if (userId) {
      loadMenuData();
    }
  }, [userId]);

  const loadMenuData = async () => {
    try {
      console.log('🔄 Carregando dados do menu para usuário:', userId);
      
      // Buscar perfil do restaurante
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('restaurant_name, phone, address, description, logo_url')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ Erro ao carregar perfil:', profileError);
      } else {
        setProfile(profileData);
      }

      // Buscar produtos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, description, image_url, category')
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true);

      if (productsError) {
        console.error('❌ Erro ao carregar produtos:', productsError);
      } else {
        setProducts(productsData || []);
      }

    } catch (error) {
      console.error('❌ Erro geral:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    try {
      if (!orderData.customer_name || !orderData.customer_phone) {
        alert('Por favor, preencha nome e telefone');
        return;
      }

      if (cart.length === 0) {
        alert('Carrinho está vazio');
        return;
      }

      const orderPayload = {
        user_id: userId,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        customer_address: orderData.order_type === 'delivery' ? orderData.customer_address : 'Retirada no Local',
        order_type: orderData.order_type,
        payment_method: orderData.payment_method,
        delivery_instructions: orderData.notes,
        status: 'pending',
        items: cart.map(item => ({
          id: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          subtotal: item.totalPrice
        })),
        total: getCartTotal()
      };

      console.log('📝 Enviando pedido:', orderPayload);

      const { data, error } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar pedido:', error);
        alert('Erro ao finalizar pedido. Tente novamente.');
        return;
      }

      console.log('✅ Pedido criado com sucesso:', data);
      alert('Pedido realizado com sucesso!');
      clearCart();
      setShowCartModal(false);
      setOrderData({
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        order_type: 'delivery',
        payment_method: 'cash',
        notes: ''
      });

    } catch (error) {
      console.error('❌ Erro ao finalizar pedido:', error);
      alert('Erro inesperado. Tente novamente.');
    }
  };

  const categories = [...new Set(products.map(p => p.category))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Restaurante não encontrado</h1>
          <p className="text-muted-foreground">Este restaurante pode não existir ou estar indisponível.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header do Restaurante */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-4">
            {profile.logo_url && (
              <img src={profile.logo_url} alt="Logo" className="w-16 h-16 rounded-full object-cover" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{profile.restaurant_name || 'Restaurante'}</h1>
              {profile.description && <p className="text-gray-600">{profile.description}</p>}
              {profile.phone && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{profile.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {categories.map(category => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-800">{category}</h2>
            <div className="grid gap-4">
              {products.filter(p => p.category === category).map(product => (
                <Card key={product.id} className="p-4">
                  <div className="flex gap-4">
                    {product.image_url && (
                      <img src={product.image_url} alt={product.name} className="w-20 h-20 rounded object-cover" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{product.name}</h3>
                      {product.description && (
                        <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                      )}
                      <p className="text-primary font-bold text-lg mt-2">R$ {product.price.toFixed(2)}</p>
                    </div>
                    <Button onClick={() => addToCart(product)} className="self-center">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Carrinho Fixo */}
      {getCartItemCount() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
          <div className="max-w-4xl mx-auto">
            <Button onClick={() => setShowCartModal(true)} className="w-full h-14 text-lg">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <span>Ver Carrinho ({getCartItemCount()})</span>
                </div>
                <span className="font-bold">R$ {getCartTotal().toFixed(2)}</span>
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* Modal do Carrinho */}
      <Dialog open={showCartModal} onOpenChange={setShowCartModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar Pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Itens do Carrinho */}
            <div className="space-y-4">
              <h3 className="font-medium">Seus Itens</h3>
              {cart.map(item => (
                <div key={item.uniqueId} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.product.name}</h4>
                    <p className="text-sm text-gray-600">R$ {item.product.price.toFixed(2)} cada</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.uniqueId, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button size="sm" variant="outline" onClick={() => updateQuantity(item.uniqueId, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => removeFromCart(item.uniqueId)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">R$ {item.totalPrice.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              <div className="text-right font-bold text-lg">
                Total: R$ {getCartTotal().toFixed(2)}
              </div>
            </div>

            {/* Dados do Cliente */}
            <div className="space-y-4">
              <h3 className="font-medium">Seus Dados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={orderData.customer_name}
                    onChange={(e) => setOrderData(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={orderData.customer_phone}
                    onChange={(e) => setOrderData(prev => ({ ...prev, customer_phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Entrega</Label>
                <Select value={orderData.order_type} onValueChange={(value) => setOrderData(prev => ({ ...prev, order_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delivery">Entrega</SelectItem>
                    <SelectItem value="pickup">Retirada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {orderData.order_type === 'delivery' && (
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço de Entrega</Label>
                  <Input
                    id="address"
                    value={orderData.customer_address}
                    onChange={(e) => setOrderData(prev => ({ ...prev, customer_address: e.target.value }))}
                    placeholder="Seu endereço completo"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={orderData.payment_method} onValueChange={(value) => setOrderData(prev => ({ ...prev, payment_method: value }))}>
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

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={orderData.notes}
                  onChange={(e) => setOrderData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCartModal(false)} className="flex-1">
                Continuar Comprando
              </Button>
              <Button onClick={handlePlaceOrder} className="flex-1">
                Finalizar Pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DigitalMenu;
