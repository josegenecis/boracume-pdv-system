import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import type { PaymentMethod } from '../types/domain';

type PaymentSelectorProps = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
};

const methods: Array<{ id: PaymentMethod; label: string }> = [
  { id: 'cash', label: 'Dinheiro' },
  { id: 'pix', label: 'PIX' },
  { id: 'card', label: 'Cartão' },
];

export function PaymentSelector({ value, onChange }: PaymentSelectorProps) {
  return (
    <View style={styles.row}>
      {methods.map((method) => {
        const active = method.id === value;
        return (
          <Pressable
            key={method.id}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(method.id)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{method.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    flexGrow: 1,
    minWidth: 96,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  optionActive: {
    borderColor: colors.brand,
    backgroundColor: '#FFF1E7',
  },
  label: {
    color: colors.inkSoft,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.brandDark,
  },
});
