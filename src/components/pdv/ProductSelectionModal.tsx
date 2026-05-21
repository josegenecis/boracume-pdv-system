import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductVariationSelector from './ProductVariationSelector';
import type { PizzaCategoryConfig } from '@/lib/pizza-pricing';
import { prefetchSimpleVariations, type Variation } from '@/hooks/useSimpleVariations';
import { enrichCategoryWithMetadata } from '@/lib/category-metadata';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
  track_stock: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
}

interface CategoryConfig extends PizzaCategoryConfig {
  id: string;
  name: string;
}

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, variations?: any[], notes?: string, variationPrice?: number) => void;
}

const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  isOpen,
  onClose,
  onAddToCart
}) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariations, setProductVariations] = useState<Variation[]>([]);
  const [categories, setCategories] = useState<CategoryConfig[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [showVariations, setShowVariations] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchProducts();
      fetchCategories();
      setSearchTerm('');
      setSelectedCategoryId('all');
    }
  }, [isOpen, user]);

  const fetchProducts = async () => {
    if (!user) return;

    try {
      let data: any = null;
      let error: any = null;

      const res1 = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_in_pdv', true)
        .eq('available', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      data = res1.data;
      error = res1.error;

      if (error && String(error.message || '').includes('display_order')) {
        const res2 = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id)
          .eq('show_in_pdv', true)
          .eq('available', true)
          .order('name', { ascending: true });
        data = res2.data;
        error = res2.error;
      }

      if (error) throw error;
      const transformed = (data || []).map((p: any) => ({
        ...p,
        track_stock: p.track_stock !== undefined ? p.track_stock : false,
        stock_quantity: p.stock_quantity !== undefined ? p.stock_quantity : 0,
        low_stock_threshold: p.low_stock_threshold !== undefined ? p.low_stock_threshold : 5,
      })) as Product[];
      setProducts(transformed);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, description')
        .eq('user_id', user.id)
        .eq('active', true);

      if (error) throw error;
      setCategories(((data || []) as any[]).map((category) => enrichCategoryWithMetadata(category)) as CategoryConfig[]);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      setCategories([]);
    }
  };

  const fetchProductVariations = async (productId: string) => {
    try {
      return await prefetchSimpleVariations(productId);
      let data: any[] | null = null;
      let error: any = null;
      const res1 = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });
      data = res1.data as any;
      error = res1.error as any;
      if (error && String(error.message || '').includes('display_order')) {
        const res2 = await supabase
          .from('product_variations')
          .select('*')
          .eq('product_id', productId)
          .order('name', { ascending: true });
        data = res2.data as any;
        error = res2.error as any;
      }

      if (error) throw error;
      
      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        required: item.required,
        max_selections: item.max_selections,
        options: Array.isArray(item.options) ? 
          item.options.map((opt: any) => ({
            name: opt.name || '',
            price: opt.price || 0
          })) : []
      }));
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
      return [];
    }
  };

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    
    const variations = await fetchProductVariations(product.id);
    
    if (variations.length > 0) {
      setProductVariations(variations);
      setShowVariations(true);
    } else {
      onAddToCart(product, 1);
      onClose();
    }
  };

  const handleAddToCart = (product: Product, quantity: number, variations: any[], notes: string, variationPrice: number) => {
    onAddToCart(product, quantity, variations, notes, variationPrice);
    setShowVariations(false);
    setSelectedProduct(null);
    onClose();
  };

  const categoriesWithProducts = categories.filter((category) =>
    products.some((product) => product.category_id === category.id)
  );

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategoryId === 'all' || product.category_id === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  if (showVariations && selectedProduct) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizar Produto</DialogTitle>
          </DialogHeader>
          <ProductVariationSelector
            product={selectedProduct}
            variations={productVariations}
            categoryConfig={categories.find((category) => category.id === selectedProduct.category_id)}
            onAddToCart={handleAddToCart}
            onClose={() => {
              setShowVariations(false);
              setSelectedProduct(null);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Selecionar Produto</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {categoriesWithProducts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                type="button"
                variant={selectedCategoryId === 'all' ? 'default' : 'outline'}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedCategoryId('all')}
              >
                Todos
              </Button>
              {categoriesWithProducts.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  variant={selectedCategoryId === category.id ? 'default' : 'outline'}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                (() => {
                  const isLowStock = product.track_stock && product.stock_quantity <= product.low_stock_threshold;
                  return (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer hover:shadow-lg transition-shadow ${isLowStock ? 'animate-stock-pulse border-red-500' : ''}`}
                  onClick={() => handleProductSelect(product)}
                >
                  <CardContent className="p-4">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-32 object-cover rounded-md mb-3"
                      />
                    )}
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">{product.name}</h3>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          R$ {product.price.toFixed(2)}
                        </Badge>
                        {isLowStock && (
                          <Badge variant="destructive" className="text-xs">
                            Estoque baixo
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                  );
                })()
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelectionModal;
