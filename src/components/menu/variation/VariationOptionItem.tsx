import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface VariationOption {
  name: string;
  price: number;
}

interface VariationOptionItemProps {
  option: VariationOption;
  index: number;
  variationId: string;
  isRadio: boolean;
  isSelected: boolean;
  onSelectionChange: (optionName: string, isSelected: boolean) => void;
}

export const VariationOptionItem: React.FC<VariationOptionItemProps> = ({
  option,
  index,
  variationId,
  isRadio,
  isSelected,
  onSelectionChange
}) => {
  const inputId = `${variationId}-${index}`;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        {isRadio ? (
          <RadioGroupItem 
            value={option.name} 
            id={inputId} 
          />
        ) : (
          <Checkbox
            id={inputId}
            checked={isSelected}
            onCheckedChange={(checked) => 
              onSelectionChange(option.name, checked as boolean)
            }
          />
        )}
        <Label htmlFor={inputId}>
          {option.name}
        </Label>
      </div>
      {option.price > 0 && (
        <span className="text-sm text-green-600">
          +R$ {option.price.toFixed(2)}
        </span>
      )}
    </div>
  );
};