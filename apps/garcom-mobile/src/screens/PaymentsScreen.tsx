import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentSelector } from '../components/PaymentSelector';
import { SplitBillComponent } from '../components/SplitBillComponent';
import { colors, radius, spacing } from '../config/theme';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { formatCurrency } from '../lib/format';
import { queryClient } from '../lib/queryClient';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  buildEqualSplit,
  buildItemSplit,
  getSessionDetails,
  getSessionTotal,
  recordPayment,
} from '../services/waiterApp';
import type { PaymentMethod } from '../types/domain';

type Props = NativeStackScreenProps<RootStackParamList, 'Payments'>;

export function PaymentsScreen({ navigation, route }: Props) {
  const { operator } = useAuthSession();
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [processingAccountId, setProcessingAccountId] = useState<string | null>(null);
  const [processingTotal, setProcessingTotal] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ['session', route.params.sessionId],
    queryFn: () => getSessionDetails(route.params.sessionId),
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  const targetAccount = useMemo(
    () => sessionQuery.data?.accounts.find((account) => account.id === route.params.accountId) ?? null,
    [route.params.accountId, sessionQuery.data?.accounts],
  );

  const total = useMemo(
    () => getSessionTotal(sessionQuery.data?.accounts ?? []),
    [sessionQuery.data?.accounts],
  );

  const splitByPerson = useMemo(
    () => buildEqualSplit(total, sessionQuery.data?.guestCount ?? 0),
    [sessionQuery.data?.guestCount, total],
  );

  const splitByAccount = useMemo(
    () => buildItemSplit(sessionQuery.data?.accounts ?? []),
    [sessionQuery.data?.accounts],
  );

  async function handlePayment(accountId?: string) {
    if (!operator || !sessionQuery.data) {
      return;
    }
    const amount = accountId
      ? sessionQuery.data.accounts.find((account) => account.id === accountId)?.total ?? 0
      : total;
    if (amount <= 0) {
      Alert.alert('Nada para receber', 'O valor dessa cobrança está zerado.');
      return;
    }
    const label = accountId
      ? sessionQuery.data.accounts.find((account) => account.id === accountId)?.name ?? 'essa conta'
      : 'a mesa inteira';
    Alert.alert(
      'Confirmar pagamento',
      `Registrar ${formatCurrency(amount)} via ${method.toUpperCase()} para ${label}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              if (accountId) {
                setProcessingAccountId(accountId);
              } else {
                setProcessingTotal(true);
              }
              await recordPayment(route.params.sessionId, accountId ?? null, amount, method, operator);
              queryClient.invalidateQueries({ queryKey: ['session', route.params.sessionId] });
              queryClient.invalidateQueries({ queryKey: ['tables', operator.restaurantId] });
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                'Não foi possível registrar',
                error instanceof Error ? error.message : 'Tente novamente.',
              );
            } finally {
              setProcessingAccountId(null);
              setProcessingTotal(false);
            }
          },
        },
      ],
    );
  }

  if (sessionQuery.isLoading) {
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
          <Text style={styles.title}>Fechamento da mesa</Text>
          <Text style={styles.subtitle}>
            {targetAccount ? `Pagamento individual de ${targetAccount.name}` : 'Pagamento total da mesa'}
          </Text>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Valor a receber</Text>
            <Text style={styles.totalValue}>{formatCurrency(targetAccount?.total ?? total)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forma de pagamento</Text>
          <PaymentSelector value={method} onChange={setMethod} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Divisões sugeridas</Text>
          <SplitBillComponent title="Igualmente por pessoa" items={splitByPerson} />
          <SplitBillComponent title="Por conta" items={splitByAccount} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contas</Text>
          <View style={styles.accountList}>
            {(sessionQuery.data?.accounts ?? []).map((account) => (
              <View key={account.id} style={styles.accountRow}>
                <View>
                  <Text style={styles.accountName}>{account.name}</Text>
                  <Text style={styles.accountMeta}>{account.status === 'paid' ? 'Paga' : 'Aberta'}</Text>
                </View>
                <View style={styles.accountActions}>
                  <Text style={styles.accountValue}>{formatCurrency(account.total)}</Text>
                  <Pressable
                    style={[
                      styles.accountButton,
                      (account.status === 'paid' || processingAccountId === account.id || processingTotal) &&
                        styles.accountButtonDisabled,
                    ]}
                    disabled={account.status === 'paid' || processingAccountId === account.id || processingTotal}
                    onPress={() => handlePayment(account.id)}
                  >
                    <Text style={styles.accountButtonText}>
                      {processingAccountId === account.id ? 'Processando...' : 'Pagar conta'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        {!targetAccount ? (
          <Pressable
            style={[styles.primaryButton, processingTotal && styles.accountButtonDisabled]}
            onPress={() => handlePayment()}
            disabled={processingTotal || Boolean(processingAccountId)}
          >
            <Text style={styles.primaryButtonText}>
              {processingTotal ? 'Processando...' : 'Finalizar pagamento total'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryButton, processingAccountId === targetAccount.id && styles.accountButtonDisabled]}
            onPress={() => handlePayment(targetAccount.id)}
            disabled={processingAccountId === targetAccount.id || processingTotal}
          >
            <Text style={styles.primaryButtonText}>
              {processingAccountId === targetAccount.id ? 'Processando...' : 'Finalizar pagamento da conta'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
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
  title: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 26,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  totalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
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
    fontSize: 30,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 18,
  },
  accountList: {
    gap: spacing.sm,
  },
  accountRow: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  accountName: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
  },
  accountMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  accountActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  accountValue: {
    color: colors.brandDark,
    fontWeight: '900',
  },
  accountButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  accountButtonDisabled: {
    opacity: 0.35,
  },
  accountButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 16,
  },
});
