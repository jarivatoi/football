const CACHE_NAME = 'football-v1.0.2';
const STATIC_CACHE = 'football-static-v3';
const DATA_CACHE = 'football-data-v3';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/football/',
  '/football/index.html',
  '/football/manifest.json'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete ALL old caches on activation (except IndexedDB data)
          // This prevents memory buildup from stale cached API responses
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests (Totelepep data)
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) => {
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(async () => {
            // Return cached data if network fails
            const cached = await cache.match(request);
            if (cached) {
              return cached;
            }
            // Return a proper error response if nothing is cached
            return new Response(JSON.stringify({ error: 'Network error and no cached data' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
      })
    );
    return;
  }

  // Handle static files
  event.respondWith(
    caches.match(request)
      .then(async (response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        try {
          return await fetch(request);
        } catch (error) {
          // Fallback for offline
          if (request.destination === 'document') {
            const fallback = await caches.match('/index.html');
            if (fallback) {
              return fallback;
            }
          }
          // Return a proper error response instead of undefined
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        }
      })
  );
});

// Background sync for data updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-matches') {
    event.waitUntil(updateMatchData());
  }
});

// Update match data in background
async function updateMatchData() {
  try {
    const response = await fetch('/api');
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE);
      await cache.put('/api', response);
    }
  } catch (error) {
    // Background sync failed silently
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'New match updates available',
      icon: '/football/icon.png',
      badge: '/football/icon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || 1
      },
      actions: [
        {
          action: 'explore',
          title: 'View Matches',
          icon: '/football/icon.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/football/icon.png'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Football Update', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for cache clearing
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Re-cache static files after clearing
      return caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_FILES);
      });
    });
  }
});