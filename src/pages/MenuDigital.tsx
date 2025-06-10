
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, ShoppingCart, MapPin, Clock, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import WhatsAppButton from '@/components/chat/WhatsAppButton';
import DigitalMenuCheckout from '@/components/digital-menu/DigitalMenuCheckout';
import MobileCartButton from '@/components/digital-menu/MobileCartButton';
import MobileCartDrawer from '@/components/digital-menu/MobileCartDrawer';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  category: string;
  description?: string;
  weight_based?: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  description?: string;
  logo_url?: string;
  delivery_fee?: number;
  minimum_order?: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

const MenuDigital = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const userId = searchParams.get('user');

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchProducts(),
        fetchProfile(),
        fetchDeliveryZones()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o cardápio.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .eq('available_delivery', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setProducts([]);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setProfile(null);
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar zonas de entrega:', error);
      setDeliveryZones([]);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getTotalValue = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de fazer o pedido.",
        variant: "destructive",
      });
      return;
    }
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = () => {
    setCart([]);
    setShowCheckout(false);
    toast({
      title: "Pedido realizado com sucesso!",
      description: "Você receberá confirmação em breve.",
    });
  };

  const handleWhatsAppOrder = () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de fazer o pedido.",
        variant: "destructive",
      });
      return;
    }

    const orderText = cart.map(item => 
      `${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}`
    ).join('\n');

    const total = formatCurrency(getTotalValue());
    const message = `Olá! Gostaria de fazer um pedido:\n\n${orderText}\n\nTotal: ${total}\n\nPor favor, me informe sobre entrega e formas de pagamento.`;
    
    const phone = profile?.phone?.replace(/\D/g, '') || '';
    if (phone) {
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
    } else {
      toast({
        title: "WhatsApp não configurado",
        description: "Entre em contato pelo telefone do restaurante.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Cardápio não encontrado</h1>
          <p className="text-gray-600">Verifique o link do cardápio.</p>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <DigitalMenuCheckout
        cart={cart}
        deliveryZones={deliveryZones}
        userId={userId!}
        onBack={() => setShowCheckout(false)}
        onSuccess={handleCheckoutSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {profile?.logo_url && (
              <img 
                src={profile.logo_url} 
                alt="Logo" 
                className="w-12 h-12 object-cover rounded-lg"
              />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {profile?.restaurant_name || 'Cardápio Digital'}
              </h1>
              {profile?.description && (
                <p className="text-gray-600 text-sm mt-1">{profile.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {profile?.opening_hours && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {profile.opening_hours}
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={12} />
                    {profile.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu */}
          <div className="lg:col-span-2 space-y-4">
            {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
              <Card key={category} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{category}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {categoryProducts.map((product) => (
                      <div key={product.id} className="flex gap-3 p-3 border rounded-lg hover:shadow-sm transition-shadow">
                        {product.image_url && (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-base leading-tight">{product.name}</h3>
                          {product.description && (
                            <p className="text-gray-600 text-sm mt-1 line-clamp-2">{product.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(product.price)}
                              {product.weight_based && <span className="text-xs text-gray-500 ml-1">/kg</span>}
                            </span>
                            <Button 
                              onClick={() => addToCart(product)}
                              size="sm"
                              className="flex items-center gap-1"
                            >
                              <Plus size={14} />
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {products.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Nenhum produto disponível no momento.</p>
              </div>
            )}
          </div>

          {/* Carrinho Desktop */}
          <div className="space-y-4 hidden lg:block">
            <Card className="sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShoppingCart size={18} />
                  Carrinho ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">
                    Seu carrinho está vazio
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex-1">
                            <p className="font-medium leading-tight">{item.name}</p>
                            <p className="text-gray-600 text-xs">
                              {formatCurrency(item.price)} cada
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="h-6 w-6 p-0"
                            >
                              <Minus size={10} />
                            </Button>
                            <span className="w-6 text-center text-xs">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="h-6 w-6 p-0"
                            >
                              <Plus size={10} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(getTotalValue())}</span>
                      </div>
                      
                      <Button 
                        onClick={handleCheckout}
                        className="w-full"
                        size="lg"
                      >
                        Finalizar Pedido
                      </Button>

                      <Button 
                        onClick={handleWhatsAppOrder}
                        variant="outline"
                        className="w-full"
                      >
                        Pedir via WhatsApp
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Informações de Entrega */}
            {deliveryZones.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin size={18} />
                    Zonas de Entrega
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {deliveryZones.map((zone) => (
                      <div key={zone.id} className="flex justify-between items-center p-2 border rounded text-sm">
                        <span>{zone.name}</span>
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            {formatCurrency(zone.delivery_fee)}
                          </p>
                          {zone.minimum_order > 0 && (
                            <p className="text-xs text-gray-500">
                              Mín: {formatCurrency(zone.minimum_order)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Cart Button */}
      <MobileCartButton 
        cart={cart} 
        onOpenCart={() => setShowMobileCart(true)} 
      />

      {/* Mobile Cart Drawer */}
      <MobileCartDrawer
        isOpen={showMobileCart}
        onClose={() => setShowMobileCart(false)}
        cart={cart}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        onCheckout={handleCheckout}
        onWhatsAppOrder={handleWhatsAppOrder}
      />

      {/* WhatsApp Button */}
      {profile?.phone && (
        <WhatsAppButton
          phoneNumber={profile.phone.replace(/\D/g, '')}
          message="Olá! Gostaria de saber mais sobre o cardápio."
          position="right"
        />
      )}
    </div>
  );
};

export default MenuDigital;
