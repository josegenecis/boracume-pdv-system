import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSheet } from '../components/AppSheet';
import { TableCard } from '../components/TableCard';
import { colors, radius, spacing } from '../config/theme';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { queryClient } from '../lib/queryClient';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { listRestaurantTables, openTableSession } from '../services/waiterApp';
import type { RestaurantTable } from '../types/domain';

type Props = NativeStackScreenProps<RootStackParamList, 'Tables'>;

const loginLogo = require('../../assets/login-logo.png');

export function TablesScreen({ navigation }: Props) {
  const { operator, signOut } = useAuthSession();
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [guestCount, setGuestCount] = useState('2');

  const tablesQuery = useQuery({
    queryKey: ['tables', operator?.restaurantId],
    enabled: Boolean(operator?.restaurantId),
    queryFn: () => listRestaurantTables(operator!.restaurantId),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const rows = tablesQuery.data ?? [];

  const stats = useMemo(
    () => ({
      free: rows.filter((table) => table.status === 'free').length,
      active: rows.filter((table) => table.status !== 'free').length,
    }),
    [rows],
  );

  async function handleTablePress(table: RestaurantTable) {
    if (table.sessionId) {
      navigation.navigate('TableSession', { sessionId: table.sessionId });
      return;
    }
    setSelectedTable(table);
  }

  async function handleOpenSession() {
    if (!selectedTable || !operator) {
      return;
    }

    const sessionId = await openTableSession({
      tableId: selectedTable.id,
      tableNumber: selectedTable.number,
      guestCount: Math.max(1, Number(guestCount || 1)),
      operator,
    });

    setSelectedTable(null);
    queryClient.invalidateQueries({ queryKey: ['tables', operator.restaurantId] });
    navigation.navigate('TableSession', { sessionId });
  }

  function openFirstSession() {
    const table = rows.find((current) => current.sessionId);
    if (table?.sessionId) {
      navigation.navigate('TableSession', { sessionId: table.sessionId });
    }
  }

  function openFirstReceivable() {
    const table = rows.find((current) => current.sessionId && current.total > 0);
    if (table?.sessionId) {
      navigation.navigate('TableSession', { sessionId: table.sessionId });
    }
  }

  function openFreeTable() {
    const freeTable = rows.find((table) => table.status === 'free') ?? null;
    setSelectedTable(freeTable);
  }

  return (
    <LinearGradient colors={['#0B5138', '#083927', '#072C1F']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.logoutRow}>
            <Pressable style={styles.logoutButton} onPress={signOut}>
              <Text style={styles.logoutText}>Sair</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Image source={loginLogo} style={styles.logo} resizeMode="contain" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>App Garçom</Text>
            </View>
            <Text style={styles.title}>Mesas</Text>
            <Text style={styles.subtitle}>{operator?.name || 'Garçom'}</Text>
          </View>

          <View style={styles.quickGrid}>
            <Pressable style={styles.quickButton}>
              <Text style={styles.quickIcon}>▦</Text>
              <Text style={styles.quickText}>Mesas</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={openFirstSession}>
              <Text style={styles.quickIcon}>☰</Text>
              <Text style={styles.quickText}>Comandas</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={openFirstSession}>
              <Text style={styles.quickIcon}>✓</Text>
              <Text style={styles.quickText}>Pedidos</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={openFirstReceivable}>
              <Text style={styles.quickIcon}>R$</Text>
              <Text style={styles.quickText}>Receber</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={() => tablesQuery.refetch()}>
              <Text style={styles.quickIcon}>↻</Text>
              <Text style={styles.quickText}>Atualizar</Text>
            </Pressable>
          </View>

          {tablesQuery.error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>Não foi possível sincronizar as mesas agora.</Text>
            </View>
          ) : null}

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{stats.free}</Text>
              <Text style={styles.statLabel}>livres</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{stats.active}</Text>
              <Text style={styles.statLabel}>ocupadas</Text>
            </View>
          </View>

          <View style={styles.listWrap}>
            {tablesQuery.isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.brand} />
              </View>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(item) => item.id}
                numColumns={3}
                columnWrapperStyle={styles.column}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    tintColor={colors.brand}
                    refreshing={tablesQuery.isRefetching}
                    onRefresh={() => tablesQuery.refetch()}
                  />
                }
                renderItem={({ item }) => <TableCard table={item} onPress={() => handleTablePress(item)} />}
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyTitle}>Nenhuma mesa encontrada</Text>
                    <Text style={styles.emptyText}>Cadastre uma mesa no sistema para iniciar o atendimento.</Text>
                  </View>
                }
              />
            )}
          </View>

          <View style={styles.bottomNav}>
            <Pressable style={[styles.navItem, styles.navItemActive]}>
              <Text style={styles.navIcon}>▦</Text>
              <Text style={styles.navText}>Mesas</Text>
            </Pressable>
            <Pressable style={styles.navItem} onPress={openFreeTable}>
              <Text style={styles.navIcon}>＋</Text>
              <Text style={styles.navText}>Nova mesa</Text>
            </Pressable>
            <Pressable style={styles.navItem} onPress={() => tablesQuery.refetch()}>
              <Text style={styles.navIcon}>↻</Text>
              <Text style={styles.navText}>Atualizar</Text>
            </Pressable>
            <Pressable style={styles.navItem} onPress={signOut}>
              <Text style={styles.navIcon}>↪</Text>
              <Text style={styles.navText}>Sair</Text>
            </Pressable>
          </View>

          <AppSheet
            visible={Boolean(selectedTable)}
            title={selectedTable ? `Abrir Mesa ${selectedTable.number}` : 'Abrir mesa'}
            onClose={() => setSelectedTable(null)}
          >
            {selectedTable ? (
              <>
                <Text style={styles.sheetHint}>
                  Defina quantas comandas iniciais devem nascer na abertura desta mesa.
                </Text>
                <Text style={styles.sheetLabel}>Quantidade inicial de comandas</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={guestCount}
                  onChangeText={(value) => setGuestCount(value.replace(/\D/g, '').slice(0, 2))}
                  style={styles.sheetInput}
                />
                <Pressable style={styles.sheetButton} onPress={handleOpenSession}>
                  <Text style={styles.sheetButtonText}>Entrar no atendimento</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.sheetHint}>Não encontrei mesa livre para abrir agora.</Text>
            )}
          </AppSheet>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  logoutRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  logoutButton: {
    minWidth: 58,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.white,
    fontWeight: '800',
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  logo: {
    width: 240,
    height: 82,
  },
  badge: {
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: spacing.sm,
    color: colors.white,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 15,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickButton: {
    flexBasis: '30%',
    flexGrow: 1,
    minHeight: 74,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  quickIcon: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
  },
  quickText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  errorBox: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(239,68,68,0.92)',
    padding: spacing.md,
  },
  errorText: {
    color: colors.white,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  statPill: {
    minWidth: 116,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  statValue: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 18,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  listWrap: {
    flex: 1,
    marginHorizontal: -2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 110,
    gap: spacing.md,
  },
  column: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  emptyBox: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  bottomNav: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.sm,
    minHeight: 72,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    shadowColor: 'rgba(0, 0, 0, 0.34)',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 20,
    paddingVertical: spacing.xs,
  },
  navItemActive: {
    backgroundColor: '#FFF2E8',
  },
  navIcon: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '900',
  },
  navText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  sheetHint: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  sheetLabel: {
    color: colors.ink,
    fontWeight: '700',
  },
  sheetInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceAlt,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  sheetButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sheetButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
});
