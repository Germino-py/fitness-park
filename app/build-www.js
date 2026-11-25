// Construit l'appli EMBARQUÉE (app/www) à partir des sources du site : l'appli contient tout son code,
// le réseau ne sert qu'aux données (Supabase, tuiles de la carte, recherche d'adresse). Règles 4.2 et 2.5.2 d'Apple.
// Lancement : « npm run www » (dans app/), avant « cap sync ». Échoue (code 1) si quelque chose cloche.
//
// 1. Copie index.html, css/, js/ (sauf la source js/native.js), fonts/ et icons/ dans app/www/,
//    plus les images du site appelées par la page ou le code.
// 2. Construit js/native.js (pont natif HMGN) en www/js/native.bundle.js avec esbuild (format iife).
// 3. Dans www/index.html SEULEMENT : <script>window.HMG_CIBLE="appli"</script> puis le pont natif avant tout autre script ;
//    les autres scripts de la page attendent que le pont ait remis l'état du joueur (type="text/hmg-differe") ;
//    plus de manifeste, d'icône d'écran d'accueil, de Google Fonts ni de porte d'invitation.
//    (Le service worker n'est jamais enregistré dans l'appli : js/app.js le saute quand HMG_CIBLE vaut "appli".)
// 4. Vérifie : pas de bloc « server » dans capacitor.config.json, aucune adresse http:// ni Google Fonts dans www/,
//    tous les fichiers appelés par la page existent.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const RACINE = path.join(__dirname, ".."), WWW = path.join(__dirname, "www");
const echec = m => { console.error("✗ build-www : " + m); process.exit(1); };
const rel = f => path.relative(WWW, f).split(path.sep).join("/");

// 0) garde-fou : l'appli ne doit jamais charger le site en direct
const conf = JSON.parse(fs.readFileSync(path.join(__dirname, "capacitor.config.json"), "utf8"));
if (conf.server) echec("capacitor.config.json contient un bloc « server » : interdit (Apple refuse une appli qui charge un site ; le code doit être embarqué).");
if (conf.webDir !== "www") echec(`webDir doit valoir "www" (trouvé : ${conf.webDir}).`);

// 1) copie des sources du site
fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
const SOURCE_NATIVE = path.join(RACINE, "js", "native.js");
for (const f of ["index.html", "css", "js", "fonts", "icons"]) {
  const src = path.join(RACINE, f);
  if (!fs.existsSync(src)) echec(`il manque ${f} à la racine du dépôt.`);
  fs.cpSync(src, path.join(WWW, f), { recursive: true, filter: s => s !== SOURCE_NATIVE && !/\.(map|md)$/.test(s) });
}

// 2) le pont natif, en un seul fichier classique
let esbuild;
try { esbuild = require("esbuild"); } catch (e) { echec("esbuild manque : lance « npm ci » dans app/."); }
const sortie = path.join(WWW, "js", "native.bundle.js");
try {
  const r = esbuild.buildSync({
    entryPoints: [SOURCE_NATIVE], bundle: true, format: "iife", platform: "browser",
    target: ["safari15", "chrome100"], minify: true, charset: "utf8", legalComments: "eof",
    nodePaths: [path.join(__dirname, "node_modules")],   // js/native.js est hors de app/ : les @capacitor/* sont ici
    outfile: sortie, logLevel: "silent",
  });
  for (const w of r.warnings) console.warn("⚠ esbuild : " + w.text);
} catch (e) { echec("construction de js/native.js impossible :\n" + ((e.errors || []).map(x => `  ${x.location ? x.location.file + ":" + x.location.line + " " : ""}${x.text}`).join("\n") || e.message)); }
const empreinte = crypto.createHash("sha1").update(fs.readFileSync(sortie)).digest("hex").slice(0, 8);

// 3) www/index.html : version appli
const fIndex = path.join(WWW, "index.html");
let html = fs.readFileSync(fIndex, "utf8");
const retirer = (motif, quoi) => { const avant = html; html = html.replace(motif, ""); return avant !== html ? quoi : null; };
const retires = [
  retirer(/<link[^>]*rel="manifest"[^>]*>\s*/gi, "manifeste"),
  retirer(/<link[^>]*rel="apple-touch-icon"[^>]*>\s*/gi, "icône d'écran d'accueil"),
  retirer(/<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/gi, "Google Fonts"),
  retirer(/<script>(?:(?!<\/script>)[\s\S])*HMG_PRIVE(?:(?!<\/script>)[\s\S])*<\/script>\s*/g, "porte d'invitation"),
  retirer(/<style>(?:(?!<\/style>)[\s\S])*html\.prive(?:(?!<\/style>)[\s\S])*<\/style>\s*/g, "styles de la porte"),
].filter(Boolean);
// les scripts classiques attendent le pont natif (il remet l'identité et l'état du joueur avant qu'app.js ne les lise)
let differes = 0;
html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tout, attrs, code) => {
  const type = (attrs.match(/\btype\s*=\s*"([^"]*)"/i) || [])[1];
  if (type && !/^(text|application)\/javascript$/i.test(type)) return tout;   // modules, JSON… : laissés tels quels
  differes++;
  const a = attrs.replace(/\btype\s*=\s*"[^"]*"/i, "").replace(/\s(async|defer)(?=\s|$)/gi, "").replace(/\bsrc\s*=/i, "data-src=").trim();
  return `<script type="text/hmg-differe"${a ? " " + a : ""}>${code}</script>`;
});
const injection = `\n<script>window.HMG_CIBLE="appli"</script>\n<script src="js/native.bundle.js?v=${empreinte}"></script>`;
if (!/<meta charset="utf-8">/i.test(html)) echec("index.html : <meta charset=\"utf-8\"> introuvable (le pont natif se place juste après).");
html = html.replace(/<meta charset="utf-8">/i, m => m + injection);
fs.writeFileSync(fIndex, html);

// les images du site appelées par la page ou le code (icônes, logo…) : copiées si elles manquent
const lire = f => fs.readFileSync(f, "utf8");
const fichiersTexte = [];
(function parcourir(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) parcourir(f); else if (/\.(html|js|css|json|webmanifest)$/.test(e.name)) fichiersTexte.push(f); } })(WWW);
const manquants = [], absentsDuSite = [];
const exiger = (depuis, ref, ctx, grave = true) => {
  const r = ref.split(/[?#]/)[0];
  if (!r || /^(https?:|data:|blob:|mailto:|tel:|capacitor:|\/\/)/i.test(r)) return;
  const cible = path.resolve(path.dirname(depuis), decodeURIComponent(r));
  if (fs.existsSync(cible)) return;
  const dansSite = path.join(RACINE, path.relative(WWW, cible));
  if (cible.startsWith(WWW) && fs.existsSync(dansSite) && /\.(png|jpe?g|webp|svg|gif|ico|woff2?)$/i.test(r)) {
    fs.mkdirSync(path.dirname(cible), { recursive: true }); fs.copyFileSync(dansSite, cible); return;
  }
  (grave ? manquants : absentsDuSite).push(`${ref} (appelé par ${ctx})`);
};
for (const m of html.matchAll(/\b(?:src|data-src|href)="([^"]+)"/g)) exiger(fIndex, m[1], "index.html");
// dans les CSS et le code, une image absente l'est aussi sur le site (ex. icônes par défaut de Leaflet, inutilisées) : simple avertissement
for (const f of fichiersTexte.filter(f => f.endsWith(".css"))) for (const m of lire(f).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) exiger(f, m[1], rel(f), false);
for (const f of fichiersTexte.filter(f => f.endsWith(".js") && f !== sortie)) for (const m of lire(f).matchAll(/["'`]((?:icons|images|img|fonts)\/[\w./-]+\.(?:png|jpe?g|webp|svg|gif|woff2?))["'`]/g)) exiger(fIndex, m[1], rel(f), false);
if (manquants.length) echec("fichiers introuvables :\n  " + manquants.join("\n  "));
if (absentsDuSite.length) console.warn("⚠ absents aussi du site (non bloquant) :\n  " + absentsDuSite.join("\n  "));

// 4) vérifications finales
const problemes = [];
for (const f of fichiersTexte) {
  lire(f).split("\n").forEach((l, i) => {
    for (const m of l.matchAll(/http:\/\/[^\s"'`)<>]*/g)) if (!/^http:\/\/www\.w3\.org\//.test(m[0])) problemes.push(`${rel(f)}:${i + 1} adresse non chiffrée ${m[0].slice(0, 80)}`);
    if (/fonts\.(googleapis|gstatic)\.com/.test(l)) problemes.push(`${rel(f)}:${i + 1} appel à Google Fonts`);
  });
}
if (fs.existsSync(path.join(WWW, "sw.js"))) problemes.push("sw.js ne doit pas être dans l'appli");
if (/rel="manifest"/i.test(html)) problemes.push("index.html : manifeste encore présent");
const premier = (html.match(/<script\b[^>]*>/i) || [""])[0];
if (!/^<script>$/i.test(premier) || !html.includes('window.HMG_CIBLE="appli"')) problemes.push("index.html : HMG_CIBLE n'est pas le premier script");
if (problemes.length) echec("l'appli embarquée n'est pas propre :\n  " + problemes.join("\n  "));

const taille = (function t(d) { return fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? t(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0); })(WWW);
console.log(`✓ www prêt : ${(taille / 1048576).toFixed(2)} Mo, pont natif ${(fs.statSync(sortie).size / 1024).toFixed(0)} Ko, ${differes} script(s) chargé(s) après le pont` + (retires.length ? ` ; retiré de la page : ${retires.join(", ")}` : ""));
