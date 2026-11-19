// Service worker: deixa a ficha funcionando offline depois do primeiro acesso.
// Ao mudar arquivos do app, aumente a versão para limpar o cache antigo.
const CACHE = 'ficha-rpg-v3';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/core.js', './js/storage.js', './js/store.js', './js/main.js',
  './js/ui/dom.js', './js/ui/sheet-view.js', './js/ui/dice-view.js', './js/ui/macro-dialog.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (pega atualizações); cache como reserva quando estiver offline.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
