// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const ifoodCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ifood-signature',
  'Content-Type': 'application/json',
}

const AUTH_BASE_URL = 'https://merchant-api.ifood.com.br/authentication/v1.0'
const MERCHANT_BASE_URL = 'https://merchant-api.ifood.com.br/merchant/v1.0'
const EVENTS_BASE_URL = 'https://merchant-api.ifood.com.br/events/v1.0'
const ORDER_BASE_URL = 'https://merchant-api.ifood.com.br/order/v1.0'

export const okJson = (payload: any, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: ifoodCorsHeaders })

export const getEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = Deno.env.get(key)
    if (value) return value
  }
  return ''
}

export const createServiceClient = () => {
  const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'BORACUME_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service role não configurado')
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}

export const getAuthUserId = async (req: Request) => {
  const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY', 'BORACUME_SUPABASE_ANON_KEY')
  const authHeader = req.headers.get('authorization') || ''

  if (!supabaseUrl || !anonKey || !authHeader) return ''

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data, error } = await authClient.auth.getUser()
  if (error) return ''
  return data?.user?.id || ''
}

export const normalizeString = (value: unknown) => String(value ?? '').trim()

export const normalizePhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') ? digits : `55${digits}`
}

export const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    let safe = value.trim().replace(/[^0-9.,-]/g, '')
    const lastComma = safe.lastIndexOf(',')
    const lastDot = safe.lastIndexOf('.')
    const decimalPos = Math.max(lastComma, lastDot)
    if (decimalPos >= 0) {
      const integerPart = safe.slice(0, decimalPos).replace(/[^0-9-]/g, '')
      const fractionPart = safe.slice(decimalPos + 1).replace(/[^0-9]/g, '')
      safe = `${integerPart}.${fractionPart}`
    } else {
      safe = safe.replace(/[^0-9-]/g, '')
    }
    const parsed = Number(safe)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const uniqueStrings = (values: unknown[]) =>
  Array.from(new Set(values.map((value) => normalizeString(value)).filter(Boolean)))

const pickFirstString = (...values: unknown[]) => uniqueStrings(values)[0] || ''

const parseDate = (value: unknown) => {
  const text = normalizeString(value)
  if (!text) return null
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const parseSettingsMeta = (value: unknown) => {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, any>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const buildSettingsMeta = (settings: any, patch: Record<string, any>) => {
  const currentMeta = parseSettingsMeta(settings?.refresh_token)
  return JSON.stringify({
    ...currentMeta,
    ...patch,
  })
}

const mapOrderType = (value: unknown) => {
  const raw = normalizeString(value).toUpperCase()
  if (raw === 'TAKEOUT') return 'pickup'
  if (raw === 'INDOOR' || raw === 'DINE_IN') return 'dine_in'
  return 'delivery'
}

const mapRemoteStatusToLocal = (fullCode: string, fallbackStatus?: string) => {
  const normalizedCode = normalizeString(fullCode).toUpperCase()
  switch (normalizedCode) {
    case 'PLACED':
      return { status: 'pending', acceptance_status: 'pending' }
    case 'CONFIRMED':
      return { status: 'preparing', acceptance_status: 'accepted' }
    case 'READY_TO_PICKUP':
      return { status: 'ready', acceptance_status: 'accepted' }
    case 'DISPATCHED':
      return { status: 'in_delivery', acceptance_status: 'accepted' }
    case 'CONCLUDED':
      return { status: 'delivered', acceptance_status: 'accepted' }
    case 'CANCELLED':
      return { status: 'cancelled', acceptance_status: 'rejected' }
    default:
      return {
        status: fallbackStatus || 'pending',
        acceptance_status: fallbackStatus === 'cancelled' ? 'rejected' : 'accepted',
      }
  }
}

const buildCustomerAddress = (detail: any) => {
  const address = detail?.delivery?.deliveryAddress || detail?.delivery?.address || detail?.customer?.address || {}
  return uniqueStrings([
    address?.streetName || address?.street,
    address?.streetNumber || address?.number,
    address?.complement,
    address?.neighborhood,
    address?.city,
    address?.state,
    address?.postalCode,
  ]).join(', ')
}

const buildOrderNumber = (detail: any) =>
  pickFirstString(
    detail?.displayId,
    detail?.code,
    detail?.shortReference,
    detail?.id ? `IFOOD-${String(detail.id).slice(0, 8).toUpperCase()}` : '',
  )

const buildBenefitsSummary = (benefits: any[]) =>
  (Array.isArray(benefits) ? benefits : [])
    .map((benefit) => {
      const sponsorshipValues = Array.isArray(benefit?.sponsorshipValues) ? benefit.sponsorshipValues : []
      return {
        value: toNumber(benefit?.value),
        description: pickFirstString(
          ...sponsorshipValues.map((item: any) => item?.description),
          benefit?.description,
          benefit?.name,
        ),
      }
    })
    .filter((benefit) => benefit.value > 0 || benefit.description)

const parsePaymentSummary = (payments: any[]) => {
  const methods = Array.isArray(payments?.[0]?.methods)
    ? payments[0].methods
    : Array.isArray(payments)
      ? payments
      : []

  const primary = methods[0] || {}
  const rawType = pickFirstString(primary?.method, primary?.type, primary?.name).toUpperCase()
  let paymentMethod = 'cartao'

  if (rawType.includes('CASH')) paymentMethod = 'dinheiro'
  else if (rawType.includes('PIX')) paymentMethod = 'pix'
  else if (rawType.includes('DEBIT')) paymentMethod = 'cartao_debito'
  else if (rawType.includes('CREDIT')) paymentMethod = 'cartao_credito'

  return {
    payment_method: paymentMethod,
    brand: pickFirstString(primary?.card?.brand, primary?.brand),
    method: rawType,
    change_amount: Math.max(
      0,
      toNumber(primary?.cash?.changeFor ?? primary?.changeFor ?? primary?.changeAmount),
    ),
  }
}

const buildItemOptions = (item: any) => {
  const optionGroups = Array.isArray(item?.options) ? item.options : []
  return optionGroups.flatMap((group: any) => {
    const groupName = normalizeString(group?.name || group?.title || group?.groupName)
    const options = Array.isArray(group?.options) ? group.options : Array.isArray(group?.items) ? group.items : []

    return options.map((option: any) => ({
      group: groupName,
      name: pickFirstString(option?.name, option?.description, option?.externalCode),
      price: Math.max(0, toNumber(option?.price)),
    }))
  })
}

const mapOrderItems = (detail: any) =>
  (Array.isArray(detail?.items) ? detail.items : []).map((item: any) => ({
    product_name: pickFirstString(item?.name, item?.description, item?.externalCode, 'Item iFood'),
    quantity: Math.max(1, toNumber(item?.quantity) || 1),
    price: Math.max(0, toNumber(item?.unitPrice ?? item?.price)),
    total_price: Math.max(0, toNumber(item?.totalPrice ?? item?.total)),
    notes: pickFirstString(item?.observations, item?.notes),
    options: buildItemOptions(item),
  }))

const buildOrderVariations = (detail: any, paymentSummary: any, benefitsSummary: any[], fallbackStatusCode?: string) => ({
  provider: 'ifood',
  externalOrderId: normalizeString(detail?.id),
  merchantId: pickFirstString(detail?.merchant?.id, detail?.merchantId),
  externalStatus: pickFirstString(fallbackStatusCode, detail?.status),
  customerDocument: pickFirstString(
    detail?.customer?.documentNumber,
    detail?.customer?.documents?.[0]?.number,
    detail?.customer?.taxPayerIdentificationNumber,
  ),
  pickupCode: pickFirstString(detail?.pickupCode, detail?.delivery?.pickupCode),
  scheduledAt: parseDate(detail?.delivery?.deliveryDateTimeStart || detail?.takeout?.takeoutDateTime),
  paymentSummary,
  benefitsSummary,
  ifood: {
    id: normalizeString(detail?.id),
    orderType: normalizeString(detail?.orderType),
    orderTiming: normalizeString(detail?.orderTiming),
    salesChannel: normalizeString(detail?.salesChannel),
    deliveredBy: pickFirstString(detail?.delivery?.deliveredBy, detail?.deliveredBy),
    displayId: buildOrderNumber(detail),
    pickupCode: pickFirstString(detail?.pickupCode, detail?.delivery?.pickupCode),
    deliveryDateTimeStart: pickFirstString(detail?.delivery?.deliveryDateTimeStart, detail?.takeout?.takeoutDateTime),
    paymentSummary,
    benefitsSummary,
    raw: detail,
  },
})

export const sanitizeIfoodSettings = (settings: any) => {
  if (!settings) return null
  const meta = parseSettingsMeta(settings.refresh_token)

  return {
    id: settings.id,
    merchant_id: settings.merchant_id || '',
    merchant_name: meta.merchant_name || '',
    merchant_timezone: meta.merchant_timezone || '',
    merchant_state: meta.merchant_state || '',
    merchant_enabled: Boolean(meta.merchant_enabled),
    status: settings.status || 'offline',
    auth_mode: meta.auth_mode || 'centralized',
    client_id: settings.client_id || '',
    client_secret_configured: Boolean(settings.client_secret),
    access_token_configured: Boolean(settings.access_token),
    access_token_expires_at: meta.access_token_expires_at || null,
    token_type: meta.token_type || 'Bearer',
    webhook_url: meta.webhook_url || '',
    last_sync_at: settings.last_poll || null,
    last_sync_status: meta.last_sync_status || null,
    last_sync_message: meta.last_sync_message || null,
    last_event_at: meta.last_event_at || null,
    updated_at: settings.updated_at || null,
  }
}

export const getUserIfoodSettings = async (supabase: any, userId: string) => {
  const { data, error } = await supabase
    .from('ifood_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export const getMerchantIfoodSettings = async (supabase: any, merchantId: string) => {
  const { data, error } = await supabase
    .from('ifood_settings')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle()

  if (error) throw error
  return data
}

export const upsertIfoodSettings = async (supabase: any, userId: string, patch: Record<string, any>) => {
  const now = new Date().toISOString()
  const existing = await getUserIfoodSettings(supabase, userId)
  const metaPatch: Record<string, any> = {}

  ;[
    'merchant_name',
    'merchant_timezone',
    'merchant_state',
    'merchant_enabled',
    'webhook_url',
    'last_sync_status',
    'last_sync_message',
    'last_event_at',
    'auth_mode',
    'access_token_expires_at',
    'token_type',
    'client_secret_updated_at',
  ].forEach((key) => {
    if (patch[key] !== undefined) metaPatch[key] = patch[key]
  })

  const payload = {
    user_id: userId,
    merchant_id: patch.merchant_id ?? existing?.merchant_id ?? null,
    client_id: patch.client_id ?? existing?.client_id ?? null,
    client_secret: patch.client_secret ?? existing?.client_secret ?? null,
    authorization_code: patch.authorization_code ?? existing?.authorization_code ?? null,
    access_token: patch.access_token ?? existing?.access_token ?? null,
    refresh_token: buildSettingsMeta(existing, metaPatch),
    status: patch.status ?? existing?.status ?? 'offline',
    last_poll: patch.last_sync_at ?? patch.last_poll ?? existing?.last_poll ?? null,
    updated_at: now,
  }

  const query = existing?.id
    ? supabase.from('ifood_settings').update(payload).eq('id', existing.id)
    : supabase.from('ifood_settings').insert(payload)

  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data
}

export const requestIfoodAccessToken = async (clientId: string, clientSecret: string) => {
  const response = await fetch(`${AUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grantType: 'client_credentials',
      clientId,
      clientSecret,
    }),
  })

  const text = await response.text()
  let data: any = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `iFood auth ${response.status}`)
  }

  return data
}

export const ensureIfoodAccessToken = async (supabase: any, settings: any) => {
  if (!settings?.client_id || !settings?.client_secret) {
    throw new Error('Credenciais do iFood não configuradas')
  }

  const meta = parseSettingsMeta(settings.refresh_token)
  const expiresAt = parseDate(meta.access_token_expires_at)
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000

  if (settings.access_token && expiresAt && new Date(expiresAt).getTime() > fiveMinutesFromNow) {
    return settings
  }

  const tokenResponse = await requestIfoodAccessToken(settings.client_id, settings.client_secret)
  const nextExpiresAt = new Date(
    Date.now() + Math.max(60, Number(tokenResponse?.expiresIn || tokenResponse?.expires_in || 21600)) * 1000,
  ).toISOString()

  return await upsertIfoodSettings(supabase, settings.user_id, {
    access_token: tokenResponse?.accessToken || tokenResponse?.access_token || '',
    token_type: tokenResponse?.tokenType || tokenResponse?.token_type || 'Bearer',
    access_token_expires_at: nextExpiresAt,
    last_sync_status: 'token_ok',
    last_sync_message: 'Token validado com sucesso',
    last_sync_at: new Date().toISOString(),
  })
}

const joinUrl = (baseUrl: string, path: string, query?: Record<string, any>) => {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

export const ifoodApiRequest = async (
  supabase: any,
  settings: any,
  {
    baseUrl,
    path,
    method = 'GET',
    headers = {},
    body,
    query,
    expectedStatuses = [200],
  }: {
    baseUrl: string
    path: string
    method?: string
    headers?: Record<string, string>
    body?: unknown
    query?: Record<string, any>
    expectedStatuses?: number[]
  },
) => {
  const refreshed = await ensureIfoodAccessToken(supabase, settings)
  const response = await fetch(joinUrl(baseUrl, path, query), {
    method,
    headers: {
      Authorization: `Bearer ${refreshed.access_token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (expectedStatuses.includes(response.status)) {
    if (response.status === 204) return { status: response.status, data: null, settings: refreshed }
    const text = await response.text()
    try {
      return { status: response.status, data: text ? JSON.parse(text) : null, settings: refreshed }
    } catch {
      return { status: response.status, data: text || null, settings: refreshed }
    }
  }

  const errorText = await response.text()
  let errorData: any = {}
  try {
    errorData = errorText ? JSON.parse(errorText) : {}
  } catch {
    errorData = { raw: errorText }
  }

  throw new Error(errorData?.message || errorData?.error || errorData?.code || `iFood ${method} ${path} ${response.status}`)
}

export const listIfoodMerchants = async (supabase: any, settings: any) =>
  await ifoodApiRequest(supabase, settings, {
    baseUrl: MERCHANT_BASE_URL,
    path: '/merchants',
    expectedStatuses: [200],
  })

export const getIfoodMerchantDetails = async (supabase: any, settings: any, merchantId: string) =>
  await ifoodApiRequest(supabase, settings, {
    baseUrl: MERCHANT_BASE_URL,
    path: `/merchants/${merchantId}`,
    expectedStatuses: [200],
  })

export const getIfoodMerchantStatus = async (supabase: any, settings: any, merchantId: string) =>
  await ifoodApiRequest(supabase, settings, {
    baseUrl: MERCHANT_BASE_URL,
    path: `/merchants/${merchantId}/status`,
    expectedStatuses: [200],
  })

export const fetchIfoodPollingEvents = async (supabase: any, settings: any) => {
  const headers: Record<string, string> = {}
  if (settings?.merchant_id) headers['x-polling-merchants'] = String(settings.merchant_id)

  return await ifoodApiRequest(supabase, settings, {
    baseUrl: EVENTS_BASE_URL,
    path: '/events:polling',
    headers,
    expectedStatuses: [200, 204],
  })
}

export const acknowledgeIfoodEvents = async (supabase: any, settings: any, events: any[]) => {
  const payload = (Array.isArray(events) ? events : [])
    .map((event) => ({ id: normalizeString(event?.id) }))
    .filter((event) => event.id)

  if (payload.length === 0) return { status: 204, data: null }

  return await ifoodApiRequest(supabase, settings, {
    baseUrl: EVENTS_BASE_URL,
    path: '/events/acknowledgment',
    method: 'POST',
    body: payload,
    expectedStatuses: [200, 202, 204],
  })
}

export const getIfoodOrderDetails = async (supabase: any, settings: any, orderId: string) =>
  await ifoodApiRequest(supabase, settings, {
    baseUrl: ORDER_BASE_URL,
    path: `/orders/${orderId}`,
    expectedStatuses: [200],
  })

export const getIfoodCancellationReasons = async (supabase: any, settings: any, orderId: string) =>
  await ifoodApiRequest(supabase, settings, {
    baseUrl: ORDER_BASE_URL,
    path: `/orders/${orderId}/cancellationReasons`,
    expectedStatuses: [200, 204],
  })

export const requestIfoodOrderAction = async (
  supabase: any,
  settings: any,
  orderId: string,
  action: 'confirm' | 'dispatch' | 'readyToPickup' | 'requestCancellation',
  body?: any,
) =>
  await ifoodApiRequest(supabase, settings, {
    baseUrl: ORDER_BASE_URL,
    path: `/orders/${orderId}/${action}`,
    method: 'POST',
    body,
    expectedStatuses: [200, 202, 204],
  })

export const buildIfoodWebhookUrl = () => {
  const projectUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL').replace(/\/$/, '')
  return projectUrl ? `${projectUrl}/functions/v1/ifood-webhook` : ''
}

const hexToBytes = (hex: string) => {
  const normalized = normalizeString(hex).toLowerCase()
  if (!normalized || normalized.length % 2 !== 0) return new Uint8Array()
  const output = new Uint8Array(normalized.length / 2)
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16)
  }
  return output
}

const bytesToHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')

const timingSafeEqualHex = (a: string, b: string) => {
  const bytesA = hexToBytes(a)
  const bytesB = hexToBytes(b)
  if (bytesA.length === 0 || bytesA.length !== bytesB.length) return false
  let result = 0
  for (let index = 0; index < bytesA.length; index += 1) {
    result |= bytesA[index] ^ bytesB[index]
  }
  return result === 0
}

export const computeIfoodSignature = async (message: string, secret: string) => {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return bytesToHex(signature)
}

export const verifyIfoodSignature = async (bodyText: string, secret: string, receivedSignature: string) => {
  if (!secret || !receivedSignature) return false
  const expected = await computeIfoodSignature(bodyText, secret)
  return timingSafeEqualHex(expected, receivedSignature)
}

export const persistIfoodEvent = async (
  supabase: any,
  userId: string | null,
  event: any,
  _context: {
    source: 'webhook' | 'polling'
    headers?: Record<string, string>
    signature?: string
    httpStatus?: number
  },
) => {
  const payload = event || {}
  const merchantId = pickFirstString(payload?.merchantId, payload?.merchant_id)
  const eventId = pickFirstString(payload?.id)
  let duplicate = false
  let existingRow: any = null

  if (merchantId && eventId) {
    const { data: recent } = await supabase
      .from('ifood_events')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (Array.isArray(recent)) {
      existingRow = recent.find((row: any) => String(row?.payload?.id || '') === eventId) || null
      duplicate = Boolean(existingRow)
    }
  }

  if (duplicate && existingRow) {
    return { eventRow: existingRow, duplicate: true }
  }

  const { data, error } = await supabase
    .from('ifood_events')
    .insert({
      user_id: userId,
      merchant_id: merchantId || null,
      event_type: pickFirstString(payload?.code, payload?.fullCode, payload?.type) || null,
      payload,
      headers: _context?.headers || {},
    })
    .select('*')
    .single()

  if (error) throw error
  return { eventRow: data, duplicate }
}

const buildLocalOrderPayload = (userId: string, detail: any, fallbackStatusCode?: string) => {
  const payments = Array.isArray(detail?.payments) ? detail.payments : []
  const benefits = Array.isArray(detail?.benefits) ? detail.benefits : []
  const paymentSummary = parsePaymentSummary(payments)
  const benefitsSummary = buildBenefitsSummary(benefits)
  const localStatus = mapRemoteStatusToLocal(fallbackStatusCode || '', undefined)
  const orderType = mapOrderType(detail?.orderType)

  const total =
    toNumber(detail?.total?.orderAmount) ||
    toNumber(detail?.total?.total) ||
    toNumber(detail?.totalPrice) ||
    0

  const deliveryFee =
    toNumber(detail?.total?.deliveryFee) ||
    toNumber(detail?.deliveryFee) ||
    (Array.isArray(detail?.additionalFees)
      ? detail.additionalFees.reduce((sum: number, fee: any) => sum + toNumber(fee?.value), 0)
      : 0)

  const customerPhone = normalizePhone(
    detail?.customer?.phone?.number ||
      detail?.customer?.phone ||
      detail?.customer?.contact?.phone ||
      detail?.orderer?.phone,
  )

  return {
    user_id: userId,
    customer_name: pickFirstString(detail?.customer?.name, detail?.orderer?.name, 'Cliente iFood'),
    customer_phone: customerPhone || null,
    customer_address: buildCustomerAddress(detail) || null,
    customer_neighborhood: pickFirstString(
      detail?.delivery?.deliveryAddress?.neighborhood,
      detail?.delivery?.address?.neighborhood,
    ) || null,
    order_number: buildOrderNumber(detail),
    order_type: orderType,
    status: localStatus.status,
    acceptance_status: localStatus.acceptance_status,
    payment_method: paymentSummary.payment_method,
    change_amount: paymentSummary.change_amount || 0,
    items: mapOrderItems(detail),
    total,
    delivery_fee: deliveryFee || 0,
    discount: benefitsSummary.reduce((sum, benefit) => sum + toNumber(benefit?.value), 0),
    coupon_code: pickFirstString(...benefits.map((benefit: any) => benefit?.couponCode || benefit?.voucherCode || benefit?.name)) || null,
    delivery_instructions: pickFirstString(detail?.delivery?.observations, detail?.observations) || null,
    estimated_time: pickFirstString(detail?.preparationStartDateTime, detail?.delivery?.deliveryDateTimeStart) || null,
    updated_at: new Date().toISOString(),
    variations: buildOrderVariations(detail, paymentSummary, benefitsSummary, fallbackStatusCode),
  }
}

export const upsertLocalIfoodOrder = async (supabase: any, userId: string, detail: any, fallbackStatusCode?: string) => {
  const payload = buildLocalOrderPayload(userId, detail, fallbackStatusCode)
  const externalOrderId = normalizeString(detail?.id)

  const { data: existing, error: existingError } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .contains('variations', { provider: 'ifood', externalOrderId })
    .maybeSingle()

  if (existingError) throw existingError

  const query = existing?.id
    ? supabase.from('orders').update(payload).eq('id', existing.id)
    : supabase.from('orders').insert(payload)

  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data
}

const applyEventStatusToLocalOrder = async (supabase: any, userId: string, event: any) => {
  const externalOrderId = pickFirstString(event?.orderId)
  const { data: existing, error: existingError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .contains('variations', { provider: 'ifood', externalOrderId })
    .maybeSingle()

  if (existingError) throw existingError
  if (!existing) return null

  const currentVariations = existing?.variations && typeof existing.variations === 'object'
    ? existing.variations
    : {}
  const mapped = mapRemoteStatusToLocal(pickFirstString(event?.fullCode), existing.status)

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: mapped.status || existing.status,
      acceptance_status: mapped.acceptance_status || existing.acceptance_status,
      updated_at: new Date().toISOString(),
      variations: {
        ...currentVariations,
        externalStatus: pickFirstString(event?.fullCode, event?.code),
      },
    })
    .eq('id', existing.id)
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data
}

export const processIfoodEvent = async (supabase: any, settings: any, eventRow: any) => {
  if (!eventRow) return { ok: true, skipped: true }

  const event = eventRow.payload || {}
  const fullCode = pickFirstString(event?.fullCode)
  const orderId = pickFirstString(event?.orderId)
  const userId = normalizeString(eventRow?.user_id || settings?.user_id)

  try {
    let localOrder = null
    const shouldFetchDetails = ['PLACED', 'CONFIRMED', 'READY_TO_PICKUP', 'DISPATCHED', 'CANCELLED', 'CONCLUDED'].includes(fullCode)

    if (orderId && shouldFetchDetails) {
      const { data: detail } = await getIfoodOrderDetails(supabase, settings, orderId)
      localOrder = await upsertLocalIfoodOrder(supabase, userId, detail, fullCode)
    } else if (orderId) {
      localOrder = await applyEventStatusToLocalOrder(supabase, userId, event)
    }

    const meta = parseSettingsMeta(settings.refresh_token)
    await upsertIfoodSettings(supabase, userId, {
      merchant_id: settings.merchant_id,
      last_event_at: parseDate(event?.createdAt) || new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'ok',
      last_sync_message: `Evento ${fullCode || event?.code || 'N/A'} processado`,
      status: meta.merchant_enabled ? 'online' : 'offline',
    })

    return { ok: true, localOrder }
  } catch (error: any) {
    const meta = parseSettingsMeta(settings.refresh_token)
    await upsertIfoodSettings(supabase, userId, {
      merchant_id: settings.merchant_id,
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_message: String(error?.message || error),
      status: meta.merchant_enabled ? 'online' : 'offline',
    })
    throw error
  }
}
