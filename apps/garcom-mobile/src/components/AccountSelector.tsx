import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import type { TableAccount } from '../types/domain';

type AccountSelectorProps = {
  accounts: TableAccount[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
};

export function AccountSelector({ accounts, selectedAccountId, onSelect }: AccountSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
      {accounts.map((account) => {
        const active = selectedAccountId === account.id;
        return (
          <Pressable
            key={account.id}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(account.id)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{account.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  pillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  label: {
    color: colors.inkSoft,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.white,
  },
});
