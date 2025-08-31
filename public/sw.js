const CACHE_NAME = 'boracume-v1.0.0';
const STATIC_CACHE = 'boracume-static-v1.0.0';
const DYNAMIC_CACHE = 'boracume-dynamic-v1.0.0';
const API_CACHE = 'boracume-api-v1.0.0';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/sounds/notification.mp3',
  '/sounds/bell.mp3',
  '/sounds/chime.mp3',
  '/sounds/ding.mp3'
];

// Routes to pre-cache
const DYNAMIC_ROUTES = [
  '/menu-digital',
  '/dashboard',
  '/pdv',
  '/kitchen',
  '/orders',
  '/products',
  '/customers',
  '/reports',
  '/settings'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker v1.0.0');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('[SW] Pre-caching dynamic routes');
        return cache.addAll(DYNAMIC_ROUTES);
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker v1.0.0');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== API_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event with improved caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) return;

  // Different strategies for different types of requests
  if (request.destination === 'document') {
    // HTML pages - Network First with cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (request.destination === 'image') {
    // Images - Cache First
    event.respondWith(cacheFirstStrategy(request));
  } else if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
    // API calls - Network Only with offline fallback
    event.respondWith(networkOnlyStrategy(request));
  } else if (request.destination === 'script' || 
             request.destination === 'style' || 
             request.destination === 'font') {
    // Static assets - Stale While Revalidate
    event.respondWith(staleWhileRevalidateStrategy(request));
  } else {
    // Default - Cache First with network fallback
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Network First Strategy
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Fallback to index.html for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw error;
  }
}

// Cache First Strategy
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url);
    throw error;
  }
}

// Network Only Strategy (for APIs)
async function networkOnlyStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache successful API responses for short time
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      const clonedResponse = networkResponse.clone();
      // Set expiration for API cache (5 minutes)
      const headers = new Headers(clonedResponse.headers);
      headers.set('sw-cache-timestamp', Date.now().toString());
      const responseWithTimestamp = new Response(clonedResponse.body, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers: headers
      });
      cache.put(request, responseWithTimestamp);
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] API request failed, trying cache:', request.url);
    // Try to serve from API cache if available and not expired
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      const timestamp = cachedResponse.headers.get('sw-cache-timestamp');
      if (timestamp && (Date.now() - parseInt(timestamp)) < 300000) { // 5 minutes
        return cachedResponse;
      }
    }
    throw error;
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    console.log('[SW] Network failed for:', request.url);
  });
  
  return cachedResponse || fetchPromise;
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
    // Handle offline actions when back online
  }
});

// Push notifications
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});