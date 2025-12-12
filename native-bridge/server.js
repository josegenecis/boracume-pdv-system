import { WebSocketServer } from 'ws'
import escpos from 'escpos'
import usb from 'escpos-usb'
import Bluetooth from 'escpos-bluetooth'
import Network from 'escpos-network'
import os from 'os'
import net from 'net'

escpos.USB = usb
escpos.Bluetooth = Bluetooth
escpos.Network = Network

const wss = new WebSocketServer({ port: 8766 })

let device = null
let printer = null

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
  return new Promise((resolve, reject) => {
    device.open(() => {
      try {
        printer.align('ct').style('b').text('BORA CUME HUB')
        printer.style('normal').text('Teste de Impressão').text('------------------------------')
        printer.align('rt').text('TOTAL: R$ 0,00')
        printer.align('ct').text('------------------------------').text('Obrigado!').cut().close()
        resolve(true)
      } catch (e) {
        reject(e)
      }
    })
  })
}

async function printReceipt(data) {
  const { order_number, customer_name, customer_phone, items = [], total = 0 } = data || {}
  return new Promise((resolve, reject) => {
    device.open(() => {
      try {
        printer.align('ct').style('b').text('BORA CUME HUB')
        printer.style('normal').text('--------------------------------')
        printer.align('lt').text(`Pedido: #${order_number}`).text(`Cliente: ${customer_name}`)
        if (customer_phone) printer.text(`Telefone: ${customer_phone}`)
        printer.text('--------------------------------')
        items.forEach(it => {
          printer.text(`${it.quantity}x ${it.product_name}`)
          printer.align('rt').text(`R$ ${Number(it.subtotal).toFixed(2)}`)
          printer.align('lt')
          if (it.notes) printer.text(`Obs: ${it.notes}`)
        })
        printer.text('--------------------------------')
        printer.align('rt').style('b').text(`TOTAL: R$ ${Number(total).toFixed(2)}`)
        printer.style('normal').align('ct').text('--------------------------------').text('Obrigado pela preferência!')
        printer.cut().close()
        resolve(true)
      } catch (e) {
        reject(e)
      }
    })
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
          let ok = false
          try {
            const dev = new escpos.USB()
            if (dev) ok = true
          } catch {}
          ws.send(JSON.stringify({ ok, event: 'scan_usb_done', printers: ok ? [{ transport: 'usb' }] : [] }))
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
