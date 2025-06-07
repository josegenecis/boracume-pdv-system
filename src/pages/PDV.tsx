
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Minus, Trash2, Calculator, Search, Store, Truck, UtensilsCrossed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  category_id?: string;
  description?: string;
  weight_based?: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
}

interface Table {
  id: string;
  table_number: number;
  status: string;
}

const PDV = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | 'dine_in'>('delivery');
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [changeAmount, setChangeAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchProducts(),
        fetchDeliveryZones(),
        fetchTables()
      ]);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .eq('available', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setProducts([]);
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      const { data: zonesData, error: zonesError } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('name');

      if (zonesError) {
        console.error('Erro ao carregar delivery_zones:', zonesError);
        setDeliveryZones([]);
        return;
      }

      const deliveryAreas: DeliveryZone[] = (zonesData || []).map(zone => ({
        id: zone.id,
        name: zone.name,
        delivery_fee: zone.delivery_fee,
        minimum_order: zone.minimum_order || 0
      }));
      
      setDeliveryZones(deliveryAreas);
    } catch (error) {
      console.error('Erro ao carregar bairros de entrega:', error);
      setDeliveryZones([]);
    }
  };

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'available')
        .order('table_number');

      if (error) {
        console.error('Erro ao carregar mesas:', error);
        throw error;
      }
      
      setTables(data || []);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
      setTables([]);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
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

  const getChangeValue = () => {
    if (paymentMethod === 'dinheiro' && changeAmount) {
      return parseFloat(changeAmount) - getFinalTotal();
    }
    return 0;
  };

  const generateOrderNumber = () => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar a venda.",
        variant: "destructive",
      });
      return;
    }

    // Para pedidos no local, nome não é obrigatório
    if (orderType !== 'dine_in' && !customerName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome do cliente.",
        variant: "destructive",
      });
      return;
    }

    if (orderType === 'delivery') {
      if (!customerAddress.trim()) {
        toast({
          title: "Endereço obrigatório",
          description: "Por favor, informe o endereço para entrega.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedDeliveryZone) {
        toast({
          title: "Bairro obrigatório",
          description: "Por favor, selecione o bairro para entrega.",
          variant: "destructive",
        });
        return;
      }
    }

    if (orderType === 'dine_in' && !selectedTable) {
      toast({
        title: "Mesa obrigatória",
        description: "Por favor, selecione uma mesa.",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === 'dinheiro' && changeAmount && parseFloat(changeAmount) < getFinalTotal()) {
      toast({
        title: "Valor insuficiente",
        description: "O valor recebido é menor que o total do pedido.",
        variant: "destructive",
      });
      return;
    }

    // Verificar valor mínimo para entrega
    if (orderType === 'delivery' && selectedDeliveryZone) {
      const zone = deliveryZones.find(z => z.id === selectedDeliveryZone);
      if (zone && getTotalValue() < zone.minimum_order) {
        toast({
          title: "Valor mínimo não atingido",
          description: `O valor mínimo para entrega neste bairro é ${formatCurrency(zone.minimum_order)}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setProcessing(true);

      const orderNumber = generateOrderNumber();
      
      // Preparar itens do pedido
      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity
      }));

      const orderData = {
        customer_name: orderType === 'dine_in' ? (customerName.trim() || `Mesa ${selectedTable}`) : customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_address: orderType === 'delivery' ? customerAddress.trim() : null,
        order_type: orderType,
        delivery_zone_id: orderType === 'delivery' ? selectedDeliveryZone || null : null,
        table_id: orderType === 'dine_in' ? selectedTable || null : null,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: getDeliveryFee(),
        payment_method: paymentMethod,
        change_amount: paymentMethod === 'dinheiro' && changeAmount ? parseFloat(changeAmount) : null,
        status: 'pending',
        order_number: orderNumber,
        user_id: user?.id,
        estimated_time: '30-45 min'
      };

      console.log('Criando pedido:', orderData);

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select();

      if (error) {
        console.error('Erro ao criar pedido:', error);
        throw error;
      }

      // Atualizar status da mesa se for pedido no local
      if (orderType === 'dine_in' && selectedTable) {
        try {
          await supabase
            .from('tables')
            .update({ status: 'occupied' })
            .eq('id', selectedTable);
        } catch (error) {
          console.warn('Não foi possível atualizar status da mesa:', error);
        }
      }

      console.log('Pedido criado com sucesso:', data);

      toast({
        title: "Venda finalizada!",
        description: `Pedido #${orderNumber} finalizado com sucesso. Total: ${formatCurrency(getFinalTotal())}.`,
      });

      // Limpar dados
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedDeliveryZone('');
      setSelectedTable('');
      setChangeAmount('');
      setPaymentMethod('pix');
      setOrderType('delivery');
    } catch (error: any) {
      console.error('Erro ao finalizar venda:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível finalizar a venda.",
        variant: "destructive"
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Produtos */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Selecione os produtos para adicionar ao pedido</CardDescription>
            
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                    <div className="aspect-square relative overflow-hidden rounded-t-lg">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">Sem imagem</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                      <p className="text-lg font-bold text-primary mb-2">
                        {formatCurrency(product.price)}
                        {product.weight_based && <span className="text-xs text-gray-500 ml-1">/kg</span>}
                      </p>
                      <Button 
                        onClick={() => addToCart(product)}
                        className="w-full"
                        size="sm"
                      >
                        <Plus size={16} className="mr-1" />
                        Adicionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Carrinho e Checkout */}
      <div className="space-y-4">
        {/* Tipo de Pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={orderType} onValueChange={(value) => setOrderType(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="delivery" className="flex items-center gap-1">
                  <Truck size={16} />
                  Entrega
                </TabsTrigger>
                <TabsTrigger value="pickup" className="flex items-center gap-1">
                  <Store size={16} />
                  Retirada
                </TabsTrigger>
                <TabsTrigger value="dine_in" className="flex items-center gap-1">
                  <UtensilsCrossed size={16} />
                  No Local
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator size={20} />
              Carrinho
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Carrinho vazio
              </p>
            ) : (
              <>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
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
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(getTotalValue())}</span>
                  </div>
                  
                  {orderType === 'delivery' && getDeliveryFee() > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Taxa de entrega:</span>
                      <span>{formatCurrency(getDeliveryFee())}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(getFinalTotal())}</span>
                  </div>
                  
                  {paymentMethod === 'dinheiro' && changeAmount && (
                    <div className="flex justify-between text-sm">
                      <span>Troco:</span>
                      <span className={getChangeValue() >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(getChangeValue())}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Dados do Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder={orderType === 'dine_in' ? "Nome do cliente (opcional)" : "Nome do cliente *"}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required={orderType !== 'dine_in'}
            />
            <Input
              placeholder="Telefone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            
            {orderType === 'delivery' && (
              <>
                <Textarea
                  placeholder="Endereço para entrega *"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  rows={2}
                  required
                />
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bairro de Entrega *</label>
                  <Select value={selectedDeliveryZone} onValueChange={setSelectedDeliveryZone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o bairro" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliveryZones.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">
                          Nenhum bairro cadastrado
                        </div>
                      ) : (
                        deliveryZones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            <div className="flex flex-col w-full">
                              <div className="flex justify-between items-center w-full">
                                <span>{zone.name}</span>
                                <span className="ml-2 text-sm text-green-600 font-medium">
                                  {formatCurrency(zone.delivery_fee)}
                                </span>
                              </div>
                              {zone.minimum_order > 0 && (
                                <div className="text-xs text-gray-500 text-left">
                                  Mínimo: {formatCurrency(zone.minimum_order)}
                                </div>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  
                  {deliveryZones.length === 0 && (
                    <p className="text-xs text-red-500">
                      Configure os bairros de entrega na seção "Configurações" → "Delivery"
                    </p>
                  )}
                </div>
              </>
            )}
            
            {orderType === 'dine_in' && (
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a mesa" />
                </SelectTrigger>
                <SelectContent>
                  {tables.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">
                      Nenhuma mesa disponível
                    </div>
                  ) : (
                    tables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Mesa {table.table_number}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Button
                variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('pix')}
                className="justify-start"
              >
                PIX
              </Button>
              <Button
                variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('cartao')}
                className="justify-start"
              >
                Cartão
              </Button>
              <Button
                variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('dinheiro')}
                className="justify-start"
              >
                Dinheiro
              </Button>
            </div>
            
            {paymentMethod === 'dinheiro' && (
              <Input
                placeholder="Valor recebido"
                value={changeAmount}
                onChange={(e) => setChangeAmount(e.target.value)}
                type="number"
                step="0.01"
                min={getFinalTotal()}
              />
            )}
          </CardContent>
        </Card>

        <Button 
          onClick={handleFinalizeSale}
          className="w-full"
          size="lg"
          disabled={cart.length === 0 || processing}
        >
          {processing ? 'Finalizando...' : 'Finalizar Venda'}
        </Button>
      </div>
    </div>
  );
};

export default PDV;
