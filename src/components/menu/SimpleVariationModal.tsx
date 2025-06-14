import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { QuantitySelector } from './variation/QuantitySelector';
import { VariationGroup } from './variation/VariationGroup';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
}

interface SimpleVariationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onAddToCart: (product: Product, quantity: number, variations: string[], notes: string, variationPrice: number) => void;
}

export const SimpleVariationModal: React.FC<SimpleVariationModalProps> = ({
  isOpen,
  onClose,
  product,
  onAddToCart
}) => {
  const [variations, setVariations] = useState<any[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const { fetchVariations, calculateVariationPrice, getSelectedVariationsText } = useSimpleVariations();

  useEffect(() => {
    if (product && isOpen) {
      loadVariations();
    }
  }, [product, isOpen]);

  const loadVariations = async () => {
    if (!product) return;
    
    const productVariations = await fetchVariations(product.id);
    setVariations(productVariations);
    setSelectedVariations({});
  };

  const handleVariationChange = (variationId: string, optionName: string, isSelected: boolean) => {
    const variation = variations.find(v => v.id === variationId);
    if (!variation) return;

    setSelectedVariations(prev => {
      const current = prev[variationId] || [];
      
      if (variation.max_selections === 1) {
        // Radio: apenas uma seleção
        return {
          ...prev,
          [variationId]: isSelected ? [optionName] : []
        };
      } else {
        // Checkbox: múltiplas seleções
        if (isSelected) {
          if (current.length < variation.max_selections) {
            return {
              ...prev,
              [variationId]: [...current, optionName]
            };
          }
        } else {
          return {
            ...prev,
            [variationId]: current.filter(name => name !== optionName)
          };
        }
      }
      
      return prev;
    });
  };

  const isValidSelection = () => {
    return variations.every(variation => {
      const selected = selectedVariations[variation.id] || [];
      if (variation.required && selected.length === 0) {
        return false;
      }
      return true;
    });
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    const variationPrice = calculateVariationPrice(selectedVariations, variations);
    const variationTexts = getSelectedVariationsText(selectedVariations);
    
    onAddToCart(product, quantity, variationTexts, notes, variationPrice);
    
    // Reset
    setQuantity(1);
    setNotes('');
    setSelectedVariations({});
    onClose();
  };

  const getTotalPrice = () => {
    if (!product) return 0;
    const variationPrice = calculateVariationPrice(selectedVariations, variations);
    return (product.price + variationPrice) * quantity;
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {product.image_url && (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="w-full h-32 object-cover rounded"
            />
          )}
          
          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          {/* Quantidade */}
          <QuantitySelector 
            quantity={quantity}
            onQuantityChange={setQuantity}
          />

          {/* Variações */}
          {variations.map((variation) => (
            <VariationGroup
              key={variation.id}
              variation={variation}
              selectedVariations={selectedVariations}
              onVariationChange={handleVariationChange}
            />
          ))}

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observação especial..."
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Footer com preço e botões */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total:</span>
              <span className="text-lg font-bold text-primary">
                R$ {getTotalPrice().toFixed(2)}
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleAddToCart}
                disabled={!isValidSelection()}
                className="flex-1"
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};