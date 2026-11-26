"use strict";
/* =====================================================================================================
   HMG Fitness · js/serveur.js · global HMGS : la couche de données de l'appli (comptes et jeu)
   Script classique, aucune dépendance. Chargé après js/app.js (il lit CONFIG) et js/vies-regles.js (HMGV, mode démo).
   Le serveur, c'est supabase/01 à 05 (voir supabase/LISEZMOI.md). Le serveur décide de tout ; ce fichier ne fait
   qu'ouvrir une session, appeler les RPC, garder le dernier état pour l'affichage hors connexion, et simuler le
   serveur en mode démo.

   ── Les 3 modes (HMGS.statut().mode) ───────────────────────────────────────────────────────────────────────────
   "serveur" : session anonyme Supabase Auth ; toutes les fonctions ci-dessous marchent.
   "ancien"  : le serveur du jeu n'est pas (encore) là (réponse gardée une heure, ?hmgs=serveur pour redemander) :
               migrations pas appliquées (raison "serveur_ancien"),
               connexions anonymes coupées dans Supabase (raison "anonyme_coupe", message clair dans la console),
               pas de réseau au premier lancement (raison "reseau", nouvel essai 30 s plus tard)…
               L'appli garde alors l'ancien fonctionnement (clé hmg-voter et anciennes RPC de js/app.js) :
               etat() renvoie null, exporter() renvoie null, les autres fonctions rejettent (erreur hint "ancien").
   "demo"    : aucun serveur ; le jeu est simulé sur l'appareil par HMGV (même JSON que my_state).
               Pour l'allumer : adresse ?hmgs=demo (?hmgs=serveur pour l'éteindre) ou HMGS.demo.activer().
   Avant la fin du démarrage, le mode vaut "demarrage" ; HMGS.pret() attend la fin (Promise<statut>).

   ── Session (inscription anonyme, renouvellement, reprise) ─────────────────────────────────────────────────────
   - Premier lancement : POST /auth/v1/signup {} (= signInAnonymously) ; avant, une lecture sans compte vérifie que le
     serveur v2 est installé (ligne access_mode de settings, sinon rpc/has_access) : sinon, aucun compte n'est créé.
   - La session (jetons) est rangée dans le trousseau de l'iPhone par HMGN.stockage.set("hmg-auth", …, {icloud:false})
     quand window.HMGN existe (propre à l'appareil, jamais dans localStorage ni dans Preferences), sinon dans
     localStorage["hmg-auth"] (site). Le jeton est renouvelé une minute avant d'expirer, et sur 401.
   - Reprise automatique du compte du site : la clé hmg-voter de l'appareil est passée UNE fois à
     claim_legacy_account (avec les étoiles de l'ancienne collection) : anciennes et nouvelles RPC agissent alors sur
     le même joueur. Résultat dans statut().reprise : "ok" | "deja" | "inconnu" (pas encore sur le serveur, réessayé
     plus tard) | "pris" (déjà repris par un autre appareil : il faut un code de transfert) | "invalide" | "limite".
     Quand « C'est moi » (acctAdopt) change hmg-voter, la reprise se refait au lancement suivant.
   - Accès privé (hint "invite") : le code gardé par la porte du site (hmg-invite) ou reçu par lien (hmg-parrain)
     est essayé une fois avec redeem_invite, puis l'appel est rejoué. Sinon : évènement hmgs:invitation.
   - Admin : la session e-mail de js/app.js (hmg-session) n'est utilisée que par HMGS.admin(nom, args).

   ── API (toutes les fonctions renvoient une promesse) ──────────────────────────────────────────────────────────
   Règle : on reçoit la réponse JSON du serveur, refus compris ({ok:false, why}). La promesse est REJETÉE (HMGS.Erreur,
   avec .hint et parfois .why) quand l'appel n'a pas pu se faire (réseau, mode ancien, session, accès) ; les
   fonctions marquées « rejette si refus » rejettent aussi sur {ok:false} ; « jamais de rejet » = {ok:false, why} à la place.
   Les réponses qui contiennent "state" (un my_state complet) mettent à jour le cache et déclenchent hmgs:etat.

   HMGS.pret()                      → statut (attend la fin du démarrage)
   HMGS.statut()                    → { mode, raison, message, uid, anonyme, acces, reprise, hors_ligne, natif } (synchrone)
   HMGS.etat({frais})               → my_state (ci-dessous) ou null (mode ancien, pas d'invitation). Hors connexion :
                                      le dernier état reçu. Deux appels à moins de 3 s : le même état (frais:true force).
   HMGS.etatCache()                 → le dernier état gardé, tout de suite (synchrone), ou null
   HMGS.rpc(nom, args)              → n'importe quelle RPC (bas niveau) ; HMGS.admin(nom, args) avec la session admin
   Jeu
   HMGS.objectif(v, {inscription})  → set_goal(p_goal 2..5) : {ok, state} | {ok:false, why:"trop_tot", next_date} | "hors_limites"
   HMGS.pause(n)                    → pause_start('pause', p_weeks n) : {ok, from, state} | why "duree" (max), "quota" (reste), "deja", "objectif"
   HMGS.hiberner()                  → pause_start('hibernation') : idem, sans fin prévue (une séance validée la termine)
   HMGS.finPause()                  → pause_end() : {ok, state} ; rejette si refus (why "aucune")
   HMGS.doux(on)                    → set_soft_mode(p_on) : {ok, state} ; rejette si refus (why "mineur", "objectif")
   HMGS.naissance(annee)            → set_birth_year(p_year) : {ok, state} | why "age" (min_age), "invalide"
   HMGS.maSalle(id)                 → set_home_club(p_club) : {ok, state} | why "salle" ; jamais de rejet
   HMGS.ackBilan(semaine)           → ack_bilan(p_week "AAAA-MM-JJ", le lundi du bilan) : {ok, state} ; jamais de rejet
   HMGS.coffre(cle, vide)           → open_chest(p_key, p_empty) : {ok, key, kind, item, already, stars, state} | why "introuvable"
   HMGS.seanceDebut({lat, lon, acc, club, simulee, accessoire})
                                    → session_start(p_lat, p_lon, p_acc, p_meta {club, simulated, accessory}) :
                                      {ok, dist, club, club_name, session, state} | why "loin" (dist, club, club_name),
                                      "precision" (acc), "deja", "en_cours" (session), "position", "salle", "quota", "vite",
                                      "objectif", "bloque"
   HMGS.seanceFin(id, {lat, lon, acc, simulee})
                                    → session_confirm(p_session, p_lat, p_lon, p_acc, p_meta) :
                                      {ok, points, steps, chest_due, heal, hearts, state} | why "trop_tot" (wait_s),
                                      "loin" (dist, until), "precision", "expiree", "deja", "introuvable", "position", "salle", "vite"
   HMGS.classement(periode)         → leaderboard_v2(p_period "month" | "all") : [{no, pseudo, points, clubs, steps, me}]
   HMGS.semainePassee()             → prev_week_v2() ; HMGS.score() → my_score_v2()
   HMGS.sallesProches(lat, lon, n)  → gyms_near(p_lat, p_lon, p_limit) ; HMGS.chercherSalles(q, n) → gyms_search(p_q, p_limit)
                                      [{id, name, brand, address, postcode, city, lat, lon, precise, active, source, dist?}]
   HMGS.charger()                   → load_game() : {player, seed, sessions, game, prefs, quest_rewards}
   HMGS.sauver(emplacement, data, version) → save_game(p_slot "game"|"prefs", p_data objet ≤ 32 Ko, p_version) : {ok, version}
                                      | why "conflit" (version, data du serveur), "vite", "trop_gros", "invalide", "emplacement"
   Compte
   HMGS.compte()                    → account_status() : {access, player, no, anonymous, admin, mode}
   HMGS.pseudo(p)                   → set_pseudo_v2(p_pseudo) ; jamais de rejet. HMGS.pseudoLibre(p) → pseudo_check_v2(p_pseudo)
   HMGS.invitation(code)            → redeem_invite(p_code) : {ok} | why "code", "limite", "deja"
   HMGS.reprendreCompte(cle, etoiles) → claim_legacy_account(p_key, p_old_stars) : clé de 32 caractères, code de 28
                                      caractères ou lien #compte=… : {ok, no, hero, state} | why "invalide", "inconnu", "pris", "limite"
   HMGS.codeTransfert()             → create_transfer_code() : {ok, code "XXXXX-XXXXX", expires_at} | why "vide", "apple", "limite"
   HMGS.transfert(code)             → redeem_transfer_code(p_code) : {ok, no, state} | why "code", "limite" (l'autre appareil perd le compte)
   HMGS.exporter()                  → my_export() + ce que l'appareil garde (appareil: {jeu, objectif, ma_salle, mes_salles}),
                                      ou null si le serveur n'est pas là
   HMGS.supprimerCompte()           → delete_account() puis oubli de la session ; rejette en cas d'échec
   Avis et modération
   HMGS.avis(club, note, commentaire) → post_review_v2(p_club, p_rating 1..10, p_comment) : {ok, id, hidden} | why "deja",
                                      "limite", "long", "bloque" ; HMGS.vote(idAvis, valeur) → vote_review_v2(p_review, p_value -1|0|1)
   HMGS.signaler(type, cible, raison, note) → report_content(p_kind "review"|"photo"|"member", p_target (id ou numéro),
                                      p_reason "spam"|"insulte"|"harcelement"|"haine"|"sexuel"|"violence"|"danger"|"faux"|"perso"|"autre",
                                      p_note ≤ 500) : {ok, hidden} | why "deja"(ok), "limite", "soi", "introuvable", "raison", "type", "bloque"
   HMGS.masquer(no) / HMGS.demasquer(no) → block_member / unblock_member(p_no) ; HMGS.masques() → my_blocks() [{no, pseudo, at}]
   Démo
   HMGS.demo.activer() / couper() / actif() ; HMGS.demo.avancer(heures) (fait passer le temps : bilans, maladie…) ;
   HMGS.demo.seance(idSalle?) (une séance validée tout de suite) ; HMGS.demo.regler({hearts, streak, gels…}) ; HMGS.demo.dossier()

   ── my_state (contrat 1, 1-jeu-vies.md §14.10 ; mêmes clés dans js/vies-regles.js) ────────────────────────────
   hearts, hearts_max, sick, conva{n, need}, streak, best_streak, gels, stars, steps, mus_level, mus_display, soft_mode,
   goal, goal_next, goal_change_from,
   week{start, kind "essai"|"normale"|"reprise", g, safe, v, c, s, days_left, days:[{d:"AAAA-MM-JJ", st:"validee"|"courte"}]},
   session{id, status, started_at, confirm_from, confirm_until, club, club_name} | null,
   today{club, club_name, status "validee"|"courte"|"rejetee", points} | null,
   pause{kind "pause"|"hibernation", start_week, end_week|null, until|null} | null   (pause EN COURS cette semaine)
   pause_next{…même forme} | null   (pause prévue à partir d'un lundi à venir), pause_left_52,
   quests:[{slot, key, reward, done}], chests:[{key, kind, item}], usual_hour "HH:MM",
   last_day "AAAA-MM-JJ" | null   (dernière séance validée : rappel « reviens » après 14 jours),
   points_month, rank_month, onboarded (vrai quand l'objectif est choisi), player, no, pseudo, seed, weeks_ok, phoenix,
   healed_count, birth_year, minor, home_club, tz, banned, server_now, contract,
   unseen_bilan{week (lundi de la semaine jugée), outcome, kind, met, hearts_before, hearts_after, streak_before, streak_after,
                gel_used, gels_after, fell_sick, v, c, s, g, safe, goal, stars, ange} | null
     outcome : "atteint" (objectif tenu) | "sauve" (au moins la moitié : cœurs gardés) | "rate" (un cœur s'envole ou un gel
               est utilisé : gel_used) | "malade" (à 0 cœur) | "pause" | "hibernation" | "doux" (mode doux : cœurs inchangés)

   ── Évènements (sur window) ─────────────────────────────────────────────────────────────────────────────────────
   hmgs:etat (detail = my_state) · hmgs:mode (detail = statut) · hmgs:invitation (accès privé sans code valable)
   hmgs:reprise (detail {why, message} quand la reprise du compte du site échoue sur « pris ») · hmgs:session-perdue
   ── Ce qui est gardé sur l'appareil ─────────────────────────────────────────────────────────────────────────────
   hmg-auth (session : trousseau dans l'appli, localStorage sur le site) · hmg-etat (dernier my_state) ·
   hmg-reprise (résultat de la reprise) · hmg-jeu-demo (mode démo : dossier HMGV et décalage d'horloge) ·
   hmg-serveur (« serveur pas encore installé » ou « anonymes coupés », gardé une heure pour ne pas redemander à chaque page)
   ===================================================================================================== */
(function (W) {
  "use strict";
  if (W.HMG_PRIVE) return;                                   // derrière la porte d'invitation du site : rien ne démarre

  const C = W.HMGS_CONFIG || (typeof CONFIG !== "undefined" && CONFIG && CONFIG.url && CONFIG.key ? CONFIG : null);
  const BASE_OK = !!(C && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(C.url) && String(C.key).length > 20);
  const CLE_SESSION = "hmg-auth", CLE_ETAT = "hmg-etat", CLE_REPRISE = "hmg-reprise", CLE_DEMO = "hmg-jeu-demo", CLE_SERVEUR = "hmg-serveur";
  const MSG = { serveur_ancien: "Le serveur du jeu n'est pas encore installé (supabase/LISEZMOI.md).", anonyme_coupe: null };
  const TEXTE_ANONYME = "Les connexions anonymes sont coupées dans Supabase (Authentication › Sign In / Providers › "
    + "« Allow anonymous sign-ins ») : l'appli garde l'ancien fonctionnement (clé hmg-voter) en attendant.";

  /* ---------- petits outils ---------- */
  const LS = (() => { try { return W.localStorage || null; } catch (e) { return null; } })();
  const lsLire = (k, d) => { try { const v = LS && LS.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsEcrire = (k, v) => { try { if (!LS) return; if (v == null) LS.removeItem(k); else LS.setItem(k, JSON.stringify(v)); } catch (e) { /* quota */ } };
  const maintenant = () => Date.now();
  class ErreurHMGS extends Error {
    constructor(message, o) { super(message); this.name = "ErreurHMGS"; Object.assign(this, o || {}); }
  }
  const erreur = (m, o) => new ErreurHMGS(m, o);
  function evenement(nom, detail) {
    try { if (W.dispatchEvent && typeof W.CustomEvent === "function") W.dispatchEvent(new W.CustomEvent("hmgs:" + nom, { detail })); } catch (e) { /* rien */ }
  }
  function charge(jwt) {                                     // le contenu d'un jeton (sans vérifier la signature : c'est le serveur qui vérifie)
    try {
      const p = String(jwt).split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(W.atob(p + "===".slice((p.length + 3) % 4)))));
    } catch (e) { return null; }
  }
  const empreinte = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };

  /* ---------- état du module ---------- */
  const M = { mode: "demarrage", raison: null, message: null, uid: null, anonyme: null, acces: null, reprise: null, hors_ligne: false };
  let transitoire = false;
  function poserMode(mode, raison, message, passager) {
    const change = M.mode !== mode || M.raison !== (raison || null);
    M.mode = mode; M.raison = raison || null; M.message = message || null; transitoire = !!passager;
    if (mode === "ancien" && raison === "anonyme_coupe") console.warn("[HMGS] " + TEXTE_ANONYME);
    else if (mode === "ancien" && message) console.info("[HMGS] ancien fonctionnement : " + message);
    if (change) evenement("mode", statut());
  }
  const statut = () => Object.assign({}, M, { natif: natif() });
  const horsLigne = v => { M.hors_ligne = !!v; };
  const acces = v => { if (M.acces !== v) { M.acces = v; if (v === false) evenement("invitation", statut()); } };

  /* ---------- la session : trousseau de l'appareil (appli) ou localStorage (site) ---------- */
  const natif = () => !!(W.HMGN && W.HMGN.stockage && typeof W.HMGN.stockage.get === "function");
  function lireSession(v) {
    if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { return null; } }
    return v && typeof v.access_token === "string" && typeof v.refresh_token === "string" ? v : null;
  }
  const coffre = {
    async lire() {
      if (!natif()) return lireSession(lsLire(CLE_SESSION, null));
      if (LS && LS.getItem(CLE_SESSION) != null) lsEcrire(CLE_SESSION, null);   // dans l'appli, jamais de jeton dans localStorage
      let v = null; try { v = await W.HMGN.stockage.get(CLE_SESSION); } catch (e) { v = null; }
      return lireSession(v);
    },
    async ecrire(s) {
      if (!natif()) { lsEcrire(CLE_SESSION, s); return true; }
      let ok = false; try { ok = await W.HMGN.stockage.set(CLE_SESSION, JSON.stringify(s), { icloud: false }); } catch (e) { ok = false; }
      if (!ok) console.warn("[HMGS] la session n'a pas pu être rangée dans le trousseau : elle ne tiendra que jusqu'à la fermeture de l'appli.");
      return ok;
    },
    async effacer() {
      if (natif()) { try { await W.HMGN.stockage.remove(CLE_SESSION); } catch (e) { /* rien */ } }
      lsEcrire(CLE_SESSION, null);
    },
  };
  function versSession(j) {
    const c = charge(j.access_token) || {};
    return { access_token: j.access_token, refresh_token: j.refresh_token,
             expires_at: +j.expires_at || +c.exp || Math.floor(maintenant() / 1000) + (+j.expires_in || 3600),
             uid: (j.user && j.user.id) || c.sub || null,
             anonyme: j.user && j.user.is_anonymous != null ? !!j.user.is_anonymous : c.is_anonymous !== false };
  }

  /* ---------- HTTP ---------- */
  async function http(chemin, corps, jeton, methode) {
    const h = { apikey: C.key, "Content-Type": "application/json", Accept: "application/json" };
    if (jeton) h.Authorization = "Bearer " + jeton;
    else if (/^eyJ/.test(C.key)) h.Authorization = "Bearer " + C.key;      // ancienne clé « anon » (un JWT)
    const ac = typeof W.AbortController === "function" ? new W.AbortController() : null;
    const minuteur = ac ? setTimeout(() => ac.abort(), 15000) : 0;
    let r;
    const get = methode === "GET";
    try { r = await W.fetch(C.url + chemin, { method: get ? "GET" : "POST", headers: h, body: get ? undefined : JSON.stringify(corps || {}), signal: ac ? ac.signal : undefined }); }
    catch (e) { throw erreur("Pas de connexion au serveur HMG. Vérifie ton réseau.", { hint: "reseau" }); }
    finally { clearTimeout(minuteur); }
    let txt = ""; try { txt = await r.text(); } catch (e) { txt = ""; }
    let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
    return { status: r.status, ok: r.ok, j };
  }
  const codeDe = j => j && (j.error_code || (typeof j.code === "string" ? j.code : null)) || null;
  const texteDe = j => j && (j.msg || j.message || j.error_description || j.error) || "";

  /* ---------- Supabase Auth : inscription anonyme et renouvellement ---------- */
  async function inscription() {
    const r = await http("/auth/v1/signup", {});
    if (r.ok && r.j && r.j.access_token) return versSession(r.j);
    const code = codeDe(r.j), msg = texteDe(r.j);
    if (code === "anonymous_provider_disabled" || code === "signup_disabled" || /anonymous sign-ins are disabled|signups not allowed/i.test(msg))
      throw erreur(TEXTE_ANONYME, { hint: "anonyme_coupe", status: r.status, code });
    if (r.status === 429) throw erreur("Trop de nouveaux comptes depuis ce réseau : réessaie dans un moment.", { hint: "limite", status: 429, code });
    throw erreur("Création du compte impossible pour le moment (" + r.status + (msg ? " : " + msg : "") + ").", { hint: "serveur", status: r.status, code });
  }
  async function renouveler(s) {
    const r = await http("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token });
    if (r.ok && r.j && r.j.access_token) return versSession(r.j);
    if (r.status >= 400 && r.status < 500 && r.status !== 429)      // jeton refusé pour de bon (révoqué, compte supprimé…)
      throw erreur("Session refusée par le serveur.", { hint: "session_perdue", status: r.status, code: codeDe(r.j) });
    throw erreur("Le serveur HMG ne répond pas (" + r.status + ").", { hint: r.status === 429 ? "limite" : "serveur", status: r.status });
  }
  let S = null, renouvellement = null;
  async function maSession() {                               // une session dont le jeton vaut encore au moins une minute
    if (!S) S = await coffre.lire();
    if (!S) { S = await inscription(); await coffre.ecrire(S); M.uid = S.uid; M.anonyme = S.anonyme; return S; }
    if (S.expires_at - 60 <= maintenant() / 1000) await rafraichir();
    return S;
  }
  function rafraichir() {
    return renouvellement || (renouvellement = (async () => {
      const avant = S;
      try {
        try { S = await renouveler(avant); }
        catch (e) {
          if (e.hint !== "session_perdue") throw e;
          const rangee = await coffre.lire();                // un autre onglet a peut-être déjà renouvelé la session
          if (rangee && rangee.refresh_token !== avant.refresh_token) S = rangee.expires_at - 60 > maintenant() / 1000 ? rangee : await renouveler(rangee);
          else {
            console.warn("[HMGS] la session n'est plus valable : nouveau compte anonyme (la reprise du compte du site sera retentée).");
            await coffre.effacer(); S = await inscription(); evenement("session-perdue", {});
          }
        }
        await coffre.ecrire(S);
        M.uid = S.uid; M.anonyme = S.anonyme;
        return S;
      } finally { renouvellement = null; }
    })());
  }
  if (W.addEventListener) W.addEventListener("storage", e => {   // site : un autre onglet a renouvelé la session
    if (e && e.key === CLE_SESSION && !natif()) { const s = lireSession(e.newValue); if (s) S = s; }
  });

  /* ---------- session admin de js/app.js (connexion e-mail), pour HMGS.admin seulement ---------- */
  function jetonAdmin() { try { return (typeof session !== "undefined" && session && session.admin && session.access_token) || null; } catch (e) { return null; } }
  async function renouvelerAdmin() { try { return typeof refresh === "function" ? !!(await refresh()) : false; } catch (e) { return false; } }

  /* ---------- appel d'une RPC ---------- */
  const SOUS_ACCES = /^(my_state|set_goal|session_start|session_confirm|pause_start|pause_end|set_soft_mode|set_home_club|ack_bilan|open_chest|leaderboard_v2|my_score_v2)$/;
  const refuses = new Set();
  async function essayerInvitations() {                     // code gardé par la porte du site, ou reçu par lien d'invitation
    const codes = [lsLire("hmg-invite", null), lsLire("hmg-parrain", null)]
      .filter(c => typeof c === "string" && c.trim().length >= 4 && !refuses.has(c));
    for (const c of codes) {
      let r = null; try { r = await brut("redeem_invite", { p_code: c }, { sansInvitation: true }); } catch (e) { return false; }
      if (r && r.ok) { acces(true); return true; }
      if (r && r.why === "limite") return false;
      refuses.add(c);
    }
    return false;
  }
  async function brut(nom, args, o, rejoue) {
    o = o || {};
    let jeton;
    if (o.admin) { jeton = jetonAdmin(); if (!jeton) throw erreur("Connecte-toi d'abord à l'espace admin.", { hint: "admin" }); }
    else jeton = (await maSession()).access_token;
    const r = await http("/rest/v1/rpc/" + nom, args || {}, jeton);
    if (r.ok) {
      horsLigne(false);
      if (!o.admin && SOUS_ACCES.test(nom)) acces(true);     // ces RPC commencent par app.require_access()
      else if (nom === "account_status" && r.j && typeof r.j.access === "boolean") acces(r.j.access);
      return r.j;
    }
    const j = r.j || {}, hint = j.hint || null, code = codeDe(j), message = texteDe(j) || "Erreur " + r.status;
    if (!rejoue) {
      if (r.status === 401 || code === "PGRST301" || code === "PGRST303" || hint === "auth") {
        if (o.admin ? await renouvelerAdmin() : await rafraichir().then(() => true, () => false)) return brut(nom, args, o, true);
      }
      if (hint === "invite" && !o.sansInvitation && await essayerInvitations()) return brut(nom, args, o, true);
    }
    if (r.status === 404 && (code === "PGRST202" || /could not find the function/i.test(message)))
      throw erreur("Le serveur ne connaît pas « " + nom + " » : les migrations de supabase/ ne sont pas encore appliquées.", { hint: "absente", code, status: 404 });
    if (hint === "invite") acces(false);
    throw erreur(message, { hint: hint || (r.status === 401 ? "auth" : r.status >= 500 ? "serveur" : "refus"), code, status: r.status, details: j.details || null });
  }
  async function appel(nom, args, o) {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(String(nom))) throw erreur("Nom de RPC invalide : " + nom, { hint: "usage" });
    await pret();
    if (M.mode === "demo") return demo.rpc(nom, args || {});
    if (M.mode !== "serveur") throw erreur(M.message || "Le serveur du jeu n'est pas encore branché.", { hint: "ancien", raison: M.raison });
    try { return await brut(nom, args, o); }
    catch (e) {
      if (e.hint === "reseau") horsLigne(true);
      if (e.hint === "absente" && (nom === "my_state" || nom === "account_status")) poserMode("ancien", "serveur_ancien", e.message);
      throw e;
    }
  }

  /* ---------- démarrage (une fois ; refait 30 s plus tard après un échec passager) ---------- */
  let demarrage = null, demarreA = 0;
  function pret() {
    if (!demarrage || (M.mode === "ancien" && transitoire && maintenant() - demarreA > 30000)) {
      demarreA = maintenant();
      demarrage = demarrer().then(statut, () => statut());
    }
    return demarrage;
  }
  async function demarrer() {
    if (demo.actif()) {
      if (!W.HMGV) { poserMode("ancien", "demo", "Mode démo : js/vies-regles.js (HMGV) n'est pas chargé."); return; }
      demo.ouvrir(); poserMode("demo"); M.acces = true; return;
    }
    if (!BASE_OK) { poserMode("ancien", "config", "Pas de base Supabase dans CONFIG (js/app.js)."); return; }
    try {
      S = await coffre.lire();
      if (!S) {
        // Réponse « pas encore » de moins d'une heure : on ne redemande pas à chaque page (une requête et une ligne
        // rouge dans la console en moins) ; l'appli suit le serveur au plus une heure après la mise en place.
        const non = lsLire(CLE_SERVEUR, null);
        if (non && MSG.hasOwnProperty(non.raison) && maintenant() - non.at < 3600e3 && maintenant() >= non.at) {
          poserMode("ancien", non.raison, MSG[non.raison] || TEXTE_ANONYME); return;
        }
        // Le serveur v2 est-il installé ? Lecture seule, sans compte : la ligne access_mode de la table publique settings
        // (posée par 02-comptes.sql ; ne jamais l'effacer), sinon la fonction has_access() (ouverte à anon, créée par 02).
        let r = await http("/rest/v1/settings?select=key&key=eq.access_mode", null, null, "GET");
        if (r.ok && Array.isArray(r.j)) r = r.j.length ? r : { status: 404 };
        else r = await http("/rest/v1/rpc/has_access", {});
        if (r.status === 404) { lsEcrire(CLE_SERVEUR, { raison: "serveur_ancien", at: maintenant() }); poserMode("ancien", "serveur_ancien", MSG.serveur_ancien); return; }
        if (!r.ok) throw erreur("Le serveur HMG ne répond pas (" + r.status + ").", { hint: "serveur", status: r.status });
        S = await inscription(); await coffre.ecrire(S);
        lsEcrire(CLE_SERVEUR, null);
      }
      M.uid = S.uid; M.anonyme = S.anonyme;
      poserMode("serveur");
      try { await repriseAuto(false); } catch (e) { if (e.hint === "reseau") horsLigne(true); }
    } catch (e) {
      if (e.hint === "anonyme_coupe") { lsEcrire(CLE_SERVEUR, { raison: "anonyme_coupe", at: maintenant() }); poserMode("ancien", "anonyme_coupe", e.message); }
      else poserMode("ancien", e.hint === "reseau" ? "reseau" : "erreur", e.message, true);
    }
  }

  /* ---------- reprise du compte du site (clé hmg-voter) ---------- */
  const FINIS = ["ok", "deja", "pris", "invalide"];
  let essaisReprise = 0;
  function etoilesAnciennes() { const g = lsLire("hmg-game", null), n = g && +g.stars; return Number.isFinite(n) ? Math.max(0, Math.min(10000, Math.floor(n))) : 0; }
  async function repriseAuto(force) {
    if (M.mode !== "serveur") return null;
    const v = lsLire("hmg-voter", null);
    if (!/^[0-9a-f]{32}$/.test(v || "")) return null;
    const s = await maSession(), k = empreinte(v), f = lsLire(CLE_REPRISE, null);
    const meme = f && f.uid === s.uid && f.k === k;
    if (meme) M.reprise = f.why;
    if (meme && FINIS.includes(f.why)) return f;
    // « inconnu » : la clé n'est pas encore sur le serveur ; nouvel essai au plus toutes les 6 h, ou à l'inscription
    if (meme && !force && f.why === "inconnu" && maintenant() - Date.parse(f.at) < 6 * 3600e3) return f;
    if (meme && force && f.why !== "inconnu") return f;
    if (essaisReprise >= 3) return f;
    essaisReprise++;
    const r = await brut("claim_legacy_account", { p_key: v, p_old_stars: etoilesAnciennes() });
    return noterReprise(r, s.uid, k);
  }
  function noterReprise(r, uid, k) {
    const why = r && r.ok ? r.why || "ok" : (r && r.why) || "erreur";
    const res = { uid, k, why, at: new Date(maintenant()).toISOString() };
    if (k) lsEcrire(CLE_REPRISE, res);
    M.reprise = why;
    if (r && r.state) memoriser(r.state);
    if (why === "pris") evenement("reprise", { why, message: "Ce compte HMG est déjà utilisé sur un autre appareil. Sur cet appareil-là, "
      + "demande un code de transfert (Mon compte), puis entre-le ici." });
    return res;
  }
  async function avantEcriture() {                          // juste après l'ancien set_pseudo, la clé du site existe enfin
    await pret();
    if (M.mode === "serveur" && M.reprise === "inconnu") { try { await repriseAuto(true); } catch (e) { /* rien */ } }
  }

  /* ---------- dernier my_state (affichage hors connexion) ---------- */
  let cache = lsLire(CLE_ETAT, null), recuA = 0;              // recuA : dernier état reçu PENDANT ce chargement de page
  const qui = () => (M.mode === "demo" ? "demo" : S && S.uid) || null;
  function memoriser(st) {
    if (!st || typeof st !== "object" || st.contract == null) return;
    cache = { uid: qui(), at: maintenant(), state: st }; recuA = cache.at;
    lsEcrire(CLE_ETAT, cache);
    evenement("etat", st);
  }
  function etatCache() {
    if (!cache || !cache.state) return null;
    return M.mode === "demarrage" || cache.uid === qui() ? cache.state : null;
  }
  let lecture = null;
  async function etat(o) {
    o = o || {};
    await pret();
    if (M.mode === "demo") { try { const st = demo.rpc("my_state", {}); memoriser(st); return st; } catch (e) { return null; } }
    if (M.mode !== "serveur") return null;
    const c = etatCache();
    if (!o.frais && c && maintenant() - recuA < 3000) return c;
    if (lecture) return lecture;
    lecture = (async () => {
      try { const st = await appel("my_state"); memoriser(st); return st; }
      catch (e) {
        if (e.hint === "invite" || e.hint === "absente" || e.hint === "ancien") return null;
        if (e.hint !== "reseau") console.warn("[HMGS] my_state : " + e.message);
        return etatCache();                                  // hors connexion, ou serveur en panne : le dernier état reçu
      } finally { lecture = null; }
    })();
    return lecture;
  }

  /* ---------- actions ---------- */
  async function action(nom, args) {
    const r = await appel(nom, args);
    if (r && r.state) memoriser(r.state);
    return r;
  }
  const MOTIFS = { aucune: "Aucune pause en cours.", mineur: "Le mode doux reste obligatoire avant 18 ans.", objectif: "Choisis d'abord ton objectif." };
  function exiger(r) {
    if (r && r.ok === false) throw erreur(MOTIFS[r.why] || "Action refusée (" + r.why + ").", { hint: "refus", why: r.why, reponse: r });
    return r;
  }
  const sansRejet = p => p.catch(e => ({ ok: false, why: e.why || e.hint || "erreur", message: e.message }));
  const meta = p => { const m = {}; if (p.club) m.club = String(p.club); if (p.simulee) m.simulated = true; if (p.accessoire) m.accessory = true; return m; };
  const num = x => (x == null || x === "" || !isFinite(+x) ? null : +x);
  async function oublier() {
    await coffre.effacer();
    S = null; cache = null; recuA = 0; M.uid = null; M.anonyme = null; M.reprise = null; M.acces = null; essaisReprise = 0;
    lsEcrire(CLE_ETAT, null); lsEcrire(CLE_REPRISE, null);
  }

  /* ---------- mode démo : le serveur simulé par HMGV, sur l'appareil ---------- */
  let sallesDemo = [];
  const demo = {
    actif: () => !!lsLire(CLE_DEMO, null),
    donnees: () => lsLire(CLE_DEMO, null) || { dossier: null, decalage: 0 },
    ouvrir() {
      const V = W.HMGV, clubs = typeof CLUBS !== "undefined" ? CLUBS : W.CLUBS, pos = typeof PRE !== "undefined" ? PRE : W.PRE;
      if (Array.isArray(clubs)) {
        sallesDemo = clubs.map(c => { const q = pos && pos[c.id]; return q ? { id: c.id, name: "Fitness Park " + c.n, brand: "Fitness Park", address: c.a || null,
          postcode: c.cp || null, city: c.c || null, lat: q[0], lon: q[1], precise: false, active: !c.s, source: "fitnesspark" } : null; }).filter(Boolean);
        V.salles(sallesDemo);
      }
    },
    maintenant() { return maintenant() + (+demo.donnees().decalage || 0); },
    rpc(nom, a) {
      const V = W.HMGV, D = demo.donnees(), t = demo.maintenant();
      if (!D.dossier) D.dossier = V.nouveau({ no: 10000 + Math.floor(Math.random() * 90000), pseudo: lsLire("hmg-pseudo", null) });
      const d = D.dossier, pos = { lat: num(a.p_lat), lon: num(a.p_lon), acc: num(a.p_acc) };
      let r;
      switch (nom) {
        case "my_state": r = V.etat(d, t); break;
        case "set_goal": r = V.objectif(d, a.p_goal, t); break;
        case "session_start": r = V.debut(d, Object.assign(pos, { club: a.p_meta && a.p_meta.club }), t); break;
        case "session_confirm": r = V.fin(d, Object.assign(pos, { session: a.p_session }), t); break;
        case "pause_start": r = V.pause(d, a.p_kind, a.p_weeks, t); break;
        case "pause_end": r = V.finPause(d, t); break;
        case "set_soft_mode": r = V.doux(d, !!a.p_on, t); break;
        case "set_birth_year": r = V.naissance(d, a.p_year, t); break;
        case "set_home_club": r = V.salle(d, a.p_club, t); break;
        case "ack_bilan": r = V.vu(d, a.p_week, t); break;
        case "open_chest": r = V.coffre(d, a.p_key, !!a.p_empty, t); break;
        case "set_pseudo_v2": d.pseudo = String(a.p_pseudo || "").trim().slice(0, 20) || null; r = { ok: true }; break;
        case "account_status": r = { access: true, player: true, no: d.no, anonymous: true, admin: false, mode: "demo" }; break;
        case "my_export": r = { exported_at: new Date(t).toISOString(), demo: true, dossier: d }; break;
        case "delete_account": D.dossier = null; r = { ok: true }; break;
        case "gyms_near": {
          const o = V.outils, n = Math.max(1, Math.min(100, a.p_limit || 20));
          r = sallesDemo.map(s => Object.assign({}, s, { dist: Math.round(o.distM(pos.lat, pos.lon, s.lat, s.lon)) })).sort((x, y) => x.dist - y.dist).slice(0, n);
          break;
        }
        case "gyms_search": {
          const pli = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), q = pli(a.p_q).trim();
          r = q.length < 2 ? [] : sallesDemo.filter(s => pli([s.name, s.city, s.postcode, s.address].join(" ")).includes(q)).slice(0, Math.max(1, Math.min(100, a.p_limit || 20)));
          break;
        }
        default: throw erreur("« " + nom + " » n'existe pas en mode démo.", { hint: "demo" });
      }
      lsEcrire(CLE_DEMO, D);
      return JSON.parse(JSON.stringify(r));
    },
  };
  const outilsDemo = {
    actif: demo.actif,
    activer() { lsEcrire(CLE_DEMO, demo.donnees()); cache = null; demarrage = null; M.mode = "demarrage"; return pret(); },
    couper() { lsEcrire(CLE_DEMO, null); lsEcrire(CLE_ETAT, null); cache = null; demarrage = null; M.mode = "demarrage"; return pret(); },
    dossier: () => demo.donnees().dossier,
    async avancer(heures) {
      const D = demo.donnees(); D.decalage = (+D.decalage || 0) + (+heures || 0) * 3600e3; lsEcrire(CLE_DEMO, D);
      return etat({ frais: true });
    },
    async regler(champs) { const D = demo.donnees(); if (D.dossier) W.HMGV.regler(D.dossier, champs || {}); lsEcrire(CLE_DEMO, D); return etat({ frais: true }); },
    async seance(id) {                                       // une séance validée tout de suite (le temps avance de 21 minutes)
      await pret();
      if (M.mode !== "demo") throw erreur("Le mode démo n'est pas allumé.", { hint: "demo" });
      const st = demo.rpc("my_state", {}), s = sallesDemo.find(x => x.id === (id || st.home_club)) || sallesDemo.find(x => x.active);
      if (!s) throw erreur("Aucune salle connue en mode démo.", { hint: "demo" });
      const a = demo.rpc("session_start", { p_lat: s.lat, p_lon: s.lon, p_acc: 10, p_meta: { club: s.id } });
      if (!a.ok) return a;
      const D = demo.donnees(); D.decalage = (+D.decalage || 0) + 21 * 60e3; lsEcrire(CLE_DEMO, D);
      const b = demo.rpc("session_confirm", { p_session: a.session.id, p_lat: s.lat, p_lon: s.lon, p_acc: 10 });
      if (b.state) memoriser(b.state);
      return b;
    },
  };
  try {                                                      // ?hmgs=demo allume le mode démo, ?hmgs=serveur l'éteint
    const q = W.location && new URL(W.location.href).searchParams.get("hmgs");
    if (q === "demo" && !demo.actif()) lsEcrire(CLE_DEMO, { dossier: null, decalage: 0 });
    if (q === "serveur") { lsEcrire(CLE_DEMO, null); lsEcrire(CLE_ETAT, null); lsEcrire(CLE_SERVEUR, null); cache = null; }
  } catch (e) { /* rien */ }

  /* ---------- l'API ---------- */
  const HMGS = {
    version: 1,
    Erreur: ErreurHMGS,
    pret, statut, etat, etatCache,
    rpc: (nom, args) => appel(nom, args),
    admin: (nom, args) => appel(nom, args, { admin: true }),
    // jeu
    objectif: async (v, o) => { if (o && o.inscription) await avantEcriture(); return action("set_goal", { p_goal: v }); },
    pause: n => action("pause_start", { p_kind: "pause", p_weeks: n }),
    hiberner: () => action("pause_start", { p_kind: "hibernation", p_weeks: 1 }),
    finPause: () => action("pause_end").then(exiger),
    doux: on => action("set_soft_mode", { p_on: !!on }).then(exiger),
    naissance: annee => action("set_birth_year", { p_year: annee }),
    maSalle: id => sansRejet(action("set_home_club", { p_club: id || null })),
    ackBilan: semaine => sansRejet(action("ack_bilan", { p_week: semaine })),
    coffre: (cle, vide) => action("open_chest", { p_key: cle, p_empty: !!vide }),
    seanceDebut: p => { p = p || {}; return action("session_start", { p_lat: num(p.lat), p_lon: num(p.lon), p_acc: num(p.acc), p_meta: meta(p) }); },
    seanceFin: (id, p) => { p = p || {}; return action("session_confirm", { p_session: id, p_lat: num(p.lat), p_lon: num(p.lon), p_acc: num(p.acc), p_meta: meta(p) }); },
    classement: periode => appel("leaderboard_v2", { p_period: periode || "month" }),
    semainePassee: () => appel("prev_week_v2"),
    score: () => appel("my_score_v2"),
    sallesProches: (lat, lon, n) => appel("gyms_near", { p_lat: num(lat), p_lon: num(lon), p_limit: n || 20 }),
    chercherSalles: (q, n) => appel("gyms_search", { p_q: String(q || ""), p_limit: n || 20 }),
    charger: () => appel("load_game"),
    sauver: (emplacement, data, version) => appel("save_game", { p_slot: emplacement, p_data: data, p_version: version }),
    // compte
    compte: () => appel("account_status"),
    pseudo: p => sansRejet(avantEcriture().then(() => appel("set_pseudo_v2", { p_pseudo: p }))),
    pseudoLibre: p => appel("pseudo_check_v2", { p_pseudo: p }),
    invitation: async code => {
      const r = await appel("redeem_invite", { p_code: String(code || "").trim() });
      if (r && r.ok) { acces(true); refuses.clear(); etat({ frais: true }); }
      return r;
    },
    reprendreCompte: async (cle, etoiles) => {
      const r = await appel("claim_legacy_account", { p_key: String(cle || "").trim(), p_old_stars: etoiles == null ? etoilesAnciennes() : etoiles });
      if (M.mode === "serveur" && r && r.ok) { const v = lsLire("hmg-voter", null); noterReprise(r, S && S.uid, /^[0-9a-f]{32}$/.test(v || "") ? empreinte(v) : null); }
      else if (r && r.state) memoriser(r.state);
      return r;
    },
    codeTransfert: () => appel("create_transfer_code"),
    transfert: code => action("redeem_transfer_code", { p_code: String(code || "").trim() }),
    exporter: async () => {
      let d = null; try { d = await appel("my_export"); } catch (e) { return null; }
      if (d && typeof d === "object") d.appareil = { jeu: lsLire("hmg-game", null), objectif: lsLire("hmg-objectif", null),
                                                     ma_salle: lsLire("hmg-ma-salle", null), mes_salles: lsLire("hmg-my-visits", null) };
      return d;
    },
    supprimerCompte: async () => {
      const r = exiger(await appel("delete_account"));
      if (M.mode === "demo") { lsEcrire(CLE_ETAT, null); cache = null; } else await oublier();
      return r;
    },
    // avis et modération
    avis: (club, note, commentaire) => appel("post_review_v2", { p_club: club, p_rating: note, p_comment: commentaire == null ? null : String(commentaire) }),
    vote: (id, valeur) => appel("vote_review_v2", { p_review: id, p_value: valeur }),
    signaler: (type, cible, raison, note) => appel("report_content", { p_kind: type, p_target: String(cible), p_reason: raison, p_note: note == null ? null : String(note) }),
    masquer: no => appel("block_member", { p_no: +no }),
    demasquer: no => appel("unblock_member", { p_no: +no }),
    masques: () => appel("my_blocks"),
    demo: outilsDemo,
  };
  W.HMGS = HMGS;
  setTimeout(() => { pret(); }, 0);                          // démarre tout de suite (session, reprise), sans bloquer la page
})(typeof window !== "undefined" ? window : globalThis);
