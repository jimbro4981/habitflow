/**
 * HabitFlow - Service Worker
 *
 * Cache-first for local assets, network-first for Google Fonts.
 * Uses relative paths to work on both localhost and GitHub Pages.
 */

const CACHE_NAME = 'habitflow-v2';

const ASSET_PATHS = [
  './',
  './index.html',
  './manifest.json',
  './css/index.css',
  './css/themes.css',
  './css/components.css',
  './js/app.js',
  './js/db.js',
  './js/router.js',
  './js/components/habitCard.js',
  './js/components/habitForm.js',
  './js/components/heatmap.js',
  './js/components/stats.js',
  './js/components/categoryFilter.js',
  './js/components/themeToggle.js',
  './js/utils/dateUtils.js',
  './js/utils/streak.js',
  './js/utils/notifications.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ---------------------------------------------------------------------------
// Install — pre-cache all app assets
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_PATHS))
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — purge old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — cache-first for local assets, network-first for Google Fonts
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Google Fonts: network-first so updates are picked up, with cache fallback
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else: cache-first, falling back to network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
