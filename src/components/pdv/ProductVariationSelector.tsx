import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';
import { formatBRL } from '@/lib/currency';
import type { Variation } from '@/hooks/useSimpleVariations';
import { calculatePizzaFlavorPrice, getDisplayedPizzaFlavorPrice, isPizzaFlavorVariation, type PizzaCategoryConfig } from '@/lib/pizza-pricing';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
}

interface ProductVariationSelectorProps {
  product: Product;
  variations: Variation[];
  onAddToCart: (product: Product, quantity: number, selectedVariations: any[], notes: string, variationPrice: number) => void;
  onClose: () => void;
  categoryConfig?: PizzaCategoryConfig | null;
}

const ProductVariationSelector: React.FC<ProductVariationSelectorProps> = ({
  product,
  variations,
  onAddToCart,
  onClose,
  categoryConfig
}) => {
  const { isMobile } = useSidebar();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, Array<{ name: string; price: number }>>>({});
  const [notes, setNotes] = useState('');
  const [pizzaFlavorMode, setPizzaFlavorMode] = useState<Record<string, 1 | 2>>({});

  const variationLimits = useMemo(() => {
    return Object.fromEntries(
      variations.map((variation) => [
        variation.id,
        isPizzaFlavorVariation(variation, categoryConfig)
          ? (pizzaFlavorMode[variation.id] === 2 ? Math.min(2, Number(variation.max_selections || 2)) : 1)
          : Number(variation.max_selections || 1)
      ])
    );
  }, [variations, categoryConfig, pizzaFlavorMode]);

  const handleVariationChange = (variationId: string, optionName: string, optionPrice: number, isSelected: boolean) => {
    const variation = variations.find((item) => item.id === variationId);
    if (!variation) return;

    setSelectedVariations((prev) => {
      const current = prev[variationId] || [];
      const maxSelections = variationLimits[variationId] || 1;

      if (maxSelections === 1) {
        return {
          ...prev,
          [variationId]: isSelected ? [{ name: optionName, price: optionPrice }] : []
        };
      }

      if (isSelected) {
        if (current.length < maxSelections) {
          return {
            ...prev,
            [variationId]: [...current, { name: optionName, price: optionPrice }]
          };
        }
        return prev;
      }

      return {
        ...prev,
        [variationId]: current.filter((item) => item.name !== optionName)
      };
    });
  };

  const getVariationPrice = (variation: Variation, selected: Array<{ name: string; price: number }>) => {
    if (selected.length === 0) return 0;

    if (isPizzaFlavorVariation(variation, categoryConfig)) {
      return calculatePizzaFlavorPrice(
        selected.map((item) => item.name),
        variation,
        categoryConfig
      );
    }

    let total = 0;
    let freeRemaining = Math.max(0, Number(variation.free_selections_limit || 0));
    for (const option of selected) {
      if (freeRemaining > 0) {
        freeRemaining -= 1;
        continue;
      }
      total += Number(option.price || 0);
    }
    return total;
  };

  const calculateVariationPrice = () => {
    return variations.reduce((sum, variation) => {
      const selected = selectedVariations[variation.id] || [];
      return sum + getVariationPrice(variation, selected);
    }, 0);
  };

  const calculateTotalPrice = () => {
    return (Number(product.price || 0) + calculateVariationPrice()) * quantity;
  };

  const canAddToCart = () => {
    return variations.every((variation) => {
      const selected = selectedVariations[variation.id] || [];
      const requiredMin = isPizzaFlavorVariation(variation, categoryConfig)
        ? (pizzaFlavorMode[variation.id] || 1)
        : Math.max(variation.required ? 1 : 0, Number(variation.min_selections || 0));

      return selected.length >= requiredMin && selected.length <= (variationLimits[variation.id] || 1);
    });
  };

  const handleAddToCart = () => {
    if (!canAddToCart()) return;

    const selectedOptions: string[] = [];
    const variationLines: string[] = [];

    for (const variation of variations) {
      const options = selectedVariations[variation.id];
      if (!Array.isArray(options) || options.length === 0) continue;
      const names = options.map((option) => String(option?.name || '').trim()).filter(Boolean);
      if (names.length === 0) continue;
      const label = String(variation.receipt_label || variation.name || '').trim();
      const prefix = isPizzaFlavorVariation(variation, categoryConfig)
        ? `${label} (${pizzaFlavorMode[variation.id] === 2 ? '2 metades' : '1 sabor'})`
        : label;
      selectedOptions.push(...names);
      variationLines.push(`${prefix}: ${names.join(', ')}`);
    }

    onAddToCart(
      product,
      quantity,
      { options: selectedOptions, variationLines } as any,
      notes,
      calculateVariationPrice()
    );
    onClose();
  };

  return (
    <div className={isMobile ? "space-y-3" : "space-y-6"}>
      <div className={isMobile ? "flex items-center gap-3" : "flex items-center gap-4"}>
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className={isMobile ? "h-12 w-12 rounded-xl object-cover" : "w-16 h-16 object-cover rounded-lg"}
          />
        )}
        <div>
          <h3 className={isMobile ? "text-[15px] font-semibold leading-tight" : "text-lg font-semibold"}>{product.name}</h3>
          {product.description && (
            <p className={isMobile ? "text-[11px] text-muted-foreground line-clamp-2" : "text-sm text-muted-foreground"}>{product.description}</p>
          )}
          <p className={isMobile ? "text-[15px] font-bold text-primary" : "text-lg font-bold text-primary"}>
            {formatBRL(product.price)}
          </p>
        </div>
      </div>

      {variations.map((variation) => {
        const maxSelections = variationLimits[variation.id] || 1;
        const isPizzaFlavor = isPizzaFlavorVariation(variation, categoryConfig);
        const selected = selectedVariations[variation.id] || [];
        const pizzaMode = pizzaFlavorMode[variation.id] || 1;

        return (
          <Card key={variation.id} className={isMobile ? "rounded-[18px]" : ""}>
            <CardHeader className={isMobile ? "px-3 pb-2 pt-3" : "pb-3"}>
              <CardTitle className={isMobile ? "text-[14px]" : "text-base"}>
                {variation.customer_label || variation.name}
                {variation.required && <span className="text-red-500 ml-1">*</span>}
              </CardTitle>
              {isPizzaFlavor && (
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant={pizzaFlavorMode[variation.id] === 2 ? 'outline' : 'default'}
                    className={isMobile ? "h-8 rounded-xl text-[11px]" : "h-9 rounded-xl"}
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
                    className={isMobile ? "h-8 rounded-xl text-[11px]" : "h-9 rounded-xl"}
                    onClick={() => setPizzaFlavorMode((prev) => ({ ...prev, [variation.id]: 2 }))}
                  >
                    2 metades
                  </Button>
                </div>
              )}
              <p className={isMobile ? "text-[11px] text-muted-foreground" : "text-sm text-muted-foreground"}>
                {maxSelections === 1 ? 'Selecione uma opÃ§Ã£o' : `Selecione atÃ© ${maxSelections} opÃ§Ãµes`}
              </p>
            </CardHeader>
            <CardContent className={isMobile ? "px-3 pb-3" : ""}>
              {maxSelections === 1 ? (
                <RadioGroup
                  value={selected[0]?.name || ''}
                  onValueChange={(value) => {
                    const option = variation.options.find((opt) => opt.name === value);
                    if (option) handleVariationChange(variation.id, option.name, Number(option.price || 0), true);
                  }}
                >
                  {variation.options.map((option) => (
                    <div key={option.name} className={isMobile ? "flex items-center justify-between gap-2 rounded-xl border border-[#003223]/8 px-2.5 py-2" : "flex items-center justify-between"}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={option.name} id={`${variation.id}-${option.name}`} />
                        <Label className={isMobile ? "text-[12px]" : ""} htmlFor={`${variation.id}-${option.name}`}>{option.name}</Label>
                      </div>
                      <span className={isMobile ? "text-[11px] text-muted-foreground" : "text-sm text-muted-foreground"}>
                        {formatBRL(isPizzaFlavor ? getDisplayedPizzaFlavorPrice(option, variation, pizzaMode) : Number(option.price || 0))}
                      </span>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {variation.options.map((option) => {
                    const isSelected = selected.some((item) => item.name === option.name);
                    return (
                      <div key={option.name} className={isMobile ? "flex items-center justify-between gap-2 rounded-xl border border-[#003223]/8 px-2.5 py-2" : "flex items-center justify-between"}>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${variation.id}-${option.name}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => handleVariationChange(variation.id, option.name, Number(option.price || 0), checked as boolean)}
                          />
                          <Label className={isMobile ? "text-[12px]" : ""} htmlFor={`${variation.id}-${option.name}`}>{option.name}</Label>
                        </div>
                        <span className={isMobile ? "text-[11px] text-muted-foreground" : "text-sm text-muted-foreground"}>
                          {formatBRL(isPizzaFlavor ? getDisplayedPizzaFlavorPrice(option, variation, pizzaMode) : Number(option.price || 0))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className={isMobile ? "space-y-3" : "space-y-4"}>
        <div>
          <Label htmlFor="notes">ObservaÃ§Ãµes</Label>
          <Textarea
            id="notes"
            placeholder="ObservaÃ§Ãµes especiais para este item..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={isMobile ? "mt-1 min-h-[68px] rounded-xl text-[12px]" : "mt-1"}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className={isMobile ? "flex items-center gap-2" : "flex items-center gap-3"}>
            <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} className={isMobile ? "h-8 w-8 rounded-xl" : ""}>
              <Minus className="h-4 w-4" />
            </Button>
            <span className={isMobile ? "text-[15px] font-semibold" : "font-semibold text-lg"}>{quantity}</span>
            <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)} className={isMobile ? "h-8 w-8 rounded-xl" : ""}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-right">
            <p className={isMobile ? "text-[11px] text-muted-foreground" : "text-sm text-muted-foreground"}>Total</p>
            <p className={isMobile ? "text-[17px] font-bold text-primary" : "text-xl font-bold text-primary"}>
              {formatBRL(calculateTotalPrice())}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className={isMobile ? "h-9 flex-1 rounded-xl text-[12px]" : "flex-1"}>
            Cancelar
          </Button>
          <Button onClick={handleAddToCart} disabled={!canAddToCart()} className={isMobile ? "h-9 flex-1 rounded-xl text-[12px]" : "flex-1"}>
            Adicionar ao Carrinho
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductVariationSelector;
