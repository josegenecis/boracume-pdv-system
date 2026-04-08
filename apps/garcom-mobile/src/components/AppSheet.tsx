import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../config/theme';

type AppSheetProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>;

export function AppSheet({ visible, title, onClose, children }: AppSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 56,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: colors.ink,
  },
});
