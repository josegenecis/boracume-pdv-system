import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Package, Search, Edit, Trash2, Import, GripVertical, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProductForm from '@/components/products/ProductForm';
import MenuImportModal from '@/components/products/MenuImportModal';
import ProductVariationsButton from '@/components/products/ProductVariationsButton';
import GlobalVariationManager from '@/components/products/GlobalVariationManager';
import CategoryManager from '@/components/products/CategoryManager';
import { useSearchParams } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  category_id?: string;
  image_url?: string;
  available: boolean;
  weight_based: boolean;
  send_to_kds: boolean;
  show_in_pdv: boolean;
  show_in_delivery: boolean;
  display_order?: number;
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
}

interface Category {
  id: string;
  name: string;
}

const Products = () => {
  const normalizeImageUrl = (value?: string | null) => {
    const v = (value || '').trim();
    if (!v || v === 'null' || v === 'undefined' || v === '[object Object]') return '';
    if (v.startsWith('//')) return `https:${v}`;
    if (v.startsWith('http://')) return `https://${v.slice('http://'.length)}`;
    if (v.startsWith('https://') || v.startsWith('data:') || v.startsWith('blob:')) return v;
    if (v.includes('ifood-static.com.br') || v.includes('ifood-static.com')) return `https://${v}`;
    return '';
  };

  const FALLBACK_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [displayOrderSupported, setDisplayOrderSupported] = useState(true);
  const [tab, setTab] = useState<string>(() => {
    const t = searchParams.get('tab');
    return t === 'categories' || t === 'global-variations' || t === 'products' ? t : 'products';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = searchParams.get('tab');
    if (!t) return;
    if (t === tab) return;
    if (t === 'products' || t === 'categories' || t === 'global-variations') setTab(t);
  }, [searchParams, tab]);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(max-width: 639px)');
      const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        // @ts-ignore
        const matches = 'matches' in e ? e.matches : e.currentTarget?.matches;
        setIsMobile(!!matches);
      };
      setIsMobile(mq.matches);
      // @ts-ignore
      mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
      return () => {
        // @ts-ignore
        mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
      };
    } catch {}
  }, []);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory]);

  const fetchData = async () => {
    await Promise.all([fetchProducts(), fetchCategories()]);
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      let data: any = null;
      let error: any = null;

      const res1 = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      data = res1.data;
      error = res1.error;

      if (error && String(error.message || '').includes('display_order')) {
        setDisplayOrderSupported(false);
        const res2 = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user?.id)
          .order('name', { ascending: true });
        data = res2.data;
        error = res2.error;
      } else {
        setDisplayOrderSupported(true);
      }
      
      if (error) throw error;
      
      const transformedProducts = (data || []).map((product: any) => ({
        ...product,
        category: product.category || 'Sem categoria',
        show_in_pdv: product.show_in_pdv !== undefined ? product.show_in_pdv : true,
        show_in_delivery: product.show_in_delivery !== undefined ? product.show_in_delivery : true,
        weight_based: product.weight_based !== undefined ? product.weight_based : false,
        send_to_kds: product.send_to_kds !== undefined ? product.send_to_kds : false,
        track_stock: product.track_stock !== undefined ? product.track_stock : false,
        stock_quantity: product.stock_quantity !== undefined ? product.stock_quantity : 0,
        low_stock_threshold: product.low_stock_threshold !== undefined ? product.low_stock_threshold : 5
      })) as ProductItem[];
      
      setProducts(transformedProducts);
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os produtos.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
      // Auto-expand all categories initially
      setExpandedCategories(new Set((data || []).map((c: any) => c.id)));
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category_id === selectedCategory);
    }

    setFilteredProducts(filtered);
  };

  const canReorderProducts = displayOrderSupported;

  const persistProductOrder = async (ordered: ProductItem[]) => {
    try {
      const results = await Promise.all(
        ordered.map((p, idx) =>
          (supabase as any)
            .from('products')
            .update({ display_order: idx })
            .eq('id', p.id)
            .eq('user_id', user?.id)
        )
      );
      const firstError = results.find((r: any) => r?.error)?.error;
      if (firstError) throw firstError;
    } catch (e: any) {
      if (String(e?.message || '').includes('display_order')) setDisplayOrderSupported(false);
      toast({ title: 'Erro', description: e?.message || 'Falha ao salvar ordem', variant: 'destructive' });
      fetchProducts();
    }
  };

  const onProductsDragEnd = (result: DropResult) => {
    if (!canReorderProducts) return;
    if (!result.destination) return;
    
    // Check if dragging within the same category (droppableId)
    if (result.destination.droppableId !== result.source.droppableId) {
      toast({
        title: "Ação não permitida",
        description: "Não é possível mover produtos entre categorias ainda.",
        variant: "destructive"
      });
      return;
    }
    
    if (result.destination.index === result.source.index) return;

    // Identify category from droppableId "category-{id}"
    const categoryId = result.source.droppableId.replace('category-', '');
    
    // Get products for this category
    const categoryProducts = filteredProducts.filter(p => 
      categoryId === 'uncategorized' ? !p.category_id : p.category_id === categoryId
    );

    const newCategoryOrder = Array.from(categoryProducts);
    const [moved] = newCategoryOrder.splice(result.source.index, 1);
    newCategoryOrder.splice(result.destination.index, 0, moved);

    // Update global list while maintaining other products
    const otherProducts = filteredProducts.filter(p => 
      categoryId === 'uncategorized' ? !!p.category_id : p.category_id !== categoryId
    );

    // Reconstruct full list with updated order
    // Note: This simple reconstruction might lose global ordering if mixed. 
    // Ideally we update display_order for just the changed items relative to their category.
    // But since we persist global order, let's just update the local state and persist.
    
    // Strategy: Update display_order based on new position in category + offset
    // This is complex. Let's just update the specific products involved.
    
    // Simple approach: Update state immediately for UI responsiveness
    const updatedProducts = products.map(p => {
        // If it's one of the reordered products, find its new index in the category list
        // and assign a new temporary display_order or just rely on the array order.
        // For persistence, we need to be careful.
        return p; 
    });

    // Actually, let's just reorder the filtered list in memory for the UI
    // and call persist for the subset.
    
    // Find the global index range for this category to splice correctly? 
    // No, filteredProducts might be a subset.
    
    // Let's just update the order of the affected items in the database.
    persistProductOrder(newCategoryOrder);

    // Optimistic UI update
    // We need to update the 'products' state to reflect the new order within the category
    // This is tricky because 'products' is the source of truth.
    // Let's just fetchProducts after a short delay or rely on the fact that we're viewing filteredProducts.
    
    // For now, trigger a fetch to be safe and consistent
    // But to make it snappy, we can try to update local state:
    const newProducts = [...products];
    // This is hard without complex logic. Let's just wait for fetch.
    fetchProducts();
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
      
      toast({
        title: 'Produto excluído',
        description: 'O produto foi excluído com sucesso.',
      });
      
      fetchProducts();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir produto',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (productId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(productId); else next.delete(productId);
      return next;
    });
  };

  const bulkDeleteByCategory = async (categoryId: string) => {
    const ids = filteredProducts
      .filter(p => p.category_id === categoryId)
      .map(p => p.id)
      .filter(id => selectedIds.has(id));
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} produto(s) desta categoria?`)) return;
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', ids)
        .eq('user_id', user?.id);
      if (error) throw error;
      setSelectedIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      toast({ title: 'Exclusão concluída', description: `${ids.length} produto(s) removidos.` });
      fetchProducts();
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectCategory = (categoryId: string) => {
    const ids = filteredProducts.filter(p => p.category_id === categoryId).map(p => p.id);
    const allSelected = ids.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const bulkDeleteSelected = async () => {
    const ids = filteredProducts.map(p => p.id).filter(id => selectedIds.has(id));
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} produto(s) selecionados?`)) return;
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', ids)
        .eq('user_id', user?.id);
      if (error) throw error;
      clearSelection();
      toast({ title: 'Exclusão concluída', description: `${ids.length} produto(s) removidos.` });
      fetchProducts();
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  const handleEditProduct = (product: ProductItem) => {
    setEditingProduct(product);
    setIsSheetOpen(true);
    setShowForm(true);
  };

  const handleFormSubmit = async (savedProductId?: string) => {
    await fetchProducts();
    if (savedProductId) {
      const produtoSalvo = products.find(p => p.id === savedProductId);
      if (produtoSalvo) {
        setEditingProduct(produtoSalvo);
        setShowForm(true);
        return;
      }
    }
    
    setShowForm(false);
    setEditingProduct(null);
    setIsSheetOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Package className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Produtos</h1>
        </div>
        <div>
          <Button variant="outline" onClick={() => setShowImportModal(true)} className="mr-2">
            <Import className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={() => {
            setEditingProduct(null);
            setShowForm(true);
            setIsSheetOpen(true);
          }}>
            <Package className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      <MenuImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
        onImportComplete={fetchProducts}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', v);
            return next;
          });
        }}
        className="w-full"
      >
        <TabsList className="mb-2 flex flex-wrap sm:flex-nowrap overflow-x-auto scrollbar-hide">
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="global-variations">Variações Globais</TabsTrigger>
        </TabsList>
        
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar produtos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="sm:hidden w-full">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filtrar por categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="hidden sm:flex gap-2 flex-nowrap overflow-x-auto scrollbar-hide py-1">
                  <Button variant="outline" size="sm" className="shrink-0" onClick={selectAllFiltered}>
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={clearSelection}>
                    Limpar seleção
                  </Button>
                  <Button variant="destructive" size="sm" className="shrink-0" onClick={bulkDeleteSelected} disabled={filteredProducts.every(p => !selectedIds.has(p.id))}>
                    Excluir selecionados
                  </Button>
                  <Button
                    variant={selectedCategory === 'all' ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => setSelectedCategory('all')}
                  >
                    Todos
                  </Button>
                  {categories.map(category => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      size="sm"
                      className="shrink-0"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredProducts.length === 0 ? (
             <div className="text-center py-10 bg-white rounded-lg border">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900">Nenhum produto encontrado</h3>
                <p className="text-gray-500">Tente buscar por outro termo ou adicione um novo produto.</p>
             </div>
          ) : (
            <div className="space-y-4">
              <DragDropContext onDragEnd={onProductsDragEnd}>
                {categories.map(category => {
                  const categoryProducts = filteredProducts.filter(p => p.category_id === category.id);
                  if (categoryProducts.length === 0 && searchQuery) return null;
                  
                  const isExpanded = expandedCategories.has(category.id) || searchQuery !== '';

                  return (
                    <div key={category.id} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                      <div 
                        className="flex items-center p-3 cursor-pointer hover:bg-gray-50 bg-gray-50 border-b select-none transition-colors"
                        onClick={() => toggleCategory(category.id)}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 mr-2 text-gray-500" /> : <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />}
                        <Folder className="h-4 w-4 mr-2 text-orange-500" />
                        <span className="font-medium flex-1 text-gray-700">{category.name}</span>
                        <Badge variant="secondary" className="ml-2">{categoryProducts.length}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={(e) => { e.stopPropagation(); toggleSelectCategory(category.id); }}
                        >
                          {categoryProducts.every(p => selectedIds.has(p.id)) ? 'Desmarcar categoria' : 'Selecionar categoria'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={(e) => { e.stopPropagation(); bulkDeleteByCategory(category.id); }}
                          disabled={categoryProducts.every(p => !selectedIds.has(p.id))}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir selecionados
                        </Button>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-2 space-y-2 bg-slate-50/50">
                          {categoryProducts.length === 0 ? (
                            <div className="text-sm text-gray-400 text-center py-4 italic">Nenhum produto nesta categoria</div>
                          ) : (
                            <Droppable droppableId={`category-${category.id}`}>
                              {(droppableProvided) => (
                                <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps} className="space-y-2">
                                  {categoryProducts.map((product, index) => (
                                    <Draggable key={product.id} draggableId={product.id} index={index} isDragDisabled={!canReorderProducts}>
                                      {(draggableProvided) => (
                                        <div ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                                          <Card className={`overflow-hidden hover:shadow-md transition-all ${product.track_stock && product.stock_quantity <= product.low_stock_threshold ? 'border-l-4 border-l-red-500' : ''}`}>
                                            <CardContent className="p-3 cursor-pointer" onClick={() => handleEditProduct(product)}>
                                              <div className="flex items-center gap-3">
                                                <input
                                                  type="checkbox"
                                                  className="w-4 h-4"
                                                  checked={selectedIds.has(product.id)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  onChange={(e) => { e.stopPropagation(); toggleSelect(product.id, e.target.checked); }}
                                                />
                                                <button
                                                  type="button"
                                                  {...(canReorderProducts ? draggableProvided.dragHandleProps : {})}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className={`inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 text-muted-foreground ${canReorderProducts ? 'cursor-grab active:cursor-grabbing' : 'opacity-40 cursor-not-allowed'}`}
                                                >
                                                  <GripVertical className="h-4 w-4" />
                                                </button>
                                                {normalizeImageUrl(product.image_url) ? (
                                                  <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100 border">
                                                    <img
                                                      src={normalizeImageUrl(product.image_url)}
                                                      alt={product.name}
                                                      className="w-full h-full object-cover"
                                                      loading="lazy"
                                                      onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.src = FALLBACK_PIXEL;
                                                      }}
                                                    />
                                                  </div>
                                                ) : (
                                                  <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 border">
                                                    <Package className="h-5 w-5 text-gray-400" />
                                                  </div>
                                                )}
                                                
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h3 className="font-semibold text-sm leading-tight truncate flex-1 text-gray-800">{product.name}</h3>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                      <Badge variant={product.available ? "default" : "secondary"} className={`text-[10px] h-5 ${product.available ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                                                        {product.available ? 'Ativo' : 'Inativo'}
                                                      </Badge>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                      <div className="flex items-baseline gap-1">
                                                        <span className="text-sm font-bold text-gray-700">{formatCurrency(product.price)}</span>
                                                        {product.weight_based && <span className="text-[10px] text-muted-foreground">/kg</span>}
                                                      </div>
                                                      {product.track_stock && product.stock_quantity <= product.low_stock_threshold && (
                                                        <span className="text-[10px] text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">Estoque baixo: {product.stock_quantity}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                                
                                                <div className="flex flex-row flex-nowrap items-center gap-1 flex-shrink-0">
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}>
                                                    <Edit className="h-4 w-4" />
                                                  </Button>
                                                  <div onClick={(e) => e.stopPropagation()}>
                                                    <ProductVariationsButton productId={product.id} compact />
                                                  </div>
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {droppableProvided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Products without category */}
                {filteredProducts.filter(p => !p.category_id).length > 0 && (
                   <div className="border rounded-lg bg-white overflow-hidden mt-4 shadow-sm">
                      <div 
                        className="flex items-center p-3 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleCategory('uncategorized')}
                      >
                        {expandedCategories.has('uncategorized') ? <ChevronDown className="h-4 w-4 mr-2 text-gray-500" /> : <ChevronRight className="h-4 w-4 mr-2 text-gray-500" />}
                        <Folder className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="font-medium flex-1 text-gray-700">Sem Categoria</span>
                        <Badge variant="secondary" className="ml-2">{filteredProducts.filter(p => !p.category_id).length}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const uncategorizedIds = filteredProducts.filter(p => !p.category_id).map(p => p.id);
                            const allSelected = uncategorizedIds.every(id => selectedIds.has(id));
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (allSelected) uncategorizedIds.forEach(id => next.delete(id));
                              else uncategorizedIds.forEach(id => next.add(id));
                              return next;
                            });
                          }}
                        >
                          {filteredProducts.filter(p => !p.category_id).every(p => selectedIds.has(p.id)) ? 'Desmarcar categoria' : 'Selecionar categoria'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const ids = filteredProducts.filter(p => !p.category_id).map(p => p.id).filter(id => selectedIds.has(id));
                            if (ids.length === 0) return;
                            if (!confirm(`Excluir ${ids.length} produto(s) desta categoria?`)) return;
                            (async () => {
                              try {
                                setIsLoading(true);
                                const { error } = await supabase
                                  .from('products')
                                  .delete()
                                  .in('id', ids)
                                  .eq('user_id', user?.id);
                                if (error) throw error;
                                setSelectedIds(prev => {
                                  const next = new Set(prev);
                                  ids.forEach(id => next.delete(id));
                                  return next;
                                });
                                toast({ title: 'Exclusão concluída', description: `${ids.length} produto(s) removidos.` });
                                fetchProducts();
                              } catch (e: any) {
                                toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
                              } finally {
                                setIsLoading(false);
                              }
                            })();
                          }}
                          disabled={filteredProducts.filter(p => !p.category_id).every(p => !selectedIds.has(p.id))}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir selecionados
                        </Button>
                      </div>
                      
                      {expandedCategories.has('uncategorized') && (
                        <div className="p-2 space-y-2 bg-slate-50/50">
                          <Droppable droppableId="category-uncategorized">
                            {(droppableProvided) => (
                              <div ref={droppableProvided.innerRef} {...droppableProvided.droppableProps} className="space-y-2">
                                {filteredProducts.filter(p => !p.category_id).map((product, index) => (
                                  <Draggable key={product.id} draggableId={product.id} index={index} isDragDisabled={!canReorderProducts}>
                                    {(draggableProvided) => (
                                      <div ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                                         <Card className={`overflow-hidden hover:shadow-md transition-all ${product.track_stock && product.stock_quantity <= product.low_stock_threshold ? 'border-l-4 border-l-red-500' : ''}`}>
                                            <CardContent className="p-3 cursor-pointer" onClick={() => handleEditProduct(product)}>
                                              <div className="flex items-center gap-3">
                                                <input
                                                  type="checkbox"
                                                  className="w-4 h-4"
                                                  checked={selectedIds.has(product.id)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  onChange={(e) => { e.stopPropagation(); toggleSelect(product.id, e.target.checked); }}
                                                />
                                                <button
                                                  type="button"
                                                  {...(canReorderProducts ? draggableProvided.dragHandleProps : {})}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className={`inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 text-muted-foreground ${canReorderProducts ? 'cursor-grab active:cursor-grabbing' : 'opacity-40 cursor-not-allowed'}`}
                                                >
                                                  <GripVertical className="h-4 w-4" />
                                                </button>
                                                {normalizeImageUrl(product.image_url) ? (
                                                  <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100 border">
                                                    <img
                                                      src={normalizeImageUrl(product.image_url)}
                                                      alt={product.name}
                                                      className="w-full h-full object-cover"
                                                      loading="lazy"
                                                      onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.src = FALLBACK_PIXEL;
                                                      }}
                                                    />
                                                  </div>
                                                ) : (
                                                  <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 border">
                                                    <Package className="h-5 w-5 text-gray-400" />
                                                  </div>
                                                )}
                                                
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h3 className="font-semibold text-sm leading-tight truncate flex-1 text-gray-800">{product.name}</h3>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                      <Badge variant={product.available ? "default" : "secondary"} className={`text-[10px] h-5 ${product.available ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                                                        {product.available ? 'Ativo' : 'Inativo'}
                                                      </Badge>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                      <div className="flex items-baseline gap-1">
                                                        <span className="text-sm font-bold text-gray-700">{formatCurrency(product.price)}</span>
                                                        {product.weight_based && <span className="text-[10px] text-muted-foreground">/kg</span>}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                                
                                                <div className="flex flex-row flex-nowrap items-center gap-1 flex-shrink-0">
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}>
                                                    <Edit className="h-4 w-4" />
                                                  </Button>
                                                  <div onClick={(e) => e.stopPropagation()}>
                                                    <ProductVariationsButton productId={product.id} compact />
                                                  </div>
                                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            </CardContent>
                                          </Card>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {droppableProvided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )}
                   </div>
                )}
              </DragDropContext>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="global-variations">
          <GlobalVariationManager />
        </TabsContent>
        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>
        
      </Tabs>

      <Sheet open={isSheetOpen} onOpenChange={(o) => { setIsSheetOpen(o); if (!o) { setShowForm(false); setEditingProduct(null) } }}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <div className="sticky top-0 z-10 bg-white border-b p-4">
            <SheetHeader>
              <SheetTitle>{editingProduct?.id ? 'Editar produto' : 'Novo produto'}</SheetTitle>
            </SheetHeader>
          </div>
          {showForm && (
            <div className="px-4 pb-6 overflow-y-auto max-h-[calc(100vh-64px)]">
              <ProductForm
                product={editingProduct || undefined}
                onSave={handleFormSubmit}
                onCancel={() => { setIsSheetOpen(false); setShowForm(false); setEditingProduct(null); }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Products;
