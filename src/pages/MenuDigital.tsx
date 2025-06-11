import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ShoppingCart, Plus, Minus, MapPin, Phone, Clock, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProductVariationModal from '@/components/products/ProductVariationModal';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  category: string;
  available: boolean;
  variations?: any[];
}

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  variations: any[];
  notes: string;
  subtotal: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

const MenuDigital = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Customer data
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  
  const { toast } = useToast();

  useEffect(() => {
    console.log('🔄 MenuDigital mounted with userId:', userId);
    if (userId) {
      loadMenuData();
    } else {
      console.error('❌ No userId provided in URL');
      setError('ID do usuário não fornecido na URL');
      setLoading(false);
    }
  }, [userId]);

  const loadMenuData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Starting menu data load for userId:', userId);

      // Load profile data
      console.log('🔄 Loading profile...');
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('❌ Profile error:', profileError);
        throw new Error('Erro ao carregar dados do restaurante');
      }

      if (!profileData) {
        console.error('❌ Profile not found for userId:', userId);
        setError('Restaurante não encontrado');
        setLoading(false);
        return;
      }

      console.log('✅ Profile loaded:', profileData);
      setProfile(profileData);

      // Load products in parallel
      console.log('🔄 Loading products...');
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_variations (
            id,
            name,
            options,
            required,
            max_selections,
            price
          )
        `)
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true);

      if (productsError) {
        console.error('❌ Products error:', productsError);
        // Don't fail completely if products fail to load
        console.warn('⚠️ Failed to load products, continuing with empty menu');
        setProducts([]);
      } else {
        const formattedProducts = productsData?.map(product => ({
          ...product,
          variations: product.product_variations || []
        })) || [];

        console.log('✅ Products loaded:', formattedProducts.length);
        setProducts(formattedProducts);
        
        const uniqueCategories = [...new Set(formattedProducts.map(p => p.category))];
        setCategories(uniqueCategories);
      }

      // Load delivery zones
      console.log('🔄 Loading delivery zones...');
      const { data: zonesData, error: zonesError } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);

      if (zonesError) {
        console.error('❌ Delivery zones error:', zonesError);
        // Don't fail completely if zones fail to load
        console.warn('⚠️ Failed to load delivery zones, continuing without them');
        setDeliveryZones([]);
      } else {
        console.log('✅ Delivery zones loaded:', zonesData?.length || 0);
        setDeliveryZones(zonesData || []);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error loading menu data:', error);
      setError(error.message || 'Erro ao carregar cardápio');
      setLoading(false);
    }
  };

  const handleProductClick = (product: Product) => {
    if (product.variations && product.variations.length > 0) {
      setSelectedProduct(product);
      setShowVariationModal(true);
    } else {
      addToCart(product, [], '', 1);
    }
  };

  const addToCart = (product: Product, variations: any[], notes: string, quantity: number) => {
    const variationsPrice = variations.reduce((total, variation) => {
      if (Array.isArray(variation.selection)) {
        return total + variation.selection.reduce((sum: number, opt: any) => sum + opt.price, 0);
      } else if (variation.selection) {
        return total + variation.selection.price;
      }
      return total;
    }, 0);

    const subtotal = (product.price + variationsPrice) * quantity;

    const cartItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      product,
      quantity,
      variations,
      notes,
      subtotal
    };

    setCart(prev => [...prev, cartItem]);
    
    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      setCart(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCart(prev => prev.map(item => {
        if (item.id === itemId) {
          const variationsPrice = item.variations.reduce((total, variation) => {
            if (Array.isArray(variation.selection)) {
              return total + variation.selection.reduce((sum: number, opt: any) => sum + opt.price, 0);
            } else if (variation.selection) {
              return total + variation.selection.price;
            }
            return total;
          }, 0);
          
          return {
            ...item,
            quantity: newQuantity,
            subtotal: (item.product.price + variationsPrice) * newQuantity
          };
        }
        return item;
      }));
    }
  };

  const getTotalCart = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const getDeliveryFee = () => {
    const zone = deliveryZones.find(z => z.id === selectedZone);
    return zone?.delivery_fee || 0;
  };

  const getFinalTotal = () => {
    return getTotalCart() + getDeliveryFee();
  };

  const handleFinishOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim() || !selectedZone) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha todos os dados obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar.",
        variant: "destructive"
      });
      return;
    }

    const zone = deliveryZones.find(z => z.id === selectedZone);
    if (zone && getTotalCart() < zone.minimum_order) {
      toast({
        title: "Valor mínimo não atingido",
        description: `O valor mínimo para esta região é R$ ${zone.minimum_order.toFixed(2)}.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const orderItems = cart.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        variations: item.variations,
        notes: item.notes
      }));

      const orderData = {
        user_id: userId,
        order_number: `WEB${Date.now()}`,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        delivery_zone_id: selectedZone,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: paymentMethod,
        status: 'pending',
        order_type: 'delivery',
        estimated_time: '30-45 min'
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) throw error;

      toast({
        title: "Pedido realizado!",
        description: "Seu pedido foi enviado com sucesso. Em breve entraremos em contato.",
      });

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedZone('');
      setOrderNotes('');
      setShowCheckout(false);
    } catch (error) {
      console.error('Erro ao finalizar pedido:', error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar o pedido. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

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
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error}
          </h1>
          <p className="text-gray-600 mb-4">
            Verifique se o link está correto e tente novamente.
          </p>
          <div className="text-sm text-gray-500">
            <p>ID do usuário: {userId}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Restaurante não encontrado
          </h1>
          <p className="text-gray-600 mb-4">
            O restaurante que você está procurando não foi encontrado.
          </p>
          <div className="text-sm text-gray-500">
            <p>ID: {userId}</p>
          </div>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setShowCheckout(false)}>
                ← Voltar
              </Button>
              <h1 className="text-xl font-bold">Finalizar Pedido</h1>
              <div />
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-bold text-lg">Dados do Cliente</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome *</label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Telefone *</label>
                  <Input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Endereço *</label>
                  <Textarea
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Rua, número, complemento, bairro"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Região de Entrega *</label>
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Selecione sua região</option>
                    {deliveryZones.map(zone => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name} - {formatCurrency(zone.delivery_fee)}
                        {zone.minimum_order > 0 && ` (Mín: ${formatCurrency(zone.minimum_order)})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Observações</label>
                  <Textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Observações sobre o pedido (opcional)"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão (na entrega)</option>
                    <option value="dinheiro">Dinheiro (na entrega)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-4">Resumo do Pedido</h3>
              
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-sm text-gray-600">Qtd: {item.quantity}</div>
                    </div>
                    <div className="font-medium">{formatCurrency(item.subtotal)}</div>
                  </div>
                ))}
                
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(getTotalCart())}</span>
                  </div>
                  {getDeliveryFee() > 0 && (
                    <div className="flex justify-between">
                      <span>Taxa de entrega:</span>
                      <span>{formatCurrency(getDeliveryFee())}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(getFinalTotal())}</span>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleFinishOrder}
                className="w-full mt-4 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                Finalizar Pedido
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{profile.restaurant_name || 'Cardápio Digital'}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                {profile.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={14} />
                    {profile.phone}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  {profile.opening_hours || '10:00 - 22:00'}
                </div>
              </div>
            </div>
            <div className="relative">
              <Button 
                size="sm" 
                className="relative"
                onClick={() => cart.length > 0 && setShowCheckout(true)}
                disabled={cart.length === 0}
              >
                <ShoppingCart size={16} />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0 text-xs">
                    {cart.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-20">
        {/* Categorias */}
        <div className="py-4">
          <div className="flex gap-2 overflow-x-auto">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="whitespace-nowrap"
            >
              Todos
            </Button>
            {categories.map(category => (
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

        {/* Produtos */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum produto encontrado</h3>
            <p className="text-gray-600">
              {selectedCategory === 'all' 
                ? 'Este restaurante ainda não possui produtos cadastrados.' 
                : 'Nenhum produto encontrado nesta categoria.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map(product => (
              <Card key={product.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {product.image_url && (
                      <div className="w-24 h-24 flex-shrink-0">
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{product.name}</h3>
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                      )}
                      
                      {product.variations && product.variations.length > 0 && (
                        <Badge variant="outline" className="mb-2">
                          Personalizável
                        </Badge>
                      )}

                      <Button 
                        size="sm" 
                        onClick={() => handleProductClick(product)}
                        className="w-full"
                      >
                        <Plus size={16} className="mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Carrinho fixo */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
            <div className="max-w-lg mx-auto p-4">
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(item.subtotal)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus size={12} />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(getTotalCart())}
                    </span>
                  </div>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => setShowCheckout(true)}
                  >
                    Finalizar Pedido
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ProductVariationModal
        isOpen={showVariationModal}
        onClose={() => setShowVariationModal(false)}
        product={selectedProduct!}
        onAddToCart={addToCart}
      />
    </div>
  );
};

export default MenuDigital;
