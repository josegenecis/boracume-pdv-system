self.addEventListener('push', function(event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  const title = data.title || 'Novo Pedido!'
  const body = data.body || 'Você recebeu um novo pedido.'
  const options = {
    body,
    tag: data.tag || 'boracume-order',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    icon: '/icons/icon-192.png',
    badge: '/icons/badge.png',
    data: { url: data.url || '/pedidos' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/pedidos'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

