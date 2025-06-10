
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
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
  product: Product | null;
  variations: ProductVariation[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, selectedOptions: any[], notes: string) => void;
}

const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  product,
  variations,
  isOpen,
  onClose,
  onAddToCart
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');

  if (!product) return null;

  const handleVariationChange = (variationId: string, optionName: string, checked: boolean) => {
    const variation = variations.find(v => v.id === variationId);
    if (!variation) return;

    setSelectedOptions(prev => {
      const current = prev[variationId] || [];
      
      if (variation.max_selections === 1) {
        // Radio behavior - only one selection
        return { ...prev, [variationId]: checked ? [optionName] : [] };
      } else {
        // Checkbox behavior - multiple selections
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
    let total = product.price;
    
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
    if (!canAddToCart()) return;

    const formattedOptions = variations.map(variation => {
      const selected = selectedOptions[variation.id] || [];
      return selected.map(optionName => {
        const option = variation.options.find(opt => opt.name === optionName);
        return `${variation.name}: ${optionName}${option?.price ? ` (+${formatCurrency(option.price)})` : ''}`;
      });
    }).flat();

    onAddToCart(product, quantity, formattedOptions, notes);
    
    // Reset form
    setQuantity(1);
    setSelectedOptions({});
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <div className="flex gap-4">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-32 h-32 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <p className="text-2xl font-bold text-primary mb-2">
                {formatCurrency(product.price)}
              </p>
              {product.description && (
                <p className="text-gray-600">{product.description}</p>
              )}
            </div>
          </div>

          {/* Variations */}
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

          {/* Notes */}
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

          {/* Quantity and Total */}
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

          {/* Actions */}
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
      </DialogContent>
    </Dialog>
  );
};

export default ProductSelectionModal;
