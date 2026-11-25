/* Tests du miroir des règles (js/vies-regles.js) : node --test outils/tests/vies.test.js
   Les mêmes scénarios sont joués sur le vrai serveur par supabase/tests/lancer.sh (comparaison JSON). */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const V = require("../../js/vies-regles.js");
const S = require("./scenarios.js");
const O = V.outils;

for (const sc of S.SCENARIOS) {
  test(sc.nom, () => {
    const { fautes } = S.jouerMiroir(V, sc, { seed: "0123456789abcdef0123456789abcdef" });
    assert.deepEqual(fautes, []);
  });
}

// les quêtes sont tirées par la graine : quelle que soit la graine, les règles (cœurs, série, gels) ne bougent pas
test("Profils A à D : mêmes résultats avec 20 graines différentes", () => {
  const profils = S.SCENARIOS.filter(sc => sc.nom.startsWith("Profil"));
  for (let k = 0; k < 20; k++) {
    const seed = (k.toString(16).padStart(2, "0")).repeat(16);
    for (const sc of profils) assert.deepEqual(S.jouerMiroir(V, sc, { seed }).fautes, [], sc.nom + " / " + seed);
  }
});

test("gmHash et gmRng : identiques à ceux de js/app.js (même aventure qu'avant)", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../js/app.js"), "utf8");
  const h = /function gmHash\([^)]*\)\s*\{[^\n]*\}/.exec(src), r = /function gmRng\([^)]*\)\s*\{[^\n]*\}/.exec(src);
  assert.ok(h && r, "gmHash et gmRng introuvables dans js/app.js");
  const app = new Function(h[0] + ";" + r[0] + ";return {gmHash, gmRng};")();
  for (const s of ["", "a", "0123456789abcdef0123456789abcdef:q:2026-11-23", "héros ✓"]) {
    assert.equal(O.gmHash(s), app.gmHash(s), s);
    const a = O.gmRng(O.gmHash(s)), b = app.gmRng(app.gmHash(s));
    for (let i = 0; i < 5; i++) assert.equal(a(), b());
  }
});

test("Objectif effectif de la semaine d'essai (§5.6) et seuil", () => {
  const p = j => ({ first_week: "2026-11-23", reprise_week: null, created_isodow: j });
  assert.equal(O.gEff(p(5), "2026-11-23", 3), 2);            // vendredi, G 3 → ⌈9/7⌉ = 2
  assert.equal(O.gEff(p(7), "2026-11-23", 5), 1);            // dimanche, G 5 → 1
  assert.equal(O.gEff(p(1), "2026-11-23", 4), 4);            // lundi : la semaine entière
  assert.equal(O.gEff(p(4), "2026-11-23", 7), 4);            // ⌈7 × 4/7⌉ = 4 exactement (pas 5 par arrondi)
  assert.deepEqual([2, 3, 4, 5].map(O.safe), [1, 2, 2, 3]);
});

test("Bilan à 3 h, heure locale, y compris au changement d'heure", () => {
  assert.equal(O.bilanJusqua("2026-11-30T01:59:00Z", "Europe/Paris"), "2026-11-16");   // lundi 2 h 59 à Paris
  assert.equal(O.bilanJusqua("2026-11-30T02:00:00Z", "Europe/Paris"), "2026-11-23");   // lundi 3 h 00
  assert.equal(O.bilanJusqua("2027-03-29T00:59:00Z", "Europe/Paris"), "2027-03-15");   // heure d'été : 2 h 59
  assert.equal(O.bilanJusqua("2027-03-29T01:00:00Z", "Europe/Paris"), "2027-03-22");   // 3 h 00 (UTC+2)
  assert.equal(O.bilanJusqua("2026-11-30T06:59:00Z", "America/Guadeloupe"), "2026-11-16");
  assert.equal(O.bilanJusqua("2026-11-30T07:00:00Z", "America/Guadeloupe"), "2026-11-23");
});

test("Pas de serveur : l'état d'un nouveau venu a toutes les clés du contrat §14.10", () => {
  const d = V.nouveau({ seed: "ab".repeat(16) });
  const st = V.etat(d, "2026-11-25T10:00:00+01:00");
  for (const k of ["hearts", "hearts_max", "sick", "conva", "streak", "best_streak", "gels", "stars", "steps", "mus_level", "mus_display",
                   "soft_mode", "goal", "goal_next", "goal_change_from", "week", "session", "today", "pause", "pause_left_52", "quests",
                   "unseen_bilan", "chests", "usual_hour", "points_month", "rank_month", "onboarded"]) assert.ok(k in st, k);
  assert.equal(st.onboarded, false);
  assert.deepEqual(Object.keys(st.week), ["start", "kind", "g", "safe", "v", "c", "s", "days_left", "days"]);
  assert.equal(st.week.start, "2026-11-23");
  assert.equal(st.week.days_left, 5);
});

test("Le dossier du miroir se sauve et se recharge en JSON", () => {
  V.salles(S.SALLES_TEST);
  const d = V.nouveau({ seed: "cd".repeat(16) });
  V.objectif(d, 3, "2026-11-23T08:00:00+01:00");
  const p = S.position("lognes", 0);
  const r = V.debut(d, p, "2026-11-23T18:00:00+01:00");
  V.fin(d, Object.assign({ session: r.session.id }, S.position("lognes", 1)), "2026-11-23T18:40:00+01:00");
  const copie = JSON.parse(JSON.stringify(d));
  assert.deepEqual(V.etat(copie, "2026-11-24T08:00:00+01:00"), V.etat(d, "2026-11-24T08:00:00+01:00"));
});
