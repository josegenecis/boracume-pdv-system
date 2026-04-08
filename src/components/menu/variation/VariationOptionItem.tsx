import React from 'react';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/currency';
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
      ? `+ ${formatBRL(option.price)} por adicional`
      : `+ ${formatBRL(option.price)}`
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
          <div className="text-xs font-medium" style={{ color: 'var(--menu-primary, #85C441)' }}>{priceLabel}</div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isSelected ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={removeDisabled}
              style={{ color: 'var(--menu-primary, #85C441)', borderColor: 'color-mix(in srgb, var(--menu-primary, #85C441) 22%, #d1d5db)' }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="w-6 text-center text-sm font-bold" style={{ color: 'var(--menu-primary, #85C441)' }}>{selectedCount}</div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={addDisabled}
              style={{ color: 'var(--menu-primary, #85C441)', borderColor: 'color-mix(in srgb, var(--menu-primary, #85C441) 22%, #d1d5db)' }}
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
            className="h-9 w-9 rounded-xl"
            disabled={addDisabled}
            style={{ color: 'var(--menu-primary, #85C441)', borderColor: 'color-mix(in srgb, var(--menu-primary, #85C441) 22%, #d1d5db)' }}
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
