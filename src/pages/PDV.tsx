
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Trash2, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Sample products - em produção viria do banco de dados
const products = [
  {
    id: '1',
    name: 'X-Burger Especial',
    price: 29.90,
    image: 'https://via.placeholder.com/150',
    available: true,
  },
  {
    id: '2',
    name: 'Pizza Margherita',
    price: 45.90,
    image: 'https://via.placeholder.com/150',
    available: true,
  },
  {
    id: '3',
    name: 'Refrigerante Cola 2L',
    price: 12.90,
    image: 'https://via.placeholder.com/150',
    available: true,
  },
  {
    id: '4',
    name: 'Sorvete de Chocolate',
    price: 15.90,
    image: 'https://via.placeholder.com/150',
    available: true,
  }
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const PDV = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [changeAmount, setChangeAmount] = useState('');
  const { toast } = useToast();

  const addToCart = (product: typeof products[0]) => {
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

  const handleFinalizeSale = () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar a venda.",
        variant: "destructive",
      });
      return;
    }

    // Aqui integraria com o banco de dados para salvar o pedido
    console.log('Pedido finalizado:', {
      items: cart,
      customer: { name: customerName, phone: customerPhone },
      paymentMethod,
      changeAmount: paymentMethod === 'dinheiro' ? changeAmount : null,
      total: getTotalValue()
    });

    toast({
      title: "Venda finalizada!",
      description: `Pedido de R$ ${getTotalValue().toFixed(2)} finalizado com sucesso.`,
    });

    // Limpar carrinho e dados
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setChangeAmount('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Produtos */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Selecione os produtos para adicionar ao pedido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <Card key={product.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <div className="aspect-square relative overflow-hidden rounded-t-lg">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm mb-1">{product.name}</h3>
                    <p className="text-lg font-bold text-boracume-orange mb-2">
                      R$ {product.price.toFixed(2)}
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
          </CardContent>
        </Card>
      </div>

      {/* Carrinho e Checkout */}
      <div className="space-y-4">
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
                          R$ {item.price.toFixed(2)} cada
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
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>R$ {getTotalValue().toFixed(2)}</span>
                  </div>
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
              placeholder="Nome do cliente"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              placeholder="Telefone (opcional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('dinheiro')}
              >
                Dinheiro
              </Button>
              <Button
                variant={paymentMethod === 'cartao' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('cartao')}
              >
                Cartão
              </Button>
              <Button
                variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('pix')}
              >
                PIX
              </Button>
              <Button
                variant={paymentMethod === 'prazo' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('prazo')}
              >
                A Prazo
              </Button>
            </div>
            
            {paymentMethod === 'dinheiro' && (
              <Input
                placeholder="Valor recebido"
                value={changeAmount}
                onChange={(e) => setChangeAmount(e.target.value)}
                type="number"
                step="0.01"
              />
            )}
            
            {paymentMethod === 'dinheiro' && changeAmount && (
              <div className="p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-sm">
                  <strong>Troco: R$ {(parseFloat(changeAmount) - getTotalValue()).toFixed(2)}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button 
          onClick={handleFinalizeSale}
          className="w-full"
          size="lg"
          disabled={cart.length === 0}
        >
          Finalizar Venda
        </Button>
      </div>
    </div>
  );
};

export default PDV;
