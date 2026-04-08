import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../config/theme';
import { formatCurrency, formatMinutes } from '../lib/format';
import type { RestaurantTable } from '../types/domain';
import { StatusBadge } from './StatusBadge';

type TableCardProps = {
  table: RestaurantTable;
  onPress: () => void;
};

const statusGlow: Record<RestaurantTable['status'], string> = {
  free: colors.success,
  occupied: colors.warning,
  serving: colors.info,
  payment_pending: colors.danger,
};

export function TableCard({ table, onPress }: TableCardProps) {
  return (
    <Pressable style={[styles.card, { borderColor: statusGlow[table.status] }]} onPress={onPress}>
      <View style={styles.row}>
        <Text style={styles.number}>Mesa {table.number}</Text>
        <StatusBadge status={table.status} />
      </View>
      <View style={styles.metaGrid}>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Total</Text>
          <Text style={styles.metaValue}>{formatCurrency(table.total)}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Tempo</Text>
          <Text style={styles.metaValue}>{table.openMinutes ? formatMinutes(table.openMinutes) : '—'}</Text>
        </View>
      </View>
      <Text style={styles.location}>{table.location || 'Salão principal'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1.5,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  number: {
    fontSize: typography.subtitle,
    fontWeight: '800',
    color: colors.ink,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaBlock: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  metaValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  location: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
});
