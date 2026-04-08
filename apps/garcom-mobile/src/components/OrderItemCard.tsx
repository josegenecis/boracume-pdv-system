import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import { formatCurrency } from '../lib/format';
import type { OrderItem } from '../types/domain';

type OrderItemCardProps = {
  item: OrderItem;
  onCancelDraft?: () => void;
  cancelling?: boolean;
};

export function OrderItemCard({ item, onCancelDraft, cancelling = false }: OrderItemCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>
          {item.quantity}x {item.productName}
        </Text>
        <Text style={styles.total}>{formatCurrency(item.totalPrice)}</Text>
      </View>
      {item.options.length > 0 ? (
        <Text style={styles.options}>{item.options.map((option) => option.optionName).join(' • ')}</Text>
      ) : null}
      {item.notes ? <Text style={styles.notes}>Obs: {item.notes}</Text> : null}
      <Text style={styles.status}>{item.status === 'draft' ? 'Ainda não enviado' : 'Enviado para produção'}</Text>
      {item.status === 'draft' && onCancelDraft ? (
        <Pressable style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]} onPress={onCancelDraft}>
          <Text style={styles.cancelButtonText}>{cancelling ? 'Cancelando...' : 'Cancelar item'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  total: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  options: {
    color: colors.muted,
    fontSize: 13,
  },
  notes: {
    color: colors.inkSoft,
    fontSize: 13,
  },
  status: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '800',
  },
});
