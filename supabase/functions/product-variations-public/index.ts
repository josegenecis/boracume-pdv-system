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
    const { data: productVars } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', productId)

    const { data: links } = await supabase
      .from('product_global_variation_links')
      .select('global_variation_id')
      .eq('product_id', productId)

    let globals: any[] = []
    if (Array.isArray(links) && links.length) {
      const ids = links.map(l => l.global_variation_id)
      const { data: globalVars } = await supabase
        .from('global_variations')
        .select('*')
        .in('id', ids)
      globals = (globalVars || []).map((v: any) => {
        return { ...v, required: !!(v as any)?.required, min_selections: 0, max_selections: (v as any)?.max_selections ?? 1 }
      })
    }

    return new Response(JSON.stringify({ ok: true, variations: [...(productVars || []), ...globals] }), { status: 200, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), { status: 200, headers: corsHeaders })
  }
}
