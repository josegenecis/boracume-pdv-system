import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  category: string;
  description?: string;
  weight_based?: boolean;
}

interface CartItem extends Product {
  quantity: number;
  options?: string[];
  notes?: string;
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
  capacity: number;
  status: string;
  location?: string;
}

interface CustomerData {
  name: string;
  phone: string;
  address: string;
  deliveryZoneId: string;
  tableId: string;
}

const PDVForm = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [changeAmount, setChangeAmount] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<'dine_in' | 'delivery' | 'takeaway'>('dine_in');
  const [customerData, setCustomerData] = useState<CustomerData>({
    name: '',
    phone: '',
    address: '',
    deliveryZoneId: '',
    tableId: ''
  });
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
	const [searchParams] = useSearchParams();
  const { sendToKitchen } = useKitchenIntegration();

  useEffect(() => {
    fetchProducts();
    fetchDeliveryZones();
    fetchTables();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .eq('available', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar produtos.",
        variant: "destructive"
      });
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('Erro ao carregar zonas de entrega:', error);
    }
  };

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .order('table_number');

      if (error) throw error;
      // Map database fields to interface
      const mappedTables = data?.map(table => ({
        id: table.id,
        table_number: table.table_number,
        capacity: table.capacity,
        status: table.status,
        location: table.location
      })) || [];
      setTables(mappedTables);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    setCartItems(prev => {
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
  };

  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, ...updates } : item
      )
    );
  };

  const getTotalValue = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getDeliveryFee = () => {
    const selectedZone = deliveryZones.find(zone => zone.id === customerData.deliveryZoneId);
    return selectedZone ? selectedZone.delivery_fee : 0;
  };

  const getFinalTotal = () => {
    return getTotalValue() + (orderType === 'delivery' ? getDeliveryFee() : 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const formattedDate = format(now, 'yyMMdd', { locale: ptBR });
    const randomNumber = Math.floor(Math.random() * 1000);
    return `${formattedDate}-${randomNumber.toString().padStart(3, '0')}`;
  };

  const resetForm = () => {
    setCartItems([]);
    setSearchTerm('');
    setPaymentMethod('dinheiro');
    setChangeAmount(null);
    setCustomerData({
      name: '',
      phone: '',
      address: '',
      deliveryZoneId: '',
      tableId: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cartItems.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos antes de finalizar o pedido.",
        variant: "destructive",
      });
      return;
    }

    // Validação dos dados do cliente apenas para delivery
    if (orderType === 'delivery') {
      if (!customerData.name || !customerData.phone || !customerData.address) {
        toast({
          title: "Dados obrigatórios",
          description: "Para delivery, preencha nome, telefone e endereço.",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const orderNumber = generateOrderNumber();
      
      const orderItems = cartItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options: item.options || [],
        notes: item.notes || ''
      }));

      const orderData = {
        user_id: user?.id,
        order_number: orderNumber,
        customer_name: orderType === 'dine_in' ? 'Cliente Local' : customerData.name,
        customer_phone: orderType === 'dine_in' ? null : customerData.phone,
        customer_address: orderType === 'dine_in' ? null : customerData.address,
        delivery_zone_id: orderType === 'delivery' ? customerData.deliveryZoneId : null,
        table_id: orderType === 'dine_in' ? customerData.tableId : null,
        items: orderItems,
        total: getFinalTotal(),
        delivery_fee: orderType === 'delivery' ? getDeliveryFee() : 0,
        payment_method: paymentMethod,
        change_amount: paymentMethod === 'dinheiro' ? changeAmount : null,
        status: 'pending',
        order_type: orderType,
        estimated_time: orderType === 'delivery' ? '30-45 min' : '15-20 min'
      };

      // Salvar pedido
      const { data: order, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;

      // Enviar para a cozinha
      await sendToKitchen({
        ...orderData,
        order_number: orderNumber,
        items: orderItems
      });

      toast({
        title: "Pedido criado com sucesso!",
        description: `Pedido #${orderNumber} foi registrado e enviado para a cozinha.`,
      });

      resetForm();
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: "Erro ao criar pedido",
        description: error.message || "Não foi possível processar o pedido.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateChange = (amountPaid: number) => {
    const total = getFinalTotal();
    const change = amountPaid - total;
    setChangeAmount(change > 0 ? change : null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Product List */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col items-center justify-center">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-24 h-24 object-cover rounded-md mb-2"
                  />
                )}
                <div className="text-center">
                  <p className="font-medium text-sm">{product.name}</p>
                  <p className="text-gray-500 text-xs">{formatCurrency(product.price)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => addToCart(product)}
                >
                  Adicionar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Order Summary and Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cartItems.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                Nenhum item no carrinho.
              </p>
            ) : (
              <div className="space-y-3">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus size={16} />
                      </Button>
                      <span className="w-6 text-center">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus size={16} />
                      </Button>
                      <span className="ml-2">{item.name}</span>
                    </div>
                    <div className="flex items-center">
                      <span>{formatCurrency(item.price * item.quantity)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.id)}
                        className="ml-2"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(getTotalValue())}</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between">
                    <span>Taxa de entrega:</span>
                    <span>{formatCurrency(getDeliveryFee())}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(getFinalTotal())}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Type */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                defaultValue={orderType}
                onValueChange={value => setOrderType(value as 'dine_in' | 'delivery' | 'takeaway')}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dine_in" id="dine_in" />
                  <Label htmlFor="dine_in">Comer no Local</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivery" id="delivery" />
                  <Label htmlFor="delivery">Delivery</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="takeaway" id="takeaway" />
                  <Label htmlFor="takeaway">Retirar no Local</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Customer Data - Only required for delivery */}
          {orderType !== 'dine_in' && (
            <Card>
              <CardHeader>
                <CardTitle>Dados do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    type="text"
                    value={customerData.name}
                    onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                    required={orderType === 'delivery'}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    required={orderType === 'delivery'}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    type="text"
                    value={customerData.address}
                    onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                    required={orderType === 'delivery'}
                  />
                </div>
                {orderType === 'delivery' && (
                  <div>
                    <Label htmlFor="deliveryZone">Zona de Entrega</Label>
                    <Select
                      value={customerData.deliveryZoneId}
                      onValueChange={(value) => setCustomerData({ ...customerData, deliveryZoneId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a zona" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryZones.map(zone => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name} ({formatCurrency(zone.delivery_fee)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Table Selection - Only for Dine-In */}
          {orderType === 'dine_in' && (
            <Card>
              <CardHeader>
                <CardTitle>Mesa</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={customerData.tableId}
                  onValueChange={(value) => setCustomerData({ ...customerData, tableId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a mesa" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map(table => (
                      <SelectItem key={table.id} value={table.id}>
                        Mesa {table.table_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Payment Options */}
          <Card>
            <CardHeader>
              <CardTitle>Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                defaultValue={paymentMethod}
                onValueChange={setPaymentMethod}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dinheiro" id="dinheiro" />
                  <Label htmlFor="dinheiro">Dinheiro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cartao" id="cartao" />
                  <Label htmlFor="cartao">Cartão</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pix" id="pix" />
                  <Label htmlFor="pix">PIX</Label>
                </div>
              </RadioGroup>

              {paymentMethod === 'dinheiro' && (
                <div>
                  <Label htmlFor="amountPaid">Valor Recebido</Label>
                  <Input
                    id="amountPaid"
                    type="number"
                    step="0.01"
                    placeholder="Valor pago pelo cliente"
                    onChange={(e) => calculateChange(parseFloat(e.target.value) || 0)}
                  />
                  {changeAmount !== null && (
                    <div className="mt-2">
                      Troco: {formatCurrency(changeAmount)}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading ? 'Processando...' : 'Finalizar Pedido'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PDVForm;
