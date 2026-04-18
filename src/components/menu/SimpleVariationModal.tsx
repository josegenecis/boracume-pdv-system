import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getCachedSimpleVariations,
  getSimpleVariationPresence,
  hasCachedSimpleVariationsResult,
  useSimpleVariations
} from '@/hooks/useSimpleVariations';
import { VariationGroup } from './variation/VariationGroup';
import { ChevronDown, Loader2 } from 'lucide-react';

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
  const formatBRL = (value: number) =>
    `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [variations, setVariations] = useState<any[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { isLoading, fetchVariations, calculateVariationPrice, getSelectedVariationsTextWithReceiptLabels } = useSimpleVariations();

  useEffect(() => {
    if (product && isOpen) {
      void loadVariations();
    }
  }, [product, isOpen]);

  const loadVariations = async () => {
    if (!product) return;

    try {
      const cachedVariations = getCachedSimpleVariations(product.id);
      if (cachedVariations.length > 0 || hasCachedSimpleVariationsResult(product.id)) {
        setVariations(cachedVariations);
        setSelectedVariations({});
        setLoadingVariations(false);
        return;
      }

      if (getSimpleVariationPresence(product.id) === 'none') {
        setVariations([]);
        setSelectedVariations({});
        setLoadingVariations(false);
        return;
      }

      setLoadingVariations(true);
      const productVariations = await fetchVariations(product.id);
      setVariations(productVariations);
      setSelectedVariations({});
    } catch {
      setVariations([]);
    } finally {
      setLoadingVariations(false);
    }
  };

  const handleVariationChange = (variationId: string, optionName: string, isSelected: boolean) => {
    const variation = variations.find((item) => item.id === variationId);
    if (!variation) return;

    setSelectedVariations((prev) => {
      const current = prev[variationId] || [];

      if (variation.max_selections === 1) {
        return {
          ...prev,
          [variationId]: isSelected ? [optionName] : []
        };
      }

      if (isSelected) {
        if (current.length < variation.max_selections) {
          return {
            ...prev,
            [variationId]: [...current, optionName]
          };
        }
      } else {
        const removeIndex = current.lastIndexOf(optionName);
        if (removeIndex === -1) return prev;
        const next = [...current];
        next.splice(removeIndex, 1);
        return {
          ...prev,
          [variationId]: next
        };
      }

      return prev;
    });
  };

  const isValidSelection = () => {
    return variations.every((variation) => {
      const selected = selectedVariations[variation.id] || [];
      const minSel = Math.max(variation.required ? 1 : 0, Number(variation.min_selections || 0));
      if (selected.length < minSel) {
        return false;
      }
      if (selected.length > Number(variation.max_selections || 1)) {
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
        description: `Quantidade maxima disponivel: ${Math.max(1, Math.floor(maxQuantity))}.`,
        variant: 'destructive'
      });
      return;
    }

    const variationPrice = calculateVariationPrice(selectedVariations, variations);
    const variationTexts = getSelectedVariationsTextWithReceiptLabels(selectedVariations, variations);

    setSubmitting(true);
    onAddToCart(product, quantity, variationTexts, notes, variationPrice);

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
      <DialogContent className="w-[100dvw] max-w-[100dvw] h-[100dvh] sm:h-auto sm:max-h-[85vh] sm:max-w-md overflow-hidden bg-white shadow-2xl border border-gray-100 rounded-none sm:rounded-xl p-0">
        <div className="flex flex-col h-full min-h-0">
          <div className="relative">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-56 sm:h-44 object-cover"
              />
            ) : (
              <div className="w-full h-56 sm:h-44 bg-gradient-to-br from-orange-500 via-orange-600 to-rose-500" />
            )}

            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 left-4 h-10 w-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm border border-gray-200"
            >
              <ChevronDown className="h-5 w-5 text-gray-900" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-4 space-y-6">
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-extrabold text-gray-900 leading-tight">
                {product.name}
              </DialogTitle>
              {product.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
              )}
              <div className="text-2xl font-extrabold" style={{ color: 'var(--menu-primary, #85C441)' }}>
                {formatBRL(product.price)}
              </div>
            </div>

            {(loadingVariations || isLoading) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando opcoes...
              </div>
            )}

            {!loadingVariations && !isLoading && variations.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900">Personalize seu pedido</h3>
                {variations.map((variation) => (
                  <VariationGroup
                    key={variation.id}
                    variation={variation}
                    selectedVariations={selectedVariations}
                    onVariationChange={handleVariationChange}
                  />
                ))}
              </div>
            ) : null}

            <div>
              <Label className="text-sm font-semibold text-gray-900">Alguma observacao?</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: tirar a cebola, maionese a parte..."
                rows={2}
                className="mt-2 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 bg-white p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  -
                </Button>
                <div className="w-8 sm:w-10 text-center font-bold text-gray-900">{quantity}</div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl"
                  onClick={() => setQuantity((q) => q + 1)}
                  disabled={typeof maxQuantity === 'number' && Number.isFinite(maxQuantity) ? quantity >= Math.max(1, Math.floor(maxQuantity)) : false}
                >
                  +
                </Button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={!isValidSelection() || loadingVariations || submitting}
                className="h-11 min-w-0 flex-1 rounded-xl px-3 text-sm font-extrabold sm:h-12 sm:px-4 sm:text-base"
                style={{ backgroundColor: 'var(--menu-primary, #85C441)', color: '#ffffff' }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="truncate">Adicionar - {formatBRL(getTotalPrice())}</span>}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
