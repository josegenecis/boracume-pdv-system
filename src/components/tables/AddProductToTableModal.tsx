import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, PackagePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import ProductSelectionModal from '@/components/pdv/ProductSelectionModal';
import { notifyOrderCreatedById } from '@/utils/orderNotifications';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  category: string;
  description?: string;
  weight_based?: boolean;
  send_to_kds?: boolean;
}

interface CartItem extends Product {
  quantity: number;
  options?: string[];
  variations?: string[];
  notes?: string;
}

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  location?: string;
}

interface AddProductToTableModalProps {
  table: Table | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddProductToTableModal: React.FC<AddProductToTableModalProps> = ({
  table,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { sendToKitchen } = useKitchenIntegration();

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setCartItems([]);
      setCustomerName('');
      setCustomerPhone('');
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .eq('available', true)
        .eq('available_pdv', true)
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

  const unpackSelectedVariations = (value: any) => {
    if (!value) return { options: [] as string[], variationLines: [] as string[] };
    if (Array.isArray(value)) return { options: value.map((v) => String(v || '').trim()).filter(Boolean), variationLines: [] as string[] };
    const options = Array.isArray(value.options) ? value.options.map((v: any) => String(v || '').trim()).filter(Boolean) : [];
    const variationLines = Array.isArray(value.variationLines) ? value.variationLines.map((v: any) => String(v || '').trim()).filter(Boolean) : [];
    return { options, variationLines };
  };

  const addToCart = (product: Product, quantity: number = 1, selected: any = [], notes: string = '', variationPrice: number = 0) => {
    const { options, variationLines } = unpackSelectedVariations(selected);
    setCartItems(prev => {
      const existing = prev.find(item => 
        item.id === product.id && 
        JSON.stringify(item.options) === JSON.stringify(options) &&
        item.notes === notes
      );
      
      if (existing) {
        return prev.map(item =>
          item === existing
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      
      return [...prev, {
        ...product,
        price: Math.max(0, Number(product.price || 0) + Number(variationPrice || 0)),
        quantity, 
        options: options.length > 0 ? options : undefined,
        variations: variationLines.length > 0 ? variationLines : undefined,
        notes: notes || undefined
      }];
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== productId));
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getTotalValue = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const generateOrderNumber = () => {
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNumber = Math.floor(Math.random() * 1000);
    return `${formattedDate}-${randomNumber.toString().padStart(3, '0')}`;
  };

  const handleAddToTable = async () => {
    if (!table || !user || cartItems.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione produtos antes de adicionar à mesa.",
        variant: "destructive"
      });
      return;
    }

    /*
    try {
        toast({
          title: 'Caixa fechado',
          description: 'Abra o caixa antes de lanÃ§ar itens em mesas.',
          variant: 'destructive'
        });
        return;
      }
    } catch (error) {
      console.error('Erro ao validar caixa para mesas:', error);
      toast({
        title: 'Erro no caixa',
        description: 'NÃ£o foi possÃ­vel validar a abertura do caixa.',
        variant: 'destructive'
      });
      return;
    }

    */

    try {
      setLoading(true);

      const { data: existingOrders, error: checkError } = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', table.id)
        .eq('user_id', user.id)
        .in('status', ['pending', 'preparing', 'ready'])
        .limit(1);

      if (checkError) throw checkError;

      const orderItems = cartItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options: item.options || [],
        variations: item.variations || [],
        notes: item.notes || ''
      }));

      if (existingOrders && existingOrders.length > 0) {
        const existingOrder = existingOrders[0];
        
        let currentItems = [];
        try {
          if (typeof existingOrder.items === 'string') {
            currentItems = JSON.parse(existingOrder.items);
          } else if (Array.isArray(existingOrder.items)) {
            currentItems = existingOrder.items;
          }
        } catch (e) {
          console.error('Error parsing existing items:', e);
          currentItems = [];
        }
        
        const updatedItems = [...currentItems, ...orderItems];
        const newTotal = existingOrder.total + getTotalValue();

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            items: updatedItems,
            total: newTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOrder.id);

        if (updateError) throw updateError;

        const itemsForKitchen = orderItems.filter(item => {
          const product = products.find(p => p.id === item.product_id);
          return product?.send_to_kds === true;
        });

        if (itemsForKitchen.length > 0) {
          await sendToKitchen({
            user_id: user.id,
            order_number: existingOrder.order_number,

            customer_name: existingOrder.customer_name || 'Cliente não informado',

            customer_phone: existingOrder.customer_phone || '',
            items: itemsForKitchen,
            total: getTotalValue(),
            payment_method: existingOrder.payment_method || 'pendente',
            order_type: 'dine_in'
          });
        }

        toast({
          title: "Produtos adicionados!",
          description: `Produtos adicionados ao pedido da Mesa ${table.table_number}.`,
        });
      } else {
        const orderNumber = generateOrderNumber();
        
        const orderData = {
          user_id: user.id,
          order_number: orderNumber,
          customer_name: customerName.trim() || `Mesa ${table.table_number}`,
          customer_phone: customerPhone.trim() || null,
          table_id: table.id,
          items: orderItems,
          total: getTotalValue(),
          order_type: 'dine_in',
          status: 'pending',
          payment_method: 'pendente',
          estimated_time: '15-20 min'
        };

        const { data: createdOrder, error: createError } = await supabase
          .from('orders')
          .insert([orderData])
          .select('id')
          .single();

        if (createError) throw createError;

        try {
          await notifyOrderCreatedById(createdOrder?.id);
        } catch (waErr) {
          console.warn('Falha ao notificar pedido da mesa via WhatsApp:', waErr);
        }

        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', table.id);

        const itemsForKitchen = orderItems.filter(item => {
          const product = products.find(p => p.id === item.product_id);
          return product?.send_to_kds === true;
        });

        if (itemsForKitchen.length > 0) {
          await sendToKitchen({
            user_id: user.id,
            order_number: orderNumber,

            customer_name: customerName.trim() || `Mesa ${table.table_number}`,

            customer_phone: customerPhone || '',
            items: itemsForKitchen,
            total: getTotalValue(),
            payment_method: 'pendente',
            order_type: 'dine_in'
          });
        }

        toast({
          title: "Pedido criado!",
          description: `Pedido #${orderNumber} criado para a Mesa ${table.table_number}.`,
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao adicionar produtos à mesa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar os produtos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!table) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Adicionar Produtos - Mesa {table.table_number}
              {table.location && ` (${table.location})`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-6">
            <div className="space-y-4">
              <Button 
                onClick={() => setShowProductModal(true)}
                className="h-14 w-full text-base"
              >
                <PackagePlus size={18} className="mr-2" />
                ADD PRODUTO
              </Button>

              <Card>
                <CardContent className="p-4">
                  <details className="group">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700">
                      Cliente opcional
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <Label htmlFor="customerName">Nome</Label>
                        <Input
                          id="customerName"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder={`Mesa ${table.table_number}`}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customerPhone">Telefone</Label>
                        <Input
                          id="customerPhone"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                    </div>
                  </details>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Itens Selecionados</h3>
                  
                  {cartItems.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Nenhum item selecionado
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-40 overflow-y-auto">
                      {cartItems.map((item, index) => (
                        <div key={`${item.id}-${index}`} className="border-b pb-3 last:border-b-0">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.name}</p>
                              {item.options && item.options.length > 0 && (
                                <div className="ml-2 text-xs text-gray-600">
                                  {item.options.map((option, optIndex) => (
                                    <div key={optIndex}>• {option}</div>
                                  ))}
                                </div>
                              )}
                              {item.notes && (
                                <p className="text-xs text-gray-600 italic ml-2">
                                  Obs: {item.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus size={12} />
                              </Button>
                              <span className="w-8 text-center text-sm">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus size={12} />
                              </Button>
                            </div>
                          </div>
                          <div className="text-right text-sm font-medium mt-1">
                            {formatCurrency(item.price * item.quantity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {cartItems.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(getTotalValue())}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddToTable}
                  disabled={loading || cartItems.length === 0}
                  className="flex-1"
                >
                  {loading ? 'Adicionando...' : 'Adicionar à Mesa'}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProductSelectionModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onAddToCart={addToCart}
      />
    </>
  );
};

export default AddProductToTableModal;
