import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../config/theme';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
};

export function FloatingActionButton({ label, onPress }: FloatingActionButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
