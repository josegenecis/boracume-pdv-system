import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gcfyrcpugmducptktjic.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZnlyY3B1Z21kdWNwdGt0amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5MzAwNjUsImV4cCI6MjA2MzUwNjA2NX0.G9l2LEE6DtnSGChmGx5sTCQhC7yVHZJtq6rTTsti2aE';

const MENU_CACHE_TTL_MS = 60 * 1000;
const menuCache = new Map<string, { timestamp: number; payload: any }>();

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function buildLinkedGlobalVariation(link: any, globalVariation: any) {
  if (!link || !globalVariation) return null;

  const required =
    link.required !== undefined && link.required !== null ? Boolean(link.required) : Boolean(globalVariation.required);
  const minSelections =
    link.min_selections !== undefined && link.min_selections !== null
      ? Number(link.min_selections) || 0
      : Number(globalVariation.min_selections) || 0;
  const maxSelections =
    link.max_selections !== undefined && link.max_selections !== null
      ? Number(link.max_selections) || 1
      : Number(globalVariation.max_selections) || 1;

  return {
    ...globalVariation,
    required,
    min_selections: Math.max(0, minSelections),
    max_selections: Math.max(1, maxSelections),
    free_selections_limit: Number(link.free_selections_limit) || 0,
    allow_paid_excess: Boolean(link.allow_paid_excess),
    paid_max_selections:
      link.paid_max_selections !== undefined && link.paid_max_selections !== null
        ? Number(link.paid_max_selections) || Math.max(1, maxSelections)
        : null,
    display_order: link.display_order,
    pricing_mode: link.pricing_mode ?? 'default',
    price_multiplier: link.price_multiplier ?? 1,
    fixed_option_price: link.fixed_option_price ?? null,
    option_price_overrides: link.option_price_overrides ?? {},
  };
}

async function fetchProducts(userId: string) {
  let productsData: any[] | null = null;
  let productsError: any = null;

  const first = await supabase
    .from('products')
    .select(
      'id,name,description,price,original_price,discount_percentage,image_url,is_available,show_in_delivery,is_highlight,highlight_order,order_count,category_id,track_stock,stock_quantity,low_stock_threshold'
    )
    .eq('user_id', userId)
    .eq('is_available', true)
    .eq('show_in_delivery', true)
    .order('name', { ascending: true });

  productsData = first.data as any;
  productsError = first.error as any;

  if (productsError && String(productsError.message || '').includes('highlight_order')) {
    const second = await supabase
      .from('products')
      .select(
        'id,name,description,price,original_price,discount_percentage,image_url,is_available,show_in_delivery,is_highlight,order_count,category_id,track_stock,stock_quantity,low_stock_threshold'
      )
      .eq('user_id', userId)
      .eq('is_available', true)
      .eq('show_in_delivery', true)
      .order('name', { ascending: true });

    productsData = second.data as any;
    productsError = second.error as any;
  }

  if (productsError) throw productsError;
  return Array.isArray(productsData) ? productsData : [];
}

async function fetchMenuPayload(userId: string) {
  const [profileResult, categoriesResult, deliveryZonesResult, deliverySettingsResult, products] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,restaurant_name,description,logo_url,banner_url,phone,address,opening_hours,theme_config')
      .eq('id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('product_categories')
      .select('id,name,description,display_order')
      .eq('user_id', userId)
      .eq('active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('delivery_zones')
      .select('id,name,delivery_fee,minimum_order,delivery_time,active')
      .eq('user_id', userId)
      .eq('active', true)
      .order('name', { ascending: true }),
    supabase
      .from('delivery_settings')
      .select('delivery_areas')
      .eq('user_id', userId)
      .maybeSingle(),
    fetchProducts(userId),
  ]);

  if (profileResult.error && profileResult.error.code !== 'PGRST116') throw profileResult.error;
  if (categoriesResult.error) throw categoriesResult.error;
  if (deliveryZonesResult.error) throw deliveryZonesResult.error;
  if (deliverySettingsResult.error) throw deliverySettingsResult.error;

  const productIds = products.map((product: any) => String(product.id || '').trim()).filter(Boolean);

  let variationPayloadByProduct: Record<string, any[]> = {};
  let variationPresenceByProduct: Record<string, 'has' | 'none'> = {};

  if (productIds.length > 0) {
    const [specificResult, linkResult] = await Promise.all([
      supabase
        .from('product_variations')
        .select('product_id,id,name,required,min_selections,max_selections,free_selections_limit,allow_paid_excess,paid_max_selections,active,options,customer_label,receipt_label,display_order,created_at')
        .in('product_id', productIds as any),
      supabase
        .from('product_global_variation_links')
        .select('product_id,global_variation_id,required,min_selections,max_selections,free_selections_limit,allow_paid_excess,paid_max_selections,display_order,pricing_mode,price_multiplier,fixed_option_price,option_price_overrides')
        .in('product_id', productIds as any)
        .order('display_order', { ascending: true }),
    ]);

    if (specificResult.error) throw specificResult.error;
    if (linkResult.error) throw linkResult.error;

    const specificByProduct = new Map<string, any[]>();
    for (const row of Array.isArray(specificResult.data) ? specificResult.data : []) {
      const productId = String((row as any)?.product_id || '').trim();
      if (!productId) continue;
      const current = specificByProduct.get(productId) || [];
      current.push(row);
      specificByProduct.set(productId, current);
    }

    const linksByProduct = new Map<string, any[]>();
    const globalIds = Array.from(
      new Set(
        (Array.isArray(linkResult.data) ? linkResult.data : [])
          .map((row: any) => String(row?.global_variation_id || '').trim())
          .filter(Boolean)
      )
    );

    for (const row of Array.isArray(linkResult.data) ? linkResult.data : []) {
      const productId = String((row as any)?.product_id || '').trim();
      if (!productId) continue;
      const current = linksByProduct.get(productId) || [];
      current.push(row);
      linksByProduct.set(productId, current);
    }

    let globalsById = new Map<string, any>();
    if (globalIds.length > 0) {
      const globalResult = await supabase
        .from('global_variations')
        .select('id,name,required,min_selections,max_selections,active,options,customer_label,receipt_label')
        .in('id', globalIds as any);

      if (globalResult.error) throw globalResult.error;
      globalsById = new Map(
        (Array.isArray(globalResult.data) ? globalResult.data : []).map((row: any) => [String(row.id), row])
      );
    }

    for (const productId of productIds) {
      const specificRows = (specificByProduct.get(productId) || []).filter((item: any) => item?.active !== false);
      const globalRows = (linksByProduct.get(productId) || [])
        .map((link: any) => buildLinkedGlobalVariation(link, globalsById.get(String(link.global_variation_id))))
        .filter((item: any) => item && item.active !== false);

      const payload = [...specificRows, ...globalRows];
      variationPayloadByProduct[productId] = payload;
      variationPresenceByProduct[productId] = payload.length > 0 ? 'has' : 'none';
    }
  }

  return {
    ok: true,
    profile: profileResult.data || null,
    categories: categoriesResult.data || [],
    products,
    deliveryZones: deliveryZonesResult.data || [],
    deliverySettings: deliverySettingsResult.data?.delivery_areas || null,
    variationPayloadByProduct,
    variationPresenceByProduct,
  };
}

export default async function handler(req: any, res: any) {
  try {
    const userId = String(req?.query?.userId || req?.query?.id || '').trim();
    if (!userId) {
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'missing_userId' }));
      return;
    }

    const cached = menuCache.get(userId);
    if (cached && Date.now() - cached.timestamp < MENU_CACHE_TTL_MS) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300');
      res.end(JSON.stringify({ ...cached.payload, cached: true }));
      return;
    }

    const payload = await fetchMenuPayload(userId);
    menuCache.set(userId, { timestamp: Date.now(), payload });

    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(JSON.stringify(payload));
  } catch (error: any) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: String(error?.message || error || 'internal error') }));
  }
}
