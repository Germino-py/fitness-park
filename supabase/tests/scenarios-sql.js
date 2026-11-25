#!/usr/bin/env node
/* =====================================================================================================
   Scénarios croisés : chaque scénario de outils/tests/scenarios.js est joué
     1) sur le vrai serveur (Postgres local jetable, en appelant les RPC comme l'API : rôle authenticated + jeton),
     2) sur le miroir JavaScript js/vies-regles.js (HMGV), avec la même graine et les mêmes salles,
   puis on vérifie les attendus des DEUX côtés et on compare les deux JSON à chaque étape (hors numéros et
   identifiants). Lancé par supabase/tests/lancer.sh (variables PGHOST, PGPORT, PGUSER posées) ; code de sortie 1
   au moindre écart. Aucune dépendance : psql en ligne de commande.
   ===================================================================================================== */
"use strict";
const { spawnSync } = require("child_process");
const path = require("path");
const RACINE = path.resolve(__dirname, "../..");
const V = require(path.join(RACINE, "js/vies-regles.js"));
const S = require(path.join(RACINE, "outils/tests/scenarios.js"));

const q = s => s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'";
const lit = v => v == null ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : q(v);
function psql(script) {
  const r = spawnSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: script, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error((r.stderr || "").trim() || "psql a échoué");
  return r.stdout;
}

// Le script SQL d'un scénario : chaque action écrit une ligne « R<n>\t<json> »
function scriptSql(sc, uid) {
  const L = [`select tests.compte(${q(uid)});`, `select tests.comme(${q(uid)});`, "select app.ensure_player();",
             `select 'SEED' || chr(9) || coalesce(game_seed, voter) from public.players where user_id = ${q(uid)};`, "set role authenticated;"];
  const moi = `(select voter from public.players where user_id = ${q(uid)})`;
  const horloge = t => `select tests.horloge(${q(t)});`;
  const sortie = (i, expr) => `select 'R${i}' || chr(9) || (${expr})::jsonb::text;`;
  const debut = (p, meta) => `public.session_start(${p.lat}, ${p.lon}, ${lit(p.acc)}${meta ? ", " + q(JSON.stringify(meta)) + "::jsonb" : ""})`;
  const fin = p => `public.session_confirm(:sid, ${p.lat}, ${p.lon}, ${lit(p.acc)})`;
  sc.etapes.forEach((e, i) => {
    const [type, t] = e;
    if (S.ACTIONS.includes(type)) L.push(horloge(t));
    switch (type) {
      case "objectif": L.push(sortie(i, `public.set_goal(${lit(e[2])})`)); break;
      case "seance": {
        L.push(`select ${debut(S.position(e[3], 0))}::jsonb::text as r \\gset`);
        if (e[2] == null) { L.push(`select 'R${i}' || chr(9) || :'r';`); break; }
        L.push(`select (:'r'::jsonb ->> 'ok') = 'true' as okd, coalesce(:'r'::jsonb -> 'session' ->> 'id', '0') as sid \\gset`);
        L.push("\\if :okd", horloge(S.plusMinutes(t, e[2])), sortie(i, fin(S.position(e[3], 1))), "\\else", `select 'R${i}' || chr(9) || :'r';`, "\\endif");
        break;
      }
      case "debut": L.push(sortie(i, debut(e[2], e[2].club ? { club: e[2].club } : null))); break;
      case "fin": L.push("select coalesce(tests.derniere_seance(), 0) as sid \\gset", sortie(i, fin(e[2]))); break;
      case "pause": L.push(sortie(i, `public.pause_start('pause', ${lit(e[2])})`)); break;
      case "hiber": L.push(sortie(i, "public.pause_start('hibernation')")); break;
      case "finPause": L.push(sortie(i, "public.pause_end()")); break;
      case "doux": L.push(sortie(i, `public.set_soft_mode(${lit(e[2])})`)); break;
      case "naissance": L.push(sortie(i, `public.set_birth_year(${lit(e[2])})`)); break;
      case "salle": L.push(sortie(i, `public.set_home_club(${lit(e[2])})`)); break;
      case "vu": L.push(sortie(i, `public.ack_bilan(${q(e[2])})`)); break;
      case "coffre": L.push(sortie(i, `public.open_chest(${q(e[2])}, ${lit(!!e[3])})`)); break;
      case "etat": L.push(sortie(i, "public.my_state()")); break;
      case "regler": {
        const set = Object.entries(e[1]).map(([k, v]) => { if (!/^[a-z_]+$/.test(k)) throw new Error("champ " + k); return `${k} = ${lit(v)}`; }).join(", ");
        if (set) L.push("reset role;", `update public.profiles set ${set} where voter = ${moi};`, "set role authenticated;");
        break;
      }
      case "anciens":
        L.push("reset role;", `insert into public.checkins (voter, day, club_id, dist_m, created_at) select ${moi}, v.d::date, v.c, 20, (v.d || 'T12:00:00Z')::timestamptz from (values ${e[1].map(([d, c]) => `(${q(d)}, ${q(c)})`).join(", ")}) v(d, c);`, "set role authenticated;");
        break;
      case "etoiles": L.push("reset role;", `select 'R${i}' || chr(9) || json_build_object('total', coalesce((select sum(delta) from public.star_ledger where voter = ${moi} and reason = ${q(e[1])}), 0))::text;`, "set role authenticated;"); break;
      case "points": L.push("reset role;", `select 'R${i}' || chr(9) || json_build_object('total', coalesce((select sum(points) from public.checkins where voter = ${moi}), 0))::text;`, "set role authenticated;"); break;
      case "verifie": break;
      default: throw new Error("étape inconnue " + type);
    }
  });
  L.push("reset role;");
  return L.join("\n") + "\n";
}

// les différences entre deux JSON (chemins), pour un message lisible
function differences(a, b, p = "") {
  if (S.pareil(a, b)) return [];
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const ks = new Set([...Object.keys(a), ...Object.keys(b)]); let out = [];
    for (const k of ks) out = out.concat(differences(a[k], b[k], p ? p + "." + k : k));
    return out;
  }
  return [`${p || "(racine)"} : serveur ${JSON.stringify(a)} ≠ miroir ${JSON.stringify(b)}`];
}

const TOUR = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
function principal() {
  // 1. les salles de test : les Fitness Park du bouchon (club_geo → gyms) et les salles OSM des scénarios
  const osm = S.SALLES_TEST.filter(g => g.source === "osm");
  psql(`select app.import_gyms(${q(JSON.stringify(osm))}::jsonb);`);
  const enBase = JSON.parse(psql("select coalesce(json_agg(json_build_object('id', id, 'name', name, 'lat', lat, 'lon', lon, 'active', active) order by id), '[]') from public.gyms;"));
  const attendues = S.SALLES_TEST.map(g => ({ id: g.id, name: g.name, lat: g.lat, lon: g.lon, active: g.active !== false })).sort((a, b) => a.id < b.id ? -1 : 1);
  if (!S.pareil(enBase, attendues)) { console.log("   ÉCHEC  les salles de la base ne sont pas celles des scénarios :\n      " + differences(enBase, attendues).join("\n      ")); process.exit(1); }

  let echecs = 0, etapes = 0;
  S.SCENARIOS.forEach((sc, n) => {
    const uid = "00000000-0000-4000-8000-" + TOUR + String(n).padStart(6, "0");   // un compte neuf par scénario et par passage
    const fautes = [];
    let seed = null; const sql = {};
    try {
      for (const ligne of psql(scriptSql(sc, uid)).split("\n")) {
        const [k, v] = ligne.split("\t");
        if (k === "SEED") seed = v; else if (/^R\d+$/.test(k)) sql[+k.slice(1)] = JSON.parse(v);
      }
    } catch (e) { fautes.push("serveur : " + e.message.split("\n").slice(0, 3).join(" ")); }
    let miroir = null;
    try { miroir = S.jouerMiroir(V, sc, { seed, salles: enBase }); } catch (e) { fautes.push("miroir : " + e.message); }
    if (miroir) {
      miroir.fautes.forEach(f => fautes.push("miroir, " + f));
      // les attendus, côté serveur
      let dernier = null;
      sc.etapes.forEach((e, i) => {
        if (e[0] === "verifie") { const f = S.ecarts(dernier, e[1]); if (f.length) fautes.push(`serveur, étape ${i} : ${f.join(" ; ")}`); }
        else if (e[0] === "etoiles" || e[0] === "points") {
          const f = S.ecarts(sql[i], { total: e[0] === "points" ? e[1] : e[2] }); if (f.length) fautes.push(`serveur, étape ${i} (${e[0]}) : ${f.join(" ; ")}`);
        } else if (i in sql) dernier = sql[i];
      });
      // même JSON des deux côtés
      for (const { i, type, r } of miroir.res) {
        etapes++;
        if (!(i in sql)) { fautes.push(`étape ${i} (${type}) : pas de réponse du serveur`); continue; }
        const d = differences(S.normaliser(sql[i]), S.normaliser(r));
        if (d.length) fautes.push(`étape ${i} (${type}) serveur ≠ miroir :\n        ` + d.slice(0, 8).join("\n        "));
      }
    }
    if (fautes.length) { echecs++; console.log(`   ÉCHEC  ${sc.nom}\n      ${fautes.slice(0, 6).join("\n      ")}`); }
    else console.log(`   ok     ${sc.nom}`);
  });
  console.log(`   ${S.SCENARIOS.length - echecs} / ${S.SCENARIOS.length} scénarios identiques et conformes (${etapes} réponses comparées)`);
  process.exit(echecs ? 1 : 0);
}
principal();
