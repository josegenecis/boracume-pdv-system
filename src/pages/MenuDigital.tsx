import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useMenuData } from '@/hooks/useMenuData';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { prefetchSimpleVariations } from '@/hooks/useSimpleVariations';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import { SimpleCartModal } from '@/components/menu/SimpleCartModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { buildPublicTrackShareUrl } from '@/utils/publicUrl';
import HighlightsSection from '@/components/menu/HighlightsSection';
import CategoryTabs from '@/components/menu/CategoryTabs';
import ProductCard from '@/components/menu/ProductCard';
import MarketingBanners from '@/components/marketing/MarketingBanners';
import MarketingPixels from '@/components/marketing/MarketingPixels';
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
  track_stock?: boolean;
  stock_quantity?: number;
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

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [openingProductId, setOpeningProductId] = useState<string | null>(null);
  const warnedStockRef = useRef<Set<string>>(new Set());
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
  } = useMenuData({ userId: finalUserId, enableCache: true, cacheTTL: 15 });

  useEffect(() => {
    const name = String(profile?.restaurant_name || '').trim();
    if (!name) return;
    document.title = `${name} • Cardápio`;
    const upsert = (key: 'name' | 'property', value: string, content: string) => {
      try {
        const head = document.head;
        if (!head) return;
        const selector = `meta[${key}="${value}"]`;
        let el = head.querySelector(selector) as HTMLMetaElement | null;
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(key, value);
          head.appendChild(el);
        }
        el.setAttribute('content', content);
      } catch {}
    };
    upsert('property', 'og:title', name);
    upsert('name', 'twitter:title', name);
    const image = String((profile as any)?.banner_url || (profile as any)?.logo_url || '').trim();
    if (image) {
      upsert('property', 'og:image', image);
      upsert('name', 'twitter:image', image);
    }
  }, [profile]);

  useEffect(() => {
    const stockById = new Map<string, number>();
    for (const p of products as any[]) {
      const track = Boolean(p.track_stock);
      const available = Number(p.stock_quantity);
      if (track && Number.isFinite(available)) {
        stockById.set(String(p.id), Math.max(0, Math.floor(available)));
      }
    }
    if (stockById.size === 0) return;

    const qtyInCart = new Map<string, number>();
    for (const item of cart) {
      const pid = String(item.product.id);
      qtyInCart.set(pid, (qtyInCart.get(pid) || 0) + (Number(item.quantity) || 0));
    }

    for (const [pid, qty] of qtyInCart.entries()) {
      const available = stockById.get(pid);
      if (available === undefined) continue;
      if (qty > available && !warnedStockRef.current.has(pid)) {
        warnedStockRef.current.add(pid);
        toast({
          title: 'Estoque atualizado',
          description: 'Alguns itens no carrinho excedem o estoque disponível.',
          variant: 'destructive'
        });
      }
      if (qty <= available && warnedStockRef.current.has(pid)) {
        warnedStockRef.current.delete(pid);
      }
    }
  }, [products, cart]);

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

  useEffect(() => {
    if (!finalUserId) return;
    const ids = Array.from(
      new Set(
        [...highlights, ...products.slice(0, 12)]
          .map((p: any) => String(p?.id || '').trim())
          .filter(Boolean)
      )
    );
    if (ids.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const id of ids) {
        if (cancelled) break;
        void prefetchSimpleVariations(id);
        await new Promise((r) => setTimeout(r, 0));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [finalUserId, highlights, products]);

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

  const handleProductClick = async (product: Product) => {
    if (!finalUserId) {
      console.error('❌ MenuDigital - userId não encontrado');
      return;
    }

    setOpeningProductId(product.id);
    try {
      void prefetchSimpleVariations(product.id);
      const track = Boolean((product as any).track_stock);
      const stock = Number((product as any).stock_quantity);
      const inCart = cart.reduce((sum, item) => sum + (item.product.id === product.id ? Number(item.quantity || 0) : 0), 0);
      if (track && Number.isFinite(stock)) {
        const remaining = Math.max(0, Math.floor(stock) - inCart);
        if (remaining <= 0) {
          toast({
            title: 'Produto sem estoque',
            description: 'Este item está indisponível no momento.',
            variant: 'destructive'
          });
          return;
        }
      }
      setSelectedProduct(product);
      setShowVariationModal(true);
    } finally {
      window.setTimeout(() => setOpeningProductId(null), 60);
    }
  };

  const handleAddToCartFromModal = (product: Product, quantity: number, variations: string[], notes: string, variationPrice: number) => {
    const track = Boolean((product as any).track_stock);
    const stock = Number((product as any).stock_quantity);
    const inCart = cart.reduce((sum, item) => sum + (item.product.id === product.id ? Number(item.quantity || 0) : 0), 0);
    if (track && Number.isFinite(stock)) {
      const remaining = Math.max(0, Math.floor(stock) - inCart);
      if (quantity > remaining) {
        toast({
          title: 'Estoque insuficiente',
          description: `Quantidade máxima disponível: ${remaining}.`,
          variant: 'destructive'
        });
        return;
      }
    }
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

      const qtyByProduct: Record<string, number> = {};
      const nameByProduct: Record<string, string> = {};
      for (const item of orderData.items as any[]) {
        const pid = String(item.product_id || '').trim();
        if (!pid) continue;
        qtyByProduct[pid] = (qtyByProduct[pid] || 0) + (Number(item.quantity) || 0);
        nameByProduct[pid] = String(item.product_name || item.name || '').trim() || nameByProduct[pid] || 'Produto';
      }

      const productIds = Object.keys(qtyByProduct);
      if (productIds.length > 0) {
        let lastError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const { data: stockRows, error: stockError } = await (supabase as any)
              .from('products')
              .select('id, track_stock, stock_quantity')
              .eq('user_id', orderData.user_id)
              .in('id', productIds as any);

            if (stockError) throw stockError;
            const rows: any[] = Array.isArray(stockRows) ? stockRows : [];
            for (const row of rows) {
              const pid = String(row.id);
              const requested = Number(qtyByProduct[pid] || 0);
              const track = Boolean(row.track_stock);
              const available = Number(row.stock_quantity);
              if (track && Number.isFinite(available) && requested > Math.max(0, Math.floor(available))) {
                throw new Error(`Estoque insuficiente para ${nameByProduct[pid] || 'produto'}. Disponível: ${Math.max(0, Math.floor(available))}.`);
              }
            }
            lastError = null;
            break;
          } catch (e: any) {
            lastError = e;
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
            }
          }
        }
        if (lastError) {
          throw new Error(lastError?.message || 'Não foi possível validar estoque. Tente novamente.');
        }
      }

      const phoneDigits = String(orderData.customer_phone || '').replace(/\D/g, '');
      if (phoneDigits.length >= 10) {
        orderData.customer_phone = phoneDigits;
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
          const trackUrl = buildPublicTrackShareUrl(String(data.id), { userId: orderData.user_id, orderNumber: orderData.order_number });
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

      // Push para o restaurante
      try {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, keys')
          .eq('user_id', orderData.user_id)
        if (Array.isArray(subs) && subs.length > 0) {
          await supabase.functions.invoke('send-push', {
            body: {
              subscriptions: subs.map(s => ({ endpoint: s.endpoint, keys: s.keys })),
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
        description: orderData.payment_method === 'pix'
          ? `Pagamento via PIX será realizado na entrega do pedido ${orderData.order_number}.`
          : `Acompanhe o andamento do pedido ${orderData.order_number}.`,
      });
      clearCart();
      setShowCartModal(false);
      if (data?.id) {
        navigate(`/track/${data.id}`);
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
      String((product as any)?.name || '').toLowerCase().includes(query) ||
      String((product as any)?.description || '').toLowerCase().includes(query)
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
      <MarketingPixels userId={finalUserId} />
      <div className="relative">
        <div className="relative h-40 sm:h-48 w-full bg-gradient-to-br from-orange-500 via-orange-600 to-rose-500 overflow-hidden">
          {(profile as any)?.banner_url ? (
            <img
              src={String((profile as any).banner_url)}
              alt={profile.restaurant_name || 'Banner'}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (profile as any)?.logo_url ? (
            <img
              src={String((profile as any).logo_url)}
              alt={profile.restaurant_name || 'Logo'}
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-white/0" />
        </div>

        <div className="max-w-4xl mx-auto px-4 -mt-14 sm:-mt-16 relative z-10">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-white shadow-sm overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 -mt-9 sm:-mt-10">
                {(profile as any)?.logo_url ? (
                  <img src={String((profile as any).logo_url)} alt={profile.restaurant_name || 'Logo'} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-xs font-bold text-gray-600">
                    {(profile?.restaurant_name || 'BC').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                  {profile?.restaurant_name || 'Cardápio'}
                </h1>
                {((profile as any)?.address || (profile as any)?.phone) && (
                  <div className="text-xs text-gray-600 mt-1">
                    {(profile as any)?.address ? String((profile as any).address) : ''}
                    {(profile as any)?.address && (profile as any)?.phone ? ' • ' : ''}
                    {(profile as any)?.phone ? String((profile as any).phone) : ''}
                  </div>
                )}
                {(profile as any)?.description && (
                  <div className="text-xs text-gray-600 mt-2 line-clamp-2">
                    {String((profile as any).description)}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={`Buscar em ${profile?.restaurant_name || 'Cardápio'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 h-10 w-full rounded-full border-gray-200 focus:ring-2 focus:ring-orange-600 focus:border-orange-600 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-white sticky top-0 z-40 mt-3 pb-2">
            {categories.length > 0 && (
              <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div className="mt-4">
          <MarketingBanners
            restaurantId={finalUserId}
            onSelectProductId={(productId) => {
              const p = (products as any[]).find((x: any) => String(x?.id) === String(productId));
              if (p) void handleProductClick(p as any);
            }}
          />
        </div>

        <div className="h-3" />
        {/* Seção de Destaques */}
        {highlights.length > 0 && (
          <HighlightsSection
            products={highlights}
            onProductClick={handleProductClick}
          />
        )}

        <div className="h-3" />

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
              <h2 className="text-lg font-bold text-gray-900 mb-3">
                {category.name}
              </h2>
              <div className="space-y-3">
                {category.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onProductClick={handleProductClick}
                    isAdding={openingProductId === product.id}
                    layout="list"
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
        maxQuantity={(() => {
          if (!selectedProduct) return null;
          const track = Boolean((selectedProduct as any).track_stock);
          const stock = Number((selectedProduct as any).stock_quantity);
          if (!track || !Number.isFinite(stock)) return null;
          const inCart = cart.reduce((sum, item) => sum + (item.product.id === selectedProduct.id ? Number(item.quantity || 0) : 0), 0);
          return Math.max(0, Math.floor(stock) - inCart);
        })()}
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
