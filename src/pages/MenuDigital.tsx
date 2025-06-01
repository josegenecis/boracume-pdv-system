
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ShoppingCart, Phone, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useParams } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  available: boolean;
}

interface Restaurant {
  id: string;
  restaurant_name: string;
  description: string;
  phone: string;
  address: string;
  opening_hours: string;
  logo_url?: string;
  delivery_fee: number;
  minimum_order: number;
}

const MenuDigital = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState<{[key: string]: number}>({});
  const { restaurantId } = useParams();

  useEffect(() => {
    fetchMenuData();
  }, [restaurantId]);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      
      // Se tem restaurantId específico, buscar por ele, senão pegar o primeiro usuário
      let userId = restaurantId;
      
      if (!userId) {
        // Buscar o primeiro restaurante disponível
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .not('restaurant_name', 'is', null)
          .limit(1);
        
        if (profiles && profiles.length > 0) {
          userId = profiles[0].id;
        }
      }

      if (!userId) {
        throw new Error('Nenhum restaurante encontrado');
      }

      // Buscar informações do restaurante
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (restaurantError && restaurantError.code !== 'PGRST116') {
        throw restaurantError;
      }

      // Buscar produtos disponíveis
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (productsError) throw productsError;

      setRestaurant(restaurantData);
      setProducts(productsData || []);
    } catch (error) {
      console.error('Erro ao carregar cardápio:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const categories = [
    { id: 'all', name: 'Todos' },
    { id: 'hamburgers', name: 'Hambúrgueres' },
    { id: 'pizzas', name: 'Pizzas' },
    { id: 'drinks', name: 'Bebidas' },
    { id: 'desserts', name: 'Sobremesas' },
    { id: 'appetizers', name: 'Petiscos' },
    { id: 'mains', name: 'Pratos Principais' }
  ];

  const filteredProducts = products.filter(product => 
    selectedCategory === 'all' || product.category === selectedCategory
  );

  const addToCart = (productId: string) => {
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId] > 1) {
        newCart[productId]--;
      } else {
        delete newCart[productId];
      }
      return newCart;
    });
  };

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId);
      return total + (product?.price || 0) * quantity;
    }, 0);
  };

  const getCartItemCount = () => {
    return Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  };

  const handleWhatsAppOrder = () => {
    const orderItems = Object.entries(cart).map(([productId, quantity]) => {
      const product = products.find(p => p.id === productId);
      return `${quantity}x ${product?.name} - ${formatCurrency((product?.price || 0) * quantity)}`;
    }).join('\n');

    const total = getCartTotal() + (restaurant?.delivery_fee || 0);
    const message = `🍽️ *Pedido do Cardápio Digital*\n\n📋 *Itens:*\n${orderItems}\n\n💰 *Subtotal:* ${formatCurrency(getCartTotal())}\n🚚 *Taxa de entrega:* ${formatCurrency(restaurant?.delivery_fee || 0)}\n💯 *Total:* ${formatCurrency(total)}\n\n📍 *Restaurante:* ${restaurant?.restaurant_name}`;
    
    const whatsappUrl = `https://wa.me/${restaurant?.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Restaurante não encontrado</h2>
          <p className="text-muted-foreground">
            O restaurante solicitado não está disponível.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header do Restaurante */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start space-x-4">
            {restaurant.logo_url && (
              <img 
                src={restaurant.logo_url} 
                alt={restaurant.restaurant_name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {restaurant.restaurant_name}
              </h1>
              <p className="text-gray-600 mt-1">{restaurant.description}</p>
              
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                {restaurant.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    {restaurant.phone}
                  </div>
                )}
                {restaurant.address && (
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    {restaurant.address}
                  </div>
                )}
                {restaurant.opening_hours && (
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {restaurant.opening_hours}
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-3 text-sm">
                <Badge variant="outline">
                  Taxa de entrega: {formatCurrency(restaurant.delivery_fee)}
                </Badge>
                <Badge variant="outline">
                  Pedido mínimo: {formatCurrency(restaurant.minimum_order)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Cardápio em breve</h3>
            <p className="text-muted-foreground">
              Estamos preparando nosso cardápio. Volte em breve!
            </p>
          </div>
        ) : (
          <>
            {/* Categorias */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
              <TabsList className="grid grid-cols-4 lg:grid-cols-7 gap-1 h-auto p-1">
                {categories.map(category => (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id} 
                    className="text-xs py-2 px-3"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Lista de Produtos */}
            <div className="grid gap-4">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden">
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
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{product.name}</h3>
                          {product.description && (
                            <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          <p className="font-bold text-primary text-lg mt-2">
                            {formatCurrency(product.price)}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          {cart[product.id] ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeFromCart(product.id)}
                              >
                                -
                              </Button>
                              <span className="w-8 text-center">{cart[product.id]}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addToCart(product.id)}
                              >
                                +
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => addToCart(product.id)}
                            >
                              Adicionar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Carrinho Flutuante */}
      {getCartItemCount() > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto">
          <Card className="bg-primary text-primary-foreground shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={20} />
                    <span className="font-semibold">
                      {getCartItemCount()} {getCartItemCount() === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  <div className="text-sm opacity-90">
                    Total: {formatCurrency(getCartTotal() + (restaurant?.delivery_fee || 0))}
                  </div>
                </div>
                <Button 
                  variant="secondary" 
                  onClick={handleWhatsAppOrder}
                  className="bg-white text-primary hover:bg-gray-100"
                >
                  Finalizar no WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MenuDigital;
