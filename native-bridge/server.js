import { WebSocketServer } from 'ws'
import escpos from 'escpos'
import usb from 'escpos-usb'
import Bluetooth from 'escpos-bluetooth'
import Network from 'escpos-network'
import os from 'os'
import net from 'net'
import nodeUsb from 'usb'
import printerLib from 'printer'

escpos.USB = usb
escpos.Bluetooth = Bluetooth
escpos.Network = Network

const wss = new WebSocketServer({ port: 8766 })

let device = null
let printer = null
let systemPrinterName = null

const getEnv = (...keys) => {
  for (const k of keys) {
    const v = process.env[k]
    if (v) return v
  }
  return ''
}

function openPrinter(transport, address) {
  try {
    switch (transport) {
      case 'network':
        device = new escpos.Network(address || '192.168.0.100')
        break
      case 'usb':
        device = new escpos.USB()
        break
      case 'bluetooth':
        device = new escpos.Bluetooth(address || undefined)
        break
      case 'system':
        systemPrinterName = address || null
        device = null
        printer = null
        return !!systemPrinterName
      default:
        throw new Error('Unsupported transport')
    }
    printer = new escpos.Printer(device)
    return true
  } catch (e) {
    console.error('openPrinter error', e)
    return false
  }
}

async function printTest() {
  const data = buildEscpos({ header: 'Teste de Impressão', items: [{ name: 'Item', qty: 1, subtotal: 0 }], total: 0, order_number: 'TESTE' })
  if (systemPrinterName) {
    return await printRawSystem(data)
  }
  return new Promise((resolve, reject) => {
    device.open(() => {
      try {
        sendEscposViaLib(data)
        resolve(true)
      } catch (e) { reject(e) }
    })
  })
}

async function printReceipt(data) {
  const { order_number, customer_name, customer_phone, items = [], total = 0 } = data || {}
  const escposData = buildEscpos({ header: `Pedido #${order_number}`, customer_name, customer_phone, items, total, order_number })
  if (systemPrinterName) {
    return await printRawSystem(escposData)
  }
  return new Promise((resolve, reject) => {
    device.open(() => {
      try { sendEscposViaLib(escposData); resolve(true) } catch (e) { reject(e) }
    })
  })
}

function buildEscpos({ header = 'BORA CUME HUB', customer_name, customer_phone, items = [], total = 0, order_number }) {
  let d = ''
  d += '\x1B\x61\x01' // center
  d += '\x1B\x45\x01' // bold on
  d += 'BORA CUME HUB\n'
  d += '\x1B\x45\x00' // bold off
  d += '--------------------------------\n'
  d += '\x1B\x61\x00' // left
  if (order_number) d += `Pedido: #${order_number}\n`
  if (customer_name) d += `Cliente: ${customer_name}\n`
  if (customer_phone) d += `Telefone: ${customer_phone}\n`
  d += '--------------------------------\n'
  items.forEach((it) => {
    const name = it.product_name || it.name || ''
    const qty = it.quantity || it.qty || 1
    const sub = Number(it.subtotal || it.price || 0)
    d += `${qty}x ${name}\n`
    d += '\x1B\x61\x02' // right
    d += `R$ ${sub.toFixed(2)}\n`
    d += '\x1B\x61\x00' // left
    if (it.notes) d += `Obs: ${it.notes}\n`
  })
  d += '--------------------------------\n'
  d += '\x1B\x61\x02' // right
  d += '\x1B\x45\x01' // bold on
  d += `TOTAL: R$ ${Number(total).toFixed(2)}\n`
  d += '\x1B\x45\x00' // bold off
  d += '\x1B\x61\x01' // center
  d += '--------------------------------\n'
  d += 'Obrigado pela preferência!\n\n\n'
  d += '\x1D\x56\x00' // cut
  return d
}

function sendEscposViaLib(data) {
  // escpos lib prints via device/printer
  printer.align('ct').text('') // no-op to ensure instance exists
  // As escpos lib expects builder methods; instead write raw via device?
  // Fallback: use network directly for 9100
  if (device && device.constructor?.name === 'Network') {
    const sock = new net.Socket()
    const addr = device.address || device?.opts?.address
    sock.connect(9100, addr, () => { sock.write(Buffer.from(data, 'binary')); sock.end() })
  } else {
    // For USB/Bluetooth via escpos, not all provide raw write; attempt text
    printer.text('')
  }
}

async function printRawSystem(data) {
  return await new Promise((resolve) => {
    try {
      printerLib.printDirect({ data, printer: systemPrinterName || undefined, type: 'RAW', success: () => resolve(true), error: () => resolve(false) })
    } catch { resolve(false) }
  })
}

function getLocalSubnets() {
  const ifaces = os.networkInterfaces()
  const subnets = []
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (!info || info.internal || info.family !== 'IPv4') continue
      const ip = info.address.split('.')
      const subnet = `${ip[0]}.${ip[1]}.${ip[2]}.`
      subnets.push(subnet)
    }
  }
  return [...new Set(subnets)]
}

async function scanNetwork9100(subnet) {
  const ips = []
  const testIp = (ip) => new Promise((resolve) => {
    const socket = new net.Socket()
    let resolved = false
    const done = (ok) => { if (!resolved) { resolved = true; try { socket.destroy() } catch {} ; resolve(ok) } }
    socket.setTimeout(800)
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.once('timeout', () => done(false))
    try { socket.connect(9100, ip) } catch { done(false) }
  })
  const tasks = []
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}${i}`
    tasks.push((async () => { const ok = await testIp(ip); if (ok) ips.push(ip) })())
  }
  await Promise.all(tasks)
  return ips
}

wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let msg
    try { msg = JSON.parse(raw) } catch { ws.send(JSON.stringify({ ok: false, error: 'invalid_json' })); return }
    const { action, payload } = msg
    try {
      switch (action) {
        case 'connect_printer': {
          const ok = openPrinter(payload?.transport || 'network', payload?.address)
          ws.send(JSON.stringify({ ok, event: 'printer_connected' }))
          break
        }
        case 'test_print': {
          const ok = printer ? await printTest() : false
          ws.send(JSON.stringify({ ok, event: 'printed_test' }))
          break
        }
        case 'print_receipt': {
          const ok = printer ? await printReceipt(payload) : false
          ws.send(JSON.stringify({ ok, event: 'printed_receipt' }))
          break
        }
        case 'scan_network_printers': {
          const subnets = payload?.subnets && Array.isArray(payload.subnets) && payload.subnets.length > 0 ? payload.subnets : getLocalSubnets()
          const results = []
          for (const subnet of subnets) {
            const found = await scanNetwork9100(subnet)
            for (const ip of found) results.push({ ip, transport: 'network' })
          }
          ws.send(JSON.stringify({ ok: true, event: 'scan_network_done', printers: results }))
          break
        }
        case 'scan_usb_printers': {
          let list = []
          try {
            const devices = nodeUsb.getDeviceList()
            list = devices.map(d => ({ vendorId: d.deviceDescriptor?.idVendor, productId: d.deviceDescriptor?.idProduct, transport: 'usb' }))
          } catch {}
          ws.send(JSON.stringify({ ok: true, event: 'scan_usb_done', printers: list }))
          break
        }
        case 'scan_os_printers': {
          try {
            const printers = printerLib.getPrinters() || []
            ws.send(JSON.stringify({ ok: true, event: 'scan_os_done', printers: printers.map(p => ({ name: p.name, isDefault: p.isDefault, transport: 'system' })) }))
          } catch (e) {
            ws.send(JSON.stringify({ ok: false, event: 'scan_os_done', printers: [] }))
          }
          break
        }
        default:
          ws.send(JSON.stringify({ ok: false, error: 'unknown_action' }))
      }
    } catch (e) {
      ws.send(JSON.stringify({ ok: false, error: String(e?.message || e) }))
    }
  })
  ws.send(JSON.stringify({ ok: true, event: 'connected' }))
})

console.log('Native Bridge listening on ws://localhost:8766')

const supabaseUrl = getEnv('SUPABASE_URL', 'BORACUME_SUPABASE_URL')
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', 'BORACUME_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
const printAgentToken = getEnv('PRINT_AGENT_TOKEN')
const relayTransport = getEnv('PRINT_TRANSPORT', 'BRIDGE_TRANSPORT') || 'system'
const relayAddress = getEnv('PRINT_ADDRESS', 'BRIDGE_ADDRESS') || ''
const relayIntervalMs = Number(getEnv('PRINT_RELAY_INTERVAL_MS') || '2000')
const reportIntervalMs = Number(getEnv('PRINT_REPORT_INTERVAL_MS') || '5000')

async function pollPrintJobs() {
  if (!supabaseUrl || !supabaseAnonKey || !printAgentToken) return
  try {
    const resp = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/print-agent-poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-print-agent-token': printAgentToken,
      },
      body: JSON.stringify({ limit: 5 }),
    })
    const json = await resp.json().catch(() => ({}))
    const jobs = Array.isArray(json?.jobs) ? json.jobs : []
    if (jobs.length === 0) return

    for (const job of jobs) {
      let ok = false
      let errText = ''
      try {
        const printerCfg = job?.payload?.printer || {}
        const transport = printerCfg.transport || relayTransport
        const address = printerCfg.address || relayAddress || undefined
        try { openPrinter(transport, address) } catch {}
        ok = await printReceipt(job?.payload || {})
      } catch (e) {
        ok = false
        errText = String(e?.message || e)
      }

      await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/print-agent-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'x-print-agent-token': printAgentToken,
        },
        body: JSON.stringify({ jobId: job.id, ok, error: errText }),
      }).catch(() => {})
    }
  } catch {
  }
}

async function reportPrinters() {
  if (!supabaseUrl || !supabaseAnonKey || !printAgentToken) return
  try {
    let printers = []
    try {
      const list = printerLib.getPrinters() || []
      printers = list.map((p) => ({
        printer_id: p.name,
        name: p.isDefault ? `${p.name} (padrão)` : p.name,
        transport: 'system',
        address: p.name,
        meta: { isDefault: !!p.isDefault, status: p.status || null },
      }))
    } catch {
      printers = []
    }

    await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/print-agent-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-print-agent-token': printAgentToken,
      },
      body: JSON.stringify({ printers }),
    }).catch(() => {})
  } catch {
  }
}

try {
  openPrinter(relayTransport, relayAddress || undefined)
} catch {
}

if (supabaseUrl && supabaseAnonKey && printAgentToken) {
  setInterval(pollPrintJobs, Math.max(500, relayIntervalMs))
  setInterval(reportPrinters, Math.max(1000, reportIntervalMs))
  reportPrinters()
}
