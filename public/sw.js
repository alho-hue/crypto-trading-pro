// Service Worker for Crypto Trading Pro PWA
const CACHE_NAME = 'crypto-trading-pro-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/wolf-ffomix.png',
];

// Cache pour les données dynamiques (prix, etc.)
const DATA_CACHE_NAME = 'crypto-data-cache-v1';
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Message handler for skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network with offline support
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip chrome-extension and other unsupported schemes
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  // API requests - cache avec stratégie stale-while-revalidate
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cached); // Fallback sur cache si network fail
          
          // Return cached immediately if available, otherwise wait for network
          return cached || fetchPromise;
        });
      })
    );
    return;
  }
  
  // Static assets - cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached version immediately
      if (cached) {
        // Refresh cache in background
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        return cached;
      }
      
      // Not in cache, fetch from network
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Return offline fallback if available
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// Periodic background sync for price updates
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'price-update') {
    event.waitUntil(updatePricesInBackground());
  }
});

async function updatePricesInBackground() {
  try {
    // Fetch latest prices
    const response = await fetch('/api/binance/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","BNBUSDT"]');
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE_NAME);
      await cache.put('/api/prices/latest', response.clone());
    }
  } catch (error) {
    console.log('Background price update failed');
  }
}

async function doBackgroundSync() {
  console.log('Background sync executed');
}

// Push notifications support
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Nouvelle notification',
    icon: '/wolf-ffomix.png',
    badge: '/wolf-ffomix.png',
    tag: 'crypto-trading-alert',
    requireInteraction: true,
  };
  
  event.waitUntil(
    self.registration.showNotification('Crypto Trading Pro', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
