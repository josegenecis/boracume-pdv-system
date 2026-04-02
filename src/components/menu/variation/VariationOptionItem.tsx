import React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

interface VariationOption {
  name: string;
  price: number;
  recommended?: boolean;
}

interface VariationOptionItemProps {
  option: VariationOption;
  selectedCount: number;
  freeSelectionsLimit?: number;
  addDisabled: boolean;
  removeDisabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export const VariationOptionItem: React.FC<VariationOptionItemProps> = ({
  option,
  selectedCount,
  freeSelectionsLimit = 0,
  addDisabled,
  removeDisabled,
  onAdd,
  onRemove
}) => {
  const isSelected = selectedCount > 0;
  const priceLabel = option.price > 0
    ? freeSelectionsLimit > 0
      ? `+ R$ ${option.price.toFixed(2)} por adicional`
      : `+ R$ ${option.price.toFixed(2)}`
    : '';
  return (
    <div className={`flex items-center justify-between gap-3 py-3 ${addDisabled && !isSelected ? 'opacity-40' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-900 truncate">{option.name}</div>
          {option.recommended && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              Recomendado
            </span>
          )}
        </div>
        {priceLabel && (
          <div className="text-xs text-gray-600">{priceLabel}</div>
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
            <div className="w-6 text-center font-bold text-boracume-orange">{selectedCount}</div>
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
