
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
  weight_based?: boolean;
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

interface SelectedOptions {
  [variationId: string]: string[];
}

interface ProductVariationSelectorProps {
  product: Product;
  onAddToCart: (product: Product, quantity?: number, selectedOptions?: string[], notes?: string) => void;
}

const ProductVariationSelector: React.FC<ProductVariationSelectorProps> = ({
  product,
  onAddToCart
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [variations] = useState<ProductVariation[]>([]); // For now, empty variations
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calculateTotalPrice = () => {
    let total = product.price * quantity;
    variations.forEach(variation => {
      const selected = selectedOptions[variation.id] || [];
      selected.forEach(optionName => {
        const option = variation.options.find(opt => opt.name === optionName);
        if (option) total += option.price * quantity;
      });
    });
    return total;
  };

  const isValidSelection = () => {
    return variations.every(variation => {
      const selected = selectedOptions[variation.id] || [];
      if (variation.required && selected.length === 0) {
        return false;
      }
      return selected.length <= variation.max_selections;
    });
  };

  const handleSingleSelection = (variationId: string, optionName: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [variationId]: [optionName]
    }));
  };

  const handleMultipleSelection = (variationId: string, optionName: string, checked: boolean) => {
    const current = selectedOptions[variationId] || [];
    if (checked) {
      const variation = variations.find(v => v.id === variationId);
      if (variation && current.length < variation.max_selections) {
        setSelectedOptions(prev => ({
          ...prev,
          [variationId]: [...current, optionName]
        }));
      }
    } else {
      setSelectedOptions(prev => ({
        ...prev,
        [variationId]: current.filter(name => name !== optionName)
      }));
    }
  };

  const handleAddToCart = () => {
<<<<<<< HEAD
    // Garantir que apenas nomes únicos e não agrupados sejam enviados
    const selectedOptionsArray = Array.from(new Set(Object.values(selectedOptions).flat().filter(opt => typeof opt === 'string' && !opt.includes(','))));
=======
    const selectedOptionsArray = Object.values(selectedOptions).flat();
>>>>>>> e6b7a9c65be63386bc4aeecbe63c76dd1d44ce44
    onAddToCart(product, quantity, selectedOptionsArray, notes);
    setIsOpen(false);
    setQuantity(1);
    setNotes('');
    setSelectedOptions({});
  };

  const handleQuickAdd = () => {
    if (variations.length === 0) {
      onAddToCart(product, 1, [], '');
    } else {
      setIsOpen(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button onClick={handleQuickAdd} size="sm">
          <Plus size={16} className="mr-1" />
          Adicionar
        </Button>
      </DialogTrigger>
      
      {variations.length > 0 && (
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizar Produto</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold">{product.name}</h3>
              <p className="text-gray-600">{product.description}</p>
              <p className="text-xl font-bold text-primary mt-2">
                {formatCurrency(product.price)}
                {product.weight_based && <span className="text-sm text-gray-500 ml-1">/kg</span>}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Label htmlFor="quantity">Quantidade:</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <span className="w-8 text-center">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </Button>
              </div>
            </div>

            {variations.map(variation => (
              <div key={variation.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">{variation.name}</h4>
                  <div className="flex gap-2">
                    {variation.required && (
                      <Badge variant="destructive" className="text-xs">
                        Obrigatório
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Máx: {variation.max_selections}
                    </Badge>
                  </div>
                </div>

                {variation.max_selections === 1 ? (
                  <RadioGroup
                    value={selectedOptions[variation.id]?.[0] || ''}
                    onValueChange={(value) => handleSingleSelection(variation.id, value)}
                  >
                    {variation.options.map((option, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={option.name} id={`${variation.id}-${index}`} />
                          <Label htmlFor={`${variation.id}-${index}`}>{option.name}</Label>
                        </div>
                        <span className="text-sm text-gray-600">
                          {option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                        </span>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    {variation.options.map((option, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${variation.id}-${index}`}
                            checked={selectedOptions[variation.id]?.includes(option.name) || false}
                            onCheckedChange={(checked) => 
                              handleMultipleSelection(variation.id, option.name, checked as boolean)
                            }
                            disabled={
                              !selectedOptions[variation.id]?.includes(option.name) &&
                              (selectedOptions[variation.id]?.length || 0) >= variation.max_selections
                            }
                          />
                          <Label htmlFor={`${variation.id}-${index}`}>{option.name}</Label>
                        </div>
                        <span className="text-sm text-gray-600">
                          {option.price > 0 ? `+${formatCurrency(option.price)}` : 'Grátis'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div>
              <Label htmlFor="notes">Observações:</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alguma observação especial?"
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">Total:</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(calculateTotalPrice())}
                </span>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleAddToCart} 
                  disabled={!isValidSelection()}
                  className="flex-1"
                >
                  Adicionar ao Carrinho
                </Button>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
};

export default ProductVariationSelector;
