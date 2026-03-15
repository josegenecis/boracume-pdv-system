import React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

interface VariationOption {
  name: string;
  price: number;
}

interface VariationOptionItemProps {
  option: VariationOption;
  isSelected: boolean;
  addDisabled: boolean;
  removeDisabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export const VariationOptionItem: React.FC<VariationOptionItemProps> = ({
  option,
  isSelected,
  addDisabled,
  removeDisabled,
  onAdd,
  onRemove
}) => {
  return (
    <div className={`flex items-center justify-between gap-3 py-3 ${addDisabled && !isSelected ? 'opacity-40' : ''}`}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{option.name}</div>
        {option.price > 0 && (
          <div className="text-xs text-gray-600">+ R$ {option.price.toFixed(2)}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isSelected ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl text-boracume-orange"
              disabled={removeDisabled}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="w-6 text-center font-bold text-boracume-orange">1</div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl text-boracume-orange opacity-40"
              disabled
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-xl text-boracume-orange"
            disabled={addDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
