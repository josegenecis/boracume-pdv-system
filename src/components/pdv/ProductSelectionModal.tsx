
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  available: boolean;
  category_id?: string;
  description?: string;
  weight_based?: boolean;
  send_to_kds?: boolean;
}

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: Array<{name: string; price: number}>;
}

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, options: string[], notes: string) => void;
}

const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  isOpen,
  onClose,
  onAddToCart
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && user) {
      fetchProducts();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (selectedProduct) {
      fetchProductVariations(selectedProduct.id);
    }
  }, [selectedProduct]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user?.id)
        .eq('available', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProductVariations = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId);

      if (error) throw error;
      
      // Parse the options JSON safely
      const parsedVariations: ProductVariation[] = (data || []).map(variation => ({
        id: variation.id,
        name: variation.name,
        required: variation.required,
        max_selections: variation.max_selections,
        options: typeof variation.options === 'string' 
          ? JSON.parse(variation.options) 
          : Array.isArray(variation.options) 
            ? variation.options as Array<{name: string; price: number}>
            : []
      }));
      
      setVariations(parsedVariations);
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
      setVariations([]);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSelectedOptions([]);
    setQuantity(1);
    setNotes('');
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    onAddToCart(selectedProduct, quantity, selectedOptions, notes);
    
    // Reset form
    setSelectedProduct(null);
    setSelectedOptions([]);
    setQuantity(1);
    setNotes('');
    
    toast({
      title: "Produto adicionado",
      description: `${selectedProduct.name} foi adicionado ao carrinho.`,
    });
  };

  const handleBack = () => {
    setSelectedProduct(null);
    setSelectedOptions([]);
    setQuantity(1);
    setNotes('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getTotalPrice = () => {
    if (!selectedProduct) return 0;
    return selectedProduct.price * quantity;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedProduct ? `Adicionar ${selectedProduct.name}` : 'Selecionar Produto'}
          </DialogTitle>
        </DialogHeader>

        {!selectedProduct ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleProductSelect(product)}
                  >
                    <div className="aspect-square relative overflow-hidden rounded-t-lg">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">Sem imagem</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(product.price)}
                        {product.weight_based && <span className="text-xs text-gray-500 ml-1">/kg</span>}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!loading && filteredProducts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                {selectedProduct.image_url ? (
                  <img 
                    src={selectedProduct.image_url} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">Sem imagem</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{selectedProduct.name}</h3>
                <p className="text-2xl font-bold text-primary mt-2">
                  {formatCurrency(selectedProduct.price)}
                  {selectedProduct.weight_based && <span className="text-sm text-gray-500 ml-1">/kg</span>}
                </p>
                {selectedProduct.description && (
                  <p className="text-gray-600 mt-2">{selectedProduct.description}</p>
                )}
              </div>
            </div>

            {variations.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Opções</h4>
                {variations.map((variation) => (
                  <div key={variation.id} className="space-y-2">
                    <Label className="font-medium">
                      {variation.name}
                      {variation.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <div className="space-y-2">
                      {variation.options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type={variation.max_selections === 1 ? "radio" : "checkbox"}
                            name={variation.id}
                            value={option.name}
                            onChange={(e) => {
                              if (variation.max_selections === 1) {
                                setSelectedOptions(prev => 
                                  prev.filter(opt => !variation.options.some(o => o.name === opt))
                                    .concat(e.target.checked ? [option.name] : [])
                                );
                              } else {
                                setSelectedOptions(prev => 
                                  e.target.checked 
                                    ? [...prev, option.name]
                                    : prev.filter(opt => opt !== option.name)
                                );
                              }
                            }}
                          />
                          <Label className="flex-1">
                            {option.name}
                            {option.price > 0 && (
                              <span className="ml-2 text-green-600">
                                +{formatCurrency(option.price)}
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="quantity">Quantidade</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus size={16} />
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center"
                    min="1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações especiais..."
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="text-lg font-bold">Total:</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(getTotalPrice())}
              </span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleAddToCart} className="flex-1">
                <Plus size={16} className="mr-2" />
                Adicionar ao Carrinho
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelectionModal;
