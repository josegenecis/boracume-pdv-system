import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Trash2, Calculator, Search, Store, Truck, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import ProductVariationModal from '@/components/pdv/ProductVariationModal';
import PixPaymentModal from '@/components/payment/PixPaymentModal';
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
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixOrderId, setPixOrderId] = useState<string | undefined>(undefined);
  const [pixAmount, setPixAmount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const { sendToKitchen } = useKitchenIntegration();

  // Refs for animation
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const mobileCartBtnRef = useRef<HTMLDivElement>(null);

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
      // Buscar variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      // Buscar variações globais associadas ao produto
      const { data: globalVariationLinks, error: globalError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id, required, min_selections, max_selections')
        .eq('product_id', productId);

      // Buscar as variações globais pelos IDs
      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = globalVariationLinks.map(link => link.global_variation_id);
        
        const { data: globalVars, error: globalVarError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        if (globalVars) {
          // Mesclar configurações do vínculo nas variações globais
          globalVariations = globalVars.map(globalVar => {
            const link = globalVariationLinks.find(l => l.global_variation_id === globalVar.id);
            const mergedVariation = {
              ...globalVar,
              required: link?.required ?? false,
              min_selections: link?.min_selections ?? 0,
              max_selections: link?.max_selections ?? 1
            };
            return mergedVariation;
          });
        }
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];
      
      const formattedVariations: ProductVariation[] = allVariations
        .map(item => {
          try {
            let options: Array<{ name: string; price: number; }> = [];

            if (typeof item.options === 'string') {
              try {
                options = JSON.parse(item.options);
              } catch (e) {
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

            return {
              id: item.id,
              name: item.name || '',
              options,
              max_selections: Math.max(1, Number(item.max_selections) || 1),
              required: Boolean(item.required)
            };
          } catch (itemError) {
            return null;
          }
        })
        .filter((variation): variation is ProductVariation => variation !== null);
      
      return formattedVariations;
    } catch (error) {
      console.error('Erro geral ao carregar variações:', error);
      return [];
    }
  };

  const animateFlyToCart = (startRect: DOMRect) => {
    // Determine target based on viewport (desktop or mobile)
    const isMobile = window.innerWidth < 1024;
    const targetEl = isMobile 
      ? document.getElementById('mobile-cart-btn') 
      : document.getElementById('cart-container');
      
    if (!targetEl) return;

    const endRect = targetEl.getBoundingClientRect();
    
    const flyItem = document.createElement('div');
    flyItem.className = 'fly-item bg-primary shadow-lg z-50 fixed rounded-full flex items-center justify-center';
    flyItem.style.left = `${startRect.left}px`;
    flyItem.style.top = `${startRect.top}px`;
    flyItem.style.width = `${Math.min(startRect.width, 50)}px`;
    flyItem.style.height = `${Math.min(startRect.height, 50)}px`;
    
    // Set variables for CSS animation
    const tx = endRect.left - startRect.left + (endRect.width / 2) - (Math.min(startRect.width, 50) / 2);
    const ty = endRect.top - startRect.top + (endRect.height / 2) - (Math.min(startRect.height, 50) / 2);
    
    flyItem.style.setProperty('--tx', `${tx}px`);
    flyItem.style.setProperty('--ty', `${ty}px`);
    
    document.body.appendChild(flyItem);
    
    setTimeout(() => {
      document.body.removeChild(flyItem);
    }, 800);
  };

  const handleProductClick = async (product: Product, event?: React.MouseEvent) => {
    // Capture click position for animation if no variations
    const clickRect = event?.currentTarget.getBoundingClientRect();
    
    const variations = await fetchProductVariations(product.id);
    
    if (variations.length > 0) {
      setSelectedProduct(product);
      setProductVariations(variations);
      setShowVariationModal(true);
    } else {
      if (clickRect) {
        animateFlyToCart(clickRect);
      }
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
      duration: 1500,
    });
  };

  // Helper function to format selected variations for display
  const formatSelectedVariations = (selectedVariations?: any[]) => {
    if (!selectedVariations || selectedVariations.length === 0) return [];
    
    try {
      return selectedVariations.flatMap(variation => {
        if (variation && variation.options && Array.isArray(variation.options)) {
          return variation.options.map((option: any) => {
            if (typeof option === 'object' && option.name) {
              return option.name;
            }
            return String(option);
          });
        }
        if (typeof variation === 'string') {
          return [variation];
        }
        if (variation && variation.options && Array.isArray(variation.options)) {
          return variation.options.map((option: any) => option.name || String(option));
        }
        return [];
      });
    } catch (error) {
      console.error('Error formatting variations:', error);
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
        let existingItems = [];
        try {
          if (typeof existingAccount.items === 'string') {
            existingItems = JSON.parse(existingAccount.items);
          } else if (Array.isArray(existingAccount.items)) {
            existingItems = existingAccount.items;
          }
        } catch (e) {
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
    console.log('Finalizando venda...');
    
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
      console.log('Validations passed, creating order...');

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
        acceptance_status: paymentMethod === 'pix' ? 'awaiting_pix_payment' : 'pending_acceptance',
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

      console.log('Pedido criado com sucesso:', data);

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

      if (paymentMethod === 'pix') {
        setPixAmount(getFinalTotal());
        setPixOrderId(data?.[0]?.id || data?.id);
        setIsPixModalOpen(true);
        toast({
          title: "Pedido criado!",
          description: "Aguardando pagamento do PIX para enviar ao restaurante.",
        });
      } else {
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
      }
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
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    try {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    } catch (e) {
      return 'R$ 0,00';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-gray-50/50">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="px-4 pt-2 shrink-0 bg-white border-b z-10">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-2">
            <TabsTrigger value="products">Vendas</TabsTrigger>
            <TabsTrigger value="accounts">MESAS</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="products" className="flex-1 overflow-hidden data-[state=active]:flex flex-col lg:flex-row h-full mt-0">
          {/* Left Column: Products (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 lg:border-r">
            <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
              <div className="shrink-0 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-800">Produtos</h2>
                  <Button variant="ghost" size="sm" onClick={() => fetchData()}>
                    <RefreshCw size={16} />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar produtos por nome ou código..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                    {filteredProducts.map((product) => (
                      <Card 
                        key={product.id} 
                        className="hover:shadow-lg transition-all cursor-pointer group active:scale-95 duration-100"
                        onClick={(e) => handleProductClick(product, e)}
                      >
                        <div className="aspect-square relative overflow-hidden rounded-t-lg">
                          {product.image_url ? (
                            <img 
                              id={`product-img-${product.id}`}
                              src={product.image_url} 
                              alt={product.name} 
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div 
                              id={`product-img-${product.id}`}
                              className="w-full h-full bg-gray-100 flex items-center justify-center"
                            >
                              <Store className="text-gray-300 w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-0.5 text-xs font-bold shadow-sm">
                            {formatCurrency(product.price)}
                          </div>
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium text-xs sm:text-sm line-clamp-2 min-h-[2.5em] mb-1 leading-tight">
                            {product.name}
                          </h3>
                          <Button 
                            className="w-full mt-1 bg-primary/10 text-primary hover:bg-primary hover:text-white h-7 text-xs"
                            size="sm"
                            variant="ghost"
                          >
                            Adicionar
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Cart (Desktop) */}
          <div className="hidden lg:flex lg:w-[400px] xl:w-[450px] bg-white flex-col h-full shadow-xl z-20">
            {/* ... same content as before ... */}
            <div className="p-4 border-b bg-gray-50/50">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="text-primary" />
                <h2 className="font-bold text-lg">Carrinho de Compras</h2>
              </div>
              
              <Tabs value={orderType} onValueChange={(value) => setOrderType(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="delivery" className="text-xs sm:text-sm">Entrega</TabsTrigger>
                  <TabsTrigger value="pickup" className="text-xs sm:text-sm">Retirada</TabsTrigger>
                  <TabsTrigger value="dine_in" className="text-xs sm:text-sm">Mesa</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Cart Items List - Scrollable */}
            <div 
              id="cart-container" 
              ref={cartContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                  <Store size={48} />
                  <p>Carrinho vazio</p>
                </div>
              ) : (
                cart.map((item, index) => {
                  const formattedVariations = formatSelectedVariations(item.selectedVariations);
                  return (
                    <div key={`${item.id}-${index}`} className="flex flex-col p-3 border rounded-lg bg-gray-50 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 mr-2">
                          <span className="font-medium text-sm line-clamp-1">{item.name}</span>
                          <span className="text-xs text-muted-foreground block">
                            {formatCurrency(item.price)} un.
                          </span>
                        </div>
                        <span className="font-bold text-sm">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                      
                      {formattedVariations.length > 0 && (
                        <div className="text-xs text-gray-500 mb-2 pl-2 border-l-2 border-gray-200">
                          {formattedVariations.map((v, i) => (
                            <div key={i}>{v}</div>
                          ))}
                        </div>
                      )}
                      
                      {item.notes && (
                        <div className="text-xs text-amber-600 mb-2 italic bg-amber-50 p-1 rounded">
                          Obs: {item.notes}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                         <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus size={12} />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus size={12} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Checkout Form & Totals - Fixed at Bottom */}
            <div className="p-4 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              {/* Customer Info Form */}
              <div className="space-y-3 mb-4 max-h-40 overflow-y-auto pr-1">
                <div className="flex gap-2">
                  <Input
                    placeholder={orderType === 'dine_in' ? "Nome (Opcional)" : "Nome do Cliente *"}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Telefone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                {orderType === 'delivery' && (
                  <>
                    <Input
                      placeholder="Endereço Completo *"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Select value={selectedDeliveryZone} onValueChange={setSelectedDeliveryZone}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecione o Bairro *" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryZones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name} (+{formatCurrency(zone.delivery_fee)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {orderType === 'dine_in' && (
                  <Select value={selectedTable} onValueChange={setSelectedTable}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione a Mesa *" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          Mesa {table.table_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex gap-2">
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 text-sm flex-1">
                      <SelectValue placeholder="Pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {paymentMethod === 'dinheiro' && (
                    <Input
                      placeholder="Valor pago"
                      value={changeAmount}
                      onChange={(e) => setChangeAmount(e.target.value)}
                      className="h-9 text-sm w-24"
                      type="number"
                    />
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(getTotalValue())}</span>
                </div>
                {getDeliveryFee() > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Entrega</span>
                    <span>{formatCurrency(getDeliveryFee())}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(getFinalTotal())}</span>
                </div>
                {getChangeValue() > 0 && (
                  <div className="flex justify-between text-green-600 text-sm">
                    <span>Troco</span>
                    <span>{formatCurrency(getChangeValue())}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                {orderType === 'dine_in' ? (
                  <Button
                    onClick={addToTable}
                    disabled={processing || cart.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-12"
                  >
                    {processing ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <UtensilsCrossed className="mr-2 h-4 w-4" />
                        Add Mesa
                      </>
                    )}
                  </Button>
                ) : (
                   <div className="col-span-2"></div>
                )}
                
                <Button
                  onClick={handleFinalizeSale}
                  disabled={processing || cart.length === 0}
                  className={`${orderType === 'dine_in' ? '' : 'col-span-2'} w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold shadow-md hover:shadow-lg transition-all`}
                >
                  {processing ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      Finalizar
                      <span className="ml-2 text-sm font-normal opacity-90">
                        {formatCurrency(getFinalTotal())}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Mobile Cart Floating Button */}
          <Sheet>
            <SheetTrigger asChild>
              <div 
                id="mobile-cart-btn" 
                ref={mobileCartBtnRef}
                className="lg:hidden fixed bottom-4 right-4 z-50"
              >
                <div className="relative">
                    <Button className="h-14 w-14 rounded-full shadow-xl bg-primary text-white p-0 flex items-center justify-center">
                      <Calculator size={24} />
                    </Button>
                    {cart.length > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
                        {cart.reduce((acc, item) => acc + item.quantity, 0)}
                      </span>
                    )}
                </div>
              </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
               <SheetHeader className="p-4 border-b">
                 <SheetTitle>Carrinho de Compras</SheetTitle>
               </SheetHeader>
               
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* Cart Items (Duplicate logic or componentize ideally) */}
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                      <Store size={48} />
                      <p>Carrinho vazio</p>
                    </div>
                  ) : (
                    cart.map((item, index) => {
                      const formattedVariations = formatSelectedVariations(item.selectedVariations);
                      return (
                        <div key={`mob-${item.id}-${index}`} className="flex flex-col p-3 border rounded-lg bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-2">
                              <span className="font-medium text-sm line-clamp-1">{item.name}</span>
                              <span className="text-xs text-muted-foreground block">
                                {formatCurrency(item.price)} un.
                              </span>
                            </div>
                            <span className="font-bold text-sm">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                          
                          {formattedVariations.length > 0 && (
                            <div className="text-xs text-gray-500 mb-2 pl-2 border-l-2 border-gray-200">
                              {formattedVariations.map((v, i) => (
                                <div key={i}>{v}</div>
                              ))}
                            </div>
                          )}
                          
                          {item.notes && (
                            <div className="text-xs text-amber-600 mb-2 italic bg-amber-50 p-1 rounded">
                              Obs: {item.notes}
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-2">
                             <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus size={12} />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 ml-2"
                              onClick={() => removeFromCart(item.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
               </div>

               {/* Mobile Checkout Form */}
               <div className="p-4 bg-white border-t">
                  <div className="space-y-3 mb-4 max-h-40 overflow-y-auto pr-1">
                    {/* ... (Same inputs as desktop) ... */}
                    <div className="flex gap-2">
                      <Input
                        placeholder={orderType === 'dine_in' ? "Nome (Opcional)" : "Nome do Cliente *"}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="h-9 text-sm"
                      />
                      <Input
                        placeholder="Telefone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>

                    {orderType === 'delivery' && (
                      <>
                        <Input
                          placeholder="Endereço Completo *"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="h-9 text-sm"
                        />
                        <Select value={selectedDeliveryZone} onValueChange={setSelectedDeliveryZone}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione o Bairro *" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryZones.map((zone) => (
                              <SelectItem key={zone.id} value={zone.id}>
                                {zone.name} (+{formatCurrency(zone.delivery_fee)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}

                    {orderType === 'dine_in' && (
                      <Select value={selectedTable} onValueChange={setSelectedTable}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Selecione a Mesa *" />
                        </SelectTrigger>
                        <SelectContent>
                          {tables.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              Mesa {table.table_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    <div className="flex gap-2">
                       <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-9 text-sm flex-1">
                          <SelectValue placeholder="Pagamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        </SelectContent>
                      </Select>
                       {paymentMethod === 'dinheiro' && (
                        <Input
                          placeholder="Valor pago"
                          value={changeAmount}
                          onChange={(e) => setChangeAmount(e.target.value)}
                          className="h-9 text-sm w-24"
                          type="number"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm mb-4">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>{formatCurrency(getTotalValue())}</span>
                    </div>
                    {getDeliveryFee() > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Entrega</span>
                        <span>{formatCurrency(getDeliveryFee())}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                      <span>Total</span>
                      <span>{formatCurrency(getFinalTotal())}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleFinalizeSale}
                    disabled={processing || cart.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold"
                  >
                     {processing ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>Finalizar {formatCurrency(getFinalTotal())}</>
                    )}
                  </Button>
               </div>
            </SheetContent>
          </Sheet>
        </TabsContent>

        <TabsContent value="accounts" className="flex-1 overflow-y-auto p-4 mt-0">
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

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        amount={pixAmount}
        orderId={pixOrderId}
        onPaymentConfirmed={async () => {
          if (!pixOrderId) return;
          try {
            const { error: updateError } = await supabase
              .from('orders')
              .update({ acceptance_status: 'pending_acceptance' })
              .eq('id', pixOrderId);
            if (!updateError) {
              toast({
                title: "Pagamento confirmado!",
                description: "Pedido enviado ao restaurante.",
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
            }
          } catch (e) {
            console.error(e);
          }
        }}
      />
    </div>
  );
};

export default PDV;
