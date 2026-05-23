import type { PizzaHalfPriceMode } from './pizza-pricing.js';

const CATEGORY_META_PREFIX = '[BORACUME_CATEGORY_META]';
const CATEGORY_META_SUFFIX = '[/BORACUME_CATEGORY_META]';

export type CategoryMetadata = {
  is_pizza?: boolean;
  pizza_half_price_mode?: PizzaHalfPriceMode;
};

type CategoryLike = {
  description?: string | null;
  is_pizza?: boolean | null;
  pizza_half_price_mode?: string | null;
};

export function extractCategoryMetadata(category?: CategoryLike | null): CategoryMetadata {
  if (!category) return {};

  const directMode = category.pizza_half_price_mode === 'split_halves' ? 'split_halves' : 'highest';
  if (category.is_pizza !== undefined && category.is_pizza !== null) {
    return {
      is_pizza: Boolean(category.is_pizza),
      pizza_half_price_mode: directMode
    };
  }

  const description = String(category.description || '');
  const start = description.indexOf(CATEGORY_META_PREFIX);
  const end = description.indexOf(CATEGORY_META_SUFFIX);
  if (start === -1 || end === -1 || end <= start) return {};

  const raw = description.slice(start + CATEGORY_META_PREFIX.length, end).trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      is_pizza: Boolean(parsed?.is_pizza),
      pizza_half_price_mode: parsed?.pizza_half_price_mode === 'split_halves' ? 'split_halves' : 'highest'
    };
  } catch {
    return {};
  }
}

export function stripCategoryMetadata(description?: string | null) {
  const raw = String(description || '');
  const start = raw.indexOf(CATEGORY_META_PREFIX);
  const end = raw.indexOf(CATEGORY_META_SUFFIX);
  if (start === -1 || end === -1 || end <= start) return raw.trim();
  return `${raw.slice(0, start)}${raw.slice(end + CATEGORY_META_SUFFIX.length)}`.trim();
}

export function buildCategoryDescriptionWithMetadata(description: string, metadata: CategoryMetadata) {
  const cleanDescription = stripCategoryMetadata(description);
  const shouldPersistMetadata = Boolean(metadata.is_pizza);
  if (!shouldPersistMetadata) return cleanDescription || null;

  const serialized = JSON.stringify({
    is_pizza: true,
    pizza_half_price_mode: metadata.pizza_half_price_mode === 'split_halves' ? 'split_halves' : 'highest'
  });

  return `${CATEGORY_META_PREFIX}${serialized}${CATEGORY_META_SUFFIX}${cleanDescription ? `\n${cleanDescription}` : ''}`;
}

export function enrichCategoryWithMetadata<T extends CategoryLike & { description?: string | null }>(category: T) {
  const metadata = extractCategoryMetadata(category);
  return {
    ...category,
    description: stripCategoryMetadata(category.description),
    is_pizza: Boolean(metadata.is_pizza),
    pizza_half_price_mode: metadata.pizza_half_price_mode === 'split_halves' ? 'split_halves' : 'highest'
  };
}
