// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const config = { runtime: 'edge' }

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!
const supabase = createClient(url, serviceKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

const { searchParams } = new URL(req.url)
  let productId = searchParams.get('productId') || ''
  if (!productId) {
    const body = await req.json().catch(() => ({}))
    productId = String(body?.productId || '')
  }
  if (!productId) return new Response(JSON.stringify({ ok: false, error: 'missing_productId' }), { status: 200, headers: corsHeaders })
  try {
    const [{ data: productVars }, { data: links }] = await Promise.all([
      supabase
        .from('product_variations')
        .select('id,name,required,min_selections,max_selections,free_selections_limit,allow_paid_excess,paid_max_selections,active,options,customer_label,receipt_label,display_order')
        .eq('product_id', productId),
      supabase
        .from('product_global_variation_links')
        .select('global_variation_id,required,min_selections,max_selections,free_selections_limit,allow_paid_excess,paid_max_selections,display_order,pricing_mode,price_multiplier,fixed_option_price,option_price_overrides')
        .eq('product_id', productId)
        .order('display_order', { ascending: true })
    ])

    let globals: any[] = []
    if (Array.isArray(links) && links.length) {
      const ids = links.map(l => l.global_variation_id)
      const { data: globalVars } = await supabase
        .from('global_variations')
        .select('id,name,required,min_selections,max_selections,active,options,customer_label,receipt_label')
        .in('id', ids)
      const byId = new Map((links || []).map((l: any) => [String(l.global_variation_id), l]))
      globals = (globalVars || []).map((v: any) => {
        const link = byId.get(String(v.id))
        const required = link?.required !== undefined && link?.required !== null ? !!link.required : !!v.required
        const minSel = link?.min_selections !== undefined && link?.min_selections !== null ? Number(link.min_selections) || 0 : Number(v.min_selections) || 0
        const maxSel = link?.max_selections !== undefined && link?.max_selections !== null ? Number(link.max_selections) || 1 : (v as any)?.max_selections ?? 1
        return {
          ...v,
          required,
          min_selections: Math.max(0, minSel),
          max_selections: Math.max(1, maxSel),
          free_selections_limit: Number(link?.free_selections_limit) || 0,
          allow_paid_excess: !!link?.allow_paid_excess,
            paid_max_selections: link?.paid_max_selections !== undefined && link?.paid_max_selections !== null ? Number(link.paid_max_selections) || Math.max(1, maxSel) : null,
            pricing_mode: (link as any)?.pricing_mode ?? 'default',
            price_multiplier: (link as any)?.price_multiplier ?? 1,
            fixed_option_price: (link as any)?.fixed_option_price ?? null,
            option_price_overrides: (link as any)?.option_price_overrides ?? {}
        }
      })
    }

    return new Response(JSON.stringify({ ok: true, variations: [...(productVars || []).filter((item: any) => item?.active !== false), ...globals.filter((item: any) => item?.active !== false)] }), { status: 200, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), { status: 200, headers: corsHeaders })
  }
}
