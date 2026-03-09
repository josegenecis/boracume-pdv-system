import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { invokeEdgeFunction } from '@/utils/invokeEdgeFunction';
import { perfStart } from '@/utils/perf';

type VariationOption = { name: string; price: number };

type Variation = {
  id: string;
  name: string;
  required: boolean;
  max_selections: number;
  options: VariationOption[];
};

const TTL_MS = 10 * 60 * 1000;
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
  const maxSelections = item.max_selections !== undefined && item.max_selections !== null ? Math.max(1, Number(item.max_selections) || 1) : 1;
  const processedOptions = parseOptions(item.options);
  const validOptions: VariationOption[] = [];
  for (const opt of processedOptions as any[]) {
    if (!opt?.name) continue;
    const optionName = String(opt.name).trim();
    if (!optionName) continue;
    const optionPrice = opt.price !== undefined && opt.price !== null ? Number(opt.price) : 0;
    validOptions.push({ name: optionName, price: Number.isFinite(optionPrice) ? Math.max(0, optionPrice) : 0 });
  }
  if (validOptions.length === 0) return null;
  return {
    id: String(item.id),
    name,
    required: Boolean(item.required ?? item.is_required ?? false),
    max_selections: maxSelections,
    options: validOptions
  };
}

async function fetchVariationsUncached(productId: string): Promise<Variation[]> {
  const span = perfStart('menu.variations.fetch', { productId });
  try {
    let isAuthenticated = false;
    try {
      const { data } = await supabase.auth.getSession();
      isAuthenticated = !!data?.session?.access_token;
    } catch {}

    if (!isAuthenticated) {
      try {
        const { data: j } = await withRetry(() => invokeEdgeFunction<any>('product-variations-public', { productId }).then((r) => r as any), 2);
        if (j?.ok && Array.isArray(j.variations)) {
          return (j.variations || [])
            .map((item: any) => normalizeVariation({ ...item, options: parseOptions(item.options) }))
            .filter(Boolean) as Variation[];
        }
      } catch {}
    }

    const [{ data: productVariations, error: productError }, { data: globalLinks, error: globalError }] = await Promise.all([
      withRetry(() => supabase.from('product_variations').select('*').eq('product_id', productId) as any, 2),
      withRetry(() => supabase.from('product_global_variation_links').select('global_variation_id').eq('product_id', productId) as any, 2)
    ]);

    if (productError) throw productError;
    if (globalError) throw globalError;

    const linkIds = Array.isArray(globalLinks) ? globalLinks.map((l: any) => l.global_variation_id).filter(Boolean) : [];
    let globalVariations: any[] = [];
    if (linkIds.length > 0) {
      const { data: globalVars, error: globalVarError } = await withRetry(() => supabase.from('global_variations').select('*').in('id', linkIds as any) as any, 2);
      if (globalVarError) throw globalVarError;
      globalVariations = Array.isArray(globalVars) ? globalVars : [];
    }

    const combined = [...(Array.isArray(productVariations) ? productVariations : []), ...globalVariations];
    return combined.map((item: any) => normalizeVariation(item)).filter(Boolean) as Variation[];
  } catch {
    return [];
  } finally {
    span.end();
  }
}

export function useSimpleVariations() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchVariations = async (productId: string): Promise<Variation[]> => {
    const key = String(productId || '').trim();
    if (!key) return [];

    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    const running = inflight.get(key);
    if (running) return running;

    setIsLoading(true);
    const p = fetchVariationsUncached(key)
      .then((data) => {
        cache.set(key, { ts: Date.now(), data });
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
      for (const optionName of selected) {
        const option = variation.options.find((opt) => opt.name === optionName);
        if (option) total += option.price;
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

  return { isLoading, fetchVariations, calculateVariationPrice, getSelectedVariationsText };
}

