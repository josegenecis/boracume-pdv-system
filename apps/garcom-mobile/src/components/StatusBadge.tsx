import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import type { AccountStatus, TableStatus } from '../types/domain';

type StatusBadgeProps = {
  status: TableStatus | AccountStatus;
};

const labelMap: Record<string, string> = {
  free: 'Livre',
  occupied: 'Ocupada',
  serving: 'Em atendimento',
  payment_pending: 'Aguardando pagamento',
  open: 'Aberta',
  paid: 'Paga',
};

const colorMap: Record<string, { backgroundColor: string; color: string }> = {
  free: { backgroundColor: colors.successSoft, color: colors.success },
  occupied: { backgroundColor: colors.warningSoft, color: '#9A6B00' },
  serving: { backgroundColor: colors.infoSoft, color: colors.info },
  payment_pending: { backgroundColor: colors.dangerSoft, color: colors.danger },
  open: { backgroundColor: colors.surface, color: colors.inkSoft },
  paid: { backgroundColor: colors.successSoft, color: colors.success },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const palette = colorMap[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.label, { color: palette.color }]}>{labelMap[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
