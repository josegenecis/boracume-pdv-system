export type PizzaHalfPriceMode = 'highest' | 'split_halves';

export type PizzaCategoryConfig = {
  is_pizza?: boolean | null;
  pizza_half_price_mode?: PizzaHalfPriceMode | null;
};

export type PizzaVariationOptionLike = {
  name: string;
  price: number;
  base_price?: number;
};

export type PizzaVariationLike = {
  id: string;
  name: string;
  pricing_mode?: 'default' | 'free' | 'half' | 'multiplier' | 'fixed';
  free_selections_limit?: number;
  options: PizzaVariationOptionLike[];
};

export function getPizzaHalfPriceMode(category?: PizzaCategoryConfig | null): PizzaHalfPriceMode {
  return category?.pizza_half_price_mode === 'split_halves' ? 'split_halves' : 'highest';
}

export function isPizzaCategory(category?: PizzaCategoryConfig | null): boolean {
  return Boolean(category?.is_pizza);
}

export function isPizzaFlavorVariation(
  variation: Pick<PizzaVariationLike, 'name' | 'pricing_mode'>,
  category?: PizzaCategoryConfig | null
): boolean {
  if (!isPizzaCategory(category)) return false;
  if (variation.pricing_mode === 'half') return true;
  const name = String(variation.name || '').trim().toLowerCase();
  return name.includes('sabor');
}

export function getPizzaOptionBasePrice(option: PizzaVariationOptionLike, isHalfVariation: boolean) {
  if (option.base_price !== undefined && option.base_price !== null) {
    return Math.max(0, Number(option.base_price) || 0);
  }
  const displayed = Math.max(0, Number(option.price) || 0);
  return isHalfVariation ? displayed * 2 : displayed;
}

export function calculatePizzaFlavorPrice(
  selectedOptionNames: string[],
  variation: PizzaVariationLike,
  category?: PizzaCategoryConfig | null
) {
  if (!selectedOptionNames.length) return 0;

  const selectedOptions = selectedOptionNames
    .map((optionName) => variation.options.find((option) => option.name === optionName))
    .filter(Boolean) as PizzaVariationOptionLike[];

  if (selectedOptions.length === 0) return 0;

  const isHalfVariation = variation.pricing_mode === 'half';
  const basePrices = selectedOptions.map((option) => getPizzaOptionBasePrice(option, isHalfVariation));

  if (selectedOptions.length === 1) {
    return basePrices[0] || 0;
  }

  if (getPizzaHalfPriceMode(category) === 'split_halves') {
    return basePrices.reduce((sum, price) => sum + price / 2, 0);
  }

  return Math.max(...basePrices);
}
