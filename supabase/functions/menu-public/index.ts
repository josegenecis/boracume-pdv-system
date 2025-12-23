// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const config = { runtime: 'edge' }

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(url, serviceKey)

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ ok: false, error: 'missing_userId' }, { status: 400 })

  try {
    const { data: profileArr } = await supabase
      .from('profiles')
      .select('id, restaurant_name, description, logo_url, phone, address, opening_hours')
      .eq('id', userId)
      .limit(1)

    const { data: categories } = await supabase
      .from('product_categories')
      .select('id, name, description, display_order')
      .eq('user_id', userId)
      .order('display_order', { ascending: true })

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_available', true)
      .eq('show_in_delivery', true)
      .order('name', { ascending: true })

    const { data: deliveryZones } = await supabase
      .from('delivery_zones')
      .select('id, name, delivery_fee, minimum_order, delivery_time, active')
      .eq('user_id', userId)
      .eq('active', true)
      .order('name', { ascending: true })

    return Response.json({
      ok: true,
      profile: Array.isArray(profileArr) && profileArr.length ? profileArr[0] : null,
      categories: categories || [],
      products: products || [],
      deliveryZones: deliveryZones || []
    })
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
