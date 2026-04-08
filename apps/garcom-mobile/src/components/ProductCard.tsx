import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../config/theme';
import { formatCurrency } from '../lib/format';
import type { Product } from '../types/domain';

type ProductCardProps = {
  product: Product;
  onPress: () => void;
};

export function ProductCard({ product, onPress }: ProductCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{product.name}</Text>
        {product.featured ? <Text style={styles.favorite}>★</Text> : null}
      </View>
      {product.description ? <Text style={styles.description}>{product.description}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
        <Text style={styles.cta}>Adicionar</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  favorite: {
    color: colors.warning,
    fontWeight: '900',
  },
  description: {
    color: colors.muted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    color: colors.brandDark,
    fontWeight: '800',
    fontSize: 15,
  },
  cta: {
    color: colors.inkSoft,
    fontWeight: '700',
    fontSize: 12,
  },
});
