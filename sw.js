const CACHE_VERSION = 'kids-schedule-v6';
const APP_SHELL = [
  '/',
  '/Schedule.html',
  '/tweaks-panel.jsx',
  '/manifest.webmanifest',
  '/icon.svg',
];
const THIRD_PARTY_ASSETS = [
  'https://unpkg.com/react@18.3.1/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap',
];
const CALENDAR_PATH = '/api/google-calendar';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(APP_SHELL);
    await Promise.allSettled(THIRD_PARTY_ASSETS.map(async asset => {
      const response = await fetch(asset, { mode: 'cors' });
      if (response.ok) await cache.put(asset, response);
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

async function networkFirst(request, options = {}) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request, options);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

function isThirdPartyAsset(url) {
  return THIRD_PARTY_ASSETS.includes(url.href) || url.hostname === 'fonts.gstatic.com';
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  if (url.origin !== self.location.origin) {
    if (isThirdPartyAsset(url)) event.respondWith(cacheFirst(event.request));
    return;
  }

  if (url.pathname === CALENDAR_PATH) {
    event.respondWith(networkFirst(event.request, { cache: 'no-store' }));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request).catch(() => caches.match('/Schedule.html')));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
