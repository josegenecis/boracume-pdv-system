import React from 'react';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/currency';
import { Minus, Plus } from 'lucide-react';

interface VariationOption {
  name: string;
  price: number;
  display_price?: number;
  recommended?: boolean;
}

interface VariationOptionItemProps {
  option: VariationOption;
  selectedCount: number;
  freeSelectionsLimit?: number;
  hidePriceLabel?: boolean;
  addDisabled: boolean;
  removeDisabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export const VariationOptionItem: React.FC<VariationOptionItemProps> = ({
  option,
  selectedCount,
  freeSelectionsLimit = 0,
  hidePriceLabel = false,
  addDisabled,
  removeDisabled,
  onAdd,
  onRemove
}) => {
  const isSelected = selectedCount > 0;
  const shownPrice = Number(option.display_price ?? option.price ?? 0);
  const priceLabel = !hidePriceLabel && shownPrice > 0
    ? freeSelectionsLimit > 0
      ? `+ ${formatBRL(shownPrice)} por adicional`
      : `+ ${formatBRL(shownPrice)}`
    : '';
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3 py-3 ${addDisabled && !isSelected ? 'opacity-40' : ''}`}>
      <div className="min-w-0 pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium leading-snug text-gray-900 break-words whitespace-normal">{option.name}</div>
          {option.recommended && (
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ color: 'var(--menu-tag, #85C441)', backgroundColor: 'color-mix(in srgb, var(--menu-tag, #85C441) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--menu-tag, #85C441) 18%, transparent)' }}>
              Recomendado
            </span>
          )}
        </div>
        {priceLabel && (
          <div className="mt-1 text-xs font-medium leading-snug break-words whitespace-normal" style={{ color: 'var(--menu-price, #EF6C20)' }}>
            {priceLabel}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 self-center">
        {isSelected ? (
          <div className="flex items-center gap-1 sm:gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg sm:h-9 sm:w-9 sm:rounded-xl"
              disabled={removeDisabled}
              style={{ color: 'var(--menu-primary, #85C441)', borderColor: 'color-mix(in srgb, var(--menu-primary, #85C441) 22%, #d1d5db)' }}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <div className="min-w-[1.5rem] text-center text-sm font-bold" style={{ color: 'var(--menu-primary, #85C441)' }}>{selectedCount}</div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg sm:h-9 sm:w-9 sm:rounded-xl"
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
            className="h-8 w-8 rounded-lg sm:h-9 sm:w-9 sm:rounded-xl"
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
