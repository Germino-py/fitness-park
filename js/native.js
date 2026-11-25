/* ================= PONT NATIF « HMGN » : la couche iPhone / Android de l'appli =================
   Fichier SOURCE (modules ES). app/build-www.js le construit avec esbuild en un seul fichier classique,
   www/js/native.bundle.js, chargé dans l'appli AVANT tous les autres scripts. Le site hmgfitness.fr ne le charge jamais.

   Ce qu'il fait :
   1. Dans l'appli, il remplace proprement les API web que js/app.js utilise déjà par les modules natifs de Capacitor :
      navigator.vibrate (n'existe pas sur iPhone), navigator.share / canShare, navigator.clipboard.writeText,
      navigator.geolocation (une seule demande d'autorisation, celle d'iOS), window.open et les liens externes
      (navigateur intégré, Plans pour l'itinéraire). js/app.js marche donc sans changement de fond.
   2. Il met l'état du joueur à l'abri : chaque clé « hmg-… » de localStorage est recopiée dans Preferences
      (iOS peut vider localStorage quand l'iPhone manque de place), et l'identité (hmg-voter, hmg-visitor) dans le
      trousseau, qui survit à la réinstallation et suit le trousseau iCloud. Au lancement, ce qui manque est remis
      AVANT que js/app.js ne démarre (les autres scripts de la page sont chargés ensuite, dans l'ordre).
   3. Il offre window.HMGN à l'interface et à js/serveur.js (l'API complète est décrite en bas du fichier).

   Évènements envoyés sur window (CustomEvent) :
   - « hmg:route »   { detail: {chemin, …, url} }, annulable : un lien, un lien universel ou une notification ouvre l'appli.
                     Appeler e.preventDefault() pour gérer soi-même ; sinon HMGN applique le comportement par défaut.
   - « hmg:retour »  { detail: {absence} } : l'appli revient au premier plan après plus de 30 min (absence en ms).
   - « hmg:etat-appli » { detail: {actif} } : chaque passage au premier plan ou en arrière-plan.
   - « hmg:reseau »  { detail: {connected, connectionType} } : le réseau change.
   - « hmg:clavier » { detail: {ouvert, hauteur} } : le clavier s'ouvre ou se ferme (aussi : --clavier et html.clavier).
   - « hmg:retour-arriere » (Android), annulable : bouton retour du téléphone.
   - « hmg:pret »    : les scripts de l'appli sont chargés et l'écran de démarrage va se retirer. */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Geolocation } from "@capacitor/geolocation";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Clipboard } from "@capacitor/clipboard";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { AppLauncher } from "@capacitor/app-launcher";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { Network } from "@capacitor/network";
import { ActionSheet, ActionSheetButtonStyle } from "@capacitor/action-sheet";
import { Dialog } from "@capacitor/dialog";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const PLATEFORME = Capacitor.getPlatform();          // "ios", "android" ou "web"
const N = Capacitor.isNativePlatform();
const IOS = PLATEFORME === "ios", ANDROID = PLATEFORME === "android";
const APPAREIL = IOS ? "iPhone" : "téléphone";
const DOMAINES = ["hmgfitness.fr", "www.hmgfitness.fr"];
const nav = window.navigator;
const pause = ms => new Promise(ok => setTimeout(ok, ms));
const signaler = (quoi, e) => console.warn("[HMGN] " + quoi + " :", e && e.message ? e.message : e);
const tente = async (quoi, f, defaut) => { try { return await f(); } catch (e) { signaler(quoi, e); return defaut; } };
const envoyer = (nom, detail, annulable) => { const ev = new CustomEvent(nom, { detail, cancelable: !!annulable }); window.dispatchEvent(ev); return ev; };
const globale = nom => { try { return window[nom] || (0, eval)("typeof " + nom + "!=='undefined'?" + nom + ":undefined"); } catch (e) { return undefined; } };

/* ---------- localStorage : accès sans passer par la recopie (utilisé pendant la restauration) */
const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const SP = window.Storage && Storage.prototype;
const ORIG = SP ? { set: SP.setItem, del: SP.removeItem, clear: SP.clear } : null;
const lsGet = k => { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } };
const lsSet = (k, v) => { try { if (LS) ORIG.set.call(LS, k, v); } catch (e) { /* quota ou stockage bloqué */ } };
const lsDel = k => { try { if (LS) ORIG.del.call(LS, k); } catch (e) { /* idem */ } };
const lsJson = (k, d) => { try { const v = lsGet(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsMettreJson = (k, v) => lsSet(k, JSON.stringify(v));   // données internes à HMGN : jamais recopiées

/* ================= TEXTES (tutoiement, phrases simples) ================= */
const TEXTES = {
  positionRefusee: IOS
    ? "Tu as refusé la localisation pour HMG. Pour valider tes séances, ouvre Réglages › HMG Fitness › Position et choisis « Lorsque l'app est active »."
    : "Tu as refusé la localisation pour HMG. Pour valider tes séances, autorise la position dans les paramètres du téléphone › Applis › HMG Fitness › Autorisations.",
  positionDesactivee: IOS
    ? "La localisation est coupée sur ton iPhone. Active-la dans Réglages › Confidentialité et sécurité › Service de localisation, puis réessaie."
    : "La localisation est coupée sur ton téléphone. Active-la dans les paramètres (Position), puis réessaie.",
  positionIntrouvable: "Je n'arrive pas à te situer. Approche-toi de l'entrée ou d'une fenêtre, puis réessaie.",
  positionImprecise: acc => (IOS
    ? `Ton iPhone te situe seulement à ±${Math.round(acc || 0)} m près. Active « Position exacte » dans Réglages › HMG Fitness › Position, puis réessaie près de l'entrée.`
    : `Ton téléphone te situe seulement à ±${Math.round(acc || 0)} m près. Active « Utiliser la position exacte » pour HMG Fitness dans les paramètres, puis réessaie près de l'entrée.`),
  ouvrirReglages: "Ouvrir les réglages",
  partager: "Partager",
  partagerHeros: "Partager mon héros",
  itineraire: "Itinéraire",
  annuler: "Annuler",
};
const IMPRECIS_M = 500;   // au-delà, la position vient sans doute de « Position exacte » coupée (iOS donne alors 1 à 10 km)

/* ================= VIBRATIONS (3-ux-appli §5.1) ================= */
const CLE_VIB = "hmg-vib";   // l'interrupteur « Vibrations » de Réglages (js/onglets.js) ; false = coupées
let selFin = 0;
const VIB = {
  leger: () => Haptics.impact({ style: ImpactStyle.Light }),
  moyen: () => Haptics.impact({ style: ImpactStyle.Medium }),
  fort: () => Haptics.impact({ style: ImpactStyle.Heavy }),
  succes: () => Haptics.notification({ type: NotificationType.Success }),
  alerte: () => Haptics.notification({ type: NotificationType.Warning }),
  erreur: () => Haptics.notification({ type: NotificationType.Error }),
  async selection() {   // le petit cran d'un sélecteur (héros, teinte, note)
    clearTimeout(selFin); await Haptics.selectionStart(); await Haptics.selectionChanged();
    selFin = setTimeout(() => Haptics.selectionEnd().catch(() => {}), 1500);
  },
  async double() { await VIB.moyen(); await pause(140); await VIB.moyen(); },                                   // nouveau physique, nouveau monde
  async montee() { await VIB.leger(); await pause(90); await VIB.moyen(); await pause(90); await VIB.fort(); await pause(160); await VIB.succes(); }, // légendaire
};
VIB.tap = VIB.leger; VIB.choix = VIB.selection;   // « choix » : nom utilisé par js/onglets.js
const vibrationsActives = () => lsJson(CLE_VIB, true) !== false;
function vibrer(type) {
  if (!N || !vibrationsActives()) return Promise.resolve(false);
  return (VIB[type] || VIB.leger)().then(() => true, e => { signaler("vibration", e); return false; });
}
/* navigator.vibrate(motif) d'app.js → la vibration iOS la plus proche (8 ms : léger, 18 : moyen, [20,40,60] : succès…) */
function motifVersType(m) {
  const a = (Array.isArray(m) ? m : [m]).map(Number).filter(x => x >= 0);
  if (!a.length || !(a[0] > 0)) return null;
  if (a.length >= 3) return "succes";
  return a[0] <= 12 ? "leger" : a[0] <= 25 ? "moyen" : "fort";
}

/* ================= POSITION ================= */
const ERR_POS = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
function erreurPosition(e) {
  const code = String((e && e.code) || ""), msg = String((e && e.message) || "");
  let c = 2, texte = TEXTES.positionIntrouvable, raison = "introuvable";
  if (/GLOC-000[38]\b/.test(code) || /denied|restricted|permission/i.test(msg)) { c = 1; texte = TEXTES.positionRefusee; raison = "refus"; }
  else if (/GLOC-0007\b/.test(code) || /not enabled|disabled|services/i.test(msg)) { texte = TEXTES.positionDesactivee; raison = "desactivee"; }
  else if (/GLOC-0010\b/.test(code) || /time ?out|in time/i.test(msg)) { c = 3; raison = "delai"; }
  return Object.assign({ code: c, message: msg || texte, texte, raison }, ERR_POS);
}
const versPosition = p => ({
  coords: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy,
    altitude: p.coords.altitude ?? null, altitudeAccuracy: p.coords.altitudeAccuracy ?? null,
    heading: p.coords.heading ?? null, speed: p.coords.speed ?? null },
  timestamp: p.timestamp || Date.now(),
});
const OPT_POS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
async function position(o) {
  const opts = Object.assign({}, OPT_POS, o || {});
  try { return versPosition(await Geolocation.getCurrentPosition(opts)); }
  catch (e) { throw erreurPosition(e); }
}
/* état de l'autorisation : "granted", "prompt", "denied" ou "desactivee" (localisation coupée sur tout le téléphone) */
position.etat = async function () {
  if (!N) { try { return (await nav.permissions.query({ name: "geolocation" })).state; } catch (e) { return "prompt"; } }
  try { const r = await Geolocation.checkPermissions(); return /^prompt/.test(r.location) ? "prompt" : r.location; }
  catch (e) { return erreurPosition(e).raison === "desactivee" ? "desactivee" : "prompt"; }
};
const geoNatif = {
  getCurrentPosition(ok, ko, o) { position(o).then(p => ok && ok(p), e => ko && ko(e)); },
  watchPosition(ok, ko, o) {
    const n = ++geoNatif._n;
    geoNatif._ids[n] = Geolocation.watchPosition(Object.assign({}, OPT_POS, { timeout: 30000 }, o || {}), (p, e) => {
      if (e) { if (ko) ko(erreurPosition(e)); } else if (p && ok) ok(versPosition(p));
    }).catch(e => { if (ko) ko(erreurPosition(e)); return null; });
    return n;
  },
  clearWatch(n) { const p = geoNatif._ids[n]; delete geoNatif._ids[n]; if (p) p.then(id => id && Geolocation.clearWatch({ id })).catch(() => {}); },
  _n: 0, _ids: {},
};
async function reglages() {   // « Ouvrir les réglages » : la page de HMG dans Réglages (iPhone seulement)
  if (!IOS) return false;
  return tente("réglages", async () => { await AppLauncher.openUrl({ url: "app-settings:" }); return true; }, false);
}

/* ================= PARTAGE, PRESSE-PAPIERS ================= */
const blobVersBase64 = b => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => ko(r.error); r.readAsDataURL(b); });
async function fichierVersUri(f, i) {
  const nom = String((f && f.name) || `hmg-${i + 1}.png`).replace(/[^\w.-]+/g, "-");
  const { uri } = await Filesystem.writeFile({ path: "partage/" + nom, data: await blobVersBase64(f), directory: Directory.Cache, recursive: true });
  return uri;
}
async function partager(d) {
  d = d || {};
  const o = { dialogTitle: d.title || TEXTES.partager };
  if (d.title) o.title = String(d.title);
  if (d.text) o.text = String(d.text);
  if (d.url) o.url = String(d.url);
  if (d.files && d.files.length) o.files = await Promise.all(Array.from(d.files).map(fichierVersUri));
  try { await Share.share(o); }
  catch (e) { if (/cancel/i.test((e && e.message) || "")) throw new DOMException("Partage annulé", "AbortError"); throw e; }
}
const partagerImage = (blob, texte) => partager({ files: [new File([blob], "mon-heros-hmg.png", { type: blob.type || "image/png" })], text: texte, title: TEXTES.partagerHeros });
const copier = t => Clipboard.write({ string: String(t) });

/* ================= LIENS EXTERNES, ITINÉRAIRE ================= */
const estAMoi = u => { try { const x = new URL(u, location.href); return DOMAINES.includes(x.hostname) && /^\/(compte|invite|salle)(\/|$)/.test(x.pathname); } catch (e) { return false; } };
function destinationGoogle(u) {   // https://www.google.com/maps/dir/?api=1&destination=… (lien « Itinéraire » d'app.js)
  try { const x = new URL(u); if (!/(^|\.)google\.[a-z.]+$/.test(x.hostname) || !/^\/maps\/dir/.test(x.pathname)) return null; return x.searchParams.get("destination") || null; }
  catch (e) { return null; }
}
async function menu(o) {   // menu natif : renvoie l'indice choisi, ou -1
  o = o || {};
  const opts = (o.options || []).map(x => (typeof x === "string" ? { titre: x } : x));
  if (!N) { for (let i = 0; i < opts.length; i++) if (window.confirm(opts[i].titre + " ?")) return i; return -1; }
  const boutons = opts.map(x => ({ title: x.titre, style: x.danger ? ActionSheetButtonStyle.Destructive : ActionSheetButtonStyle.Default }));
  boutons.push({ title: o.annuler || TEXTES.annuler, style: ActionSheetButtonStyle.Cancel });
  const r = await tente("menu", () => ActionSheet.showActions({ title: o.titre, message: o.message, options: boutons }), { index: -1 });
  return r && r.index >= 0 && r.index < opts.length ? r.index : -1;
}
async function confirmer(o) {
  o = o || {};
  if (!N) return window.confirm([o.titre, o.message].filter(Boolean).join("\n\n"));
  const r = await tente("confirmation", () => Dialog.confirm({ title: o.titre || "HMG", message: o.message || "", okButtonTitle: o.ok || "OK", cancelButtonTitle: o.annuler || TEXTES.annuler }), { value: false });
  return !!(r && r.value);
}
async function peutOuvrir(url) { return !!(await tente("canOpenUrl", () => AppLauncher.canOpenUrl({ url }), { value: false })).value; }
async function itineraire(dest) {   // dest : {lat, lon, adresse, nom} ou une adresse
  const q = typeof dest === "string" ? { adresse: dest } : (dest || {});
  const cible = q.lat != null && q.lon != null ? `${q.lat},${q.lon}` : String(q.adresse || "").trim();
  if (!cible) return false;
  const e = encodeURIComponent(cible);
  if (!IOS) return tente("itinéraire", () => AppLauncher.openUrl({ url: "https://www.google.com/maps/dir/?api=1&destination=" + e }).then(() => true), false);
  // iPhone : Plans d'abord, puis Google Maps ou Waze s'ils sont installés (LSApplicationQueriesSchemes)
  const choix = [{ titre: "Plans", url: "https://maps.apple.com/?daddr=" + e + (q.nom ? "&q=" + encodeURIComponent(q.nom) : "") }];
  if (await peutOuvrir("comgooglemaps://")) choix.push({ titre: "Google Maps", url: "comgooglemaps://?daddr=" + e + "&directionsmode=driving" });
  if (await peutOuvrir("waze://")) choix.push({ titre: "Waze", url: q.lat != null ? `waze://?ll=${q.lat},${q.lon}&navigate=yes` : "waze://?q=" + e + "&navigate=yes" });
  let i = 0;
  if (choix.length > 1) { i = await menu({ titre: TEXTES.itineraire, options: choix.map(c => c.titre) }); if (i < 0) return false; }
  return tente("itinéraire", () => AppLauncher.openUrl({ url: choix[i].url }).then(() => true), false);
}
async function ouvrir(url) {
  const u = String(url || "");
  if (!u) return false;
  if (!N) { window.open(u, "_blank", "noopener"); return true; }
  if (estAMoi(u)) { route(u); return true; }
  const d = destinationGoogle(u); if (d) return itineraire(d);
  if (/^https?:/i.test(u)) return tente("navigateur intégré", () => Browser.open({ url: u, presentationStyle: "popover", toolbarColor: "#05070d" }).then(() => true), false);
  return tente("ouverture", () => AppLauncher.openUrl({ url: u }).then(() => true), false);   // mailto:, tel:, maps…
}

/* ================= STOCKAGE SÛR (trousseau iOS, Keystore Android) ================= */
let trousseauPret = null;
const trousseau = () => trousseauPret || (trousseauPret = SecureStorage.setKeyPrefix("hmg_").then(() => SecureStorage));
const stockage = {
  /* valeur (souvent une chaîne) ou null ; ne rejette jamais. Lit le trousseau de l'appareil ET le trousseau iCloud. */
  async get(cle) {
    if (!N) return lsJson("hmg-stockage:" + cle, null);
    return tente("trousseau (lecture)", async () => { const v = await (await trousseau()).get(String(cle), false, true); return v === undefined ? null : v; }, null);
  },
  /* opts.icloud (vrai par défaut) : synchronisé avec le trousseau iCloud (revient sur un nouvel iPhone).
     Pour un jeton de session propre à l'appareil, passer {icloud:false}. Renvoie true si c'est écrit. */
  async set(cle, valeur, opts) {
    const icloud = !(opts && opts.icloud === false);
    if (!N) { lsMettreJson("hmg-stockage:" + cle, valeur); return true; }
    return tente("trousseau (écriture)", async () => { const s = await trousseau(); if (!icloud) await s.remove(String(cle), true); await s.set(String(cle), valeur, false, icloud); return true; }, false);
  },
  async remove(cle) {
    if (!N) { lsDel("hmg-stockage:" + cle); return true; }
    return tente("trousseau (effacement)", async () => { await (await trousseau()).remove(String(cle), true); return true; }, false);
  },
};

/* ---------- recopie de localStorage : Preferences pour tout « hmg-… », trousseau pour l'identité */
const IDENTITE = ["hmg-voter", "hmg-visitor"];
const PRIVEES = /^hmg-(stockage:|notifs-hist|notifs-prevues|ouvertures)/;   // données internes de HMGN, pas recopiées
const aRecopier = k => typeof k === "string" && k.startsWith("hmg-") && !PRIVEES.test(k);
const identiteValide = (k, v) => !!v && v !== "null" && (k !== "hmg-voter" || /^"[0-9a-f]{32}"$/.test(v));
let restauration = true;                 // pendant la restauration du lancement, on ne recopie rien
const enAttente = new Map();
let minuteur = 0;
function sauverIdentite(k, v) { return identiteValide(k, v) ? stockage.set(k, v) : stockage.remove(k); }
function recopier(k, v) {
  if (!N || restauration || !aRecopier(k)) return;
  if (IDENTITE.includes(k)) sauverIdentite(k, v);   // tout de suite : « C'est moi » recharge la page 150 ms après
  enAttente.set(k, v); clearTimeout(minuteur); minuteur = setTimeout(viderRecopie, 60);
}
function viderRecopie() {
  clearTimeout(minuteur);
  const lot = [...enAttente]; enAttente.clear();
  for (const [k, v] of lot) (v === null ? Preferences.remove({ key: k }) : Preferences.set({ key: k, value: v })).catch(e => signaler("Preferences", e));
}
function installerRecopie() {
  if (!SP || !N) return;
  SP.setItem = function (k, v) { ORIG.set.call(this, k, v); if (this === LS) recopier(String(k), String(v)); };
  SP.removeItem = function (k) { ORIG.del.call(this, k); if (this === LS) recopier(String(k), null); };
  SP.clear = function () {
    const cles = this === LS ? Object.keys(LS).filter(aRecopier) : [];
    ORIG.clear.call(this); cles.forEach(k => recopier(k, null));
  };
  addEventListener("pagehide", viderRecopie);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") viderRecopie(); });
}
/* Au lancement : ce que localStorage a perdu revient du trousseau (identité) puis de Preferences (le reste).
   Règle simple : si localStorage a une valeur, c'est elle qui compte (elle est recopiée) ; sinon on restaure. */
async function restaurer() {
  const remis = [];
  for (const k of IDENTITE) {
    if (lsGet(k) !== null) continue;
    const v = await stockage.get(k);
    if (typeof v === "string" && identiteValide(k, v)) { lsSet(k, v); remis.push(k); }
  }
  const { keys } = await Preferences.keys();
  for (const k of keys) {
    if (!aRecopier(k) || lsGet(k) !== null) continue;
    const { value } = await Preferences.get({ key: k });
    if (value !== null) { lsSet(k, value); remis.push(k); }
  }
  // première ouverture avec cette version : on sauvegarde ce qui existe déjà
  const connues = new Set(keys);
  if (LS) for (const k of Object.keys(LS)) if (aRecopier(k) && !connues.has(k)) enAttente.set(k, lsGet(k));
  for (const k of IDENTITE) { const v = lsGet(k); if (identiteValide(k, v) && (await stockage.get(k)) !== v) await sauverIdentite(k, v); }
  viderRecopie();
  return remis;
}
async function effacerTout() {   // « Supprimer mon compte » : trousseau, Preferences, localStorage, notifications, fichiers partagés
  await notifs.annuler();
  if (N) {
    await tente("trousseau (vider)", async () => (await trousseau()).clear(true));
    await tente("Preferences (vider)", () => Preferences.clear());
    await tente("fichiers", () => Filesystem.rmdir({ path: "partage", directory: Directory.Cache, recursive: true }));
  }
  enAttente.clear();
  try { if (LS) ORIG.clear.call(LS); } catch (e) { /* rien */ }
  return true;
}

/* ================= NOTIFICATIONS LOCALES (1-jeu-vies §11, 3-ux-appli §4.10) =================
   HMGN.notifs.programmer(etat) efface les identifiants 1000 à 1099 et programme les 7 prochains jours d'après
   l'état renvoyé par my_state(). Règles : au plus 3 rappels automatiques par semaine plus le bilan (4 au total),
   jamais deux le même jour, jamais entre 21 h et 8 h (sauf la séance en cours, lancée par le joueur), jamais le jour
   d'une séance validée, le lendemain seulement si la semaine est serrée, rien pendant une pause, et après 3 rappels
   restés sans ouverture dans les 12 h, 14 jours avec le bilan seulement. */
const JOUR = 864e5, MIN = 6e4, NOTIF_ID0 = 1000, NOTIF_IDN = 1099;
const CLE_NOTIFS = "hmg-notif", CLE_HIST = "hmg-notifs-hist", CLE_PREVUES = "hmg-notifs-prevues", CLE_OUV = "hmg-ouvertures";
/* les interrupteurs de Réglages › Notifications (3-ux-appli §2.8, js/onglets.js) :
   danger = « Cœur en danger » (N3, N4) · bilan = « Bilan du lundi » (N5) · rappel = « Rappel de séance », coupé par défaut (N2, N6, N7)
   · seance = la séance en cours (N1, N1b, toujours permise sauf seance:false) · arrivee = « Arrivée à ma salle » : demande une zone
   géographique iOS, que le module de notifications locales ne sait pas faire (ignoré pour l'instant).
   Les anciens noms (rappels, et bilan seul pour les cœurs) sont aussi compris. */
const REGLAGES_DEFAUT = { seance: true, danger: true, arrivee: true, bilan: true, rappel: false };
const CALME_DEBUT = 21 * 60, CALME_FIN = 8 * 60;
const PRIORITE = { N5: 6, N4: 5, N6: 4, N3: 3, N7: 2, N2: 1 };
const minuit = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const aHeure = (d, m) => { const x = new Date(d); x.setHours(Math.floor(m / 60), m % 60, 0, 0); return x.getTime(); };
const lundiDe = t => { const d = minuit(t); return plusJours(d, -((d.getDay() + 6) % 7)); };
const deIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const joursEntre = (a, b) => Math.round((minuit(b) - minuit(a)) / JOUR);
const deHeure = (s, d) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || "")); return m ? Math.min(23 * 60 + 59, +m[1] * 60 + +m[2]) : d; };
const pl = (n, mot, plur) => n + " " + (n > 1 ? (plur || mot + "s") : mot);

function reglagesNotifs(etat, prefs) {
  const r = Object.assign({}, REGLAGES_DEFAUT, (etat && etat.notif_prefs) || {}, lsJson(CLE_NOTIFS, null) || {}, prefs || {});
  if (prefs && prefs.rappels !== undefined && prefs.rappel === undefined) r.rappel = !!prefs.rappels;
  return r;
}
/* l'état du jeu, ramené à ce dont les rappels ont besoin */
function lireEtat(e, maintenant) {
  e = e || {};
  const w = e.week || {}, ses = e.session && e.session.status === "ouverte" ? e.session : null;
  const goal = +e.goal || +w.g || 3, g = +w.g || goal;
  const v = +w.v || 0, c = +w.c || 0, sNow = w.s != null ? +w.s : v + Math.min(1, c);
  const today = e.today, statutJour = today && (typeof today === "string" ? today : today.status);
  const faiteAujourdhui = !!statutJour && statutJour !== "rejetee" && statutJour !== "ouverte";
  let dernier = deIso(e.last_day || e.derniere_seance || (e.last_session && e.last_session.day));
  for (const j of Array.isArray(w.days) ? w.days : []) {       // [{d:"AAAA-MM-JJ", st:"validee"|"courte"|…}]
    const d = j && /^(validee|courte)$/.test(j.st) ? deIso(j.d) : null;
    if (d && (!dernier || d > dernier)) dernier = d;
  }
  if (faiteAujourdhui && (!dernier || dernier < minuit(maintenant))) dernier = minuit(maintenant);
  return {
    hearts: e.hearts != null ? +e.hearts : 3, max: +e.hearts_max || 3, sick: !!e.sick || e.hearts === 0,
    streak: +e.streak || 0, gels: +e.gels || 0, steps: +e.steps || 0, weeksOk: +e.weeks_ok || 0,
    soft: !!e.soft_mode, goal, goalNext: +e.goal_next || goal,
    semaine: { debut: deIso(w.start) || lundiDe(maintenant), g, safe: +w.safe || Math.ceil(g / 2), s: sNow,
      // une séance ouverte comptera au moins comme « courte » (1 par semaine) : on prévoit avec elle
      sPrevu: ses ? Math.max(sNow, v + Math.min(1, c + 1)) : sNow, kind: w.kind || "normale" },
    session: ses, faiteAujourdhui, dernier,
    pause: e.pause || null, heure: deHeure(e.usual_hour, 18 * 60),
    coffreSemaine: Array.isArray(e.quests) && e.quests.length >= 3 && e.quests.every(q => q && q.done),
    bilanNonVu: e.unseen_bilan || null, coffres: Array.isArray(e.chests) ? e.chests : [], pseudo: e.pseudo || "",
  };
}
const enPause = (st, lundi) => {
  const p = st.pause; if (!p) return false;
  const deb = deIso(p.start_week), fin = deIso(p.end_week);
  if (deb && lundi < deb) return false;
  return !fin || lundi <= fin;
};
/* le résultat probable du bilan (même formule que le serveur, 1-jeu-vies §5.3), avec les textes de §11.4.
   x : {S, G (séances et objectif de la semaine, si connus), serie (après le bilan), coeurs (après), coffre, objectif} */
function texteBilan(r, x) {
  const sg = x.S != null && x.G ? `${x.S}/${x.G}` : "";
  switch (r) {
    case "atteint": return [`Semaine validée${sg ? " : " + sg : ""} 🔥`, `Ta série passe à ${pl(Math.max(1, x.serie), "semaine")}. Ton héros gagne un cœur${x.coffre ? " et un coffre t'attend" : ""}.`];
    case "plein": return [sg ? `${sg}, cœurs au max !` : "Cœurs au max !", "+10 ⭐ en bonus. Le repos de ce week-end était mérité."];
    case "reprise": return ["Le retour du héros 🏆", "Quel retour ! Objectif complet dès la semaine prochaine ?"];
    case "gel": return ["Ton gel a protégé ta série ❄️", `${pl(Math.max(1, x.serie), "semaine")} de série, intactes. On la fait grandir cette semaine ?`];
    case "sauve": return ["Cœur sauvé ❤️", `${sg ? `${pl(x.S, "séance")} sur ${x.G} : ton` : "Ton"} cœur tient bon. Cette semaine, on vise ${x.objectif} ?`];
    case "rate": return ["Nouvelle semaine, nouveau départ", `Ton héros garde ${pl(Math.max(1, x.coeurs), "cœur")}. Une séance cette semaine et il repart de plus belle.`];
    case "rhume": return ["Ton héros a attrapé un rhume 🤧", "Rien n'est perdu : ses objets, ses mondes et ses muscles l'attendent. 2 séances et il est sur pied."];
    case "malade": return ["Ton héros t'attend 🤧", "Ses objets, ses mondes et ses muscles sont intacts. 2 séances et il est sur pied."];
    case "doux_ok": return [`Semaine validée${sg ? " : " + sg : ""} 🔥`, "Ton héros avance avec toi. On remet ça cette semaine ?"];
    default: return ["Nouvelle semaine, nouveau départ", "Une séance cette semaine et ton héros repart de plus belle."];
  }
}
function resultatBilan(st, w) {
  if (st.soft) return w.s >= w.g ? "doux_ok" : "doux";
  if (st.hearts <= 0) return "malade";
  if (w.s >= w.g) return w.kind === "reprise" ? "reprise" : st.hearts >= st.max ? "plein" : "atteint";
  if (w.s >= w.safe) return st.streak >= 2 && st.gels > 0 ? "gel" : "sauve";
  return w.kind === "normale" && st.hearts <= 1 ? "rhume" : "rate";
}
function bilanPrevu(st, w) {
  const r = resultatBilan(st, w);
  return [r, texteBilan(r, { S: w.s, G: w.g, objectif: st.goalNext, coffre: st.coffreSemaine,
    serie: r === "atteint" || r === "plein" || r === "reprise" ? st.streak + 1 : st.streak,
    coeurs: r === "rate" ? st.hearts - (w.kind === "normale" ? 1 : 0) : st.hearts })];
}
function bilanDuServeur(b, st) {   // le bilan déjà calculé (unseen_bilan) : on connaît le vrai résultat
  let r = { atteint: "atteint", sauve: "sauve", rate: "rate", malade: "malade", doux_ok: "doux_ok", doux: "doux" }[b.outcome];
  if (!r) return null;                                     // pause, hibernation : rien à annoncer
  if (r === "atteint" && b.hearts_before >= st.max) r = "plein";
  if (r === "sauve" && b.gel_used) r = "gel";
  if (r === "rate" && (b.hearts_after === 0 || b.fell_sick)) r = "rhume";
  if (r === "atteint" && b.kind === "reprise") r = "reprise";
  return [r, texteBilan(r, { S: b.s != null ? +b.s : null, G: b.g != null ? +b.g : null, objectif: st.goalNext, serie: b.streak_after != null ? +b.streak_after : st.streak,
    coeurs: b.hearts_after != null ? +b.hearts_after : st.hearts, coffre: (st.coffres || []).some(c => c && c.kind === "semaine") })];
}

/* Calcule (sans rien programmer) les notifications des 7 prochains jours. Fonction pure, testable.
   etat : la réponse de my_state() (1-jeu-vies §14.10), plus, si le serveur les donne : last_day (jour de la
   dernière séance comptée, « AAAA-MM-JJ »), weeks_ok, pseudo, notif_prefs.
   opts : {maintenant (Date ou ms), pseudo, reglages, hist (rappels déjà partis), ouvertures (ms)}. */
function planifier(etat, opts) {
  opts = opts || {};
  const now = +(opts.maintenant || Date.now()), fin = now + 7 * JOUR;
  const st = lireEtat(etat, now), regl = reglagesNotifs(etat, opts.reglages);
  const pseudo = String(opts.pseudo || st.pseudo || "").trim();
  const H = st.heure, cand = [];
  const ajouter = (type, quand, titre, texte, route, auto, extra) => {
    if (quand > now + MIN && quand <= fin) cand.push(Object.assign({ type, quand, titre, texte, route, auto }, extra || {}));
  };
  // N1, N1b : la séance en cours (lancée par le joueur : pas d'heures calmes, pas de plafond)
  if (regl.seance !== false && st.session && st.session.started_at) {
    const t0 = Date.parse(st.session.started_at), tFin = Date.parse(st.session.confirm_until || "") || t0 + 180 * MIN;
    if (t0) {
      ajouter("N1", t0 + 45 * MIN, "Séance en cours 💪", "Fini ? Valide ta séance avant de quitter la salle : ton héros attend son pas.", "aventure", false);
      ajouter("N1b", tFin - 30 * MIN, "Encore 30 min pour valider", "Depuis la salle, un appui suffit. Sinon, ta séance comptera quand même pour ton objectif.", "aventure", false);
    }
  }
  const lundi0 = lundiDe(now), sem = [];
  const sem0 = Object.assign({}, st.semaine, { s: st.semaine.sPrevu, debut: lundi0 });
  sem.push(sem0);
  const r0 = resultatBilan(st, sem0);   // pour prévoir les cœurs de la semaine suivante
  const coeurs1 = st.soft ? st.hearts : r0 === "atteint" ? Math.min(st.max, st.hearts + 1) : r0 === "rate" || r0 === "rhume" ? Math.max(0, st.hearts - (sem0.kind === "normale" ? 1 : 0)) : st.hearts;
  sem.push({ debut: plusJours(lundi0, 7), g: st.goalNext, safe: Math.ceil(st.goalNext / 2), s: 0, kind: "normale", coeurs: coeurs1 });
  sem0.coeurs = st.hearts;
  const inactif = l => (st.dernier ? joursEntre(st.dernier, l) : 0);     // jours sans séance comptée
  const creneau = (jour, w) => {                                        // H − 90 min, entre 8 h et 20 h 30 ; si H < 10 h : la veille à 20 h
    if (H < 10 * 60) return { quand: aHeure(plusJours(jour, -1), 20 * 60), veille: true };
    return { quand: aHeure(jour, Math.min(20 * 60 + 30, Math.max(8 * 60, H - 90))), veille: false };
  };
  for (const w of sem) {
    const l = w.debut, enP = enPause(st, l);
    const restants = j => 7 - j;                                        // jours restants, le jour j compris (0 = lundi)
    // N5 : le bilan de cette semaine, le lundi suivant à 9 h (prévu avec la même formule que le serveur)
    if (regl.bilan && w === sem0 && !enP) {
      const lsuiv = plusJours(l, 7), d = inactif(lsuiv);
      const [r, [t, x]] = bilanPrevu(st, w);
      if (!(st.dernier && d >= 98) && !(r === "malade" && st.dernier && d >= 49)) ajouter("N5", aHeure(lsuiv, 9 * 60), t, x, "bilan", false, { bilan: r });
    }
    if (enP) continue;                                                  // pendant une pause : rien d'autre
    const d0 = inactif(l);
    const absent = st.dernier && d0 >= 14;
    if (!absent) {
      // N2 : mercredi, aucune séance dans la semaine
      if (regl.rappel && w.s === 0) {
        const c = creneau(plusJours(l, 2), w);
        if (c.veille) ajouter("N2", c.quand, "Demain matin, on y va ?", "Une séance demain et ta semaine est lancée. Ton héros a déjà ses baskets aux pieds.", "aventure", true);
        else ajouter("N2", c.quand, "Ta semaine t'attend 🔥", `${pseudo ? pseudo + ", une" : "Une"} séance aujourd'hui et ta semaine est lancée. Ton héros a déjà ses baskets aux pieds.`, "aventure", true);
      }
      // N3 : le premier jour où la semaine se resserre (encore jouable : 1 séance par jour au plus)
      if (regl.danger) {
        const M = w.g - w.s;
        for (let j = 0; j < 7 && M >= 1; j++) {
          const R = restants(j);
          if (M >= R - 1 && M <= R) {
            const c = creneau(plusJours(l, j), w);
            if (c.quand > now + MIN) {
              const fait = st.weeksOk > 0 ? `, et tu l'as déjà fait ${st.weeksOk} fois` : "";
              ajouter("N3", c.quand, `Encore ${pl(M, "séance")} pour ton objectif`, `Il reste ${pl(R, "jour")} : c'est jouable${fait}.`, "aventure", true, { serree: true });
            }
            break;
          }
        }
      }
      // N4 : samedi 10 h, cœur en danger mais encore sauvable (jamais si c'est hors de portée)
      const manque = w.safe - w.s;
      if (regl.danger && !st.soft && w.kind === "normale" && w.coeurs > 0 && manque >= 1 && manque <= 2) {
        if (manque === 1) ajouter("N4", aHeure(plusJours(l, 5), 10 * 60), "Ton cœur compte sur toi ❤️", "Une séance ce week-end suffit à le garder. Ton héros tient la porte de la salle ouverte.", "aventure", true);
        else ajouter("N4", aHeure(plusJours(l, 5), 10 * 60), "2 séances ce week-end", "Et ton cœur est sauvé. Samedi + dimanche, ça te ressemble.", "aventure", true);
      }
    }
    // N7 : le retour, le lundi à 18 h (4 semaines de suite, puis 2 fois à un mois d'écart, puis plus rien)
    if (regl.rappel && st.dernier) {
      const d = d0;
      let tx = null;
      if (d >= 14 && d < 28) tx = [`Ça fait ${Math.floor(d / 7)} semaines${pseudo ? ", " + pseudo : ""}`, "Pas de pression. Une séance, et ton héros reprend des couleurs."];
      else if ((d >= 28 && d < 42) || (d >= 63 && d < 70)) tx = ["Ton héros t'a gardé ta place 🏁", `${st.steps > 0 ? `Tes ${st.steps} séances sont toujours là.` : "Tout ce que tu as gagné est toujours là."} On reprend doucement : 1 séance cette semaine ?`];
      else if (d >= 91 && d < 98) tx = ["On garde tout au chaud", "Le jour où tu reviens, ton héros sera là. Tu peux aussi le mettre en hibernation."];
      if (tx) ajouter("N7", aHeure(l, 18 * 60), tx[0], tx[1], "aventure", true);
    }
  }
  // N6 : la veille de la reprise après une pause (dimanche 18 h)
  if (regl.rappel && st.pause && st.pause.kind !== "hibernation" && deIso(st.pause.end_week)) {
    const fin = deIso(st.pause.end_week), deb = deIso(st.pause.start_week);
    const longue = deb ? joursEntre(deb, fin) / 7 + 1 >= 2 : +st.pause.weeks >= 2;
    ajouter("N6", aHeure(plusJours(fin, 6), 18 * 60), "On reprend demain ?",
      longue ? `Cette semaine compte à moitié : objectif ${Math.ceil(st.goal / 2)}, aucun cœur en jeu.` : "Ton héros est reposé et prêt à repartir.", "aventure", true);
  }
  // le bilan déjà calculé mais pas encore vu : ce lundi à 9 h, avec le vrai résultat
  if (regl.bilan && st.bilanNonVu) {
    const b = bilanDuServeur(st.bilanNonVu, st), lb = plusJours(deIso(st.bilanNonVu.week) || plusJours(lundi0, -7), 7);
    if (b) ajouter("N5", aHeure(lb, 9 * 60), b[1][0], b[1][1], "bilan", false, { bilan: b[0] });
  }

  /* ---- les règles de plafond */
  const hist = (opts.hist || lsJson(CLE_HIST, [])).filter(h => h && h.at <= now);
  const ouv = opts.ouvertures || lsJson(CLE_OUV, []);
  const autosPasses = hist.filter(h => h.auto).sort((a, b) => a.at - b.at);
  const trois = autosPasses.slice(-3);
  const fatigue = trois.length === 3 && trois.every(h => !ouv.some(t => t >= h.at && t <= h.at + 12 * 3600e3)) && now < trois[2].at + 14 * JOUR;
  const jourDe = t => minuit(t).getTime();
  const calme = t => { const d = new Date(t), m = d.getHours() * 60 + d.getMinutes(); return m >= CALME_DEBUT || m < CALME_FIN; };
  const jourSeance = st.faiteAujourdhui ? jourDe(now) : null;
  const lendemain = st.dernier ? jourDe(plusJours(st.dernier, 1)) : null;
  let liste = cand.filter(n => {
    if (!n.auto && n.type !== "N5") return true;                        // N1, N1b
    if (calme(n.quand)) return false;
    if (n.auto && fatigue) return false;
    const j = jourDe(n.quand);
    if (jourSeance !== null && j === jourSeance) return false;          // jamais le jour d'une séance validée
    if (n.auto && lendemain !== null && j === lendemain && !n.serree && st.dernier && joursEntre(st.dernier, now) <= 1) return false;
    return true;
  });
  // un seul rappel par jour (le plus important) ; le lundi d'un retour (N7), il remplace le bilan
  const parJour = new Map();
  for (const n of liste.filter(n => n.auto || n.type === "N5")) {
    const j = jourDe(n.quand), a = parJour.get(j);
    const p = x => (x.type === "N7" ? 7 : PRIORITE[x.type] || 0);
    if (!a || p(n) > p(a)) parJour.set(j, n);
  }
  const garder = new Set(parJour.values());
  liste = liste.filter(n => (!n.auto && n.type !== "N5") || garder.has(n));
  // au plus 3 rappels automatiques par semaine (ceux déjà partis comptent), le bilan en plus
  const parSemaine = new Map();
  for (const h of autosPasses) { const k = lundiDe(h.at).getTime(); parSemaine.set(k, (parSemaine.get(k) || 0) + 1); }
  const autos = liste.filter(n => n.auto).sort((a, b) => (PRIORITE[b.type] || 0) - (PRIORITE[a.type] || 0) || a.quand - b.quand);
  const refuses = new Set();
  for (const n of autos) { const k = lundiDe(n.quand).getTime(), c = parSemaine.get(k) || 0; if (c >= 3) refuses.add(n); else parSemaine.set(k, c + 1); }
  liste = liste.filter(n => !refuses.has(n)).sort((a, b) => a.quand - b.quand);
  // identifiants : 1000 = séance en cours, 1001 = dernier appel, puis 1002…
  let id = NOTIF_ID0 + 2;
  return liste.map(n => Object.assign(n, { id: n.type === "N1" ? NOTIF_ID0 : n.type === "N1b" ? NOTIF_ID0 + 1 : id++ })).filter(n => n.id <= NOTIF_IDN);
}
function noterOuverture() {
  const l = lsJson(CLE_OUV, []).filter(t => t > Date.now() - 30 * JOUR);
  l.push(Date.now()); lsMettreJson(CLE_OUV, l.slice(-60));
}
const notifs = {
  reglages: () => reglagesNotifs(null),   // {seance, danger, arrivee, bilan, rappel}
  regler(modif) { const r = Object.assign(reglagesNotifs(null), modif || {}); localStorage.setItem(CLE_NOTIFS, JSON.stringify(r)); return r; },
  async autorisation() {   // "granted", "denied" ou "prompt"
    if (!N) return typeof Notification !== "undefined" ? (Notification.permission === "default" ? "prompt" : Notification.permission) : "denied";
    const r = await tente("notifications (état)", () => LocalNotifications.checkPermissions(), { display: "denied" });
    return /^prompt/.test(r.display) ? "prompt" : r.display;
  },
  async demander() {       // à appeler juste après la 1re séance validée, après l'écran d'explication
    if (!N) return false;
    const r = await tente("notifications (demande)", () => LocalNotifications.requestPermissions(), { display: "denied" });
    return r.display === "granted";
  },
  planifier,
  autoriser: () => notifs.demander(),     // nom utilisé par js/accueil.js
  annulerTout: () => notifs.annuler(),    // nom utilisé par js/onglets.js
  async annuler() {
    if (!N) return;
    const ids = []; for (let i = NOTIF_ID0; i <= NOTIF_IDN; i++) ids.push({ id: i });
    await tente("notifications (annuler)", () => LocalNotifications.cancel({ notifications: ids }));
    lsMettreJson(CLE_PREVUES, []);
  },
  /* efface puis programme les 7 prochains jours ; renvoie la liste programmée ([] sans autorisation).
     prefs : les interrupteurs de Réglages ({danger, bilan, rappel, …}), sinon ceux enregistrés (hmg-notif). */
  async programmer(etat, prefs, opts) {
    const now = Date.now();
    // ce qui était programmé et dont l'heure est passée est parti : on le garde pour les plafonds et la fatigue
    const hist = lsJson(CLE_HIST, []).filter(h => h.at > now - 30 * JOUR);
    for (const p of lsJson(CLE_PREVUES, [])) if (p.at <= now && !hist.some(h => h.id === p.id && h.at === p.at)) hist.push(p);
    lsMettreJson(CLE_HIST, hist.slice(-80));
    const liste = planifier(etat, Object.assign({ maintenant: now, hist, reglages: prefs }, opts || {}));
    if (!N) return liste;
    await notifs.annuler();
    if ((await notifs.autorisation()) !== "granted" || !liste.length) return [];
    const ok = await tente("notifications (programmer)", () => LocalNotifications.schedule({ notifications: liste.map(n => ({
      id: n.id, title: n.titre, body: n.texte, schedule: { at: new Date(n.quand), allowWhileIdle: true },
      extra: { route: n.route, type: n.type }, threadIdentifier: "hmg", group: "hmg", autoCancel: true,
    })) }).then(() => true), false);
    if (!ok) return [];
    lsMettreJson(CLE_PREVUES, liste.map(n => ({ id: n.id, type: n.type, at: n.quand, auto: n.auto })));
    return liste;
  },
  async prevues() {
    if (!N) return [];
    const r = await tente("notifications (liste)", () => LocalNotifications.getPending(), { notifications: [] });
    return (r.notifications || []).filter(n => n.id >= NOTIF_ID0 && n.id <= NOTIF_IDN);
  },
};

/* ================= LIENS UNIVERSELS, SCHÉMA hmgfitness://, NOTIFICATIONS : ROUTAGE ================= */
function analyser(url) {
  const s = String(url || "").trim();
  if (!s) return null;
  let u;
  try {
    if (/^hmgfitness:/i.test(s)) u = new URL(s.replace(/^hmgfitness:\/*/i, "https://appli.hmg/"));
    else if (/^[a-z][a-z0-9+.-]*:/i.test(s)) u = new URL(s);
    else u = new URL("/" + s.replace(/^\/+/, ""), "https://appli.hmg");
  } catch (e) { return null; }
  if (!["appli.hmg", "localhost", location.hostname].concat(DOMAINES).includes(u.hostname)) return null;
  const morceaux = u.pathname.split("/").filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  const h = u.hash.replace(/^#/, ""), q = u.searchParams, base = { url: s };
  const code = (h.match(/(?:^|&)(?:c|compte)=([A-Za-z0-9_-]+)/) || q.get("compte") && [0, q.get("compte")] || [])[1];
  if ((morceaux[0] === "compte" || /^compte=/.test(h) || q.get("compte")) && code) return Object.assign(base, { chemin: "compte", code });
  if (morceaux[0] === "invite") return Object.assign(base, { chemin: "invite", code: q.get("c") || morceaux[1] || "" });
  if (morceaux[0] === "salle" || q.get("salle")) return Object.assign(base, { chemin: "salle", id: q.get("id") || morceaux[1] || q.get("salle") || "" });
  if (morceaux[0]) return Object.assign(base, { chemin: morceaux[0], suite: morceaux.slice(1), params: Object.fromEntries(q) });
  const vue = q.get("vue");
  if (vue) return Object.assign(base, { chemin: vue });
  if (h) return Object.assign(base, { chemin: "salle", id: h });   // ancien lien #id-de-salle
  return Object.assign(base, { chemin: "accueil" });
}
let appliPrete = false;
const fileRoutes = [];
let dernierLien = { url: "", t: 0 };
function route(url) {
  const r = typeof url === "object" && url ? url : analyser(url);
  if (!r) return false;
  if (!r.vu) {                                                         // le même lien reçu deux fois au lancement
    if (r.url && r.url === dernierLien.url && Date.now() - dernierLien.t < 3000) return true;
    dernierLien = { url: r.url || "", t: Date.now() }; r.vu = true;
  }
  if (!appliPrete) { fileRoutes.push(r); return true; }
  if (envoyer("hmg:route", r, true).defaultPrevented) return true;
  const g = nom => globale(nom);
  const montrerCarte = () => { const GM = g("GM"), gmSet = g("gmSet"); if (GM && GM.on && gmSet) gmSet(false); };
  switch (r.chemin) {
    case "compte": {
      history.replaceState(null, "", location.pathname + location.search + "#compte=" + r.code);
      const f = g("acctFromHash"); if (f) f();
      return true;
    }
    case "invite": {
      if (r.code) localStorage.setItem("hmg-parrain", JSON.stringify(String(r.code).slice(0, 40)));
      const t = g("toast"); if (t) t("Ton invitation est bien notée. Bienvenue dans l'aventure HMG 💪");
      return true;
    }
    case "salle": {
      const byId = g("byId"), openClub = g("openClub");
      if (byId && byId[r.id] && openClub) { montrerCarte(); openClub(r.id, true); }
      return true;
    }
    case "carte": montrerCarte(); return true;
    case "aventure": case "bilan": case "seance": { const gmSet = g("gmSet"); if (gmSet) gmSet(true); return true; }
    default: return true;
  }
}
/* avant le chargement d'app.js : ce qu'app.js sait déjà lire au démarrage passe par l'adresse */
function routeAvantChargement(url) {
  const r = analyser(url);
  if (!r) return;
  dernierLien = { url: r.url, t: Date.now() }; r.vu = true;
  const mettre = h => history.replaceState(null, "", location.pathname + location.search + h);
  if (r.chemin === "compte") mettre("#compte=" + r.code);
  else if (r.chemin === "salle" && r.id) { localStorage.setItem("hmg-mode", JSON.stringify("map")); mettre("#" + encodeURIComponent(r.id)); }
  else if (r.chemin === "aventure" || r.chemin === "carte") mettre("#" + r.chemin);
  else fileRoutes.push(r);
}

/* ================= REMPLACEMENT DES API WEB (dans l'appli seulement) ================= */
function definir(obj, nom, valeur) { try { Object.defineProperty(obj, nom, { value: valeur, configurable: true, writable: true }); } catch (e) { signaler("remplacement de " + nom, e); } }
function remplacerApiWeb() {
  definir(nav, "vibrate", m => { const t = motifVersType(m); if (t) vibrer(t); return true; });
  definir(nav, "share", d => partager(d));
  definir(nav, "canShare", d => !!d && !!(d.url || d.text || d.title || (d.files && d.files.length && Array.from(d.files).every(f => /^image\//.test(f.type || "image/png")))));
  const presse = nav.clipboard || {};
  definir(presse, "writeText", t => copier(t));
  if (!nav.clipboard) definir(nav, "clipboard", presse);
  definir(nav, "geolocation", geoNatif);
  const ouvrirWeb = window.open;
  definir(window, "open", function (url, cible, options) {
    const u = String(url || "");
    if (/^(https?|mailto|tel|sms):/i.test(u) && !u.startsWith(location.origin)) { ouvrir(u); return null; }
    return ouvrirWeb.call(window, url, cible, options);
  });
  // liens <a href="https://…"> : navigateur intégré (fiche d'une salle, mentions), Plans pour l'itinéraire
  document.addEventListener("click", e => {
    if (e.defaultPrevented || e.button > 0) return;
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a || a.hasAttribute("download")) return;
    const href = a.href || "";
    if (!/^(https?|mailto|tel|sms):/i.test(href) || href.startsWith(location.origin + "/")) return;   // lien interne à l'appli
    e.preventDefault(); ouvrir(href);
  }, true);
  // boutons « Ouvrir les réglages » : n'importe quel élément [data-hmgn-reglages]
  document.addEventListener("click", e => { const b = e.target && e.target.closest && e.target.closest("[data-hmgn-reglages]"); if (b) { e.preventDefault(); reglages(); } }, true);
}

/* ================= DÉMARRAGE ================= */
let splashCache = false;
function pret() {
  if (splashCache || !N) { splashCache = true; return Promise.resolve(); }
  splashCache = true;
  return SplashScreen.hide({ fadeOutDuration: 250 }).catch(e => signaler("écran de démarrage", e));
}
const domPret = () => (document.readyState === "loading" ? new Promise(ok => document.addEventListener("DOMContentLoaded", ok, { once: true })) : Promise.resolve());
/* les scripts de la page, mis en attente par build-www.js (type="text/hmg-differe"), chargés un par un, dans l'ordre */
async function chargerScripts() {
  for (const x of Array.from(document.querySelectorAll('script[type="text/hmg-differe"]'))) {
    const s = document.createElement("script");
    for (const at of Array.from(x.attributes)) if (at.name !== "type" && at.name !== "data-src") s.setAttribute(at.name, at.value);
    const src = x.getAttribute("data-src");
    if (src) {
      await new Promise(ok => { s.onload = ok; s.onerror = () => { console.error("[HMGN] script introuvable : " + src); ok(); }; s.async = false; s.src = src; x.replaceWith(s); });
    } else { s.textContent = x.textContent; x.replaceWith(s); }
  }
}
function ecouteurs() {
  let quitte = 0;
  App.addListener("appUrlOpen", e => route(e && e.url));
  App.addListener("appStateChange", e => {
    const actif = !!(e && e.isActive);
    envoyer("hmg:etat-appli", { actif });
    if (!actif) { quitte = Date.now(); viderRecopie(); return; }
    noterOuverture();
    if (quitte && Date.now() - quitte > 30 * MIN) envoyer("hmg:retour", { absence: Date.now() - quitte });
    quitte = 0;
  });
  App.addListener("backButton", () => {
    if (envoyer("hmg:retour-arriere", {}, true).defaultPrevented) return;
    const m = Array.from(document.querySelectorAll(".modal")).pop();
    if (m) { const x = m.querySelector("[data-x],[data-acct-x],.x"); if (x) x.click(); else m.remove(); return; }
    App.minimizeApp().catch(() => {});
  });
  LocalNotifications.addListener("localNotificationActionPerformed", a => {
    const n = (a && a.notification) || {};
    noterOuverture();
    route((n.extra && n.extra.route) || "aventure");
  });
  Network.addListener("networkStatusChange", s => envoyer("hmg:reseau", s));
  const racine = document.documentElement;
  Keyboard.addListener("keyboardWillShow", i => { const h = Math.round((i && i.keyboardHeight) || 0); racine.style.setProperty("--clavier", h + "px"); racine.classList.add("clavier"); envoyer("hmg:clavier", { ouvert: true, hauteur: h }); });
  Keyboard.addListener("keyboardWillHide", () => { racine.style.setProperty("--clavier", "0px"); racine.classList.remove("clavier"); envoyer("hmg:clavier", { ouvert: false, hauteur: 0 }); });
  // toucher ailleurs ferme le clavier (3-ux-appli §5.9)
  document.addEventListener("pointerdown", e => {
    const a = document.activeElement, t = e.target;
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || !t || !t.closest) return;
    if (t.closest("input,textarea,select,label,button,[contenteditable],[data-garder-clavier]")) return;
    a.blur();
  }, { passive: true, capture: true });
}
async function demarrer() {
  const racine = document.documentElement;
  racine.classList.add("appli", "plateforme-" + PLATEFORME);
  if (N) {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});   // texte clair sur le fond sombre
    noterOuverture();
    ecouteurs();
    const restaure = await Promise.race([restaurer().catch(e => { signaler("restauration", e); return []; }), pause(1500).then(() => "délai")]);
    restauration = false;
    if (Array.isArray(restaure) && restaure.length) HMGN.restaure = restaure;
    const lancement = await Promise.race([tente("lien de lancement", () => App.getLaunchUrl(), null), pause(800).then(() => null)]);
    if (lancement && lancement.url) routeAvantChargement(lancement.url);
  } else restauration = false;
  await domPret();
  await chargerScripts();
  appliPrete = true;
  envoyer("hmg:pret", {});
  // l'écran de démarrage se retire quand la première image de l'appli est dessinée
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(pret, 60)));
  while (fileRoutes.length) route(fileRoutes.shift());
}

/* ================= L'API window.HMGN =================
   Sur le site, ce fichier n'est pas chargé : window.HMGN n'existe pas (tester « window.HMGN && … »). */
const HMGN = {
  version: 1,
  natif: N,                 // vrai dans l'appli iPhone / Android
  plateforme: PLATEFORME,   // "ios" | "android" | "web"
  textes: TEXTES,
  // vibrations : "choix" (= "selection"), "leger" (= "tap"), "moyen", "fort", "succes", "alerte", "erreur", "double", "montee"
  vibrer,
  tap: () => vibrer("leger"), succes: () => vibrer("succes"), alerte: () => vibrer("alerte"),
  vibrations: { actives: vibrationsActives, regler: on => { localStorage.setItem(CLE_VIB, JSON.stringify(!!on)); return !!on; } },
  // position(opts) : Promise<{coords:{latitude, longitude, accuracy…}, timestamp}> ; en cas d'échec, rejet avec
  // {code: 1 refus | 2 introuvable ou coupée | 3 délai, raison: "refus"|"desactivee"|"introuvable"|"delai", texte}
  // position.etat() : Promise<"granted"|"prompt"|"denied"|"desactivee">
  position,
  positionImprecise: acc => !(acc <= IMPRECIS_M),
  reglages,                 // ouvre la page de HMG dans Réglages (iPhone) ; Promise<boolean>
  peutOuvrirReglages: IOS,
  partager,                 // comme navigator.share({title, text, url, files})
  partagerImage,            // (blob, texte) : la story du héros
  copier,                   // (texte) → Promise
  ouvrir,                   // (url) : navigateur intégré, ou Plans / Mail / Téléphone selon le lien
  itineraire,               // ({lat, lon, adresse, nom}) : Plans, ou Google Maps / Waze s'ils sont installés
  menu,                     // ({titre, message, options: ["…" | {titre, danger}], annuler}) → Promise<indice | -1>
  confirmer,                // ({titre, message, ok, annuler}) → Promise<boolean>
  stockage,                 // get(cle) / set(cle, valeur, {icloud}) / remove(cle) : trousseau, survit à la réinstallation
  persist: (k, v) => recopier(String(k), v == null ? null : String(v)),   // recopie manuelle dans Preferences (inutile pour localStorage)
  effacerTout,              // « Supprimer mon compte » : efface tout ce que l'appli garde sur l'appareil
  notifs,                   // autorisation(), autoriser() (= demander()), programmer(etat, prefs), planifier(etat, opts), annulerTout() (= annuler()), prevues(), reglages(), regler({…})
  route,                    // (url | chemin) : « compte », « invite », « salle », « aventure », « carte », « bilan »…
  analyser,                 // (url) → {chemin, …} sans rien faire
  pret,                     // retire l'écran de démarrage (déjà fait tout seul au chargement)
  reseau: () => (N ? Network.getStatus() : Promise.resolve({ connected: nav.onLine, connectionType: "unknown" })),
  infos: () => (N ? App.getInfo() : Promise.resolve({ name: "HMG Fitness", id: "fr.hmgfitness.app", version: "web", build: "web" })),
  clavier: { cacher: () => (N ? Keyboard.hide() : Promise.resolve()) },
  restaure: [],             // clés remises au lancement (après un nettoyage d'iOS ou une réinstallation)
};
window.HMGN = HMGN;
if (N) { installerRecopie(); remplacerApiWeb(); }
demarrer().catch(e => { console.error("[HMGN] démarrage", e); appliPrete = true; pret(); });
