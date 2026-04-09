import { normalizePhone, sendRestaurantWhatsApp } from './restaurant-whatsapp.ts'

const formatBRL = (value: number) =>
  `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const buildRewardCode = () =>
  `FID${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

const isMissingRewardsSchemaError = (error: any) => {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01' || code === '42703' || message.includes('customer_rewards')
}

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

const createProgressLine = (program: any, balance: any, options?: { withStars?: boolean }) => {
  const goal = Math.max(0, Number(program.goal_value || 0))
  if (!goal) return ''
  const withStars = Boolean(options?.withStars)

  if (program.type === 'visits') {
    const totalVisits = Math.max(0, Number(balance?.total_visits || 0))
    const partial = totalVisits % goal || (totalVisits > 0 && totalVisits >= goal ? goal : totalVisits)
    const count = Math.max(0, Math.min(goal, Math.floor(partial)))
    const prefix = withStars ? `${count <= 0 ? '☆' : count <= 10 ? '⭐'.repeat(count) : `⭐x${count}`} ` : ''
    return `${prefix}Fidelidade: ${count} de ${goal} pedidos concluídos.`
  }

  if (program.type === 'spending') {
    const totalSpent = Math.max(0, Number(balance?.total_spent || 0))
    const partial = totalSpent % goal || (totalSpent > 0 && totalSpent >= goal ? goal : totalSpent)
    return `⭐ Fidelidade: ${formatBRL(Math.min(goal, partial))} de ${formatBRL(goal)} acumulados.`
  }

  return ''
}

const syncRewardUsageFromOrders = async (supabase: any, userId: string, rewards: any[]) => {
  const rewardList = Array.isArray(rewards) ? rewards.filter(Boolean) : []
  if (rewardList.length === 0) return rewardList

  const rewardCodes = rewardList
    .map((reward) => String(reward?.code || '').trim())
    .filter(Boolean)

  if (rewardCodes.length === 0) return rewardList

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id,coupon_code,created_at')
    .eq('user_id', userId)
    .in('coupon_code', rewardCodes)
    .order('created_at', { ascending: false })

  if (error) throw error

  const orderByCoupon = new Map<string, any>()
  for (const order of Array.isArray(orders) ? orders : []) {
    const couponCode = String(order?.coupon_code || '').trim()
    if (!couponCode || orderByCoupon.has(couponCode)) continue
    orderByCoupon.set(couponCode, order)
  }

  const activeRewards: any[] = []
  for (const reward of rewardList) {
    const order = orderByCoupon.get(String(reward?.code || '').trim())
    if (!order) {
      activeRewards.push(reward)
      continue
    }

    try {
      await supabase
        .from('customer_rewards')
        .update({
          status: 'used',
          used_at: new Date().toISOString(),
          order_id: order.id,
        })
        .eq('id', reward.id)
        .eq('status', 'available')
    } catch {}
  }

  return activeRewards
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

  const { data: activePrograms, error: activeProgramsError } = await supabase
    .from('loyalty_programs')
    .select('id')
    .eq('user_id', userId)
    .eq('active', true)

  if (activeProgramsError) throw activeProgramsError

  const activeProgramIds = (Array.isArray(activePrograms) ? activePrograms : [])
    .map((program: any) => String(program?.id || ''))
    .filter(Boolean)

  if (activeProgramIds.length === 0) return null

  const { data, error } = await supabase
    .from('customer_rewards')
    .select('id, code, discount_type, discount_value, status, program_id, awarded_at')
    .eq('user_id', userId)
    .eq('customer_phone', normalizedPhone)
    .eq('status', 'available')
    .in('program_id', activeProgramIds)
    .order('awarded_at', { ascending: true })
    .limit(20)

  if (error) {
    if (isMissingRewardsSchemaError(error)) {
      console.warn('[loyalty] customer_rewards indisponível ao consultar recompensa', { userId, customerPhone: normalizedPhone, code: error.code, message: error.message })
      return null
    }
    throw error
  }

  const availableRewards = await syncRewardUsageFromOrders(supabase, userId, Array.isArray(data) ? data : [])
  return availableRewards[0] || null
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
  const progress = Array.from(
    new Set(
      activePrograms
        .map((program) => createProgressLine(program, balance))
        .filter(Boolean)
    )
  )

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

  const { data: updatedRows, error } = await supabase
    .from('customer_rewards')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      order_id: orderId,
    })
    .eq('id', rewardId)
    .eq('user_id', userId)
    .eq('status', 'available')
    .select('id')

  if (error) throw error
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) return { ok: false, skipped: true }
  return { ok: true }
}

export async function processLoyaltyForOrder(supabase: any, order: any) {
  const restaurantId = String(order?.user_id || '')
  const customerPhone = normalizePhone(order?.customer_phone)
  const orderId = String(order?.id || '')
  const status = String(order?.status || '')

  console.log('[loyalty] process start', { orderId, restaurantId, customerPhone, status, loyaltyProcessedAt: order?.loyalty_processed_at || null })
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
  console.log('[loyalty] active programs', { orderId, count: activePrograms.length })
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
  let rewardsSchemaAvailable = true

  for (const program of activePrograms) {
    const rewardDiscountType = mapProgramRewardToDiscountType(String(program.reward_type || ''))
    const goalValue = Math.max(0, Number(program.goal_value || 0))
    if (!goalValue) continue

    let issuedCount = 0
    if (rewardsSchemaAvailable) {
      const issuedResult = await supabase
        .from('customer_rewards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', restaurantId)
        .eq('program_id', program.id)
        .eq('customer_phone', customerPhone)

      if (issuedResult.error) {
        if (isMissingRewardsSchemaError(issuedResult.error)) {
          rewardsSchemaAvailable = false
          console.warn('[loyalty] customer_rewards indisponível ao contar recompensas', { orderId, programId: program.id, code: issuedResult.error.code, message: issuedResult.error.message })
        } else {
          throw issuedResult.error
        }
      } else {
        issuedCount = Number(issuedResult.count || 0)
      }
    }

    const cyclesCompleted = getProgramCycles(program, balanceAfter)
    const rewardsToIssue = rewardsSchemaAvailable ? Math.max(0, cyclesCompleted - Number(issuedCount || 0)) : 0
    console.log('[loyalty] progress snapshot', {
      orderId,
      programId: program.id,
      type: program.type,
      notifyWhatsapp: program.notify_whatsapp,
      cyclesCompleted,
      issuedCount,
      rewardsToIssue,
      totalVisits: balanceAfter?.total_visits,
      totalSpent: balanceAfter?.total_spent,
    })

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

      if (insertRewardError) {
        if (isMissingRewardsSchemaError(insertRewardError)) {
          rewardsSchemaAvailable = false
          console.warn('[loyalty] customer_rewards indisponível ao inserir recompensa', { orderId, programId: program.id, code: insertRewardError.code, message: insertRewardError.message })
        } else {
          throw insertRewardError
        }
      } else {
        awardedRewards.push(...(Array.isArray(insertedRewards) ? insertedRewards : []))
      }
    }

    if (program.notify_whatsapp) {
      const progressLine = createProgressLine(program, balanceAfter, { withStars: true })
      if (progressLine) progressLines.push(progressLine)
      if (rewardsToIssue > 0 && rewardsSchemaAvailable) rewardLines.push(createRewardLine(program))
    }
  }

  if (progressLines.length > 0 || rewardLines.length > 0) {
    const uniqueProgressLines = Array.from(new Set(progressLines))
    const uniqueRewardLines = Array.from(new Set(rewardLines))
    const message = [
      `Olá, ${String(order?.customer_name || balanceAfter?.customer_name || 'Cliente')}!`,
      'Seu fidelidade foi atualizado:',
      ...uniqueProgressLines,
      ...uniqueRewardLines,
    ].join('\n')

    try {
      const waResult = await sendRestaurantWhatsApp(restaurantId, customerPhone, message)
      console.log('[loyalty] whatsapp result', { orderId, ok: waResult?.ok, status: waResult?.status, data: waResult?.data || null })
    } catch (error: any) {
      console.error('[loyalty] whatsapp send failed', { orderId, message: String(error?.message || error) })
    }
  } else {
    console.log('[loyalty] no whatsapp message generated', { orderId, activePrograms: activePrograms.length, progressLines: progressLines.length, rewardLines: rewardLines.length })
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
