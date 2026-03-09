// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
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
      if (i < retries) await sleep(Math.min(1500, 200 * Math.pow(2, i)))
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({} as any))
    const userId = String(body?.userId || '').trim()
    const address = String(body?.address || '').trim()
    const placeId = String(body?.placeId || '').trim()
    const lat = body?.lat !== undefined ? Number(body.lat) : undefined
    const lng = body?.lng !== undefined ? Number(body.lng) : undefined

    if (!address && !placeId && !(typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng))) {
      return new Response(JSON.stringify({ ok: false, error: 'Informe address, placeId ou lat/lng' }), { status: 400, headers: corsHeaders })
    }

    let apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || ''
    if (!apiKey && userId) {
      const { data } = await supabase.from('delivery_settings').select('google_maps_api_key').eq('user_id', userId).maybeSingle() as any
      apiKey = String(data?.google_maps_api_key || '').trim()
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Chave do Google Maps não configurada' }), { status: 500, headers: corsHeaders })
    }

    const result = await withRetry(() => geocodeGoogle({ address, placeId, lat, lng }, apiKey), 2)
    const components = Array.isArray(result?.address_components) ? result.address_components : []

    const neighborhood = pickComponent(components, ['neighborhood', 'sublocality', 'sublocality_level_1'])
    const city = pickComponent(components, ['administrative_area_level_2', 'locality'])
    const state = pickComponent(components, ['administrative_area_level_1'])
    const postalCode = pickComponent(components, ['postal_code'])

    const loc = result.geometry.location
    const out = {
      ok: true,
      formattedAddress: String(result.formatted_address || '').trim(),
      location: { lat: Number(loc.lat), lng: Number(loc.lng) },
      components: {
        neighborhood,
        city,
        state,
        postalCode
      }
    }

    return new Response(JSON.stringify(out), { headers: corsHeaders })
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || 'Erro ao geocodificar' }), { status: 500, headers: corsHeaders })
  }
})

