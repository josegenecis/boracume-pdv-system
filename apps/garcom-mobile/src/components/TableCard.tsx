import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import { formatMinutes } from '../lib/format';
import type { RestaurantTable } from '../types/domain';

type TableCardProps = {
  table: RestaurantTable;
  onPress: () => void;
};

const tileTone: Record<RestaurantTable['status'], { backgroundColor: string; color: string }> = {
  free: { backgroundColor: '#A4D65E', color: colors.ink },
  occupied: { backgroundColor: '#FF7A00', color: colors.white },
  serving: { backgroundColor: '#FF7A00', color: colors.white },
  preparing: { backgroundColor: '#F2BE49', color: colors.ink },
  ready: { backgroundColor: '#B7E66A', color: colors.ink },
  payment_pending: { backgroundColor: '#E53935', color: colors.white },
  check_requested: { backgroundColor: '#E53935', color: colors.white },
  partially_paid: { backgroundColor: '#FFB347', color: colors.ink },
};

const occupancyLabel = (status: RestaurantTable['status']) => (status === 'free' ? 'Livre' : 'Ocupada');

export function TableCard({ table, onPress }: TableCardProps) {
  const tone = tileTone[table.status] ?? tileTone.occupied;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: tone.backgroundColor }]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
    >
      <View style={styles.badgeWrap}>
        <Text style={[styles.badge, { color: tone.color }]} numberOfLines={1}>
          {occupancyLabel(table.status)}
        </Text>
      </View>
      <View style={styles.numberWrap}>
        <Text style={[styles.number, { color: tone.color }]} adjustsFontSizeToFit numberOfLines={1}>
          {table.number}
        </Text>
        {table.status !== 'free' ? (
          <Text style={[styles.timeText, { color: tone.color }]} numberOfLines={1}>
            {formatMinutes(table.openMinutes || 0)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    padding: spacing.sm,
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.36)',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  badge: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  numberWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    fontSize: 54,
    fontWeight: '800',
    lineHeight: 60,
  },
  timeText: {
    marginTop: -2,
    fontSize: 13,
    fontWeight: '900',
    opacity: 0.82,
  },
});
