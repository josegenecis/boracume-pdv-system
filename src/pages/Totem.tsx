import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ChefHat,
  CreditCard,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useMenuData } from '@/hooks/useMenuData';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TotemCheckoutModal from '@/components/totem/TotemCheckoutModal';
import TotemProductCard from '@/components/totem/TotemProductCard';
import { useAuth } from '@/contexts/AuthContext';
import { PrinterService } from '@/utils/printerService';
import MarketingBanners from '@/components/marketing/MarketingBanners';
import MarketingPixels from '@/components/marketing/MarketingPixels';

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

const formatBRL = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Totem() {
  const { userId } = useParams();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const userIdFromQuery = queryParams.get('userId');
  const { user } = useAuth();
  const finalUserId = userId || userIdFromQuery || user?.id || '';

  const { toast } = useToast();
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartItemCount } = useSimpleCart();
  const { fetchVariations } = useSimpleVariations();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [started, setStarted] = useState(false);

  const { products, categories, isLoading: menuLoading, error: menuError } = useMenuData({ userId: finalUserId, enableCache: false });

  const categoryIds = categories.map((cat: any) => `category-${cat.id}`);
  const { activeSection, registerSection } = useScrollSpy(categoryIds);
  const itemCount = getCartItemCount();
  const total = getCartTotal();

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
    for (const c of categories as any[]) byCat[c.id] = [];
    for (const p of products as any[]) {
      const prod = p as Product;
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
      toast({ title: 'Erro', description: 'Totem nao configurado para este restaurante.', variant: 'destructive' });
      return;
    }
    try {
      await fetchVariations(product.id);
    } catch {}
    setStarted(true);
    setSelectedProduct(product);
    setShowVariationModal(true);
  };

  const handleAddToCartFromModal = (product: any, quantity: number, variations: string[], notes: string, variationPrice: number, optionDetails?: any[]) => {
    addToCart(product, quantity, variations, notes, variationPrice, optionDetails);
    setShowVariationModal(false);
    setSelectedProduct(null);
  };

  const handleNewSession = () => {
    clearCart();
    setSearchQuery('');
    setShowCheckoutModal(false);
    setStarted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!finalUserId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
        <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
          <div className="text-xl font-bold">Totem</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Acesse com /totem?userId=SEU_ID para vincular o restaurante.
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
    <div className="min-h-screen bg-[#fbf7ef] text-stone-950">
      <MarketingPixels userId={finalUserId} />

      {!started ? (
        <section className="relative min-h-screen overflow-hidden bg-[#073a2d] text-white">
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(239,108,32,0.65),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(133,196,65,0.7),transparent_30%),linear-gradient(135deg,#073a2d,#10261f)]" />
          </div>
          <div className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_520px]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white">
                <Utensils className="h-4 w-4" />
                Autoatendimento BoraCume
              </div>
              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
                  Faca seu pedido no seu ritmo
                </h1>
                <p className="max-w-2xl text-xl font-medium leading-relaxed text-white/82">
                  Escolha os produtos, personalize os adicionais, pague e retire no balcao com a senha do pedido.
                </p>
              </div>
              <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ['1', 'Escolha'],
                  ['2', 'Pague'],
                  ['3', 'Retire'],
                ].map(([step, label]) => (
                  <div key={step} className="rounded-lg border border-white/15 bg-white/10 p-4">
                    <div className="text-sm font-bold text-white/70">Passo {step}</div>
                    <div className="mt-1 text-2xl font-black">{label}</div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                onClick={() => setStarted(true)}
                className="h-20 rounded-lg bg-boracume-orange px-10 text-2xl font-black text-white shadow-2xl hover:bg-boracume-orange/90"
              >
                Tocar para comecar
                <ArrowRight className="ml-3 h-7 w-7" />
              </Button>
            </div>

            <div className="hidden space-y-4 lg:block">
              {featuredProducts.length > 0 ? (
                featuredProducts.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductClick(product)}
                    className="flex w-full items-center gap-4 rounded-lg border border-white/15 bg-white/10 p-4 text-left backdrop-blur transition hover:bg-white/15"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-2xl font-black text-[#073a2d]">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xl font-black">{product.name}</div>
                      <div className="mt-1 text-sm font-semibold text-white/70">{formatBRL(product.price)}</div>
                    </div>
                    <Sparkles className="h-6 w-6 text-boracume-orange" />
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-white/15 bg-white/10 p-8">
                  <ChefHat className="mb-4 h-10 w-10 text-boracume-orange" />
                  <div className="text-2xl font-black">Cardapio pronto para o cliente</div>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <div className={started ? 'block' : 'hidden'}>
        <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#073a2d] text-white">
                  <ShoppingBag className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-2xl font-black leading-tight text-[#073a2d]">Autoatendimento</div>
                  <div className="text-sm font-semibold text-stone-500">Pedido para retirada no balcao</div>
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
                    className={[
                      'h-12 shrink-0 rounded-lg border px-5 text-base font-extrabold transition',
                      selected
                        ? 'border-[#073a2d] bg-[#073a2d] text-white shadow'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300',
                    ].join(' ')}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 pb-28 lg:grid-cols-[1fr_390px] lg:px-6 lg:pb-8">
          <section className="min-w-0 space-y-8">
            <MarketingBanners
              restaurantId={finalUserId}
              onSelectProductId={(productId) => {
                const p = (products as any[]).find((x: any) => String(x?.id) === String(productId));
                if (p) void handleProductClick(p as any);
              }}
            />

            {menuLoading ? (
              <div className="rounded-lg border border-stone-200 bg-white p-8 text-lg font-bold text-stone-500">
                Carregando cardapio...
              </div>
            ) : visibleCategoryCount === 0 ? (
              <div className="rounded-lg border border-stone-200 bg-white p-8">
                <div className="text-2xl font-black text-stone-950">Nenhum produto encontrado</div>
                <div className="mt-2 text-stone-500">Tente buscar por outro nome.</div>
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
                          <h2 className="text-3xl font-black text-stone-950">{category.name}</h2>
                          {category.description ? (
                            <p className="mt-1 max-w-2xl text-base font-medium text-stone-500">{category.description}</p>
                          ) : null}
                        </div>
                        <div className="hidden rounded-full bg-white px-3 py-1 text-sm font-bold text-stone-500 shadow-sm lg:block">
                          {items.length} itens
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {items.map((product: Product) => (
                          <TotemProductCard key={product.id} product={product as any} onSelect={handleProductClick} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="sticky top-[154px] hidden h-[calc(100vh-178px)] rounded-lg border border-stone-200 bg-white shadow-sm lg:flex lg:flex-col">
            <div className="border-b border-stone-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold uppercase tracking-wide text-stone-400">Meu pedido</div>
                  <div className="text-2xl font-black text-stone-950">{itemCount} item{itemCount === 1 ? '' : 's'}</div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-boracume-orange text-white">
                  <ShoppingBag className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 p-6 text-center">
                  <ChefHat className="mb-3 h-10 w-10 text-stone-300" />
                  <div className="text-lg font-black text-stone-800">Seu pedido esta vazio</div>
                  <div className="mt-1 text-sm font-medium text-stone-500">Adicione um produto para finalizar.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item: any) => (
                    <div key={item.uniqueId} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-stone-950">{item.product.name}</div>
                          {item.variations?.length ? (
                            <div className="mt-1 line-clamp-2 text-xs font-medium text-stone-500">{item.variations.join(', ')}</div>
                          ) : null}
                          <div className="mt-2 text-lg font-black text-boracume-orange">{formatBRL(item.totalPrice)}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.uniqueId)} className="h-9 w-9 rounded-lg">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-lg bg-white"
                            onClick={() => updateQuantity(item.uniqueId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <div className="w-8 text-center text-lg font-black">{item.quantity}</div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-lg bg-white"
                            onClick={() => updateQuantity(item.uniqueId, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-stone-100 p-5">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-stone-500">Total</span>
                <span className="text-3xl font-black text-stone-950">{formatBRL(total)}</span>
              </div>
              <Button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setShowCheckoutModal(true)}
                className="h-16 w-full rounded-lg bg-boracume-orange text-xl font-black text-white hover:bg-boracume-orange/90"
              >
                <CreditCard className="mr-3 h-6 w-6" />
                Pagar pedido
              </Button>
              <Button type="button" variant="ghost" onClick={handleNewSession} className="h-11 w-full rounded-lg font-bold">
                Cancelar pedido
              </Button>
            </div>
          </aside>
        </main>
      </div>

      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        categoryConfig={categories.find((category: any) => category.id === selectedProduct?.category_id) as any}
        onAddToCart={handleAddToCartFromModal}
      />

      <TotemCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        userId={finalUserId}
        cart={cart as any}
        total={total}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onClearCart={clearCart}
      />

      <div className="lg:hidden">
        <CartBottomBar itemCount={itemCount} total={total} onOpenCart={() => setShowCheckoutModal(true)} />
      </div>
    </div>
  );
}
