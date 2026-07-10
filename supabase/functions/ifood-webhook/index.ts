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
    let payload: any = null

    try {
      payload = bodyText ? JSON.parse(bodyText) : null 
    } catch {
      payload = null 
    }

    const events = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.events)
        ? payload.events
        : payload
          ? [payload] 
          : []

    const firstEvent = events[0] || {}
    const merchantId =
      String(
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

    const receivedSignature = String(req.headers.get('x-ifood-signature') || '').trim()
    const signatureOk = await verifyIfoodSignature(bodyText, settings.client_secret, receivedSignature)
    if (!signatureOk) {
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
    let processed = 0

    for (const event of events) {
      const { eventRow, duplicate } = await persistIfoodEvent(supabase, settings.user_id, event, {
        source: 'webhook',
        headers,
        signature: receivedSignature, 
        httpStatus: 200,
      })

      if (duplicate) duplicates += 1
      else inserted += 1

      if (!duplicate && currentSettings?.merchant_enabled) {
        try {
          await processIfoodEvent(supabase, settings, eventRow)
          processed += 1
        } catch {
          // o evento fica persistido com o erro registrado
        }
      }
    }

    await upsertIfoodSettings(supabase, settings.user_id, {
      merchant_id: settings.merchant_id,
      last_sync_at: new Date().toISOString(),
      last_sync_status: currentSettings?.merchant_enabled ? 'ok' : 'paused',
      last_sync_message: currentSettings?.merchant_enabled
        ? `${processed} evento(s) processado(s) via webhook`
        : `${events.length} evento(s) recebido(s), integraÃ§Ã£o pausada`,
      status: currentSettings?.merchant_enabled ? 'online' : 'offline',
      last_event_at: new Date().toISOString(),
    })

    return okJson({
      ok: true,
      summary: {
        received: events.length,
        inserted,
        duplicates,
        processed,
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
