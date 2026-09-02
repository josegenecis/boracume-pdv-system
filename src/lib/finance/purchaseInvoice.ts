export const PURCHASE_UNITS = ['un', 'kg', 'g', 'l', 'ml', 'cx', 'pct', 'fd', 'bd', 'dz'] as const;
export type PurchaseUnit = typeof PURCHASE_UNITS[number];

const UNIT_ALIASES: Record<string, PurchaseUnit> = {
  un: 'un', und: 'un', unidade: 'un', unidades: 'un',
  kg: 'kg', kgs: 'kg', quilo: 'kg', quilos: 'kg', quilograma: 'kg', quilogramas: 'kg',
  g: 'g', gr: 'g', grama: 'g', gramas: 'g',
  l: 'l', lt: 'l', litro: 'l', litros: 'l',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  cx: 'cx', caixa: 'cx', caixas: 'cx',
  pct: 'pct', pacote: 'pct', pacotes: 'pct',
  fd: 'fd', fardo: 'fd', fardos: 'fd',
  bd: 'bd', balde: 'bd', baldes: 'bd',
  dz: 'dz', duzia: 'dz', dúzia: 'dz', duzias: 'dz', dúzias: 'dz',
};

export const normalizePurchaseUnit = (value: unknown): PurchaseUnit | null => {
  const key = String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\./g, '');
  return UNIT_ALIASES[key] || null;
};

export const convertedStockQuantity = (quantity: unknown, conversionFactor: unknown) => {
  const parsedQuantity = Number(quantity || 0);
  const parsedFactor = Number(conversionFactor || 0);
  if (!Number.isFinite(parsedQuantity) || !Number.isFinite(parsedFactor) || parsedQuantity <= 0 || parsedFactor <= 0) return 0;
  return Number((parsedQuantity * parsedFactor).toFixed(6));
};

export const invoiceItemNeedsUnitConfirmation = (item: {
  control_stock?: boolean;
  unit_confirmed?: boolean;
  unit_source?: string | null;
  confidence?: number;
}) => item.control_stock !== false && (
  item.unit_confirmed === false
  || ['unknown', 'inferred'].includes(String(item.unit_source || '').toLowerCase())
  || Number(item.confidence || 0) < 0.75
);
