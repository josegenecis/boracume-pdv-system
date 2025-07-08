
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
    try {
      console.log('🔍 PDV - Buscando variações para produto:', productId);
      
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('name');

      if (error) {
        console.error('❌ PDV - Erro ao buscar variações:', error);
        throw error;
      }
      
      console.log('📋 PDV - Variações encontradas (raw):', data);
      
      if (!data || data.length === 0) {
        console.log('⚠️ PDV - Nenhuma variação encontrada para o produto');
        return [];
      }

      const processedVariations = data.map(variation => {
        console.log('🔄 PDV - Processando variação:', variation.name, 'Options:', variation.options);
        
        let parsedOptions = [];
        try {
          if (typeof variation.options === 'string') {
            parsedOptions = JSON.parse(variation.options);
          } else if (Array.isArray(variation.options)) {
            parsedOptions = variation.options;
          }
        } catch (e) {
          console.error('❌ PDV - Erro ao fazer parse das opções:', e);
          parsedOptions = [];
        }

        const processedVariation = {
          id: variation.id,
          name: variation.name,
          required: variation.required || false,
          max_selections: variation.max_selections || 1,
          options: Array.isArray(parsedOptions) ? parsedOptions : []
        };
        
        console.log('✅ PDV - Variação processada:', processedVariation);
        return processedVariation;
      });
      
      console.log('🎯 PDV - Total de variações processadas:', processedVariations.length);
      return processedVariations;
    } catch (error) {
      console.error('❌ PDV - Erro geral ao carregar variações:', error);
      return [];
    }
  };

  const handleProductSelect = async (product: Product) => {
    console.log('🚀 PDV - CLICK NO PRODUTO:', product.name, 'ID:', product.id);
    setSelectedProduct(product);
    
    // Buscar variações do produto
    const variations = await fetchProductVariations(product.id);
    console.log('🔍 PDV - Variações retornadas:', variations);
    
    if (variations && variations.length > 0) {
      console.log('✅ PDV - PRODUTO TEM VARIAÇÕES! Total:', variations.length);
      setProductVariations(variations);
      setShowVariations(true);
    } else {
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
