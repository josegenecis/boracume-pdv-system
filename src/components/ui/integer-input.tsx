import React from 'react';
import { Input } from '@/components/ui/input';

const clamp = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === 'number') next = Math.max(min, next);
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
};

type Props = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  fallback?: number;
};

export function IntegerInput({
  value,
  onValueChange,
  min,
  max,
  fallback,
  onBlur,
  ...props
}: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(event) => {
        onValueChange(event.target.value.replace(/\D/g, ''));
      }}
      onBlur={(event) => {
        const hasValue = String(value).trim() !== '';
        const baseValue = hasValue ? parseInt(value, 10) : fallback;
        if (typeof baseValue === 'number' && Number.isFinite(baseValue)) {
          onValueChange(String(clamp(baseValue, min, max)));
        }
        onBlur?.(event);
      }}
    />
  );
}
