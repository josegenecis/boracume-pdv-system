import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  Expand,
  LockKeyhole,
  Printer,
  Search,
  ShoppingBag,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import type { SelectedVariationDetail } from '@/hooks/useSimpleVariations';
import { useMenuData } from '@/hooks/useMenuData';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TotemCheckoutModal from '@/components/totem/TotemCheckoutModal';
import TotemCheckoutBar from '@/components/totem/TotemCheckoutBar';
import TotemIdleScreen from '@/components/totem/TotemIdleScreen';
import TotemProductCard from '@/components/totem/TotemProductCard';
import { useAuth } from '@/contexts/AuthContext';
import { PrinterService } from '@/utils/printerService';
import MarketingPixels from '@/components/marketing/MarketingPixels';
import { getSavedTotemRestaurantId, useTotemPwa } from '@/hooks/useTotemPwa';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTotemTheme } from '@/hooks/useTotemTheme';

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
  is_pizza?: boolean;
  pizza_half_price_mode?: 'highest' | 'split_halves';
}

export default function Totem() {
  const { userId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const userIdFromQuery = queryParams.get('userId');
  const { user } = useAuth();
  const [savedRestaurantId] = useState(getSavedTotemRestaurantId);
  const finalUserId = userId || userIdFromQuery || user?.id || savedRestaurantId || '';

  const { toast } = useToast();
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartItemCount } = useSimpleCart(finalUserId ? `totem:${finalUserId}` : 'totem');
  const clearCartRef = useRef(clearCart);
  const { fetchVariations } = useSimpleVariations();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [started, setStarted] = useState(false);
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number | null>(null);

  const { products, categories, profile, isLoading: menuLoading, error: menuError } = useMenuData({ userId: finalUserId, enableCache: true, cacheTTL: 60 });
  const { canInstall, install, isInstalled, isOnline, isFullscreen, toggleFullscreen } = useTotemPwa(finalUserId);
  const { settings: totemSettings, cssVariables } = useTotemTheme(finalUserId);

  const categoryIds = useMemo(() => categories.map((category) => `category-${category.id}`), [categories]);
  const { activeSection, registerSection } = useScrollSpy(categoryIds);
  const itemCount = getCartItemCount();
  const total = getCartTotal();

  useEffect(() => {
    clearCartRef.current = clearCart;
  }, [clearCart]);

  useEffect(() => {
    if (activeSection) {
      const categoryId = activeSection.replace('category-', '');
      setActiveCategory(categoryId);
    }
  }, [activeSection]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    if (itemCount > 0) setStarted(true);
  }, [itemCount]);

  const featuredProducts = useMemo(() => {
    return (products as Product[])
      .filter((product) => product?.is_available && (product.is_highlight || Number(product.order_count || 0) > 0))
      .sort((a, b) => Number(b.order_count || 0) - Number(a.order_count || 0))
      .slice(0, 3);
  }, [products]);

  const filteredProductsByCategory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byCat: Record<string, Product[]> = {};
    for (const c of categories as Category[]) byCat[c.id] = [];
    for (const prod of products as Product[]) {
      if (!prod?.is_available) continue;
      if (q) {
        const hay = `${prod.name} ${prod.description}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      if (!byCat[prod.category_id]) byCat[prod.category_id] = [];
      byCat[prod.category_id].push(prod);
    }
    return byCat;
  }, [products, categories, searchQuery]);

  const visibleCategoryCount = useMemo(() => {
    return (categories as Category[]).filter((category) => (filteredProductsByCategory[category.id] || []).length > 0).length;
  }, [categories, filteredProductsByCategory]);

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveCategory(categoryId);
    setStarted(true);
  };

  const handleProductClick = async (product: Product) => {
    if (!finalUserId) {
      toast({ title: 'Erro', description: 'Totem não configurado para este restaurante.', variant: 'destructive' });
      return;
    }
    try {
      await fetchVariations(product.id);
    } catch {
      // O modal ainda pode abrir sem adicionais quando a consulta falhar.
    }
    setStarted(true);
    setSelectedProduct(product);
    setShowVariationModal(true);
  };

  const handleAddToCartFromModal = (product: Product, quantity: number, variations: string[], notes: string, variationPrice: number, optionDetails?: SelectedVariationDetail[]) => {
    addToCart(product, quantity, variations, notes, variationPrice, optionDetails);
    setShowVariationModal(false);
    setSelectedProduct(null);
  };

  const handleNewSession = useCallback(() => {
    clearCartRef.current();
    setSearchQuery('');
    setShowCheckoutModal(false);
    setShowVariationModal(false);
    setSelectedProduct(null);
    setIdleSecondsLeft(null);
    setStarted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!started) {
      setIdleSecondsLeft(null);
      return;
    }

    let lastInteraction = Date.now();
    const resetIdle = () => {
      lastInteraction = Date.now();
      setIdleSecondsLeft(null);
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchstart', 'keydown'];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdle, { passive: true }));

    const interval = window.setInterval(() => {
      const idleSeconds = Math.floor((Date.now() - lastInteraction) / 1000);
      if (idleSeconds >= 180) {
        handleNewSession();
        return;
      }
      setIdleSecondsLeft(idleSeconds >= 150 ? 180 - idleSeconds : null);
    }, 1000);

    return () => {
      window.clearInterval(interval);
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdle));
    };
  }, [started, handleNewSession]);

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === 'unavailable') {
      toast({ title: 'Instalar Totem', description: 'No Chrome ou Edge, abra o menu do navegador e escolha “Instalar Totem PopSystem”.' });
    }
  };

  if (!finalUserId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#063d2e] p-6 text-white">
        <div className="w-full max-w-xl rounded-[28px] border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#063d2e]"><LockKeyhole className="h-8 w-8" /></div>
          <div className="mt-6 text-3xl font-black">Totem ainda não vinculado</div>
          <p className="mx-auto mt-3 max-w-md text-base font-medium leading-7 text-white/70">
            Entre no PopSystem como administrador e abra o link de instalação deste totem. O vínculo da loja ficará salvo neste equipamento.
          </p>
          <div className="mt-6 rounded-2xl bg-black/15 p-4 text-sm font-bold text-white/75">
            Endereço de configuração: /totem/ID-DA-LOJA
          </div>
        </div>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
        <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
          <div className="text-xl font-bold">Erro ao carregar</div>
          <div className="mt-2 text-sm text-muted-foreground">{String(menuError)}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        ...cssVariables,
        backgroundColor: 'var(--totem-background)',
        color: 'var(--totem-text)',
      } as CSSProperties}
    >
      <MarketingPixels userId={finalUserId} />

      {!started ? (
        <TotemIdleScreen
          restaurantId={finalUserId}
          profile={profile}
          featuredProducts={featuredProducts}
          isOnline={isOnline}
          isFullscreen={isFullscreen}
          isInstalled={isInstalled}
          canInstall={canInstall}
          settings={totemSettings}
          onStart={() => setStarted(true)}
          onInstall={() => void handleInstall()}
          onToggleFullscreen={() => void toggleFullscreen()}
        />
      ) : null}

      <div className={started ? 'block' : 'hidden'}>
        <header className="sticky top-0 z-40 border-b border-stone-200 shadow-sm backdrop-blur" style={{ backgroundColor: 'color-mix(in srgb, var(--totem-surface) 95%, transparent)' }}>
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                {profile?.logo_url ? <img src={profile.logo_url} alt="" className="h-14 w-14 rounded-xl border border-stone-200 bg-white object-contain p-1" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#073a2d] text-white"><ShoppingBag className="h-7 w-7" /></div>}
                <div>
                  <div className="text-2xl font-black leading-tight" style={{ color: 'var(--totem-secondary)' }}>{profile?.restaurant_name || 'Autoatendimento'}</div>
                  <div className="text-sm font-semibold text-stone-500">Peça, pague e retire no balcão</div>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-3 lg:max-w-3xl">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar produto"
                    className="h-14 rounded-lg border-stone-200 bg-stone-50 pl-12 text-lg font-semibold"
                  />
                </div>
                <Button
                  variant="outline"
                  className="hidden h-14 rounded-lg border-stone-200 px-4 font-bold lg:inline-flex"
                  onClick={async () => {
                    const ok = await PrinterService.connectUsb();
                    if (ok) toast({ title: 'Impressora conectada', description: 'Pronto para imprimir cupom.' });
                    else toast({ title: 'Falha ao conectar', description: 'Tente novamente.', variant: 'destructive' });
                  }}
                >
                  <Printer className="mr-2 h-5 w-5" />
                  Impressora
                </Button>
                <div className={`hidden h-14 items-center gap-2 rounded-xl border px-4 text-sm font-bold xl:flex ${isOnline ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
                  {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  {isOnline ? 'Online' : 'Offline'}
                </div>
                <Button variant="outline" size="icon" className="hidden h-14 w-14 rounded-xl lg:inline-flex" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}>
                  <Expand className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
              {(categories as Category[]).map((category) => {
                const selected = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => scrollToCategory(category.id)}
                    className={`h-12 shrink-0 rounded-lg border px-5 text-base font-extrabold transition ${selected ? 'shadow' : 'border-stone-200 hover:border-stone-300'}`}
                    style={selected
                      ? { borderColor: 'var(--totem-secondary)', backgroundColor: 'var(--totem-secondary)', color: 'var(--totem-button-text)' }
                      : { backgroundColor: 'var(--totem-surface)', color: 'var(--totem-text)' }}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="totem-menu-main mx-auto max-w-[1600px] px-4 py-6 pb-44 lg:px-6">
          <section className="min-w-0 space-y-8">
            {menuLoading ? (
              <div className="rounded-lg border border-stone-200 p-8 text-lg font-bold" style={{ backgroundColor: 'var(--totem-surface)', color: 'var(--totem-text)' }}>
                Carregando cardapio...
              </div>
            ) : visibleCategoryCount === 0 ? (
              <div className="rounded-lg border border-stone-200 p-8" style={{ backgroundColor: 'var(--totem-surface)', color: 'var(--totem-text)' }}>
                <div className="text-2xl font-black">Nenhum produto encontrado</div>
                <div className="mt-2 opacity-60">Tente buscar por outro nome.</div>
              </div>
            ) : (
              <div className="space-y-12">
                {(categories as Category[]).map((category) => {
                  const items = filteredProductsByCategory[category.id] || [];
                  if (items.length === 0) return null;
                  return (
                    <section
                      key={category.id}
                      id={`category-${category.id}`}
                      ref={(el) => registerSection(`category-${category.id}`, el)}
                      className="scroll-mt-40"
                    >
                      <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                          <h2 className="text-3xl font-black" style={{ color: 'var(--totem-text)' }}>{category.name}</h2>
                          {category.description ? (
                            <p className="mt-1 max-w-2xl text-base font-medium opacity-60" style={{ color: 'var(--totem-text)' }}>{category.description}</p>
                          ) : null}
                        </div>
                        <div className="hidden rounded-full bg-white px-3 py-1 text-sm font-bold text-stone-500 shadow-sm lg:block">
                          {items.length} itens
                        </div>
                      </div>

                      <div className="totem-product-grid grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {items.map((product: Product) => (
                          <TotemProductCard key={product.id} product={product} onSelect={handleProductClick} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>

        </main>

        <TotemCheckoutBar
          itemCount={itemCount}
          total={total}
          onCheckout={() => setShowCheckoutModal(true)}
          onCancel={handleNewSession}
        />
      </div>

      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        categoryConfig={(categories as Category[]).find((category) => category.id === selectedProduct?.category_id)}
        onAddToCart={handleAddToCartFromModal}
        presentation="totem"
      />

      <TotemCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        userId={finalUserId}
        cart={cart}
        total={total}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onClearCart={clearCart}
      />

      <Dialog open={idleSecondsLeft !== null}>
        <DialogContent className="max-w-lg rounded-[28px] border-0 p-8 text-center" onPointerDownOutside={(event) => event.preventDefault()}>
          <DialogTitle className="text-3xl font-black text-[#073a2d]">Você ainda está aí?</DialogTitle>
          <p className="mt-3 text-base font-medium leading-7 text-stone-600">
            Por segurança, este pedido será cancelado e o totem voltará ao início em
          </p>
          <div className="mx-auto my-6 flex h-28 w-28 items-center justify-center rounded-full bg-orange-50 text-5xl font-black text-boracume-orange">
            {idleSecondsLeft ?? 30}
          </div>
          <Button type="button" className="h-16 w-full rounded-2xl bg-[#073a2d] text-xl font-black text-white hover:bg-[#0a4b3a]" onClick={() => setIdleSecondsLeft(null)}>
            Continuar meu pedido
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
