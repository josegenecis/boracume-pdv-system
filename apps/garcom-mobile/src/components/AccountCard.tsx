import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import { formatCurrency } from '../lib/format';
import type { OrderItem, TableAccount } from '../types/domain';
import { OrderItemCard } from './OrderItemCard';
import { StatusBadge } from './StatusBadge';

type AccountCardProps = {
  account: TableAccount;
  onAddItem: () => void;
  onSendItems: () => void;
  onPay: () => void;
  onRename: () => void;
  onRemove: () => void;
  onCancelDraftItem: (item: OrderItem) => void;
  pendingItemId?: string | null;
  sending?: boolean;
  removing?: boolean;
};

export function AccountCard({
  account,
  onAddItem,
  onSendItems,
  onPay,
  onRename,
  onRemove,
  onCancelDraftItem,
  pendingItemId,
  sending = false,
  removing = false,
}: AccountCardProps) {
  const draftItems = account.items.filter((item) => item.status === 'draft');
  const canRemove = account.items.length === 0 && !removing;
  const canSend = draftItems.length > 0 && !sending;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{account.name}</Text>
          <StatusBadge status={account.status} />
        </View>
        <Text style={styles.total}>{formatCurrency(account.total)}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onRename}>
          <Text style={styles.secondaryText}>Renomear</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, !canRemove && styles.disabledButton]}
          onPress={onRemove}
          disabled={!canRemove}
        >
          <Text style={styles.secondaryText}>{removing ? 'Removendo...' : 'Remover'}</Text>
        </Pressable>
      </View>
      <View style={styles.itemList}>
        {account.items.length ? (
          account.items.map((item) => (
            <OrderItemCard
              key={item.id}
              item={item}
              onCancelDraft={item.status === 'draft' ? () => onCancelDraftItem(item) : undefined}
              cancelling={pendingItemId === item.id}
            />
          ))
        ) : (
          <Text style={styles.empty}>Conta vazia</Text>
        )}
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.softButton} onPress={onAddItem}>
          <Text style={styles.softButtonText}>Adicionar item</Text>
        </Pressable>
        <Pressable
          style={[styles.softButton, !canSend && styles.disabledButton]}
          onPress={onSendItems}
          disabled={!canSend}
        >
          <Text style={styles.softButtonText}>{sending ? 'Enviando...' : 'Enviar pedido'}</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onPay}>
          <Text style={styles.primaryButtonText}>Fechar conta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 18,
  },
  total: {
    color: colors.brandDark,
    fontWeight: '800',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  secondaryText: {
    color: colors.inkSoft,
    fontWeight: '700',
    fontSize: 12,
  },
  itemList: {
    gap: spacing.sm,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  softButton: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  softButtonText: {
    color: colors.ink,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButton: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
});
