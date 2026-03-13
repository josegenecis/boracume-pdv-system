import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';

const digitsOnly = (value: string) => String(value || '').replace(/\D/g, '');

const formatFromRaw = (raw: string) => {
  const cents = parseInt(raw || '0', 10) || 0;
  const value = cents / 100;
  const formatted = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${formatted}`;
};

const rawFromNumber = (value: number) => {
  const cents = Math.round((Number(value) || 0) * 100);
  return String(Math.max(0, cents));
};

type Props = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValueChange: (value: number) => void;
};

export function CurrencyInput({ value, onValueChange, onBlur, ...props }: Props) {
  const [raw, setRaw] = useState(() => rawFromNumber(value));
  const display = useMemo(() => formatFromRaw(raw), [raw]);

  useEffect(() => {
    setRaw(rawFromNumber(value));
  }, [value]);

  return (
    <Input
      {...props}
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const nextRaw = digitsOnly(e.target.value);
        setRaw(nextRaw === '' ? '0' : nextRaw);
      }}
      onBlur={(e) => {
        const cents = parseInt(raw || '0', 10) || 0;
        onValueChange(Math.max(0, cents) / 100);
        onBlur?.(e);
      }}
    />
  );
}

