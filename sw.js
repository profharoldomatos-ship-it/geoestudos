/* GeoEstudos: guarda o aplicativo no celular para abrir sem internet.
   Os resumos ficam guardados pelo próprio app (armazenamento do navegador). */
const VERSAO = 'geo-v1';
const BASE = ['./', 'index.html', 'config.js', 'manifest.webmanifest',
  'icones/geoestudos.svg', 'icones/geoestudos-96.png', 'icones/geoestudos-192.png', 'icones/geoestudos-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Fontes do Google: guarda na primeira vez
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSAO).then(c => c.match(req).then(r => r || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return; // dados do robô: o app cuida
  // Páginas e config: tenta a internet primeiro (pega atualizações), senão usa o guardado
  if (req.mode === 'navigate' || url.pathname.endsWith('config.js') || url.pathname.endsWith('index.html')) {
    e.respondWith(fetch(req).then(res => { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); return res; })));
});
