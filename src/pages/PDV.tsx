import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Trash2, Calculator, Search, Store, Truck, UtensilsCrossed } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import ProductVariationModal from '@/components/pdv/ProductVariationModal';
import TableAccountManager from '@/components/pdv/TableAccountManager';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  category_id?: string;
  description?: string;
  weight_based?: boolean;
  send_to_kds?: boolean;
}

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: Array<{name: string; price: number}>;
}

interface CartItem extends Product {
  quantity: number;
  selectedVariations?: any[];
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
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [activeTab, setActiveTab] = useState('products');
  const { toast } = useToast();
  const { user } = useAuth();
  const { sendToKitchen } = useKitchenIntegration();

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
        .eq('show_in_pdv', true)
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

  const fetchProductVariations = async (productId: string): Promise<ProductVariation[]> => {
    try {
      console.log('🔍 PDV - Iniciando carregamento de variações para produto:', productId);
      
      // Buscar variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      if (productError) {
        console.error('❌ PDV - Erro ao carregar variações do produto:', productError);
      } else {
        console.log('📋 PDV - Variações específicas encontradas:', productVariations?.length || 0, productVariations);
      }

      // Buscar variações globais associadas ao produto
      console.log('🔍 PDV - Buscando links de variações globais...');
      const { data: globalVariationLinks, error: globalError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id, required, min_selections, max_selections')
        .eq('product_id', productId);

      if (globalError) {
        console.error('❌ PDV - Erro ao carregar variações globais:', globalError);
      } else {
        console.log('🔗 PDV - Links de variações globais encontrados:', globalVariationLinks?.length || 0, globalVariationLinks);
      }

      // Buscar as variações globais pelos IDs
      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = globalVariationLinks.map(link => link.global_variation_id);
        console.log('🆔 PDV - IDs das variações globais a buscar:', globalVariationIds);
        
        const { data: globalVars, error: globalVarError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        if (globalVarError) {
          console.error('❌ PDV - Erro ao buscar variações globais:', globalVarError);
        } else if (globalVars) {
          console.log('🌐 PDV - Variações globais encontradas:', globalVars.length, globalVars);
          
          // Mesclar configurações do vínculo nas variações globais
          globalVariations = globalVars.map(globalVar => {
            const link = globalVariationLinks.find(l => l.global_variation_id === globalVar.id);
            const mergedVariation = {
              ...globalVar,
              required: link?.required ?? false,
              min_selections: link?.min_selections ?? 0,
              max_selections: link?.max_selections ?? 1
            };
            console.log('🔧 PDV - Variação global mesclada:', mergedVariation);
            return mergedVariation;
          });
        }
      } else {
        console.log('⚠️ PDV - Nenhum link de variação global encontrado para o produto');
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];
      
      console.log('📊 PDV - Total de variações combinadas:', allVariations.length, allVariations);
      
      const formattedVariations: ProductVariation[] = allVariations
        .map(item => {
          try {
            let options: Array<{ name: string; price: number; }> = [];
            if (typeof item.options === 'string') {
              try {
                options = JSON.parse(item.options);
              } catch (e) {
                console.warn('⚠️ PDV - Erro ao parsear options como string:', e, item.options);
                options = [];
              }
            } else if (Array.isArray(item.options)) {
              options = item.options
                .filter((opt: any) => {
                  return opt && 
                         typeof opt === 'object' && 
                         opt.name && 
                         typeof opt.name === 'string' &&
                         opt.price !== undefined && 
                         !isNaN(Number(opt.price));
                })
                .map((opt: any) => ({
                  name: String(opt.name).trim(),
                  price: Number(opt.price)
                }));
            }
            
            const formattedVariation = {
              id: item.id,
              name: item.name || '',
              options,
              max_selections: Math.max(1, Number(item.max_selections) || 1),
              required: Boolean(item.required)
            };
            
            console.log('✅ PDV - Variação formatada:', formattedVariation);
            return formattedVariation;
          } catch (itemError) {
            console.error('❌ PDV - Erro ao processar variação:', itemError, item);
            return null;
          }
        })
        .filter((variation): variation is ProductVariation => variation !== null);
      
      console.log('🎯 PDV - Variações finais formatadas:', formattedVariations.length, formattedVariations);
      return formattedVariations;
    } catch (error) {
      console.error('💥 PDV - Erro geral ao carregar variações:', error);
      return [];
    }
  };

  const handleProductClick = async (product: Product) => {
    console.log('🔄 PDV - Produto clicado:', product.name, 'ID:', product.id);
    
    const variations = await fetchProductVariations(product.id);
    
    console.log('📊 PDV - Resultado final das variações:', {
      produto: product.name,
      totalVariacoes: variations.length,
      variacoes: variations
    });
    
    if (variations.length > 0) {
      console.log('🔄 PDV - Produto tem variações, abrindo modal');
      setSelectedProduct(product);
      setProductVariations(variations);
      setShowVariationModal(true);
    } else {
      console.log('✅ PDV - Produto sem variações, adicionando direto ao carrinho');
      addToCart(product, 1);
    }
  };

  const addToCart = (product: Product, quantity: number = 1, selectedVariations: any[] = [], notes: string = '') => {
    setCart(prev => {
      const variationKey = JSON.stringify(selectedVariations) + notes;
      const existing = prev.find(item => 
        item.id === product.id && 
        JSON.stringify(item.selectedVariations) === JSON.stringify(selectedVariations) &&
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
        quantity, 
        selectedVariations: selectedVariations.length > 0 ? selectedVariations : undefined,
        notes: notes || undefined
      }];
    });

    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  // Helper function to format selected variations for display
  const formatSelectedVariations = (selectedVariations?: any[]) => {
    if (!selectedVariations || selectedVariations.length === 0) return [];
    
    try {
      return selectedVariations.flatMap(variation => {
        // Handle new format from ProductVariationModal: {variationId, options}
        if (variation && variation.options && Array.isArray(variation.options)) {
          return variation.options.map((option: any) => {
            if (typeof option === 'object' && option.name) {
              return option.name;
            }
            return String(option);
          });
        }
        
        // Handle legacy format or direct string values
        if (typeof variation === 'string') {
          return [variation];
        }
        
        // Handle legacy format with nested options
        if (variation && variation.options && Array.isArray(variation.options)) {
          return variation.options.map((option: any) => option.name || String(option));
        }
        
        return [];
      });
    } catch (error) {
      console.error('Error formatting variations:', error, selectedVariations);
      return [];
    }
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

  const addToTable = async () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de adicionar à mesa.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTable) {
      toast({
        title: "Mesa obrigatória",
        description: "Por favor, selecione uma mesa.",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessing(true);

      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options: item.selectedVariations || [],
        notes: item.notes || ''
      }));

      const { data: existingAccount } = await supabase
        .from('table_accounts')
        .select('*')
        .eq('table_id', selectedTable)
        .eq('status', 'open')
        .maybeSingle();

      if (existingAccount) {
        // Parse existing items properly
        let existingItems = [];
        try {
          if (typeof existingAccount.items === 'string') {
            existingItems = JSON.parse(existingAccount.items);
          } else if (Array.isArray(existingAccount.items)) {
            existingItems = existingAccount.items;
          }
        } catch (e) {
          console.error('Error parsing existing items:', e);
          existingItems = [];
        }

        const updatedItems = [...existingItems, ...orderItems];
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

        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', selectedTable);
      }

      toast({
        title: "Itens adicionados à mesa!",
        description: "Os produtos foram adicionados à conta da mesa.",
      });

      setCart([]);
      setSelectedTable('');
      
      fetchTables();
    } catch (error: any) {
      console.error('Erro ao adicionar à mesa:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar à mesa.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
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

    if (orderType === 'dine_in' && !selectedTable && !customerName.includes('Mesa ')) {
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
      
      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        options: item.selectedVariations || [],
        notes: item.notes || ''
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
        acceptance_status: 'pending_acceptance',
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

      // Filter items for KDS that should be sent to kitchen
      const itemsForKitchen = orderItems.filter(item => {
        const product = products.find(p => p.id === item.product_id);
        return product?.send_to_kds === true;
      });

      // Não enviar para KDS automaticamente
      // Apenas após aceitação manual no Orders.tsx

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

  const handleTableFinalization = (items: any[], total: number, tableNumber: number) => {
    const cartItems: CartItem[] = items.map(item => ({
      id: item.product_id,
      name: item.product_name,
      price: item.price,
      quantity: item.quantity,
      selectedVariations: item.options,
      notes: item.notes,
      available: true
    }));

    setCart(cartItems);
    setCustomerName(`Mesa ${tableNumber}`);
    setOrderType('dine_in');
    setActiveTab('products');

    toast({
      title: "Conta transferida!",
      description: `A conta da Mesa ${tableNumber} foi transferida para o PDV.`,
    });
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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Vendas</TabsTrigger>
          <TabsTrigger value="accounts">MESAS</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Produtos</CardTitle>
                  <CardDescription>Selecione os produtos para adicionar ao pedido</CardDescription>
                  
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
                        <Card key={product.id} className="hover:shadow-lg transition-shadow">
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
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProductClick(product);
                              }}
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

            <div className="space-y-4">
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
                        {cart.map((item, index) => {
                          const formattedVariations = formatSelectedVariations(item.selectedVariations);
                          
                          return (
                            <div key={`${item.id}-${index}`} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(item.price)} cada
                                </p>
                                {formattedVariations && formattedVariations.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {formattedVariations.map((option, optIndex) => (
                                      <div key={optIndex}>• {option}</div>
                                    ))}
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-xs text-gray-500 mt-1 italic">
                                    Obs: {item.notes}
                                  </div>
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
                          );
                        })}
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
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mesa *</label>
                      <Select value={selectedTable} onValueChange={setSelectedTable}>
                        <SelectTrigger>
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
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="paymentMethod">Método de Pagamento</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o método" />
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
                      <Label htmlFor="changeAmount">Valor pago</Label>
                      <Input
                        id="changeAmount"
                        type="number"
                        step="0.01"
                        value={changeAmount}
                        onChange={(e) => setChangeAmount(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-2">
                {selectedTable && orderType === 'dine_in' && (
                  <Button
                    onClick={addToTable}
                    disabled={cart.length === 0 || processing}
                    className="w-full bg-blue-900 hover:bg-blue-800"
                    size="lg"
                  >
                    <UtensilsCrossed size={16} className="mr-2" />
                    Adicionar à Mesa
                  </Button>
                )}
                
                <Button
                  onClick={handleFinalizeSale}
                  disabled={cart.length === 0 || !paymentMethod || processing}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Calculator size={16} className="mr-2" />
                  Finalizar Venda
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <TableAccountManager onFinalize={handleTableFinalization} />
        </TabsContent>
      </Tabs>

      {selectedProduct && (
        <ProductVariationModal
          isOpen={showVariationModal}
          product={selectedProduct}
          variations={productVariations}
          onAddToCart={(product, quantity, variations, notes) => {
            addToCart({...product, available: true}, quantity, variations, notes);
          }}
          onClose={() => {
            setShowVariationModal(false);
            setSelectedProduct(null);
            setProductVariations([]);
          }}
        />
      )}
    </div>
  );
};

export default PDV;
