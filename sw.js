/* Mesopotamia — service worker.
   Bump CACHE when shipping changes, or clients keep serving the old files. */

var CACHE = 'meso-v1';

/* Only the shell: pages and the assets every page needs. Product images are
   left out on purpose — they are many and heavy, and the runtime cache below
   picks up whatever the visitor actually opens. */
var SHELL = [
  '/index.html',
  '/meniu.html',
  '/locatii.html',
  '/contact.html',
  '/cariera.html',
  '/more.html',
  '/en/index.html',
  '/css/layout.css',
  '/css/index.css',
  '/js/main.js',
  '/icons/LogoMesopotamia_darkmode.svg',
  '/icons/LogoMesopotamia_lightmode.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  /* addAll rejects the whole install if any single file 404s, so each one is
     fetched separately and failures are tolerated. */
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* CDN fonts/icons: leave alone */

  /* Navigations go network-first: a stale page is worse than a slow one, and
     the cache is the fallback when offline. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('/index.html');
        });
      })
    );
    return;
  }

  /* Everything else is cache-first: CSS, JS and images are versioned or
     stable, so serving them instantly matters more than freshness. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        /* Opaque and error responses are not worth storing */
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      });
    })
  );
});
