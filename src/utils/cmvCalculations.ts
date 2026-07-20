export interface CmvProduct {
  id: string;
  name: string;
  price: number;
}

export interface CmvRecipe {
  product_id: string;
  quantity: number;
  waste_percentage?: number | null;
  ingredient?: { cost_price?: number | null } | null;
}

export interface CmvOrder {
  id: string;
  total: number;
  delivery_fee?: number | null;
  items: unknown;
  cmv_snapshot?: unknown;
}

export interface CmvProductMetric {
  key: string;
  productId: string | null;
  name: string;
  salePrice: number;
  theoreticalUnitCost: number;
  quantitySold: number;
  netRevenue: number;
  realizedCost: number;
  grossContribution: number;
  cmvPercentage: number;
  abcClass: 'A' | 'B' | 'C' | 'N/A';
  hasRecipe: boolean;
  hasSales: boolean;
}

export interface CmvReport {
  products: CmvProductMetric[];
  netRevenue: number;
  realizedCmv: number;
  grossContribution: number;
  cmvPercentage: number;
  ordersWithSnapshot: number;
  totalOrders: number;
}

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const arrayValue = (value: unknown): JsonRecord[] => {
  if (Array.isArray(value)) return value.filter(isJsonRecord);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(isJsonRecord) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const snapshotItems = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== 'object') return [];
  return arrayValue((snapshot as { items?: unknown }).items);
};

export const buildTheoreticalCostMap = (recipes: CmvRecipe[]) => {
  const result = new Map<string, number>();
  for (const recipe of recipes) {
    const cost = numberValue(recipe.ingredient?.cost_price);
    const quantity = Math.max(0, numberValue(recipe.quantity));
    const wasteMultiplier = 1 + Math.max(0, numberValue(recipe.waste_percentage)) / 100;
    result.set(recipe.product_id, (result.get(recipe.product_id) || 0) + cost * quantity * wasteMultiplier);
  }
  return result;
};

export const calculateWeightedAverageCost = (params: {
  currentStock: number;
  currentUnitCost: number;
  purchasedUnits: number;
  purchaseTotal: number;
}) => {
  const currentStock = Math.max(0, numberValue(params.currentStock));
  const purchasedUnits = Math.max(0, numberValue(params.purchasedUnits));
  const totalUnits = currentStock + purchasedUnits;
  if (totalUnits <= 0) return 0;
  const currentValue = currentStock * Math.max(0, numberValue(params.currentUnitCost));
  return (currentValue + Math.max(0, numberValue(params.purchaseTotal))) / totalUnits;
};

export const buildCmvReport = (products: CmvProduct[], recipes: CmvRecipe[], orders: CmvOrder[]): CmvReport => {
  const theoreticalCosts = buildTheoreticalCostMap(recipes);
  const productById = new Map(products.map(product => [product.id, product]));
  const metrics = new Map<string, CmvProductMetric>();

  const ensureMetric = (productId: string | null, name: string) => {
    const product = productId ? productById.get(productId) : undefined;
    const key = productId || `unlinked:${name.trim().toLocaleLowerCase('pt-BR')}`;
    const existing = metrics.get(key);
    if (existing) return existing;
    const theoreticalUnitCost = productId ? theoreticalCosts.get(productId) || 0 : 0;
    const metric: CmvProductMetric = {
      key,
      productId,
      name: product?.name || name || 'Produto não identificado',
      salePrice: numberValue(product?.price),
      theoreticalUnitCost,
      quantitySold: 0,
      netRevenue: 0,
      realizedCost: 0,
      grossContribution: 0,
      cmvPercentage: 0,
      abcClass: 'N/A',
      hasRecipe: theoreticalUnitCost > 0,
      hasSales: false,
    };
    metrics.set(key, metric);
    return metric;
  };

  products.forEach(product => ensureMetric(product.id, product.name));
  let ordersWithSnapshot = 0;

  for (const order of orders) {
    const capturedItems = snapshotItems(order.cmv_snapshot);
    if (capturedItems.length > 0) {
      ordersWithSnapshot += 1;
      for (const item of capturedItems) {
        const productId = typeof item.product_id === 'string' && item.product_id ? item.product_id : null;
        const metric = ensureMetric(productId, String(item.product_name || 'Produto'));
        metric.quantitySold += Math.max(0, numberValue(item.quantity));
        metric.netRevenue += Math.max(0, numberValue(item.net_revenue, numberValue(item.gross_revenue)));
        metric.realizedCost += Math.max(0, numberValue(item.total_cost));
        metric.hasRecipe ||= item.has_recipe === true;
        metric.hasSales = true;
      }
      continue;
    }

    const items = arrayValue(order.items);
    const grossItems = items.reduce((sum, item) => {
      const quantity = Math.max(0, numberValue(item.quantity, 1));
      return sum + Math.max(0, numberValue(item.subtotal, numberValue(item.total_price, numberValue(item.price) * quantity)));
    }, 0);
    const netProducts = Math.max(0, numberValue(order.total) - Math.max(0, numberValue(order.delivery_fee)));

    for (const item of items) {
      const productIdCandidate = String(item.product_id || item.id || '');
      const productId = productById.has(productIdCandidate) ? productIdCandidate : null;
      const quantity = Math.max(0, numberValue(item.quantity, 1));
      const grossRevenue = Math.max(0, numberValue(item.subtotal, numberValue(item.total_price, numberValue(item.price) * quantity)));
      const netRevenue = grossItems > 0 ? grossRevenue * netProducts / grossItems : grossRevenue;
      const metric = ensureMetric(productId, String(item.product_name || item.name || 'Produto'));
      metric.quantitySold += quantity;
      metric.netRevenue += netRevenue;
      metric.realizedCost += metric.theoreticalUnitCost * quantity;
      metric.hasSales = true;
    }
  }

  const rows = Array.from(metrics.values());
  for (const metric of rows) {
    metric.grossContribution = metric.netRevenue - metric.realizedCost;
    metric.cmvPercentage = metric.netRevenue > 0
      ? metric.realizedCost / metric.netRevenue * 100
      : metric.salePrice > 0
        ? metric.theoreticalUnitCost / metric.salePrice * 100
        : 0;
  }

  const soldRows = rows.filter(row => row.netRevenue > 0).sort((a, b) => b.netRevenue - a.netRevenue);
  const totalRevenue = soldRows.reduce((sum, row) => sum + row.netRevenue, 0);
  let cumulative = 0;
  soldRows.forEach(row => {
    const shareBeforeProduct = totalRevenue > 0 ? cumulative / totalRevenue * 100 : 100;
    row.abcClass = shareBeforeProduct < 70 ? 'A' : shareBeforeProduct < 90 ? 'B' : 'C';
    cumulative += row.netRevenue;
  });

  rows.sort((a, b) => b.netRevenue - a.netRevenue || a.name.localeCompare(b.name, 'pt-BR'));
  const realizedCmv = rows.reduce((sum, row) => sum + row.realizedCost, 0);
  const netRevenue = rows.reduce((sum, row) => sum + row.netRevenue, 0);
  return {
    products: rows,
    netRevenue,
    realizedCmv,
    grossContribution: netRevenue - realizedCmv,
    cmvPercentage: netRevenue > 0 ? realizedCmv / netRevenue * 100 : 0,
    ordersWithSnapshot,
    totalOrders: orders.length,
  };
};
