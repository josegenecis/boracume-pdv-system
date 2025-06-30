
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleVariationModal } from '@/components/menu/SimpleVariationModal';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
}

interface SimpleProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, variations: string[], notes: string, variationPrice: number) => void;
}

const SimpleProductSelectionModal: React.FC<SimpleProductSelectionModalProps> = ({
  isOpen,
  onClose,
  onAddToCart
}) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchProducts();
    }
  }, [isOpen, user]);

  const fetchProducts = async () => {
    if (!user) return;

    try {
      console.log('🔄 PDV SIMPLES - Buscando produtos para o usuário:', user.id);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .eq('show_in_pdv', true)
        .eq('available', true)
        .order('name');

      if (error) throw error;
      
      console.log('📋 PDV SIMPLES - Produtos encontrados:', data?.length || 0);
      setProducts(data || []);
    } catch (error) {
      console.error('❌ PDV SIMPLES - Erro ao carregar produtos:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    console.log('🔄 PDV SIMPLES - Produto selecionado:', product.name, 'ID:', product.id);
    setSelectedProduct(product);
    setShowVariationModal(true);
  };

  const handleAddToCart = (product: Product, quantity: number, variations: string[], notes: string, variationPrice: number) => {
    console.log('🛒 PDV SIMPLES - Adicionando ao carrinho:', {
      product: product.name,
      quantity,
      variations: variations.length,
      notes,
      variationPrice
    });
    
    onAddToCart(product, quantity, variations, notes, variationPrice);
    setShowVariationModal(false);
    setSelectedProduct(null);
    onClose();
  };

  const handleCloseVariationModal = () => {
    setShowVariationModal(false);
    setSelectedProduct(null);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showVariationModal && selectedProduct) {
    return (
      <SimpleVariationModal
        isOpen={showVariationModal}
        onClose={handleCloseVariationModal}
        product={selectedProduct}
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

export default SimpleProductSelectionModal;
