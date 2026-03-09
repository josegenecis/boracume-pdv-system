// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickComponent(components: any[], types: string[]) {
  for (const t of types) {
    const found = components.find((c) => Array.isArray(c?.types) && c.types.includes(t))
    if (found) return String(found.long_name || found.short_name || '').trim()
  }
  return ''
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function withRetry<T>(fn: () => Promise<T>, retries: number) {
  let lastErr: any = null
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < retries) await sleep(Math.min(2000, 250 * Math.pow(2, i)))
    }
  }
  throw lastErr
}

async function geocodeGoogle(params: { address?: string; placeId?: string; lat?: number; lng?: number }, apiKey: string) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  if (params.placeId) url.searchParams.set('place_id', params.placeId)
  else if (params.address) url.searchParams.set('address', params.address)
  else if (typeof params.lat === 'number' && typeof params.lng === 'number') url.searchParams.set('latlng', `${params.lat},${params.lng}`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('language', 'pt-BR')
  url.searchParams.set('region', 'br')

  const resp = await fetch(url.toString(), { method: 'GET' })
  const json = await resp.json()
  if (!resp.ok) throw new Error(`Geocoding HTTP ${resp.status}`)
  if (json?.status !== 'OK') {
    const msg = String(json?.error_message || json?.status || 'GEOCODING_FAILED')
    throw new Error(msg)
  }
  const first = Array.isArray(json?.results) ? json.results[0] : null
  if (!first?.geometry?.location) throw new Error('GEOCODING_NO_RESULT')
  return first as any
}

async function distanceMatrixGoogle(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  apiKey: string
) {
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', `${origin.lat},${origin.lng}`)
  url.searchParams.set('destinations', `${dest.lat},${dest.lng}`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('language', 'pt-BR')
  url.searchParams.set('region', 'br')
  url.searchParams.set('units', 'metric')
  url.searchParams.set('mode', 'driving')

  const resp = await fetch(url.toString(), { method: 'GET' })
  const json = await resp.json()
  if (!resp.ok) throw new Error(`DistanceMatrix HTTP ${resp.status}`)
  if (json?.status !== 'OK') {
    const msg = String(json?.error_message || json?.status || 'DISTANCE_MATRIX_FAILED')
    throw new Error(msg)
  }
  const el = json?.rows?.[0]?.elements?.[0]
  if (!el || el.status !== 'OK') throw new Error(String(el?.status || 'DISTANCE_MATRIX_NO_RESULT'))
  const meters = Number(el?.distance?.value)
  const seconds = Number(el?.duration?.value)
  if (!Number.isFinite(meters) || !Number.isFinite(seconds)) throw new Error('DISTANCE_MATRIX_INVALID_RESULT')
  return { meters, seconds }
}

type Zone = {
  id: string
  name: string
  delivery_fee: number
  minimum_order: number
  delivery_time: string
  active: boolean
}

function matchZone(neighborhood: string, zones: Zone[]) {
  const target = normalizeText(neighborhood)
  if (!target) return null
  const normalized = zones.map((z) => ({ z, n: normalizeText(z.name) }))
  const exact = normalized.find((x) => x.n === target)
  if (exact) return { zone: exact.z, matchedBy: 'exact' }
  const contains = normalized.find((x) => x.n && (x.n.includes(target) || target.includes(x.n)))
  if (contains) return { zone: contains.z, matchedBy: 'contains' }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({} as any))
    const userId = String(body?.userId || body?.restaurantUserId || '').trim()
    const address = String(body?.address || '').trim()
    const placeId = String(body?.placeId || '').trim()
    const lat = body?.lat !== undefined ? Number(body.lat) : undefined
    const lng = body?.lng !== undefined ? Number(body.lng) : undefined
    const cartTotal = body?.cartTotal !== undefined ? Number(body.cartTotal) : undefined

    if (!userId) return new Response(JSON.stringify({ ok: false, error: 'userId obrigatório' }), { status: 400, headers: corsHeaders })
    if (!address && !placeId && !(typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng))) {
      return new Response(JSON.stringify({ ok: false, error: 'Informe address, placeId ou lat/lng' }), { status: 400, headers: corsHeaders })
    }

    const [{ data: zonesData, error: zonesError }, { data: settingsData }] = await Promise.all([
      withRetry(
        () =>
          supabase
            .from('delivery_zones')
            .select('id, name, delivery_fee, minimum_order, delivery_time, active')
            .eq('user_id', userId)
            .eq('active', true)
            .order('name') as any,
        2
      ),
      supabase.from('delivery_settings').select('delivery_areas, google_maps_api_key').eq('user_id', userId).maybeSingle() as any
    ])

    if (zonesError) throw zonesError
    const zones: Zone[] = Array.isArray(zonesData) ? (zonesData as any) : []

    let apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || ''
    if (!apiKey) {
      apiKey = String((settingsData as any)?.google_maps_api_key || '').trim()
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Chave do Google Maps não configurada' }), { status: 500, headers: corsHeaders })
    }

    const geo = await withRetry(() => geocodeGoogle({ address, placeId, lat, lng }, apiKey), 2)
    const components = Array.isArray(geo?.address_components) ? geo.address_components : []
    const neighborhood = pickComponent(components, ['neighborhood', 'sublocality', 'sublocality_level_1'])
    const city = pickComponent(components, ['administrative_area_level_2', 'locality'])
    const state = pickComponent(components, ['administrative_area_level_1'])
    const formattedAddress = String(geo?.formatted_address || '').trim()
    const destLoc = geo?.geometry?.location
    const dest = { lat: Number(destLoc?.lat), lng: Number(destLoc?.lng) }

    const match = matchZone(neighborhood, zones)
    if (match) {
      const z = match.zone
      if (typeof cartTotal === 'number' && Number.isFinite(cartTotal) && cartTotal < Number(z.minimum_order || 0)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Pedido mínimo para ${z.name}: R$ ${Number(z.minimum_order || 0).toFixed(2)}`,
            code: 'MIN_ORDER',
            neighborhood,
            city,
            state,
            formattedAddress,
            zone: { id: z.id, name: z.name }
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'neighborhood',
          matchedBy: match.matchedBy,
          neighborhood,
          city,
          state,
          formattedAddress,
          zone: {
            id: z.id,
            name: z.name,
            delivery_fee: z.delivery_fee,
            minimum_order: z.minimum_order,
            delivery_time: z.delivery_time
          }
        }),
        { headers: corsHeaders }
      )
    }

    const deliveryAreas = (settingsData as any)?.delivery_areas || null
    const mode = String(deliveryAreas?.pricing?.mode || '').trim()
    if (mode === 'free') {
      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'free',
          neighborhood,
          city,
          state,
          formattedAddress,
          zone: {
            id: null,
            name: null,
            delivery_fee: 0,
            minimum_order: 0,
            delivery_time: '30-45 min'
          }
        }),
        { headers: corsHeaders }
      )
    }

    if (mode === 'fixed') {
      const fixed = deliveryAreas?.pricing?.fixed || {}
      const delivery_fee = Number(fixed?.delivery_fee || 0) || 0
      const minimum_order = Number(fixed?.minimum_order || 0) || 0
      const delivery_time = String(fixed?.delivery_time || '30-45 min')
      if (typeof cartTotal === 'number' && Number.isFinite(cartTotal) && cartTotal < minimum_order) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Pedido mínimo: R$ ${Number(minimum_order).toFixed(2)}`,
            code: 'MIN_ORDER',
            neighborhood,
            city,
            state,
            formattedAddress,
            zone: null
          }),
          { status: 400, headers: corsHeaders }
        )
      }
      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'fixed',
          neighborhood,
          city,
          state,
          formattedAddress,
          zone: { id: null, name: null, delivery_fee, minimum_order, delivery_time }
        }),
        { headers: corsHeaders }
      )
    }

    if (mode === 'distance_km') {
      const cfg = deliveryAreas?.pricing?.distance_km || {}
      const base_fee = Number(cfg?.base_fee || 0) || 0
      const fee_per_km = Number(cfg?.fee_per_km || 0) || 0
      const max_distance_km = Number(cfg?.max_distance_km || 0) || 0
      const minimum_order = Number(cfg?.minimum_order || 0) || 0
      const delivery_time = String(cfg?.delivery_time || '30-45 min')

      const store = deliveryAreas?.store_location || null
      const origin = { lat: Number(store?.lat), lng: Number(store?.lng) }
      if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
        return new Response(JSON.stringify({ ok: false, error: 'Defina a localização do restaurante em Configurações > Delivery', code: 'STORE_LOCATION_REQUIRED' }), { status: 400, headers: corsHeaders })
      }
      if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) {
        return new Response(JSON.stringify({ ok: false, error: 'Não foi possível localizar o endereço do cliente', code: 'DEST_LOCATION_INVALID' }), { status: 400, headers: corsHeaders })
      }

      const { meters, seconds } = await withRetry(() => distanceMatrixGoogle(origin, dest, apiKey), 2)
      const distanceKm = meters / 1000
      if (max_distance_km > 0 && distanceKm > max_distance_km) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Fora do raio máximo de entrega',
            code: 'OUT_OF_AREA',
            neighborhood,
            city,
            state,
            formattedAddress,
            distanceKm
          }),
          { status: 404, headers: corsHeaders }
        )
      }

      const delivery_fee = Math.max(0, base_fee + fee_per_km * distanceKm)
      if (typeof cartTotal === 'number' && Number.isFinite(cartTotal) && cartTotal < minimum_order) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Pedido mínimo: R$ ${Number(minimum_order).toFixed(2)}`,
            code: 'MIN_ORDER',
            neighborhood,
            city,
            state,
            formattedAddress,
            distanceKm
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'distance_km',
          neighborhood,
          city,
          state,
          formattedAddress,
          distanceKm,
          durationMin: Math.round(seconds / 60),
          zone: { id: null, name: null, delivery_fee: Number(delivery_fee.toFixed(2)), minimum_order, delivery_time }
        }),
        { headers: corsHeaders }
      )
    }

    if (mode === 'radius_km') {
      const cfg = deliveryAreas?.pricing?.radius_km || {}
      const radius_km = Number(cfg?.radius_km || 0) || 0
      const delivery_fee = Number(cfg?.delivery_fee || 0) || 0
      const minimum_order = Number(cfg?.minimum_order || 0) || 0
      const delivery_time = String(cfg?.delivery_time || '30-45 min')

      const store = deliveryAreas?.store_location || null
      const origin = { lat: Number(store?.lat), lng: Number(store?.lng) }
      if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
        return new Response(JSON.stringify({ ok: false, error: 'Defina a localização do restaurante em Configurações > Delivery', code: 'STORE_LOCATION_REQUIRED' }), { status: 400, headers: corsHeaders })
      }
      if (!Number.isFinite(dest.lat) || !Number.isFinite(dest.lng)) {
        return new Response(JSON.stringify({ ok: false, error: 'Não foi possível localizar o endereço do cliente', code: 'DEST_LOCATION_INVALID' }), { status: 400, headers: corsHeaders })
      }

      const { meters, seconds } = await withRetry(() => distanceMatrixGoogle(origin, dest, apiKey), 2)
      const distanceKm = meters / 1000
      if (radius_km > 0 && distanceKm > radius_km) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Fora do raio máximo de entrega',
            code: 'OUT_OF_AREA',
            neighborhood,
            city,
            state,
            formattedAddress,
            distanceKm
          }),
          { status: 404, headers: corsHeaders }
        )
      }
      if (typeof cartTotal === 'number' && Number.isFinite(cartTotal) && cartTotal < minimum_order) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Pedido mínimo: R$ ${Number(minimum_order).toFixed(2)}`,
            code: 'MIN_ORDER',
            neighborhood,
            city,
            state,
            formattedAddress,
            distanceKm
          }),
          { status: 400, headers: corsHeaders }
        )
      }

      return new Response(
        JSON.stringify({
          ok: true,
          mode: 'radius_km',
          neighborhood,
          city,
          state,
          formattedAddress,
          distanceKm,
          durationMin: Math.round(seconds / 60),
          zone: { id: null, name: null, delivery_fee: Number(Math.max(0, delivery_fee).toFixed(2)), minimum_order, delivery_time }
        }),
        { headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Bairro fora da área de entrega',
        code: 'OUT_OF_AREA',
        neighborhood,
        city,
        state,
        formattedAddress
      }),
      { status: 404, headers: corsHeaders }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || 'Erro ao calcular frete' }), { status: 500, headers: corsHeaders })
  }
})

