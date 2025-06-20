
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Plus, Minus, Search, X, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import ProductSelectionModal from './ProductSelectionModal';
import ProductVariationModal from './ProductVariationModal';
import AddProductToTableModal from './AddProductToTableModal';

interface CartItem {
  product: any;
  quantity: number;
  variations: any[];
  notes: string;
  totalPrice: number;
  uniqueId: string;
}

const PDVForm = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showAddToTableModal, setShowAddToTableModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pendingTableItem, setPendingTableItem] = useState(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { sendToKitchen } = useKitchenIntegration();

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchCategories();
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .eq('available', true)
        .eq('show_in_pdv', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os produtos.',
        variant: 'destructive',
      });
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
      product.category === selectedCategory || 
      product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setShowVariationModal(true);
  };

  const handleAddToCart = (product: any, quantity: number, variations: any[], notes: string, variationPrice: number) => {
    const uniqueId = `${product.id}-${variations.map(v => v.id || v).join(',')}-${notes}`;
    const totalPrice = (product.price + variationPrice) * quantity;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.uniqueId === uniqueId);
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        updated[existingIndex].totalPrice = 
          (product.price + variationPrice) * updated[existingIndex].quantity;
        return updated;
      } else {
        return [...prev, {
          product,
          quantity,
          variations,
          notes,
          totalPrice,
          uniqueId
        }];
      }
    });

    setShowVariationModal(false);
    setSelectedProduct(null);
    
    toast({
      title: 'Produto adicionado',
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const handleAddToTable = (product: any, quantity: number, variations: any[], notes: string, variationPrice: number) => {
    const totalPrice = (product.price + variationPrice) * quantity;
    
    setPendingTableItem({
      product,
      quantity,
      variations,
      notes,
      totalPrice
    });
    
    setShowVariationModal(false);
    setShowAddToTableModal(true);
  };

  const updateQuantity = (uniqueId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(uniqueId);
      return;
    }

    setCart(prev => prev.map(item => {
      if (item.uniqueId === uniqueId) {
        const basePrice = item.totalPrice / item.quantity;
        return {
          ...item,
          quantity: newQuantity,
          totalPrice: basePrice * newQuantity
        };
      }
      return item;
    }));
  };

  const removeFromCart = (uniqueId: string) => {
    setCart(prev => prev.filter(item => item.uniqueId !== uniqueId));
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.totalPrice, 0);
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Carrinho vazio',
        description: 'Adicione produtos ao carrinho antes de finalizar.',
        variant: 'destructive',
      });
      return;
    }

    if (!customerName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do cliente.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const orderNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      const orderData = {
        user_id: user?.id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_address: 'Venda Presencial - PDV',
        delivery_type: 'pickup',
        payment_method: paymentMethod,
        order_type: 'pdv',
        status: 'completed',
        order_number: orderNumber,
        total: getCartTotal(),
        items: cart.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          variations: item.variations,
          notes: item.notes,
          subtotal: item.totalPrice
        }))
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) throw error;

      // Enviar para o KDS se necessário
      try {
        await sendToKitchen(orderData);
      } catch (kdsError) {
        console.error('Erro ao enviar para KDS:', kdsError);
      }

      toast({
        title: 'Venda finalizada',
        description: `Venda #${orderNumber} finalizada com sucesso!`,
      });

      // Limpar formulário
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');

    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      toast({
        title: 'Erro na venda',
        description: 'Não foi possível finalizar a venda. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Produtos */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="h-full">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid de Produtos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto max-h-[calc(100vh-400px)]">
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow h-36"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-3 h-full flex flex-col">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-16 object-cover rounded mb-2"
                      />
                    )}
                    <div className="flex-1 flex flex-col justify-between">
                      <h4 className="font-medium text-sm line-clamp-2 mb-1">
                        {product.name}
                      </h4>
                      <p className="text-lg font-bold text-primary">
                        R$ {product.price.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carrinho e Finalização */}
      <div className="space-y-4">
        {/* Carrinho */}
        <Card className="h-64">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Carrinho ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 overflow-y-auto max-h-44">
              {cart.map((item) => (
                <div key={item.uniqueId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {item.totalPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateQuantity(item.uniqueId, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0"
                      onClick={() => updateQuantity(item.uniqueId, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0 ml-1"
                      onClick={() => removeFromCart(item.uniqueId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {cart.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Carrinho vazio
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dados do Cliente */}
        <Card className="h-44">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nome *</Label>
              <Input
                id="customer-name"
                placeholder="Nome do cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Telefone</Label>
              <Input
                id="customer-phone"
                placeholder="(11) 99999-9999"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Finalização */}
        <Card className="h-40">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label>Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-bold">
                Total: R$ {getCartTotal().toFixed(2)}
              </span>
            </div>
            
            <Button
              onClick={handleFinalizeSale}
              className="w-full"
              disabled={loading || cart.length === 0}
            >
              {loading ? 'Finalizando...' : 'Finalizar Venda'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ProductVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onAddToCart={handleAddToCart}
        onAddToTable={handleAddToTable}
        showTableOption={true}
      />

      <AddProductToTableModal
        isOpen={showAddToTableModal}
        onClose={() => {
          setShowAddToTableModal(false);
          setPendingTableItem(null);
        }}
        product={pendingTableItem?.product}
        quantity={pendingTableItem?.quantity || 1}
        variations={pendingTableItem?.variations || []}
        notes={pendingTableItem?.notes || ''}
        totalPrice={pendingTableItem?.totalPrice || 0}
        onSuccess={() => {
          setPendingTableItem(null);
        }}
      />
    </div>
  );
};

export default PDVForm;
