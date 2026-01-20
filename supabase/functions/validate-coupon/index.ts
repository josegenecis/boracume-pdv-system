// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { code, cartTotal, userId, customerId } = await req.json()

    if (!code || !userId) {
      return new Response(JSON.stringify({ valid: false, message: 'Dados incompletos' }), { headers: corsHeaders })
    }

    const cleanCode = code.toUpperCase().trim()

    // 1. Buscar Cupom Global
    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('user_id', userId)
      .eq('code', cleanCode)
      .eq('active', true)
      .maybeSingle()

    // 2. Se não achar Global, buscar Recompensa Pessoal do Cliente
    let reward = null
    if (!coupon && customerId) {
      const { data: userReward } = await supabase
        .from('customer_rewards')
        .select('*, loyalty_programs(*)')
        .eq('code', cleanCode)
        .eq('customer_id', customerId)
        .eq('status', 'available')
        .maybeSingle()
      
      if (userReward) {
        reward = {
          discount_type: userReward.discount_type,
          discount_value: userReward.discount_value,
          min_purchase: 0 // Recompensas geralmente não têm mínimo, mas poderia ter
        }
      }
    }

    const activePromo = coupon || reward

    if (!activePromo) {
      return new Response(JSON.stringify({ valid: false, message: 'Cupom inválido ou expirado' }), { headers: corsHeaders })
    }

    // Validar Regras
    if (activePromo.expiration_date && new Date(activePromo.expiration_date) < new Date()) {
      return new Response(JSON.stringify({ valid: false, message: 'Cupom expirado' }), { headers: corsHeaders })
    }

    if (activePromo.min_purchase && cartTotal < activePromo.min_purchase) {
      return new Response(JSON.stringify({ 
        valid: false, 
        message: `Válido apenas para compras acima de R$ ${activePromo.min_purchase}` 
      }), { headers: corsHeaders })
    }

    // Calcular Desconto
    let discountAmount = 0
    if (activePromo.discount_type === 'percent') {
      discountAmount = (cartTotal * activePromo.discount_value) / 100
    } else if (activePromo.discount_type === 'fixed') {
      discountAmount = activePromo.discount_value
    } else if (activePromo.discount_type === 'shipping' || activePromo.discount_type === 'free_shipping') {
      // O frontend deve zerar o frete se receber type='shipping'
      discountAmount = 0 
    }

    // Travar desconto máximo no total do carrinho (não pode dar dinheiro)
    if (discountAmount > cartTotal) discountAmount = cartTotal

    return new Response(JSON.stringify({ 
      valid: true, 
      discountAmount,
      type: activePromo.discount_type,
      message: 'Cupom aplicado com sucesso!' 
    }), { headers: corsHeaders })

  } catch (error: any) {
    return new Response(JSON.stringify({ valid: false, message: error.message }), { status: 500, headers: corsHeaders })
  }
})
