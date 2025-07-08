
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductVariationSelector from './ProductVariationSelector';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
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

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, variations?: any[], notes?: string) => void;
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
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [showVariations, setShowVariations] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchProducts();
    }
  }, [isOpen, user]);

  const fetchProducts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_in_pdv', true)
        .eq('available', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const fetchProductVariations = async (productId: string) => {
    console.log('🔄 PDV - Iniciando busca de variações para produto:', productId);
    
    try {
      // Buscar variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      console.log('📋 PDV - Variações específicas encontradas:', {
        data: productVariations,
        error: productError,
        count: productVariations?.length || 0
      });

      // Buscar IDs das variações globais associadas ao produto
      const { data: globalVariationLinks, error: globalLinksError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      console.log('📋 PDV - Links de variações globais:', {
        data: globalVariationLinks,
        error: globalLinksError,
        count: globalVariationLinks?.length || 0
      });

      // Buscar dados das variações globais se existirem links
      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = globalVariationLinks.map(link => link.global_variation_id);
        console.log('🔍 PDV - IDs das variações globais a buscar:', globalVariationIds);
        
        const { data: globalVars, error: globalVarsError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        console.log('📋 PDV - Variações globais encontradas:', {
          data: globalVars,
          error: globalVarsError,
          count: globalVars?.length || 0
        });

        if (!globalVarsError && globalVars) {
          globalVariations = globalVars;
        }
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];

      console.log('🔄 PDV - Combinando variações:', {
        especificas: productVariations?.length || 0,
        globais: globalVariations.length,
        total: allVariations.length,
        dados: allVariations
      });
      
      // Processar e formatar as variações
      const formattedVariations: ProductVariation[] = [];
      
      for (const item of allVariations) {
        console.log('🔄 PDV - Processando variação:', item.name, item);
        
        try {
          // Verificar se tem dados básicos válidos
          if (!item || !item.id || !item.name) {
            console.log('⚠️ PDV - Variação sem dados básicos:', item);
            continue;
          }

          // Verificar se tem opções válidas
          if (!item.options || !Array.isArray(item.options) || item.options.length === 0) {
            console.log('⚠️ PDV - Variação sem opções válidas:', item.name);
            continue;
          }

          // Processar opções
          const validOptions = item.options
            .filter((opt: any) => opt && opt.name && String(opt.name).trim().length > 0)
            .map((opt: any) => ({
              name: String(opt.name).trim(),
              price: Number(opt.price) >= 0 ? Number(opt.price) : 0
            }));

          if (validOptions.length === 0) {
            console.log('⚠️ PDV - Nenhuma opção válida encontrada para:', item.name);
            continue;
          }

          const formatted: ProductVariation = {
            id: item.id,
            name: String(item.name || '').trim(),
            options: validOptions,
            max_selections: Math.max(1, Number(item.max_selections) || 1),
            required: Boolean(item.required)
          };

          formattedVariations.push(formatted);
          console.log('✅ PDV - Variação processada:', formatted.name, 'com', formatted.options.length, 'opções válidas');
        } catch (itemError) {
          console.error('❌ PDV - Erro ao processar variação:', itemError, item);
        }
      }
      
      console.log('🎯 PDV - RESULTADO FINAL:', {
        total: formattedVariations.length,
        variações: formattedVariations.map(v => ({ name: v.name, opções: v.options.length }))
      });
      
      return formattedVariations;
    } catch (error) {
      console.error('❌ PDV - Erro geral ao carregar variações:', error);
      return [];
    }
  };

  const handleProductSelect = async (product: Product) => {
    console.log('🚀 PDV - CLICK NO PRODUTO:', product.name, 'ID:', product.id);
    setSelectedProduct(product);
    
    // Check if product has variations
    const variations = await fetchProductVariations(product.id);
    console.log('🔍 PDV - Variações encontradas:', variations.length);
    
    if (variations.length > 0) {
      console.log('✅ PDV - PRODUTO TEM VARIAÇÕES! Abrindo modal...');
      setProductVariations(variations);
      setShowVariations(true);
    } else {
      // Add directly to cart without variations
      console.log('➡️ PDV - Produto sem variações, adicionando direto ao carrinho');
      onAddToCart(product, 1);
      onClose();
    }
  };

  const handleAddToCart = (product: Product, quantity: number, variations: any[], notes: string) => {
    console.log('🔄 PDV - Adicionando produto personalizado ao carrinho:', {
      product: product.name,
      quantity,
      variations,
      notes
    });
    
    onAddToCart(product, quantity, variations, notes);
    setShowVariations(false);
    setSelectedProduct(null);
    onClose();
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <Card 
                  key={product.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelectionModal;
