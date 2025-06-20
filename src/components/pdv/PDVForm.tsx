import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Minus, Trash2, ShoppingCart, Calculator, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProductSelectionModal from '@/components/pdv/ProductSelectionModal';
import { useCustomerLookup } from '@/hooks/useCustomerLookup';

const PDVForm = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState('no_local'); // novo campo
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { lookupCustomer, isLoading } = useCustomerLookup(user?.id || '');

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
        .order('name');

      if (error) {
        console.error('Erro ao buscar produtos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os produtos.",
          variant: "destructive"
        });
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Erro na consulta de produtos:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao buscar os produtos.",
        variant: "destructive"
      });
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('name')
        .eq('user_id', user?.id)
        .order('name');

      if (error) {
        console.error('Erro ao buscar categorias:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as categorias.",
          variant: "destructive"
        });
      }

      setCategories(data?.map(cat => cat.name) || []);
    } catch (error) {
      console.error('Erro na consulta de categorias:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao buscar as categorias.",
        variant: "destructive"
      });
    }
  };

  const handlePhoneChange = async (e) => {
    const phone = e.target.value;
    setCustomerPhone(phone);
  
    setCustomerName('');
  
    if (phone.length >= 10) {
      setIsLookingUp(true);
      try {
        const customer = await lookupCustomer(phone);
        if (customer) {
          setCustomerName(customer.name);
        } else {
          setCustomerName('');
        }
      } finally {
        setIsLookingUp(false);
      }
    }
  };

  const filteredProducts = products.filter((product) => {
    const searchTermLower = searchTerm.toLowerCase();
    const productNameLower = product.name.toLowerCase();
    const productCategory = product.category || '';

    const matchesSearchTerm = productNameLower.includes(searchTermLower);
    const matchesCategory = selectedCategory === 'all' ? true : productCategory === selectedCategory;

    return matchesSearchTerm && matchesCategory;
  });

  const handleProductSelect = (product) => {
    setShowProductModal(true);
    setSelectedProduct(product);
  };

  const [selectedProduct, setSelectedProduct] = useState(null);

  const addToCart = (product, quantity = 1, variations = []) => {
    const existingItemIndex = cartItems.findIndex(item => item.id === product.id && JSON.stringify(item.variations) === JSON.stringify(variations));
  
    if (existingItemIndex > -1) {
      const updatedCartItems = [...cartItems];
      updatedCartItems[existingItemIndex].quantity += quantity;
      setCartItems(updatedCartItems);
    } else {
      setCartItems([...cartItems, { ...product, quantity, variations }]);
    }
  };

  const updateCartItemQuantity = (index, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(index);
      return;
    }

    const updatedCartItems = [...cartItems];
    updatedCartItems[index].quantity = newQuantity;
    setCartItems(updatedCartItems);
  };

  const removeFromCart = (index) => {
    const updatedCartItems = [...cartItems];
    updatedCartItems.splice(index, 1);
    setCartItems(updatedCartItems);
  };

  const total = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleDirectSale = async () => {
    if (cartItems.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar a venda.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.from('orders').insert([
        {
          user_id: user?.id,
          customer_name: customerName || 'Cliente',
          customer_phone: customerPhone || 'Não informado',
          items: cartItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            variations: item.variations
          })),
          total: total,
          status: 'pending',
          payment_method: 'dinheiro',
          delivery_type: orderType,
          customer_address: orderType === 'no_local' ? 'Consumo Local' : 'Não informado',
        }
      ]).select();

      if (error) {
        console.error('Erro ao criar pedido:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar o pedido.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Venda realizada",
          description: "Pedido criado com sucesso!",
        });
        setCartItems([]);
        setCustomerPhone('');
        setCustomerName('');
      }
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar o pedido.",
        variant: "destructive"
      });
    }
  };

  const [selectedTable, setSelectedTable] = useState(null);
  const [showAssignTableModal, setShowAssignTableModal] = useState(false);

  const handleAssignTable = (table) => {
    setSelectedTable(table);
    setShowAssignTableModal(true);
  };

  const assignCartToTable = async () => {
    if (!selectedTable) {
      toast({
        title: "Nenhuma mesa selecionada",
        description: "Selecione uma mesa para adicionar o pedido.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.from('table_accounts').insert([
        {
          user_id: user?.id,
          table_id: selectedTable.id,
          items: cartItems.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            variations: item.variations
          })),
          total: total,
          status: 'open',
        }
      ]).select();

      if (error) {
        console.error('Erro ao criar conta na mesa:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar a conta na mesa.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Pedido adicionado à mesa",
          description: "O pedido foi adicionado à mesa com sucesso!",
        });
        setCartItems([]);
        setCustomerPhone('');
        setCustomerName('');
        setShowAssignTableModal(false);
      }
    } catch (error) {
      console.error('Erro ao criar conta na mesa:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar a conta na mesa.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      {/* Products Selection */}
      <div className="lg:col-span-2 space-y-4">
        <Card className="h-full">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Produtos
              </span>
              {selectedCategory !== 'all' && (
                <Badge variant="secondary">{selectedCategory}</Badge>
              )}
            </CardTitle>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {filteredProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow h-20"
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="relative h-12">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded-t-lg">
                          <span className="text-gray-400 text-xs">Sem imagem</span>
                        </div>
                      )}
                      {!product.available && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-t-lg">
                          <span className="text-white text-xs font-bold">Indisponível</span>
                        </div>
                      )}
                    </div>
                    
                    <CardContent className="p-1">
                      <h3 className="font-medium text-xs leading-tight line-clamp-1 mb-1">
                        {product.name}
                      </h3>
                      <p className="text-xs font-bold text-green-600">
                        R$ {Number(product.price).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Cart and Customer Info */}
      <div className="space-y-4">
        <Card className="h-full">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Carrinho de Vendas
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 flex flex-col h-full">
            {/* Customer Info */}
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-phone" className="text-sm font-medium">
                    Telefone
                  </Label>
                  <Input
                    id="customer-phone"
                    placeholder="(00) 00000-0000"
                    value={customerPhone}
                    onChange={handlePhoneChange}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-name" className="text-sm font-medium">
                    Nome
                  </Label>
                  <Input
                    id="customer-name"
                    placeholder="Nome do cliente"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Pedido</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_local">🍽️ No Local</SelectItem>
                    <SelectItem value="pickup">📦 Retirada</SelectItem>
                    <SelectItem value="delivery">🛵 Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Cart Items */}
            <div className="flex-1 min-h-0">
              <Label className="text-sm font-medium mb-2 block">Itens do Pedido</Label>
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        {item.variations && item.variations.length > 0 && (
                          <p className="text-xs text-gray-600">
                            {item.variations.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          R$ {item.price.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCartItemQuantity(index, item.quantity - 1)}
                          className="h-6 w-6 p-0"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-8 text-center">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateCartItemQuantity(index, item.quantity + 1)}
                          className="h-6 w-6 p-0"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromCart(index)}
                          className="h-6 w-6 p-0 ml-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Total and Actions */}
            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-lg font-bold text-green-600">
                  R$ {total.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={handleDirectSale}
                  disabled={cartItems.length === 0}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Finalizar Venda
                </Button>
                
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    onClick={() => setShowTableModal(true)}
                    disabled={cartItems.length === 0}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Adicionar à Mesa
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Selection Modal */}
      <ProductSelectionModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onAddToCart={addToCart}
      />
    </div>
  );
};

export default PDVForm;
