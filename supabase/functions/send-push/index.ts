// deno-lint-ignore-file no-explicit-any
import webpush from 'npm:web-push@3.4.5'

export const config = {
  runtime: 'edge',
}

webpush.setVapidDetails(
  'mailto:push@boracume.app',
  Deno.env.get('VAPID_PUBLIC_KEY') || '',
  Deno.env.get('VAPID_PRIVATE_KEY') || ''
)

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const body = await req.json()
    const { subscriptions = [], title = 'Novo Pedido!', body: message = 'Você recebeu um novo pedido.', url = '/pedidos' } = body || {}

    const payload = JSON.stringify({ title, body: message, url })
    const results: any[] = []
    for (const sub of subscriptions) {
      try {
        const res = await webpush.sendNotification(sub, payload)
        results.push({ ok: true, status: res.statusCode })
      } catch (e) {
        results.push({ ok: false, error: String(e?.message || e) })
      }
    }
    return Response.json({ ok: true, results })
  } catch (e) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 400 })
  }
}

