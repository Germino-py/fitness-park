/* HMG Fitness : service worker de l'appli (installation sur l'écran d'accueil + hors connexion).
   Le site passe toujours par le réseau en premier : une mise à jour publiée arrive tout de suite.
   Sans réseau, la dernière version enregistrée s'ouvre quand même. La base (Supabase) n'est jamais mise en cache. */
const V = "hmg-v2";
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

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
  // Tuiles de la carte : jamais touchées, le navigateur les charge comme avant
  if (/openstreetmap\.org$/.test(u.hostname)) return;
  // Polices et fichiers du site : cache d'abord
  if (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(V).then(c => c.put(req, cp)); }
      return r;
    })));
  }
});
