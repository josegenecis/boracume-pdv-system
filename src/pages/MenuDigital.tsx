
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Phone, MapPin, Clock, Search, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  available: boolean;
  weight_based?: boolean;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Banner {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  link_url?: string;
  start_date?: string;
  end_date?: string;
  active: boolean;
}

interface Restaurant {
  id: string;
  restaurant_name?: string;
  description?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  opening_hours?: string;
}

interface CartItem extends Product {
  quantity: number;
}

const MenuDigital = () => {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMenuData();
  }, [restaurantId]);

  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, searchQuery]);

  const fetchMenuData = async () => {
    try {
      setLoading(true);
      
      let userId = restaurantId;
      
      // Se não há restaurantId específico, pegar o primeiro restaurante disponível
      if (!restaurantId) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
        
        if (profiles && profiles.length > 0) {
          userId = profiles[0].id;
        } else {
          throw new Error('Nenhum restaurante encontrado');
        }
      }

      // Buscar dados do restaurante
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      // Buscar categorias
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('display_order');

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Buscar produtos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .order('name');

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Buscar banners ativos
      const { data: bannersData, error: bannersError } = await supabase
        .from('promotional_banners')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .or(`start_date.is.null,start_date.lte.${new Date().toISOString()}`)
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
        .order('display_order');

      if (bannersError) {
        console.warn('Erro ao carregar banners:', bannersError);
      } else {
        setBanners(bannersData || []);
      }

    } catch (error: any) {
      console.error('Erro ao carregar dados do menu:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o menu do restaurante.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category_id === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
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

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
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

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Sem categoria';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Sem categoria';
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

    if (!customerInfo.name || !customerInfo.phone) {
      toast({
        title: "Informações obrigatórias",
        description: "Por favor, preencha seu nome e telefone.",
        variant: "destructive",
      });
      return;
    }

    const orderDetails = cart.map(item => 
      `• ${item.name} (${item.quantity}x) - ${formatCurrency(item.price * item.quantity)}`
    ).join('\n');

    const message = `🍽️ *Novo Pedido - ${restaurant?.restaurant_name}*\n\n` +
      `👤 *Cliente:* ${customerInfo.name}\n` +
      `📱 *Telefone:* ${customerInfo.phone}\n` +
      `📍 *Endereço:* ${customerInfo.address || 'Não informado'}\n\n` +
      `🛒 *Itens do Pedido:*\n${orderDetails}\n\n` +
      `💰 *Total:* ${formatCurrency(getTotalValue())}`;

    const whatsappUrl = `https://wa.me/${restaurant?.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <CardContent>
            <h2 className="text-2xl font-bold mb-4">Restaurante não encontrado</h2>
            <p className="text-muted-foreground">
              O restaurante que você está procurando não foi encontrado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header do Restaurante */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {restaurant.logo_url && (
              <img 
                src={restaurant.logo_url} 
                alt={restaurant.restaurant_name}
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{restaurant.restaurant_name || 'Restaurante'}</h1>
              {restaurant.description && (
                <p className="text-gray-600">{restaurant.description}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                {restaurant.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={16} />
                    {restaurant.phone}
                  </div>
                )}
                {restaurant.address && (
                  <div className="flex items-center gap-1">
                    <MapPin size={16} />
                    {restaurant.address}
                  </div>
                )}
                {restaurant.opening_hours && (
                  <div className="flex items-center gap-1">
                    <Clock size={16} />
                    {restaurant.opening_hours}
                  </div>
                )}
              </div>
            </div>
            {cart.length > 0 && (
              <Button 
                onClick={() => setIsCartOpen(true)}
                className="relative"
              >
                <ShoppingCart size={20} />
                <Badge className="absolute -top-2 -right-2 bg-red-500">
                  {cart.reduce((total, item) => total + item.quantity, 0)}
                </Badge>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Banners Promocionais */}
      {banners.length > 0 && (
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map((banner) => (
              <Card key={banner.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                {banner.image_url && (
                  <img 
                    src={banner.image_url} 
                    alt={banner.title}
                    className="w-full h-32 object-cover"
                  />
                )}
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg">{banner.title}</h3>
                  {banner.description && (
                    <p className="text-gray-600 text-sm mt-1">{banner.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Filtros */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === 'all' ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              Todos
            </Button>
            {categories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Lista de Produtos */}
        {filteredProducts.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-lg font-medium mb-2">Nenhum produto encontrado</p>
              <p className="text-muted-foreground">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Tente ajustar os filtros ou buscar por outros termos.'
                  : 'Este restaurante ainda não tem produtos cadastrados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
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
                    <Badge variant="outline">{getCategoryName(product.category_id)}</Badge>
                  </div>
                  {product.description && (
                    <p className="text-gray-600 text-sm">{product.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-primary">
                      {formatCurrency(product.price)}
                      {product.weight_based && <span className="text-xs text-gray-500 ml-1">/kg</span>}
                    </span>
                    <Button onClick={() => addToCart(product)}>
                      <Plus size={16} className="mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal do Carrinho */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seu Pedido</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Seu carrinho está vazio
              </p>
            ) : (
              <>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.price)} cada
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus size={12} />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold mb-4">
                    <span>Total:</span>
                    <span>{formatCurrency(getTotalValue())}</span>
                  </div>
                  
                  <div className="space-y-3">
                    <Input
                      placeholder="Seu nome *"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <Input
                      placeholder="Seu telefone *"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                    />
                    <Textarea
                      placeholder="Endereço para entrega"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleWhatsAppOrder}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700"
                    disabled={cart.length === 0}
                  >
                    Fazer Pedido via WhatsApp
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuDigital;
