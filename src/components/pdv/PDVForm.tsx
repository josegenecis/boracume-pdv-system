
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, ShoppingCart, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProductSelectionModal from './ProductSelectionModal';

interface CartItem {
  id: string;
  product: any;
  quantity: number;
  unitPrice: number;
  variations: string[];
  notes: string;
  total: number;
}

const PDVForm = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        .eq('show_in_pdv', true)
        .order('name');

      if (error) {
        console.error('Erro ao buscar produtos:', error);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    } finally {
      setLoading(false);
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

      if (error) {
        console.error('Erro ao buscar categorias:', error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: any, quantity: number = 1, variations: string[] = [], notes: string = '') => {
    const unitPrice = Number(product.price);
    const cartItem: CartItem = {
      id: `${product.id}-${Date.now()}`,
      product,
      quantity,
      unitPrice,
      variations,
      notes,
      total: unitPrice * quantity
    };

    setCart(prev => [...prev, cartItem]);
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, quantity: newQuantity, total: item.unitPrice * newQuantity }
          : item
      )
    );
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.total, 0);
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const finalizeOrder = async () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const orderData = {
        user_id: user?.id,
        customer_name: 'Venda Balcão',
        customer_phone: '',
        order_type: 'balcao',
        payment_method: 'dinheiro',
        status: 'completed',
        total: getCartTotal(),
        items: cart.map(item => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          variations: item.variations,
          notes: item.notes,
          total: item.total
        }))
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) {
        console.error('Erro ao criar pedido:', error);
        toast({
          title: "Erro ao finalizar venda",
          description: "Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Venda finalizada com sucesso!",
        description: `Total: R$ ${getCartTotal().toFixed(2)}`,
      });

      clearCart();
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]"> {/* Altura fixa para evitar scroll */}
      
      {/* Produtos - 2/3 da tela */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Filtros */}
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search">Buscar Produto</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Digite para buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="w-48">
                <Label>Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas as categorias</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lista de Produtos - Grid menor */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow h-32" // Altura reduzida para 128px
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-2 h-full flex flex-col"> {/* Padding reduzido */}
                    <div className="flex-1">
                      <h4 className="font-medium text-xs leading-tight line-clamp-2 mb-1"> {/* Fonte menor */}
                        {product.name}
                      </h4>
                      <p className="text-lg font-bold text-green-600"> {/* Preço destacado */}
                        R$ {Number(product.price).toFixed(2)}
                      </p>
                    </div>
                    
                    {product.weight_based && (
                      <Badge variant="secondary" className="text-xs self-start">
                        Por Peso
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carrinho - 1/3 da tela com altura fixa */}
      <div className="space-y-4">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrinho ({cart.length})
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col">
            {/* Items do carrinho - área rolável */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="border rounded p-2 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-sm line-clamp-2">
                      {item.product.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromCart(item.id)}
                      className="h-6 w-6 p-0 text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {item.variations.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {item.variations.join(', ')}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      
                      <span className="text-sm font-medium w-8 text-center">
                        {item.quantity}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <span className="font-bold text-sm">
                      R$ {item.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              
              {cart.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Carrinho vazio
                </div>
              )}
            </div>

            {/* Total e botões - fixos na parte inferior */}
            {cart.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-xl font-bold text-green-600">
                    R$ {getCartTotal().toFixed(2)}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <Button 
                    onClick={finalizeOrder}
                    className="w-full"
                    size="lg"
                  >
                    Finalizar Venda
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={clearCart}
                    className="w-full"
                  >
                    Limpar Carrinho
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de seleção de produto */}
      {selectedProduct && (
        <ProductSelectionModal
          product={selectedProduct}
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setSelectedProduct(null);
          }}
          onAddToCart={addToCart}
        />
      )}
    </div>
  );
};

export default PDVForm;
