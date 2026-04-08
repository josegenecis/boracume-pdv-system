import { normalizePhone, sendRestaurantWhatsApp } from './restaurant-whatsapp.ts'

const formatBRL = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const buildRewardCode = () =>
  `FID${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

const mapProgramRewardToDiscountType = (rewardType: string) => {
  if (rewardType === 'percent') return 'percent'
  if (rewardType === 'fixed_amount') return 'fixed'
  if (rewardType === 'free_shipping') return 'free_shipping'
  return null
}

const buildRewardLabel = (program: any) => {
  if (program.reward_type === 'percent') return `${Number(program.reward_value || 0)}% OFF`
  if (program.reward_type === 'fixed_amount') return `${formatBRL(Number(program.reward_value || 0))} OFF`
  if (program.reward_type === 'free_shipping') return 'Frete grátis'
  return 'Recompensa disponível'
}

const calculateRewardDiscount = (reward: any, cartTotal: number, deliveryFee: number) => {
  const safeCartTotal = Math.max(0, Number(cartTotal || 0))
  const safeDeliveryFee = Math.max(0, Number(deliveryFee || 0))
  if (reward.discount_type === 'percent') {
    return Math.min(safeCartTotal, safeCartTotal * Number(reward.discount_value || 0) / 100)
  }
  if (reward.discount_type === 'fixed') {
    return Math.min(safeCartTotal, Number(reward.discount_value || 0))
  }
  if (reward.discount_type === 'shipping' || reward.discount_type === 'free_shipping') {
    return safeDeliveryFee
  }
  return 0
}

const createProgressLine = (program: any, balance: any) => {
  const goal = Math.max(0, Number(program.goal_value || 0))
  if (!goal) return ''

  if (program.type === 'visits') {
    const totalVisits = Math.max(0, Number(balance?.total_visits || 0))
    const partial = totalVisits % goal || (totalVisits > 0 && totalVisits >= goal ? goal : totalVisits)
    return `⭐ Fidelidade: ${Math.min(goal, partial)} de ${goal} pedidos concluídos.`
  }

  if (program.type === 'spending') {
    const totalSpent = Math.max(0, Number(balance?.total_spent || 0))
    const partial = totalSpent % goal || (totalSpent > 0 && totalSpent >= goal ? goal : totalSpent)
    return `⭐ Fidelidade: ${formatBRL(Math.min(goal, partial))} de ${formatBRL(goal)} acumulados.`
  }

  return ''
}

const createRewardLine = (program: any) =>
  `🎁 Você ganhou ${buildRewardLabel(program)}. O sistema aplica automaticamente no próximo pedido.`

const getProgramCycles = (program: any, balance: any) => {
  const goal = Math.max(0, Number(program.goal_value || 0))
  if (!goal) return 0
  if (program.type === 'visits') {
    return Math.floor(Math.max(0, Number(balance?.total_visits || 0)) / goal)
  }
  if (program.type === 'spending') {
    return Math.floor(Math.max(0, Number(balance?.total_spent || 0)) / goal)
  }
  return 0
}

export async function getAvailableLoyaltyReward(supabase: any, userId: string, customerPhone: string) {
  const normalizedPhone = normalizePhone(customerPhone)
  if (!userId || !normalizedPhone) return null

  const { data, error } = await supabase
    .from('customer_rewards')
    .select('id, code, discount_type, discount_value, status, program_id, awarded_at')
    .eq('user_id', userId)
    .eq('customer_phone', normalizedPhone)
    .eq('status', 'available')
    .order('awarded_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function previewLoyaltyForCustomer(
  supabase: any,
  { userId, customerPhone, cartTotal, deliveryFee }: { userId: string; customerPhone: string; cartTotal: number; deliveryFee: number }
) {
  const normalizedPhone = normalizePhone(customerPhone)
  if (!userId || !normalizedPhone) {
    return { reward: null, progress: [] as string[] }
  }

  const [{ data: balance }, { data: programs }, reward] = await Promise.all([
    supabase
      .from('customer_loyalty_balances')
      .select('total_visits,total_spent,total_points,customer_name')
      .eq('user_id', userId)
      .eq('customer_phone', normalizedPhone)
      .maybeSingle(),
    supabase
      .from('loyalty_programs')
      .select('id,type,goal_value,reward_type,reward_value,active,notify_whatsapp')
      .eq('user_id', userId)
      .eq('active', true),
    getAvailableLoyaltyReward(supabase, userId, normalizedPhone),
  ])

  const activePrograms = Array.isArray(programs) ? programs : []
  const progress = activePrograms
    .map((program) => createProgressLine(program, balance))
    .filter(Boolean)

  if (!reward) {
    return { reward: null, progress }
  }

  return {
    reward: {
      ...reward,
      discountAmount: calculateRewardDiscount(reward, cartTotal, deliveryFee),
      message: 'Desconto fidelidade aplicado automaticamente.',
    },
    progress,
  }
}

export async function markLoyaltyRewardUsedForOrder(
  supabase: any,
  { rewardId, orderId, userId }: { rewardId: string; orderId: string; userId: string }
) {
  if (!rewardId || !orderId || !userId) return { ok: false, skipped: true }

  const { data: reward, error: rewardError } = await supabase
    .from('customer_rewards')
    .select('id,status,order_id,user_id')
    .eq('id', rewardId)
    .eq('user_id', userId)
    .maybeSingle()

  if (rewardError) throw rewardError
  if (!reward) return { ok: false, skipped: true }
  if (reward.status === 'used' && reward.order_id === orderId) return { ok: true, idempotent: true }
  if (reward.status !== 'available') return { ok: false, skipped: true }

  const { error } = await supabase
    .from('customer_rewards')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      order_id: orderId,
    })
    .eq('id', rewardId)
    .eq('user_id', userId)
    .eq('status', 'available')

  if (error) throw error
  return { ok: true }
}

export async function processLoyaltyForOrder(supabase: any, order: any) {
  const restaurantId = String(order?.user_id || '')
  const customerPhone = normalizePhone(order?.customer_phone)
  const orderId = String(order?.id || '')
  const status = String(order?.status || '')

  if (!restaurantId || !orderId || !customerPhone) return { ok: false, skipped: true }
  if (!['delivered', 'completed'].includes(status)) return { ok: false, skipped: true }
  if (order?.loyalty_processed_at) return { ok: true, idempotent: true }

  const { data: programs, error: programsError } = await supabase
    .from('loyalty_programs')
    .select('id,type,goal_value,reward_type,reward_value,active,notify_whatsapp')
    .eq('user_id', restaurantId)
    .eq('active', true)

  if (programsError) throw programsError

  const activePrograms = Array.isArray(programs) ? programs : []
  const spentAmount = Math.max(0, Number(order?.total || 0) - Math.max(0, Number(order?.delivery_fee || 0)))

  const { data: existingBalance, error: balanceError } = await supabase
    .from('customer_loyalty_balances')
    .select('*')
    .eq('user_id', restaurantId)
    .eq('customer_phone', customerPhone)
    .maybeSingle()

  if (balanceError) throw balanceError

  const nextBalance = existingBalance
    ? {
        total_visits: Math.max(0, Number(existingBalance.total_visits || 0)) + 1,
        total_spent: Math.max(0, Number(existingBalance.total_spent || 0)) + spentAmount,
        customer_name: String(order?.customer_name || existingBalance.customer_name || 'Cliente'),
        last_order_at: new Date().toISOString(),
      }
    : {
        user_id: restaurantId,
        customer_phone: customerPhone,
        customer_name: String(order?.customer_name || 'Cliente'),
        total_points: 0,
        total_visits: 1,
        total_spent: spentAmount,
        last_order_at: new Date().toISOString(),
      }

  if (existingBalance) {
    const { error } = await supabase
      .from('customer_loyalty_balances')
      .update(nextBalance)
      .eq('id', existingBalance.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('customer_loyalty_balances').insert(nextBalance)
    if (error) throw error
  }

  const { data: balanceAfter, error: balanceAfterError } = await supabase
    .from('customer_loyalty_balances')
    .select('*')
    .eq('user_id', restaurantId)
    .eq('customer_phone', customerPhone)
    .maybeSingle()

  if (balanceAfterError) throw balanceAfterError

  const progressLines: string[] = []
  const rewardLines: string[] = []
  const awardedRewards: any[] = []

  for (const program of activePrograms) {
    const rewardDiscountType = mapProgramRewardToDiscountType(String(program.reward_type || ''))
    const goalValue = Math.max(0, Number(program.goal_value || 0))
    if (!goalValue) continue

    const { count: issuedCount, error: issuedCountError } = await supabase
      .from('customer_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', restaurantId)
      .eq('program_id', program.id)
      .eq('customer_phone', customerPhone)

    if (issuedCountError) throw issuedCountError

    const cyclesCompleted = getProgramCycles(program, balanceAfter)
    const rewardsToIssue = Math.max(0, cyclesCompleted - Number(issuedCount || 0))

    if (rewardsToIssue > 0 && rewardDiscountType) {
      const rewardsPayload = Array.from({ length: rewardsToIssue }, () => ({
        user_id: restaurantId,
        program_id: program.id,
        customer_phone: customerPhone,
        customer_name: String(order?.customer_name || balanceAfter?.customer_name || 'Cliente'),
        code: buildRewardCode(),
        discount_type: rewardDiscountType,
        discount_value: Number(program.reward_value || 0),
        status: 'available',
      }))

      const { data: insertedRewards, error: insertRewardError } = await supabase
        .from('customer_rewards')
        .insert(rewardsPayload)
        .select('id,code,discount_type,discount_value,status')

      if (insertRewardError) throw insertRewardError
      awardedRewards.push(...(Array.isArray(insertedRewards) ? insertedRewards : []))
    }

    if (program.notify_whatsapp) {
      const progressLine = createProgressLine(program, balanceAfter)
      if (progressLine) progressLines.push(progressLine)
      if (rewardsToIssue > 0) rewardLines.push(createRewardLine(program))
    }
  }

  if (progressLines.length > 0 || rewardLines.length > 0) {
    const message = [
      `Olá, ${String(order?.customer_name || balanceAfter?.customer_name || 'Cliente')}!`,
      'Seu fidelidade foi atualizado:',
      ...progressLines,
      ...rewardLines,
    ].join('\n')

    try {
      await sendRestaurantWhatsApp(restaurantId, customerPhone, message)
    } catch {}
  }

  const { error: markProcessedError } = await supabase
    .from('orders')
    .update({ loyalty_processed_at: new Date().toISOString() })
    .eq('id', orderId)

  if (markProcessedError) throw markProcessedError

  return {
    ok: true,
    balance: balanceAfter,
    rewardsAwarded: awardedRewards,
  }
}
