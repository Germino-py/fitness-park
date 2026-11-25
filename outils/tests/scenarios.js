/* =====================================================================================================
   HMG Fitness · scénarios du jeu PARTAGÉS entre le serveur (supabase/03-jeu.sql) et le miroir (js/vies-regles.js)
   - outils/tests/vies.test.js les joue sur le miroir seul (node --test outils/tests/vies.test.js), avec leurs vérifications ;
   - supabase/tests/scenarios-sql.js les joue sur un vrai Postgres ET sur le miroir, vérifie les mêmes choses
     des deux côtés, puis compare les deux JSON étape par étape (même entrée → même sortie).
   Cas du §15 de 1-jeu-vies.md (n° 1 à 26) et profils A à D du §5.11.

   Une étape = un tableau :
     ["objectif", t, g]                     set_goal            ["seance", t, minutes, salle]  début à t, fin à t + minutes
     ["debut", t, {lat, lon, acc, club}]    session_start       (minutes = null : début seulement, elle deviendra « courte »)
     ["fin", t, {lat, lon, acc}]            session_confirm de la dernière séance commencée
     ["pause", t, n] ["hiber", t] ["finPause", t] ["doux", t, oui] ["naissance", t, annee] ["salle", t, id]
     ["vu", t, "AAAA-MM-JJ"] ["coffre", t, cle, vide] ["etat", t]  (= my_state)
     ["regler", {hearts, streak, gels, …}]  pose des valeurs du profil (préparation d'un cas)
     ["anciens", [[jour, salle], …]]        séances du site, d'avant l'appli
     ["verifie", {"chemin.dans.la.reponse": valeur, …}]   sur la réponse de la dernière action
     ["etoiles", raison, total]  ["points", total]          grand livre des étoiles, points des séances validées
   t : instant ISO avec fuseau. T(semaine, jour, "HH:MM") : semaine 0 = celle du lundi 2 novembre 2026, jour 1 à 7.
   ===================================================================================================== */
"use strict";

const pad = n => String(n).padStart(2, "0");
// heure de Paris (l'hiver : +01:00 ; tous les scénarios sont entre novembre 2026 et février 2027)
function T(sem, jour, hm = "18:00") {
  const d = new Date(Date.UTC(2026, 10, 2 + sem * 7 + (jour - 1)));
  return d.toISOString().slice(0, 10) + "T" + hm + ":00+01:00";
}
const L = sem => T(sem, 1).slice(0, 10);                        // le lundi de la semaine sem
const BILAN = sem => T(sem + 1, 1, "09:00");                    // le lundi suivant, après le bilan de 3 h
const S = (sem, jour, hm = "18:00", min = 50, salle = "lognes") => ["seance", T(sem, jour, hm), min, salle];
const COURTE = (sem, jour, hm = "18:00", salle = "lognes") => ["seance", T(sem, jour, hm), null, salle];
const SEM = (sem, jours) => jours.map(j => S(sem, j));          // des séances validées les jours donnés
// inscrit un lundi de la semaine 0, puis la semaine 0 (essai) est bouclée sans séance : prêt pour un cas en semaine 1
// (le gel de la 1re séance est réputé déjà donné : les gels du cas sont ceux du début de semaine)
const PREPARE = (g, champs) => [["objectif", T(0, 1, "10:00"), g], ["etat", BILAN(0)], ["regler", Object.assign({ first_gel_done: true }, champs)]];

// Les salles des scénarios (= table gyms de la base de test) : les 6 Fitness Park du bouchon (club_geo, nom
// donné par le déclencheur) et 3 salles OpenStreetMap ajoutées par app.import_gyms (toutes les salles de France).
const SALLES_TEST = [
  { id: "lognes", name: "Fitness Park Lognes", lat: 48.8354, lon: 2.63 },
  { id: "melun-patton", name: "Fitness Park Melun Patton", lat: 48.5457, lon: 2.6536 },
  { id: "lagny-sur-marne", name: "Fitness Park Lagny Sur Marne", lat: 48.8667, lon: 2.7167 },
  { id: "torcy", name: "Fitness Park Torcy", lat: 48.8502, lon: 2.6508 },
  { id: "guadeloupe-jarry", name: "Fitness Park Guadeloupe Jarry", lat: 16.2674, lon: -61.5854 },
  { id: "guadeloupe-bergevin", name: "Fitness Park Guadeloupe Bergevin", lat: 16.2364, lon: -61.5346 },
  { id: "osm-n1001", name: "Basic-Fit Noisiel", brand: "Basic-Fit", city: "Noisiel", postcode: "77186", lat: 48.8330, lon: 2.6500, source: "osm", osm_ref: "node/1001" },
  { id: "osm-n1002", name: "Club Forme Lognes", city: "Lognes", postcode: "77185", lat: 48.8358, lon: 2.6305, source: "osm", osm_ref: "node/1002" },
  { id: "osm-w1003", name: "Salle fermée", city: "Torcy", lat: 48.8400, lon: 2.6450, source: "osm", osm_ref: "way/1003", active: false }
];

const SCENARIOS = [
  /* ---------------- §15 : le bilan ---------------- */
  { nom: "15.1 G3, 2 cœurs, série 4, 1 gel ; 3 validées → atteint, 3 cœurs, série 5", etapes: [
    ...PREPARE(3, { hearts: 2, streak: 4, gels: 1 }), ...SEM(1, [1, 3, 5]), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "unseen_bilan.hearts_after": 3, "unseen_bilan.streak_after": 5,
                  "hearts": 3, "streak": 5, "gels": 1, "unseen_bilan.ange": true }]] },
  { nom: "15.2 G3, 3 cœurs, série 7, 1 gel ; 3 validées → +10 ⭐, série 8, 2 gels, Flamme bleue", etapes: [
    ...PREPARE(3, { hearts: 3, streak: 7, gels: 1 }), ...SEM(1, [1, 3, 5]), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "hearts": 3, "streak": 8, "gels": 2, "chests[key=palier:8].item": "flamme_bleue" }],
    ["etoiles", "coeur_plein", 10], ["etoiles", "palier", 0]] },
  { nom: "15.3 G3, 3 cœurs, série 11, 2 gels ; 4 validées → +10 ⭐ et +30 ⭐ (gels pleins), série 12", etapes: [
    ...PREPARE(3, { hearts: 3, streak: 11, gels: 2 }), ...SEM(1, [1, 2, 4, 6]), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "streak": 12, "gels": 2 }],
    ["etoiles", "coeur_plein", 10], ["etoiles", "palier", 30]] },
  { nom: "15.4 G4, série 3, 1 gel ; 2 validées → sauvé, gel utilisé, série 3", etapes: [
    ...PREPARE(4, { hearts: 3, streak: 3, gels: 1 }), ...SEM(1, [2, 4]), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "sauve", "unseen_bilan.gel_used": true, "hearts": 3, "streak": 3, "gels": 0, "unseen_bilan.ange": false }]] },
  { nom: "15.5 G4, série 1, 1 gel ; 2 validées → sauvé, série 0, gel gardé", etapes: [
    ...PREPARE(4, { hearts: 3, streak: 1, gels: 1 }), ...SEM(1, [2, 4]), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "sauve", "unseen_bilan.gel_used": false, "streak": 0, "gels": 1 }]] },
  { nom: "15.6 G5, 2 cœurs ; 2 validées → raté (seuil 3), 1 cœur", etapes: [
    ...PREPARE(5, { hearts: 2, streak: 0, gels: 0 }), ...SEM(1, [2, 4]), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "rate", "unseen_bilan.safe": 3, "hearts": 1 }]] },
  { nom: "15.7 G2, 1 cœur, série 5, 1 gel ; 0 séance → raté, 0 cœur, malade, série 0, gel gardé", etapes: [
    ...PREPARE(2, { hearts: 1, streak: 5, gels: 1 }), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "rate", "unseen_bilan.fell_sick": true, "hearts": 0, "sick": true, "streak": 0, "gels": 1,
                  "conva.n": 0, "conva.need": 2, "quests.0.key": "remise" }]] },
  { nom: "15.8 G3 ; 2 validées + 2 courtes → S = 3, atteint, 20 points, 2 pas", etapes: [
    ...PREPARE(3, {}), S(1, 1), COURTE(1, 2), S(1, 4), COURTE(1, 6), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "unseen_bilan.v": 2, "unseen_bilan.c": 2, "unseen_bilan.s": 3, "steps": 2 }],
    ["points", 20]] },
  { nom: "15.9 malade depuis lundi ; 1 validée mardi → bilan « malade », convalescence 1/2", etapes: [
    ...PREPARE(2, { hearts: 1, streak: 0, gels: 0 }), ["etat", BILAN(1)], ["verifie", { sick: true }],
    S(2, 2), ["verifie", { "state.conva.n": 1, "state.sick": true, "state.hearts": 0 }],
    ["etat", BILAN(2)], ["verifie", { "unseen_bilan.outcome": "malade", "hearts": 0, "sick": true, "conva.n": 1 }]] },
  { nom: "15.10 malade ; validées jeudi et samedi → guéri samedi (1 cœur), reprise G = 2 → atteint, 2 cœurs, série 1", etapes: [
    ...PREPARE(3, { hearts: 1, streak: 0, gels: 0 }), ["etat", BILAN(1)], S(2, 4),
    ["verifie", { "state.sick": true, "heal": false }], S(2, 6),
    ["verifie", { "heal": true, "hearts": 1, "state.sick": false, "state.week.kind": "reprise", "state.week.g": 2, "state.phoenix": true }],
    ["etat", BILAN(2)], ["verifie", { "unseen_bilan.outcome": "atteint", "unseen_bilan.kind": "reprise", "hearts": 2, "streak": 1, "healed_count": 1 }]] },
  { nom: "15.11 malade ; validée samedi puis samedi suivant → pas de guérison (fenêtre de 7 jours)", etapes: [
    ...PREPARE(3, { hearts: 1, streak: 0, gels: 0 }), ["etat", BILAN(1)], S(2, 6), S(3, 6),
    ["verifie", { "heal": false, "state.sick": true, "state.conva.n": 1 }]] },
  { nom: "15.12 pause sur la semaine ; 3 validées → pause, cœurs et série gelés, +30 points, +3 pas, pas de quête", etapes: [
    ...PREPARE(3, { hearts: 2, streak: 4, gels: 1 }), ["pause", T(1, 1, "09:30"), 1],
    ["verifie", { "ok": true, "from": L(1), "state.pause.until": L(2), "state.quests": [], "state.pause_left_52": 5 }],
    ...SEM(1, [2, 4, 6]), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "pause", "hearts": 2, "streak": 4, "steps": 3, "pause": null }], ["points", 30]] },
  { nom: "15.13 pause de 2 semaines terminée ; puis 2 validées, G4 → reprise (G = 2) → atteint", etapes: [
    ...PREPARE(4, { hearts: 2, streak: 3, gels: 0 }), ["pause", T(1, 2, "08:00"), 2], ["etat", BILAN(1)], ["etat", BILAN(2)],
    ["verifie", { "week.kind": "reprise", "week.g": 2, "week.safe": 2 }], ...SEM(3, [2, 5]), ["etat", BILAN(3)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "unseen_bilan.kind": "reprise", "hearts": 3, "streak": 4 }]] },
  { nom: "15.14 pause d'1 semaine terminée ; puis 1 validée, G4 → semaine normale → raté, -1 cœur", etapes: [
    ...PREPARE(4, { hearts: 3, streak: 0, gels: 0 }), ["pause", T(1, 3, "08:00"), 1], ["etat", BILAN(1)],
    ["verifie", { "week.kind": "normale" }], S(2, 3), ["etat", BILAN(2)],
    ["verifie", { "unseen_bilan.outcome": "rate", "unseen_bilan.kind": "normale", "hearts": 2 }]] },
  { nom: "15.15 inscription un vendredi, G3 ; 2 validées → essai, G effectif 2, atteint, série 1", etapes: [
    ["objectif", T(0, 5, "09:00"), 3], ["verifie", { "state.week.kind": "essai", "state.week.g": 2, "state.quests.0.key": "premiere" }],
    S(0, 5), S(0, 7, "11:00"), ["etat", BILAN(0)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "unseen_bilan.kind": "essai", "unseen_bilan.g": 2, "streak": 1, "gels": 1 }],
    ["etoiles", "quete", 40]] },
  { nom: "15.16 inscription un dimanche, G5 ; 0 séance → essai, G effectif 1, raté sans perte", etapes: [
    ["objectif", T(0, 7, "09:00"), 5], ["etat", BILAN(0)],
    ["verifie", { "unseen_bilan.outcome": "rate", "unseen_bilan.g": 1, "unseen_bilan.kind": "essai", "hearts": 3, "unseen_bilan.hearts_after": 3 }]] },
  { nom: "15.17 7 validées dans la semaine → 60 points (la 7e vaut 0), 7 pas", etapes: [
    ...PREPARE(3, {}), ...SEM(1, [1, 2, 3, 4, 5, 6]), S(1, 7, "10:00"),
    ["verifie", { "points": 0, "steps": 7 }], ["points", 60], ["etat", BILAN(1)], ["verifie", { "unseen_bilan.v": 7 }]] },
  { nom: "15.18 début dimanche 23 h 40, fin lundi 0 h 30 → comptée dimanche, dans la semaine", etapes: [
    ...PREPARE(3, {}), ["seance", T(1, 7, "23:40"), 50, "lognes"],
    ["verifie", { "ok": true, "state.week.start": L(2), "state.week.v": 0, "state.unseen_bilan.week": L(0) }], ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.week": L(1), "unseen_bilan.v": 1 }]] },
  { nom: "15.19 début 18 h 00, « J'ai fini » à 18 h 12 → trop_tot, 480 s", etapes: [
    ...PREPARE(3, {}), ["seance", T(1, 2, "18:00"), 12, "lognes"], ["verifie", { "ok": false, "why": "trop_tot", "wait_s": 480 }]] },
  { nom: "15.20 début 18 h 00, rien ensuite → « courte » à 21 h 01", etapes: [
    ...PREPARE(3, {}), COURTE(1, 2, "18:00"), ["etat", T(1, 2, "20:59")], ["verifie", { "session.status": "ouverte" }],
    ["etat", T(1, 2, "21:01")], ["verifie", { "session": null, "today.status": "courte", "week.c": 1, "week.s": 1, "week.days.0.st": "courte" }]] },
  { nom: "15.21 « J'ai fini » à 900 m → loin, réessai possible jusqu'à 21 h 00", etapes: [
    ...PREPARE(3, {}), COURTE(1, 2, "18:00"), ["fin", T(1, 2, "18:40"), { lat: 48.8435, lon: 2.63, acc: 20 }],
    ["verifie", { "ok": false, "why": "loin", "until": "2026-11-10T20:00:00Z" }],
    ["fin", T(1, 2, "20:55"), { lat: 48.8356, lon: 2.6301, acc: 25 }], ["verifie", { "ok": true, "points": 10 }]] },
  { nom: "15.21b « J'ai fini » trop tard (après 21 h 00) → expirée, la séance est « courte »", etapes: [
    ...PREPARE(3, {}), COURTE(1, 2, "18:00"), ["fin", T(1, 2, "21:05"), { lat: 48.8356, lon: 2.6301, acc: 25 }],
    ["verifie", { "ok": false, "why": "expiree", "state.today.status": "courte" }]] },
  { nom: "15.22 pause demandée un jeudi → début lundi prochain, la semaine en cours compte normalement", etapes: [
    ...PREPARE(3, { hearts: 3, streak: 2, gels: 0 }), ["pause", T(1, 4, "12:00"), 1],
    ["verifie", { "from": L(2), "state.pause": null, "state.pause_next.start_week": L(2), "state.pause_next.until": L(3) }],
    ["etat", BILAN(1)], ["verifie", { "unseen_bilan.outcome": "rate", "hearts": 2, "pause.start_week": L(2) }]] },
  { nom: "15.23 5 semaines de pause utilisées sur 52, demande de 2 → quota, reste 1", etapes: [
    ...PREPARE(3, {}), ["pause", T(1, 1, "09:30"), 5], ["etat", T(6, 1, "09:00")],
    ["verifie", { "pause_left_52": 1, "pause": null }],
    ["pause", T(6, 2, "08:00"), 2], ["verifie", { "ok": false, "why": "quota", "reste": 1 }],
    ["pause", T(6, 2, "08:01"), 1], ["verifie", { "ok": true, "state.pause_left_52": 0 }]] },
  { nom: "15.24 mode doux, G3 ; 1 validée → « doux », cœurs inchangés", etapes: [
    ...PREPARE(3, { hearts: 2 }), ["doux", T(1, 1, "09:30"), true], ["verifie", { "state.soft_mode": true }], S(1, 3), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "doux", "unseen_bilan.met": false, "hearts": 2, "weeks_ok": 0 }]] },
  { nom: "15.25 bilan rejoué → une seule fois (étoiles comprises)", etapes: [
    ...PREPARE(3, { hearts: 3, streak: 0 }), ...SEM(1, [1, 3, 5]), ["etat", BILAN(1)], ["etat", T(2, 1, "09:05")], ["etat", T(2, 2, "09:00")],
    ["etoiles", "coeur_plein", 10], ["verifie", { "streak": 1, "weeks_ok": 1 }]] },
  { nom: "15.26 Guadeloupe : séance dimanche 20 h locale → dimanche ; bilan lundi 3 h locale", etapes: [
    ["objectif", "2026-11-02T10:00:00-04:00", 3], ["salle", "2026-11-02T10:05:00-04:00", "guadeloupe-jarry"],
    ["verifie", { "state.tz": "America/Guadeloupe", "state.home_club": "guadeloupe-jarry" }],
    ["etat", "2026-11-09T09:00:00-04:00"], ["seance", "2026-11-15T20:00:00-04:00", 45, "guadeloupe-jarry"],
    ["verifie", { "ok": true, "state.today.club": "guadeloupe-jarry", "state.week.days.0.d": "2026-11-15" }],
    ["etat", "2026-11-16T02:30:00-04:00"], ["verifie", { "unseen_bilan.week": "2026-11-02" }],
    ["vu", "2026-11-16T02:31:00-04:00", "2026-11-02"], ["verifie", { "state.unseen_bilan": null }],
    ["etat", "2026-11-16T03:30:00-04:00"], ["verifie", { "unseen_bilan.week": "2026-11-09", "unseen_bilan.v": 1 }]] },

  /* ---------------- §5.11 : les profils sur 4 semaines ---------------- */
  { nom: "Profil A : la régulière (G3), inscrite un lundi", etapes: [
    ["objectif", T(0, 1, "08:00"), 3], ...SEM(0, [1, 3, 5]), ["etat", BILAN(0)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "hearts": 3, "streak": 1, "gels": 1, "steps": 3, "mus_level": 0 }],
    ["etoiles", "coeur_plein", 10], ["etoiles", "quete", 40], ["points", 30],
    ...SEM(1, [1, 2, 4, 6]), ["etat", BILAN(1)], ["verifie", { "unseen_bilan.outcome": "atteint", "streak": 2, "gels": 1, "steps": 7, "mus_level": 1 }], ["points", 70],
    ...SEM(2, [1, 3, 5]), ["etat", BILAN(2)], ["verifie", { "streak": 3, "gels": 1, "steps": 10 }], ["points", 100],
    ...SEM(3, [2, 4, 6]), ["etat", BILAN(3)], ["verifie", { "unseen_bilan.outcome": "atteint", "hearts": 3, "streak": 4, "gels": 2, "steps": 13 }],
    ["points", 130], ["etoiles", "coeur_plein", 40]] },
  { nom: "Profil B : l'irrégulier (G4)", etapes: [
    ["objectif", T(0, 1, "08:00"), 4], ...SEM(0, [1, 2, 4, 6]), ["etat", BILAN(0)], ["verifie", { "unseen_bilan.outcome": "atteint", "streak": 1, "gels": 1 }],
    S(1, 2), COURTE(1, 4), ["etat", BILAN(1)],
    ["verifie", { "unseen_bilan.outcome": "sauve", "unseen_bilan.s": 2, "unseen_bilan.gel_used": false, "hearts": 3, "streak": 0, "gels": 1, "steps": 5 }],
    S(2, 3), ["etat", BILAN(2)], ["verifie", { "unseen_bilan.outcome": "rate", "hearts": 2, "steps": 6 }], ["points", 60],
    ...SEM(3, [1, 2, 3, 5, 6]), ["etat", BILAN(3)], ["verifie", { "unseen_bilan.outcome": "atteint", "hearts": 3, "streak": 1, "steps": 11 }], ["points", 110]] },
  { nom: "Profil C : celle qui décroche puis revient (G3, 22 séances du site, série 6, 1 gel)", etapes: [
    ["anciens", Array.from({ length: 22 }, (_, i) => [T(-8 + Math.floor(i / 3), 1 + 2 * (i % 3)).slice(0, 10), i % 4 ? "lognes" : "torcy"])],
    ["objectif", T(0, 1, "08:00"), 3], ["verifie", { "state.gels": 1, "state.steps": 22, "state.mus_level": 2 }], ["regler", { streak: 6 }],
    ...SEM(0, [2, 4]), ["etat", BILAN(0)], ["verifie", { "unseen_bilan.outcome": "sauve", "unseen_bilan.gel_used": true, "streak": 6, "gels": 0, "hearts": 3 }],
    S(1, 3), ["etat", BILAN(1)], ["verifie", { "unseen_bilan.outcome": "rate", "hearts": 2, "streak": 0 }],
    ["etat", BILAN(2)], ["verifie", { "unseen_bilan.outcome": "rate", "hearts": 1 }],
    ["etat", BILAN(3)], ["verifie", { "unseen_bilan.outcome": "rate", "hearts": 0, "sick": true, "steps": 25, "mus_level": 2, "mus_display": 1, "quests.0.key": "remise" }],
    S(4, 2), ["verifie", { "heal": false, "state.conva.n": 1 }], S(4, 4),
    ["verifie", { "heal": true, "hearts": 1, "state.mus_display": 2, "state.phoenix": true, "state.week.kind": "reprise", "state.week.g": 2 }],
    ["etat", BILAN(4)], ["verifie", { "unseen_bilan.outcome": "atteint", "hearts": 2, "streak": 1, "steps": 27 }],
    ...SEM(5, [1, 3, 5]), ["etat", BILAN(5)], ["verifie", { "unseen_bilan.outcome": "atteint", "hearts": 3, "streak": 2, "steps": 30, "mus_level": 3 }]] },
  { nom: "Profil D : le blessé (G4, série 5, 40 séances)", etapes: [
    ["anciens", Array.from({ length: 40 }, (_, i) => [T(-14 + Math.floor(i / 3), 1 + 2 * (i % 3)).slice(0, 10), "lognes"])],
    ["objectif", T(0, 1, "08:00"), 4], ["regler", { streak: 5 }], ...SEM(0, [1, 2, 4, 6]), ["etat", BILAN(0)],
    ["verifie", { "unseen_bilan.outcome": "atteint", "streak": 6, "hearts": 3, "pause_left_52": 6, "mus_level": 3 }],
    ["pause", T(1, 2, "09:00"), 2], ["verifie", { "state.pause.until": L(3), "state.pause_left_52": 4 }],
    ["etat", BILAN(1)], ["verifie", { "unseen_bilan.outcome": "pause", "streak": 6 }],
    ["etat", BILAN(2)], ["verifie", { "unseen_bilan.outcome": "pause", "streak": 6, "pause": null, "week.kind": "reprise", "week.g": 2 }],
    ...SEM(3, [2, 5]), ["etat", BILAN(3)], ["verifie", { "unseen_bilan.outcome": "atteint", "unseen_bilan.kind": "reprise", "hearts": 3, "streak": 7 }],
    ["etoiles", "coeur_plein", 20]] },

  /* ---------------- autres règles ---------------- */
  { nom: "Objectif : changement pour lundi prochain, puis une demande toutes les 4 semaines après 14 jours", etapes: [
    ["objectif", T(0, 3, "08:00"), 3], ["objectif", T(0, 4, "08:00"), 4], ["verifie", { "state.goal": 4, "state.goal_next": null }],
    ["objectif", T(1, 2, "08:00"), 2], ["verifie", { "state.goal": 4, "state.goal_next": 2 }],
    ["objectif", T(1, 3, "08:00"), 4], ["verifie", { "ok": true, "state.goal": 4, "state.goal_next": null }],
    ["objectif", T(2, 3, "08:00"), 5], ["verifie", { "ok": false, "why": "trop_tot", "next_date": "2026-12-08" }],
    ["objectif", T(2, 3, "08:01"), 4], ["verifie", { "ok": true, "state.goal_next": null, "state.goal": 4, "state.goal_change_from": "2026-12-08" }],
    ["objectif", T(2, 3, "08:02"), 9], ["verifie", { "ok": false, "why": "hors_limites" }]] },
  { nom: "Séance : une seule par jour, hors rayon, précision, pas d'objectif", etapes: [
    ["debut", T(0, 1, "09:00"), { lat: 48.8354, lon: 2.63, acc: 20 }], ["verifie", { "ok": false, "why": "objectif" }],
    ["objectif", T(0, 1, "10:00"), 3],
    ["debut", T(0, 1, "11:00"), { lat: 48.8354, lon: 2.60, acc: 20 }], ["verifie", { "ok": false, "why": "loin", "club": "lognes", "dist": 2196 }],
    ["debut", T(0, 1, "11:01"), { lat: 48.8354, lon: 2.63, acc: 400 }], ["verifie", { "ok": false, "why": "precision", "acc": 400 }],
    S(0, 1, "12:00"), ["verifie", { "ok": true, "points": 10, "chest_due": false }],
    ["debut", T(0, 1, "19:00"), { lat: 48.8355, lon: 2.6301, acc: 20 }], ["verifie", { "ok": false, "why": "deja", "club": "lognes" }],
    ["etat", T(0, 1, "19:05")], ["verifie", { "today.status": "validee", "today.club": "lognes", "week.days.0.d": L(0) }]] },
  { nom: "Toutes les salles de France : une salle OpenStreetMap vaut une Fitness Park ; la salle proposée par l'appli", etapes: [
    ["objectif", T(0, 1, "10:00"), 2], S(0, 2, "18:00", 50, "osm-n1001"),
    ["verifie", { "ok": true, "state.today.club": "osm-n1001", "state.today.club_name": "Basic-Fit Noisiel" }],
    ["debut", T(0, 3, "18:00"), { lat: 48.83535, lon: 2.63005, acc: 30, club: "osm-n1002" }],
    ["verifie", { "ok": true, "club": "osm-n1002" }],
    ["debut", T(0, 4, "18:00"), { lat: 48.8701, lon: 2.6, acc: 20 }], ["verifie", { "ok": false, "why": "loin" }]] },
  { nom: "Hibernation : série à 0, une séance la termine en fin de semaine, puis reprise si 2 semaines ou plus", etapes: [
    ...PREPARE(3, { hearts: 2, streak: 5, gels: 1 }), ["hiber", T(1, 1, "09:30")],
    ["verifie", { "ok": true, "state.streak": 0, "state.pause.kind": "hibernation", "state.pause.until": null }],
    ["etat", BILAN(1)], ["verifie", { "unseen_bilan.outcome": "hibernation", "hearts": 2 }],
    S(2, 3), ["etat", BILAN(2)], ["verifie", { "unseen_bilan.outcome": "hibernation", "pause": null, "week.kind": "reprise" }]] },
  { nom: "Fin de pause anticipée : la semaine en cours reste couverte, la suite est rendue au quota", etapes: [
    ...PREPARE(3, {}), ["pause", T(1, 2, "08:00"), 4], ["verifie", { "state.pause_left_52": 2 }],
    ["finPause", T(1, 3, "08:00")], ["verifie", { "ok": true, "state.pause.until": L(2), "state.pause_left_52": 5 }],
    ["etat", BILAN(1)], ["verifie", { "unseen_bilan.outcome": "pause", "pause": null }],
    ["finPause", T(2, 2, "08:00")], ["verifie", { "ok": false, "why": "aucune" }]] },
  { nom: "Mineur : 16 ans → mode doux imposé, pas de retour aux cœurs ; moins de 15 ans refusé", etapes: [
    ["objectif", T(0, 1, "10:00"), 3], ["naissance", T(0, 1, "10:01"), 2020], ["verifie", { "ok": false, "why": "age" }],
    ["naissance", T(0, 1, "10:02"), 2010], ["verifie", { "ok": true, "state.soft_mode": true, "state.minor": true }],
    ["doux", T(0, 1, "10:03"), false], ["verifie", { "ok": false, "why": "mineur" }]] },
  { nom: "Coffres : semaine (3 quêtes), pas:N, vide → étoiles une seule fois ; bilan vu", etapes: [
    ["objectif", T(0, 1, "08:00"), 3], ["verifie", { "state.chests.0.key": "pionnier" }],
    ["coffre", T(0, 1, "08:05"), "pionnier", false], ["verifie", { "ok": true, "item": "echarpe_pionnier", "already": false, "state.chests": [] }],
    ["coffre", T(0, 1, "08:06"), "pas:3", true], ["verifie", { "ok": false, "why": "introuvable" }],
    ...SEM(0, [1, 3, 5]), ["coffre", T(0, 5, "20:00"), "pas:3", true], ["verifie", { "ok": true, "stars": 25 }],
    ["coffre", T(0, 5, "20:01"), "pas:3", true], ["verifie", { "ok": true, "stars": 0 }],
    ["etat", BILAN(0)], ["vu", T(1, 1, "09:01"), L(0)], ["verifie", { "state.unseen_bilan": null }]] }
];

/* ---------------- outils communs aux deux lanceurs ---------------- */
// lire(o, "state.week.days.0.d") ; un segment « chests[key=palier:8] » prend l'élément du tableau dont key vaut palier:8
function lire(o, chemin) {
  for (const seg of chemin.split(".")) {
    if (o == null) return undefined;
    const m = /^(\w+)\[(\w+)=([^\]]*)\]$/.exec(seg);
    if (m) { const t = o[m[1]]; o = Array.isArray(t) ? t.find(x => x && String(x[m[2]]) === m[3]) : undefined; }
    else o = o[seg];
  }
  return o;
}
const pareil = (a, b) => JSON.stringify(trier(a)) === JSON.stringify(trier(b));
function trier(o) {                                   // clés dans l'ordre alphabétique (comparaison sans tenir compte de l'ordre)
  if (Array.isArray(o)) return o.map(trier);
  if (o && typeof o === "object") { const r = {}; Object.keys(o).sort().forEach(k => { r[k] = trier(o[k]); }); return r; }
  return o;
}
// ce qui dépend de la base et pas des règles (numéros, identifiants, graine, rang parmi les autres joueurs)
const VARIABLES = ["id", "no", "seed", "pseudo", "rank_month", "banned", "player"];
function normaliser(o) {
  if (Array.isArray(o)) return o.map(normaliser);
  if (o && typeof o === "object") { const r = {}; for (const k of Object.keys(o)) if (!VARIABLES.includes(k)) r[k] = normaliser(o[k]); return r; }
  return o;
}
// les vérifications d'une étape « verifie » sur une réponse : liste des écarts (vide = tout bon)
function ecarts(reponse, attendu) {
  const out = [];
  for (const [ch, v] of Object.entries(attendu)) { const r = lire(reponse, ch); if (!pareil(r, v)) out.push(`${ch} : reçu ${JSON.stringify(r)}, attendu ${JSON.stringify(v)}`); }
  return out;
}
// positions d'une séance : un peu à côté de la salle (début, puis fin)
const position = (id, k) => { const g = SALLES_TEST.find(x => x.id === id); if (!g) throw new Error("salle inconnue " + id);
  return { lat: +(g.lat + 0.0002 + 0.0001 * k).toFixed(6), lon: +(g.lon + 0.0001).toFixed(6), acc: 20 }; };
const plusMinutes = (t, m) => new Date(Date.parse(t) + m * 60e3).toISOString();
const ACTIONS = ["objectif", "seance", "debut", "fin", "pause", "hiber", "finPause", "doux", "naissance", "salle", "vu", "coffre", "etat"];

// Joue un scénario sur le miroir HMGV. Rend [{i, type, r}] (une entrée par action ou relevé) et les écarts des « verifie ».
function jouerMiroir(V, sc, opts) {
  opts = opts || {};
  V.salles(SALLES_TEST);
  const d = V.nouveau({ seed: opts.seed || "0123456789abcdef0123456789abcdef", no: 12345 });
  const res = [], fautes = []; let dernier = null, avant = 0;
  const heure = t => { const x = Date.parse(t); if (!(x >= avant)) throw new Error(`${sc.nom} : le temps recule à ${t}`); avant = x; return t; };
  sc.etapes.forEach((e, i) => {
    const [type, t] = e; let r;
    switch (type) {
      case "objectif": r = V.objectif(d, e[2], heure(t)); break;
      case "seance": {
        r = V.debut(d, position(e[3], 0), heure(t));
        if (e[2] != null && r.ok) r = V.fin(d, Object.assign({ session: r.session.id }, position(e[3], 1)), heure(plusMinutes(t, e[2])));
        break;
      }
      case "debut": r = V.debut(d, e[2], heure(t)); break;
      case "fin": { const s = d.sessions.slice().sort((a, b) => a.id - b.id).pop(); r = V.fin(d, Object.assign({ session: s ? s.id : 0 }, e[2]), heure(t)); break; }
      case "pause": r = V.pause(d, "pause", e[2], heure(t)); break;
      case "hiber": r = V.pause(d, "hibernation", null, heure(t)); break;
      case "finPause": r = V.finPause(d, heure(t)); break;
      case "doux": r = V.doux(d, e[2], heure(t)); break;
      case "naissance": r = V.naissance(d, e[2], heure(t)); break;
      case "salle": r = V.salle(d, e[2], heure(t)); break;
      case "vu": r = V.vu(d, e[2], heure(t)); break;
      case "coffre": r = V.coffre(d, e[2], e[3], heure(t)); break;
      case "etat": r = V.etat(d, heure(t)); break;
      case "regler": V.regler(d, e[1]); return;
      case "anciens": e[1].forEach(([j, c]) => d.checkins.push({ day: j, club_id: c, points: 10, created_at: j + "T12:00:00Z", started_at: null, flags: [] })); return;
      case "etoiles": r = { total: d.stars.filter(x => x.reason === e[1]).reduce((a, x) => a + x.delta, 0) }; break;
      case "points": r = { total: d.checkins.reduce((a, x) => a + x.points, 0) }; break;
      case "verifie": { const f = ecarts(dernier, e[1]); if (f.length) fautes.push(`étape ${i} : ${f.join(" ; ")}`); return; }
      default: throw new Error("étape inconnue " + type);
    }
    r = JSON.parse(JSON.stringify(r));
    if (type === "etoiles" || type === "points") {
      const f = ecarts(r, { total: type === "points" ? e[1] : e[2] }); if (f.length) fautes.push(`étape ${i} (${type} ${type === "points" ? "" : e[1]}) : ${f.join(" ; ")}`);
    }
    else dernier = r;
    res.push({ i, type, r });
  });
  return { res, fautes, dossier: d };
}

module.exports = { SCENARIOS, SALLES_TEST, T, L, BILAN, lire, pareil, normaliser, ecarts, position, plusMinutes, jouerMiroir, ACTIONS };
