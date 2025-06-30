
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ProductVariationModal from './ProductVariationModal';

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
  const [showVariationModal, setShowVariationModal] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchProducts();
    }
  }, [isOpen, user]);

  const fetchProducts = async () => {
    if (!user) return;

    try {
      console.log('🔄 PDV - Buscando produtos para o usuário:', user.id);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_in_pdv', true)
        .eq('available', true)
        .order('name');

      if (error) throw error;
      
      console.log('📋 PDV - Produtos encontrados:', data?.length || 0);
      setProducts(data || []);
    } catch (error) {
      console.error('❌ PDV - Erro ao carregar produtos:', error);
    }
  };

  const fetchProductVariations = async (productId: string) => {
    console.log('🔄 PDV - Buscando variações para produto:', productId);
    
    try {
      // Buscar variações específicas do produto
      const { data: productVariations, error: productError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      console.log('📋 PDV - Variações específicas encontradas:', productVariations?.length || 0);

      // Buscar variações globais associadas ao produto
      const { data: globalVariationLinks, error: globalError } = await supabase
        .from('product_global_variation_links')
        .select('global_variation_id')
        .eq('product_id', productId);

      console.log('📋 PDV - Links de variações globais:', globalVariationLinks?.length || 0);

      let globalVariations: any[] = [];
      if (globalVariationLinks && globalVariationLinks.length > 0) {
        const globalVariationIds = globalVariationLinks.map(link => link.global_variation_id);
        
        const { data: globalVars, error: globalVarError } = await supabase
          .from('global_variations')
          .select('*')
          .in('id', globalVariationIds);

        if (!globalVarError && globalVars) {
          globalVariations = globalVars;
          console.log('📋 PDV - Variações globais encontradas:', globalVariations.length);
        }
      }

      // Combinar todas as variações
      const allVariations = [
        ...(productVariations || []),
        ...globalVariations
      ];

      console.log('📋 PDV - Total de variações encontradas:', allVariations.length);
      
      if (allVariations.length === 0) {
        console.log('⚠️ PDV - Nenhuma variação encontrada para o produto');
        return [];
      }
      
      // Processar e formatar as variações
      const formattedVariations: ProductVariation[] = [];
      
      for (const item of allVariations) {
        try {
          console.log('🔄 PDV - Processando variação:', item.name);
          console.log('📄 PDV - Dados da variação:', JSON.stringify(item, null, 2));
          
          if (!item || !item.id || !item.name) {
            console.log('⚠️ PDV - Variação sem dados básicos');
            continue;
          }

          let processedOptions = [];
          
          // Processar opções com cuidado especial
          if (typeof item.options === 'string') {
            try {
              const parsed = JSON.parse(item.options);
              processedOptions = Array.isArray(parsed) ? parsed : [];
              console.log('📝 PDV - Opções parseadas de string:', processedOptions);
            } catch (parseError) {
              console.error('❌ PDV - Erro ao fazer parse das opções string:', parseError);
              continue;
            }
          } else if (Array.isArray(item.options)) {
            processedOptions = item.options;
            console.log('📝 PDV - Opções já são array:', processedOptions);
          } else if (item.options && typeof item.options === 'object') {
            processedOptions = Object.values(item.options);
            console.log('📝 PDV - Opções extraídas de objeto:', processedOptions);
          } else {
            console.log('⚠️ PDV - Opções em formato inválido:', typeof item.options);
            continue;
          }

          if (!Array.isArray(processedOptions) || processedOptions.length === 0) {
            console.log('⚠️ PDV - Nenhuma opção válida encontrada');
            continue;
          }

          // Validar e processar cada opção
          const validOptions = processedOptions
            .filter(opt => {
              const isValid = opt && 
                (opt.name || opt.option_name) && 
                String(opt.name || opt.option_name).trim().length > 0;
              
              if (!isValid) {
                console.log('⚠️ PDV - Opção inválida filtrada:', opt);
              }
              return isValid;
            })
            .map(opt => {
              const name = String(opt.name || opt.option_name || '').trim();
              const price = Number(opt.price || opt.option_price || 0);
              
              console.log('✅ PDV - Opção processada:', { name, price });
              
              return {
                name,
                price: price >= 0 ? price : 0
              };
            });

          if (validOptions.length === 0) {
            console.log('⚠️ PDV - Nenhuma opção válida após processamento');
            continue;
          }

          const formatted: ProductVariation = {
            id: String(item.id),
            name: String(item.name).trim(),
            options: validOptions,
            max_selections: Math.max(1, Number(item.max_selections) || 1),
            required: Boolean(item.required)
          };

          formattedVariations.push(formatted);
          console.log('✅ PDV - Variação formatada:', formatted.name, 'com', formatted.options.length, 'opções');
        } catch (itemError) {
          console.error('❌ PDV - Erro ao processar variação:', itemError);
        }
      }
      
      console.log('🎯 PDV - Variações finais formatadas:', formattedVariations.length);
      formattedVariations.forEach(v => {
        console.log(`📋 ${v.name}: ${v.options.length} opções - Obrigatório: ${v.required} - Max: ${v.max_selections}`);
      });
      
      return formattedVariations;
    } catch (error) {
      console.error('❌ PDV - Erro geral ao buscar variações:', error);
      return [];
    }
  };

  const handleProductSelect = async (product: Product) => {
    console.log('🔄 PDV - Produto selecionado:', product.name, 'ID:', product.id);
    setSelectedProduct(product);
    
    // Buscar variações do produto
    const variations = await fetchProductVariations(product.id);
    console.log('🔍 PDV - Variações encontradas para', product.name, ':', variations.length);
    
    if (variations.length > 0) {
      setProductVariations(variations);
      setShowVariationModal(true);
      console.log('✅ PDV - Abrindo modal de variações');
    } else {
      // Adicionar direto ao carrinho sem variações
      console.log('✅ PDV - Adicionando produto sem variações ao carrinho');
      onAddToCart(product, 1);
      onClose();
    }
  };

  const handleAddToCart = (product: Product, quantity: number, variations: any[], notes: string) => {
    console.log('🛒 PDV - Adicionando ao carrinho:', {
      product: product.name,
      quantity,
      variations: variations.length,
      notes
    });
    
    onAddToCart(product, quantity, variations, notes);
    setShowVariationModal(false);
    setSelectedProduct(null);
    onClose();
  };

  const handleCloseVariationModal = () => {
    setShowVariationModal(false);
    setSelectedProduct(null);
    setProductVariations([]);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showVariationModal && selectedProduct) {
    return (
      <ProductVariationModal
        isOpen={showVariationModal}
        onClose={handleCloseVariationModal}
        product={selectedProduct}
        variations={productVariations}
        onAddToCart={handleAddToCart}
      />
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
