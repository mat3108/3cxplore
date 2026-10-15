// 3CXplore — service worker (généré par scripts/generer_interface.py ; ne pas modifier à la main)
// Garde une copie de l'outil pour le hors ligne et récupère la dernière version quand le réseau est disponible.
// Les backups ne passent jamais par ici : ils sont lus depuis le disque, dans le navigateur.
const CACHE = '3cxplore-17.4';
const FILES = ["./", "./index.html", "./app/visualiseur-3cx-v17.4.html", "./app/documentation.html", "./app/documentation-en.html", "./app/changelog.html", "./app/firmwares-3cx.js", "./manifest.webmanifest", "./assets/icone-192.png", "./assets/icone-512.png", "./assets/logo-icone.svg"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('3cxplore-') && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
// page d'accueil : on y redirige (vraie adresse) au lieu d'afficher son contenu sous une autre adresse,
// sinon ses liens relatifs pointent au mauvais endroit et les redirections bouclent (app/app/app/…)
const HOME = new URL('./index.html', self.registration.scope).href;
const home = r => r.mode === 'navigate' && r.url.split('#')[0] !== HOME ? Response.redirect(HOME, 302) : null;
self.addEventListener('fetch', e => {
  const r = e.request;
  if(r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  // réseau d'abord (dernière version), copie locale si hors ligne
  e.respondWith(fetch(r).then(res => {
      if(res.ok){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; }
      // page disparue (ancienne adresse) : aller à la dernière version plutôt qu'afficher une erreur 404
      if(res.status === 404) return home(r) || res;
      return res; })
    .catch(() => caches.match(r).then(m => m || home(r) || Response.error())));
});
