import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppSheet } from '../components/AppSheet';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { TableCard } from '../components/TableCard';
import { colors, radius, spacing } from '../config/theme';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { queryClient } from '../lib/queryClient';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { listenRestaurantRealtime, listRestaurantTables, openTableSession } from '../services/waiterApp';
import type { RestaurantTable } from '../types/domain';

type Props = NativeStackScreenProps<RootStackParamList, 'Tables'>;

export function TablesScreen({ navigation }: Props) {
  const { operator, signOut } = useAuthSession();
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [guestCount, setGuestCount] = useState('2');

  const tablesQuery = useQuery({
    queryKey: ['tables', operator?.restaurantId],
    enabled: Boolean(operator?.restaurantId),
    queryFn: () => listRestaurantTables(operator!.restaurantId),
  });

  useEffect(() => {
    if (!operator?.restaurantId) {
      return;
    }
    const unsubscribePromise = listenRestaurantRealtime(operator.restaurantId, () => {
      queryClient.invalidateQueries({ queryKey: ['tables', operator.restaurantId] });
    });
    return () => {
      unsubscribePromise.then((unsubscribe) => unsubscribe());
    };
  }, [operator?.restaurantId]);

  const stats = useMemo(() => {
    const rows = tablesQuery.data ?? [];
    return {
      free: rows.filter((table) => table.status === 'free').length,
      active: rows.filter((table) => table.status !== 'free').length,
    };
  }, [tablesQuery.data]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Salão em tempo real</Text>
            <Text style={styles.subtitle}>
              {operator ? `${operator.name} • ${stats.active} mesas ativas` : 'Carregando operador'}
            </Text>
          </View>
          <Pressable style={styles.exitButton} onPress={signOut}>
            <Text style={styles.exitText}>Sair</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.free}</Text>
            <Text style={styles.summaryLabel}>Livres</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats.active}</Text>
            <Text style={styles.summaryLabel}>Em operação</Text>
          </View>
        </View>

        {tablesQuery.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : (
          <FlatList
            data={tablesQuery.data ?? []}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.column}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                tintColor={colors.brand}
                refreshing={tablesQuery.isRefetching}
                onRefresh={() => tablesQuery.refetch()}
              />
            }
            renderItem={({ item }) => <TableCard table={item} onPress={() => handleTablePress(item)} />}
          />
        )}

        <FloatingActionButton
          label="Nova mesa"
          onPress={() => {
            const freeTable = tablesQuery.data?.find((table) => table.status === 'free') ?? null;
            setSelectedTable(freeTable);
          }}
        />

        <AppSheet
          visible={Boolean(selectedTable)}
          title={selectedTable ? `Abrir Mesa ${selectedTable.number}` : 'Abrir mesa'}
          onClose={() => setSelectedTable(null)}
        >
          <Text style={styles.sheetLabel}>Número de pessoas</Text>
          <TextInput
            keyboardType="number-pad"
            value={guestCount}
            onChangeText={setGuestCount}
            style={styles.sheetInput}
          />
          <Pressable style={styles.sheetButton} onPress={handleOpenSession}>
            <Text style={styles.sheetButtonText}>Criar sessão e contas</Text>
          </Pressable>
        </AppSheet>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  exitButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exitText: {
    color: colors.ink,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: {
    color: colors.brandDark,
    fontWeight: '900',
    fontSize: 24,
  },
  summaryLabel: {
    color: colors.muted,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: 120,
    gap: spacing.md,
  },
  column: {
    gap: spacing.md,
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
