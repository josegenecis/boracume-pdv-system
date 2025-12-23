// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const config = { runtime: 'edge' }

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(url, serviceKey)

// In-memory cache for edge function (hot instances will serve faster)
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute server-side cache

export default async function handler(req: Request): Promise<Response> {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  const { searchParams } = new URL(req.url)
  let userId = searchParams.get('userId')

  // Try to get userId from body if not in query params
  if (!userId && req.method === 'POST') {
    try {
      const body = await req.json()
      userId = body.userId
    } catch {}
  }

  if (!userId) return new Response(JSON.stringify({ ok: false, error: 'missing_userId' }), { status: 400, headers })

  // Check cache
  const cached = cache.get(userId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return new Response(JSON.stringify({ ...cached.data, cached: true }), { headers });
  }

  try {
    const [profileResult, categoriesResult, productsResult, deliveryZonesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, restaurant_name, description, logo_url, phone, address, opening_hours')
        .eq('id', userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('product_categories')
        .select('id, name, description, display_order')
        .eq('user_id', userId)
        .order('display_order', { ascending: true }),
      supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('is_available', true)
        .eq('show_in_delivery', true)
        .order('name', { ascending: true }),
      supabase
        .from('delivery_zones')
        .select('id, name, delivery_fee, minimum_order, delivery_time, active')
        .eq('user_id', userId)
        .eq('active', true)
        .order('name', { ascending: true })
    ])

    const responseData = {
      ok: true,
      profile: profileResult.data || null,
      categories: categoriesResult.data || [],
      products: productsResult.data || [],
      deliveryZones: deliveryZonesResult.data || []
    };

    // Update cache
    cache.set(userId, { data: responseData, timestamp: Date.now() });

    return new Response(JSON.stringify(responseData), { headers })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500, headers })
  }
}
