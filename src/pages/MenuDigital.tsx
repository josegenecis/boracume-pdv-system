import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Plus, Minus, Search, Phone, MapPin, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProductVariationSelector from '@/components/products/ProductVariationSelector';
import DeliveryZoneSelector from '@/components/digital-menu/DeliveryZoneSelector';
import MobileCartButton from '@/components/digital-menu/MobileCartButton';
import MobileCartDrawer from '@/components/digital-menu/MobileCartDrawer';
import DigitalMenuCheckout from '@/components/digital-menu/DigitalMenuCheckout';
import Logo from '@/components/Logo';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
  weight_based?: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface CartItem extends Product {
  quantity: number;
  selectedOptions?: string[];
  notes?: string;
  subtotal: number;
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

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time?: string;
  active?: boolean;
}

const MenuDigital = () => {
  const { userId } = useParams<{ userId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchRestaurantData();
    } else {
      setError('ID do restaurante não informado');
      setLoading(false);
    }
  }, [userId]);

  const fetchRestaurantData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch restaurant profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error('Erro ao carregar perfil do restaurante');
      }

      if (!profileData) {
        throw new Error('Restaurante não encontrado');
      }

      setRestaurant(profileData);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true)
        .order('name');

      if (productsError) {
        console.error('Erro ao carregar produtos:', productsError);
      } else {
        setProducts(productsData || []);
      }

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('display_order', { ascending: true });

      if (categoriesError) {
        console.error('Erro ao carregar categorias:', categoriesError);
      } else {
        setCategories(categoriesData || []);
      }

      // Fetch delivery zones
      const { data: zonesData, error: zonesError } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (zonesError) {
        console.error('Erro ao carregar zonas de entrega:', zonesError);
      } else {
        setDeliveryZones(zonesData || []);
      }

    } catch (err: any) {
      console.error('Erro ao carregar dados do restaurante:', err);
      setError(err.message || 'Erro ao carregar dados do restaurante');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product, quantity: number = 1, selectedOptions: string[] = [], notes: string = '') => {
    const subtotal = product.price * quantity;
    const newItem: CartItem = {
      ...product,
      quantity,
      selectedOptions,
      notes,
      subtotal
    };

    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.id === product.id &&
        JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions) &&
        item.notes === notes
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].subtotal = updated[existingIndex].price * updated[existingIndex].quantity;
        return updated;
      }

      return [...prev, newItem];
    });

    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const updateCartItem = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
      return;
    }

    setCart(prev => {
      const updated = [...prev];
      updated[index].quantity = quantity;
      updated[index].subtotal = updated[index].price * quantity;
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const getDeliveryFee = () => {
    if (!selectedZone) return restaurant?.delivery_fee || 0;
    const zone = deliveryZones.find(z => z.id === selectedZone);
    return zone?.delivery_fee || restaurant?.delivery_fee || 0;
  };

  const getFinalTotal = () => {
    return getCartTotal() + getDeliveryFee();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ops!</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <DigitalMenuCheckout
        cart={cart}
        restaurant={restaurant}
        deliveryZones={deliveryZones}
        selectedZone={selectedZone}
        setSelectedZone={setSelectedZone}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        onBack={() => setShowCheckout(false)}
        userId={userId!}
        onSuccess={() => {
          setCart([]);
          setShowCheckout(false);
          toast({
            title: "Sucesso!",
            description: "Pedido realizado com sucesso!",
          });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {restaurant?.logo_url ? (
                <img 
                  src={restaurant.logo_url} 
                  alt={restaurant.restaurant_name || 'Logo'} 
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <Logo size="sm" />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {restaurant?.restaurant_name || 'Cardápio Digital'}
                </h1>
                {restaurant?.description && (
                  <p className="text-sm text-gray-600">{restaurant.description}</p>
                )}
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-4">
              {cart.length > 0 && (
                <Button 
                  onClick={() => setShowCart(true)}
                  className="relative"
                >
                  <ShoppingCart size={20} className="mr-2" />
                  Carrinho ({cart.length})
                  <Badge className="absolute -top-2 -right-2 bg-red-500">
                    {cart.reduce((total, item) => total + item.quantity, 0)}
                  </Badge>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Restaurant Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone size={16} />
                  Informações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {restaurant?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} />
                    <span>{restaurant.phone}</span>
                  </div>
                )}
                {restaurant?.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={14} />
                    <span>{restaurant.address}</span>
                  </div>
                )}
                {restaurant?.opening_hours && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={14} />
                    <span>{restaurant.opening_hours}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Categorias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory('all')}
                    className="w-full justify-start"
                  >
                    Todos os produtos
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory(category.id)}
                      className="w-full justify-start"
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Delivery Zone Selector */}
            <DeliveryZoneSelector
              deliveryZones={deliveryZones}
              selectedZone={selectedZone}
              onZoneChange={setSelectedZone}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-3"
              />
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow">
                    <div className="aspect-video relative overflow-hidden rounded-t-lg">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400">Sem imagem</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                      {product.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-primary">
                          {formatCurrency(product.price)}
                          {product.weight_based && <span className="text-sm text-gray-500 ml-1">/kg</span>}
                        </span>
                        <ProductVariationSelector
                          product={product}
                          onAddToCart={addToCart}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Cart Button */}
      <MobileCartButton 
        cart={cart}
        onOpenCart={() => setShowCart(true)}
        cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
        cartTotal={getCartTotal()}
        onClick={() => setShowCart(true)}
      />

      {/* Cart Drawer */}
      <MobileCartDrawer
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        cart={cart}
        onUpdateItem={updateCartItem}
        onRemoveItem={removeFromCart}
        deliveryFee={getDeliveryFee()}
        total={getFinalTotal()}
        onCheckout={() => {
          setShowCart(false);
          setShowCheckout(true);
        }}
      />
    </div>
  );
};

export default MenuDigital;
