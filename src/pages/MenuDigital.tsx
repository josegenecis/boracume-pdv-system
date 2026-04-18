import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useMenuData } from '@/hooks/useMenuData';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import {
  getCachedSimpleVariations,
  getSimpleVariationPresence,
  hasCachedSimpleVariationsResult,
  isSimpleVariationReady,
  prefetchSimpleVariations,
  prefetchSimpleVariationsBulk,
  primeSimpleVariationPresence
} from '@/hooks/useSimpleVariations';
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
import MarketingBanners from '@/components/marketing/MarketingBanners';
import MarketingPixels from '@/components/marketing/MarketingPixels';
import { Badge } from '@/components/ui/badge';
import { getStoreOpenInfo } from '@/lib/storeHours';
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
  } = useSimpleCart(finalUserId);

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
    deliverySettings,
    isLoading: menuLoading,
    error: menuError 
  } = useMenuData({ userId: finalUserId, enableCache: true, cacheTTL: 15 });
  const storeOpenInfo = useMemo(() => getStoreOpenInfo((profile as any)?.opening_hours), [profile]);
  const menuProductIds = useMemo(() => {
    return Array.from(
      new Set(
        [...highlights, ...(products as any[])]
          .map((p: any) => String(p?.id || '').trim())
          .filter(Boolean)
      )
    );
  }, [highlights, products]);
  const variationsReadyFromCache = useMemo(() => {
    if (menuProductIds.length === 0) return true;
    return menuProductIds.every((id) => isSimpleVariationReady(id));
  }, [menuProductIds]);

  // Pré-carregar script do Google Maps se houver chave configurada e o usuário precisar usar mapas
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY;
  // Aplicar cores personalizadas ao CSS via variáveis no root do cardápio
  useEffect(() => {
    if (!profile) return;
    
    const themeConfig = (profile as any)?.theme_config;
    if (themeConfig) {
      const root = document.documentElement;
      if (themeConfig.primary) {
        root.style.setProperty('--menu-primary', themeConfig.primary);
      }
      if (themeConfig.secondary) {
        root.style.setProperty('--menu-secondary', themeConfig.secondary);
      }
      if (themeConfig.accent) {
        root.style.setProperty('--menu-accent', themeConfig.accent);
      }
      if (themeConfig.background) {
        root.style.setProperty('--menu-bg', themeConfig.background);
      }
    } else {
      // Cores padrão (Pomar)
      const root = document.documentElement;
      root.style.setProperty('--menu-primary', '#85C441');
      root.style.setProperty('--menu-secondary', '#063D2E');
      root.style.setProperty('--menu-accent', '#EF6C20');
      root.style.setProperty('--menu-bg', '#F7EEDF');
    }
  }, [profile]);

  useEffect(() => {
    if (!googleKey) return;
    const mode = deliverySettings?.pricing?.mode;
    if (mode === 'distance_km' || mode === 'radius_km' || mode === 'polygon') {
      import('@/components/settings/delivery/PolygonAreasEditor').then(({ loadGoogleMaps }) => {
        loadGoogleMaps(googleKey).catch(console.error);
      });
    }
  }, [googleKey, deliverySettings]);

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
    const image = String((profile as any)?.logo_url || (profile as any)?.banner_url || '').trim();
    if (image) {
      upsert('property', 'og:image', image);
      upsert('property', 'og:image:secure_url', image);
      upsert('property', 'og:image:alt', `Logo do restaurante ${name}`);
      upsert('name', 'twitter:image', image);
      upsert('name', 'twitter:image:alt', `Logo do restaurante ${name}`);
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
    if (!finalUserId || menuLoading || menuError || menuProductIds.length === 0 || variationsReadyFromCache) return;

    let cancelled = false;
    const run = async () => {
      const idsWithVariations = await primeSimpleVariationPresence(menuProductIds);
      if (cancelled) return;

      const idsToWarm = idsWithVariations.length > 0
        ? idsWithVariations
        : menuProductIds.filter((id) => getSimpleVariationPresence(id) !== 'none');

      if (idsToWarm.length > 0) {
        await prefetchSimpleVariationsBulk(idsToWarm, 12);
      }
    };

    void run().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [finalUserId, menuLoading, menuError, menuProductIds, variationsReadyFromCache]);

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

    const cachedVariationsReady = hasCachedSimpleVariationsResult(product.id);
    const cachedVariations = cachedVariationsReady ? getCachedSimpleVariations(product.id) : [];
    const variationPresence = cachedVariations.length > 0 ? 'has' : getSimpleVariationPresence(product.id);
    const needsVariationFetch = variationPresence !== 'none' && !cachedVariationsReady;

    if (needsVariationFetch) {
      setOpeningProductId(product.id);
    }

    try {
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

      if (variationPresence === 'none') {
        addToCart(product, 1, [], '', 0);
        toast({
          title: 'Adicionado ao carrinho',
          description: `${product.name} foi adicionado com sucesso.`,
        });
        return;
      }

      if (cachedVariations.length > 0) {
        setSelectedProduct(product);
        setShowVariationModal(true);
        return;
      }

      if (variationPresence === 'has' && cachedVariationsReady && cachedVariations.length === 0) {
        const variations = await prefetchSimpleVariations(product.id);
        if (variations.length > 0) {
          setSelectedProduct(product);
          setShowVariationModal(true);
          return;
        }
      }

      if (variationPresence === 'has' && !cachedVariationsReady) {
        const variations = await prefetchSimpleVariations(product.id);
        if (variations.length > 0) {
          setSelectedProduct(product);
          setShowVariationModal(true);
          return;
        }

        addToCart(product, 1, [], '', 0);
        toast({
          title: 'Adicionado ao carrinho',
          description: `${product.name} foi adicionado com sucesso.`,
        });
        return;
      }

      const variations = await prefetchSimpleVariations(product.id);
      if (variations.length > 0) {
        setSelectedProduct(product);
        setShowVariationModal(true);
        return;
      }

      addToCart(product, 1, [], '', 0);
      toast({
        title: 'Adicionado ao carrinho',
        description: `${product.name} foi adicionado com sucesso.`,
      });
    } finally {
      if (needsVariationFetch) {
        setOpeningProductId((current) => (current === product.id ? null : current));
      }
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

  const linkedProducts = useMemo(() => {
    return (products as Product[]).reduce<Record<string, { id: string; name: string; description?: string; price: number; imageUrl?: string }>>((acc, product) => {
      acc[String(product.id)] = {
        id: String(product.id),
        name: String(product.name || ''),
        description: String(product.description || ''),
        price: Number(product.price || 0),
        imageUrl: String((product as any).image_url || ''),
      };
      return acc;
    }, {});
  }, [products]);

  const handleQuickAddFromBanner = async (productId: string) => {
    const product = (products as Product[]).find((item) => String(item.id) === String(productId));
    if (!product) {
      toast({
        title: 'Produto não encontrado',
        description: 'Este item não está disponível no cardápio no momento.',
        variant: 'destructive'
      });
      return;
    }

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

    if (getSimpleVariationPresence(product.id) === 'none') {
      addToCart(product, 1, [], '', 0);
      toast({
        title: 'Adicionado ao carrinho',
        description: `${product.name} foi adicionado com sucesso.`,
      });
      return;
    }

    const variations = await prefetchSimpleVariations(product.id);
    const requiresSelection = variations.some((variation) => Boolean((variation as any)?.required) || Number((variation as any)?.min_selections || 0) > 0);

    if (requiresSelection) {
      toast({
        title: 'Escolha as opções',
        description: 'Este produto precisa que você selecione os complementos antes de adicionar.',
      });
      await handleProductClick(product);
      return;
    }

    addToCart(product, 1, [], '', 0);
    toast({
      title: 'Adicionado ao carrinho',
      description: `${product.name} foi adicionado com sucesso.`,
    });
  };

  const handlePlaceOrder = async (orderData: any) => {
    try {
      if (!storeOpenInfo.isOpen) {
        throw new Error('A loja está fechada no momento. Aguarde o horário de atendimento para finalizar seu pedido.');
      }

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

      const loyaltyRewardId = orderData.loyalty_reward_id ? String(orderData.loyalty_reward_id) : null;
      const { loyalty_reward_id: _loyaltyRewardId, ...dbOrderData } = orderData;

      const { data, error } = await supabase
        .from('orders')
        .insert([dbOrderData])
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
        if (data?.id) {
          await supabase.functions.invoke('whatsapp-order-created', {
            body: {
              orderId: data.id
            }
          });
        }
      } catch (waErr) {
        console.warn('⚠️ Falha ao notificar via WhatsApp (não crítico):', waErr);
      }

      try {
        if (data?.id && loyaltyRewardId) {
          const { data: redeemResult, error: redeemError } = await supabase.functions.invoke('loyalty-redeem-reward', {
            body: {
              rewardId: loyaltyRewardId,
              orderId: data.id,
              userId: orderData.user_id,
            }
          });

          if (redeemError) throw redeemError;
          if (!redeemResult?.ok) {
            console.warn('⚠️ Recompensa fidelidade não foi marcada como usada:', redeemResult);
          }
        }
      } catch (loyaltyErr) {
        console.warn('⚠️ Falha ao marcar recompensa fidelidade como usada:', loyaltyErr);
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
  const productsByCategory = categories.length > 0
    ? categories.map(category => ({
        ...category,
        products: filteredProducts.filter(product => product.category_id === category.id)
      })).filter(category => category.products.length > 0)
    : (filteredProducts.length > 0
        ? [{
            id: 'all-products',
            name: 'Cardápio',
            description: '',
            display_order: 0,
            products: filteredProducts
          }]
        : []);

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
    <div className="min-h-screen pb-24" style={{ backgroundColor: 'var(--menu-bg, #F7EEDF)' }}>
      <MarketingPixels userId={finalUserId} />
      <div className="relative">
        <div className="relative h-40 sm:h-48 w-full overflow-hidden" style={{ backgroundColor: 'var(--menu-secondary, #063D2E)' }}>
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
                <h1 className="text-lg sm:text-xl font-bold leading-tight" style={{ color: 'var(--menu-secondary, #063D2E)' }}>
                  {profile?.restaurant_name || 'Cardápio'}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className={storeOpenInfo.isOpen ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                    {storeOpenInfo.label}
                  </Badge>
                  <span className="text-xs font-medium text-gray-500">{storeOpenInfo.detail}</span>
                </div>
                {((profile as any)?.address || (profile as any)?.phone) && (
                  <div className="text-xs mt-1" style={{ color: 'var(--menu-secondary, #063D2E)', opacity: 0.8 }}>
                    {(profile as any)?.address ? String((profile as any).address) : ''}
                    {(profile as any)?.address && (profile as any)?.phone ? ' • ' : ''}
                    {(profile as any)?.phone ? String((profile as any).phone) : ''}
                  </div>
                )}
                {(profile as any)?.description && (
                  <div className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--menu-secondary, #063D2E)', opacity: 0.7 }}>
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
                  className="pl-10 pr-4 h-11 w-full rounded-full bg-white text-sm transition-all focus:ring-2"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--menu-primary, #85C441) 40%, #d1d5db)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.02)'
                  }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <div className="mt-4">
          <MarketingBanners
            restaurantId={finalUserId}
            linkedProducts={linkedProducts}
            onQuickAddProduct={handleQuickAddFromBanner}
            onSelectProductId={(productId) => {
              const p = (products as any[]).find((x: any) => String(x?.id) === String(productId));
              if (p) void handleProductClick(p as any);
            }}
          />
        </div>

        <div className="bg-transparent sticky top-0 z-40 mt-3 pb-2">
          {categories.length > 0 && (
            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          )}
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
              <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--menu-secondary, #063D2E)' }}>
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
        deliverySettings={deliverySettings}
        userId={finalUserId}
        isStoreOpen={storeOpenInfo.isOpen}
        storeClosedMessage={storeOpenInfo.detail}
      />

      {/* Clube de Vantagens removido conforme solicitação */}

      {/* Carrinho Fixo */}
      <CartBottomBar
        itemCount={getCartItemCount()}
        total={getCartTotal()}
        onOpenCart={() => {
          if (!storeOpenInfo.isOpen) {
            toast({
              title: 'Loja fechada',
              description: storeOpenInfo.detail,
              variant: 'destructive'
            });
            return;
          }
          setShowCartModal(true);
        }}
      />
    </div>
  );
};

export default MenuDigital;
