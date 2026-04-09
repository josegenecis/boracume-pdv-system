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

    const normalizePhone = (value: string | null | undefined) => {
      const digits = String(value || '').replace(/\D/g, '')
      if (!digits) return ''
      return digits.startsWith('55') ? digits : `55${digits}`
    }

    const { code, cartTotal, userId, customerPhone } = await req.json()

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

    // 2. Se não achar Global, buscar Recompensa Pessoal do Cliente (por telefone)
    let reward = null
    if (!coupon && customerPhone) {
      const { data: programs } = await supabase
        .from('loyalty_programs')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)

      const activeProgramIds = (Array.isArray(programs) ? programs : [])
        .map((p: any) => String(p?.id || ''))
        .filter(Boolean)

      if (activeProgramIds.length > 0) {
        const { data: phoneReward } = await supabase
        .from('customer_rewards')
        .select('discount_type,discount_value')
        .eq('user_id', userId)
        .eq('code', cleanCode)
        .eq('customer_phone', normalizePhone(customerPhone))
        .eq('status', 'available')
        .in('program_id', activeProgramIds)
        .maybeSingle()

        if (phoneReward) {
          reward = {
            discount_type: phoneReward.discount_type,
            discount_value: phoneReward.discount_value,
            min_purchase: 0
          }
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
