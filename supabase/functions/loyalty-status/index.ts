import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { previewLoyaltyForCustomer } from '../_shared/loyalty.ts'
import { buildPhoneCandidates, normalizePhone } from '../_shared/restaurant-whatsapp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId || '')
    const customerPhone = String(body?.customerPhone || '')
    const cartTotal = Number(body?.cartTotal || 0)
    const deliveryFee = Number(body?.deliveryFee || 0)

    if (!userId || !customerPhone) {
      return new Response(JSON.stringify({ ok: false, message: 'Dados incompletos' }), { status: 400, headers: corsHeaders })
    }

    const result = await previewLoyaltyForCustomer(supabase, { userId, customerPhone, cartTotal, deliveryFee })
    const normalizedPhone = normalizePhone(customerPhone)
    const phoneWithoutCountry = normalizedPhone.startsWith('55') ? normalizedPhone.slice(2) : normalizedPhone
    const phoneCandidates = Array.from(new Set([
      ...buildPhoneCandidates(customerPhone),
      normalizedPhone,
      phoneWithoutCountry,
    ].filter(Boolean)))

    const [{ data: promotion }, { count: previousOrders }, { data: previousRedemption }] = await Promise.all([
      supabase
        .from('first_order_promotions')
        .select('id,title,reward_type,reward_value,product_id,min_purchase,active,product:products(id,name,price,image_url,available,show_in_delivery)')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle(),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('customer_phone', phoneCandidates)
        .neq('status', 'cancelled'),
      supabase
        .from('first_order_promotion_redemptions')
        .select('id')
        .eq('user_id', userId)
        .eq('customer_phone', phoneWithoutCountry)
        .maybeSingle(),
    ])

    let firstOrderPromotion: any = null
    if (
      promotion &&
      !previousRedemption &&
      Number(previousOrders || 0) === 0 &&
      Math.max(0, cartTotal) >= Math.max(0, Number(promotion.min_purchase || 0))
    ) {
      const rewardType = String(promotion.reward_type || '')
      const rewardValue = Math.max(0, Number(promotion.reward_value || 0))
      const product = Array.isArray((promotion as any).product)
        ? (promotion as any).product[0]
        : (promotion as any).product
      const productAvailable = product && product.available !== false && product.show_in_delivery !== false

      if (rewardType !== 'free_product' || productAvailable) {
        const discountAmount = rewardType === 'percent'
          ? Math.min(cartTotal, cartTotal * rewardValue / 100)
          : rewardType === 'fixed'
            ? Math.min(cartTotal, rewardValue)
            : 0

        firstOrderPromotion = {
          id: String(promotion.id),
          title: String(promotion.title || 'Oferta de primeiro pedido'),
          rewardType,
          rewardValue,
          discountAmount,
          product: rewardType === 'free_product' && product
            ? {
                id: String(product.id),
                name: String(product.name || 'Produto grátis'),
                price: Math.max(0, Number(product.price || 0)),
                imageUrl: product.image_url || null,
              }
            : null,
          message: rewardType === 'free_product'
            ? `Primeiro pedido: ${String(product?.name || 'produto')} grátis.`
            : 'Desconto de primeiro pedido aplicado automaticamente.',
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result, firstOrderPromotion }), { status: 200, headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, message: String(error?.message || error) }), { status: 500, headers: corsHeaders })
  }
})
