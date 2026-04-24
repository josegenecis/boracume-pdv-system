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
  const [draftValue, setDraftValue] = React.useState(String(value ?? ''));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setDraftValue(String(value ?? ''));
    }
  }, [value, isFocused]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={draftValue}
      onChange={(event) => {
        const nextValue = event.target.value.replace(/\D/g, '');
        setDraftValue(nextValue);
        onValueChange(nextValue);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        const hasValue = String(draftValue).trim() !== '';
        const baseValue = hasValue ? parseInt(draftValue, 10) : undefined;
        if (typeof baseValue === 'number' && Number.isFinite(baseValue)) {
          const normalized = String(clamp(baseValue, min, max));
          setDraftValue(normalized);
          onValueChange(normalized);
        } else if (!hasValue) {
          setDraftValue('');
          onValueChange('');
        }
        onBlur?.(event);
      }}
    />
  );
}
