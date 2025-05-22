
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Interface for product with weight option
interface Product {
  id: string;
  name: string;
  price: number;
  weight_based: boolean;
}

// Create schema for form validation
const orderSchema = z.object({
  customerName: z.string().min(3, { message: 'Nome deve ter pelo menos 3 caracteres' }),
  customerPhone: z.string().min(8, { message: 'Telefone inválido' }),
  customerAddress: z.string().min(5, { message: 'Endereço deve ter pelo menos 5 caracteres' }),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao']),
  changeAmount: z.number().optional(),
  productId: z.string().min(1, { message: 'Selecione um produto' }),
  quantity: z.number().min(0.1, { message: 'Quantidade deve ser maior que 0' }),
});

const PDVForm = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Initialize form
  const form = useForm<z.infer<typeof orderSchema>>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      paymentMethod: 'pix',
      productId: '',
      quantity: 1,
    },
  });
  
  // Fetch products from Supabase
  useEffect(() => {
    const fetchProducts = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('products')
          .select('id, name, price, weight_based')
          .eq('user_id', user.id)
          .eq('available', true);
        
        if (error) throw error;
        
        setProducts(data || []);
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar produtos',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
  }, [user, toast]);
  
  // Watch for changes in form values
  const paymentMethod = form.watch('paymentMethod');
  const productId = form.watch('productId');
  const quantity = form.watch('quantity');
  
  // Update selected product when product ID changes
  useEffect(() => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product || null);
  }, [productId, products]);
  
  // Calculate total amount when product or quantity changes
  useEffect(() => {
    if (selectedProduct) {
      setTotalAmount(selectedProduct.price * (quantity || 0));
    } else {
      setTotalAmount(0);
    }
  }, [selectedProduct, quantity]);
  
  // Handle scale connection for weight-based products
  const handleConnectScale = async () => {
    // In a real app, this would connect to a hardware scale via Web Serial API
    toast({
      title: 'Conectando balança...',
      description: 'Simulando conexão com balança de pesagem',
    });
    
    // Simulate getting weight from scale
    setTimeout(() => {
      const simulatedWeight = (Math.random() * 2 + 0.1).toFixed(3);
      form.setValue('quantity', parseFloat(simulatedWeight));
      toast({
        title: 'Balança conectada',
        description: `Peso registrado: ${simulatedWeight}kg`,
      });
    }, 1500);
  };
  
  // Handle form submission
  const onSubmit = async (data: z.infer<typeof orderSchema>) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Create order items
      const orderItem = {
        product_id: data.productId,
        product_name: selectedProduct?.name || '',
        price: selectedProduct?.price || 0,
        quantity: data.quantity,
        subtotal: totalAmount
      };
      
      // Create order in Supabase
      const { error } = await supabase.from('orders').insert({
        user_id: user.id,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        customer_address: data.customerAddress,
        payment_method: data.paymentMethod,
        change_amount: data.paymentMethod === 'dinheiro' ? data.changeAmount : null,
        items: [orderItem],
        total: totalAmount,
        status: 'pending'
      });
      
      if (error) throw error;
      
      toast({
        title: 'Pedido criado com sucesso',
        description: 'O pedido foi enviado para cozinha',
      });
      
      // Reset form
      form.reset();
      setSelectedProduct(null);
      setTotalAmount(0);
    } catch (error: any) {
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
          <CardContent className="space-y-4">
            {/* Customer Information */}
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
              <FormField
                control={form.control}
                name="customerAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endereço de Entrega</FormLabel>
                    <FormControl>
                      <Input placeholder="Rua, número, bairro, cidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Order Information */}
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
                        defaultValue={field.value}
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
                              Conectar Balança
                            </Button>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex items-end">
                    <div className="w-full">
                      <div className="font-medium text-sm mb-2">Total</div>
                      <div className="text-2xl font-bold">
                        R$ {totalAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Payment Method */}
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
                        defaultValue={field.value}
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
              
              {/* Change amount field for cash payments */}
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
