
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, ShoppingCart, Plus, Minus, CreditCard, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PromotionalBanner from '@/components/marketing/PromotionalBanner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  available: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

const Menu = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    address: '',
    neighborhood: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const { toast } = useToast();

  // Sample products data
  useEffect(() => {
    const sampleProducts: Product[] = [
      {
        id: '1',
        name: 'X-Burger Especial',
        description: 'Hambúrguer artesanal, queijo cheddar, bacon, alface, tomate e molho especial',
        price: 29.90,
        category: 'hamburgers',
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
        available: true,
      },
      {
        id: '2',
        name: 'Pizza Margherita',
        description: 'Molho de tomate, mussarela, tomate e manjericão',
        price: 45.90,
        category: 'pizzas',
        image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b',
        available: true,
      },
      {
        id: '3',
        name: 'Refrigerante Cola 2L',
        description: 'Refrigerante sabor cola gelado',
        price: 12.90,
        category: 'drinks',
        image_url: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13',
        available: true,
      },
      {
        id: '4',
        name: 'Batata Frita Especial',
        description: 'Batatas crocantes com tempero especial da casa',
        price: 18.90,
        category: 'sides',
        image_url: 'https://images.unsplash.com/photo-1576107232684-1279f390859f',
        available: true,
      }
    ];
    setProducts(sampleProducts);
  }, []);

  const categories = [
    { id: 'all', name: 'Todos' },
    { id: 'hamburgers', name: 'Hambúrgueres' },
    { id: 'pizzas', name: 'Pizzas' },
    { id: 'drinks', name: 'Bebidas' },
    { id: 'sides', name: 'Acompanhamentos' }
  ];

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

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
          return newQuantity <= 0 
            ? null 
            : { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleOrderSubmit = () => {
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

    // Here you would normally send the order to your backend
    console.log('Order submitted:', { customerInfo, cart, paymentMethod, total: getTotalPrice() });
    
    toast({
      title: "Pedido enviado!",
      description: "Seu pedido foi recebido e está sendo preparado.",
    });

    // Reset form
    setCart([]);
    setCustomerInfo({ name: '', phone: '', address: '', neighborhood: '' });
    setPaymentMethod('');
    setShowCheckout(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-boracume-orange mb-2">BoraCumê</h1>
          <p className="text-gray-600">Deliciosas opções para você!</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Promotional Banner */}
        <div className="mb-8">
          <PromotionalBanner />
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
                  <Badge variant={product.available ? "default" : "destructive"}>
                    {product.available ? "Disponível" : "Indisponível"}
                  </Badge>
                </div>
                <p className="text-gray-600 text-sm">{product.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-boracume-orange">
                    {formatCurrency(product.price)}
                  </span>
                  <Button 
                    onClick={() => addToCart(product)}
                    disabled={!product.available}
                    className="bg-boracume-orange hover:bg-orange-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
                  <span className="text-boracume-orange">{formatCurrency(getTotalPrice())}</span>
                </div>
                
                <Button 
                  onClick={() => setShowCheckout(true)}
                  className="w-full bg-boracume-orange hover:bg-orange-600"
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
                    <span className="text-boracume-orange">{formatCurrency(getTotalPrice())}</span>
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
                    className="flex-1 bg-boracume-orange hover:bg-orange-600"
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
