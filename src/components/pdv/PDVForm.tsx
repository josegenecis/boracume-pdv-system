import React, { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  price: number;
  weight_based: boolean;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
}

interface Table {
  id: string;
  table_number: number;
  status: string;
}

const orderSchema = z.object({
  orderType: z.enum(['delivery', 'table']),
  customerName: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  customerPhone: z.string().min(8, { message: 'Telefone inválido' }),
  customerAddress: z.string().optional(),
  deliveryZoneId: z.string().optional(),
  tableId: z.string().optional(),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao']),
  changeAmount: z.number().optional(),
  productId: z.string().min(1, { message: 'Selecione um produto' }),
  quantity: z.number().min(0.1, { message: 'Quantidade deve ser maior que 0' }),
});

const PDVForm = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedDeliveryZone, setSelectedDeliveryZone] = useState<DeliveryZone | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const form = useForm<z.infer<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      orderType: 'delivery',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      paymentMethod: 'pix',
      productId: '',
      quantity: 1,
    },
  });
  
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        fetchProducts(),
        fetchDeliveryZones(),
        fetchTables()
      ]);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, weight_based')
      .eq('user_id', user?.id)
      .eq('available', true);
    
    if (error) throw error;
    setProducts(data || []);
  };

  const fetchDeliveryZones = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('delivery_zones')
        .select('*')
        .eq('user_id', user?.id);
      
      if (error) throw error;
      setDeliveryZones(data || []);
    } catch (error) {
      console.warn('Delivery zones table not ready yet:', error);
      setDeliveryZones([]);
    }
  };

  const fetchTables = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('tables')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'available');
      
      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.warn('Tables table not ready yet:', error);
      setTables([]);
    }
  };
  
  const orderType = form.watch('orderType');
  const productId = form.watch('productId');
  const quantity = form.watch('quantity');
  const deliveryZoneId = form.watch('deliveryZoneId');
  const paymentMethod = form.watch('paymentMethod');
  
  useEffect(() => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product || null);
  }, [productId, products]);

  useEffect(() => {
    const zone = deliveryZones.find(z => z.id === deliveryZoneId);
    setSelectedDeliveryZone(zone || null);
    setDeliveryFee(zone?.delivery_fee || 0);
  }, [deliveryZoneId, deliveryZones]);
  
  useEffect(() => {
    const productTotal = selectedProduct ? selectedProduct.price * (quantity || 0) : 0;
    const deliveryTotal = orderType === 'delivery' ? deliveryFee : 0;
    setTotalAmount(productTotal + deliveryTotal);
  }, [selectedProduct, quantity, deliveryFee, orderType]);
  
  const handleConnectScale = async () => {
    toast({
      title: 'Conectando balança...',
      description: 'Simulando conexão com balança de pesagem',
    });
    
    setTimeout(() => {
      const simulatedWeight = (Math.random() * 2 + 0.1).toFixed(3);
      form.setValue('quantity', parseFloat(simulatedWeight));
      toast({
        title: 'Balança conectada',
        description: `Peso registrado: ${simulatedWeight}kg`,
      });
    }, 1500);
  };
  
  const generateOrderNumber = () => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  const onSubmit = async (data: z.infer<typeof orderSchema>) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const orderItem = {
        product_id: data.productId,
        product_name: selectedProduct?.name || '',
        price: selectedProduct?.price || 0,
        quantity: data.quantity,
        subtotal: (selectedProduct?.price || 0) * data.quantity
      };

      const orderData = {
        user_id: user.id,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        customer_address: data.orderType === 'delivery' ? data.customerAddress : null,
        payment_method: data.paymentMethod,
        change_amount: data.paymentMethod === 'dinheiro' ? data.changeAmount : null,
        items: [orderItem],
        total: totalAmount,
        delivery_fee: orderType === 'delivery' ? deliveryFee : 0,
        delivery_zone_id: data.orderType === 'delivery' ? data.deliveryZoneId : null,
        table_id: data.orderType === 'table' ? data.tableId : null,
        status: 'pending', // Mudei de 'new' para 'pending'
        order_number: generateOrderNumber()
      };
      
      const { error: orderError } = await supabase
        .from('orders')
        .insert(orderData);
      
      if (orderError) throw orderError;

      // Se for mesa, atualizar status da mesa
      if (data.orderType === 'table' && data.tableId) {
        try {
          await (supabase as any)
            .from('tables')
            .update({ status: 'occupied' })
            .eq('id', data.tableId);
        } catch (error) {
          console.warn('Could not update table status:', error);
        }
      }
      
      toast({
        title: 'Pedido criado com sucesso',
        description: `Pedido #${orderData.order_number} foi registrado`,
      });
      
      form.reset();
      setSelectedProduct(null);
      setSelectedDeliveryZone(null);
      setTotalAmount(0);
      setDeliveryFee(0);
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast({
        title: 'Erro ao criar pedido',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Novo Pedido</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* Tipo de Pedido */}
            <FormField
              control={form.control}
              name="orderType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pedido</FormLabel>
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="delivery">Entrega</TabsTrigger>
                      <TabsTrigger value="table">Mesa</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormItem>
              )}
            />

            {/* Informações do Cliente */}
            <div className="space-y-4">
              <h3 className="font-medium">Informações do Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Campos específicos por tipo */}
              {orderType === 'delivery' && (
                <>
                  <FormField
                    control={form.control}
                    name="customerAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endereço de Entrega</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, número, bairro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {deliveryZones.length > 0 && (
                    <FormField
                      control={form.control}
                      name="deliveryZoneId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o bairro" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {deliveryZones.map((zone) => (
                                <SelectItem key={zone.id} value={zone.id}>
                                  {zone.name} - R$ {zone.delivery_fee.toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {orderType === 'table' && tables.length > 0 && (
                <FormField
                  control={form.control}
                  name="tableId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mesa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma mesa" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tables.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              Mesa {table.table_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {/* Detalhes do Pedido */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Detalhes do Pedido</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produto</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um produto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - R$ {product.price.toFixed(2)}
                              {product.weight_based ? ' (Peso)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {selectedProduct?.weight_based ? 'Peso (kg)' : 'Quantidade'}
                        </FormLabel>
                        <div className="flex space-x-2">
                          <FormControl>
                            <Input
                              type="number"
                              step={selectedProduct?.weight_based ? 0.001 : 1}
                              min={0.001}
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          {selectedProduct?.weight_based && (
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={handleConnectScale}
                              disabled={isLoading}
                            >
                              Balança
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-2">
                    <div className="font-medium text-sm">Resumo</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>R$ {(totalAmount - deliveryFee).toFixed(2)}</span>
                      </div>
                      {orderType === 'delivery' && deliveryFee > 0 && (
                        <div className="flex justify-between">
                          <span>Taxa de entrega:</span>
                          <span>R$ {deliveryFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>R$ {totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Forma de Pagamento */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium">Forma de Pagamento</h3>
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex space-x-4"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="pix" />
                          </FormControl>
                          <FormLabel className="font-normal">PIX</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="cartao" />
                          </FormControl>
                          <FormLabel className="font-normal">Cartão</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="dinheiro" />
                          </FormControl>
                          <FormLabel className="font-normal">Dinheiro</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {paymentMethod === 'dinheiro' && (
                <FormField
                  control={form.control}
                  name="changeAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Troco para quanto?</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={0.01}
                          min={totalAmount}
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      {field.value && field.value > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Troco: R$ {(field.value - totalAmount).toFixed(2)}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Processando...' : 'Finalizar Pedido'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
};

export default PDVForm;
