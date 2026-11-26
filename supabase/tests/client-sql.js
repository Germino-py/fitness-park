#!/usr/bin/env node
/* =====================================================================================================
   Le VRAI fichier client js/serveur.js (HMGS) contre le VRAI serveur (Postgres local jetable + migrations 01 à 04).
   Entre les deux, un petit « Supabase » de test : Auth (inscription anonyme, renouvellement des jetons) et
   PostgREST (POST /rest/v1/rpc/<nom> → select public.<nom>(p_x => …) sous le rôle authenticated avec le jeton,
   ou anon sans jeton ; erreurs rendues comme PostgREST : message, hint, code, 404 si la fonction n'existe pas).
   Ce qui est vérifié : chaque fonction de HMGS appelle une RPC qui existe, avec les bons noms d'arguments, et le
   parcours complet marche (reprise d'un compte du site, invitation, inscription, séance, transfert, suppression).
   Lancé par supabase/tests/lancer.sh (PGHOST, PGPORT, PGUSER posés). Code de sortie 1 au moindre échec.
   ===================================================================================================== */
"use strict";
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const RACINE = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(path.join(RACINE, "js/serveur.js"), "utf8");

const q = s => "'" + String(s).replace(/'/g, "''") + "'";
function psql(script) {
  const r = spawnSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-f", "-"], { input: script, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const lireJeton = t => { try { return JSON.parse(Buffer.from(String(t).split(".")[1], "base64url").toString()); } catch (e) { return null; } };

/* ---------- le petit Supabase de test ---------- */
const jetons = new Map();                                    // refresh_token → uid
let journal = [];
function session(uid) {
  const exp = Math.floor(Date.now() / 1000) + 3600, rt = crypto.randomBytes(12).toString("hex");
  jetons.set(rt, uid);
  return { access_token: "eyJhbGciOiJIUzI1NiJ9." + b64({ sub: uid, exp, role: "authenticated", is_anonymous: true }) + ".test",
           refresh_token: rt, expires_in: 3600, expires_at: exp, token_type: "bearer", user: { id: uid, is_anonymous: true } };
}
function litteral(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "object") return q(JSON.stringify(v)) + "::jsonb";
  return q(v);
}
function rpc(nom, args, claims) {
  if (!/^[a-z][a-z0-9_]*$/.test(nom)) return [404, { code: "PGRST202", message: "nom" }];
  const a = Object.entries(args || {}).map(([k, v]) => { if (!/^p_[a-z_]+$/.test(k)) throw new Error("argument " + k); return `${k} => ${litteral(v)}`; });
  const r = psql(["begin;", claims ? `select set_config('request.jwt.claims', ${q(JSON.stringify(claims))}, true) \\g /dev/null` : "",
                  `set local role ${claims ? "authenticated" : "anon"};`,
                  `select coalesce(to_json(public.${nom}(${a.join(", ")}))::text, 'null');`, "commit;"].join("\n"));
  if (r.ok) return [200, JSON.parse(r.out.split("\n").pop())];
  const m = /ERROR:\s+([0-9A-Z]{5}):\s+(.*)/.exec(r.err) || [], hint = (/HINT:\s+(.*)/.exec(r.err) || [])[1] || null;
  if (m[1] === "42883") return [404, { code: "PGRST202", message: "Could not find the function public." + nom + " (" + m[2] + ")" }];
  if (m[1] === "42501") return [claims ? 403 : 401, { code: "42501", message: m[2] }];
  return [400, { code: m[1] || "XX000", message: m[2] || r.err, hint, details: null }];
}
async function fetch(url, init) {
  const u = new URL(url), corps = init && init.body ? JSON.parse(init.body) : {}, h = (init && init.headers) || {};
  const rep = (status, j) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(j) });
  if (!h.apikey) return rep(401, { message: "No API key found in request" });
  if (u.pathname === "/auth/v1/signup") {
    const uid = crypto.randomUUID();
    const r = psql(`insert into auth.users (id, is_anonymous) values (${q(uid)}, true);`);
    if (!r.ok) throw new Error(r.err);
    journal.push("signup");
    return rep(200, session(uid));
  }
  if (u.pathname === "/auth/v1/token") {
    const uid = jetons.get(corps.refresh_token);
    jetons.delete(corps.refresh_token);
    journal.push("refresh");
    const existe = uid && psql(`select count(*) from auth.users where id = ${q(uid)};`).out === "1";
    return existe ? rep(200, session(uid)) : rep(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" });
  }
  if (u.pathname === "/rest/v1/settings") {                // la table publique des réglages (lecture seule, comme anon)
    const r = psql("set role anon; select coalesce(json_agg(json_build_object('key', key)), '[]')::text from public.settings where key = 'access_mode';");
    return rep(r.ok ? 200 : 401, r.ok ? JSON.parse(r.out.split("\n").pop()) : { message: r.err });
  }
  if (u.pathname.startsWith("/rest/v1/rpc/")) {
    const nom = u.pathname.slice(13), jeton = String(h.Authorization || "").replace(/^Bearer /, "");
    let claims = null;
    if (jeton) {
      claims = lireJeton(jeton);
      if (!claims) return rep(401, { code: "PGRST301", message: "JWSError" });
      if (claims.exp < Date.now() / 1000) return rep(401, { code: "PGRST303", message: "JWT expired" });
    }
    journal.push(nom);
    const [s, j] = rpc(nom, corps, claims);
    return rep(s, j);
  }
  return rep(404, { message: "route inconnue " + u.pathname });
}

/* ---------- un appareil : js/serveur.js dans un contexte isolé ---------- */
function appareil(ls = {}, avecTrousseau = false) {
  const store = new Map(Object.entries(ls).map(([k, v]) => [k, JSON.stringify(v)]));
  const trousseau = new Map(), ecritures = [];
  const W = {
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetch, atob, setTimeout, clearTimeout, AbortController, URL,
    console: { warn() {}, info() {}, log() {}, error() {} },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, dispatchEvent: () => true, addEventListener() {},
    HMGS_CONFIG: { url: "https://essai.supabase.co", key: "sb_publishable_essai_0123456789" },
  };
  if (avecTrousseau) W.HMGN = { stockage: { get: async k => trousseau.get(k) ?? null, set: async (k, v, o) => { ecritures.push(o); trousseau.set(k, v); return true; }, remove: async k => trousseau.delete(k) } };
  W.window = W;
  vm.runInContext(SOURCE, vm.createContext(W));
  return { H: W.HMGS, store, trousseau, ecritures, uid: () => W.HMGS.statut().uid };
}

/* ---------- les vérifications ---------- */
const res = [];
const verifie = (nom, ok, detail) => { res.push({ nom, ok: !!ok, detail }); };
const J = x => JSON.parse(JSON.stringify(x));
async function essai(nom, f, attendu) {
  try { const r = J(await f()); verifie(nom, attendu ? attendu(r) : true, JSON.stringify(r).slice(0, 300)); return r; }
  catch (e) { verifie(nom, false, (e.hint ? "[" + e.hint + "] " : "") + e.message); return null; }
}
const sql1 = s => { const r = psql(s); if (!r.ok) throw new Error(r.err); return r.out; };

(async () => {
  const CODE = "Test-Client-2026", VOTER = crypto.randomBytes(16).toString("hex");
  sql1(`select app.add_invite(${q(CODE)}, 'Tests du client', 20, 30);`);
  // les salles OpenStreetMap des scénarios (dont Club Forme Lognes), comme le ferait 06-salles-osm.sql
  const osm = require(path.join(RACINE, "outils/tests/scenarios.js")).SALLES_TEST.filter(g => g.source === "osm")
    .map(g => Object.assign({ precise: true, active: true }, g));
  sql1(`select app.import_gyms(${q(JSON.stringify(osm))}::jsonb);`);
  // un sportif du site d'après la migration : une séance aujourd'hui par l'ancienne RPC (rôle anon, clé publique)
  const L = await (await fetch("https://essai.supabase.co/rest/v1/rpc/checkin", { method: "POST", headers: { apikey: "k" },
    body: JSON.stringify({ p_voter: VOTER, p_no: 0, p_club: "lognes", p_lat: 48.8356, p_lon: 2.6302, p_acc: 12 }) })).text();
  verifie("ancienne RPC checkin (clé publique seule) : toujours ouverte", /"ok"\s*:\s*true/.test(L), L);

  // ── Appareil A : le site, avec la clé hmg-voter et le code de la porte d'invitation
  const A = appareil({ "hmg-voter": VOTER, "hmg-invite": CODE.toLowerCase(), "hmg-game": { stars: 2 } });
  const stA = J(await A.H.pret());
  verifie("A : mode serveur, session anonyme créée", stA.mode === "serveur" && stA.anonyme === true && !!stA.uid, JSON.stringify(stA));
  verifie("A : reprise de la clé du site (après l'invitation de la porte)", stA.reprise === "ok", stA.reprise);
  verifie("A : la session est dans localStorage (site)", !!JSON.parse(A.store.get("hmg-auth") || "null"), "");
  verifie("A : le joueur du site appartient au compte", sql1(`select count(*) from players where voter = ${q(VOTER)} and user_id = ${q(stA.uid)};`) === "1", "");
  const e0 = await essai("A : etat() avant l'objectif", () => A.H.etat(), r => r.onboarded === false && r.steps === 1 && r.today && r.today.status === "validee");
  if (e0) verifie("A : last_day = la séance du site d'aujourd'hui", e0.last_day && e0.today && e0.last_day === sql1(`select max(day) from checkins where voter = ${q(VOTER)};`), e0.last_day);
  await essai("A : objectif(3, {inscription})", () => A.H.objectif(3, { inscription: true }), r => r.ok && r.state.onboarded && r.state.goal === 3 && r.state.week.days.length === 1);
  await essai("A : objectif(4) pendant la semaine d'essai", () => A.H.objectif(4), r => r.ok && r.state.goal === 4);
  await essai("A : maSalle('lognes')", () => A.H.maSalle("lognes"), r => r.ok && r.state.home_club === "lognes");
  await essai("A : naissance(1990)", () => A.H.naissance(1990), r => r.ok && r.state.birth_year === 1990 && !r.state.minor);
  await essai("A : doux(true) puis doux(false)", async () => { await A.H.doux(true); return A.H.doux(false); }, r => r.ok && r.state.soft_mode === false);
  await essai("A : pause(1)", () => A.H.pause(1), r => r.ok && (r.state.pause || r.state.pause_next));
  await essai("A : finPause()", () => A.H.finPause(), r => r.ok);
  await essai("A : hiberner() puis finPause()", async () => { const h = await A.H.hiberner(); await A.H.finPause(); return h; }, r => r.ok);
  await essai("A : pause(99) refusée sans rejet (duree)", () => A.H.pause(99), r => r.ok === false && r.why === "duree");
  await essai("A : seanceDebut le même jour → deja", () => A.H.seanceDebut({ lat: 48.8356, lon: 2.6302, acc: 10, club: "lognes" }), r => r.ok === false && r.why === "deja");
  await essai("A : seanceFin d'une séance inconnue → introuvable", () => A.H.seanceFin(999999, { lat: 48.8356, lon: 2.6302, acc: 10 }), r => r.ok === false && r.why === "introuvable");
  await essai("A : coffre('pionnier')", () => A.H.coffre("pionnier"), r => r.ok === true || r.why === "introuvable");
  await essai("A : ackBilan(lundi)", () => A.H.ackBilan(e0 ? e0.week.start : "2026-11-23"), r => typeof r.ok === "boolean");
  await essai("A : classement('month')", () => A.H.classement("month"), r => Array.isArray(r) && r.some(x => x.me));
  await essai("A : classement('all')", () => A.H.classement("all"), r => Array.isArray(r));
  await essai("A : semainePassee()", () => A.H.semainePassee(), r => r && "n" in r);
  await essai("A : score()", () => A.H.score(), r => r && r.days >= 1);
  await essai("A : compte()", () => A.H.compte(), r => r.access === true && r.player === true && r.anonymous === true);
  await essai("A : pseudoLibre('Zorro_77')", () => A.H.pseudoLibre("Zorro_77"), r => typeof r === "string");
  await essai("A : pseudo('Zorro_77')", () => A.H.pseudo("Zorro_77"), r => r.ok === true);
  await essai("A : sallesProches", () => A.H.sallesProches(48.8356, 2.6302, 3), r => Array.isArray(r) && r.length >= 1 && r[0].id);
  await essai("A : chercherSalles('lognes')", () => A.H.chercherSalles("lognes", 5), r => Array.isArray(r) && r.some(x => x.id === "lognes"));
  await essai("A : sauver('game') puis charger()", async () => { await A.H.sauver("game", { stars: 2, items: [] }, 0); return A.H.charger(); }, r => r && r.game);
  await essai("A : avis('lognes', 8)", () => A.H.avis("lognes", 8, null), r => r.ok === true && r.id);
  await essai("A : masques() vide", () => A.H.masques(), r => Array.isArray(r) && r.length === 0);
  await essai("A : exporter()", () => A.H.exporter(), r => r.player && r.checkins.length === 1 && r.appareil && r.pseudo === "Zorro_77");

  // ── Appareil B : l'appli (trousseau), sans clé du site ni invitation au début
  const B = appareil({}, true);
  const stB = J(await B.H.pret());
  verifie("B : session rangée dans le trousseau avec {icloud:false}", B.trousseau.has("hmg-auth") && B.ecritures.every(o => o && o.icloud === false) && !B.store.has("hmg-auth"), JSON.stringify(B.ecritures));
  verifie("B : sans invitation, etat() rend null", (await B.H.etat()) === null && B.H.statut().acces === false, JSON.stringify(J(B.H.statut())));
  await essai("B : invitation(mauvais code) → code", () => B.H.invitation("PAS-BON-1234"), r => r.ok === false && r.why === "code");
  await essai("B : invitation(bon code)", () => B.H.invitation(CODE), r => r.ok === true);
  await essai("B : objectif(2, {inscription})", () => B.H.objectif(2, { inscription: true }), r => r.ok && r.state.goal === 2);
  const d = await essai("B : seanceDebut à Club Forme Lognes (OpenStreetMap)", () => B.H.seanceDebut({ lat: 48.8358, lon: 2.6305, acc: 10, club: "osm-n1002" }), r => r.ok && r.club === "osm-n1002" && r.session && r.session.id);
  if (d) await essai("B : seanceFin tout de suite → trop_tot", () => B.H.seanceFin(d.session.id, { lat: 48.8358, lon: 2.6305, acc: 10 }), r => r.ok === false && r.why === "trop_tot" && r.wait_s > 0);
  await essai("B : etat() a la séance en cours", () => B.H.etat({ frais: true }), r => r.session && r.session.club === "osm-n1002" && r.session.club_name === "Club Forme Lognes");
  const noA = e0 ? e0.no : null;
  if (noA) {
    await essai("B : signaler le membre A", () => B.H.signaler("member", noA, "spam"), r => r.ok === true);
    await essai("B : masquer A, masques(), demasquer A", async () => { await B.H.masquer(noA); const m = await B.H.masques(); await B.H.demasquer(noA); return m; }, r => r.length === 1 && r[0].no === noA);
  }
  // un avis avec commentaire, validé par l'admin (on ne vote que sur les commentaires publiés)
  const idAvis = sql1("insert into public.reviews (club_id, rating, comment, hidden) values ('lognes', 9, 'Coachs au top', false) returning id;");
  await essai("B : vote(avis commenté, 1)", () => B.H.vote(idAvis, 1), r => r !== null);
  verifie("B : le pouce est compté", sql1(`select up from public.reviews where id = ${q(idAvis)};`) === "1", "");
  await essai("B : reprendreCompte(clé de A) → pris", () => B.H.reprendreCompte(VOTER), r => r.ok === false && r.why === "pris");

  // ── Changer de téléphone : code de transfert de A vers un nouvel appareil C (sans invitation : l'accès suit)
  const ct = await essai("A : codeTransfert()", () => A.H.codeTransfert(), r => r.ok && /^[0-9A-Z]{5}-[0-9A-Z]{5}$/.test(r.code));
  const C = appareil({}, true);
  if (ct) await essai("C : transfert(code)", () => C.H.transfert(ct.code), r => r.ok && r.state && r.state.steps === 1 && r.state.goal === 4);
  await essai("C : etat() = le joueur de A", () => C.H.etat({ frais: true }), r => r.pseudo === "Zorro_77" && r.home_club === "lognes");
  await essai("A : n'a plus de joueur", () => A.H.etat({ frais: true }), r => r.onboarded === false);

  // ── Jeton expiré : renouvelé tout seul ; puis suppression du compte
  const s = JSON.parse(C.trousseau.get("hmg-auth"));
  s.expires_at = Math.floor(Date.now() / 1000) - 5;
  C.trousseau.set("hmg-auth", JSON.stringify(s));
  const C2 = appareil({}, true); C2.trousseau.set("hmg-auth", JSON.stringify(s));
  journal = [];
  await essai("C : jeton expiré → renouvelé, même compte", () => C2.H.etat(), r => r.pseudo === "Zorro_77");
  verifie("C : un renouvellement, pas de nouveau compte", journal[0] === "refresh" && !journal.includes("signup"), journal.join(","));
  const uidC = C2.uid();
  await essai("C : supprimerCompte()", () => C2.H.supprimerCompte(), r => r.ok === true);
  verifie("C : compte, joueur et séances effacés", sql1(`select (select count(*) from auth.users where id = ${q(uidC)}) + (select count(*) from players where voter = ${q(VOTER)}) + (select count(*) from checkins where voter = ${q(VOTER)});`) === "0", "");
  verifie("C : session oubliée sur l'appareil", !C2.trousseau.has("hmg-auth"), "");

  // ── Bilan
  const ko = res.filter(r => !r.ok);
  for (const r of res) console.log((r.ok ? "   ok     " : "   ÉCHEC  ") + r.nom + (r.ok ? "" : "  → " + r.detail));
  console.log(`   ${res.length - ko.length} / ${res.length} vérifications du client js/serveur.js sur le vrai serveur`);
  process.exit(ko.length ? 1 : 0);
})().catch(e => { console.error("   ÉCHEC  client-sql.js : " + (e && e.stack || e)); process.exit(1); });
