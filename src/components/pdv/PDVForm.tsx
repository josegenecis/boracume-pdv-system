
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Minus, Trash2, Calculator, DollarSign, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import ProductSelectionModal from './ProductSelectionModal';

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
  options?: string[];
  notes?: string;
}

interface Table {
  id: string;
  table_number: number;
  status: string;
  capacity: number;
}

const PDVForm: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [changeAmount, setChangeAmount] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const { sendToKitchen } = useKitchenIntegration();

  const addToCart = (product: any, quantity: number = 1, selectedOptions: string[] = [], notes: string = '') => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      updateQuantity(existingItem.id, existingItem.quantity + quantity);
    } else {
      const newItem: CartItem = {
        id: Date.now().toString(),
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity,
        subtotal: product.price * quantity,
        options: selectedOptions.length > 0 ? selectedOptions : undefined,
        notes: notes || undefined
      };
      setCart([...cart, newItem]);
    }
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(cart.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, subtotal: item.price * newQuantity }
        : item
    ));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const getTotalValue = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const generateOrderNumber = () => {
    return `PDV${Date.now()}`;
  };

  const addToTable = async () => {
    if (!selectedTable || cart.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione uma mesa e adicione produtos ao carrinho.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Convert CartItem[] to the format expected by the database
      const orderItems = cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        options: item.options || [],
        notes: item.notes || ''
      }));

      const { data: existingAccount } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('table_id', selectedTable)
        .eq('status', 'open')
        .single();

      if (existingAccount) {
        const updatedItems = [...existingAccount.items as any[], ...orderItems];
        const newTotal = updatedItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);

        const { error } = await supabase
          .from('table_accounts')
          .update({
            items: updatedItems,
            total: newTotal
          })
          .eq('id', existingAccount.id);

        if (error) throw error;
      } else {
        const total = getTotalValue();
        
        const { error } = await supabase
          .from('table_accounts')
          .insert({
            user_id: user?.id,
            table_id: selectedTable,
            items: orderItems,
            total: total,
            status: 'open'
          });

        if (error) throw error;
      }

      toast({
        title: "Sucesso!",
        description: "Produtos adicionados à mesa com sucesso.",
      });

      setCart([]);
      setSelectedTable('');
    } catch (error) {
      console.error('Erro ao adicionar à mesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar os produtos à mesa.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeSale = async () => {
    if (cart.length === 0 || !paymentMethod) {
      toast({
        title: "Erro",
        description: "Adicione produtos ao carrinho e selecione o método de pagamento.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Convert CartItem[] to the format expected by the database
      const orderItems = cart.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        options: item.options || [],
        notes: item.notes || ''
      }));

      const orderData = {
        user_id: user?.id,
        order_number: generateOrderNumber(),
        customer_name: customerName || 'Cliente Balcão',
        customer_phone: customerPhone || null,
        items: orderItems,
        total: getTotalValue(),
        payment_method: paymentMethod,
        change_amount: changeAmount ? parseFloat(changeAmount) : null,
        status: 'completed',
        order_type: 'local',
        table_id: selectedTable || null
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) throw error;

      await sendToKitchen(orderData);

      toast({
        title: "Venda finalizada!",
        description: `Pedido ${orderData.order_number} foi processado com sucesso.`,
      });

      // Reset form
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('');
      setChangeAmount('');
      setOrderNotes('');
      setSelectedTable('');
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar a venda.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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
      setTables(data || []);
    } catch (error) {
      console.error('Erro ao carregar mesas:', error);
    }
  };

  useEffect(() => {
    fetchTables();
  }, [user]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header fixo */}
      <div className="bg-white border-b p-4 flex-shrink-0">
        <h2 className="text-xl font-bold">Ponto de Venda</h2>
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Produtos e Carrinho - Coluna Esquerda */}
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Adicionar Produtos */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign size={20} />
                Produtos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setIsProductModalOpen(true)}
                className="w-full"
              >
                <Plus size={16} className="mr-2" />
                Adicionar Produto
              </Button>
            </CardContent>
          </Card>

          {/* Carrinho */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle>Carrinho ({cart.length} itens)</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              {cart.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-gray-500 text-center">
                    Nenhum produto no carrinho
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product_name}</p>
                          <p className="text-sm text-gray-600">
                            {formatCurrency(item.price)} cada
                          </p>
                          {item.options && item.options.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {item.options.map((option, index) => (
                                <div key={index}>• {option}</div>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-xs text-gray-500 mt-1 italic">
                              Obs: {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                          <span className="w-20 text-right text-sm">{formatCurrency(item.subtotal)}</span>
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
                  
                  <div className="border-t pt-3 flex-shrink-0">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(getTotalValue())}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Informações e Finalização - Coluna Direita */}
        <div className="w-80 flex flex-col p-4 space-y-4 border-l overflow-hidden">
          {/* Informações do Cliente */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users size={20} />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="customerName" className="text-sm">Nome</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="customerPhone" className="text-sm">Telefone</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="table" className="text-sm">Mesa</Label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma mesa" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Mesa {table.table_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle className="text-lg">Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-3">
              <div>
                <Label htmlFor="paymentMethod" className="text-sm">Método</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div>
                  <Label htmlFor="changeAmount" className="text-sm">Valor pago</Label>
                  <Input
                    id="changeAmount"
                    type="number"
                    step="0.01"
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(e.target.value)}
                    placeholder="0,00"
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex-1">
                <Label htmlFor="orderNotes" className="text-sm">Observações</Label>
                <Textarea
                  id="orderNotes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Observações do pedido"
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer fixo com botões de ação */}
      <div className="bg-white border-t p-4 flex-shrink-0">
        <div className="flex gap-2">
          {selectedTable && (
            <Button
              onClick={addToTable}
              disabled={cart.length === 0 || isLoading}
              className="flex-1 bg-blue-900 hover:bg-blue-800"
              size="lg"
            >
              <Users size={16} className="mr-2" />
              Adicionar à Mesa
            </Button>
          )}
          
          <Button
            onClick={finalizeSale}
            disabled={cart.length === 0 || !paymentMethod || isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Calculator size={16} className="mr-2" />
            Finalizar Venda - {formatCurrency(getTotalValue())}
          </Button>
        </div>
      </div>

      <ProductSelectionModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onAddToCart={addToCart}
      />
    </div>
  );
};

export default PDVForm;
