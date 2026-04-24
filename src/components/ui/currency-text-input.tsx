import React from 'react';
import { Input } from '@/components/ui/input';
import { formatCurrencyInput } from '@/lib/currency';

const digitsOnly = (value: string) => String(value || '').replace(/\D/g, '');

type Props = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function CurrencyTextInput({ value, onValueChange, onBlur, ...props }: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={formatCurrencyInput(value)}
      onChange={(event) => {
        onValueChange(formatCurrencyInput(digitsOnly(event.target.value)));
      }}
      onBlur={onBlur}
    />
  );
}
