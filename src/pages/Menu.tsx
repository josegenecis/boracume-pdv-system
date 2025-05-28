
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, ShoppingCart, Plus, Minus, CreditCard, Smartphone, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  available: boolean;
  user_id: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface RestaurantInfo {
  restaurant_name: string;
  description?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
}

const Menu = () => {
  const { restaurantId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    address: '',
    neighborhood: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurantData(restaurantId);
    } else {
      // Se não há ID específico, busca o primeiro restaurante
      fetchFirstRestaurant();
    }
  }, [restaurantId]);

  const fetchFirstRestaurant = async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, restaurant_name, description, phone, address, logo_url')
        .limit(1);

      if (profileError) throw profileError;
      
      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        setRestaurantInfo({
          restaurant_name: profile.restaurant_name || 'Restaurante',
          description: profile.description,
          phone: profile.phone,
          address: profile.address,
          logo_url: profile.logo_url
        });
        fetchProducts(profile.id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do restaurante:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as informações do restaurante.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantData = async (userId: string) => {
    try {
      setLoading(true);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('restaurant_name, description, phone, address, logo_url')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      
      setRestaurantInfo(profile);
      fetchProducts(userId);
    } catch (error) {
      console.error('Erro ao carregar dados do restaurante:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as informações do restaurante.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .order('category', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos.",
        variant: "destructive"
      });
    }
  };

  const categories = [
    { id: 'all', name: 'Todos' },
    ...Array.from(new Set(products.map(p => p.category))).map(category => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(1)
    }))
  ];

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === productId) {
          const newQuantity = item.quantity + change;
          return newQuantity <= 0 ? null : { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleOrderSubmit = async () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address || !paymentMethod) {
      toast({
        title: "Informações incompletas",
        description: "Por favor, preencha todas as informações obrigatórias.",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione pelo menos um item ao carrinho.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .insert({
          customer_name: customerInfo.name,
          customer_phone: customerInfo.phone,
          customer_address: customerInfo.address,
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          total: getTotalPrice(),
          payment_method: paymentMethod,
          status: 'new',
          user_id: cart[0]?.user_id
        });

      if (error) throw error;

      toast({
        title: "Pedido enviado!",
        description: "Seu pedido foi recebido e está sendo preparado.",
      });

      setCart([]);
      setCustomerInfo({ name: '', phone: '', address: '', neighborhood: '' });
      setPaymentMethod('');
      setShowCheckout(false);
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o pedido. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {restaurantInfo?.logo_url && (
              <img 
                src={restaurantInfo.logo_url} 
                alt="Logo" 
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-primary">
                {restaurantInfo?.restaurant_name || 'Restaurante'}
              </h1>
              {restaurantInfo?.description && (
                <p className="text-gray-600">{restaurantInfo.description}</p>
              )}
              {restaurantInfo?.address && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {restaurantInfo.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className="whitespace-nowrap"
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {filteredProducts.map(product => (
            <Card key={product.id} className="overflow-hidden">
              {product.image_url && (
                <div className="aspect-video w-full overflow-hidden">
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <Badge variant="default">Disponível</Badge>
                </div>
                {product.description && (
                  <p className="text-gray-600 text-sm">{product.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(product.price)}
                  </span>
                  <Button 
                    onClick={() => addToCart(product)}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum produto encontrado.</p>
          </div>
        )}

        {/* Cart Summary */}
        {cart.length > 0 && (
          <Card className="fixed bottom-4 left-4 right-4 md:relative md:bottom-auto md:left-auto md:right-auto shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Seu Pedido ({cart.length} {cart.length === 1 ? 'item' : 'itens'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <p className="text-sm text-gray-600">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-medium">{item.quantity}</span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateQuantity(item.id, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Separator />
                
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(getTotalPrice())}</span>
                </div>
                
                <Button 
                  onClick={() => setShowCheckout(true)}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Finalizar Pedido
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checkout Modal */}
        {showCheckout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Finalizar Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Informações do Cliente</h3>
                  <Input
                    placeholder="Nome completo *"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Telefone *"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                {/* Address */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Endereço de Entrega
                  </h3>
                  <Input
                    placeholder="Endereço completo *"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                  />
                  <Input
                    placeholder="Bairro"
                    value={customerInfo.neighborhood}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, neighborhood: e.target.value }))}
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Forma de Pagamento</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={paymentMethod === 'credit' ? "default" : "outline"}
                      onClick={() => setPaymentMethod('credit')}
                      className="h-12"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Cartão
                    </Button>
                    <Button
                      variant={paymentMethod === 'pix' ? "default" : "outline"}
                      onClick={() => setPaymentMethod('pix')}
                      className="h-12"
                    >
                      <Smartphone className="w-4 h-4 mr-2" />
                      PIX
                    </Button>
                    <Button
                      variant={paymentMethod === 'cash' ? "default" : "outline"}
                      onClick={() => setPaymentMethod('cash')}
                      className="h-12 col-span-2"
                    >
                      💰 Dinheiro
                    </Button>
                  </div>
                </div>

                {/* Order Summary */}
                <div className="space-y-2 pt-4 border-t">
                  <h3 className="font-semibold">Resumo do Pedido</h3>
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span>{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(getTotalPrice())}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCheckout(false)}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button 
                    onClick={handleOrderSubmit}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Confirmar Pedido
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Menu;
