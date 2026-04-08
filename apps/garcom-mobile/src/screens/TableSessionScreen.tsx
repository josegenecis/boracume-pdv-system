import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountCard } from '../components/AccountCard';
import { AppSheet } from '../components/AppSheet';
import { colors, radius, spacing } from '../config/theme';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { formatCurrency, formatTime } from '../lib/format';
import { queryClient } from '../lib/queryClient';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  cancelDraftItem,
  createAccount,
  getSessionDetails,
  getSessionTotal,
  listenRestaurantRealtime,
  removeEmptyAccount,
  renameAccount,
  sendAccountItems,
} from '../services/waiterApp';
import type { TableAccount } from '../types/domain';

type Props = NativeStackScreenProps<RootStackParamList, 'TableSession'>;

export function TableSessionScreen({ navigation, route }: Props) {
  const { operator } = useAuthSession();
  const [accountEditorVisible, setAccountEditorVisible] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [editingAccount, setEditingAccount] = useState<TableAccount | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [sendingAccountId, setSendingAccountId] = useState<string | null>(null);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['session', route.params.sessionId],
    queryFn: () => getSessionDetails(route.params.sessionId),
  });

  useEffect(() => {
    if (!operator?.restaurantId) {
      return;
    }
    const unsubscribePromise = listenRestaurantRealtime(operator.restaurantId, () => {
      queryClient.invalidateQueries({ queryKey: ['session', route.params.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['tables', operator.restaurantId] });
    });
    return () => {
      unsubscribePromise.then((unsubscribe) => unsubscribe());
    };
  }, [operator?.restaurantId, route.params.sessionId]);

  const total = useMemo(
    () => getSessionTotal(sessionQuery.data?.accounts ?? []),
    [sessionQuery.data?.accounts],
  );

  async function handleSend(account: TableAccount) {
    if (!operator) {
      return;
    }
    const draftCount = account.items.filter((item) => item.status === 'draft').length;
    if (draftCount === 0) {
      Alert.alert('Nada para enviar', 'Essa conta não possui itens novos.');
      return;
    }
    Alert.alert(
      'Enviar pedido',
      `Enviar ${draftCount} ${draftCount === 1 ? 'item novo' : 'itens novos'} da ${account.name} para produção?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              setSendingAccountId(account.id);
              await sendAccountItems(route.params.sessionId, account, operator);
              queryClient.invalidateQueries({ queryKey: ['session', route.params.sessionId] });
            } catch (error) {
              Alert.alert('Não foi possível enviar', error instanceof Error ? error.message : 'Tente novamente.');
            } finally {
              setSendingAccountId(null);
            }
          },
        },
      ],
    );
  }

  async function handleAccountSave() {
    if (!operator || !sessionQuery.data || !accountName.trim() || savingAccount) {
      return;
    }
    try {
      setSavingAccount(true);
      if (editingAccount) {
        await renameAccount(editingAccount.id, accountName.trim());
      } else {
        await createAccount(route.params.sessionId, operator.restaurantId, accountName.trim(), operator.id);
      }
      setAccountEditorVisible(false);
      setEditingAccount(null);
      setAccountName('');
      queryClient.invalidateQueries({ queryKey: ['session', route.params.sessionId] });
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleRemove(account: TableAccount) {
    if (account.items.length > 0) {
      Alert.alert('Conta com itens', 'Só é possível remover contas vazias.');
      return;
    }
    Alert.alert('Remover conta', `Deseja remover a ${account.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            setRemovingAccountId(account.id);
            await removeEmptyAccount(account.id);
            queryClient.invalidateQueries({ queryKey: ['session', route.params.sessionId] });
          } catch (error) {
            Alert.alert('Não foi possível remover', error instanceof Error ? error.message : 'Tente novamente.');
          } finally {
            setRemovingAccountId(null);
          }
        },
      },
    ]);
  }

  async function handleCancelDraft(account: TableAccount, itemId: string) {
    Alert.alert('Cancelar item', `Remover este item rascunho da ${account.name}?`, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar item',
        style: 'destructive',
        onPress: async () => {
          try {
            setCancellingItemId(itemId);
            await cancelDraftItem(itemId, account.id, route.params.sessionId);
            queryClient.invalidateQueries({ queryKey: ['session', route.params.sessionId] });
          } catch (error) {
            Alert.alert('Não foi possível cancelar', error instanceof Error ? error.message : 'Tente novamente.');
          } finally {
            setCancellingItemId(null);
          }
        },
      },
    ]);
  }

  if (sessionQuery.isLoading || !sessionQuery.data) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.title}>Mesa {sessionQuery.data.tableNumber}</Text>
              <Text style={styles.subtitle}>
                Aberta às {formatTime(sessionQuery.data.openedAt)} • {sessionQuery.data.guestCount} pessoas
              </Text>
            </View>
            <Pressable
              style={styles.paymentButton}
              onPress={() => navigation.navigate('Payments', { sessionId: route.params.sessionId })}
            >
              <Text style={styles.paymentButtonText}>Pagamento</Text>
            </Pressable>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total geral da mesa</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Contas ativas</Text>
          <Pressable
            style={styles.addAccountButton}
            onPress={() => {
              setEditingAccount(null);
              setAccountName(`Conta ${sessionQuery.data.accounts.length + 1}`);
              setAccountEditorVisible(true);
            }}
          >
            <Text style={styles.addAccountText}>Nova conta</Text>
          </Pressable>
        </View>

        <View style={styles.accountList}>
          {sessionQuery.data.accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onAddItem={() =>
                navigation.navigate('ProductCatalog', {
                  sessionId: route.params.sessionId,
                  accountId: account.id,
                })
              }
              onSendItems={() => handleSend(account)}
              onPay={() =>
                navigation.navigate('Payments', {
                  sessionId: route.params.sessionId,
                  accountId: account.id,
                })
              }
              onRename={() => {
                setEditingAccount(account);
                setAccountName(account.name);
                setAccountEditorVisible(true);
              }}
              onRemove={() => handleRemove(account)}
              onCancelDraftItem={(item) => handleCancelDraft(account, item.id)}
              pendingItemId={cancellingItemId}
              sending={sendingAccountId === account.id}
              removing={removingAccountId === account.id}
            />
          ))}
        </View>

        <View style={styles.historyCard}>
          <Text style={styles.sectionTitle}>Histórico</Text>
          <View style={styles.historyList}>
            {sessionQuery.data.history.length ? (
              sessionQuery.data.history.map((entry) => (
                <View key={entry.id} style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyLabel}>{entry.label}</Text>
                    <Text style={styles.historyTime}>{formatTime(entry.timestamp)}</Text>
                  </View>
                  <Text style={styles.historyAmount}>
                    {entry.amount ? formatCurrency(entry.amount) : 'Evento'}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHistory}>Sem eventos ainda</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <AppSheet
        visible={accountEditorVisible}
        title={editingAccount ? 'Renomear conta' : 'Nova conta'}
        onClose={() => {
          setAccountEditorVisible(false);
          setEditingAccount(null);
        }}
      >
        <TextInput value={accountName} onChangeText={setAccountName} style={styles.input} />
        <Pressable
          style={[styles.primaryAction, savingAccount && styles.disabledAction]}
          onPress={handleAccountSave}
          disabled={savingAccount}
        >
          <Text style={styles.primaryActionText}>
            {savingAccount ? 'Salvando...' : editingAccount ? 'Salvar' : 'Criar conta'}
          </Text>
        </Pressable>
      </AppSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    gap: spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  paymentButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  paymentButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
  totalCard: {
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  totalLabel: {
    color: colors.muted,
    fontWeight: '600',
  },
  totalValue: {
    color: colors.brandDark,
    fontWeight: '900',
    fontSize: 28,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 18,
  },
  addAccountButton: {
    borderRadius: radius.pill,
    backgroundColor: '#FFE9DB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addAccountText: {
    color: colors.brandDark,
    fontWeight: '800',
  },
  accountList: {
    gap: spacing.md,
  },
  historyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyText: {
    flex: 1,
    gap: 2,
  },
  historyLabel: {
    color: colors.ink,
    fontWeight: '700',
  },
  historyTime: {
    color: colors.muted,
    fontSize: 12,
  },
  historyAmount: {
    color: colors.inkSoft,
    fontWeight: '800',
  },
  emptyHistory: {
    color: colors.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryAction: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  disabledAction: {
    opacity: 0.5,
  },
  primaryActionText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});
