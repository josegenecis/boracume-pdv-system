import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountSelector } from '../components/AccountSelector';
import { AppSheet } from '../components/AppSheet';
import { ProductCard } from '../components/ProductCard';
import { colors, radius, spacing } from '../config/theme';
import { useAuthSession } from '../contexts/AuthSessionContext';
import { queryClient } from '../lib/queryClient';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { addItemToAccount, getSessionDetails, listCatalog } from '../services/waiterApp';
import type { Product, ProductOption } from '../types/domain';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductCatalog'>;

export function ProductCatalogScreen({ navigation, route }: Props) {
  const { operator } = useAuthSession();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState(route.params.accountId);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [selectedOptionsByGroup, setSelectedOptionsByGroup] = useState<Record<string, ProductOption[]>>({});
  const [submitting, setSubmitting] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ['session', route.params.sessionId],
    queryFn: () => getSessionDetails(route.params.sessionId),
  });

  const catalogQuery = useQuery({
    queryKey: ['catalog', operator?.restaurantId],
    enabled: Boolean(operator?.restaurantId),
    queryFn: () => listCatalog(operator!.restaurantId),
  });

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const filteredCategories = useMemo(() => {
    return (catalogQuery.data ?? [])
      .map((category) => ({
        ...category,
        products: category.products.filter((product) => {
          const matchesCategory = !selectedCategoryId || category.id === selectedCategoryId;
          const matchesSearch = !debouncedSearch || product.name.toLowerCase().includes(debouncedSearch);
          return matchesCategory && matchesSearch;
        }),
      }))
      .filter((category) => category.products.length > 0);
  }, [catalogQuery.data, debouncedSearch, selectedCategoryId]);

  function resetComposer(product: Product) {
    setSelectedProduct(product);
    setQuantity('1');
    setNotes('');
    setSelectedOptionsByGroup({});
  }

  function toggleOption(groupId: string, option: ProductOption, maxSelections: number) {
    const current = selectedOptionsByGroup[groupId] ?? [];
    const exists = current.some((item) => item.id === option.id);
    if (exists) {
      setSelectedOptionsByGroup({
        ...selectedOptionsByGroup,
        [groupId]: current.filter((item) => item.id !== option.id),
      });
      return;
    }
    const next = maxSelections === 1 ? [option] : [...current, option].slice(-maxSelections);
    setSelectedOptionsByGroup({
      ...selectedOptionsByGroup,
      [groupId]: next,
    });
  }

  function getMissingRequiredGroups(product: Product) {
    return product.variations.filter(
      (group) => group.required && (selectedOptionsByGroup[group.id]?.length ?? 0) === 0,
    );
  }

  async function handleAdd() {
    if (!selectedProduct || !selectedAccountId || submitting) {
      return;
    }
    const parsedQuantity = Math.max(1, Number(quantity || 1));
    const missingGroups = getMissingRequiredGroups(selectedProduct);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Quantidade inválida', 'Informe uma quantidade válida para continuar.');
      return;
    }
    if (missingGroups.length > 0) {
      Alert.alert(
        'Seleções obrigatórias',
        `Selecione: ${missingGroups.map((group) => group.name).join(', ')}.`,
      );
      return;
    }
    const selectedOptions = Object.values(selectedOptionsByGroup).flat();
    setSubmitting(true);
    try {
      await addItemToAccount({
        sessionId: route.params.sessionId,
        accountId: selectedAccountId,
        product: selectedProduct,
        quantity: parsedQuantity,
        notes: notes.trim(),
        selectedOptions,
      });
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ['session', route.params.sessionId] });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Não foi possível adicionar', error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Lançar pedido</Text>
          <Text style={styles.subtitle}>Selecione uma conta, busque e adicione com poucos toques.</Text>
        </View>

        <AccountSelector
          accounts={sessionQuery.data?.accounts ?? []}
          selectedAccountId={selectedAccountId}
          onSelect={setSelectedAccountId}
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar produto"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {(catalogQuery.data ?? []).map((category) => {
            const active = selectedCategoryId === category.id;
            return (
              <Pressable
                key={category.id}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setSelectedCategoryId(active ? null : category.id)}
              >
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.catalog}>
          {filteredCategories.map((category) => (
            <View key={category.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{category.name}</Text>
              <View style={styles.productList}>
                {category.products.map((product) => (
                  <ProductCard key={product.id} product={product} onPress={() => resetComposer(product)} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <AppSheet
          visible={Boolean(selectedProduct)}
          title={selectedProduct?.name ?? 'Adicionar item'}
          onClose={() => setSelectedProduct(null)}
        >
          <Text style={styles.sheetLabel}>Conta obrigatória</Text>
          <AccountSelector
            accounts={sessionQuery.data?.accounts ?? []}
            selectedAccountId={selectedAccountId}
            onSelect={setSelectedAccountId}
          />
          <Text style={styles.sheetLabel}>Quantidade</Text>
          <TextInput
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
            style={styles.input}
          />
          {selectedProduct?.variations.map((group) => (
            <View key={group.id} style={styles.groupCard}>
              <Text style={styles.groupTitle}>
                {group.name}
                {group.required ? ' *' : ''}
              </Text>
              <Text style={styles.groupHint}>
                {group.maxSelections === 1 ? 'Escolha 1 opção' : `Escolha até ${group.maxSelections} opções`}
              </Text>
              <View style={styles.optionList}>
                {group.options.map((option) => {
                  const active = (selectedOptionsByGroup[group.id] ?? []).some((item) => item.id === option.id);
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.optionButton, active && styles.optionButtonActive]}
                      onPress={() => toggleOption(group.id, option, group.maxSelections)}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>
                        {option.name}
                        {option.price ? ` • +${option.price.toFixed(2)}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {group.required && (selectedOptionsByGroup[group.id]?.length ?? 0) === 0 ? (
                <Text style={styles.groupError}>Seleção obrigatória</Text>
              ) : null}
            </View>
          ))}
          <Text style={styles.sheetLabel}>Observação</Text>
          <TextInput
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Sem cebola, ponto da carne, alergia..."
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.notesInput]}
          />
          <Pressable
            style={[styles.primaryButton, (!selectedAccountId || submitting) && styles.disabledButton]}
            disabled={!selectedAccountId || submitting}
            onPress={handleAdd}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? 'Adicionando...' : 'Adicionar à comanda'}
            </Text>
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
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontWeight: '900',
    fontSize: 24,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 16,
  },
  categoryRow: {
    gap: spacing.sm,
  },
  categoryPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  categoryText: {
    color: colors.inkSoft,
    fontWeight: '700',
  },
  categoryTextActive: {
    color: colors.white,
  },
  catalog: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 18,
  },
  productList: {
    gap: spacing.sm,
  },
  sheetLabel: {
    color: colors.ink,
    fontWeight: '700',
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
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  groupCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  groupTitle: {
    color: colors.ink,
    fontWeight: '800',
  },
  groupHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  groupError: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '700',
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionButtonActive: {
    borderColor: colors.brand,
    backgroundColor: '#FFF1E7',
  },
  optionText: {
    color: colors.inkSoft,
    fontWeight: '700',
    fontSize: 12,
  },
  optionTextActive: {
    color: colors.brandDark,
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
