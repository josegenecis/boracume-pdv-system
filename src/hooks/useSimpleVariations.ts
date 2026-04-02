import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { perfStart } from '@/utils/perf';

type VariationOption = { name: string; price: number; recommended?: boolean };
type VariationPricingMode = 'default' | 'free' | 'half' | 'multiplier' | 'fixed';
type VariationOptionOverride = {
  price?: number;
  label?: string;
  hidden?: boolean;
  display_order?: number;
  recommended?: boolean;
};

export type Variation = {
  id: string;
  name: string;
  customer_label?: string;
  receipt_label?: string;
  display_order?: number;
  required: boolean;
  min_selections: number;
  max_selections: number;
  standard_max_selections: number;
  free_selections_limit: number;
  allow_paid_excess: boolean;
  paid_max_selections?: number;
  pricing_mode: VariationPricingMode;
  price_multiplier?: number;
  fixed_option_price?: number | null;
  option_price_overrides?: Record<string, VariationOptionOverride>;
  options: VariationOption[];
};

const TTL_MS = 10 * 60 * 1000;
const LS_PREFIX = 'boracume_variations_v3:';
const cache = new Map<string, { ts: number; data: Variation[] }>();
const inflight = new Map<string, Promise<Variation[]>>();

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries: number) {
  let lastErr: any = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(Math.min(1500, 200 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

function parseOptions(raw: any): any[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const names = String(raw).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      return names.map((name) => ({ name, price: 0 }));
    }
  }
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return Object.entries(raw).map(([name, price]) => ({ name, price: Number(price) || 0 }));
  return [];
}

function normalizeVariation(item: any): Variation | null {
  if (!item || !item.id) return null;
  const name = String(item.name || '').trim();
  if (!name) return null;
  const customerLabel = String(item.customer_label || '').trim();
  const receiptLabel = String(item.receipt_label || '').trim();
  const displayOrderRaw = item.display_order !== undefined && item.display_order !== null ? Number(item.display_order) : undefined;
  const displayOrder = displayOrderRaw !== undefined && Number.isFinite(displayOrderRaw) ? Math.max(0, Math.floor(displayOrderRaw)) : undefined;
  const maxSelections = item.max_selections !== undefined && item.max_selections !== null ? Math.max(1, Number(item.max_selections) || 1) : 1;
  const minSelectionsRaw = item.min_selections !== undefined && item.min_selections !== null ? Math.max(0, Number(item.min_selections) || 0) : 0;
  const allowPaidExcess = Boolean(item.allow_paid_excess);
  const paidMaxSelections = allowPaidExcess ? Math.max(maxSelections, Number(item.paid_max_selections) || maxSelections) : undefined;
  const effectiveMaxSelections = paidMaxSelections ?? maxSelections;
  const freeSelectionsLimit = Math.min(effectiveMaxSelections, Math.max(0, Number(item.free_selections_limit) || 0));
  const isActive = item.active !== false;
  const pricingMode = ['free', 'half', 'multiplier', 'fixed'].includes(String(item.pricing_mode || '').trim())
    ? String(item.pricing_mode || '').trim() as VariationPricingMode
    : 'default';
  const priceMultiplier = pricingMode === 'half'
    ? 0.5
    : pricingMode === 'multiplier'
      ? Math.max(0, Number(item.price_multiplier) || 1)
      : 1;
  const fixedOptionPrice = pricingMode === 'fixed'
    ? Math.max(0, Number(item.fixed_option_price) || 0)
    : null;
  const optionPriceOverrides = typeof item.option_price_overrides === 'object' && item.option_price_overrides
    ? Object.fromEntries(
        Object.entries(item.option_price_overrides).map(([name, value]) => {
          if (typeof value === 'number') return [String(name), { price: Math.max(0, Number(value) || 0) }];
          if (!value || typeof value !== 'object') return [String(name), {}];
          return [String(name), {
            ...(value.price !== undefined && value.price !== null ? { price: Math.max(0, Number(value.price) || 0) } : {}),
            ...(value.label ? { label: String(value.label).trim() } : {}),
            ...(value.hidden ? { hidden: true } : {}),
            ...(value.recommended ? { recommended: true } : {}),
            ...(value.display_order !== undefined && value.display_order !== null ? { display_order: Math.max(0, Math.floor(Number(value.display_order) || 0)) } : {})
          }];
        })
      )
    : {};
  const processedOptions = parseOptions(item.options);
  const validOptions: VariationOption[] = [];
  for (const opt of processedOptions as any[]) {
    if (!opt?.name) continue;
    const optionName = String(opt.name).trim();
    if (!optionName) continue;
    const optionBasePrice = opt.price !== undefined && opt.price !== null ? Number(opt.price) : 0;
    const safeBasePrice = Number.isFinite(optionBasePrice) ? Math.max(0, optionBasePrice) : 0;
    let adjustedPrice = safeBasePrice;
    const overrideConfig = optionPriceOverrides[optionName] || {};
    if (overrideConfig.hidden) continue;
    if (overrideConfig.price !== undefined) {
      adjustedPrice = overrideConfig.price;
    } else {
      if (pricingMode === 'free') adjustedPrice = 0;
      if (pricingMode === 'half') adjustedPrice = safeBasePrice * 0.5;
      if (pricingMode === 'multiplier') adjustedPrice = safeBasePrice * priceMultiplier;
      if (pricingMode === 'fixed') adjustedPrice = fixedOptionPrice ?? 0;
    }
    validOptions.push({
      name: String(overrideConfig.label || optionName).trim() || optionName,
      price: Number.isFinite(adjustedPrice) ? Math.max(0, adjustedPrice) : 0,
      ...(overrideConfig.recommended ? { recommended: true } : {}),
      ...(overrideConfig.display_order !== undefined ? { display_order: overrideConfig.display_order } : {})
    } as any);
  }
  const orderedOptions = validOptions
    .sort((a: any, b: any) => {
      const orderA = a?.display_order !== undefined ? Number(a.display_order) : Number.POSITIVE_INFINITY;
      const orderB = b?.display_order !== undefined ? Number(b.display_order) : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    })
    .map(({ display_order, ...option }: any) => option);
  if (orderedOptions.length === 0 || !isActive) return null;
  const required = Boolean(item.required ?? item.is_required ?? false);
  const minSelections = required ? Math.max(1, minSelectionsRaw) : minSelectionsRaw;
  return {
    id: String(item.id),
    name,
    customer_label: customerLabel || undefined,
    receipt_label: receiptLabel || undefined,
    display_order: displayOrder,
    required,
    min_selections: Math.min(minSelections, effectiveMaxSelections),
    max_selections: effectiveMaxSelections,
    standard_max_selections: maxSelections,
    free_selections_limit: freeSelectionsLimit,
    allow_paid_excess: allowPaidExcess,
    paid_max_selections: paidMaxSelections,
    pricing_mode: pricingMode,
    price_multiplier: priceMultiplier,
    fixed_option_price: fixedOptionPrice,
    option_price_overrides: optionPriceOverrides,
    options: orderedOptions
  };
}

function lsKey(productId: string) {
  return `${LS_PREFIX}${String(productId || '').trim()}`;
}

function loadFromLocalStorage(productId: string): { ts: number; data: Variation[] } | null {
  try {
    const raw = localStorage.getItem(lsKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed.ts !== 'number' || !Array.isArray(parsed.data)) return null;
    const ts = Number(parsed.ts);
    if (!Number.isFinite(ts)) return null;
    const data = (parsed.data || []).map((v: any) => normalizeVariation(v)).filter(Boolean) as Variation[];
    return { ts, data };
  } catch {
    return null;
  }
}

function saveToLocalStorage(productId: string, data: Variation[]) {
  try {
    const key = lsKey(productId);
    const payload = JSON.stringify({ ts: Date.now(), data });
    localStorage.setItem(key, payload);
  } catch {}
}

async function fetchVariationsUncached(productId: string): Promise<Variation[]> {
  const span = perfStart('menu.variations.fetch', { productId });
  try {
    try {
      const { data: j, status } = await withRetry(() => invokeEdgeFunction<any>('product-variations-public', { productId }, { timeoutMs: 7000 }).then((r) => r as any), 2);
      if (status === 200 && j?.ok && Array.isArray(j.variations)) {
        return (j.variations || []).map((item: any) => normalizeVariation(item)).filter(Boolean) as Variation[];
      }
    } catch {}

    const [{ data: productVariations, error: productError }, { data: globalLinks, error: globalError }] = await Promise.all([
      withRetry(() => supabase.from('product_variations').select('id,name,required,max_selections,free_selections_limit,allow_paid_excess,paid_max_selections,active,options,customer_label,receipt_label,display_order,created_at').eq('product_id', productId) as any, 2),
      withRetry(() => supabase.from('product_global_variation_links').select('global_variation_id,required,min_selections,max_selections,free_selections_limit,allow_paid_excess,paid_max_selections,display_order,pricing_mode,price_multiplier,fixed_option_price,option_price_overrides').eq('product_id', productId).order('display_order', { ascending: true }) as any, 2)
    ]);

    if (productError) throw productError;
    if (globalError) throw globalError;

    const linkRows = Array.isArray(globalLinks) ? globalLinks : [];
    const linkIds = linkRows.map((l: any) => l.global_variation_id).filter(Boolean);
    let globalVariations: any[] = [];
    if (linkIds.length > 0) {
      const { data: globalVars, error: globalVarError } = await withRetry(() => supabase.from('global_variations').select('id,name,required,max_selections,active,options,customer_label,receipt_label').in('id', linkIds as any) as any, 2);
      if (globalVarError) throw globalVarError;
      const base = Array.isArray(globalVars) ? globalVars : [];
      const byId = new Map(linkRows.map((l: any) => [String(l.global_variation_id), l]));
      const baseById = new Map(base.map((gv: any) => [String(gv.id), gv]));
      globalVariations = linkRows
        .map((link: any) => {
          const gv = baseById.get(String(link.global_variation_id));
          if (!gv) return null;
          return {
            ...gv,
            required: link.required !== undefined && link.required !== null ? Boolean(link.required) : gv.required,
            min_selections: link.min_selections ?? 0,
            max_selections: link.max_selections ?? gv.max_selections,
            free_selections_limit: (link as any).free_selections_limit ?? 0,
            allow_paid_excess: Boolean((link as any).allow_paid_excess),
            paid_max_selections: (link as any).paid_max_selections ?? null,
            display_order: link.display_order,
            pricing_mode: (link as any).pricing_mode ?? 'default',
            price_multiplier: (link as any).price_multiplier ?? 1,
            fixed_option_price: (link as any).fixed_option_price ?? null,
            option_price_overrides: (link as any).option_price_overrides ?? {}
          };
        })
        .filter(Boolean) as any[];
    }

    const normalized = [...(Array.isArray(productVariations) ? productVariations : []), ...globalVariations]
      .map((item: any) => normalizeVariation(item))
      .filter(Boolean) as Variation[];

    const sorted = normalized.sort((a, b) => {
      const ao = a.display_order !== undefined ? a.display_order : 10_000;
      const bo = b.display_order !== undefined ? b.display_order : 10_000;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return sorted;
  } catch {
    return [];
  } finally {
    span.end();
  }
}

export function prefetchSimpleVariations(productId: string) {
  const key = String(productId || '').trim();
  if (!key) return Promise.resolve([] as Variation[]);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return Promise.resolve(cached.data);
  const local = loadFromLocalStorage(key);
  if (local && Date.now() - local.ts < TTL_MS) {
    cache.set(key, local);
    return Promise.resolve(local.data);
  }
  const running = inflight.get(key);
  if (running) return running;
  const p = fetchVariationsUncached(key)
    .then((data) => {
      cache.set(key, { ts: Date.now(), data });
      saveToLocalStorage(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function useSimpleVariations() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchVariations = async (productId: string): Promise<Variation[]> => {
    const key = String(productId || '').trim();
    if (!key) return [];

    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    const local = loadFromLocalStorage(key);
    if (local && Date.now() - local.ts < TTL_MS) {
      cache.set(key, local);
      return local.data;
    }

    const running = inflight.get(key);
    if (running) return running;

    setIsLoading(true);
    const p = fetchVariationsUncached(key)
      .then((data) => {
        cache.set(key, { ts: Date.now(), data });
        saveToLocalStorage(key, data);
        return data;
      })
      .finally(() => {
        inflight.delete(key);
        setIsLoading(false);
      });

    inflight.set(key, p);
    return p;
  };

  const calculateVariationPrice = (selectedVariations: Record<string, string[]>, variations: Variation[]) => {
    let total = 0;
    for (const variation of variations) {
      const selected = selectedVariations[variation.id] || [];
      let freeRemaining = Math.max(0, Number(variation.free_selections_limit || 0));
      for (const optionName of selected) {
        const option = variation.options.find((opt) => opt.name === optionName);
        if (!option) continue;
        if (freeRemaining > 0) {
          freeRemaining -= 1;
          continue;
        }
        total += option.price;
      }
    }
    return total;
  };

  const getSelectedVariationsText = (selectedVariations: Record<string, string[]>) => {
    const texts: string[] = [];
    for (const options of Object.values(selectedVariations)) {
      texts.push(...options);
    }
    return Array.from(new Set(texts));
  };

  const getSelectedVariationsTextWithReceiptLabels = (selectedVariations: Record<string, string[]>, variations: Variation[]) => {
    const texts: string[] = [];
    for (const variation of variations) {
      const selected = selectedVariations[variation.id] || [];
      if (selected.length === 0) continue;
      const label = String(variation.receipt_label || variation.name || '').trim();
      if (!label) continue;
      texts.push(`${label}: ${selected.join(', ')}`);
    }
    return texts;
  };

  return { isLoading, fetchVariations, calculateVariationPrice, getSelectedVariationsText, getSelectedVariationsTextWithReceiptLabels };
}

