/* Tests de js/serveur.js (HMGS) avec un faux Supabase (Auth + PostgREST) en mémoire : aucun réseau.
   Lancer : node --test outils/tests/serveur.test.js
   Le vrai serveur (Postgres + migrations) est testé avec ce même fichier client par supabase/tests/client-sql.js. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const RACINE = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(path.join(RACINE, "js/serveur.js"), "utf8");
const MIROIR = fs.readFileSync(path.join(RACINE, "js/vies-regles.js"), "utf8");
const VOTER = "0123456789abcdef0123456789abcdef";
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub, exp, anonyme = true) => "eyJhbGciOiJIUzI1NiJ9." + b64({ sub, exp, role: "authenticated", is_anonymous: anonyme }) + ".signature";
const sec = () => Math.floor(Date.now() / 1000);
/* les objets nés dans le contexte isolé ont un autre prototype : on compare leur JSON */
const J = x => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const egal = (a, b, m) => assert.deepStrictEqual(J(a), J(b), m);
const ETAT = (o = {}) => Object.assign({ contract: 1, hearts: 3, onboarded: true, week: { start: "2026-11-23", days: [] }, last_day: null }, o);

/* Faux Supabase : routes programmables, journal des appels */
function fauxSupabase(o = {}) {
  const appels = [];
  let n = 0;
  const sessionNeuve = () => { n++; const uid = "00000000-0000-4000-8000-00000000000" + n;
    return { access_token: jwt(uid, sec() + 3600), refresh_token: "rt-" + n, expires_in: 3600, expires_at: sec() + 3600, token_type: "bearer", user: { id: uid, is_anonymous: true } }; };
  const rep = (status, j) => ({ ok: status >= 200 && status < 300, status, text: async () => (j === undefined ? "" : JSON.stringify(j)) });
  const routes = Object.assign({
    settings: () => rep(200, [{ key: "access_mode" }]),
    has_access: () => rep(200, false),
    signup: () => rep(200, sessionNeuve()),
    refresh: () => rep(200, sessionNeuve()),
    claim_legacy_account: () => rep(200, { ok: true, no: 12345, state: ETAT() }),
    my_state: () => rep(200, ETAT()),
  }, o.routes || {});
  async function fetch(url, init) {
    if (o.horsLigne && o.horsLigne()) throw new TypeError("Failed to fetch");
    const u = new URL(url), corps = init && init.body ? JSON.parse(init.body) : null, h = (init && init.headers) || {};
    const a = { chemin: u.pathname + u.search, nom: null, corps, jeton: (h.Authorization || "").replace(/^Bearer /, "") || null, apikey: h.apikey };
    if (u.pathname === "/auth/v1/signup") a.nom = "signup";
    else if (u.pathname === "/rest/v1/settings") a.nom = "settings";
    else if (u.pathname === "/auth/v1/token") a.nom = "refresh";
    else a.nom = u.pathname.replace("/rest/v1/rpc/", "");
    appels.push(a);
    const f = routes[a.nom];
    if (!f) return rep(404, { code: "PGRST202", message: "Could not find the function public." + a.nom + " in the schema cache" });
    return f(a);
  }
  return { fetch, appels, routes, rep, noms: () => appels.map(a => a.nom) };
}

/* Un « onglet » : contexte isolé avec localStorage, fetch, et éventuellement HMGN (appli) */
function onglet({ sb, ls, hmgn, demo, global } = {}) {
  const store = ls instanceof Map ? ls : new Map(Object.entries(ls || {}).map(([k, v]) => [k, JSON.stringify(v)]));
  const evts = [], avis = [];
  const W = {
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    fetch: sb ? sb.fetch : async () => { throw new Error("pas de réseau dans ce test"); },
    atob, setTimeout, clearTimeout, AbortController, URL,
    console: { warn: m => avis.push(String(m)), info: m => avis.push(String(m)), log() {}, error: m => avis.push(String(m)) },
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o && o.detail; } },
    dispatchEvent: e => { evts.push(e); return true; }, addEventListener() {},
    HMGS_CONFIG: { url: "https://essai.supabase.co", key: "sb_publishable_essai_0123456789" },
  };
  if (hmgn) W.HMGN = hmgn;
  Object.assign(W, global || {});
  W.window = W;
  const ctx = vm.createContext(W);
  if (demo) {
    vm.runInContext(MIROIR, ctx);
    W.CLUBS = [{ id: "lognes", n: "Lognes", c: "Lognes", cp: "77185" }, { id: "noisy", n: "Noisy", c: "Noisy-le-Grand", cp: "93160" }];
    W.PRE = { lognes: [48.8357, 2.629], noisy: [48.8406, 2.5521] };
  }
  vm.runInContext(SOURCE, ctx);
  const ls2 = k => { const v = store.get(k); return v == null ? null : JSON.parse(v); };
  return { W, H: W.HMGS, store, ls: ls2, evts, avis, noms: t => evts.filter(e => e.type === t) };
}
/* faux HMGN.stockage (trousseau) qui note les options d'écriture */
function fauxTrousseau() {
  const m = new Map(), ecritures = [];
  return { m, ecritures, stockage: { get: async k => (m.has(k) ? m.get(k) : null), set: async (k, v, o) => { ecritures.push({ k, o }); m.set(k, v); return true; }, remove: async k => { m.delete(k); return true; } } };
}

test("serveur pas encore installé : ancien fonctionnement, aucun compte créé", async () => {
  const sb = fauxSupabase({ routes: { settings: () => sb.rep(200, []), has_access: a => sb.rep(404, { code: "PGRST202", message: "Could not find the function public.has_access" }) } });
  const o = onglet({ sb, ls: { "hmg-voter": VOTER } });
  const st = await o.H.pret();
  assert.equal(st.mode, "ancien"); assert.equal(st.raison, "serveur_ancien");
  egal(sb.noms(), ["settings"], "une seule lecture, pas d'inscription");
  assert.equal(await o.H.etat(), null);
  assert.equal(await o.H.exporter(), null);
  await assert.rejects(o.H.pause(1), e => e.hint === "ancien");
  await assert.rejects(o.H.supprimerCompte(), e => e.hint === "ancien");
  egal(await o.H.maSalle("lognes"), { ok: false, why: "ancien", message: st.message });
  assert.equal(o.ls("hmg-auth"), null);  // page suivante : la réponse est gardée une heure, pas de nouvelle requête
  const o2 = onglet({ sb, ls: { "hmg-voter": VOTER, "hmg-serveur": o.ls("hmg-serveur") } });
  assert.equal((await o2.H.pret()).raison, "serveur_ancien");
  egal(sb.noms(), ["settings"]);
  // une heure plus tard, on redemande
  const o3 = onglet({ sb, ls: { "hmg-serveur": { raison: "serveur_ancien", at: Date.now() - 3601e3 } } });
  await o3.H.pret();
  egal(sb.noms(), ["settings", "settings"]);
  // si la table settings n'est pas lisible, la fonction has_access() répond à sa place
  sb.routes.settings = () => sb.rep(401, { message: "permission denied" });
  const o4 = onglet({ sb });
  assert.equal((await o4.H.pret()).raison, "serveur_ancien");
  egal(sb.noms().slice(2), ["settings", "has_access"]);
});

test("connexions anonymes coupées : message clair, ancien fonctionnement", async () => {
  const sb = fauxSupabase({ routes: { signup: () => sb.rep(422, { code: 422, error_code: "anonymous_provider_disabled", msg: "Anonymous sign-ins are disabled" }) } });
  const o = onglet({ sb, ls: { "hmg-voter": VOTER } });
  const st = await o.H.pret();
  assert.equal(st.mode, "ancien"); assert.equal(st.raison, "anonyme_coupe");
  assert.match(st.message, /Allow anonymous sign-ins/);
  assert.ok(o.avis.some(m => /connexions anonymes sont coupées/.test(m)), "avertissement dans la console");
  assert.equal(await o.H.etat(), null);
  assert.equal(o.noms("hmgs:mode").at(-1).detail.raison, "anonyme_coupe");
  const o2 = onglet({ sb, ls: { "hmg-serveur": o.ls("hmg-serveur") } });
  assert.equal((await o2.H.pret()).raison, "anonyme_coupe");
  egal(sb.noms(), ["settings", "signup"], "pas de nouvelle tentative pendant une heure");
});

test("site : session anonyme dans localStorage, reprise de hmg-voter une seule fois, my_state et cache", async () => {
  const sb = fauxSupabase();
  const ls = new Map([["hmg-voter", JSON.stringify(VOTER)], ["hmg-game", JSON.stringify({ stars: 3 })]]);
  const o = onglet({ sb, ls });
  const st = await o.H.pret();
  assert.equal(st.mode, "serveur"); assert.equal(st.reprise, "ok"); assert.equal(st.anonyme, true);
  egal(sb.noms(), ["settings", "signup", "claim_legacy_account"]);
  const claim = sb.appels[2];
  egal(claim.corps, { p_key: VOTER, p_old_stars: 3 });
  assert.equal(claim.jeton, o.ls("hmg-auth").access_token, "le jeton de la session part avec l'appel");
  assert.equal(o.ls("hmg-auth").refresh_token, "rt-1");
  const e1 = await o.H.etat();
  assert.equal(e1.hearts, 3);
  // la réponse de la reprise contenait déjà un état : il est servi tout de suite
  egal(sb.noms(), ["settings", "signup", "claim_legacy_account"]);
  await o.H.etat({ frais: true });
  assert.equal(sb.noms().filter(x => x === "my_state").length, 1);
  assert.equal(o.ls("hmg-etat").state.contract, 1);
  assert.ok(o.noms("hmgs:etat").length >= 1);
  // rechargement de la page : même session, pas de nouvelle inscription ni de nouvelle reprise
  const o2 = onglet({ sb, ls });
  assert.equal(o2.H.etatCache().hearts, 3, "l'état gardé est lisible tout de suite");
  await o2.H.pret();
  await o2.H.etat();
  egal(sb.noms().slice(4), ["my_state"]);
  // « C'est moi » a changé la clé : la reprise se refait
  ls.set("hmg-voter", JSON.stringify("ffffffffffffffffffffffffffffffff"));
  const o3 = onglet({ sb, ls });
  await o3.H.pret();
  assert.equal(sb.appels.at(-1).nom, "claim_legacy_account");
  assert.equal(sb.appels.at(-1).corps.p_key, "ffffffffffffffffffffffffffffffff");
});

test("appli : la session va dans le trousseau avec {icloud:false}, jamais dans localStorage", async () => {
  const sb = fauxSupabase(), t = fauxTrousseau();
  const ls = new Map([["hmg-voter", JSON.stringify(VOTER)], ["hmg-auth", JSON.stringify({ access_token: "vieux", refresh_token: "vieux" })]]);
  const o = onglet({ sb, ls, hmgn: { stockage: t.stockage } });
  const st = await o.H.pret();
  assert.equal(st.natif, true); assert.equal(st.mode, "serveur");
  assert.equal(ls.has("hmg-auth"), false, "un ancien jeton de localStorage est effacé");
  egal(t.ecritures, [{ k: "hmg-auth", o: { icloud: false } }]);
  assert.equal(JSON.parse(t.m.get("hmg-auth")).refresh_token, "rt-1");
  // relance de l'appli : la session revient du trousseau
  const o2 = onglet({ sb, ls, hmgn: { stockage: t.stockage } });
  await o2.H.pret(); await o2.H.etat({ frais: true });
  assert.equal(sb.noms().filter(x => x === "signup").length, 1);
  assert.equal(sb.appels.at(-1).jeton, JSON.parse(t.m.get("hmg-auth")).access_token);
});

test("jeton bientôt expiré : renouvelé avant l'appel ; 401 : renouvelé puis rejoué une fois", async () => {
  let refus = 1;
  const sb = fauxSupabase({ routes: { my_state: a => (refus-- > 0 ? sb.rep(401, { code: "PGRST303", message: "JWT expired" }) : sb.rep(200, ETAT({ hearts: 2 }))) } });
  const vieille = { access_token: jwt("00000000-0000-4000-8000-0000000000aa", sec() + 20), refresh_token: "rt-vieux", expires_at: sec() + 20, uid: "00000000-0000-4000-8000-0000000000aa", anonyme: true };
  const o = onglet({ sb, ls: { "hmg-auth": vieille } });
  await o.H.pret();
  const st = await o.H.etat();
  assert.equal(st.hearts, 2);
  egal(sb.noms(), ["refresh", "my_state", "refresh", "my_state"]);
  egal(sb.appels[0].corps, { refresh_token: "rt-vieux" });
  assert.equal(o.ls("hmg-auth").refresh_token, "rt-2");
});

test("session refusée pour de bon : nouveau compte anonyme, évènement session-perdue", async () => {
  const sb = fauxSupabase({ routes: { refresh: () => sb.rep(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" }) } });
  const vieille = { access_token: "x.y.z", refresh_token: "rt-mort", expires_at: sec() - 10, uid: "u-mort", anonyme: true };
  const o = onglet({ sb, ls: { "hmg-auth": vieille } });
  await o.H.pret();
  assert.ok(await o.H.etat());
  egal(sb.noms(), ["refresh", "signup", "my_state"]);
  assert.equal(o.noms("hmgs:session-perdue").length, 1);
  assert.equal(o.ls("hmg-auth").refresh_token, "rt-1");
});

test("réseau coupé pendant un renouvellement : la session est gardée (pas de nouveau compte)", async () => {
  let coupe = true;
  const sb = fauxSupabase({ horsLigne: () => coupe });
  const vieille = { access_token: "x.y.z", refresh_token: "rt-garde", expires_at: sec() - 10, uid: "u-garde", anonyme: true };
  const o = onglet({ sb, ls: { "hmg-auth": vieille, "hmg-etat": { uid: "u-garde", at: 0, state: ETAT({ hearts: 1 }) } } });
  await o.H.pret();
  assert.equal((await o.H.etat()).hearts, 1, "hors connexion : le dernier état gardé");
  assert.equal(o.H.statut().hors_ligne, true);
  assert.equal(o.ls("hmg-auth").refresh_token, "rt-garde");
  coupe = false;
  assert.equal((await o.H.etat({ frais: true })).hearts, 3);
  assert.equal(o.H.statut().hors_ligne, false);
  egal(sb.noms(), ["refresh", "my_state"]);
});

test("accès privé : le code de la porte du site est essayé une fois, puis l'appel est rejoué", async () => {
  let invite = false;
  const sb = fauxSupabase({ routes: {
    claim_legacy_account: () => sb.rep(200, { ok: false, why: "inconnu" }),
    my_state: () => (invite ? sb.rep(200, ETAT()) : sb.rep(400, { code: "P0001", message: "HMG est en test privé : entre ton code d'invitation.", hint: "invite" })),
    redeem_invite: a => { invite = a.corps.p_code === "mino-test"; return sb.rep(200, { ok: invite, why: invite ? null : "code" }); },
  } });
  const o = onglet({ sb, ls: { "hmg-voter": VOTER, "hmg-invite": "mino-test" } });
  await o.H.pret();
  assert.equal(o.H.statut().reprise, "inconnu");
  assert.equal((await o.H.etat()).contract, 1);
  egal(sb.noms().slice(3), ["my_state", "redeem_invite", "my_state"]);
  assert.equal(o.H.statut().acces, true);
  // un mauvais code : pas d'état, un évènement pour montrer l'écran d'invitation, pas de nouvel essai du même code
  invite = false;
  const o2 = onglet({ sb, ls: { "hmg-voter": VOTER, "hmg-invite": "mauvais" } });
  assert.equal(await o2.H.etat(), null);
  assert.equal(o2.H.statut().acces, false);
  assert.equal(o2.noms("hmgs:invitation").length, 1);
  const avant = sb.noms().filter(x => x === "redeem_invite").length;
  await o2.H.etat({ frais: true });
  assert.equal(sb.noms().filter(x => x === "redeem_invite").length, avant);
  // l'écran d'invitation appelle HMGS.invitation(code)
  const r = await o2.H.invitation("mino-test");
  assert.equal(r.ok, true); assert.equal(o2.H.statut().acces, true);
});

test("clé du site pas encore sur le serveur : la reprise est retentée juste avant le pseudo et l'objectif d'inscription", async () => {
  let connue = false;
  const sb = fauxSupabase({ routes: {
    claim_legacy_account: () => sb.rep(200, connue ? { ok: true, no: 4242, state: ETAT() } : { ok: false, why: "inconnu" }),
    set_pseudo_v2: () => sb.rep(200, { ok: true }),
    set_goal: a => sb.rep(200, { ok: true, state: ETAT({ goal: a.corps.p_goal }) }),
  } });
  const ls = new Map([["hmg-voter", JSON.stringify(VOTER)]]);
  const o = onglet({ sb, ls });
  await o.H.pret();
  assert.equal(o.H.statut().reprise, "inconnu");
  connue = true;                                             // l'ancien set_pseudo vient de créer le joueur
  egal(await o.H.pseudo("Mino"), { ok: true });
  egal(sb.noms().slice(-2), ["claim_legacy_account", "set_pseudo_v2"]);
  assert.equal(o.H.statut().reprise, "ok");
  const r = await o.H.objectif(3, { inscription: true });
  assert.equal(r.state.goal, 3);
  egal(sb.noms().slice(-1), ["set_goal"], "reprise faite : pas de nouvel essai");
  // relance : « ok » est gardé, pas de nouvel appel
  const o2 = onglet({ sb, ls }); await o2.H.pret();
  assert.equal(sb.noms().at(-1), "set_goal");
});

test("réponses : refus métier rendus (objectif, pause), rejetés pour finPause et doux ; l'état reçu remplace le cache", async () => {
  const sb = fauxSupabase({ routes: {
    set_goal: () => sb.rep(200, { ok: false, why: "trop_tot", next_date: "2026-12-21" }),
    pause_start: a => sb.rep(200, a.corps.p_weeks > 5 ? { ok: false, why: "duree", max: 5 } : { ok: true, from: "2026-11-30", state: ETAT({ pause_next: { kind: a.corps.p_kind } }) }),
    pause_end: () => sb.rep(200, { ok: false, why: "aucune" }),
    set_soft_mode: a => sb.rep(200, a.corps.p_on ? { ok: true, state: ETAT({ soft_mode: true }) } : { ok: false, why: "mineur" }),
    ack_bilan: () => sb.rep(500, { message: "panne" }),
    session_start: a => sb.rep(200, { ok: true, dist: 12, club: a.corps.p_meta.club, session: { id: 7 }, state: ETAT() }),
    session_confirm: a => sb.rep(200, { ok: false, why: "trop_tot", wait_s: 300 }),
    report_content: a => sb.rep(200, { ok: true, hidden: false }),
  } });
  const o = onglet({ sb });
  await o.H.pret();
  egal(await o.H.objectif(4), { ok: false, why: "trop_tot", next_date: "2026-12-21" });
  egal(await o.H.pause(9), { ok: false, why: "duree", max: 5 });
  const p = await o.H.pause(2);
  assert.equal(p.ok, true); assert.equal(o.H.etatCache().pause_next.kind, "pause");
  egal(sb.appels.at(-1).corps, { p_kind: "pause", p_weeks: 2 });
  await o.H.hiberner(); egal(sb.appels.at(-1).corps, { p_kind: "hibernation", p_weeks: 1 });
  await assert.rejects(o.H.finPause(), e => e.why === "aucune" && e.hint === "refus");
  await assert.rejects(o.H.doux(false), e => e.why === "mineur");
  assert.equal((await o.H.doux(true)).state.soft_mode, true);
  assert.equal((await o.H.etat()).soft_mode, true, "l'état de la dernière réponse est servi");
  egal(await o.H.ackBilan("2026-11-23"), { ok: false, why: "serveur", message: "panne" }, "jamais de rejet");
  const d = await o.H.seanceDebut({ lat: 48.8357, lon: "2.629", acc: 12, club: "lognes", simulee: true });
  egal(sb.appels.at(-1).corps, { p_lat: 48.8357, p_lon: 2.629, p_acc: 12, p_meta: { club: "lognes", simulated: true } });
  assert.equal(d.session.id, 7);
  egal(await o.H.seanceFin(7, { lat: 48.8357, lon: 2.629, acc: 12 }), { ok: false, why: "trop_tot", wait_s: 300 });
  egal(sb.appels.at(-1).corps, { p_session: 7, p_lat: 48.8357, p_lon: 2.629, p_acc: 12, p_meta: {} });
  await o.H.signaler("member", 48213, "insulte");
  egal(sb.appels.at(-1).corps, { p_kind: "member", p_target: "48213", p_reason: "insulte", p_note: null });
});

test("supprimerCompte : delete_account, puis la session et l'état sont oubliés ; un échec rejette", async () => {
  let echec = true;
  const sb = fauxSupabase({ routes: { delete_account: () => (echec ? sb.rep(400, { message: "Le compte admin ne se supprime pas depuis l'appli." }) : sb.rep(200, { ok: true })) } });
  const t = fauxTrousseau();
  const o = onglet({ sb, ls: { "hmg-voter": VOTER }, hmgn: { stockage: t.stockage } });
  await o.H.pret(); await o.H.etat();
  await assert.rejects(o.H.supprimerCompte(), /admin/);
  assert.ok(t.m.has("hmg-auth"));
  echec = false;
  egal(await o.H.supprimerCompte(), { ok: true });
  assert.equal(t.m.has("hmg-auth"), false);
  assert.equal(o.ls("hmg-etat"), null); assert.equal(o.ls("hmg-reprise"), null);
  assert.equal(o.H.etatCache(), null);
  await o.H.etat();
  assert.equal(sb.noms().filter(x => x === "signup").length, 2, "un nouveau compte au prochain appel");
});

test("exporter : my_export plus ce que l'appareil garde, sans la clé hmg-voter", async () => {
  const sb = fauxSupabase({ routes: { my_export: () => sb.rep(200, { exported_at: "x", player: { no: 1 } }) } });
  const o = onglet({ sb, ls: { "hmg-voter": VOTER, "hmg-game": { stars: 2 }, "hmg-objectif": 3, "hmg-ma-salle": "lognes" } });
  const d = await o.H.exporter();
  egal(d.appareil, { jeu: { stars: 2 }, objectif: 3, ma_salle: "lognes", mes_salles: null });
  assert.ok(!JSON.stringify(d).includes(VOTER));
});

test("admin : seulement avec la session admin de js/app.js", async () => {
  const sb = fauxSupabase({ routes: { admin_reports: () => sb.rep(200, []) } });
  const o = onglet({ sb });
  await assert.rejects(o.H.admin("admin_reports", { p_status: "ouvert" }), e => e.hint === "admin");
  const o2 = onglet({ sb, global: { session: { access_token: "jeton-admin", refresh_token: "r", admin: true } } });
  egal(await o2.H.admin("admin_reports", { p_status: "ouvert" }), []);
  assert.equal(sb.appels.at(-1).jeton, "jeton-admin");
});

test("mode démo : le jeu simulé par HMGV, sans aucun appel réseau", async () => {
  const sb = fauxSupabase();
  const o = onglet({ sb, demo: true, ls: { "hmg-jeu-demo": { dossier: null, decalage: 0 } } });
  assert.equal((await o.H.pret()).mode, "demo");
  const e0 = await o.H.etat();
  assert.equal(e0.onboarded, false); assert.equal(e0.contract, 1);
  const r = await o.H.objectif(3, { inscription: true });
  assert.equal(r.ok, true); assert.equal(r.state.onboarded, true); assert.equal(r.state.goal, 3);
  assert.equal((await o.H.maSalle("lognes")).state.home_club, "lognes");
  const s = await o.H.demo.seance();
  assert.equal(s.ok, true, JSON.stringify(s)); assert.equal(s.state.steps, 1); assert.ok(s.state.last_day);
  const proches = await o.H.sallesProches(48.8357, 2.629, 1);
  assert.equal(proches[0].id, "lognes"); assert.equal(proches[0].dist, 0);
  assert.equal((await o.H.chercherSalles("noisy"))[0].id, "noisy");
  const apres = await o.H.demo.avancer(24 * 8);               // le lundi suivant est passé : un bilan à voir
  assert.ok(apres.unseen_bilan, "bilan du lundi");
  assert.ok(["atteint", "sauve", "rate", "malade", "pause", "hibernation", "doux"].includes(apres.unseen_bilan.outcome));
  assert.equal((await o.H.ackBilan(apres.unseen_bilan.week)).state.unseen_bilan, null);
  egal(sb.appels, [], "aucun appel réseau");
  await o.H.supprimerCompte();
  assert.equal((await o.H.etat()).onboarded, false);
  await o.H.demo.couper();
  assert.equal(o.H.statut().mode, "serveur");
});
