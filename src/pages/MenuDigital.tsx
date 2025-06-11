
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDigitalMenuCart } from '@/hooks/useDigitalMenuCart';
import { useKitchenIntegration } from '@/hooks/useKitchenIntegration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const MenuDigital = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('u');
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

    fetchRestaurantData();
    fetchProducts();
  }, [userId]);

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
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do restaurante.",
        variant: "destructive",
      });
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
        .eq('show_in_delivery', true);

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
      toast({
        title: "Erro",
        description: "Não foi possível carregar o cardápio.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProductVariations = async (productId: string) => {
    try {
      console.log('🔄 Carregando variações para produto:', productId);
      
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      if (error) {
        console.error('❌ Erro ao carregar variações:', error);
        throw error;
      }

      console.log('✅ Variações carregadas:', data?.length || 0, data);
      return data || [];
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
      console.log('🔄 Finalizando pedido:', orderData);

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar pedido:', error);
        throw error;
      }

      console.log('✅ Pedido criado:', data);

      // Enviar para o KDS se aplicável
      await sendToKitchen(orderData);

      toast({
        title: "Pedido realizado com sucesso!",
        description: `Seu pedido ${orderData.order_number} foi recebido e está sendo preparado.`,
      });

      clearCart();
      setShowCheckoutModal(false);
    } catch (error) {
      console.error('❌ Erro ao finalizar pedido:', error);
      toast({
        title: "Erro ao finalizar pedido",
        description: "Tente novamente ou entre em contato conosco.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
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
                    <Card key={product.id} className="overflow-hidden">
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
