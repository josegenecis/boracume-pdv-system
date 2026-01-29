import type { PrinterTransport } from '@/services/printerConfig'

type BridgeResponse =
  | { ok: boolean; event?: string; error?: string }
  | { ok: boolean; error: string }

const waitForEvent = (ws: WebSocket, event: string, timeoutMs: number) => {
  return new Promise<BridgeResponse>((resolve) => {
    const timeout = window.setTimeout(() => {
      ws.removeEventListener('message', onMessage)
      resolve({ ok: false, error: 'timeout' })
    }, timeoutMs)

    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data)
        if (data?.event === event) {
          window.clearTimeout(timeout)
          ws.removeEventListener('message', onMessage)
          resolve(data)
        }
      } catch {
      }
    }

    ws.addEventListener('message', onMessage)
  })
}

export const bridgePrintReceipt = async (params: {
  websocketUrl: string
  transport: PrinterTransport
  address?: string
  payload: any
  timeoutMs?: number
}): Promise<boolean> => {
  const timeoutMs = Math.max(1000, params.timeoutMs ?? 10000)
  const ws = new WebSocket(params.websocketUrl)

  const opened = await new Promise<boolean>((resolve) => {
    const t = window.setTimeout(() => resolve(false), Math.min(3000, timeoutMs))
    ws.onopen = () => {
      window.clearTimeout(t)
      resolve(true)
    }
    ws.onerror = () => {
      window.clearTimeout(t)
      resolve(false)
    }
  })

  if (!opened) {
    try { ws.close() } catch {}
    return false
  }

  try {
    ws.send(JSON.stringify({ action: 'connect_printer', payload: { transport: params.transport, address: params.address } }))
    const connected = await waitForEvent(ws, 'printer_connected', timeoutMs)
    if (!connected?.ok) return false

    ws.send(JSON.stringify({ action: 'print_receipt', payload: params.payload }))
    const printed = await waitForEvent(ws, 'printed_receipt', timeoutMs)
    return !!printed?.ok
  } catch {
    return false
  } finally {
    try { ws.close() } catch {}
  }
}
