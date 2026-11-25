/* HMG Fitness : service worker (installation sur l'écran d'accueil + hors connexion).
   Fichiers du site (pages, css/, js/) : réseau d'abord, copie de secours hors connexion.
   Les css/ et js/ sont appelés avec ?v=<empreinte> (outils/versions.py) : une mise à jour publiée arrive tout de suite.
   La base (Supabase) et les tuiles de la carte ne sont jamais mises en cache ici. */
const V = "hmg-v3";
const CORE = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const enCache = (cle, r) => { if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(V).then(c => c.put(cle, cp)); } return r; };

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (/supabase\.co$/.test(u.hostname) || u.hostname === "api-adresse.data.gouv.fr") return; // données en direct
  if (/openstreetmap\.org$/.test(u.hostname)) return; // tuiles : jamais touchées
  const page = req.mode === "navigate" || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname));
  if (page) {
    const cle = u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname) ? "index.html" : u.origin + u.pathname;
    e.respondWith(fetch(req).then(r => u.origin === location.origin ? enCache(cle, r) : r)
      .catch(() => caches.match(cle).then(r => r || caches.match("index.html"))));
    return;
  }
  // css/ et js/ du site : réseau d'abord (la version exacte demandée), sinon la dernière copie connue
  if (u.origin === location.origin && /\/(css|js)\//.test(u.pathname)) {
    const cle = u.origin + u.pathname;
    e.respondWith(fetch(req).then(r => enCache(cle, r)).catch(() => caches.match(cle)));
    return;
  }
  // Polices et images du site : cache d'abord
  if (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => enCache(req, r))));
  }
});
