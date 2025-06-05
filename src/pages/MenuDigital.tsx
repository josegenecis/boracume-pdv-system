
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, ShoppingCart, Phone, MapPin, Clock, Truck, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PromotionalBanner from '@/components/marketing/PromotionalBanner';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category: string;
  available: boolean;
  weight_based?: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

interface Restaurant {
  id: string;
  restaurant_name?: string;
  description?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  logo_url?: string;
  minimum_order?: number;
  delivery_fee?: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time?: string;
}

const MenuDigital = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user') || searchParams.get('u');
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadMenuData();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRestaurantInfo(),
        loadProducts(),
        loadDeliveryZones()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados do menu:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o menu.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRestaurantInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setRestaurant(data);
    } catch (error) {
      console.error('Erro ao carregar informações do restaurante:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const loadDeliveryZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setDeliveryZones(data || []);
      console.log('Bairros carregados:', data);
    } catch (error) {
      console.error('Erro ao carregar bairros de entrega:', error);
    }
  };

  const categories = [...new Set(products.map(p => p.category))].filter(Boolean);
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category === selectedCategory)
    : products;

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
      title: 'Produto adicionado',
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

  const getDeliveryFee = () => {
    if (orderType !== 'delivery' || !selectedDeliveryZone) return 0;
    const zone = deliveryZones.find(z => z.id === selectedDeliveryZone);
    return zone?.delivery_fee || 0;
  };

  const getFinalTotal = () => {
    return getTotalValue() + getDeliveryFee();
  };

  const generateOrderNumber = () => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  const handleFinishOrder = async () => {
    console.log('Iniciando finalização do pedido...');
    console.log('Bairros disponíveis:', deliveryZones);
    console.log('Bairro selecionado:', selectedDeliveryZone);
    
    if (cart.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Adicione produtos antes de finalizar o pedido.',
        variant: 'destructive',
      });
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      toast({
        title: 'Dados obrigatórios',
        description: 'Por favor, preencha seu nome e telefone.',
        variant: 'destructive',
      });
      return;
    }

    if (orderType === 'delivery') {
      if (!customerAddress.trim()) {
        toast({
          title: 'Endereço obrigatório',
          description: 'Por favor, preencha o endereço para entrega.',
          variant: 'destructive',
        });
        return;
      }

      if (!selectedDeliveryZone) {
        toast({
          title: 'Bairro obrigatório',
          description: 'Por favor, selecione o bairro para entrega.',
          variant: 'destructive',
        });
        return;
      }

      // Verificar valor mínimo
      const zone = deliveryZones.find(z => z.id === selectedDeliveryZone);
      if (zone && getTotalValue() < zone.minimum_order) {
        toast({
          title: 'Valor mínimo não atingido',
          description: `O valor mínimo para entrega neste bairro é ${formatCurrency(zone.minimum_order)}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setProcessing(true);

      const orderNumber = generateOrderNumber();
      
      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      }));

      const orderData = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: orderType === 'delivery' ? customerAddress.trim() : null,
        order_type: orderType,
        delivery_zone_id: orderType === 'delivery' ? selectedDeliveryZone : null,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: paymentMethod,
        status: 'new',
        order_number: orderNumber,
        user_id: userId,
        estimated_time: deliveryZones.find(z => z.id === selectedDeliveryZone)?.delivery_time || '30-45 min'
      };

      console.log('Dados do pedido:', orderData);

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) {
        console.error('Erro SQL:', error);
        throw error;
      }

      toast({
        title: 'Pedido enviado!',
        description: `Seu pedido #${orderNumber} foi recebido. Total: ${formatCurrency(getFinalTotal())}.`,
      });

      // Limpar formulário
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedDeliveryZone('');
      setShowCheckout(false);
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o pedido. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userId || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Menu não encontrado</h2>
              <p className="text-gray-600">
                Este link parece estar incorreto ou o restaurante não existe.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header do Restaurante */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start gap-4">
            {restaurant.logo_url && (
              <img
                src={restaurant.logo_url}
                alt={restaurant.restaurant_name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {restaurant.restaurant_name || 'Restaurante'}
              </h1>
              {restaurant.description && (
                <p className="text-gray-600 mt-1">{restaurant.description}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
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
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Banner Promocional */}
        <div className="mb-6">
          <PromotionalBanner restaurantId={userId} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tipo de Pedido */}
            <Card>
              <CardHeader>
                <CardTitle>Tipo de Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={orderType === 'delivery' ? 'default' : 'outline'}
                    onClick={() => setOrderType('delivery')}
                    className="flex items-center gap-2"
                  >
                    <Truck size={16} />
                    Entrega
                  </Button>
                  <Button
                    variant={orderType === 'pickup' ? 'default' : 'outline'}
                    onClick={() => setOrderType('pickup')}
                    className="flex items-center gap-2"
                  >
                    <Store size={16} />
                    Retirada
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Filtros por Categoria */}
            {categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Categorias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedCategory === '' ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory('')}
                      size="sm"
                    >
                      Todas
                    </Button>
                    {categories.map((category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory(category)}
                        size="sm"
                      >
                        {category}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Produtos - Grid menor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.length === 0 ? (
                <div className="col-span-2">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center text-gray-500">
                        <p>Nenhum produto disponível no momento.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="space-y-3">
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-32 rounded-lg object-cover"
                          />
                        )}
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-sm">{product.name}</h3>
                            <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                          </div>
                          {product.description && (
                            <p className="text-gray-600 text-xs line-clamp-2">{product.description}</p>
                          )}
                          <div className="flex justify-between items-center">
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(product.price)}
                              {product.weight_based && <span className="text-xs text-gray-500 ml-1">/kg</span>}
                            </p>
                            <div className="flex items-center gap-1">
                              {cart.find(item => item.id === product.id) ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => updateQuantity(product.id, cart.find(item => item.id === product.id)!.quantity - 1)}
                                  >
                                    <Minus size={12} />
                                  </Button>
                                  <span className="w-6 text-center text-sm">
                                    {cart.find(item => item.id === product.id)?.quantity}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => updateQuantity(product.id, cart.find(item => item.id === product.id)!.quantity + 1)}
                                  >
                                    <Plus size={12} />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => addToCart(product)}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                >
                                  <Plus size={12} className="mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Carrinho */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart size={20} />
                  Carrinho ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    Carrinho vazio
                  </p>
                ) : (
                  <>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex justify-between items-start p-2 border rounded">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(item.price)} x {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="h-6 w-6 p-0"
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="h-6 w-6 p-0"
                            >
                              <Plus size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(getTotalValue())}</span>
                      </div>
                      
                      {orderType === 'delivery' && getDeliveryFee() > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Taxa de entrega:</span>
                          <span>{formatCurrency(getDeliveryFee())}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(getFinalTotal())}</span>
                      </div>
                    </div>

                    {!showCheckout ? (
                      <Button
                        onClick={() => setShowCheckout(true)}
                        className="w-full"
                        disabled={cart.length === 0}
                      >
                        Finalizar Pedido
                      </Button>
                    ) : (
                      <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium">Dados do Pedido</h4>
                        
                        <Input
                          placeholder="Seu nome *"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                        
                        <Input
                          placeholder="Seu telefone *"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                        
                        {orderType === 'delivery' && (
                          <>
                            <Textarea
                              placeholder="Endereço completo para entrega *"
                              value={customerAddress}
                              onChange={(e) => setCustomerAddress(e.target.value)}
                              rows={2}
                            />
                            
                            {deliveryZones.length > 0 && (
                              <Select value={selectedDeliveryZone} onValueChange={setSelectedDeliveryZone}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione seu bairro *" />
                                </SelectTrigger>
                                <SelectContent>
                                  {deliveryZones.map((zone) => (
                                    <SelectItem key={zone.id} value={zone.id}>
                                      <div className="flex flex-col text-left">
                                        <span>{zone.name}</span>
                                        <span className="text-xs text-gray-500">
                                          Taxa: {formatCurrency(zone.delivery_fee)} | 
                                          Mín: {formatCurrency(zone.minimum_order)}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </>
                        )}
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Forma de Pagamento</label>
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                              onClick={() => setPaymentMethod('pix')}
                              size="sm"
                            >
                              PIX
                            </Button>
                            <Button
                              variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                              onClick={() => setPaymentMethod('cartao')}
                              size="sm"
                            >
                              Cartão
                            </Button>
                            <Button
                              variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'}
                              onClick={() => setPaymentMethod('dinheiro')}
                              size="sm"
                            >
                              Dinheiro
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowCheckout(false)}
                            className="flex-1"
                          >
                            Voltar
                          </Button>
                          <Button
                            onClick={handleFinishOrder}
                            disabled={processing}
                            className="flex-1"
                          >
                            {processing ? 'Enviando...' : 'Confirmar'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuDigital;
