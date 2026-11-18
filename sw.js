/**
 * Browser Arcade - Progressive Web App Service Worker (v1.2)
 *
 * Implements high-performance offline caching for 100% zero-latency gameplay,
 * Stale-While-Revalidate asset delivery, and safe fallback isolation for 3rd-party providers.
 */

// Safe Monetag Push Notifications Integration
try {
  self.options = {
    domain: "3nbf4.com",
    zoneId: 12279414
  };
  self.lary = "";
  importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');
} catch (err) {
  // Push notification script bypass (offline or blocked)
}

const CACHE_NAME = 'browser-arcade-core-v1.3';

const PRECACHE_RESOURCES = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/assets/css/reset.css',
  '/assets/css/variables.css',
  '/assets/css/components.css',
  '/assets/css/platform.css',
  '/assets/js/arcade.js',
  '/assets/js/sound.js',
  '/assets/js/storage.js',
  '/assets/js/consent.js',
  '/assets/js/prng.js',
  '/games/2048/',
  '/games/2048/index.html',
  '/games/2048/css/2048.css',
  '/games/2048/js/main.js',
  '/games/2048/js/engine.js',
  '/games/2048/js/input.js',
  '/games/2048/js/renderer.js',
  '/games/snake/',
  '/games/snake/index.html',
  '/games/snake/css/snake.css',
  '/games/snake/js/main.js',
  '/games/snake/js/engine.js',
  '/games/snake/js/renderer.js',
  '/games/snake/js/input.js',
  '/games/minesweeper/',
  '/games/minesweeper/index.html',
  '/games/minesweeper/css/minesweeper.css',
  '/games/minesweeper/js/main.js',
  '/games/minesweeper/js/engine.js',
  '/games/minesweeper/js/renderer.js',
  '/games/minesweeper/js/input.js',
  '/games/blockdrop/',
  '/games/blockdrop/index.html',
  '/games/blockdrop/css/blockdrop.css',
  '/games/blockdrop/js/main.js',
  '/games/blockdrop/js/engine.js',
  '/games/blockdrop/js/renderer.js',
  '/games/blockdrop/js/input.js',
  '/unblocked/',
  '/unblocked/index.html',
  '/unblocked/2048/',
  '/unblocked/2048/index.html',
  '/unblocked/snake/',
  '/unblocked/snake/index.html',
  '/unblocked/minesweeper/',
  '/unblocked/minesweeper/index.html',
  '/unblocked/blockdrop/',
  '/unblocked/blockdrop/index.html',
  '/assets/images/games/2048-thumb.svg',
  '/assets/images/games/snake-thumb.svg',
  '/assets/images/games/minesweeper-thumb.svg',
  '/assets/images/games/blockdrop-thumb.svg'
];

// Pre-cache core platform shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_RESOURCES).catch((err) => {
        console.warn('[SW] Non-critical precache item skipped:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Purge obsolete cache generations on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Smart Fetch Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Strictly bypass non-GET and cross-origin 3rd-party ad/analytics domains
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // 2. Navigation requests (HTML pages): Network-First with Cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 3. Static Assets: Stale-While-Revalidate (Fast Instant Render + Silent Background Update)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      }).catch(() => {});

      return cachedResponse || fetchPromise;
    })
  );
});
