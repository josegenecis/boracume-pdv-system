import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ShoppingCart, Plus, Minus, Search, Phone, MapPin, Clock, Trash2, ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDigitalMenuCart } from '@/hooks/useDigitalMenuCart';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time?: string;
  active?: boolean;
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

const MenuDigital = () => {
  const { userId } = useParams<{ userId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  
  // Estados do checkout
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    deliveryInstructions: ''
  });

  const { cart, addToCart, updateCartItem, removeFromCart, clearCart, getCartTotal, getCartItemCount } = useDigitalMenuCart();
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

      // Buscar perfil do restaurante - PÚBLICO
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw new Error('Restaurante não encontrado');
      setRestaurant(profileData);

      // Buscar produtos - PÚBLICO
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

      // Buscar categorias - PÚBLICO
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

      // Buscar zonas de entrega - PÚBLICO
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
      console.error('Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao carregar dados do restaurante');
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

  const getDeliveryFee = () => {
    if (!selectedZone) return restaurant?.delivery_fee || 0;
    const zone = deliveryZones.find(z => z.id === selectedZone);
    return zone?.delivery_fee || restaurant?.delivery_fee || 0;
  };

  const getFinalTotal = () => {
    return getCartTotal() + getDeliveryFee();
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const formattedDate = format(now, 'yyMMdd', { locale: ptBR });
    const randomNumber = Math.floor(Math.random() * 1000);
    return `WEB-${formattedDate}-${randomNumber.toString().padStart(3, '0')}`;
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerData.name || !customerData.phone || !customerData.address) {
      toast({
        title: "Dados obrigatórios",
        description: "Preencha nome, telefone e endereço.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedZone) {
      toast({
        title: "Zona de entrega obrigatória",
        description: "Selecione uma zona de entrega.",
        variant: "destructive",
      });
      return;
    }

    const selectedZoneData = deliveryZones.find(z => z.id === selectedZone);
    if (selectedZoneData && getCartTotal() < selectedZoneData.minimum_order) {
      toast({
        title: "Pedido mínimo não atingido",
        description: `O pedido mínimo para ${selectedZoneData.name} é ${formatCurrency(selectedZoneData.minimum_order)}.`,
        variant: "destructive",
      });
      return;
    }

    setSubmittingOrder(true);

    try {
      const orderNumber = generateOrderNumber();
      
      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        options: item.selectedOptions || [],
        notes: item.notes || ''
      }));

      const orderData = {
        user_id: userId,
        order_number: orderNumber,
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        customer_address: customerData.address,
        delivery_zone_id: selectedZone,
        delivery_instructions: customerData.deliveryInstructions || null,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: 'pending',
        status: 'new',
        order_type: 'delivery',
        estimated_time: '30-45 min'
      };

      // Salvar pedido - SEM necessidade de autenticação
      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) throw error;

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Pedido #${orderNumber} foi enviado. Você receberá confirmação em breve.`,
      });

      // Limpar dados
      clearCart();
      setShowCheckout(false);
      setCustomerData({
        name: '',
        phone: '',
        address: '',
        deliveryInstructions: ''
      });
      setSelectedZone('');

    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: "Erro ao realizar pedido",
        description: error.message || "Não foi possível processar o pedido.",
        variant: "destructive"
      });
    } finally {
      setSubmittingOrder(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

  // Tela de checkout
  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowCheckout(false)} variant="outline" size="icon">
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
              {cart.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span>{item.quantity}x {item.name}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              
              <Separator />
              
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(getCartTotal())}</span>
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

          {/* Formulário */}
          <form onSubmit={handleSubmitOrder} className="space-y-6">
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
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
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
              disabled={submittingOrder}
            >
              {submittingOrder ? 'Processando...' : `Confirmar Pedido - ${formatCurrency(getFinalTotal())}`}
            </Button>
          </form>
        </div>
      </div>
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
                    {getCartItemCount()}
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
            {/* Info do Restaurante */}
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

            {/* Categorias */}
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

            {/* Seletor de Zona de Entrega */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin size={20} />
                  Selecione sua região
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deliveryZones.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Nenhuma zona de entrega disponível.
                  </p>
                ) : (
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha sua região" />
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
                )}
              </CardContent>
            </Card>
          </div>

          {/* Conteúdo Principal */}
          <div className="lg:col-span-3 space-y-6">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-3"
              />
            </div>

            {/* Grid de Produtos */}
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
                        <Button
                          onClick={() => addToCart(product)}
                          size="sm"
                        >
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
        </div>
      </div>

      {/* Botão do Carrinho Mobile */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 right-4 md:hidden z-50">
          <Button 
            onClick={() => setShowCart(true)}
            className="relative rounded-full w-16 h-16 shadow-lg"
          >
            <ShoppingCart size={24} />
            <Badge className="absolute -top-2 -right-2 bg-red-500 w-6 h-6 rounded-full flex items-center justify-center text-xs">
              {getCartItemCount()}
            </Badge>
          </Button>
        </div>
      )}

      {/* Modal do Carrinho - Desktop */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carrinho de Compras</DialogTitle>
          </DialogHeader>
          
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-gray-600">{formatCurrency(item.price)}</p>
                    {item.notes && (
                      <p className="text-xs text-gray-500">Obs: {item.notes}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCartItem(index, item.quantity - 1)}
                    >
                      <Minus size={14} />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCartItem(index, item.quantity + 1)}
                    >
                      <Plus size={14} />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeFromCart(index)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  
                  <div className="ml-4 text-right">
                    <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(getCartTotal())}</span>
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
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setShowCart(false);
                    setShowCheckout(true);
                  }}
                  className="flex-1"
                  disabled={!selectedZone}
                >
                  {!selectedZone ? 'Selecione uma região' : 'Finalizar Pedido'}
                </Button>
                <Button variant="outline" onClick={() => setShowCart(false)}>
                  Continuar Comprando
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drawer do Carrinho - Mobile */}
      <Drawer open={showCart && window.innerWidth < 768} onOpenChange={setShowCart}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Carrinho de Compras</DrawerTitle>
          </DrawerHeader>
          <div className="p-4">
            {/* Conteúdo similar ao modal desktop */}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default MenuDigital;
