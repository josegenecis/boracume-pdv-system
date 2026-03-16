import React from 'react';
import { Label } from '@/components/ui/label';
import { VariationOptionItem } from './VariationOptionItem';
import { CheckCircle2 } from 'lucide-react';

interface VariationOption {
  name: string;
  price: number;
}

interface ProductVariation {
  id: string;
  name: string;
  customer_label?: string;
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: VariationOption[];
}

interface VariationGroupProps {
  variation: ProductVariation;
  selectedVariations: Record<string, string[]>;
  onVariationChange: (variationId: string, optionName: string, isSelected: boolean) => void;
}

export const VariationGroup: React.FC<VariationGroupProps> = ({
  variation,
  selectedVariations,
  onVariationChange
}) => {
  const selectedOptions = selectedVariations[variation.id] || [];
  const minSel = Math.max(variation.required ? 1 : 0, Number(variation.min_selections || 0));
  const maxSel = Math.max(1, Number(variation.max_selections || 1));
  const count = selectedOptions.length;
  const reachedMax = count >= maxSel;
  const isValid = count >= minSel && count <= maxSel;

  const subtitle =
    minSel > 0
      ? maxSel > 1
        ? `Escolha de ${minSel} a ${maxSel}`
        : `Escolha ${minSel}`
      : maxSel > 1
        ? `Escolha até ${maxSel}`
        : 'Opcional';

  return (
    <div className="border rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Label className="font-semibold text-gray-900">
          {variation.customer_label || variation.name} {variation.required && <span className="text-red-500">*</span>}
          </Label>
          <div className="text-xs text-muted-foreground mt-0.5">
            {subtitle}
          </div>
        </div>
        {isValid && minSel > 0 && (
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        )}
      </div>
      
      <div className="mt-3 divide-y divide-gray-100">
        {variation.options.map((option, index) => {
          const isSelected = selectedOptions.includes(option.name);
          const addDisabled = !isSelected && reachedMax;
          const removeDisabled = isSelected && count <= minSel;
          return (
            <VariationOptionItem
              key={`${variation.id}-${index}`}
              option={option}
              isSelected={isSelected}
              addDisabled={addDisabled}
              removeDisabled={removeDisabled}
              onAdd={() => onVariationChange(variation.id, option.name, true)}
              onRemove={() => onVariationChange(variation.id, option.name, false)}
            />
          );
        })}
      </div>
    </div>
  );
};
