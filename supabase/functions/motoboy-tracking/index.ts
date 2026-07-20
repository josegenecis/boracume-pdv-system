import { corsHeaders, createServiceClient, fail, ok } from '../_shared/motoboy-web.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const orderId = String(body?.orderId || '')
    if (!orderId) return fail('Pedido inválido.')
    const supabase = createServiceClient()
    const { data: assignment } = await supabase.from('delivery_assignments')
      .select('id,status,picked_up_at,delivered_at,driver:delivery_personnel(name,vehicle_type,vehicle_plate),order:orders(customer_latitude,customer_longitude)')
      .eq('order_id', orderId).maybeSingle()
    if (!assignment || !['picked_up','delivered'].includes(String(assignment.status))) return ok({ active: false })
    const { data: location } = await supabase.from('delivery_driver_locations')
      .select('latitude,longitude,accuracy_meters,heading,speed,recorded_at')
      .eq('assignment_id', assignment.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle()
    const order = Array.isArray(assignment.order) ? assignment.order[0] : assignment.order
    const destination = Number.isFinite(Number(order?.customer_latitude)) && Number.isFinite(Number(order?.customer_longitude))
      ? { latitude: Number(order.customer_latitude), longitude: Number(order.customer_longitude) }
      : null
    return ok({ active: assignment.status === 'picked_up', status: assignment.status, driver: assignment.driver, location, destination })
  } catch (error: any) {
    return fail(String(error?.message || 'Não foi possível carregar o rastreamento.'), 500)
  }
})
