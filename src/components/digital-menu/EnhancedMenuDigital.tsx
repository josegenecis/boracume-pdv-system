import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, ShoppingCart, MapPin, Clock, Phone, Search, Star, Gift } from 'lucide-react';
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

interface Combo {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  active: boolean;
  image_url?: string;
  products: string[];
}

interface CartItem extends Product {
  quantity: number;
  isCombo?: boolean;
  comboData?: Combo;
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

const EnhancedMenuDigital = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

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
        fetchCombos(),
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

  const fetchCombos = async () => {
    try {
      // Direct access to combos table with fallback handling
      const { data, error } = await supabase
        .from('combos' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);

      if (error) {
        console.log('Combos functionality not available yet:', error);
        setCombos([]);
        return;
      }
      
      // Type assertion for the response
      const typedCombos = (data || []) as Combo[];
      setCombos(typedCombos);
    } catch (error) {
      console.error('Erro ao carregar combos:', error);
      setCombos([]);
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

  const addToCart = (item: Product | Combo, isCombo = false) => {
    setCart(prev => {
      const cartItem: CartItem = isCombo 
        ? {
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            available: true,
            category: 'Combos',
            description: item.description,
            quantity: 1,
            isCombo: true,
            comboData: item as Combo
          }
        : {
            ...(item as Product),
            quantity: 1
          };

      const existing = prev.find(cartItem => 
        cartItem.id === item.id && cartItem.isCombo === isCombo
      );

      if (existing) {
        return prev.map(cartItem =>
          cartItem.id === item.id && cartItem.isCombo === isCombo
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, cartItem];
    });

    toast({
      title: "Produto adicionado",
      description: `${item.name} foi adicionado ao carrinho.`,
    });
  };

  const removeFromCart = (productId: string, isCombo = false) => {
    setCart(prev => prev.filter(item => 
      !(item.id === productId && item.isCombo === isCombo)
    ));
  };

  const updateQuantity = (productId: string, newQuantity: number, isCombo = false) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, isCombo);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === productId && item.isCombo === isCombo 
          ? { ...item, quantity: newQuantity } 
          : item
      )
    );
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredCombos = combos.filter(combo =>
    combo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    combo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(products.map(p => p.category)));

  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const category = product.category || 'Outros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const getTotalValue = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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
      `${item.quantity}x ${item.name}${item.isCombo ? ' (COMBO)' : ''} - ${formatCurrency(item.price * item.quantity)}`
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
      {/* Enhanced Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            {profile?.logo_url && (
              <img 
                src={profile.logo_url} 
                alt="Logo" 
                className="w-16 h-16 object-cover rounded-xl shadow-md"
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.restaurant_name || 'Cardápio Digital'}
              </h1>
              {profile?.description && (
                <p className="text-gray-600 text-sm mt-1">{profile.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
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
                {profile?.address && (
                  <div className="flex items-center gap-1">
                    <MapPin size={12} />
                    {profile.address}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-3"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="whitespace-nowrap"
              >
                Todos
              </Button>
              {filteredCombos.length > 0 && (
                <Button
                  variant={selectedCategory === 'combos' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('combos')}
                  className="whitespace-nowrap"
                >
                  <Gift size={14} className="mr-1" />
                  Combos
                </Button>
              )}
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="whitespace-nowrap"
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Menu Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Combos Section */}
            {(selectedCategory === 'all' || selectedCategory === 'combos') && filteredCombos.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Gift className="text-red-500" />
                  Combos e Promoções
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {filteredCombos.map((combo) => (
                    <Card key={combo.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      {combo.image_url && (
                        <div className="aspect-video w-full overflow-hidden">
                          <img 
                            src={combo.image_url} 
                            alt={combo.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg">{combo.name}</h3>
                          <Badge variant="destructive" className="ml-2">
                            -{combo.discount_percentage}%
                          </Badge>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{combo.description}</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-gray-500 line-through">
                              {formatCurrency(combo.original_price)}
                            </span>
                            <div className="text-xl font-bold text-primary">
                              {formatCurrency(combo.price)}
                            </div>
                          </div>
                          <Button 
                            onClick={() => addToCart(combo, true)}
                            className="flex items-center gap-2"
                          >
                            <Plus size={16} />
                            Adicionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Products by Category */}
            {selectedCategory !== 'combos' && Object.entries(groupedProducts).map(([category, categoryProducts]) => (
              <div key={category}>
                <h2 className="text-xl font-bold mb-4">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categoryProducts.map((product) => (
                    <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="flex">
                        {product.image_url && (
                          <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0">
                            <img 
                              src={product.image_url} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 p-4">
                          <h3 className="font-bold text-base mb-1">{product.name}</h3>
                          {product.description && (
                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between">
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
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && filteredCombos.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {searchTerm ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível no momento.'}
                </p>
              </div>
            )}
          </div>

          {/* Enhanced Desktop Cart */}
          <div className="space-y-4 hidden lg:block">
            <Card className="sticky top-32">
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
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={`${item.id}-${item.isCombo}`} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium leading-tight">
                              {item.name}
                              {item.isCombo && <Badge variant="secondary" className="ml-1 text-xs">COMBO</Badge>}
                            </p>
                            <p className="text-gray-600 text-xs">
                              {formatCurrency(item.price)} cada
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1, item.isCombo)}
                              className="h-8 w-8 p-0"
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1, item.isCombo)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus size={12} />
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

            {/* Delivery Zones Info */}
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

      <MobileCartDrawer
        isOpen={showMobileCart}
        onClose={() => setShowMobileCart(false)}
        cart={cart}
        updateQuantity={(id, qty) => {
          const item = cart.find(c => c.id === id);
          updateQuantity(id, qty, item?.isCombo);
        }}
        removeFromCart={(id) => {
          const item = cart.find(c => c.id === id);
          removeFromCart(id, item?.isCombo);
        }}
        onCheckout={handleCheckout}
        onWhatsAppOrder={handleWhatsAppOrder}
      />

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

export default EnhancedMenuDigital;
