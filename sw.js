/* HMG Fitness : service worker de l'appli (installation sur l'écran d'accueil + hors connexion).
   Le site passe toujours par le réseau en premier : une mise à jour publiée arrive tout de suite.
   Sans réseau, la dernière version enregistrée s'ouvre quand même. La base (Supabase) n'est jamais mise en cache. */
const V = "hmg-v1";
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "apple-touch-icon.png"];
const TILES = "hmg-tuiles", TILE_MAX = 400;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trimTiles(){
  const c = await caches.open(TILES), ks = await c.keys();
  for (let i = 0; i < ks.length - TILE_MAX; i++) await c.delete(ks[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (/supabase\.co$/.test(u.hostname) || u.hostname === "api-adresse.data.gouv.fr") return; // données en direct
  // Pages du site : réseau d'abord, copie de secours hors connexion
  if (req.mode === "navigate" || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname))) {
    const key = u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname) ? "index.html" : u.origin + u.pathname;
    e.respondWith(fetch(req).then(r => {
      if (r.ok && u.origin === location.origin) { const cp = r.clone(); caches.open(V).then(c => c.put(key, cp)); }
      return r;
    }).catch(() => caches.match(key).then(r => r || caches.match("index.html"))));
    return;
  }
  // Tuiles de la carte : copie locale d'abord (carte qui s'affiche vite et hors connexion), rafraîchie en fond
  if (/tile\.openstreetmap\.org$/.test(u.hostname)) {
    e.respondWith(caches.open(TILES).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") { c.put(req, r.clone()); trimTiles(); } return r; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  // Polices et fichiers du site : cache d'abord
  if (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); }
      return r;
    })));
  }
});
