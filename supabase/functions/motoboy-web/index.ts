import { corsHeaders, fail, getDriverSession, ok } from '../_shared/motoboy-web.ts'
import { notifyOrderStatus } from '../_shared/restaurant-whatsapp.ts'

const assignmentSelect = `
  id,status,route_position,payout_amount,accepted_at,arrived_at,picked_up_at,delivered_at,updated_at,
  order:orders(id,order_number,customer_name,customer_phone,customer_address,customer_address_reference,customer_neighborhood,customer_latitude,customer_longitude,delivery_instructions,payment_method,total,delivery_fee,status,created_at)
`

const cancellationOrderSelect = `
  id,order_number,customer_name,customer_address,customer_neighborhood,status,created_at
`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    const session = await getDriverSession(req)
    const { supabase, driver, restaurantId } = session

    if (action === 'bootstrap') {
      await supabase.from('delivery_offers').update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId).eq('status', 'open').lt('expires_at', new Date().toISOString())
      const cancellationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const openOfferCancellationCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const [offersResult, assignmentsResult, ledgerResult, profileResult, cancelledAssignmentsResult, cancelledOffersResult] = await Promise.all([
        supabase.from('delivery_offers')
          .select(`id,payout_amount,expires_at,created_at,target_driver_id,order:orders(id,order_number,customer_name,customer_address,customer_neighborhood,customer_latitude,customer_longitude,payment_method,total,delivery_fee,created_at,status)`)
          .eq('restaurant_id', restaurantId).eq('status', 'open').gt('expires_at', new Date().toISOString())
          .or(`target_driver_id.is.null,target_driver_id.eq.${driver.id}`).order('created_at'),
        supabase.from('delivery_assignments').select(assignmentSelect)
          .eq('delivery_personnel_id', driver.id).in('status', ['accepted','arrived','picked_up']).order('route_position'),
        supabase.from('delivery_driver_ledger').select('amount,settled_at').eq('delivery_personnel_id', driver.id),
        supabase.from('profiles').select('restaurant_name,address,logo_url').eq('id', restaurantId).maybeSingle(),
        supabase.from('delivery_assignments')
          .select(`id,status,updated_at,order:orders(${cancellationOrderSelect})`)
          .eq('delivery_personnel_id', driver.id).eq('status', 'cancelled')
          .gte('updated_at', cancellationCutoff).order('updated_at', { ascending: false }),
        supabase.from('delivery_offers')
          .select(`id,status,updated_at,target_driver_id,order:orders(${cancellationOrderSelect})`)
          .eq('restaurant_id', restaurantId).eq('status', 'cancelled')
          .gte('updated_at', openOfferCancellationCutoff)
          .or(`target_driver_id.is.null,target_driver_id.eq.${driver.id}`)
          .order('updated_at', { ascending: false }),
      ])
      if (offersResult.error) return fail(offersResult.error.message)
      if (assignmentsResult.error) return fail(assignmentsResult.error.message)
      const ledger = ledgerResult.data || []
      const cancellations = [
        ...(cancelledAssignmentsResult.data || []).map((item: any) => ({ ...item, id: `assignment:${item.id}`, source: 'assignment' })),
        ...(cancelledOffersResult.data || []).map((item: any) => ({ ...item, id: `offer:${item.id}`, source: 'offer' })),
      ].sort((left: any, right: any) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
      return ok({
        profile: { ...driver, restaurantId },
        restaurant: profileResult.data,
        offers: offersResult.data || [],
        assignments: assignmentsResult.data || [],
        cancellations,
        balance: {
          pending: ledger.filter((entry: any) => !entry.settled_at).reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0),
          settled: ledger.filter((entry: any) => entry.settled_at).reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0),
        },
      })
    }

    if (action === 'availability') {
      const status = body?.online ? 'available' : 'offline'
      await supabase.from('delivery_personnel').update({ status, updated_at: new Date().toISOString() }).eq('id', driver.id)
      return ok({ status })
    }

    if (action === 'accept_offer') {
      const { data, error } = await supabase.rpc('accept_delivery_offer', { p_offer_id: String(body?.offerId || ''), p_driver_id: driver.id })
      if (error) return fail(error.message, 409)
      return ok({ assignmentId: data })
    }

    if (action === 'reorder') {
      const ids = Array.isArray(body?.assignmentIds) ? body.assignmentIds.map(String) : []
      for (let index = 0; index < ids.length; index += 1) {
        await supabase.from('delivery_assignments').update({ route_position: index + 1, updated_at: new Date().toISOString() })
          .eq('id', ids[index]).eq('delivery_personnel_id', driver.id).in('status', ['accepted','arrived','picked_up'])
      }
      return ok({ ok: true })
    }

    if (action === 'location') {
      const assignmentId = String(body?.assignmentId || '')
      const latitude = Number(body?.latitude)
      const longitude = Number(body?.longitude)
      if (!assignmentId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return fail('Localização inválida.')
      const { data: assignment } = await supabase.from('delivery_assignments').select('id,status')
        .eq('id', assignmentId).eq('delivery_personnel_id', driver.id).in('status', ['accepted','arrived','picked_up']).maybeSingle()
      if (!assignment) return fail('Entrega não encontrada.', 404)
      await supabase.from('delivery_driver_locations').insert({
        assignment_id: assignmentId, delivery_personnel_id: driver.id, latitude, longitude,
        accuracy_meters: Number(body?.accuracy) || null, heading: Number(body?.heading) || null, speed: Number(body?.speed) || null,
      })
      return ok({ ok: true })
    }

    if (action === 'update_status') {
      const assignmentId = String(body?.assignmentId || '')
      const nextStatus = String(body?.status || '')
      if (!['arrived','picked_up','delivered'].includes(nextStatus)) return fail('Etapa inválida.')
      const { data: current } = await supabase.from('delivery_assignments').select('*,order:orders(*)')
        .eq('id', assignmentId).eq('delivery_personnel_id', driver.id).maybeSingle()
      if (!current) return fail('Entrega não encontrada.', 404)
      const allowed: Record<string, string[]> = { accepted: ['arrived','picked_up'], arrived: ['picked_up'], picked_up: ['delivered'] }
      if (!allowed[String(current.status)]?.includes(nextStatus)) return fail('Essa etapa já foi concluída ou está fora de ordem.', 409)
      const timestampField = nextStatus === 'arrived' ? 'arrived_at' : nextStatus === 'picked_up' ? 'picked_up_at' : 'delivered_at'
      const now = new Date().toISOString()
      const { error } = await supabase.from('delivery_assignments').update({ status: nextStatus, [timestampField]: now, updated_at: now }).eq('id', assignmentId)
      if (error) return fail(error.message)
      const order = Array.isArray(current.order) ? current.order[0] : current.order
      let whatsappResult: any = null
      if (nextStatus === 'picked_up') {
        await supabase.from('orders').update({ status: 'in_delivery' }).eq('id', current.order_id)
        try {
          whatsappResult = await notifyOrderStatus(supabase, { ...order, status: 'in_delivery' }, 'in_delivery')
        } catch (notificationError: any) {
          whatsappResult = { ok: false, error: String(notificationError?.message || notificationError) }
        }
      }
      if (nextStatus === 'delivered') {
        await supabase.from('orders').update({ status: 'delivered' }).eq('id', current.order_id)
        const { data: existingCredit } = await supabase.from('delivery_driver_ledger').select('id')
          .eq('order_id', current.order_id).eq('entry_type', 'delivery_credit').maybeSingle()
        if (!existingCredit) {
          await supabase.from('delivery_driver_ledger').insert({
            restaurant_id: restaurantId, delivery_personnel_id: driver.id, order_id: current.order_id,
            entry_type: 'delivery_credit', amount: current.payout_amount, description: `Entrega do pedido ${order?.order_number || ''}`,
          })
        }
        const { count } = await supabase.from('delivery_assignments').select('id', { count: 'exact', head: true })
          .eq('delivery_personnel_id', driver.id).in('status', ['accepted','arrived','picked_up'])
        if (!count) await supabase.from('delivery_personnel').update({ status: 'available' }).eq('id', driver.id)
        try {
          whatsappResult = await notifyOrderStatus(supabase, { ...order, status: 'delivered' }, 'delivered')
        } catch (notificationError: any) {
          whatsappResult = { ok: false, error: String(notificationError?.message || notificationError) }
        }
      }
      await supabase.from('delivery_events').insert({
        restaurant_id: restaurantId, assignment_id: assignmentId, order_id: current.order_id,
        delivery_personnel_id: driver.id, event_type: nextStatus,
      })
      return ok({ ok: true, whatsapp: whatsappResult })
    }

    return fail('Ação inválida.')
  } catch (error: any) {
    return fail(String(error?.message || 'Erro interno no app motoboy.'), 500)
  }
})
