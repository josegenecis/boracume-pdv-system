
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDigitalMenuCart } from '@/hooks/useDigitalMenuCart';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductVariationModal from '@/components/menu/ProductVariationModal';
import CheckoutModal from '@/components/menu/CheckoutModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { Plus, Clock, MapPin, Phone } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
  category?: string;
  user_id: string;
}

interface ProductVariation {
  id: string;
  name: string;
  options: Array<{
    name: string;
    price: number;
  }>;
  max_selections: number;
  required: boolean;
}

interface Profile {
  restaurant_name?: string;
  phone?: string;
  address?: string;
  opening_hours?: string;
  description?: string;
  logo_url?: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  delivery_fee: number;
  minimum_order: number;
  delivery_time: string;
  active: boolean;
}

const MenuDigital = () => {
  const { userId: paramUserId } = useParams();
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get('u');
  
  // Usar parâmetro da URL ou query parameter
  const userId = paramUserId || queryUserId;
  
  const { toast } = useToast();
  const { sendToKitchen } = useKitchenIntegration();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  const {
    cart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getCartTotal,
    getCartItemCount
  } = useDigitalMenuCart();

  useEffect(() => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Link inválido. ID do usuário não encontrado.",
        variant: "destructive",
      });
      return;
    }

    fetchAllData();
  }, [userId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRestaurantData(),
        fetchProducts(),
        fetchDeliveryZones()
      ]);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o cardápio. Verifique se o link está correto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantData = async () => {
    try {
      console.log('🔄 Carregando dados do restaurante para userId:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Erro ao carregar perfil:', error);
        throw error;
      }

      console.log('✅ Perfil carregado:', data);
      setProfile(data);
    } catch (error) {
      console.error('❌ Erro ao carregar dados do restaurante:', error);
      throw error;
    }
  };

  const fetchProducts = async () => {
    try {
      console.log('🔄 Carregando produtos para userId:', userId);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('available', true)
        .eq('show_in_delivery', true)
        .order('name');

      if (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        throw error;
      }

      console.log('✅ Produtos carregados:', data?.length || 0);
      setProducts(data || []);
      
      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean) || [])];
      setCategories(uniqueCategories);
      
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
      throw error;
    }
  };

  const fetchDeliveryZones = async () => {
    try {
      console.log('🔄 Carregando zonas de entrega para userId:', userId);
      
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('❌ Erro ao carregar zonas de entrega:', error);
        throw error;
      }

      console.log('✅ Zonas de entrega carregadas:', data?.length || 0);
      setDeliveryZones(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar zonas de entrega:', error);
    }
  };

  const fetchProductVariations = async (productId: string): Promise<ProductVariation[]> => {
    try {
      console.log('🔄 Carregando variações para produto:', productId);
      
      // Buscar variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      if (productError) {
        console.error('❌ Erro ao carregar variações do produto:', productError);
      }

      // Buscar variações globais associadas ao produto
      const { data: globalVariationLinks, error: globalError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      if (globalError) {
        console.error('❌ Erro ao carregar variações globais:', globalError);
      }

      // Buscar as variações globais pelos IDs
      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = globalVariationLinks.map(link => link.global_variation_id);
        
        const { data: globalVars, error: globalVarError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        if (globalVarError) {
          console.error('❌ Erro ao buscar variações globais:', globalVarError);
        } else {
          globalVariations = globalVars || [];
        }
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];

      console.log('✅ Variações raw carregadas:', allVariations.length, allVariations);
      
      const formattedVariations: ProductVariation[] = allVariations
        .map(item => {
          try {
            let options: Array<{ name: string; price: number; }> = [];
            
            if (item.options && Array.isArray(item.options)) {
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
            console.error('❌ Erro ao processar variação:', itemError, item);
            return null;
          }
        })
        .filter((variation): variation is ProductVariation => variation !== null);
      
      console.log('✅ Variações formatadas:', formattedVariations);
      return formattedVariations;
    } catch (error) {
      console.error('❌ Erro ao carregar variações:', error);
      return [];
    }
  };

  const handleProductClick = async (product: Product) => {
    console.log('🔄 Produto clicado:', product.name);
    
    const variations = await fetchProductVariations(product.id);
    
    if (variations.length > 0) {
      console.log('✅ Produto tem variações, abrindo modal');
      setSelectedProduct(product);
      setProductVariations(variations);
      setShowVariationModal(true);
    } else {
      console.log('✅ Produto sem variações, adicionando direto ao carrinho');
      addToCart(product, 1, [], '');
    }
  };

  const handleAddToCart = (product: Product, quantity: number, selectedVariations: any[], notes: string) => {
    console.log('🔄 Adicionando produto personalizado ao carrinho:', {
      product: product.name,
      quantity,
      variations: selectedVariations,
      notes
    });
    
    addToCart(product, quantity, selectedVariations, notes);
    setShowVariationModal(false);
    setSelectedProduct(null);
    setProductVariations([]);
  };

  const handlePlaceOrder = async (orderData: any) => {
    try {
      console.log('🔄 Finalizando pedido na MenuDigital:', JSON.stringify(orderData, null, 2));
      console.log('🔄 Usando userId:', userId);

      // Validar dados obrigatórios antes de enviar
      if (!orderData.user_id) {
        console.log('❌ user_id ausente:', orderData.user_id);
        throw new Error('ID do usuário é obrigatório');
      }
      if (!orderData.customer_name?.trim()) {
        console.log('❌ customer_name ausente:', orderData.customer_name);
        throw new Error('Nome do cliente é obrigatório');
      }
      if (!orderData.customer_phone?.trim()) {
        console.log('❌ customer_phone ausente:', orderData.customer_phone);
        throw new Error('Telefone do cliente é obrigatório');
      }
      if (!orderData.items || orderData.items.length === 0) {
        console.log('❌ items ausentes:', orderData.items);
        throw new Error('Pedido deve ter pelo menos um item');
      }

      console.log('✅ Validação inicial passou, criando/verificando cliente...');

      // Primeiro, verificar se o cliente já existe
      let customerId = null;
      try {
        const { data: existingCustomer, error: customerCheckError } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', orderData.user_id)
          .eq('phone', orderData.customer_phone)
          .maybeSingle();

        if (customerCheckError) {
          console.error('❌ Erro ao verificar cliente existente:', customerCheckError);
        } else if (existingCustomer) {
          console.log('✅ Cliente existente encontrado:', existingCustomer.id);
          customerId = existingCustomer.id;
        }
      } catch (customerError) {
        console.error('❌ Erro na verificação de cliente:', customerError);
      }

      if (!customerId) {
        console.log('🔄 Criando novo cliente...');
        
        try {
          // Criar novo cliente
          const customerData = {
            user_id: orderData.user_id,
            name: orderData.customer_name,
            phone: orderData.customer_phone,
            address: orderData.customer_address
          };

          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert([customerData])
            .select('id')
            .single();

          if (customerError) {
            console.error('❌ Erro ao criar cliente:', customerError);
            // Continuar sem cliente se falhar - não é crítico
          } else {
            console.log('✅ Cliente criado:', newCustomer.id);
            customerId = newCustomer.id;
          }
        } catch (customerError) {
          console.error('❌ Erro na criação de cliente:', customerError);
        }
      }

      // Adicionar customer_id ao pedido se cliente foi criado/encontrado
      if (customerId) {
        orderData.customer_id = customerId;
      }

      console.log('🔄 Inserindo pedido no banco...');
      console.log('📦 Dados finais do pedido:', JSON.stringify(orderData, null, 2));

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar pedido no banco:', error);
        console.error('❌ Detalhes do erro:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Tratar erros específicos do banco
        if (error.code === '23505') {
          throw new Error('Número do pedido já existe. Tente novamente.');
        } else if (error.code === '23503') {
          throw new Error('Dados de referência inválidos. Verifique área de entrega.');
        } else if (error.code === '23502') {
          throw new Error('Campos obrigatórios não preenchidos.');
        } else {
          throw new Error(`Erro no banco de dados: ${error.message}`);
        }
      }

      console.log('✅ Pedido criado com sucesso:', data);

      // IMPORTANTE: Não enviar para KDS automaticamente - aguardar aceitação em Orders
      console.log('✅ Pedido criado. NÃO enviando automaticamente para KDS - aguardando aceitação manual');

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Seu pedido ${orderData.order_number} foi recebido e está sendo preparado.`,
      });

      clearCart();
      setShowCheckoutModal(false);
    } catch (error) {
      console.error('❌ Erro completo ao finalizar pedido:', error);
      console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
      
      let userMessage = "Tente novamente ou entre em contato conosco.";
      if (error instanceof Error) {
        userMessage = error.message;
      }
      
      toast({
        title: "Erro ao finalizar pedido",
        description: userMessage,
        variant: "destructive",
      });
      
      // Re-throw para que o CheckoutModal saiba que houve erro
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Link inválido</h1>
          <p className="text-muted-foreground">Verifique se o link está correto.</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Restaurante não encontrado</h1>
          <p className="text-muted-foreground">Este restaurante pode não existir ou estar temporariamente indisponível.</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{profile?.restaurant_name || 'Restaurante'}</h1>
          <p className="text-muted-foreground">Este restaurante ainda não possui produtos disponíveis para delivery.</p>
        </div>
      </div>
    );
  }

  const productsByCategory = (category: string) => 
    products.filter(product => product.category === category);

  return (
    <div className="min-h-screen bg-background">
      {/* Header do Restaurante */}
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {profile?.logo_url && (
              <img 
                src={profile.logo_url} 
                alt="Logo"
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {profile?.restaurant_name || 'Restaurante'}
              </h1>
              {profile?.description && (
                <p className="text-primary-foreground/80">{profile.description}</p>
              )}
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {profile?.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {profile.phone}
              </div>
            )}
            {profile?.opening_hours && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {profile.opening_hours}
              </div>
            )}
            {profile?.address && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {profile.address}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cardápio */}
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {categories.length > 0 ? (
          <Tabs defaultValue={categories[0]} className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6">
              {categories.map(category => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {categories.map(category => (
              <TabsContent key={category} value={category}>
                <div className="grid gap-4">
                  {productsByCategory(category).map(product => (
                    <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="flex">
                        {product.image_url && (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-24 h-24 object-cover"
                          />
                        )}
                        <div className="flex-1 p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{product.name}</h3>
                              {product.description && (
                                <p className="text-muted-foreground text-sm mt-1">
                                  {product.description}
                                </p>
                              )}
                              <p className="text-primary font-bold text-lg mt-2">
                                R$ {product.price.toFixed(2)}
                              </p>
                            </div>
                            <Button 
                              onClick={() => handleProductClick(product)}
                              size="sm"
                              className="ml-4"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedProduct && (
        <ProductVariationModal
          isOpen={showVariationModal}
          onClose={() => {
            setShowVariationModal(false);
            setSelectedProduct(null);
            setProductVariations([]);
          }}
          product={selectedProduct}
          variations={productVariations}
          onAddToCart={handleAddToCart}
        />
      )}

      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        cart={cart}
        total={getCartTotal()}
        deliveryZones={deliveryZones}
        onPlaceOrder={handlePlaceOrder}
        userId={userId}
      />

      {/* Carrinho Fixo */}
      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => setShowCheckoutModal(true)}
      />
    </div>
  );
};

export default MenuDigital;
