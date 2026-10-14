// 3CXplore — service worker (généré par scripts/generer_interface.py ; ne pas modifier à la main)
// Garde une copie de l'outil pour le hors ligne et récupère la dernière version quand le réseau est disponible.
// Les backups ne passent jamais par ici : ils sont lus depuis le disque, dans le navigateur.
const CACHE = '3cxplore-13.3.1';
const FILES = ["./", "./index.html", "./app/visualiseur-3cx-v13.3.1.html", "./app/documentation.html", "./app/firmwares-3cx.js", "./manifest.webmanifest", "./assets/icone-192.png", "./assets/icone-512.png", "./assets/logo-icone.svg"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('3cxplore-') && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  // réseau d'abord (dernière version), copie locale si hors ligne
  e.respondWith(fetch(r).then(res => { if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
