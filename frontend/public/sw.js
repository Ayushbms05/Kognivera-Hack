const CACHE_NAME = 'stayfinder-offline-v1';
const STATIC_ASSETS = [
  '/',
  '/search',
  '/favicon.ico',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Initial cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache image assets and API offline fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache-first for images (Unsplash, local media, static icons)
  if (
    event.request.destination === 'image' ||
    url.hostname.includes('unsplash.com') ||
    url.pathname.includes('/media/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Return placeholder or cached fallback if available
            return cachedResponse || new Response('', { status: 404 });
          });
      })
    );
    return;
  }

  // Network-first for other requests
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cached) => {
        return cached || caches.match('/');
      });
    })
  );
});

// Message listener for background sync of image URLs
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_IMAGE_URLS') {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const promises = urls.map(async (u) => {
          try {
            const match = await cache.match(u);
            if (!match) {
              const res = await fetch(u, { mode: 'no-cors' });
              if (res) await cache.put(u, res);
            }
          } catch (e) {
            console.warn('[SW] Could not pre-cache URL:', u, e);
          }
        });
        await Promise.allSettled(promises);
        if (event.source) {
          event.source.postMessage({ type: 'CACHE_IMAGE_URLS_COMPLETE', count: urls.length });
        }
      })
    );
  }
});
