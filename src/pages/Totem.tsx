import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useSimpleCart } from '@/hooks/useSimpleCart';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { useMenuData } from '@/hooks/useMenuData';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';
import CategoryTabs from '@/components/menu/CategoryTabs';
import CartBottomBar from '@/components/menu/CartBottomBar';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import TotemCheckoutModal from '@/components/totem/TotemCheckoutModal';
import TotemProductCard from '@/components/totem/TotemProductCard';
import { useAuth } from '@/contexts/AuthContext';

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

  const { products, categories, isLoading: menuLoading, error: menuError } = useMenuData({ userId: finalUserId, enableCache: false });

  const categoryIds = categories.map((cat: any) => `category-${cat.id}`);
  const { activeSection, registerSection } = useScrollSpy(categoryIds);

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

  const handleProductClick = async (product: Product) => {
    if (!finalUserId) {
      toast({ title: 'Erro', description: 'Totem não configurado para este restaurante.', variant: 'destructive' });
      return;
    }
    try {
      await fetchVariations(product.id);
    } catch {}
    setSelectedProduct(product);
    setShowVariationModal(true);
  };

  const handleAddToCartFromModal = (product: any, quantity: number, variations: string[], notes: string, variationPrice: number) => {
    addToCart(product, quantity, variations, notes, variationPrice);
    setShowVariationModal(false);
    setSelectedProduct(null);
  };

  if (!finalUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl border p-6 max-w-md w-full">
          <div className="text-xl font-bold">Totem</div>
          <div className="text-sm text-muted-foreground mt-2">
            Acesse com /totem?userId=SEU_ID para vincular o restaurante.
          </div>
        </div>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl border p-6 max-w-md w-full">
          <div className="text-xl font-bold">Erro ao carregar</div>
          <div className="text-sm text-muted-foreground mt-2">{String(menuError)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-40 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="text-white">
              <div className="text-2xl font-extrabold tracking-tight">Autoatendimento</div>
              <div className="text-white/90 text-sm">Escolha seus produtos, pague e retire no balcão</div>
            </div>

            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produto..."
                  className="pl-9 bg-white/15 border-white/20 placeholder:text-white/70 text-white focus-visible:ring-white/30"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white">
          <CategoryTabs categories={categories as any} activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 pb-28">
        {menuLoading ? (
          <div className="text-muted-foreground">Carregando cardápio...</div>
        ) : (
          <div className="space-y-10">
            {(categories as any[]).map((category: Category) => {
              const items = filteredProductsByCategory[category.id] || [];
              if (items.length === 0) return null;
              return (
                <div
                  key={category.id}
                  id={`category-${category.id}`}
                  ref={(el) => registerSection(`category-${category.id}`, el)}
                  className="scroll-mt-28"
                >
                  <div className="flex items-end justify-between gap-4 mb-4">
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900">{category.name}</div>
                      {category.description ? (
                        <div className="text-sm text-muted-foreground mt-1">{category.description}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {items.map((product: Product) => (
                      <TotemProductCard key={product.id} product={product as any} onSelect={handleProductClick} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={() => {
          setShowVariationModal(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        onAddToCart={handleAddToCartFromModal}
      />

      <TotemCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        userId={finalUserId}
        cart={cart as any}
        total={getCartTotal()}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onClearCart={clearCart}
      />

      <CartBottomBar itemCount={getCartItemCount()} total={getCartTotal()} onOpenCart={() => setShowCheckoutModal(true)} />
    </div>
  );
}
