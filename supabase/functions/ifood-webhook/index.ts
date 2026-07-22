// deno-lint-ignore-file no-explicit-any
import {
  createServiceClient,
  getMerchantIfoodSettings,
  ifoodCorsHeaders,
  okJson,
  persistIfoodEvent,
  processIfoodEvent,
  sanitizeIfoodSettings,
  upsertIfoodSettings,
  verifyIfoodSignature,
} from '../_shared/ifood.ts'

const accepted = (payload?: unknown) =>
  new Response(payload === undefined ? null : JSON.stringify(payload), {
    status: 202,
    headers: ifoodCorsHeaders,
  })

const loadSettingsWithCredentials = async (supabase: any) => {
  const { data, error } = await supabase
    .from('ifood_settings')
    .select('*')
    .not('client_secret', 'is', null)

  if (error) throw error
  return Array.isArray(data) ? data.filter((item) => item?.client_secret) : []
}

const findSettingsForSignature = async (
  candidates: any[],
  bodyText: string,
  receivedSignature: string,
) => {
  const checkedSecrets = new Set<string>()

  for (const settings of candidates) {
    const secret = String(settings?.client_secret || '')
    if (!secret || checkedSecrets.has(secret)) continue
    checkedSecrets.add(secret)

    if (await verifyIfoodSignature(bodyText, secret, receivedSignature)) {
      return settings
    }
  }

  return null
}

const queueBackgroundTask = (task: Promise<unknown>) => {
  const edgeRuntime = (globalThis as any).EdgeRuntime
  if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
    edgeRuntime.waitUntil(task)
    return
  }

  // Fallback para execução local e testes fora do Supabase Edge Runtime.
  void task
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: ifoodCorsHeaders })
  }

  if (req.method !== 'POST') {
    return okJson({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const supabase = createServiceClient()
    const bodyText = await req.text()
    const receivedSignature = String(req.headers.get('x-ifood-signature') || '').trim()

    if (!bodyText || !receivedSignature) {
      return okJson({ ok: false, error: 'missing_signature_or_body' }, 401)
    }

    // O iFood assina o corpo bruto. A assinatura precisa ser validada antes do parse do JSON.
    const credentialSettings = await loadSettingsWithCredentials(supabase)
    const signedSettings = await findSettingsForSignature(
      credentialSettings,
      bodyText,
      receivedSignature,
    )

    if (!signedSettings) {
      return okJson({ ok: false, error: 'invalid_signature' }, 401)
    }

    let payload: any = null
    try {
      payload = JSON.parse(bodyText)
    } catch {
      return okJson({ ok: false, error: 'invalid_json' }, 400)
    }

    const events = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.events)
        ? payload.events
        : payload
          ? [payload]
          : []

    const firstEvent = events[0] || {}
    const fullCode = String(firstEvent?.fullCode || firstEvent?.code || '').trim().toUpperCase()

    // O teste de conectividade e os heartbeats não têm merchantId no modo por aplicação.
    if (fullCode === 'KEEPALIVE') {
      const requestedMerchantIds = Array.isArray(firstEvent?.merchantIds)
        ? firstEvent.merchantIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
        : []

      if (requestedMerchantIds.length > 0) {
        const onlineMerchantIds = credentialSettings
          .filter((item) => item?.client_secret === signedSettings.client_secret)
          .filter((item) => requestedMerchantIds.includes(String(item?.merchant_id || '')))
          .filter((item) => sanitizeIfoodSettings(item)?.merchant_enabled)
          .map((item) => String(item.merchant_id))

        return accepted({ merchantIds: onlineMerchantIds })
      }

      return accepted()
    }

    const merchantId = String(
      req.headers.get('x-ifood-merchant-id') ||
        req.headers.get('x-merchant-id') ||
        firstEvent?.merchantId ||
        firstEvent?.merchant_id ||
        '',
    ).trim()

    if (!merchantId) {
      return okJson({ ok: false, error: 'missing_merchant_id' }, 400)
    }

    const settings = await getMerchantIfoodSettings(supabase, merchantId)
    const currentSettings = sanitizeIfoodSettings(settings)
    if (!settings?.client_secret || !settings?.user_id) {
      return okJson({ ok: false, error: 'merchant_not_configured' }, 404)
    }

    // Impede que a credencial válida de outro aplicativo autorize evento para este merchant.
    if (!(await verifyIfoodSignature(bodyText, settings.client_secret, receivedSignature))) {
      await upsertIfoodSettings(supabase, settings.user_id, {
        merchant_id: settings.merchant_id,
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'signature_invalid',
        last_sync_message: 'Webhook recebido com assinatura inválida',
      })
      return okJson({ ok: false, error: 'invalid_signature' }, 401)
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of req.headers.entries()) {
      headers[key] = value
    }

    let inserted = 0
    let duplicates = 0
    const queuedRows: any[] = []

    // Persistir primeiro torna o webhook idempotente e funciona como fila durável.
    for (const event of events) {
      const { eventRow, duplicate } = await persistIfoodEvent(supabase, settings.user_id, event, {
        source: 'webhook',
        headers,
        signature: receivedSignature,
        httpStatus: 202,
      })

      if (duplicate) duplicates += 1
      else {
        inserted += 1
        queuedRows.push(eventRow)
      }
    }

    const processQueuedEvents = async () => {
      let processed = 0

      if (currentSettings?.merchant_enabled) {
        for (const eventRow of queuedRows) {
          try {
            await processIfoodEvent(supabase, settings, eventRow)
            processed += 1
          } catch {
            // O evento permanece persistido para auditoria e recuperação via polling.
          }
        }
      }

      await upsertIfoodSettings(supabase, settings.user_id, {
        merchant_id: settings.merchant_id,
        last_sync_at: new Date().toISOString(),
        last_sync_status: currentSettings?.merchant_enabled ? 'ok' : 'paused',
        last_sync_message: currentSettings?.merchant_enabled
          ? `${processed} evento(s) processado(s) via webhook`
          : `${events.length} evento(s) recebido(s), integração pausada`,
        status: currentSettings?.merchant_enabled ? 'online' : 'offline',
        last_event_at: new Date().toISOString(),
      })
    }

    queueBackgroundTask(processQueuedEvents())

    return accepted({
      ok: true,
      summary: {
        received: events.length,
        queued: inserted,
        duplicates,
      },
    })
  } catch (error: any) {
    return okJson(
      {
        ok: false,
        error: 'ifood_webhook_error',
        message: String(error?.message || error),
      },
      500,
    )
  }
})
