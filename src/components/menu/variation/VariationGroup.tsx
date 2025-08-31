import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import { VariationOptionItem } from './VariationOptionItem';

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
  const isRadio = variation.max_selections === 1;
  const selectedOptions = selectedVariations[variation.id] || [];

  const handleOptionChange = (optionName: string, isSelected: boolean) => {
    onVariationChange(variation.id, optionName, isSelected);
  };

  return (
    <div className="border rounded p-3">
      <Label className="font-medium">
        {variation.name} {variation.required && <span className="text-red-500">*</span>}
      </Label>
      
      <div className="mt-2 space-y-2">
        {isRadio ? (
          <RadioGroup
            value={selectedOptions[0] || ''}
            onValueChange={(value) => 
              onVariationChange(variation.id, value, true)
            }
          >
            {variation.options.map((option, index) => (
              <VariationOptionItem
                key={index}
                option={option}
                index={index}
                variationId={variation.id}
                isRadio={true}
                isSelected={selectedOptions.includes(option.name)}
                onSelectionChange={handleOptionChange}
              />
            ))}
          </RadioGroup>
        ) : (
          <div className="space-y-2">
            {variation.options.map((option, index) => (
              <VariationOptionItem
                key={index}
                option={option}
                index={index}
                variationId={variation.id}
                isRadio={false}
                isSelected={selectedOptions.includes(option.name)}
                onSelectionChange={handleOptionChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};