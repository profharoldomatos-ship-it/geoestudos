/* GeoEstudos: guarda o aplicativo no celular para abrir sem internet.
   Os resumos ficam guardados pelo próprio app (armazenamento do navegador). */
const VERSAO = 'geo-v17';
const BASE = ['./', 'index.html', 'config.js', 'manifest.webmanifest',
  'icones/geoestudos.svg', 'icones/geoestudos-96.png', 'icones/geoestudos-192.png', 'icones/geoestudos-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== 'geo-push').map(k => caches.delete(k))))
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

/* ---------- Avisos no celular ----------
   O robô manda só um "toque". Aqui o app busca no robô o texto dos avisos da turma
   escolhida neste celular e mostra a notificação. */
async function lerPush(k) { try { const c = await caches.open('geo-push'); const r = await c.match(k); return r ? await r.text() : ''; } catch (e) { return ''; } }
async function gravarPush(k, v) { try { const c = await caches.open('geo-push'); await c.put(k, new Response(String(v))); } catch (e) {} }

async function mostrarAvisos() {
  const turmas = (await lerPush('turma')).split(',').filter(Boolean), url = await lerPush('dataurl');
  const ultimo = Number(await lerPush('ultimo')) || 0;
  const icon = 'icones/geoestudos-192.png', badge = 'icones/badge-96.png';
  let lista = [];
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'avisos=1&t=' + Date.now(), { cache: 'no-store' });
    const j = await r.json();
    lista = (j.notificacoes || []).filter(n => turmas.includes(n.turma) && Date.parse(n.quando) > ultimo);
  } catch (e) {}
  if (!lista.length) {
    return self.registration.showNotification('GeoEstudos', { body: 'Há novidades para a sua turma. Toque para ver.', icon, badge, tag: 'geo-geral', data: { turma: turmas[0] || '', ir: 'turma' } });
  }
  lista.sort((a, b) => a.quando.localeCompare(b.quando));
  await gravarPush('ultimo', Date.parse(lista[lista.length - 1].quando));
  for (const n of lista.slice(-3)) {
    const titulo = turmas.length > 1 ? 'Turma ' + n.turma + ' · ' + n.titulo : n.titulo;
    await self.registration.showNotification(titulo, { body: n.texto, icon, badge, tag: n.id, data: { turma: n.turma, ir: n.tab || 'turma', cap: n.cap || '' } });
  }
}
self.addEventListener('push', e => e.waitUntil(mostrarAvisos()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  const destino = './?turma=' + encodeURIComponent(d.turma || '') + '&ir=' + encodeURIComponent(d.ir || 'turma') + (d.cap ? '&cap=' + d.cap : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) {
      if (new URL(w.url).pathname.startsWith(new URL(self.registration.scope).pathname) && 'focus' in w) {
        w.postMessage({ geoAbrir: { turma: d.turma, ir: d.ir, cap: d.cap } });
        return w.focus();
      }
    }
    return self.clients.openWindow(destino);
  }));
});
