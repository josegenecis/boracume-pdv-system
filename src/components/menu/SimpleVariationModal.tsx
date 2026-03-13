import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSimpleVariations } from '@/hooks/useSimpleVariations';
import { QuantitySelector } from './variation/QuantitySelector';
import { VariationGroup } from './variation/VariationGroup';
import { Loader2 } from 'lucide-react';

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
  maxQuantity?: number | null;
}

export const SimpleVariationModal: React.FC<SimpleVariationModalProps> = ({
  isOpen,
  onClose,
  product,
  onAddToCart,
  maxQuantity
}) => {
  const [variations, setVariations] = useState<any[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { isLoading, fetchVariations, calculateVariationPrice, getSelectedVariationsText } = useSimpleVariations();

  useEffect(() => {
    if (product && isOpen) {
      loadVariations();
    }
  }, [product, isOpen]);

  const loadVariations = async () => {
    if (!product) return;
    
    try {
      setLoadingVariations(true);
      const productVariations = await fetchVariations(product.id);
      setVariations(productVariations);
      setSelectedVariations({});
    } catch (error) {
      setVariations([]);
    } finally {
      setLoadingVariations(false);
    }
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
    if (typeof maxQuantity === 'number' && Number.isFinite(maxQuantity) && quantity > Math.max(1, Math.floor(maxQuantity))) {
      toast({
        title: 'Estoque insuficiente',
        description: `Quantidade máxima disponível: ${Math.max(1, Math.floor(maxQuantity))}.`,
        variant: 'destructive'
      });
      return;
    }
    
    const variationPrice = calculateVariationPrice(selectedVariations, variations);
    const variationTexts = getSelectedVariationsText(selectedVariations);
    
    setSubmitting(true);
    onAddToCart(product, quantity, variationTexts, notes, variationPrice);
    
    // Reset
    setQuantity(1);
    setNotes('');
    setSelectedVariations({});
    setSubmitting(false);
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
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-white shadow-2xl border border-gray-100 rounded-xl">
        <DialogHeader className="border-b border-gray-100 pb-4">
          <DialogTitle className="text-xl font-bold text-gray-900">{product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-2">
          {product.image_url && (
            <img 
              src={product.image_url} 
              alt={product.name}
              className="w-full h-32 object-cover rounded-xl shadow-sm"
            />
          )}
          
          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg">{product.description}</p>
          )}

          {/* Quantidade */}
          <QuantitySelector 
            quantity={quantity}
            onQuantityChange={setQuantity}
            max={typeof maxQuantity === 'number' && Number.isFinite(maxQuantity) ? Math.max(1, Math.floor(maxQuantity)) : undefined}
          />

          {/* Variações */}
          {(loadingVariations || isLoading) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando opções...
            </div>
          )}
          
          {!loadingVariations && !isLoading && variations.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Personalize seu pedido</h3>
              {variations.map((variation) => (
                <VariationGroup
                  key={variation.id}
                  variation={variation}
                  selectedVariations={selectedVariations}
                  onVariationChange={handleVariationChange}
                />
              ))}
            </div>
          ) : !loadingVariations && !isLoading ? (
            <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
              ⚠️ Nenhuma variação disponível para este produto.
              <br />
              <span className="text-xs">
                Você ainda pode ajustar a quantidade e adicionar observações.
              </span>
            </div>
          ) : null}

          {/* Observações */}
          <div>
            <Label className="text-sm font-semibold text-gray-900">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observação especial..."
              rows={2}
              className="mt-2 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Footer com preço e botões */}
          <div className="border-t border-gray-100 pt-6 space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
              <span className="font-bold text-gray-900">Total:</span>
              <span className="text-xl font-bold text-primary">
                R$ {getTotalPrice().toFixed(2)}
              </span>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1 rounded-xl"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleAddToCart}
                disabled={!isValidSelection() || loadingVariations || submitting}
                className="flex-1 bg-primary hover:bg-primary/90 rounded-xl font-bold"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
