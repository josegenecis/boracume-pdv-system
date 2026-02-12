import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useMenuData } from '@/hooks/useMenuData';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import { SimpleCartModal } from '@/components/menu/SimpleCartModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import HighlightsSection from '@/components/menu/HighlightsSection';
import CategoryTabs from '@/components/menu/CategoryTabs';
import ProductCard from '@/components/menu/ProductCard';
// import ClubDiscountBanner from '@/components/menu/ClubDiscountBanner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  discount_percentage?: number;
  image_url?: string;
  is_available: boolean;
  show_in_delivery: boolean;
  is_highlight: boolean;
  order_count: number;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  display_order: number;
}

const MenuDigital = () => {
  const { userId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const userIdFromQuery = queryParams.get('userId');
  const { user } = useAuth();
  
  const finalUserId = userId || userIdFromQuery || user?.id || '';
  
  const { toast } = useToast();
  const { 
    cart, 
    addToCart, 
    removeFromCart, 
    updateQuantity, 
    clearCart, 
    getCartTotal, 
    getCartItemCount 
  } = useSimpleCart();

  const { fetchVariations } = useSimpleVariations();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const navigate = useNavigate();

  // Buscar dados do menu
  const { 
    products, 
    categories, 
    highlights, 
    profile, 
    deliveryZones, 
    isLoading: menuLoading,
    error: menuError 
  } = useMenuData({ userId: finalUserId });

  // Pré-carregar imagens dos destaques para exibição instantânea
  useEffect(() => {
    if (highlights.length > 0) {
      highlights.forEach(product => {
        if (product.image_url) {
          const img = new Image();
          img.src = product.image_url;
        }
      });
    }
  }, [highlights]);

  // Configurar scroll spy para tabs
  const categoryIds = categories.map(cat => `category-${cat.id}`);
  const { activeSection, registerSection } = useScrollSpy(categoryIds);

  // Atualizar categoria ativa baseada no scroll
  useEffect(() => {
    if (activeSection) {
      const categoryId = activeSection.replace('category-', '');
      setActiveCategory(categoryId);
    }
  }, [activeSection]);

  // Definir categoria inicial
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  const handleProductClick = (product: Product) => {
    if (!finalUserId) {
      console.error('❌ MenuDigital - userId não encontrado');
      return;
    }
    setSelectedProduct(product);
    setShowVariationModal(true);
    fetchVariations(product.id).catch((error) => {
      console.error('❌ Erro ao buscar variações:', error);
    });
  };

  const handleAddToCartFromModal = (product: Product, quantity: number, variations: string[], notes: string, variationPrice: number) => {
    addToCart(product, quantity, variations, notes, variationPrice);
    setShowVariationModal(false);
    setSelectedProduct(null);
  };

  const handlePlaceOrder = async (orderData: any) => {
    try {
      // Validar dados obrigatórios antes de enviar
      if (!orderData.user_id) {
        throw new Error('ID do usuário é obrigatório');
      }
      if (!orderData.customer_name?.trim()) {
        throw new Error('Nome do cliente é obrigatório');
      }
      if (!orderData.customer_phone?.trim()) {
        throw new Error('Telefone do cliente é obrigatório');
      }
      if (!orderData.items || orderData.items.length === 0) {
        throw new Error('Pedido deve ter pelo menos um item');
      }

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
          console.error('Erro ao verificar cliente existente:', customerCheckError);
        } else if (existingCustomer) {
          customerId = existingCustomer.id;
        }
      } catch (customerError) {
        console.error('Erro na verificação de cliente:', customerError);
      }

      if (!customerId) {
        try {
          // Criar novo cliente
          const customerData = {
            user_id: orderData.user_id,
            name: orderData.customer_name,
            phone: orderData.customer_phone,
            address: orderData.customer_address,
            neighborhood: orderData.customer_neighborhood || ''
          };

          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert([customerData])
            .select('id')
            .single();

          if (customerError) {
            console.error('Erro ao criar cliente:', customerError);
          } else {
            customerId = newCustomer.id;
          }
        } catch (customerError) {
          console.error('Erro na criação de cliente:', customerError);
        }
      }

      // Adicionar customer_id ao pedido se cliente foi criado/encontrado
      if (customerId) {
        orderData.customer_id = customerId;
      }

      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar pedido no banco:', error);
        
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

      // Notificar cliente via WhatsApp (pedido recebido)
      try {
        if (orderData.customer_phone && data?.id) {
          const digits = String(orderData.customer_phone).replace(/\D/g, '');
          const to = digits.startsWith('55') ? digits : `55${digits}`;
          const trackUrl = `${window.location.origin}/track/${data.id}`;
          await supabase.functions.invoke('whatsapp-notify', {
            body: {
              to,
              text: `Recebemos seu pedido ${orderData.order_number}. Acompanhe aqui: ${trackUrl}`
            }
          });
        }
      } catch (waErr) {
        console.warn('⚠️ Falha ao notificar via WhatsApp (não crítico):', waErr);
      }

      if (orderData.payment_method === 'pix') {
        throw new Error('PIX indisponível no momento. Escolha outra forma de pagamento.');
      } else {
        // Push para o restaurante
        try {
          const { data: subs } = await (supabase as any)
            .from('push_subscriptions')
            .select('endpoint, keys')
            .eq('user_id', orderData.user_id);
          if (Array.isArray(subs) && subs.length > 0) {
            await supabase.functions.invoke('send-push', {
              body: {
                subscriptions: subs.map((s: any) => ({ endpoint: s.endpoint, keys: s.keys })),
                title: 'Novo Pedido!',
                body: `Pedido ${orderData.order_number} recebido`,
                url: '/pedidos'
              }
            })
          }
        } catch (pushErr) {
          console.warn('Falha ao enviar push (não crítico):', pushErr)
        }
        toast({
          title: "Pedido realizado!",
          description: `Acompanhe o andamento do pedido ${orderData.order_number}.`,
        });
        clearCart();
        setShowCartModal(false);
        if (data?.id) {
          navigate(`/track/${data.id}`);
        }
      }
    } catch (error) {
      console.error('Erro completo ao finalizar pedido:', error);
      
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

  // Filtrar produtos por busca
  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query)
    );
  });

  // Agrupar produtos por categoria
  const productsByCategory = categories.map(category => ({
    ...category,
    products: filteredProducts.filter(product => product.category_id === category.id)
  })).filter(category => category.products.length > 0);

  if (menuLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Erro ao carregar cardápio</h1>
          <p className="text-gray-600">{menuError}</p>
        </div>
      </div>
    );
  }

  if (!finalUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Link inválido</h1>
          <p className="text-gray-600">Verifique se o link está correto.</p>
        </div>
      </div>
    );
  }

  if (!profile || products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {profile?.restaurant_name || 'Restaurante'}
          </h1>
          <p className="text-gray-600">Este restaurante ainda não possui produtos disponíveis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header com busca */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {profile?.restaurant_name || 'Cardápio'}
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={`Buscar em ${profile?.restaurant_name || 'Cardápio'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 w-full rounded-full border-gray-200 focus:ring-2 focus:ring-orange-600 focus:border-orange-600"
            />
          </div>
          {/* Tabs de Categorias dentro do cabeçalho sticky */}
          {categories.length > 0 && (
            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Seção de Destaques */}
        {highlights.length > 0 && (
          <HighlightsSection
            products={highlights}
            onProductClick={handleProductClick}
          />
        )}

        {/* Espaço após header sticky para conteúdo não ficar oculto */}
        <div className="h-4" />

        {/* Produtos por Categoria */}
        <div className="space-y-8">
          {productsByCategory.map((category) => (
            <section
              key={category.id}
              id={`category-${category.id}`}
              ref={(el) => {
                if (el) registerSection(`category-${category.id}`, el);
              }}
              className="scroll-mt-32"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {category.name}
              </h2>
              <div className="space-y-3">
                {category.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onProductClick={handleProductClick}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Modals */}
      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onAddToCart={handleAddToCartFromModal}
      />

      <SimpleCartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        total={getCartTotal()}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onPlaceOrder={handlePlaceOrder}
        deliveryZones={deliveryZones}
        userId={finalUserId}
      />

      {/* Clube de Vantagens removido conforme solicitação */}

      {/* Carrinho Fixo */}
      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => setShowCartModal(true)}
      />
    </div>
  );
};

export default MenuDigital;
