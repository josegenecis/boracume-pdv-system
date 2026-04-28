import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getCachedSimpleVariations,
  hasDefinitiveSimpleVariationsResult,
  getSimpleVariationPresence,
  useSimpleVariations,
  type SelectedVariationDetail,
} from '@/hooks/useSimpleVariations';
import { VariationGroup } from './variation/VariationGroup';
import { ChevronDown, Loader2 } from 'lucide-react';
import { getDisplayedPizzaFlavorPrice, isPizzaFlavorVariation, type PizzaCategoryConfig } from '@/lib/pizza-pricing';

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
  onAddToCart: (
    product: Product,
    quantity: number,
    variations: string[],
    notes: string,
    variationPrice: number,
    optionDetails?: SelectedVariationDetail[]
  ) => void;
  maxQuantity?: number | null;
  categoryConfig?: PizzaCategoryConfig | null;
}

export const SimpleVariationModal: React.FC<SimpleVariationModalProps> = ({
  isOpen,
  onClose,
  product,
  onAddToCart,
  maxQuantity,
  categoryConfig
}) => {
  const formatBRL = (value: number) =>
    `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [variations, setVariations] = useState<any[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>({});
  const [pizzaFlavorMode, setPizzaFlavorMode] = useState<Record<string, 1 | 2>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const variationSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const {
    isLoading,
    fetchVariations,
    calculateVariationPrice,
    getSelectedVariationDetails,
    getSelectedVariationsTextWithReceiptLabels,
  } = useSimpleVariations();

  useEffect(() => {
    if (product && isOpen) {
      void loadVariations();
    }
  }, [product, isOpen]);

  const loadVariations = async () => {
    if (!product) return;

    try {
      const cachedVariations = getCachedSimpleVariations(product.id);
      if (cachedVariations.length > 0 || hasDefinitiveSimpleVariationsResult(product.id)) {
        setVariations(cachedVariations);
        setSelectedVariations({});
        setPizzaFlavorMode({});
        setLoadingVariations(false);
        return;
      }

      if (getSimpleVariationPresence(product.id) === 'none') {
        setVariations([]);
        setSelectedVariations({});
        setPizzaFlavorMode({});
        setLoadingVariations(false);
        return;
      }

      setLoadingVariations(true);
      const productVariations = await fetchVariations(product.id);
      setVariations(productVariations);
      setSelectedVariations({});
      setPizzaFlavorMode({});
    } catch {
      setVariations([]);
    } finally {
      setLoadingVariations(false);
    }
  };

  const getVariationMaxSelections = (variation: any) => {
    if (!isPizzaFlavorVariation(variation, categoryConfig)) return variation.max_selections;
    return pizzaFlavorMode[variation.id] === 2 ? Math.min(2, Number(variation.max_selections || 2)) : 1;
  };

  const scrollToNextVariation = (variationId: string) => {
    const currentIndex = variations.findIndex((item) => item.id === variationId);
    if (currentIndex === -1) return;

    const nextVariation = variations[currentIndex + 1];
    const container = contentScrollRef.current;
    const nextSection = nextVariation ? variationSectionRefs.current[nextVariation.id] : null;

    if (!container || !nextSection) return;

    window.requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const nextRect = nextSection.getBoundingClientRect();
      const targetTop = container.scrollTop + (nextRect.top - containerRect.top) - 12;

      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
    });
  };

  const handleVariationChange = (variationId: string, optionName: string, isSelected: boolean) => {
    const variation = variations.find((item) => item.id === variationId);
    if (!variation) return;
    const variationMaxSelections = getVariationMaxSelections(variation);

    setSelectedVariations((prev) => {
      const current = prev[variationId] || [];
      let nextSelection = current;

      if (variationMaxSelections === 1) {
        nextSelection = isSelected ? [optionName] : [];
        const nextState = {
          ...prev,
          [variationId]: nextSelection
        };
        if (isSelected && current.length < variationMaxSelections && nextSelection.length >= variationMaxSelections) {
          scrollToNextVariation(variationId);
        }
        return nextState;
      }

      if (isSelected) {
        if (current.length < variationMaxSelections) {
          nextSelection = [...current, optionName];
          const nextState = {
            ...prev,
            [variationId]: nextSelection
          };
          if (current.length < variationMaxSelections && nextSelection.length >= variationMaxSelections) {
            scrollToNextVariation(variationId);
          }
          return nextState;
        }
      } else {
        const removeIndex = current.lastIndexOf(optionName);
        if (removeIndex === -1) return prev;
        const next = [...current];
        next.splice(removeIndex, 1);
        nextSelection = next;
        return {
          ...prev,
          [variationId]: nextSelection
        };
      }

      return prev;
    });
  };

  const isValidSelection = () => {
    return variations.every((variation) => {
      const selected = selectedVariations[variation.id] || [];
      const pizzaMode = pizzaFlavorMode[variation.id] || 1;
      const minSel = isPizzaFlavorVariation(variation, categoryConfig)
        ? pizzaMode
        : Math.max(variation.required ? 1 : 0, Number(variation.min_selections || 0));
      const maxSel = getVariationMaxSelections(variation);
      if (selected.length < minSel) {
        return false;
      }
      if (selected.length > Number(maxSel || 1)) {
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

    const variationPrice = calculateVariationPrice(selectedVariations, variations, { category: categoryConfig });
    const variationTexts = getSelectedVariationsTextWithReceiptLabels(selectedVariations, variations);
    const variationDetails = getSelectedVariationDetails(selectedVariations, variations, { category: categoryConfig });

    setSubmitting(true);
    onAddToCart(product, quantity, variationTexts, notes, variationPrice, variationDetails);

    setQuantity(1);
    setNotes('');
    setSelectedVariations({});
    setPizzaFlavorMode({});
    setSubmitting(false);
    onClose();
  };

  const getTotalPrice = () => {
    if (!product) return 0;
    const variationPrice = calculateVariationPrice(selectedVariations, variations, { category: categoryConfig });
    return (product.price + variationPrice) * quantity;
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[100dvw] max-w-[100dvw] h-[100dvh] max-h-[100dvh] sm:h-[88dvh] sm:max-h-[88dvh] sm:max-w-md overflow-hidden bg-white shadow-2xl border border-gray-100 rounded-none sm:rounded-xl p-0">
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

          <div
            ref={contentScrollRef}
            data-variation-scroll-container="true"
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-4 space-y-6"
          >
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
                  <div
                    key={variation.id}
                    data-variation-section={variation.id}
                    ref={(element) => {
                      variationSectionRefs.current[variation.id] = element;
                    }}
                    className="space-y-2"
                  >
                    {(() => {
                      const pizzaMode = pizzaFlavorMode[variation.id] || 1;
                      const variationWithDisplayedPrices = isPizzaFlavorVariation(variation, categoryConfig)
                        ? {
                            ...variation,
                            options: variation.options.map((option: any) => ({
                              ...option,
                              display_price: getDisplayedPizzaFlavorPrice(option, variation, pizzaMode)
                            }))
                          }
                        : variation;

                      return (
                        <>
                    {isPizzaFlavorVariation(variation, categoryConfig) && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={pizzaFlavorMode[variation.id] === 2 ? 'outline' : 'default'}
                          className="h-9 rounded-xl"
                          onClick={() => {
                            setPizzaFlavorMode((prev) => ({ ...prev, [variation.id]: 1 }));
                            setSelectedVariations((prev) => ({ ...prev, [variation.id]: (prev[variation.id] || []).slice(0, 1) }));
                          }}
                        >
                          1 sabor
                        </Button>
                        <Button
                          type="button"
                          variant={pizzaFlavorMode[variation.id] === 2 ? 'default' : 'outline'}
                          className="h-9 rounded-xl"
                          onClick={() => setPizzaFlavorMode((prev) => ({ ...prev, [variation.id]: 2 }))}
                        >
                          2 metades
                        </Button>
                      </div>
                    )}
                    <VariationGroup
                      variation={{
                        ...variationWithDisplayedPrices,
                        min_selections: isPizzaFlavorVariation(variation, categoryConfig)
                          ? (pizzaFlavorMode[variation.id] || 1)
                          : variation.min_selections,
                        max_selections: getVariationMaxSelections(variation)
                      }}
                      selectedVariations={selectedVariations}
                      onVariationChange={handleVariationChange}
                    />
                        </>
                      );
                    })()}
                  </div>
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
