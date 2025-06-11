
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
  available: boolean;
}

interface VariationOption {
  name: string;
  price: number;
}

interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: VariationOption[];
}

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, selectedOptions: string[], notes: string) => void;
  product?: Product;
  variations?: ProductVariation[];
}

const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  isOpen,
  onClose,
  onAddToCart,
  product: propProduct,
  variations: propVariations = []
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(propProduct || null);
  const [variations, setVariations] = useState<ProductVariation[]>(propVariations);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();

  // Update state when props change
  useEffect(() => {
    if (propProduct) {
      setSelectedProduct(propProduct);
      setVariations(propVariations);
      setQuantity(1);
      setSelectedOptions({});
      setNotes('');
    }
  }, [propProduct, propVariations]);

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
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductVariations = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('name');

      if (error) throw error;
      
      const transformedData = (data || []).map(item => {
        let parsedOptions = [];
        try {
          if (typeof item.options === 'string') {
            parsedOptions = JSON.parse(item.options);
          } else if (Array.isArray(item.options)) {
            parsedOptions = item.options;
          }
        } catch (e) {
          console.error('Error parsing options:', e);
          parsedOptions = [];
        }

        return {
          id: item.id,
          name: item.name,
          required: item.required,
          max_selections: item.max_selections,
          options: Array.isArray(parsedOptions) ? parsedOptions : []
        };
      });
      
      return transformedData;
    } catch (error) {
      console.error('Erro ao carregar variações:', error);
      return [];
    }
  };

  useEffect(() => {
    if (isOpen && user && !propProduct) {
      fetchProducts();
    }
  }, [isOpen, user, propProduct]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProductClick = async (product: Product) => {
    const productVariations = await fetchProductVariations(product.id);
    
    setSelectedProduct(product);
    setVariations(productVariations);
    setQuantity(1);
    setSelectedOptions({});
    setNotes('');
  };

  const handleVariationChange = (variationId: string, optionName: string, checked: boolean) => {
    const variation = variations.find(v => v.id === variationId);
    if (!variation) return;

    setSelectedOptions(prev => {
      const current = prev[variationId] || [];
      
      if (variation.max_selections === 1) {
        return { ...prev, [variationId]: checked ? [optionName] : [] };
      } else {
        if (checked) {
          if (current.length < variation.max_selections) {
            return { ...prev, [variationId]: [...current, optionName] };
          }
          return prev;
        } else {
          return { ...prev, [variationId]: current.filter(opt => opt !== optionName) };
        }
      }
    });
  };

  const isVariationValid = (variation: ProductVariation) => {
    const selected = selectedOptions[variation.id] || [];
    return !variation.required || selected.length > 0;
  };

  const canAddToCart = () => {
    return variations.every(variation => isVariationValid(variation));
  };

  const getTotalPrice = () => {
    if (!selectedProduct) return 0;
    
    let total = selectedProduct.price;
    
    variations.forEach(variation => {
      const selected = selectedOptions[variation.id] || [];
      selected.forEach(optionName => {
        const option = variation.options.find(opt => opt.name === optionName);
        if (option) {
          total += option.price;
        }
      });
    });
    
    return total * quantity;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleAddToCart = () => {
    if (!selectedProduct || !canAddToCart()) return;

    const formattedOptions = variations.map(variation => {
      const selected = selectedOptions[variation.id] || [];
      return selected.map(optionName => {
        const option = variation.options.find(opt => opt.name === optionName);
        return `${variation.name}: ${optionName}${option?.price ? ` (+${formatCurrency(option.price)})` : ''}`;
      });
    }).flat();

    onAddToCart(selectedProduct, quantity, formattedOptions, notes);
    
    setSelectedProduct(null);
    setVariations([]);
    setQuantity(1);
    setSelectedOptions({});
    setNotes('');
    onClose();
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
    setVariations([]);
    setQuantity(1);
    setSelectedOptions({});
    setNotes('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedProduct ? selectedProduct.name : 'Selecionar Produto'}
          </DialogTitle>
        </DialogHeader>

        {!selectedProduct ? (
          <div className="space-y-6">
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
              <div className="text-center py-8">
                <p className="text-gray-500">Carregando produtos...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-lg transition-shadow">
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
                      <p className="text-lg font-bold text-primary mb-2">
                        {formatCurrency(product.price)}
                      </p>
                      <Button 
                        onClick={() => handleProductClick(product)}
                        className="w-full"
                        size="sm"
                      >
                        <Plus size={16} className="mr-1" />
                        Selecionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {!propProduct && (
              <Button variant="outline" onClick={handleBackToProducts}>
                ← Voltar aos produtos
              </Button>
            )}

            <div className="flex gap-4">
              {selectedProduct.image_url && (
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <p className="text-2xl font-bold text-primary mb-2">
                  {formatCurrency(selectedProduct.price)}
                </p>
                {selectedProduct.description && (
                  <p className="text-gray-600">{selectedProduct.description}</p>
                )}
              </div>
            </div>

            {variations.map((variation) => (
              <div key={variation.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{variation.name}</h3>
                  {variation.required && (
                    <Badge variant="destructive" className="text-xs">
                      Obrigatório
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {variation.max_selections === 1 ? 'Escolha 1' : `Máx: ${variation.max_selections}`}
                  </Badge>
                </div>

                {variation.max_selections === 1 ? (
                  <RadioGroup
                    value={selectedOptions[variation.id]?.[0] || ''}
                    onValueChange={(value) => handleVariationChange(variation.id, value, !!value)}
                  >
                    {variation.options.map((option) => (
                      <div key={option.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={option.name} id={`${variation.id}-${option.name}`} />
                          <Label htmlFor={`${variation.id}-${option.name}`}>
                            {option.name}
                          </Label>
                        </div>
                        <span className="text-sm text-gray-600">
                          {option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                        </span>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    {variation.options.map((option) => (
                      <div key={option.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${variation.id}-${option.name}`}
                            checked={selectedOptions[variation.id]?.includes(option.name) || false}
                            onCheckedChange={(checked) => 
                              handleVariationChange(variation.id, option.name, checked as boolean)
                            }
                            disabled={
                              !selectedOptions[variation.id]?.includes(option.name) &&
                              (selectedOptions[variation.id] || []).length >= variation.max_selections
                            }
                          />
                          <Label htmlFor={`${variation.id}-${option.name}`}>
                            {option.name}
                          </Label>
                        </div>
                        <span className="text-sm text-gray-600">
                          {option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {!isVariationValid(variation) && (
                  <p className="text-sm text-red-600">
                    {variation.name} é obrigatório
                  </p>
                )}

                <Separator />
              </div>
            ))}

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações especiais..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label>Quantidade:</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus size={16} />
                  </Button>
                  <span className="w-12 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-600">Total:</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(getTotalPrice())}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button 
                onClick={handleAddToCart} 
                className="flex-1"
                disabled={!canAddToCart()}
              >
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
