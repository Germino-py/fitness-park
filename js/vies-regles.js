/* =====================================================================================================
   HMG Fitness · js/vies-regles.js · global HMGV
   Miroir JavaScript PUR des règles du jeu côté serveur (supabase/03-jeu.sql, règles de 1-jeu-vies.md) :
   semaine en heure de Paris (ou du fuseau du profil), objectif effectif G (essai, reprise), bilan du lundi 3 h,
   cœurs, maladie et guérison, gels, pauses et hibernation, mode doux, quêtes, étoiles, coffres.
   Il produit LE MÊME JSON que my_state() (mêmes clés, mêmes valeurs) : il sert au mode démo (sans serveur),
   à l'affichage hors connexion et aux tests. Les scénarios croisés de supabase/tests/lancer.sh jouent les mêmes
   actions ici et sur un vrai Postgres et comparent les deux JSON.
   Le serveur fait foi : ce fichier ne décide de rien quand on est connecté.

   Utilisation (aucune dépendance, aucune horloge cachée : chaque fonction reçoit « maintenant ») :
     const d = HMGV.nouveau({ seed: "…32 hex…", no: 12345 });   // un « dossier » = toutes les données d'un joueur (JSON)
     HMGV.salles([{ id: "lognes", name: "…", lat: 48.8354, lon: 2.63 }, …]); // les salles (= table gyms), ou salles(CLUBS, PRE)
     HMGV.objectif(d, 3, maintenant)                → { ok, state }           (= set_goal)
     HMGV.debut(d, { lat, lon, acc }, maintenant)   → { ok, session, state }  (= session_start)
     HMGV.fin(d, { session, lat, lon, acc }, m)     → { ok, points, … }       (= session_confirm)
     HMGV.pause(d, "pause" | "hibernation", n, m)  /  HMGV.finPause(d, m)
     HMGV.doux(d, oui, m)  /  HMGV.naissance(d, annee, m)  /  HMGV.salle(d, id, m)
     HMGV.vu(d, "AAAA-MM-JJ", m)  (= ack_bilan)  /  HMGV.coffre(d, cle, vide, m)  (= open_chest)
     HMGV.etat(d, maintenant)                       → le JSON de my_state()
   « maintenant » : un Date, un nombre (ms) ou une chaîne ISO. Le dossier est modifié sur place (JSON.stringify-able).
   ===================================================================================================== */
(function (racine) {
  "use strict";

  /* ---------- réglages (= game_config, 03-jeu.sql §1) ---------- */
  const CFG = {
    hearts_max: 3, hearts_start: 3, goal_min: 2, goal_max: 5, goal_default: 3, goal_change_days: 28, goal_free_change_days: 14,
    session_min_minutes: 20, session_max_minutes: 180, radius_base_m: 200, radius_acc_bonus_max_m: 100, acc_max_m: 150,
    points_per_session: 10, points_max_sessions_per_week: 6, courte_max_per_week: 1,
    gels_max: 2, gel_min_streak: 2, gel_every_streak_weeks: 4, gel_price_stars: 150,
    stars_full_heart: 10, stars_milestone_overflow: 30, stars_empty_chest: 25, stars_empty_big_chest: 50, stars_week_chest_full: 40,
    stars_per_old_star: 25, heal_sessions: 2, heal_window_days: 7, heal_hearts: 1,
    pause_weeks_per_52: 6, pause_same_week_until_isodow: 3, reprise_after_pause_weeks: 2, settle_hour_local: 3,
    quest_rewards: { tot: 10, matin: 10, meme_heure: 15, weekend: 10, repos: 15, fidele: 15, explo: 25, objectif: 20, remise: 10, premiere: 20 },
    week_chest_odds: { R: 0.60, E: 0.30, L: 0.10 },
    streak_items: { 8: "flamme_bleue", 26: "echarpe_six_mois", 52: "couronne_fer" },
    mus_thresholds: [0, 5, 15, 30, 50, 80],
    adult_age: 18, min_age: 15, start_refused_per_day: 8, pionnier_until: null
  };
  const PARIS = "Europe/Paris";
  const QA = ["tot", "matin", "meme_heure", "weekend"];

  /* ---------- temps : dates « AAAA-MM-JJ », instants en ms, fuseaux par Intl ---------- */
  const ms = t => t instanceof Date ? t.getTime() : typeof t === "number" ? t : Date.parse(t);
  const iso = t => new Date(ms(t)).toISOString().replace(/\.\d{3}Z$/, "Z");          // = app.iso()
  const FMT = {};
  function parts(t, tz) {                                    // heure locale (mur) dans le fuseau tz
    const f = FMT[tz] || (FMT[tz] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const o = {}; for (const p of f.formatToParts(new Date(ms(t)))) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, H: +o.hour % 24, M: +o.minute, S: +o.second };
  }
  const pad = n => String(n).padStart(2, "0");
  const ds = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
  const jourLocal = (t, tz) => { const p = parts(t, tz); return ds(p.y, p.m, p.d); };
  const minutesLocal = (t, tz) => { const p = parts(t, tz); return p.H * 60 + p.M; };
  const heureLocale = (t, tz) => parts(t, tz).H;
  const plus = (j, n) => { const x = new Date(j + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const ecart = (a, b) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 864e5);   // a − b en jours
  const isodow = j => { const w = new Date(j + "T00:00:00Z").getUTCDay(); return w === 0 ? 7 : w; };
  const lundi = j => plus(j, -(isodow(j) - 1));
  function semaineIso(j) {                                   // numéro de semaine ISO (= extract(week from …))
    const x = new Date(j + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 4 - isodow(j));
    const a = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - a) / 864e5 + 1) / 7);
  }
  // dernier lundi dont le bilan est possible : le bilan de la semaine W s'ouvre le lundi W+7 à 3 h, heure locale
  function bilanJusqua(t, tz) {
    const p = parts(t, tz), mur = Date.UTC(p.y, p.m - 1, p.d, p.H, p.M, p.S) - CFG.settle_hour_local * 3600e3;
    return plus(lundi(new Date(mur).toISOString().slice(0, 10)), -7);
  }
  const anneeUTC = t => new Date(ms(t)).getUTCFullYear();

  /* ---------- hasard déterministe : copie exacte de gmHash / gmRng de js/app.js (= app.gm_hash / app.gm_rng) ---------- */
  function gmHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function gmRng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- géographie (= app.dist_m, app.tz_for) ---------- */
  const rad = x => x * Math.PI / 180;
  function distM(lat1, lon1, lat2, lon2) {
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(Math.pow(Math.sin(rad(lat2 - lat1) / 2), 2)
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.pow(Math.sin(rad(lon2 - lon1) / 2), 2))));
  }
  const entre = (x, a, b) => x >= a && x <= b;
  function tzPour(lat, lon) {
    if (entre(lat, 15.8, 16.6) && entre(lon, -61.9, -60.9)) return "America/Guadeloupe";
    if (entre(lat, 14.3, 14.95) && entre(lon, -61.3, -60.75)) return "America/Martinique";
    if (entre(lat, 2, 6) && entre(lon, -55, -51)) return "America/Cayenne";
    if (entre(lat, -21.5, -20.8) && entre(lon, 55.1, 56)) return "Indian/Reunion";
    if (entre(lat, -13.1, -12.6) && entre(lon, 44.9, 45.4)) return "Indian/Mayotte";
    return PARIS;
  }
  // Les salles (= table gyms) : [{id, name, lat, lon, active}] (gyms_near, ou CLUBS + PRE de js/data/clubs.js :
  // {id, n, s} avec la position à part) ou {id: [lat, lon]} (format PRE). active === false : plus de nouvelle séance.
  let SALLES = [], PAR_ID = {};
  function salles(liste, positions) {
    if (liste && !Array.isArray(liste)) liste = Object.keys(liste).map(id => ({ id, lat: liste[id][0], lon: liste[id][1] }));
    SALLES = (liste || []).map(s => {
      const q = positions && positions[s.id], lat = s.lat != null ? s.lat : q && q[0], lon = s.lon != null ? s.lon : q && q[1];
      return { id: s.id, name: s.name || s.n || null, lat: +lat, lon: +lon, active: s.active !== false && !s.s,
               tz: s.tz || tzPour(+lat, +lon) };
    }).filter(s => s.id && lat_ok(s.lat) && lon_ok(s.lon));
    PAR_ID = {}; SALLES.forEach(s => { PAR_ID[s.id] = s; });
    return SALLES.length;
  }
  function lat_ok(x) { return isFinite(x) && x >= -90 && x <= 90; }
  function lon_ok(x) { return isFinite(x) && x >= -180 && x <= 180; }
  const salleDe = id => PAR_ID[id] || null;
  const nomDe = id => { const s = salleDe(id); return s ? s.name : null; };

  /* ---------- le dossier d'un joueur ---------- */
  function hex32() { let s = ""; for (let i = 0; i < 32; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)]; return s; }
  function nouveau(o) {
    o = o || {};
    return { version: 1, voter: o.voter || hex32(), seed: o.seed || null, no: o.no || null, pseudo: o.pseudo || null,
             profile: null, goals: [], checkins: [], sessions: [], attempts: [], weeks: [], pauses: [], quests: [],
             stars: [], chests: [], nextId: 1 };
  }
  const graine = d => d.seed || d.voter;
  const safe = g => Math.floor((g + 1) / 2);                   // 2→1, 3→2, 4→2, 5→3
  const ceilExact = x => Math.ceil(Math.round(x * 1e9) / 1e9);
  function goalAt(d, w) {
    let best = null; for (const g of d.goals) if (g.effective_week <= w && (!best || g.effective_week > best.effective_week)) best = g;
    return best ? best.goal : CFG.goal_default;
  }
  const weekKind = (p, w) => w === p.first_week ? "essai" : w === p.reprise_week ? "reprise" : "normale";
  function gEff(p, w, g) {
    const k = weekKind(p, w);
    return k === "essai" ? Math.max(1, ceilExact(g * (8 - p.created_isodow) / 7)) : k === "reprise" ? safe(g) : g;
  }
  const safeEff = (k, ge) => k === "reprise" ? ge : safe(ge);
  const aJour = (d, j) => d.checkins.some(c => c.day === j);
  const vCount = (d, w) => d.checkins.filter(c => c.day >= w && c.day < plus(w, 7)).length;
  const cCount = (d, w) => d.sessions.filter(s => s.week === w && s.status === "courte" && !aJour(d, s.day)).length;
  function counted(d) {                                       // validées + au plus 1 courte par semaine
    const out = d.checkins.map(c => ({ day: c.day, st: "validee" })), parSem = {};
    d.sessions.filter(s => s.status === "courte" && !aJour(d, s.day)).sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0)
      .forEach(s => { parSem[s.week] = (parSem[s.week] || 0) + 1; if (parSem[s.week] <= CFG.courte_max_per_week) out.push({ day: s.day, st: "courte" }); });
    return out;
  }
  function pauseAt(d, w) {
    let best = null;
    for (const z of d.pauses) if (z.start_week <= w && (z.end_week == null || w <= z.end_week) && (!best || z.start_week > best.start_week)) best = z;
    return best;
  }
  function pauseUsed52(d, cw) {
    const lo = plus(cw, -357), hi = plus(cw, 364), vues = new Set();
    for (const z of d.pauses) if (z.kind === "pause") for (let w = z.start_week; w <= z.end_week; w = plus(w, 7)) if (w >= lo && w <= hi) vues.add(w);
    return vues.size;
  }
  function star(d, delta, reason, ref) {
    if (!delta) return 0;
    if (d.stars.some(s => s.reason === reason && s.ref === ref)) return 0;
    d.stars.push({ delta, reason, ref }); return delta;
  }
  const musLevel = n => Math.max(0, CFG.mus_thresholds.filter(t => t <= n).length - 1);
  const isMinor = (by, t) => by != null && anneeUTC(t) - by < CFG.adult_age;
  const tsSeance = c => c.started_at || c.created_at;

  /* ---------- guérison, séances expirées (= app.after_counted, app.expire_open) ---------- */
  function afterCounted(d, jour) {
    const p = d.profile; if (!p || !p.sick_since) return false;
    const n = counted(d).filter(c => c.day >= p.sick_since && c.day >= plus(jour, -(CFG.heal_window_days - 1)) && c.day <= jour).length;
    if (n < CFG.heal_sessions) return false;
    p.hearts = Math.min(CFG.hearts_max, CFG.heal_hearts); p.sick_since = null; p.healed_count++; p.reprise_week = lundi(jour); p.phoenix = true;
    return true;
  }
  function expireOpen(d, t) {
    d.sessions.filter(s => s.status === "ouverte" && ms(s.started_at) + CFG.session_max_minutes * 60e3 < ms(t))
      .sort((a, b) => ms(a.started_at) - ms(b.started_at))
      .forEach(s => { s.status = "courte"; afterCounted(d, s.day); });
  }

  /* ---------- quêtes (= app.quest_done, app.ensure_quests, app.refresh_quests) ---------- */
  function weekDone(d, w, tz) {
    return d.checkins.filter(c => c.day >= w && c.day < plus(w, 7)).map(c => ({ day: c.day, club: c.club_id, m: minutesLocal(tsSeance(c), tz) }));
  }
  function questDone(d, w, k) {
    const p = d.profile, q = weekDone(d, w, p.tz);
    switch (k) {
      case "premiere": return q.length >= 1;
      case "tot": return q.some(x => x.day <= plus(w, 2));
      case "matin": return q.some(x => x.m >= 300 && x.m < 600);
      case "weekend": return q.some(x => x.day >= plus(w, 5));
      case "meme_heure": return q.some(a => q.some(b => a.day < b.day && Math.abs(a.m - b.m) < 60));
      case "repos": { const j = q.map(x => x.day).sort(); for (let i = 1; i < j.length; i++) if (ecart(j[i], j[i - 1]) >= 2) return true; return false; }
      case "fidele": return p.home_club_id != null && q.filter(x => x.club === p.home_club_id).length >= 2;
      case "explo": return q.some(x => !d.checkins.some(c => c.club_id === x.club && c.day < w));
      case "objectif": return q.length >= gEff(p, w, goalAt(d, w));
      case "remise": return p.reprise_week === w && p.sick_since == null;
    }
    return false;
  }
  function ensureQuests(d, w) {
    const p = d.profile;
    if (d.quests.some(q => q.week === w)) return;
    if (!p || w < p.first_week || pauseAt(d, w)) return;
    const R = CFG.quest_rewards, rng = gmRng(gmHash(graine(d) + ":q:" + w)), r1 = rng(), r2 = rng();
    const add = (slot, k) => d.quests.push({ week: w, slot, quest_key: k, reward: R[k], done_at: null });
    if (w === p.first_week) { add(1, "premiere"); add(3, "objectif"); return; }
    const prev = (d.quests.find(q => q.week === plus(w, -7) && q.slot === 1) || {}).quest_key;
    let a;
    if (p.sick_since) a = "remise";
    else { const pa = QA.filter(k => k !== prev); a = pa[Math.floor(r1 * pa.length)]; }
    let pb = ["repos", "weekend"];
    if (p.home_club_id != null) {
      pb.push("fidele");
      const h = salleDe(p.home_club_id);
      if (semaineIso(w) % 4 === gmHash(graine(d)) % 4 && h && SALLES.some(o => o.id !== h.id && o.active && distM(h.lat, h.lon, o.lat, o.lon) < 20000)) pb.push("explo");
    }
    pb = pb.filter(k => k !== a);
    const b = pb[Math.floor(r2 * pb.length)];
    add(1, a); add(2, b); add(3, "objectif");
  }
  function refreshQuests(d, w, t) {
    if (!d.profile || pauseAt(d, w)) return;
    d.quests.filter(q => q.week === w && !q.done_at).sort((a, b) => a.slot - b.slot).forEach(q => {
      if (questDone(d, w, q.quest_key)) { q.done_at = iso(t); star(d, q.reward, "quete", w + ":" + q.slot); }
    });
    if (d.quests.filter(q => q.week === w && q.done_at).length === 3 && !d.chests.some(c => c.chest_key === "semaine:" + w))
      d.chests.push({ chest_key: "semaine:" + w, kind: "semaine", item_id: null, granted_at: iso(t), opened_at: null });
  }

  /* ---------- le bilan du lundi (= app.settle_week, app.settle_due, app.touch) ---------- */
  function settleWeek(d, w, t) {
    if (d.weeks.some(x => x.week === w)) return;
    const p = d.profile; if (!p || w < p.first_week) return;
    expireOpen(d, t);
    refreshQuests(d, w, t);
    const g = goalAt(d, w), k = weekKind(p, w), ge = gEff(p, w, g), se = safeEff(k, ge);
    const nv = vCount(d, w), nc = cCount(d, w), s = nv + Math.min(CFG.courte_max_per_week, nc), pz = pauseAt(d, w);
    const hb = p.hearts, sb = p.streak, gb = p.gels;
    let h = hb, st = sb, gl = gb, wok = p.weeks_ok, best = p.best_streak, sick = p.sick_since, rep = p.reprise_week;
    let extra = 0, gelUsed = false, fell = false, outcome; const met = s >= ge;
    if (p.soft_mode) { outcome = "doux"; if (met) wok++; }
    else if (pz && pz.kind === "pause") outcome = "pause";
    else if (pz && pz.kind === "hibernation") { outcome = "hibernation"; if (nv >= 1) pz.end_week = w; }
    else if (h === 0) outcome = "malade";
    else if (met) {
      outcome = "atteint"; wok++;
      if (h < CFG.hearts_max) h++; else extra += star(d, CFG.stars_full_heart, "coeur_plein", w);
      st++;
      if (st % CFG.gel_every_streak_weeks === 0) { if (gl < CFG.gels_max) gl++; else extra += star(d, CFG.stars_milestone_overflow, "palier", w); }
      const item = CFG.streak_items[st];
      if (item && !d.chests.some(c => c.chest_key === "palier:" + st)) d.chests.push({ chest_key: "palier:" + st, kind: "palier", item_id: item, granted_at: iso(t), opened_at: null });
    } else {
      outcome = s >= se ? "sauve" : "rate";
      if (outcome === "rate" && k === "normale") h--;
      if (h === 0) { st = 0; sick = plus(w, 7); fell = true; }
      else if (st >= CFG.gel_min_streak && gl > 0) { gl--; gelUsed = true; }
      else st = 0;
    }
    best = Math.max(best, st);
    if (pz && pz.end_week === w && ecart(w, pz.start_week) / 7 + 1 >= CFG.reprise_after_pause_weeks) rep = plus(w, 7);
    const qs = d.stars.filter(x => x.reason === "quete" && x.ref.startsWith(w + ":")).reduce((a, x) => a + x.delta, 0);
    d.weeks.push({ week: w, goal: g, goal_eff: ge, safe: se, v_count: nv, c_count: nc, s_count: s, outcome, met, kind: k,
                   hearts_before: hb, hearts_after: h, streak_before: sb, streak_after: st, gel_used: gelUsed, gels_after: gl,
                   stars_earned: extra + qs, fell_sick: fell, seen_at: null });
    Object.assign(p, { hearts: h, streak: st, best_streak: best, gels: gl, weeks_ok: wok, sick_since: sick, reprise_week: rep, last_settled_week: w });
  }
  function settleDue(d, t) {
    const p = d.profile; if (!p) return;
    const upto = bilanJusqua(t, p.tz);
    for (let w = p.last_settled_week ? plus(p.last_settled_week, 7) : p.first_week; w <= upto; w = plus(w, 7)) settleWeek(d, w, t);
  }
  function touch(d, t) {
    expireOpen(d, t); settleDue(d, t);
    if (!d.profile) return;
    const cw = lundi(jourLocal(t, d.profile.tz)); ensureQuests(d, cw); refreshQuests(d, cw, t);
  }

  /* ---------- points plafonnés (= app.capped_points, sans le classement des autres) ---------- */
  function pointsDepuis(d, depuis) {
    const parSem = {}, tri = d.checkins.slice().sort((a, b) => ms(tsSeance(a)) - ms(tsSeance(b)) || (a.day < b.day ? -1 : 1));
    let n = 0;
    for (const c of tri) { const w = lundi(c.day); parSem[w] = (parSem[w] || 0) + 1; if (c.day >= depuis && parSem[w] <= CFG.points_max_sessions_per_week) n += c.points; }
    return n;
  }

  /* ---------- l'état (= app.state_json / my_state) ---------- */
  function sessionJson(s) {
    return { id: s.id, status: s.status, started_at: iso(s.started_at),
             confirm_from: iso(ms(s.started_at) + CFG.session_min_minutes * 60e3),
             confirm_until: iso(ms(s.started_at) + CFG.session_max_minutes * 60e3), club: s.club_id, club_name: nomDe(s.club_id) };
  }
  function stateJson(d, t) {
    const p = d.profile, hasP = !!p, tz = hasP ? p.tz : PARIS, today = jourLocal(t, tz), cw = lundi(today), isod = isodow(today);
    const mois = today.slice(0, 8) + "01", steps = d.checkins.length, stars = d.stars.reduce((a, x) => a + x.delta, 0), lvl = musLevel(steps);
    const nv = vCount(d, cw), nc = cCount(d, cw), s = nv + Math.min(CFG.courte_max_per_week, nc);
    const days = d.checkins.filter(c => c.day >= cw && c.day < plus(cw, 7)).map(c => ({ d: c.day, st: "validee" }))
      .concat(d.sessions.filter(x => x.week === cw && x.status === "courte" && !aJour(d, x.day)).map(x => ({ d: x.day, st: x.status })))
      .sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    const ouv = d.sessions.filter(x => x.status === "ouverte").sort((a, b) => ms(b.started_at) - ms(a.started_at))[0];
    let tod = null; const ci = d.checkins.find(c => c.day === today);
    if (ci) tod = { club: ci.club_id, club_name: nomDe(ci.club_id), status: "validee", points: ci.points };
    else { const x = d.sessions.find(y => y.day === today && (y.status === "courte" || y.status === "rejetee")); if (x) tod = { club: x.club_id, club_name: nomDe(x.club_id), status: x.status, points: 0 }; }
    const der = d.checkins.slice().sort((a, b) => ms(tsSeance(b)) - ms(tsSeance(a))).slice(0, 8).map(c => minutesLocal(tsSeance(c), tz)).sort((a, b) => a - b);
    const uh = der.length ? pad(Math.floor(der[Math.floor((der.length - 1) / 2)] / 60)) + ":" + pad(der[Math.floor((der.length - 1) / 2)] % 60) : "18:00";
    const ptsm = pointsDepuis(d, mois);
    let g = null, k = null, ge = null, se = null, gnext = null, gfrom = null, conva = 0, pzj = null, pzn = null, qj = [], ub = null, ch = [];
    if (hasP) {
      g = goalAt(d, cw); k = weekKind(p, cw); ge = gEff(p, cw, g); se = safeEff(k, ge);
      const fut = d.goals.filter(x => x.effective_week > cw).sort((a, b) => a.effective_week < b.effective_week ? -1 : 1)[0];
      gnext = fut && fut.goal !== g ? fut.goal : null;
      const libre = ms(p.created_at) + CFG.goal_free_change_days * 864e5, proch = ms(p.goal_changed_at) + CFG.goal_change_days * 864e5;
      if (ms(t) >= libre && proch > ms(t)) gfrom = jourLocal(proch, tz);
      if (p.sick_since) conva = counted(d).filter(c => c.day >= p.sick_since && c.day >= plus(today, -(CFG.heal_window_days - 1)) && c.day <= today).length;
      const pj = z => ({ kind: z.kind, start_week: z.start_week, end_week: z.end_week == null ? null : z.end_week,
                         until: z.end_week == null ? null : plus(z.end_week, 7) });
      const z = pauseAt(d, cw); if (z) pzj = pj(z);
      const zn = d.pauses.filter(x => x.start_week > cw).sort((a, b) => a.start_week < b.start_week ? -1 : 1)[0]; if (zn) pzn = pj(zn);
      if (!pauseAt(d, cw)) qj = d.quests.filter(q => q.week === cw).sort((a, b) => a.slot - b.slot).map(q => ({ slot: q.slot, key: q.quest_key, reward: q.reward, done: !!q.done_at }));
      const w = d.weeks.filter(x => !x.seen_at).sort((a, b) => a.week < b.week ? 1 : -1)[0];
      if (w) ub = { week: w.week, outcome: w.outcome, kind: w.kind, met: w.met, hearts_before: w.hearts_before, hearts_after: w.hearts_after,
                    streak_before: w.streak_before, streak_after: w.streak_after, gel_used: w.gel_used, gels_after: w.gels_after, fell_sick: w.fell_sick,
                    v: w.v_count, c: w.c_count, s: w.s_count, g: w.goal_eff, safe: w.safe, goal: w.goal, stars: w.stars_earned,
                    ange: w.met && (w.outcome === "atteint" || w.outcome === "doux") };
      ch = d.chests.filter(c => !c.opened_at && c.kind !== "pas").sort((a, b) => ms(a.granted_at) - ms(b.granted_at) || (a.chest_key < b.chest_key ? -1 : 1))
        .map(c => ({ key: c.chest_key, kind: c.kind, item: c.item_id == null ? null : c.item_id }));
    }
    return {
      hearts: hasP ? p.hearts : CFG.hearts_start, hearts_max: CFG.hearts_max, sick: hasP && !!p.sick_since,
      conva: { n: conva, need: CFG.heal_sessions },
      streak: hasP ? p.streak : 0, best_streak: hasP ? p.best_streak : 0, gels: hasP ? p.gels : 0,
      stars, steps, mus_level: lvl, mus_display: Math.max(0, lvl - (hasP && p.sick_since ? 1 : 0)), soft_mode: hasP && !!p.soft_mode,
      goal: g, goal_next: gnext, goal_change_from: gfrom,
      week: { start: cw, kind: k || "essai", g: ge, safe: se, v: nv, c: nc, s, days_left: 8 - isod, days },
      session: ouv ? sessionJson(ouv) : null, today: tod, pause: pzj, pause_next: pzn,
      pause_left_52: Math.max(0, CFG.pause_weeks_per_52 - (hasP ? pauseUsed52(d, cw) : 0)),
      quests: qj, unseen_bilan: ub, chests: ch, usual_hour: uh, points_month: ptsm, rank_month: ptsm > 0 ? 1 : null,
      onboarded: hasP, player: true, no: d.no, pseudo: d.pseudo, seed: graine(d),
      weeks_ok: hasP ? p.weeks_ok : 0, phoenix: hasP && !!p.phoenix, healed_count: hasP ? p.healed_count : 0,
      birth_year: hasP ? (p.birth_year == null ? null : p.birth_year) : null, minor: hasP && isMinor(p.birth_year, t),
      home_club: hasP ? (p.home_club_id == null ? null : p.home_club_id) : null, tz, banned: false,
      server_now: iso(t), contract: 1
    };
  }
  const ok = (d, t, o) => Object.assign({ ok: true }, o || {}, { state: stateJson(d, t) });
  const non = (why, o) => Object.assign({ ok: false, why }, o || {});

  /* ---------- les actions (= RPC de 03-jeu.sql §8) ---------- */
  function etat(d, t) { touch(d, t); return stateJson(d, t); }

  function objectif(d, g, t) {
    if (g == null || g < CFG.goal_min || g > CFG.goal_max) return non("hors_limites", { min: CFG.goal_min, max: CFG.goal_max });
    let p = d.profile;
    if (!p) {
      const today = jourLocal(t, PARIS), cw = lundi(today), legacy = d.checkins.length > 0;
      d.profile = { tz: PARIS, home_club_id: null, birth_year: null, soft_mode: false, created_at: iso(t), first_week: cw,
                    created_isodow: isodow(today), hearts: CFG.hearts_start, streak: 0, best_streak: 0, weeks_ok: 0,
                    gels: legacy ? 1 : 0, first_gel_done: legacy, sick_since: null, healed_count: 0, reprise_week: null,
                    last_settled_week: null, phoenix: false, goal_changed_at: iso(t) };
      d.goals.push({ effective_week: cw, goal: g, requested_at: iso(t) });
      if (CFG.pionnier_until == null || ms(t) < ms(CFG.pionnier_until))
        d.chests.push({ chest_key: "pionnier", kind: "pionnier", item_id: "echarpe_pionnier", granted_at: iso(t), opened_at: null });
      touch(d, t);
      return ok(d, t);
    }
    touch(d, t);
    const cw = lundi(jourLocal(t, p.tz)), cur = goalAt(d, cw);
    const poser = w => { const x = d.goals.find(y => y.effective_week === w); if (x) { x.goal = g; x.requested_at = iso(t); } else d.goals.push({ effective_week: w, goal: g, requested_at: iso(t) }); };
    if (cw === p.first_week) { poser(cw); d.goals = d.goals.filter(x => x.effective_week <= cw); }
    else if (g === cur) { d.goals = d.goals.filter(x => x.effective_week <= cw); return ok(d, t); }
    else {
      const proch = ms(p.goal_changed_at) + CFG.goal_change_days * 864e5;
      if (ms(t) >= ms(p.created_at) + CFG.goal_free_change_days * 864e5 && proch > ms(t)) return non("trop_tot", { next_date: jourLocal(proch, p.tz) });
      d.goals = d.goals.filter(x => x.effective_week <= plus(cw, 7)); poser(plus(cw, 7));
    }
    p.goal_changed_at = iso(t);
    refreshQuests(d, cw, t);
    return ok(d, t);
  }

  function debut(d, pos, t) {
    pos = pos || {};
    const p = d.profile; if (!p) return non("objectif");
    touch(d, t);
    const t0 = ms(t), today = jourLocal(t, p.tz), duJour = d.attempts.filter(a => jourLocal(a.at, p.tz) >= today);
    const nref = duJour.filter(a => a.why === "precision" || a.why === "loin" || a.why === "position").length;
    if (nref >= CFG.start_refused_per_day) return non("quota");
    if (duJour.some(a => ms(a.at) > t0 - 3000)) return non("vite");
    const essai = why => d.attempts.push({ at: iso(t), why });
    const { lat, lon, acc } = pos;
    if (lat == null || lon == null || !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) { essai("position"); return non("position"); }
    if (acc == null || !(acc > 0 && acc <= CFG.acc_max_m)) { essai("precision"); return non("precision", { acc: Math.min(Math.round(acc == null ? 9999 : acc), 9999) }); }
    const ouv = d.sessions.filter(x => x.status === "ouverte").sort((a, b) => ms(b.started_at) - ms(a.started_at))[0];
    if (ouv) return non("en_cours", { session: sessionJson(ouv) });
    // la salle : celle proposée par l'appli (pos.club) si elle est dans le rayon, sinon la plus proche
    const r = CFG.radius_base_m + Math.min(acc, CFG.radius_acc_bonus_max_m);
    let c = null, dd = Infinity;
    for (const x of SALLES) { if (!x.active) continue; const m = distM(lat, lon, x.lat, x.lon); if (m < dd) { dd = m; c = x; } }
    const voulue = pos.club && salleDe(pos.club);
    if (voulue && voulue.active) { const m = distM(lat, lon, voulue.lat, voulue.lon); if (m <= r) { c = voulue; dd = m; } }
    if (!c) return non("salle");
    if (dd > r) { essai("loin"); return non("loin", { dist: Math.round(dd), club: c.id, club_name: c.name }); }
    const jour = jourLocal(t, c.tz);
    const dej = d.checkins.find(x => x.day === jour) || d.sessions.find(x => x.day === jour);
    if (dej) { essai("deja"); return non("deja", { club: dej.club_id }); }
    const s = { id: d.nextId++, club_id: c.id, day: jour, week: lundi(jour), started_at: iso(t), start_dist_m: Math.round(dd),
                start_acc_m: Math.round(acc), confirmed_at: null, status: "ouverte", week_rank: null, points: 0, flags: [] };
    d.sessions.push(s); essai("ok");
    return { ok: true, dist: Math.round(dd), club: c.id, club_name: c.name, session: sessionJson(s), state: stateJson(d, t) };
  }

  function fin(d, pos, t) {
    pos = pos || {};
    const p = d.profile, t0 = ms(t), s = d.sessions.find(x => x.id === pos.session);
    if (!p || !s) return non("introuvable");
    if (s.status === "validee") return non("deja", { state: stateJson(d, t) });
    if (s.status !== "ouverte") return non("expiree", { state: stateJson(d, t) });
    const debutS = ms(s.started_at);
    if (t0 > debutS + CFG.session_max_minutes * 60e3) { touch(d, t); return non("expiree", { state: stateJson(d, t) }); }
    if (t0 < debutS + CFG.session_min_minutes * 60e3) return non("trop_tot", { wait_s: Math.ceil((debutS + CFG.session_min_minutes * 60e3 - t0) / 1000) });
    if (d.attempts.some(a => ms(a.at) > t0 - 3000)) return non("vite");
    const { lat, lon, acc } = pos;
    if (lat == null || lon == null || !(lat >= -90 && lat <= 90) || !(lon >= -180 && lon <= 180)) return non("position");
    const essai = why => d.attempts.push({ at: iso(t), why });
    if (acc == null || !(acc > 0 && acc <= CFG.acc_max_m)) { essai("fin_precision"); return non("precision", { acc: Math.min(Math.round(acc == null ? 9999 : acc), 9999) }); }
    const c = salleDe(s.club_id); if (!c) return non("salle");
    const dd = distM(lat, lon, c.lat, c.lon);
    if (dd > CFG.radius_base_m + Math.min(acc, CFG.radius_acc_bonus_max_m)) {
      essai("fin_loin");
      return non("loin", { dist: Math.round(dd), club: s.club_id, until: iso(debutS + CFG.session_max_minutes * 60e3) });
    }
    const rk = vCount(d, s.week) + 1;
    let pts = rk <= CFG.points_max_sessions_per_week ? CFG.points_per_session : 0;
    if (aJour(d, s.day)) pts = 0;
    else d.checkins.push({ day: s.day, club_id: s.club_id, points: pts, created_at: iso(t), started_at: s.started_at, flags: [], session_id: s.id });
    Object.assign(s, { status: "validee", confirmed_at: iso(t), week_rank: rk, points: pts });
    essai("fin_ok");
    if (!p.first_gel_done) { p.gels = Math.min(CFG.gels_max, p.gels + 1); p.first_gel_done = true; }
    const healed = afterCounted(d, s.day);
    ensureQuests(d, s.week); refreshQuests(d, s.week, t); touch(d, t);
    const n = d.checkins.length;
    return { ok: true, points: pts, steps: n, chest_due: [0, 3, 6].includes(n % 10), heal: healed, hearts: p.hearts, state: stateJson(d, t) };
  }

  function pause(d, kind, semaines, t) {
    if (!d.profile) return non("objectif");
    touch(d, t);
    const p = d.profile, lim = CFG.pause_weeks_per_52;
    if (kind !== "pause" && kind !== "hibernation") return non("type");
    const today = jourLocal(t, p.tz), cw = lundi(today), st = isodow(today) <= CFG.pause_same_week_until_isodow ? cw : plus(cw, 7);
    if (d.pauses.some(z => z.end_week == null || z.end_week >= st)) return non("deja", { state: stateJson(d, t) });
    if (kind === "pause") {
      if (semaines == null || semaines < 1 || semaines > lim) return non("duree", { max: lim });
      const used = pauseUsed52(d, cw);
      if (used + semaines > lim) return non("quota", { reste: Math.max(lim - used, 0) });
      d.pauses.push({ id: d.nextId++, kind, start_week: st, end_week: plus(st, 7 * (semaines - 1)) });
    } else { d.pauses.push({ id: d.nextId++, kind, start_week: st, end_week: null }); p.streak = 0; }
    if (st === cw) d.quests = d.quests.filter(q => !(q.week === cw && !q.done_at));
    return ok(d, t, { from: st });
  }
  function finPause(d, t) {
    touch(d, t);
    const p = d.profile; if (!p) return non("aucune");
    const cw = lundi(jourLocal(t, p.tz));
    const z = d.pauses.filter(x => x.end_week == null || x.end_week >= cw).sort((a, b) => a.start_week < b.start_week ? -1 : 1)[0];
    if (!z) return non("aucune", { state: stateJson(d, t) });
    if (z.start_week > cw) d.pauses = d.pauses.filter(x => x !== z); else z.end_week = cw;
    return ok(d, t);
  }
  function doux(d, oui, t) {
    const p = d.profile; if (!p) return non("objectif");
    touch(d, t);
    if (!oui && isMinor(p.birth_year, t)) return non("mineur");
    p.soft_mode = !!oui; return ok(d, t);
  }
  function naissance(d, annee, t) {
    const p = d.profile; if (!p) return non("objectif");
    const y = anneeUTC(t);
    if (annee == null || annee < 1900 || annee > y) return non("invalide");
    if (y - annee < CFG.min_age) return non("age", { min_age: CFG.min_age });
    p.birth_year = annee; p.soft_mode = p.soft_mode || (y - annee < CFG.adult_age);
    touch(d, t); return ok(d, t);
  }
  function salle(d, id, t) {
    const p = d.profile; if (!p) return non("objectif");
    if (id == null) { p.home_club_id = null; p.tz = PARIS; }
    else { const c = salleDe(id); if (!c) return non("salle"); p.home_club_id = id; p.tz = c.tz; }
    touch(d, t); return ok(d, t);
  }
  function vu(d, semaine, t) {
    d.weeks.forEach(w => { if (w.week <= semaine && !w.seen_at) w.seen_at = iso(t); });
    return ok(d, t);
  }
  function coffre(d, cle, vide, t) {
    let gain = 0;
    const m = /^pas:(\d{1,5})$/.exec(cle || "");
    if (m) {
      const n = +m[1];
      if (n < 1 || n > d.checkins.length || ![0, 3, 5, 6].includes(n % 10)) return non("introuvable");
      if (!d.chests.some(c => c.chest_key === cle)) d.chests.push({ chest_key: cle, kind: "pas", item_id: null, granted_at: iso(t), opened_at: iso(t) });
      if (vide) gain = star(d, n % 10 === 0 ? CFG.stars_empty_big_chest : CFG.stars_empty_chest, "coffre_vide", cle);
      return ok(d, t, { key: cle, stars: gain });
    }
    const cg = d.chests.find(c => c.chest_key === cle);
    if (!cg || cg.kind === "pas") return non("introuvable");
    const deja = !!cg.opened_at;
    if (!deja) cg.opened_at = iso(t);
    if (vide && cg.kind === "semaine") gain = star(d, CFG.stars_week_chest_full, "semaine_vide", cle);
    return ok(d, t, { key: cle, kind: cg.kind, item: cg.item_id, already: deja, stars: gain });
  }
  // pour les tests et les outils admin de démo : poser des valeurs du profil (cœurs, série, gels…)
  function regler(d, champs) { if (d.profile) Object.assign(d.profile, champs); return d; }

  const HMGV = {
    config: CFG, nouveau, salles, objectif, debut, fin, pause, finPause, doux, naissance, salle, vu, coffre, etat, regler,
    // outils (mêmes formules que le serveur), utiles à l'interface : prévisions, anneau, notifications
    outils: { iso, jourLocal, lundi, plus, isodow, semaineIso, bilanJusqua, safe, gEff, safeEff, goalAt, weekKind, distM, tzPour,
              gmHash, gmRng, musLevel, pauseUsed52, settleDue, touch, stateJson }
  };
  racine.HMGV = HMGV;
  if (typeof module !== "undefined" && module.exports) module.exports = HMGV;
})(typeof window !== "undefined" ? window : globalThis);
