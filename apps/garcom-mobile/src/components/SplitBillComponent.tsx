import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import { formatCurrency } from '../lib/format';

type SplitBillComponentProps = {
  title: string;
  items: Array<{ id: string; label: string; amount: number }>;
};

export function SplitBillComponent({ title, items }: SplitBillComponentProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: {
    color: colors.muted,
    fontWeight: '600',
  },
  amount: {
    color: colors.ink,
    fontWeight: '800',
  },
});
