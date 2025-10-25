
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus } from 'lucide-react';

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

interface ProductVariationSelectorProps {
  product: Product;
  variations: ProductVariation[];
  onAddToCart: (product: Product, quantity: number, selectedVariations: any[], notes: string) => void;
  onClose: () => void;
}

const ProductVariationSelector: React.FC<ProductVariationSelectorProps> = ({
  product,
  variations,
  onAddToCart,
  onClose
}) => {

  console.log('🎯 ProductVariationSelector - Recebendo variações:', {
    produto: product.name,
    totalVariacoes: variations.length,
    variacoes: variations
  });


  const [quantity, setQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  const handleVariationChange = (variationId: string, optionName: string, optionPrice: number, isSelected: boolean) => {
    const variation = variations.find(v => v.id === variationId);
    if (!variation) return;

    setSelectedVariations(prev => {
      const current = prev[variationId] || [];
      
      if (variation.max_selections === 1) {
        // Radio button behavior
        return {
          ...prev,
          [variationId]: isSelected ? [{ name: optionName, price: optionPrice }] : []
        };
      } else {
        // Checkbox behavior
        if (isSelected) {
          if (current.length < variation.max_selections) {
            return {
              ...prev,
              [variationId]: [...current, { name: optionName, price: optionPrice }]
            };
          }
        } else {
          return {
            ...prev,
            [variationId]: current.filter((item: any) => item.name !== optionName)
          };
        }
      }
      return prev;
    });
  };

  const calculateTotalPrice = () => {
    let total = product.price * quantity;
    
    Object.values(selectedVariations).forEach((options: any) => {
      if (Array.isArray(options)) {
        options.forEach(option => {
          total += option.price * quantity;
        });
      }
    });
    
    return total;
  };

  const canAddToCart = () => {
    // Check if all required variations are selected
    return variations.every(variation => {
      if (!variation.required) return true;
      const selected = selectedVariations[variation.id];
      return selected && selected.length > 0;
    });
  };

  const handleAddToCart = () => {
    if (!canAddToCart()) return;

    // Transformar selectedVariations em um array plano de nomes de opções
    const selectedOptions: string[] = [];
    Object.values(selectedVariations).forEach((options: any) => {
      if (Array.isArray(options)) {
        options.forEach((option: any) => {
          if (option && option.name) {
            selectedOptions.push(String(option.name));
          }
        });
      }
    });
    onAddToCart(product, quantity, selectedOptions, notes);

    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {product.image_url && (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
        )}
        <div>
          <h3 className="text-lg font-semibold">{product.name}</h3>
          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}
          <p className="text-lg font-bold text-primary">
            R$ {product.price.toFixed(2)}
          </p>
        </div>
      </div>

      {variations.map(variation => (
        <Card key={variation.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {variation.name}
              {variation.required && <span className="text-red-500 ml-1">*</span>}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {variation.max_selections === 1 
                ? 'Selecione uma opção'
                : `Selecione até ${variation.max_selections} opções`
              }
            </p>
          </CardHeader>
          <CardContent>
            {variation.max_selections === 1 ? (
              <RadioGroup
                value={selectedVariations[variation.id]?.[0]?.name || ''}
                onValueChange={(value) => {
                  const option = variation.options.find(opt => opt.name === value);
                  if (option) {
                    handleVariationChange(variation.id, option.name, option.price, true);
                  }
                }}
              >
                {variation.options.map(option => (
                  <div key={option.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value={option.name} id={`${variation.id}-${option.name}`} />
                      <Label htmlFor={`${variation.id}-${option.name}`}>{option.name}</Label>
                    </div>
                    {option.price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        +R$ {option.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                {variation.options.map(option => {
                  const isSelected = selectedVariations[variation.id]?.some((item: any) => item.name === option.name) || false;
                  
                  return (
                    <div key={option.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`${variation.id}-${option.name}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handleVariationChange(variation.id, option.name, option.price, checked as boolean)
                          }
                        />
                        <Label htmlFor={`${variation.id}-${option.name}`}>{option.name}</Label>
                      </div>
                      {option.price > 0 && (
                        <span className="text-sm text-muted-foreground">
                          +R$ {option.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="space-y-4">
        <div>
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            placeholder="Observações especiais para este item..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-lg">{quantity}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-xl font-bold text-primary">
              R$ {calculateTotalPrice().toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleAddToCart} 
            disabled={!canAddToCart()}
            className="flex-1"
          >
            Adicionar ao Carrinho
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductVariationSelector;
