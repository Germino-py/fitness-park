"use strict";
/* =====================================================================================
   HÉROS « Chibi Volt » (v2) — le petit héros de l'Aventure HMG, ses objets, « Ma collection » et « Choisis ton héros »
   Chargé AVANT js/app.js. Tout est global (script classique) et préfixé hv / hc / hero pour ne rien écraser.
   Le dessin ne lit les données du jeu (GM_LG, GM_IT, gmHeroLv, gmS…) qu'au moment où on dessine.

   drawHero(eq, opt) -> chaîne SVG du héros. Même repère que l'ancien gmBot : viewBox -40 -94 80 98, pieds en (0,0).
     gmBot(eq, o) (js/app.js) n'est plus qu'une enveloppe : gmBot(eq, o) === drawHero(eq, o).
     eq  : {hero, tone, skin, legs, feet, hat, neck, face, back, hand, aura}  (ids d'objets de GM_ITEMS, inchangés)
           hero : "homme" | "femme" | "robot" | une légende ("l_masse", "l_classique", "l_coach", "l_reine")
           tone : "clair" | "hale" | "brun" | "fonce"  (robot : Blanc, Titane, Cuivre, Noir), voir gmTones(hero)
     opt :
       cls    : humeur, en classes CSS : "idle" (attente), "happy idle" (content), "walk" (marche),
                "happy cheer" (acclamation), "cold" (a froid), "sleep" (endormi). Défaut "idle".
                « A froid » marche aussi avec .cold posé sur le parent (#gmHero.cold > .hh).
       dyn    : true = les 5 visages sont inclus, changer seulement la classe change l'humeur (héros de la carte, gmHeroCls)
       mus    : palier de muscles forcé 0 Crevette … 5 Colosse (sinon gmHeroLv() ; les légendes ont leur propre palier)
       etat   : état de forme lié aux cœurs (1-jeu-vies.md §5.5, 3-ux-appli.md §4) :
                  ""             en forme
                  "malade"       0 cœur : nez rouge, thermomètre, petite couverture, yeux mi-clos, teint pâle (couleurs
                                 désaturées de 30 %), démarche lente, et UN PALIER DE MUSCLE EN MOINS à l'affichage
                                 (passer le palier réel : drawHero retire lui-même le palier ; Crevette reste Crevette)
                  "convalescent" 1re séance de guérison faite : écharpe, tasse fumante, couleurs à −15 %
                  "pause"        cœurs gelés : bonnet HMG (s'il n'a rien sur la tête), visage détendu, voile givré,
                                 flocons et glace sous les pieds
                Sans etat (undefined), le héros DU JOUEUR (eq === gmS.eq, pas lite) suit window.HMG_HEROS_ETAT,
                posé par js/coeurs.js ("malade" | "convalescent" | "pause" | null). Une copie de gmS.eq ({...gmS.eq}),
                un fantôme, le classement, la carte des autres : jamais d'état. etat:"" force « en forme ».
                Affecter window.HMG_HEROS_ETAT redessine tout seul #gmHero (humeur gardée) et « Ma collection ».
                Le SVG porte alors la classe hv-malade / hv-convalescent / hv-pause (et data-et, gardé par gmHeroCls).
       lite   : héros « fantôme » : aplats, sans lumière ni animation (classe hv-lite), le plus léger possible
       static : SVG autonome (xmlns, width = w, height = h) pour l'export canvas (partage). Sans « Z z » ni buée.
       pad    : socle holographique Volt sous les pieds (collection, choix du héros, coffre)
       vb     : viewBox personnalisée (rare)
     Cache : les rendus identiques sont gardés (modèle + identifiants uniques à chaque copie), la carte reste fluide.

   drawItem(id)     -> icône SVG d'un objet seul (collection). Mise en cache aussi.
   gmTones(hero)    -> [{k, n, c}] : teintes proposées pour ce héros, dans l'ordre d'affichage
                       (k = valeur de gmS.eq.tone, n = libellé, c = couleur de la pastille)
   heroColl()       -> ouvre l'écran plein écran « Ma collection » (appelé par gmColl)
   heroPickHtml()   -> contenu de la fenêtre « Choisis ton héros » (la logique reste dans gmPickHero, js/app.js)
   heroEtat(e)      -> lit (sans argument) ou change l'état du héros du joueur, comme window.HMG_HEROS_ETAT
   heroLvAff()      -> palier de muscles AFFICHÉ (un de moins quand il est malade) : HUD, onglet Moi
   heroNouveaux()   -> ids des objets gagnés jamais regardés (pastille « NOUVEAU » ; gmS.vus garde les objets vus)
   heroVibre(kind)  -> petite vibration (pont natif HMGN, sinon Capacitor Haptics, sinon navigator.vibrate)
   heroIncarne(k) / heroQuitte() -> incarner une légende / revenir à son héros (gmS.eq.base, tenue gardée dans gmS.legPrev)
   ===================================================================================== */
const HV_INK = "#0d1322", HV_VOLT = "#c8ff1e";
const HV_TONE = {
  human: {
    clair: { s: "#ffe1cd", m: "#f5c2a2", d: "#dc9b7c", ln: "#c47b5c", h: "#4b2c1b", hl: "#8f5f3d", ir: "#8a5a3c", bl: "#ff8fa6" },
    hale:  { s: "#f2c49e", m: "#dfa278", d: "#c07e56", ln: "#a3653f", h: "#2f1c11", hl: "#6f4829", ir: "#6e4428", bl: "#ff8a8a" },
    brun:  { s: "#cb8f64", m: "#ae7249", d: "#8d5534", ln: "#6c3c20", h: "#1e130c", hl: "#5c3c26", ir: "#5a3420", bl: "#ff7f86" },
    fonce: { s: "#93603e", m: "#77482b", d: "#58331d", ln: "#3e2112", h: "#140e0b", hl: "#54392b", ir: "#4a2a1a", bl: "#ff6f8a" }
  },
  robot: {
    clair: { s: "#f7f9fe", m: "#d5dcea", d: "#9ca8c0", j: "#4a5470", ln: "#8a95ae" },
    fonce: { s: "#58627d", m: "#394159", d: "#212637", j: "#0c0f17", ln: "#151a26" },
    hale:  { s: "#cfd7e2", m: "#9ba7b9", d: "#67728a", j: "#2b3142", ln: "#58637a" },
    brun:  { s: "#f8c4a0", m: "#de9367", d: "#aa5f37", j: "#3c2418", ln: "#8a4a2a" }
  }
};
HV_TONE.human.bronze = { s: "#f0b88c", m: "#d8945f", d: "#b4703f", ln: "#97592f", h: "#24160d", hl: "#6a4426", ir: "#6e4428", bl: "#ff8a7a" };
HV_TONE.robot.bronze = HV_TONE.robot.hale;
/* les 4 teintes, dans l'ordre d'affichage : [clé, peau humaine, finition du robot]. Hâlée et Mate sont nouvelles (25/11/2026). */
const HV_TONES = [["clair", "Claire", "Blanc"], ["hale", "Hâlée", "Titane"], ["brun", "Mate", "Cuivre"], ["fonce", "Noire", "Noir"]];
const HV_SW = { human: { clair: "#ffe1cd", hale: "#f2c49e", brun: "#cb8f64", fonce: "#93603e" }, robot: { clair: "#f7f9fe", hale: "#9ba7b9", brun: "#de9367", fonce: "#394159" } };
/* teintes proposées pour un héros (une légende prend celles de son héros de base) : [{k, n, c}] */
function gmTones(hero) {
  const L = hvSafe(() => GM_LG[hero]), rob = (L ? L.base : hero) === "robot";
  return HV_TONES.map(([k, hn, rn]) => ({ k, n: rob ? rn : "Peau " + hn.toLowerCase(), c: HV_SW[rob ? "robot" : "human"][k] }));
}

/* palettes des objets : [clair, moyen, sombre] */
const HV_TEE = { blanc: ["#ffffff", "#e9eef7", "#b3bed3"], volt: ["#f4ffc4", "#c8ff1e", "#86b800"], braise: ["#ffd5bb", "#ff7a3d", "#c4400f"],
  ocean: ["#d6f7ff", "#3fd8ff", "#1675a8"], chrome: ["#7d879d", "#30384a", "#10141e"], or: ["#fff6c2", "#ffd166", "#c08600"], galaxie: ["#e2caff", "#7b5cff", "#2a1670"] };
const HV_LOGO = { blanc: HV_VOLT, volt: "#121a06", braise: "#fff3e6", ocean: "#ffffff", chrome: HV_VOLT, or: "#6b4700", galaxie: "#ffffff" };
const HV_BOT = { short_noir: { c: ["#56617a", "#262e40", "#121722"], s: HV_VOLT }, jogging: { c: ["#b2bacb", "#848ea3", "#565f74"], s: "#454d61", long: 1 },
  short_volt: { c: ["#f0ffb4", "#c8ff1e", "#86b800"], s: "#121a06" }, legging: { c: ["#ff86e4", "#c34fe6", "#5f35d0"], s: "#ffc2f3", long: 1 },
  short_or: { c: ["#fff4b8", "#ffd166", "#c08600"], s: "#fff8d6" } };
const HV_SHOE = { baskets: { u: ["#4a5468", "#1d2332"], so: "#eef2fa", a: HV_VOLT }, baskets_bl: { u: ["#ffffff", "#dde3ee"], so: "#c4ccdc", a: "#1d2332" },
  baskets_volt: { u: ["#f0ffb4", "#c8ff1e"], so: "#16200a", a: "#16200a" }, montantes: { u: ["#ff7a8c", "#e0264a"], so: "#ffffff", a: "#ffffff", hi: 1 },
  baskets_or: { u: ["#fff4b8", "#ffc94d"], so: "#a87400", a: "#ffffff" } };
/* paliers de muscles : épaules S, taille W, bras A, biceps B, jambes L, trapèzes T */
const HV_MUS = [{ S: 9.6, W: 8.2, A: 4.2, B: 0, L: 4.6, T: 0 }, { S: 11, W: 8.8, A: 5, B: .6, L: 5.1, T: .3 }, { S: 12.6, W: 9.4, A: 5.9, B: 1.2, L: 5.7, T: .9 },
  { S: 14.4, W: 10, A: 6.9, B: 1.9, L: 6.3, T: 1.7 }, { S: 16.2, W: 10.6, A: 7.9, B: 2.6, L: 6.9, T: 2.6 }, { S: 18, W: 11.2, A: 8.9, B: 3.3, L: 7.5, T: 3.6 }];
/* les 4 légendes : palier de muscles et coiffure propres */
const HV_LEGX = { l_masse: { mus: 5, hair: "chauve", beard: 1 }, l_classique: { mus: 4, hair: "court", beard: 1 }, l_coach: { mus: 3, hair: "court", beard: 1 }, l_reine: { mus: 3, hair: "blond" } };

const HV_LIFT = 3, HV_HS = .9; /* jambes allongées de 3 unités, tête à 90 % */
const hvR = n => Math.round(n * 100) / 100;
const hvD = (s, ...v) => s.reduce((a, x, i) => a + x + (i < v.length ? (typeof v[i] === "number" ? hvR(v[i]) : v[i]) : ""), "");
let hvUid = 0;

/* contexte de dessin : dégradés dédoublonnés par SVG. Le modèle est écrit avec l'identifiant HV_TOK,
   remplacé à chaque copie par un identifiant unique (hv1, hv2…) : Safari et l'export canvas restent justes. */
const HV_TOK = "HVUID";
function hvCtx(lite, u) {
  const defs = [], seen = {};
  const stops = st => st.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ""}/>`).join("");
  const C = {
    u, lite, defs,
    lg(k, st, x1 = 0, y1 = 0, x2 = 0, y2 = 1) { if (lite) return st[Math.min(st.length - 1, 1)][1]; const id = u + k; if (!seen[id]) { seen[id] = 1; defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(st)}</linearGradient>`); } return `url(#${id})`; },
    rg(k, st, cx = .5, cy = .5, r = .5) { if (lite) return st[Math.min(st.length - 1, 1)][1]; const id = u + k; if (!seen[id]) { seen[id] = 1; defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(st)}</radialGradient>`); } return `url(#${id})`; },
    /* matière : clair en haut à gauche, sombre en bas à droite */
    mat(k, P, flip) { return C.lg(k, [[0, P[0]], [.5, P[1]], [1, P[2] || P[1]]], flip ? 1 : 0, 0, flip ? 0 : 1, 1); },
    clip(k, d) { const id = u + k; defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`); return `url(#${id})`; },
    sk(w = 1.3) { return `stroke="${HV_INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`; },
    rim(d, w = 1, op = .7) { return lite ? "" : `<path d="${d}" fill="none" stroke="${HV_VOLT}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`; },
    shine(d, op = .55) { return lite ? "" : `<path d="${d}" fill="#fff" opacity="${op}"/>`; }
  };
  return C;
}

function hvGeo(hero, lv) {
  const G = HV_MUS[lv], g = { ...G };
  if (hero === "femme") { g.S = G.S * .9; g.W = G.W * .92; g.A = G.A * .88; g.B = G.B * .72; g.L = G.L * .95; g.T = G.T * .45; }
  g.lv = lv; g.y0 = -36; g.y1 = -15; g.lx = g.W * .5; g.ang = 5 + lv * 2.2; g.px = g.S - g.A * .32; g.py = g.y0 + 3.6; g.hr = 3 + lv * .2; g.hy = 16.4 + lv * .3;
  /* angle des bras pour se serrer quand il fait froid (les mains se rejoignent au ventre) */
  g.hug = Math.round(66 + g.ang);
  return g;
}
function hvTorso(g, o = 0) {
  const S = g.S + o, W = g.W + o, y0 = g.y0 - o, y1 = g.y1 + o, T = g.T;
  return hvD`M${-S + 2.5} ${y0 + .5}C${-S + 5} ${y0 - T * .7} -7 ${y0 - T} -4 ${y0 - T - .4}H4C7 ${y0 - T} ${S - 5} ${y0 - T * .7} ${S - 2.5} ${y0 + .5}Q${S + .6} ${y0 + 1} ${S + .3} ${y0 + 4.5}C${S} ${y0 + 11} ${W + .8} ${y1 - 7} ${W} ${y1 - 2.5}Q${W} ${y1} ${W - 2.5} ${y1}H${-W + 2.5}Q${-W} ${y1} ${-W} ${y1 - 2.5}C${-W - .8} ${y1 - 7} ${-S} ${y0 + 11} ${-S - .3} ${y0 + 4.5}Q${-S - .6} ${y0 + 1} ${-S + 2.5} ${y0 + .5}Z`;
}
function hvArmD(g) { const a = g.A / 2, b = g.B, e = g.hy - 15.6;
  return hvD`M${-a} .5C${-a} -3 ${a} -3 ${a} .5C${a + b * .9} 3.5 ${a + b * .5} ${7.5 + e * .5} ${a * .82} ${10 + e * .6}C${a * .9} ${12 + e} ${a * .9} ${13.5 + e} ${a * .85} ${15 + e}H${-a * .85}C${-a * .9} ${13.5 + e} ${-a * .9} ${12 + e} ${-a * .82} ${10 + e * .6}C${-a - b * 1.1} ${8 + e * .5} ${-a - b * 1.1} 3.5 ${-a} .5Z`; }
function hvSleeveD(g) { const a = g.A / 2 + .8, b = g.B;
  return hvD`M${-a} .5C${-a} -3.5 ${a} -3.5 ${a} .5C${a + b * .85} 3 ${a + b * .7} 5.6 ${a + b * .5} 7.2Q0 8.6 ${-a - b * .85} 7.2C${-a - b * 1.05} 5.6 ${-a - b * 1} 3 ${-a} .5Z`; }
function hvShortsD(g, hb, ex = 0) { const W = g.W + .6 + ex, top = -18.9;
  return hvD`M${-W} ${top}H${W}L${W + .8} ${hb - 1.2}Q${W + .8} ${hb} ${W - .6} ${hb}H1.3L0 ${hb - 2.8}L-1.3 ${hb}H${-W + .6}Q${-W - .8} ${hb} ${-W - .8} ${hb - 1.2}Z`; }
const hvBolt = (x, y, s, fill, stroke) => `<path d="${hvD`M${x + .6 * s} ${y - 3.2 * s}L${x - 1.8 * s} ${y + .4 * s}H${x - .1 * s}L${x - .7 * s} ${y + 3.2 * s}L${x + 1.9 * s} ${y - .5 * s}H${x + .2 * s}Z`}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${.5 * s}" stroke-linejoin="round"` : ""}/>`;
const hvStar = (x, y, r, fill) => `<path d="${hvD`M${x} ${y - r}Q${x + r * .18} ${y - r * .18} ${x + r} ${y}Q${x + r * .18} ${y + r * .18} ${x} ${y + r}Q${x - r * .18} ${y + r * .18} ${x - r} ${y}Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z`}" fill="${fill}"/>`;

/* ---------- pièces d'équipement (réutilisées par le héros ET par les icônes) ---------- */
function hvTee(C, g, id, rob, fem, T) {
  const P = HV_TEE[id] || HV_TEE.blanc, d = hvTorso(g, .7), y0 = g.y0 - .7, y1 = g.y1 + .7, W = g.W + .7, S = g.S + .7, p = [];
  p.push(`<path d="${d}" fill="${C.mat("tee", P)}" ${C.sk()}/>`);
  const cl = C.clip("ctee", d), q = [];
  if (id === "galaxie") { q.push(`<ellipse cx="${-S * .3}" cy="-24" rx="${S * .9}" ry="4" fill="#ff7ae0" opacity=".35" transform="rotate(-18 0 -24)"/>`);
    [[-.55, -29, .7], [.4, -22, .55], [.62, -31, .8], [-.2, -18.5, .5], [.1, -27.5, .45], [-.7, -21, .5]].forEach(([x, y, r]) => q.push(`<circle cx="${x * S}" cy="${y}" r="${r}" fill="#fff"/>`)); }
  if (id === "ocean") q.push(`<path d="${hvD`M${-S} -21Q${-S * .5} -23.4 0 -21T${S} -21V${y1 + 1}H${-S}Z`}" fill="${P[2]}" opacity=".35"/>`);
  if (id === "braise") q.push(`<path d="${hvD`M${-S} ${y1}L${-S * .7} -19.6L${-S * .45} ${y1 - 1}L${-S * .15} -20.4L${S * .12} ${y1 - 1.2}L${S * .42} -19.4L${S * .7} ${y1 - .8}L${S} -20V${y1 + 1}H${-S}Z`}" fill="${P[2]}" opacity=".45"/>`);
  if (id === "chrome" || id === "or") q.push(`<path d="${hvD`M${-S * .2} ${y0 - 4}L${S * .25} ${y0 - 4}L${-S * .1} ${y1 + 2}L${-S * .55} ${y1 + 2}Z`}" fill="#fff" opacity="${id === "or" ? .3 : .14}"/>`);
  /* tension du t-shirt quand ça pousse */
  const lv = g.lv;
  if (lv >= 3) q.push(`<path d="${hvD`M${-S + 2.2} ${y0 + 6}q2.6 1.4 4.6 .4M${S - 2.2} ${y0 + 6}q-2.6 1.4 -4.6 .4M${-S * .55} -24.6q${S * .3} 1.6 ${S * .5} .2M${S * .55} -24.6q${-S * .3} 1.6 ${-S * .5} .2`}" stroke="${P[2]}" stroke-width=".8" fill="none" opacity=".7" stroke-linecap="round"/>`);
  q.push(`<path d="${hvD`M${-W - .4} ${y1 - 1.6}Q0 ${y1 - .4} ${W + .4} ${y1 - 1.6}`}" stroke="${P[2]}" stroke-width=".9" fill="none" opacity=".6"/>`);
  if (!C.lite) q.push(`<path d="${hvD`M${S - 1} ${y0 + 4}C${S - 1.2} ${y0 + 11} ${W} ${y1 - 7} ${W - .8} ${y1 - 2.6}`}" stroke="${id === "volt" ? "#fff" : HV_VOLT}" stroke-width="1" fill="none" opacity="${id === "volt" ? .5 : .75}" stroke-linecap="round"/>`);
  p.push(`<g clip-path="${cl}">${q.join("")}</g>`);
  /* encolure */
  const ny = y0 - g.T - .3;
  if (!rob) p.push(`<path d="${hvD`M-5.2 ${ny}Q0 ${y0 + 3.6 - g.T * .2} 5.2 ${ny}Z`}" fill="${T.d}" ${C.sk(1)}/>`);
  else p.push(`<path d="${hvD`M-5.2 ${ny}Q0 ${y0 + 3.2 - g.T * .2} 5.2 ${ny}Z`}" fill="${T.j}" ${C.sk(1)}/>`);
  p.push(`<path d="${hvD`M-5.6 ${ny + .2}Q0 ${y0 + 4.6 - g.T * .2} 5.6 ${ny + .2}`}" stroke="${P[2]}" stroke-width="1.1" fill="none"/>`);
  if (id === "chrome") p.push(`<path d="${hvD`M-6 ${ny + 1}Q0 ${y0 + 5.8 - g.T * .2} 6 ${ny + 1}`}" stroke="${HV_VOLT}" stroke-width=".8" fill="none"/>`);
  if (id === "or") p.push(hvStar(S * .45, -30, 1.6, "#fff"));
  p.push(hvBolt(0, -25.6, 1.25, HV_LOGO[id] || HV_VOLT, id === "blanc" ? HV_INK : null));
  return p.join("");
}
function hvTeeSleeve(C, g, id, flip) { const P = HV_TEE[id] || HV_TEE.blanc;
  return `<path d="${hvSleeveD(g)}" fill="${C.mat(flip ? "slB" : "slA", P, flip)}" ${C.sk()}/><path d="${hvD`M${-g.A / 2 - .4 - g.B * .8} 5.6Q0 6.9 ${g.A / 2 + .4 + g.B * .5} 5.6`}" stroke="${P[2]}" stroke-width=".8" fill="none" opacity=".7"/>`; }

function hvBottoms(C, g, id, part) {
  /* part "hip" : la culotte du short ; part "leg" : le tube d'une jambe (pantalon long) */
  const B = HV_BOT[id];
  if (!B) { /* caleçon à pois (le départ) */
    const d = hvShortsD(g, -10.6, .2), cl = C.clip("ccal", d), W = g.W;
    const dots = [[-.72, -15.2], [-.3, -16.6], [.22, -15], [.66, -16.4], [-.84, -12.2], [.76, -12.4], [-.44, -12.8], [.1, -13.4], [.46, -12.8]].map(([x, y]) => `<circle cx="${hvR(x * W)}" cy="${y}" r=".95" fill="#fff" opacity=".95"/>`).join("");
    return `<path d="${d}" fill="${C.mat("cal", ["#a8e0ff", "#6ec6ff", "#3d97d6"])}" ${C.sk()}/><g clip-path="${cl}">${dots}<path d="M0 -16.6V-13" stroke="#3d97d6" stroke-width=".8"/></g><rect x="${hvR(-W - 1)}" y="-19.6" width="${hvR(2 * W + 2)}" height="2.8" rx="1.4" fill="#f4f8ff" ${C.sk(1.1)}/>`;
  }
  if (part === "leg") return "";
  if (B.long) { const d = hvShortsD(g, -11.4, .3), W = g.W + .9;
    return `<path d="${d}" fill="${C.mat("bot", B.c)}"/><path d="${hvD`M${-W - .8} -12.6L${-W} -18.9H${W}L${W + .8} -12.6`}" fill="none" ${C.sk()}/><rect x="${hvR(-W - .4)}" y="-19.8" width="${hvR(2 * W + .8)}" height="2.8" rx="1.4" fill="${B.c[2]}" ${C.sk(1.1)}/>${id === "jogging" ? `<path d="M-1.2 -17.2l-.7 3.2M1.2 -17.2l.7 3.2" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".8"/>` : `<path d="${hvD`M${-W + 1} -18.4H${W - 1}`}" stroke="${B.s}" stroke-width=".7" opacity=".7"/>`}`; }
  const d = hvShortsD(g, -9), W = g.W + .6;
  return `<path d="${d}" fill="${C.mat("bot", B.c)}" ${C.sk()}/><path d="${hvD`M${W - .6} -17L${W + .2} -10.2M${-W + .6} -17L${-W - .2} -10.2`}" stroke="${B.s}" stroke-width="1.3" stroke-linecap="round"/><rect x="${hvR(-W - .3)}" y="-19.8" width="${hvR(2 * W + .6)}" height="2.8" rx="1.4" fill="${B.c[2]}" ${C.sk(1.1)}/>${id === "short_or" && !C.lite ? `<path d="${hvD`M${-W * .6} -16.4L${-W * .25} -16.4L${-W * .55} -10L${-W * .85} -10Z`}" fill="#fff" opacity=".35"/>` : ""}`;
}
function hvPantLeg(C, g, id, cx) { const B = HV_BOT[id]; if (!B || !B.long) return ""; const L = g.L;
  const d = hvD`M${cx - L / 2 - 1} ${-17 - HV_LIFT}L${cx - L * .46 - .9} -3.4H${cx + L * .46 + .9}L${cx + L / 2 + 1} ${-17 - HV_LIFT}Z`;
  return `<path d="${d}" fill="${C.mat("bot", B.c)}" ${C.sk()}/>${id === "jogging" ? `<rect x="${hvR(cx - L * .46 - 1.2)}" y="-6" width="${hvR(L * .92 + 2.4)}" height="2.9" rx="1.2" fill="${B.s}" ${C.sk(1)}/>` : `<path d="${hvD`M${cx + L * .2} -16L${cx + L * .14} -5`}" stroke="${B.s}" stroke-width=".9" opacity=".6" stroke-linecap="round"/>`}`; }
function hvShoe(C, id, cx, sx, L) {
  const P = HV_SHOE[id]; if (!P) return ""; const w = L * .5 + 2.5, o = sx * .7, p = [];
  if (P.hi) p.push(`<path d="${hvD`M${cx - L * .5 - 1.2} -10.4H${cx + L * .5 + 1.2}L${cx + L * .5 + 1.6} -4H${cx - L * .5 - 1.6}Z`}" fill="${C.lg("shu", [[0, P.u[0]], [1, P.u[1]]])}" ${C.sk(1.2)}/><path d="${hvD`M${cx - L * .5 - 1.2} -9H${cx + L * .5 + 1.2}`}" stroke="#fff" stroke-width="1.2"/>`);
  p.push(`<path d="${hvD`M${cx - w + o} -1C${cx - w + o} -4.8 ${cx - w * .45 + o} -6.8 ${cx + o} -6.8C${cx + w * .45 + o} -6.8 ${cx + w + o} -4.8 ${cx + w + o} -1Z`}" fill="${C.lg("shu", [[0, P.u[0]], [1, P.u[1]]])}" ${C.sk(1.2)}/>`);
  p.push(`<path d="${hvD`M${cx - w - .7 + o} -2.4H${cx + w + .7 + o}Q${cx + w + 1.1 + o} .7 ${cx + w - 1.2 + o} .7H${cx - w + 1.2 + o}Q${cx - w - 1.1 + o} .7 ${cx - w - .7 + o} -2.4Z`}" fill="${P.so}" ${C.sk(1.2)}/>`);
  p.push(`<path d="${hvD`M${cx + o + sx * w * .1} -5.2L${cx + o + sx * (w - .9)} -2.9`}" stroke="${P.a}" stroke-width="1.3" stroke-linecap="round"/>`);
  if (P.hi || id === "baskets") p.push(`<path d="${hvD`M${cx + o - 1.4} -5.6h2.8M${cx + o - 1.2} -4.2h2.4`}" stroke="${P.hi ? "#fff" : HV_VOLT}" stroke-width=".7" stroke-linecap="round" opacity=".9"/>`);
  if (!C.lite) p.push(`<ellipse cx="${hvR(cx + o - w * .35)}" cy="-5.2" rx="1.4" ry=".6" fill="#fff" opacity=".55"/>`);
  return p.join("");
}
function hvHat(C, id, rob, tone) {
  const dy = rob ? ({ bandeau: -8, casquette: -6, bonnet: -6, bonnet_hmg: -6, bonnet_volt: -6, couronne: -1, crete: -2 }[id] || 0) : 0, p = [];
  const dome = (y) => hvD`M-19.9 ${y}C-20.6 -75 -10.8 -81.8 0 -81.8C10.8 -81.8 20.6 -75 19.9 ${y}Z`;
  if (id === "bandeau") { p.push(`<path d="M-19.6 -59.4Q0 -68.4 19.6 -59.4L19.5 -55Q0 -63.8 -19.5 -55Z" fill="${C.lg("hb", [[0, "#ff6a7f"], [1, "#d81e45"]])}" ${C.sk(1.2)}/><path d="M-19.4 -57.2Q0 -66 19.4 -57.2" stroke="#fff" stroke-width=".9" fill="none" opacity=".85"/>`);
    p.push(`<g class="hv-tail" style="transform-origin:19px -57px"><path d="M18.8 -58.6C23.2 -59.8 26.4 -58 27.8 -54.4C25.2 -55.4 22.2 -55.2 19.6 -55.8Z" fill="#e8264a" ${C.sk(1)}/><path d="M18.8 -57C22 -54.6 23.8 -51.4 23.2 -47.8C21.6 -50.8 20.2 -52.8 18.6 -54.4Z" fill="#c81a3c" ${C.sk(1)}/></g>`); }
  if (id === "casquette") { p.push(`<path d="M-19.9 -59.4C-20.4 -72.6 -11 -78.6 0 -78.6C11 -78.6 20.4 -72.6 19.9 -59.4Z" fill="${C.lg("hc", [[0, "#3a4458"], [1, "#151b29"]])}" ${C.sk()}/><path d="M0 -78.6Q-1.6 -69 -.6 -59.6" stroke="#000" stroke-opacity=".35" stroke-width=".9" fill="none"/>${hvBolt(-7.4, -68.4, 1.4, HV_VOLT)}<circle cx="0" cy="-78.6" r="1.6" fill="${HV_VOLT}" ${C.sk(.9)}/><path d="M6 -60.4Q19 -64.2 27.6 -60.4Q27.2 -57.4 20.6 -57.2Q13 -57.2 6 -58.2Z" fill="${C.lg("hcb", [[0, "#2a3244"], [1, "#0d111b"]])}" ${C.sk(1.2)}/><path d="M9.4 -59.4Q19 -61.8 25.8 -59.6" stroke="${HV_VOLT}" stroke-width=".8" fill="none" opacity=".8"/>`); }
  if (id === "bonnet" || id === "bonnet_hmg" || id === "bonnet_volt") {
    const A = id === "bonnet" ? ["#8eeaff", "#3fd8ff", "#1786b8"] : id === "bonnet_hmg" ? ["#3c4559", "#171c29", "#0a0d15"] : ["#f2ffc0", "#c8ff1e", "#86b800"];
    const band = id === "bonnet" ? "#1f9fd0" : id === "bonnet_hmg" ? HV_VOLT : "#121a06", pom = id === "bonnet" ? "#ffffff" : id === "bonnet_hmg" ? HV_VOLT : "#121a06";
    p.push(`<circle cx="0" cy="-83.2" r="4.8" fill="${pom}" ${C.sk(1.2)}/>${C.lite ? "" : `<circle cx="-1.4" cy="-84.8" r="1.5" fill="#fff" opacity=".5"/>`}<path d="${dome(-59)}" fill="${C.mat("hbn", A)}" ${C.sk()}/><path d="M-9.4 -79.4V-64M0 -81.6V-64M9.4 -79.4V-64" stroke="#000" stroke-opacity=".18" stroke-width="1.3"/><rect x="-21" y="-65.4" width="42" height="8" rx="4" fill="${band}" ${C.sk(1.2)}/>`);
    if (id !== "bonnet") p.push(`<text x="0" y="-59.3" text-anchor="middle" font-family="'Space Grotesk','Arial Black',Arial,sans-serif" font-weight="800" font-size="6" letter-spacing=".6" fill="${id === "bonnet_hmg" ? "#121a06" : HV_VOLT}">HMG</text>`);
    else p.push(`<path d="M-17 -61.4H17" stroke="#fff" stroke-width=".8" stroke-dasharray="1.6 1.6" opacity=".6"/>`); }
  if (id === "casque") { p.push(`<path d="M-20.4 -56C-22.4 -84 22.4 -84 20.4 -56" stroke="${HV_INK}" stroke-width="5.4" fill="none" stroke-linecap="round"/><path d="M-20.4 -56C-22.4 -84 22.4 -84 20.4 -56" stroke="#2c3446" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M-12 -76.6Q0 -81.4 12 -76.6" stroke="${HV_VOLT}" stroke-width=".9" fill="none"/>`);
    [-1, 1].forEach(s => p.push(`<rect x="${s < 0 ? -25.6 : 17.4}" y="-62" width="8.2" height="14.4" rx="4.1" fill="${C.lg("hcq", [[0, "#3a4458"], [1, "#11151f"]])}" ${C.sk(1.2)}/><rect x="${s < 0 ? -23.8 : 19.2}" y="-59.6" width="4.6" height="9.6" rx="2.3" fill="none" stroke="${HV_VOLT}" stroke-width="1.1"/>`)); }
  if (id === "crete") p.push(`<path d="M-6.4 -70.4L-10 -85.6L-3 -77L0 -92L3.4 -77L10.4 -85L7.2 -70.4Q0 -74.4 -6.4 -70.4Z" fill="${C.lg("hcr", [[0, "#ff8ae6"], [.6, "#ff4fd8"], [1, "#a0128a"]])}" ${C.sk(1.2)}/><path d="M-1 -88L-.4 -76M5.2 -82.4L3.2 -75" stroke="#fff" stroke-width=".8" opacity=".55" stroke-linecap="round"/>`);
  if (id === "aureole") p.push(`<g class="hv-halo">${C.lite ? "" : `<ellipse cx="0" cy="-89" rx="13" ry="3.8" fill="none" stroke="#ffd166" stroke-opacity=".3" stroke-width="5"/>`}<ellipse cx="0" cy="-89" rx="13" ry="3.8" fill="none" stroke="${HV_INK}" stroke-width="3.6"/><ellipse cx="0" cy="-89" rx="13" ry="3.8" fill="none" stroke="${C.lg("hal", [[0, "#fff6c4"], [1, "#ffc93d"]])}" stroke-width="2"/></g>`);
  if (id === "couronne") p.push(`<g transform="rotate(-6 0 -72)"><path d="M-12.4 -70L-14.6 -85.4L-6.8 -78L0 -89.6L6.8 -78L14.6 -85.4L12.4 -70Q0 -72.8 -12.4 -70Z" fill="${C.lg("hcrw", [[0, "#fff4b8"], [.5, "#ffd166"], [1, "#c48a00"]])}" ${C.sk(1.2)}/><path d="M-12.2 -72.6Q0 -75.4 12.2 -72.6" stroke="#a87400" stroke-width="1" fill="none"/><circle cx="0" cy="-77.2" r="2.1" fill="#ff3b5c" ${C.sk(.8)}/><circle cx="-7" cy="-75.4" r="1.4" fill="#3fd8ff" ${C.sk(.7)}/><circle cx="7" cy="-75.4" r="1.4" fill="${HV_VOLT}" ${C.sk(.7)}/>${[[-14.6, -85.4], [0, -89.6], [14.6, -85.4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff4b8" ${C.sk(.7)}/>`).join("")}${C.lite ? "" : `<path d="M-9 -80L-8 -72.6" stroke="#fff" stroke-width="1" opacity=".7" stroke-linecap="round"/>`}</g>`);
  return dy ? `<g transform="translate(0 ${dy})">${p.join("")}</g>` : p.join("");
}
function hvFace(C, id, rob) {
  const ey = rob ? -58 : -54.4, p = [];
  if (id === "soleil") { const gl = C.lg("gs", [[0, "#ff6be0"], [1, "#4b23c8"]]);
    p.push(`<path d="M-12.6 ${ey - 2}L-18.8 ${ey - 3}M12.6 ${ey - 2}L18.8 ${ey - 3}" stroke="${HV_INK}" stroke-width="1.4" stroke-linecap="round"/>`);
    [-1, 1].forEach(s => p.push(`<rect x="${s < 0 ? -13 : 2}" y="${ey - 4.4}" width="11" height="8.2" rx="3.6" fill="${gl}" ${C.sk(1.3)}/><path d="${hvD`M${s < 0 ? -10.6 : 4.4} ${ey - 2.2}l3.2 -1.2`}" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".85"/>`));
    p.push(`<path d="M-2 ${ey - 1.6}Q0 ${ey - 3} 2 ${ey - 1.6}" stroke="${HV_INK}" stroke-width="1.4" fill="none"/>`); }
  if (id === "cyber") p.push(`<path d="M-19 ${ey - 4.4}Q0 ${ey - 7} 19 ${ey - 4.4}L18.6 ${ey + 3.6}Q0 ${ey + 5.6} -18.6 ${ey + 3.6}Z" fill="${C.lg("gc", [[0, "#9af0ff", .75], [1, "#18a8d8", .6]])}" ${C.sk(1.2)}/><path d="M-15 ${ey - 2.2}Q-4 ${ey - 3.6} 8 ${ey - 2.8}" stroke="#effcff" stroke-width="1.1" fill="none" opacity=".9" stroke-linecap="round"/><path d="M-16 ${ey + 1.6}H16" stroke="#fff" stroke-width=".5" opacity=".35" stroke-dasharray="1 1.4"/><circle cx="15.6" cy="${ey - .2}" r="1.2" fill="${HV_VOLT}"/>`);
  if (id === "coeur") { const h = cx => `<path d="${hvD`M${cx} ${ey + 4.2}C${cx - 7.4} ${ey - .4} ${cx - 4.4} ${ey - 7.4} ${cx} ${ey - 3}C${cx + 4.4} ${ey - 7.4} ${cx + 7.4} ${ey - .4} ${cx} ${ey + 4.2}Z`}" fill="${C.lg("gh", [[0, "#ff8ab4"], [1, "#e0185a"]])}" ${C.sk(1.2)}/><ellipse cx="${cx - 2.6}" cy="${ey - 2.4}" rx="1.4" ry=".8" fill="#fff" opacity=".8" transform="rotate(-30 ${cx - 2.6} ${ey - 2.4})"/>`;
    p.push(`<path d="M-12 ${ey - 1.6}L-18.8 ${ey - 3}M12 ${ey - 1.6}L18.8 ${ey - 3}" stroke="${HV_INK}" stroke-width="1.3" stroke-linecap="round"/>` + h(-7.2) + h(7.2) + `<path d="M-1.8 ${ey - 1.4}H1.8" stroke="${HV_INK}" stroke-width="1.3"/>`); }
  return p.join("");
}
function hvNeck(C, id, g) {
  const P = id === "conva" ? { a: ["#ffc29a", "#ff8a5c", "#d4553a"], s: "#fff3e0", f: "#ffd9c2" } : id === "echarpe_or" ? { a: ["#fff4b8", "#ffd166", "#c48a00"], s: "#fff8dc", f: "#ffe9a3" } : { a: ["#3a4458", "#161b28", "#0b0e16"], s: HV_VOLT, f: HV_VOLT };
  const w = Math.max(11.6, g.S * .8), t = -41.2 - g.T * .5, f = C.mat("sc", P.a);
  return `<path d="M-3 -35.4L-10.4 -20.6L-3.4 -19.6L1.6 -34.4Z" fill="${f}" ${C.sk(1.2)}/><path d="M-9.2 -24.2L-2.8 -23.4M-7.6 -27.6L-1.4 -26.8" stroke="${P.s}" stroke-width="1.4"/><path d="M-10.2 -20.6v2.6M-8.2 -20.3v2.6M-6.2 -20v2.6M-4.2 -19.8v2.6" stroke="${P.f}" stroke-width="1" stroke-linecap="round"/>`
    + `<path d="${hvD`M${-w} ${t}Q0 ${t + 6.4} ${w} ${t}L${w + .6} ${t + 5.4}Q0 ${t + 12.4} ${-w - .6} ${t + 5.4}Z`}" fill="${f}" ${C.sk(1.2)}/><path d="${hvD`M${-w + 1.4} ${t + 2}Q0 ${t + 8} ${w - 1.4} ${t + 2}`}" stroke="${P.s}" stroke-width="1.3" fill="none"/>`;
}
function hvBack(C, id, g, layer) {
  /* layer "b" : derrière le corps ; "f" : devant (bretelles, fermoirs) */
  const S = g.S, W = g.W, p = [];
  if (id === "cape") {
    if (layer === "b") p.push(`<g class="hv-cape"><path d="${hvD`M${-S + 1.5} -36Q0 -38.6 ${S - 1.5} -36L${S + 6.4} -5.6Q${S + 2} -2.6 ${S - 1} -4.6Q${S * .5} -1.6 0 -3.8Q${-S * .5} -1.6 ${-S + 1} -4.6Q${-S - 2} -2.6 ${-S - 6.4} -5.6Z`}" fill="${C.lg("cp", [[0, "#ff5a77"], [1, "#a80f33"]], 0, 0, 1, 1)}" ${C.sk()}/><path d="${hvD`M${-S + 2} -34L${-S - 4.4} -6.4M${S - 2} -34L${S + 4.4} -6.4`}" stroke="#7a0a24" stroke-width="1" opacity=".55"/></g><path d="${hvD`M${-S + .5} -35.4Q${-S - .5} -40.6 -6 -41.4H6Q${S + .5} -40.6 ${S - .5} -35.4Z`}" fill="#c8163f" ${C.sk(1.1)}/>`);
    else p.push(`<circle cx="${hvR(-S + 3.2)}" cy="-34.6" r="1.9" fill="${HV_VOLT}" ${C.sk(.9)}/><circle cx="${hvR(S - 3.2)}" cy="-34.6" r="1.9" fill="${HV_VOLT}" ${C.sk(.9)}/>`);
  }
  if (id === "ailes" && layer === "b") { const wg = `<path d="M0 0C3 -12 15 -21 25 -19C23 -16.4 23 -14 25.6 -11.4C21.6 -11.2 20.4 -9 21.4 -6C17.4 -6.8 15.4 -4.8 15.4 -1.6C11.6 -3.4 7.4 -2.2 4 2.4Z" fill="${C.lg("wg", [[0, "#ffffff"], [1, "#c9dcff"]])}" ${C.sk(1.2)}/><path d="M6 -6C11 -11 17 -14 22 -14.6M7 -2.6C11 -5.6 14.6 -7 18.6 -7.6" stroke="#9fb8e6" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
    p.push(`<g transform="translate(${hvR(S - 4)} -30)"><g class="hv-wr">${wg}</g></g><g transform="translate(${hvR(-S + 4)} -30) scale(-1 1)"><g class="hv-wr">${wg}</g></g>`); }
  if (id === "jetpack") { if (layer === "b") { [-1, 1].forEach(s => { const x = s < 0 ? -S - 6.6 : S - .6;
      p.push(`<g class="hv-jet" style="transform-origin:${hvR(x + 3.6)}px -14px"><path d="${hvD`M${x + 1.2} -15Q${x + 3.6} -1 ${x + 6} -15Z`}" fill="#ffb547"/><path d="${hvD`M${x + 2.4} -15Q${x + 3.6} -7 ${x + 4.8} -15Z`}" fill="#fff4c4"/></g><path d="${hvD`M${x + .8} -18H${x + 6.4}L${x + 5.6} -14.6H${x + 1.6}Z`}" fill="#232a3a" ${C.sk(1.1)}/><rect x="${hvR(x)}" y="-40" width="7.2" height="22.4" rx="3.6" fill="${C.lg("jp", [[0, "#9aa4b8"], [.5, "#5b6579"], [1, "#2a3142"]], 0, 0, 1, 0)}" ${C.sk(1.2)}/><rect x="${hvR(x)}" y="-31" width="7.2" height="3" fill="${HV_VOLT}" ${C.sk(.9)}/>`); }); }
    else p.push(`<path d="${hvD`M${-S + 4.6} -35.4L${-W + 2.4} -21.6M${S - 4.6} -35.4L${W - 2.4} -21.6`}" stroke="${HV_INK}" stroke-width="3.6" stroke-linecap="round"/><path d="${hvD`M${-S + 4.6} -35.4L${-W + 2.4} -21.6M${S - 4.6} -35.4L${W - 2.4} -21.6`}" stroke="#3a4256" stroke-width="2" stroke-linecap="round"/><rect x="-3" y="-27.6" width="6" height="4" rx="1.2" fill="${HV_VOLT}" ${C.sk(.9)}/>`); }
  if (id === "sac") { const bx = -W - 9.6;
    if (layer === "b") p.push(`<g transform="rotate(-8 ${hvR(bx + 7)} -19)"><rect x="${hvR(bx)}" y="-24.4" width="15" height="10.4" rx="4.6" fill="${C.lg("bag", [[0, "#ffab7a"], [1, "#d2541b"]])}" ${C.sk(1.2)}/><rect x="${hvR(bx + 1.2)}" y="-20.6" width="12.6" height="2.4" fill="${HV_VOLT}" ${C.sk(.8)}/><path d="${hvD`M${bx + 2.4} -23.4H${bx + 12.6}`}" stroke="#7a2a08" stroke-width=".8" stroke-dasharray="1 .9"/></g>`);
    else p.push(`<path d="${hvD`M${S - 4} -35.6L${-W - 2} -22`}" stroke="${HV_INK}" stroke-width="3.8" stroke-linecap="round"/><path d="${hvD`M${S - 4} -35.6L${-W - 2} -22`}" stroke="#ff7a3d" stroke-width="2.2" stroke-linecap="round"/>`); }
  return p.join("");
}
function hvHand(C, id) {
  /* repère du bras droit : la main est en (0,15.6) */
  if (id === "haltere") return `<path d="M-6.6 15.6H9.8" stroke="${HV_INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M-6.6 15.6H9.8" stroke="#d5dceb" stroke-width="1.8" stroke-linecap="round"/><rect x="-9.4" y="10.6" width="3.8" height="10" rx="1.5" fill="#2a3142" ${C.sk(1.1)}/><rect x="7.2" y="10.6" width="3.8" height="10" rx="1.5" fill="#2a3142" ${C.sk(1.1)}/><rect x="-9.4" y="14.6" width="3.8" height="2" fill="${HV_VOLT}"/><rect x="7.2" y="14.6" width="3.8" height="2" fill="${HV_VOLT}"/>`;
  if (id === "haltereor") return `<path d="M-7.6 15.6H10.8" stroke="${HV_INK}" stroke-width="3.8" stroke-linecap="round"/><path d="M-7.6 15.6H10.8" stroke="#fff4c4" stroke-width="2.2" stroke-linecap="round"/><rect x="-11.2" y="9.2" width="4.8" height="12.8" rx="1.8" fill="${C.lg("hdo", [[0, "#fff4b8"], [.5, "#ffd166"], [1, "#c48a00"]], 0, 0, 1, 0)}" ${C.sk(1.1)}/><rect x="7.8" y="9.2" width="4.8" height="12.8" rx="1.8" fill="${C.lg("hdo", [[0, "#fff4b8"], [.5, "#ffd166"], [1, "#c48a00"]], 0, 0, 1, 0)}" ${C.sk(1.1)}/>${hvStar(12.4, 8.4, 2.4, "#fff")}`;
  if (id === "kettle") return `<path d="M-3.6 15.4Q-4 9.2 0 9.2Q4 9.2 3.6 15.4" stroke="${HV_INK}" stroke-width="3.6" fill="none"/><path d="M-3.6 15.4Q-4 9.2 0 9.2Q4 9.2 3.6 15.4" stroke="#39425a" stroke-width="2" fill="none"/><circle cx="0" cy="22" r="5.8" fill="${C.rg("kb", [[0, "#5b6579"], [1, "#1b2130"]], .35, .3, .8)}" ${C.sk(1.2)}/><path d="M-4.6 23.4Q0 25.2 4.6 23.4" stroke="${HV_VOLT}" stroke-width="1.3" fill="none"/>${C.lite ? "" : `<ellipse cx="-2.2" cy="20.2" rx="1.6" ry="1" fill="#fff" opacity=".35"/>`}`;
  if (id === "shaker") return `<g transform="translate(0 6.4)"><rect x="-3.6" y="7.4" width="7.2" height="15.4" rx="2.4" fill="${C.lg("shk", [[0, "#efffb0", .95], [1, "#9fd400", .95]], 0, 0, 1, 0)}" ${C.sk(1.2)}/><rect x="-3.6" y="15" width="7.2" height="7.8" rx="2.4" fill="#e8d9c4" opacity=".75"/><rect x="-4.2" y="4.4" width="8.4" height="4" rx="1.4" fill="#1d2332" ${C.sk(1.1)}/><rect x="-1" y="2.6" width="2" height="2" rx=".6" fill="#1d2332"/>${C.lite ? "" : `<path d="M-2 9.4V13" stroke="#fff" stroke-width=".9" opacity=".7" stroke-linecap="round"/>`}</g>`;
  return "";
}
function hvAura(C, id, layer) {
  const p = [];
  if (id === "flammes" && layer === "b") p.push(`<g class="hv-fire"><path d="M0 -101Q2.6 -91 6.4 -87.6Q9.6 -92 11.6 -97.4Q13.4 -88.4 16.2 -83.6Q19.8 -86.6 23.2 -92Q24.2 -83 25.4 -76.4C30.2 -65 31.6 -55 30.6 -44C29 -20 18 1 0 2C-18 1 -29 -20 -30.6 -44C-31.6 -55 -30.2 -65 -25.4 -76.4Q-24.2 -83 -23.2 -92Q-19.8 -86.6 -16.2 -83.6Q-13.4 -88.4 -11.6 -97.4Q-9.6 -92 -6.4 -87.6Q-2.6 -91 0 -101Z" fill="${C.rg("fl", [[0, "#ffe08a", .95], [.4, "#ff9a3d", .72], [.78, "#ff4a1f", .3], [1, "#ff3b1f", 0]], .5, .6, .64)}"/><path d="M-12 -80C-6 -72 -16 -66 -13 -56M13 -84C19 -72 9 -68 13 -58M0 -92C5 -84 -3 -80 2 -72" stroke="#ffd166" stroke-width="1.5" fill="none" opacity=".75" stroke-linecap="round"/></g>`);
  if (id === "eclairs") { if (layer === "b") p.push(`<ellipse class="hv-ring" cx="0" cy="0" rx="22" ry="5" fill="none" stroke="${HV_VOLT}" stroke-width="1.4" opacity=".7"/>`);
    else p.push(`<g class="hv-bolt">${[["M-27 -70L-20.6 -57.4L-25.8 -55.4L-18.4 -40", 0], ["M27.4 -62L21 -49.6L26.2 -47.6L19 -32", 1]].map(([d]) => `<path d="${d}" stroke="${HV_INK}" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" stroke="${HV_VOLT}" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}</g>`); }
  if (id === "etincelles" && layer === "f") p.push(`<g class="hv-spk">${[[-25, -66, 4.6], [24, -48, 3.8], [-22, -24, 3.6], [23, -78, 3], [21, -16, 2.6]].map(([x, y, r]) => hvStar(x, y, r, "#fff6b0")).join("")}</g>`);
  return p.join("");
}

/* ---------- visage : sourcils + yeux + bouche selon l'humeur (n neutre, h content, x acclamation, s endormi, c a froid,
   k malade : yeux mi-clos, sourcils inquiets, joues rouges ; la bouche laisse la place au thermomètre,
   r en pause : yeux fermés, petit sourire détendu) ---------- */
function hvExpr(C, m, rob, fem, T, hairCol, et) {
  const p = [], ey = -54.4, sick = et === "malade";
  if (sick && m !== "s") m = "k";
  if (et === "pause" && m === "n") m = "r";
  if (rob) { const L = HV_VOLT, gl = (d, w) => C.lite ? "" : `<path d="${d}" stroke="${L}" stroke-width="${w + 2.4}" fill="none" stroke-linecap="round" opacity=".22"/>`;
    if (m === "n") p.push(`<g class="hv-ey" style="transform-origin:0px -58px">${C.lite ? "" : `<rect x="-9.4" y="-63.4" width="6.8" height="10.4" rx="3.4" fill="${L}" opacity=".2"/><rect x="2.6" y="-63.4" width="6.8" height="10.4" rx="3.4" fill="${L}" opacity=".2"/>`}<rect x="-8.2" y="-62.2" width="4.4" height="8" rx="2.2" fill="${L}"/><rect x="3.8" y="-62.2" width="4.4" height="8" rx="2.2" fill="${L}"/></g><path d="M-2.8 -51Q0 -49 2.8 -51" stroke="${L}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
    if (m === "h" || m === "x") { const e = "M-9 -56.4Q-6 -62 -3 -56.4M3 -56.4Q6 -62 9 -56.4"; p.push(gl(e, 1.9) + `<path d="${e}" stroke="${L}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`);
      p.push(m === "x" ? `<path d="M-3.6 -52Q0 -51.6 3.6 -52Q3.2 -47.6 0 -47.6Q-3.2 -47.6 -3.6 -52Z" fill="${L}"/>` : `<path d="M-3.2 -51.6Q0 -47.8 3.2 -51.6Z" fill="${L}"/>`); }
    if (m === "s") p.push(`<path d="M-9 -57.4Q-6 -55.2 -3 -57.4M3 -57.4Q6 -55.2 9 -57.4" stroke="${L}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".8"/><ellipse cx=".6" cy="-50.6" rx="1.2" ry="1.4" fill="${L}" opacity=".8"/>`);
    if (m === "c") p.push(`<path d="M-8.6 -61.4L-3.6 -58.4L-8.6 -55.4M8.6 -61.4L3.6 -58.4L8.6 -55.4" stroke="#8fe3ff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-4 -50.6l1.3 -1.2l1.3 1.2l1.4 -1.2l1.3 1.2l1.3 -1.2l1.4 1.2" stroke="#8fe3ff" stroke-width="1.1" fill="none" stroke-linejoin="round"/>`);
    if (m === "r") p.push(`<path d="M-9 -57.4Q-6 -60.4 -3 -57.4M3 -57.4Q6 -60.4 9 -57.4" stroke="${L}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M-2.8 -51.2Q0 -48.8 2.8 -51.2" stroke="${L}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
    if (m === "k") p.push(`<path d="M-9 -58.8Q-6 -56.4 -3 -58.8M3 -58.8Q6 -56.4 9 -58.8" stroke="#ffb547" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M-9.2 -62.4L-3.6 -61.2M9.2 -62.4L3.6 -61.2" stroke="#ffb547" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>`);
    return p.join("");
  }
  const br = (dl, dr) => `<path d="${dl}" stroke="${hairCol}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="${dr}" stroke="${hairCol}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  const mir = d => d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (a, x, y) => `${hvR(-x)} ${y}`);
  const brow = { n: "M-10.4 -61.4Q-7.6 -63.2 -4.6 -62.2", h: "M-10.6 -63Q-7.6 -65.4 -4.6 -64.2", x: "M-10.6 -64Q-7.6 -66.6 -4.6 -65.4", s: "M-10.2 -60.6Q-7.4 -61.4 -4.6 -61", c: "M-10.2 -61.4Q-7.4 -62 -4.8 -63.8", k: "M-10.4 -60.6Q-7.4 -61 -4.8 -63", r: "M-10.4 -61.6Q-7.6 -63 -4.6 -62.4" }[m];
  p.push(br(brow, mir(brow)));
  const iris = C.lg("ir", [[0, "#120c1e"], [.55, "#261a33"], [1, T.ir]]);
  const eyeO = sx => { const x = sx * 7.2; return `<ellipse cx="${x}" cy="${ey}" rx="3.4" ry="4.5" fill="${iris}"/><ellipse cx="${hvR(x + 1.2)}" cy="${ey - 1.7}" rx="1.3" ry="1.55" fill="#fff"/><circle cx="${hvR(x - 1.15)}" cy="${ey + 1.9}" r=".7" fill="#fff" opacity=".9"/><path d="${hvD`M${x - 4} ${ey - 1.9}Q${x} ${ey - 6.6} ${x + 4} ${ey - 1.9}`}" stroke="${HV_INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/>${fem ? `<path d="${hvD`M${x + sx * 3.7} ${ey - 2.6}L${x + sx * 5.7} ${ey - 4.4}M${x + sx * 2.6} ${ey - 3.8}L${x + sx * 4} ${ey - 5.8}`}" stroke="${HV_INK}" stroke-width="1.1" stroke-linecap="round"/>` : ""}`; };
  if (m === "n") p.push(`<g class="hv-ey" style="transform-origin:0px -54.4px">${eyeO(-1)}${eyeO(1)}</g>`);
  if (m === "k") [-1, 1].forEach(sx => { const x = sx * 7.2;
    p.push(`<path d="${hvD`M${x - 3.4} ${ey - .6}A3.4 3.3 0 0 0 ${x + 3.4} ${ey - .6}Z`}" fill="${iris}"/><circle cx="${hvR(x + 1)}" cy="${ey + .7}" r=".8" fill="#fff" opacity=".9"/><path d="${hvD`M${x - 4} ${ey - .3}Q${x} ${ey - 2.4} ${x + 4} ${ey - .3}`}" stroke="${HV_INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="${hvD`M${x - 3} ${ey + 4.2}Q${x} ${ey + 5.4} ${x + 3} ${ey + 4.2}`}" stroke="${T.d}" stroke-width=".9" fill="none" opacity=".75" stroke-linecap="round"/>`); });
  if (m === "h" || m === "x") p.push(`<path d="M-10.6 -53.4Q-7.2 -58.8 -3.8 -53.4M3.8 -53.4Q7.2 -58.8 10.6 -53.4" stroke="${HV_INK}" stroke-width="2" fill="none" stroke-linecap="round"/>${fem ? `<path d="M-10.4 -54.2l-1.8 -1.2M10.4 -54.2l1.8 -1.2" stroke="${HV_INK}" stroke-width="1.1" stroke-linecap="round"/>` : ""}`);
  if (m === "r") p.push(`<path d="M-10.4 -54Q-7.2 -57 -4 -54M4 -54Q7.2 -57 10.4 -54" stroke="${HV_INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`);
  if (m === "s") p.push(`<path d="M-10.4 -54.6Q-7.2 -51.8 -4 -54.6M4 -54.6Q7.2 -51.8 10.4 -54.6" stroke="${HV_INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`);
  if (m === "c") p.push(`<path d="M-10 -57.4L-4.8 -54.4L-10 -51.4M10 -57.4L4.8 -54.4L10 -51.4" stroke="${HV_INK}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  const lip = "#5b1a28";
  if (m === "r") p.push(`<path d="M-3.4 -47Q0 -44 3.4 -47" stroke="${lip}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
  if (m === "n") p.push(`<path d="M-3 -46.8Q0 -44.2 3 -46.8" stroke="${lip}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`);
  if (m === "h") p.push(`<path d="M-3.8 -47.4Q0 -47.8 3.8 -47.4Q3.4 -42.2 0 -42Q-3.4 -42.2 -3.8 -47.4Z" fill="${lip}"/><path d="M-3 -47.2H3Q2.8 -46 0 -46Q-2.8 -46 -3 -47.2Z" fill="#fff"/><ellipse cx="0" cy="-43.2" rx="2" ry="1.1" fill="#ff7a8f"/>`);
  if (m === "x") p.push(`<path d="M-4.2 -48Q0 -48.6 4.2 -48Q4.2 -40.8 0 -40.6Q-4.2 -40.8 -4.2 -48Z" fill="${lip}"/><path d="M-3.4 -47.8H3.4Q3.2 -46.6 0 -46.6Q-3.2 -46.6 -3.4 -47.8Z" fill="#fff"/><ellipse cx="0" cy="-42" rx="2.4" ry="1.3" fill="#ff7a8f"/>`);
  if (m === "s" && !sick) p.push(`<ellipse cx=".6" cy="-46.2" rx="1.3" ry="1.5" fill="${lip}"/>`);
  if (m === "k") p.push(`<ellipse cx=".2" cy="-46.4" rx="1.7" ry="1.4" fill="${lip}"/>`);
  if (m === "c") p.push(`<rect x="-3.8" y="-48.4" width="7.6" height="3.4" rx="1.3" fill="#fff" ${C.sk(1)}/><path d="M-3.4 -46.7l1.1 -.8l1.1 .8l1.1 -.8l1.1 .8l1.1 -.8l1.1 .8" stroke="${HV_INK}" stroke-width=".7" fill="none" stroke-linejoin="round"/>`);
  const bl = m === "c" ? "#8ecbff" : m === "k" ? "#ff5e73" : T.bl, bo = m === "c" || m === "k" ? .7 : .5;
  p.push(`<ellipse cx="-12" cy="-48.4" rx="3.2" ry="1.9" fill="${bl}" opacity="${bo}"/><ellipse cx="12" cy="-48.4" rx="3.2" ry="1.9" fill="${bl}" opacity="${bo}"/>`);
  return p.join("");
}

/* ---------- cheveux ---------- */
function hvHair(C, style, mode, T, hcol, hhl, layer) {
  /* mode : "full" | "flat" (sous une casquette/couronne…) ; layer "b" (derrière la tête) | "f" */
  const f = C.lg("hr" + style, [[0, hhl], [.55, hcol], [1, hcol]]), p = [], sk = C.sk(1.3);
  if (style === "quiff") { if (layer === "b") return "";
    if (mode === "full") p.push(`<path d="M-19.4 -52C-21.8 -64 -16.6 -76.4 -6.4 -79.8C-.6 -85.6 10.4 -85.6 15.4 -79.6C13.8 -80 12.2 -79.8 11 -79.2C17.4 -76.6 21.4 -67 19.4 -52L17.8 -55.6C17 -58.6 15.6 -60.8 13.6 -62C9.4 -60.2 3.4 -61.2 -1.4 -65.2C-3.4 -62.6 -6.8 -61 -10.4 -61.2C-13.6 -60.4 -16.2 -58.4 -17.6 -55.4Z" fill="${f}" ${sk}/>${C.lite ? "" : `<path d="M-8.6 -75.6C-3.6 -81.4 5 -82.6 11 -79.4M-14.6 -64.8C-12 -71 -7 -74.6 -1.6 -75.6" stroke="#fff" stroke-width="1.3" fill="none" opacity=".26" stroke-linecap="round"/><path d="M-2 -73.4C2 -76.2 7 -76.8 11.4 -75.4" stroke="#000" stroke-width="1" fill="none" opacity=".25" stroke-linecap="round"/>`}`);
    else p.push(`<path d="M-19.4 -52C-21 -66 -11 -76.2 0 -76.2C11 -76.2 21 -66 19.4 -52L17.8 -55.6C17 -58.6 15.6 -60.8 13.6 -62C9.4 -60.2 3.4 -61.2 -1.4 -65.2C-3.4 -62.6 -6.8 -61 -10.4 -61.2C-13.6 -60.4 -16.2 -58.4 -17.6 -55.4Z" fill="${f}" ${sk}/>`);
    if (!C.lite) p.push(`<path d="M14.6 -71.6C17.4 -68 18.8 -63.6 18.8 -58.4" stroke="${HV_VOLT}" stroke-width="1" fill="none" opacity=".6" stroke-linecap="round"/>`);
  }
  if (style === "court") { if (layer === "b") return "";
    p.push(`<path d="M-18.8 -55C-19.8 -68 -10.4 -75.8 0 -75.8C10.4 -75.8 19.8 -68 18.8 -55C17.4 -60 14.6 -62.8 10.6 -63.6C5 -62.2 -5 -62.2 -10.6 -63.6C-14.6 -62.8 -17.4 -60 -18.8 -55Z" fill="${f}" ${sk}/>${C.lite ? "" : `<path d="M-12 -68.4C-8 -72 -3 -73.2 2 -73.2" stroke="#fff" stroke-width="1.2" fill="none" opacity=".22" stroke-linecap="round"/>`}`); }
  if (style === "pony" || style === "blond") {
    if (layer === "b") { if (mode === "flat") return `<g class="hv-pony" style="transform-origin:10px -66px"><path d="M8 -64C17 -70 28 -64 28.6 -52C29 -45 26.4 -40.6 22.6 -38.4C24.4 -46 22.2 -54.6 10.6 -58.6Z" fill="${f}" ${sk}/></g>`;
      return `<g class="hv-pony" style="transform-origin:9px -73px"><path d="M6.4 -72.6C13.6 -86 31.6 -82.4 32.4 -64.6C33 -53 28.4 -45.4 22.8 -41.6C25.6 -50.4 25 -60 13.4 -66.4Z" fill="${f}" ${sk}/>${C.lite ? "" : `<path d="M16 -78.6C24.6 -79.4 29.6 -72 29.4 -62" stroke="#fff" stroke-width="1.3" fill="none" opacity=".25" stroke-linecap="round"/>`}<ellipse cx="9.6" cy="-73.4" rx="3.6" ry="2.8" fill="${HV_VOLT}" ${C.sk(1)} transform="rotate(-30 9.6 -73.4)"/></g>`; }
    p.push(`<path d="M-19.6 -52.4C-21 -67.4 -11 -76.6 0 -76.6C11 -76.6 21 -67.4 19.6 -52.4C18.6 -58.4 16.2 -62.4 12.4 -64C6.4 -63.4 -1.4 -62 -7.6 -59.4C-11 -58 -14.2 -56 -16.8 -52.6L-16.2 -56.8C-17.6 -55.6 -18.8 -54.2 -19.6 -52.4Z" fill="${f}" ${sk}/>`);
    p.push(`<path d="M-19.6 -54C-20.8 -46 -19.2 -40.6 -15.8 -38.2C-16.4 -43.6 -16 -48.6 -14.8 -52.8Z" fill="${f}" ${sk}/><path d="M19.4 -55C20.4 -48.6 19.4 -44 17 -41.6C17.2 -46 16.8 -50 15.8 -53.6Z" fill="${f}" ${sk}/>`);
    if (!C.lite) p.push(`<path d="M-14.6 -64.6C-11 -70.6 -5 -73.6 1 -73.8" stroke="#fff" stroke-width="1.3" fill="none" opacity=".25" stroke-linecap="round"/><path d="M14.6 -71C17.4 -67.6 19 -63 19 -58" stroke="${HV_VOLT}" stroke-width="1" fill="none" opacity=".7" stroke-linecap="round"/>`);
  }
  return p.join("");
}

/* ================================== ÉTATS DE FORME (cœurs) ================================== */
/* couleurs selon l'état : part de désaturation, puis voile (pâle quand il est malade, givré en pause) */
const HV_ETATS = { malade: .3, convalescent: .15, pause: .12 };
const HV_VOILE = { malade: [[236, 240, 228], .1], pause: [[214, 240, 255], .2] };
/* l'état vient de js/coeurs.js (window.HMG_HEROS_ETAT) ; il ne s'applique qu'au héros du joueur (eq === gmS.eq) */
const hvSafe = f => { try { return f(); } catch (e) { return null; } };
function hvEtatDe(eq, o) {
  if (o.etat != null) return HV_ETATS[o.etat] != null ? o.etat : "";
  if (o.lite) return "";
  const mine = hvSafe(() => eq === gmS.eq), e = typeof window !== "undefined" ? window.HMG_HEROS_ETAT : null;
  return mine && HV_ETATS[e] != null ? e : "";
}
/* change l'état du héros du joueur et redessine celui de la carte : heroEtat("malade" | "convalescent" | "pause" | "") */
function heroEtat(e) { if (e !== undefined) { window.HMG_HEROS_ETAT = HV_ETATS[e] != null ? e : null; hvRepeint(); } return window.HMG_HEROS_ETAT || ""; }
/* quand js/coeurs.js change window.HMG_HEROS_ETAT, le héros de la carte (en gardant son humeur du moment) et « Ma collection »
   se redessinent tout seuls : il suffit d'affecter la variable, aucun appel à faire */
function hvRepeint() {
  hvSafe(() => { const s = document.querySelector("#gmHero > .hh"); if (!s) return;
    gmPaintHero((s.getAttribute("class") || "").split(/\s+/).filter(c => c && c !== "hh" && !c.startsWith("hv-")).join(" ") || undefined); });
  hvSafe(() => { if (HC.el) hcRefresh(); });
}
(function hvGuetteEtat() {
  if (typeof window === "undefined") return;
  let v = window.HMG_HEROS_ETAT == null ? null : window.HMG_HEROS_ETAT, t = 0;
  try { Object.defineProperty(window, "HMG_HEROS_ETAT", { configurable: true, enumerable: true, get: () => v,
    set: n => { n = n == null || n === "" ? null : n; if (n === v) return; v = n; clearTimeout(t); t = setTimeout(hvRepeint, 0); } }); } catch (e) { }
})();
/* palier de muscles AFFICHÉ (un de moins quand le héros est malade) : pour le HUD, l'onglet Moi, la collection */
const heroLvAff = () => { const l = hvSafe(() => gmHeroLv()); return Math.max(0, (l == null ? 1 : l) - (window.HMG_HEROS_ETAT === "malade" ? 1 : 0)); };
function hvDesat(svg, k, voile) {
  if (!k && !voile) return svg;
  const [V, kv] = voile || [[0, 0, 0], 0];
  return svg.replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (m, h) => {
    if (h.length === 3) h = h.replace(/./g, c => c + c);
    const n = parseInt(h, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, l = .299 * r + .587 * g + .114 * b;
    const f = (v, i) => { const x = v + (l - v) * k; return Math.round(x + (V[i] - x) * kv).toString(16).padStart(2, "0"); };
    return "#" + f(r, 0) + f(g, 1) + f(b, 2);
  });
}
/* givre de la pause : plaque de glace sous les pieds (derrière) et flocons qui tournent doucement (devant) */
const hvFlocon = (x, y, r) => { const d = [0, 60, 120].map(a => { const c = Math.cos(a * Math.PI / 180) * r, s = Math.sin(a * Math.PI / 180) * r; return `M${hvR(x - c)} ${hvR(y - s)}L${hvR(x + c)} ${hvR(y + s)}`; }).join("");
  return `<g class="hv-flk"><path d="${d}" stroke="${HV_INK}" stroke-width="2" stroke-linecap="round" opacity=".55"/><path d="${d}" stroke="#eaf8ff" stroke-width=".9" stroke-linecap="round"/></g>`; };
const hvGivreSol = () => `<ellipse cx="0" cy=".8" rx="21" ry="3.9" fill="#bfe9ff" opacity=".32"/><path d="M-15 .6l3 -1.4M-6 1.8l2.6 -1.6M7 1.4l3.2 -1.2M14 .2l2.2 -1" stroke="#f2fbff" stroke-width=".8" stroke-linecap="round" opacity=".8"/>`;
const hvGivre = () => `<g class="hv-frost">${hvFlocon(-21, -70, 3.2)}${hvFlocon(22, -60, 2.6)}${hvFlocon(-18, -34, 2.2)}${hvFlocon(20, -26, 1.8)}</g>`;
/* accessoires d'état : couleurs franches, posés APRÈS la désaturation (le nez reste rouge, la couverture douce) */
function hvSickHead(rob) {
  const th = `<path d="M.6 -46.4L10.4 -41.6" stroke="${HV_INK}" stroke-width="3" stroke-linecap="round"/><path d="M.6 -46.4L10.4 -41.6" stroke="#f4f8ff" stroke-width="1.7" stroke-linecap="round"/><path d="M.6 -46.4L5.6 -44" stroke="#ff3b5c" stroke-width=".9" stroke-linecap="round"/><circle cx="10.6" cy="-41.5" r="1.3" fill="#9aa6bd" stroke="${HV_INK}" stroke-width=".8"/>`;
  if (rob) return `<g transform="translate(0 -4.2)">${th}</g><g transform="translate(9.2 -66.2)"><rect width="4.6" height="2.6" rx=".6" fill="none" stroke="#ff5a6e" stroke-width=".7"/><rect x=".55" y=".55" width="1.1" height="1.5" fill="#ff5a6e"/><rect x="4.6" y=".8" width=".6" height="1" fill="#ff5a6e"/></g>`;
  return `<ellipse cx="0" cy="-50.5" rx="2.5" ry="2.1" fill="#ff5a6e" stroke="${HV_INK}" stroke-width=".8"/><ellipse cx="-.8" cy="-51.2" rx=".8" ry=".5" fill="#fff" opacity=".75"/>${th}`;
}
function hvBlanket(g) {
  const S = g.S, y0 = g.y0, ny = y0 - g.T - .6;
  const half = sx => hvD`M${sx * 4.4} ${ny}C${sx * S * .62} ${ny - .8} ${sx * (S + 2.6)} ${y0 - 1.4} ${sx * (S + 3)} ${y0 + 3.4}L${sx * (S + 3.4)} ${y0 + 12.4}Q${sx * (S + .6)} ${y0 + 15} ${sx * S * .42} ${y0 + 13.2}Q${sx * S * .3} ${y0 + 6} ${sx * 2.2} ${y0 + 1.2}Z`;
  const rays = sx => hvD`M${sx * (S + 3.1)} ${y0 + 6.4}Q${sx * S * .8} ${y0 + 7.4} ${sx * S * .36} ${y0 + 7}M${sx * (S + 3.3)} ${y0 + 9.6}Q${sx * S * .8} ${y0 + 10.8} ${sx * S * .38} ${y0 + 10.2}`;
  const col = hvD`M-4.6 ${ny + .2}Q0 ${ny - 2.4} 4.6 ${ny + .2}`;
  return `<g class="hv-blk">${[-1, 1].map(sx => `<path d="${half(sx)}" fill="${sx < 0 ? "#8b97ff" : "#7682f0"}" stroke="${HV_INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="${rays(sx)}" stroke="#c9d0ff" stroke-width="1" fill="none" opacity=".85" stroke-linecap="round"/>`).join("")}<path d="${col}" stroke="${HV_INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="${col}" stroke="#8b97ff" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
}
/* tasse fumante, tenue dans la main gauche (repère du bras, main en (0, hy)) */
function hvMug(g) { const y = g.hy, h = hvD`M3.4 ${y - .6}q3.2 0 3.2 2.6t-3.2 2.6`;
  return `<g class="hv-mug"><path d="${h}" stroke="${HV_INK}" stroke-width="2.8" fill="none"/><path d="${h}" stroke="#fff4e6" stroke-width="1.3" fill="none"/><rect x="-3.8" y="${hvR(y - 2.6)}" width="7.6" height="8.4" rx="1.9" fill="#fff4e6" stroke="${HV_INK}" stroke-width="1.1"/><rect x="-3.25" y="${hvR(y + .9)}" width="6.5" height="1.9" fill="#ff7a3d"/><g class="hv-steam" fill="none" stroke="#fff" stroke-width=".95" stroke-linecap="round" opacity=".85"><path d="${hvD`M-1.4 ${y - 4}q-1.3 -1.6 0 -3.2t0 -3.2`}"/><path d="${hvD`M1.6 ${y - 4.6}q1.3 -1.6 0 -3.2t0 -3.2`}"/></g></g>`; }

/* ================================== LE HÉROS ================================== */
const hvLG = k => hvSafe(() => GM_LG[k]) || null;
const HV_CACHE = new Map(), HV_CACHE_MAX = 160;
function drawHero(eq, o = {}) {
  eq = eq || {}; o = o || {};
  const LGd = hvLG(eq.hero), LX = LGd ? (HV_LEGX[eq.hero] || {}) : null, etat = hvEtatDe(eq, o);
  let lv = LX && LX.mus != null ? LX.mus : o.mus != null ? +o.mus : hvSafe(() => gmHeroLv());
  if (lv == null || isNaN(lv)) lv = 1;
  if (etat === "malade") lv -= 1;
  lv = Math.max(0, Math.min(5, lv | 0));
  const cls = String(o.cls != null ? o.cls : (o.mood || "idle")).trim();
  const key = [eq.hero, eq.tone, eq.skin, eq.legs, eq.feet, eq.hat, eq.neck, eq.face, eq.back, eq.hand, eq.aura, lv, cls, etat,
    o.lite ? 1 : 0, o.dyn ? 1 : 0, o.static ? 1 : 0, o.pad ? 1 : 0, o.w, o.h, o.vb].join("|");
  let t = HV_CACHE.get(key);
  if (t) { HV_CACHE.delete(key); HV_CACHE.set(key, t); }
  else { t = hvBuild(eq, o, LGd, LX, lv, cls, etat); HV_CACHE.set(key, t); if (HV_CACHE.size > HV_CACHE_MAX) HV_CACHE.delete(HV_CACHE.keys().next().value); }
  const n = ++hvUid;
  return t.split(HV_TOK).join("hv" + n.toString(36) + "_").replace("HVDL", ((n * .37) % 4).toFixed(2));
}
/* le dessin lui-même, écrit une fois par combinaison (modèle avec l'identifiant HV_TOK) */
function hvBuild(eq, o, LGd, LX, lv, cls, etat) {
  if (LGd) eq = { ...eq, tone: LGd.tone, skin: eq.skin || LGd.skin, legs: eq.legs || LGd.legs || "short_noir", feet: eq.feet || "baskets", hat: eq.hat || LGd.hat || null, aura: eq.aura || LGd.aura || null };
  if (etat === "pause" && !eq.hat) eq = { ...eq, hat: "bonnet_hmg" };   /* en pause : bonnet bien chaud, visage détendu */
  const hero = LGd ? LGd.base : (eq.hero === "femme" || eq.hero === "robot" ? eq.hero : "homme"), rob = hero === "robot", fem = hero === "femme";
  const m = /\bcold\b/.test(cls) ? "c" : /\bsleep\b/.test(cls) ? "s" : /\bcheer\b/.test(cls) ? "x" : /\bhappy\b/.test(cls) ? "h" : "n";
  const st = !!o.static, lite = !!o.lite, dyn = !!o.dyn && !lite && !st;
  const C = hvCtx(lite, HV_TOK), g = hvGeo(hero, lv);
  const toneK = HV_TONE[rob ? "robot" : "human"][eq.tone] ? eq.tone : "clair", T = HV_TONE[rob ? "robot" : "human"][toneK];
  const blond = LX && LX.hair === "blond", hcol = blond ? "#e9b44c" : T.h, hhl = blond ? "#fff0b0" : T.hl;
  const hair = rob ? null : LX && LX.hair && LX.hair !== "blond" ? LX.hair : fem ? "pony" : "quiff";
  const top = HV_TEE[eq.skin] ? eq.skin : null, bot = HV_BOT[eq.legs] ? eq.legs : null, feet = HV_SHOE[eq.feet] ? eq.feet : null;
  const hat = eq.hat, flat = /^(casquette|bonnet|bonnet_hmg|bonnet_volt|casque|crete|couronne)$/.test(hat || "");
  const sick = etat === "malade", conva = etat === "convalescent";
  /* matières */
  const skin = rob ? C.lg("mt", [[0, T.s], [.55, T.m], [1, T.d]], 0, 0, 1, 0) : C.lg("sk", [[0, T.s], [.6, T.s], [1, T.m]], 0, 0, 1, 0);
  const skinB = rob ? C.lg("mtB", [[0, T.s], [.55, T.m], [1, T.d]], 1, 0, 0, 0) : C.lg("skB", [[0, T.s], [.6, T.s], [1, T.m]], 1, 0, 0, 0);
  const headF = rob ? C.rg("hd", [[0, T.s], [.7, T.m], [1, T.d]], .36, .28, .85) : C.rg("hd", [[0, T.s], [.72, T.s], [1, T.m]], .38, .3, .78);
  const p = [], back = eq.back, aura = eq.aura, SK = C.sk();
  /* ombre au sol + socle */
  p.push(`<ellipse cx="0" cy=".4" rx="${hvR(15 + lv * .9)}" ry="3.4" fill="#000" opacity=".38"/>`);
  if (o.pad) p.push(`<ellipse cx="0" cy=".6" rx="27" ry="5.6" fill="${C.rg("pad", [[0, HV_VOLT, .28], [1, HV_VOLT, 0]])}"/><ellipse cx="0" cy=".6" rx="24" ry="4.6" fill="none" stroke="${HV_VOLT}" stroke-width=".7" opacity=".7"/>`);
  if (etat === "pause") p.push("HVSKG");   /* givre au sol, derrière le héros */
  p.push(`<g class="hv-all">`);
  if (aura) p.push(hvAura(C, aura, "b"));
  if (back) p.push(`<g transform="translate(0 ${-HV_LIFT})">${hvBack(C, back, g, "b")}</g>`);
  /* jambes */
  [-1, 1].forEach(sx => { const cx = sx * g.lx, L = g.L, q = [];
    q.push(`<path d="${hvD`M${cx - L / 2} ${-17 - HV_LIFT}L${cx - L * .44} -5.2Q${cx} -3.4 ${cx + L * .44} -5.2L${cx + L / 2} ${-17 - HV_LIFT}Z`}" fill="${sx < 0 ? skinB : skin}" ${SK}/>`);
    if (rob) q.push(`<path d="${hvD`M${cx - L / 2 + .2} -9.6H${cx + L / 2 - .2}`}" stroke="${T.j}" stroke-width="1.6"/>`);
    if (sx > 0 && !rob) q.push(C.rim(hvD`M${cx + L / 2 - .8} -12L${cx + L * .44 - .7} -6.4`, .9, .6));
    if (feet) q.push(hvShoe(C, feet, cx, sx, L));
    else if (rob) q.push(`<path d="${hvD`M${cx - L * .5 - 2 + sx * .6} .4C${cx - L * .5 - 2 + sx * .6} -4.6 ${cx + L * .5 + 2 + sx * .6} -4.6 ${cx + L * .5 + 2 + sx * .6} .4Z`}" fill="${T.j}" ${C.sk(1.2)}/><path d="${hvD`M${cx - L * .5 - 1.2 + sx * .6} -.6H${cx + L * .5 + 1.2 + sx * .6}`}" stroke="${HV_VOLT}" stroke-width=".9"/>`);
    else q.push(`<path d="${hvD`M${cx - L * .5 - 1.6 + sx * .8} .3C${cx - L * .5 - 2 + sx * .8} -4 ${cx + L * .5 + 2 + sx * .8} -4.4 ${cx + L * .5 + 1.8 + sx * .8} .3Z`}" fill="${T.m}" ${C.sk(1.2)}/><path d="${hvD`M${cx + sx * 1.2 + sx * .8} -.4v-1.2M${cx + sx * 2.6 + sx * .8} -.4v-1`}" stroke="${T.d}" stroke-width=".7" stroke-linecap="round"/>`);
    if (bot) q.push(hvPantLeg(C, g, bot, cx));
    p.push(`<g class="hv-lg hv-lg${sx < 0 ? "l" : "r"}">${q.join("")}</g>`); });
  /* buste (respire) */
  const up = [];
  up.push(`<rect x="-3.8" y="-42" width="7.6" height="8" rx="2" fill="${rob ? T.j : T.d}" ${SK}/>`);
  const tD = hvTorso(g);
  up.push(`<path d="${tD}" fill="${skin}" ${SK}/>`);
  const det = [], S = g.S, W = g.W, y0 = g.y0;
  det.push(`<ellipse cx="0" cy="${hvR(y0 - g.T + .8)}" rx="9" ry="3" fill="#000" opacity=".16"/>`);
  if (rob) {
    det.push(`<path d="${hvD`M${-S + 2} ${y0 + 9}Q0 ${y0 + 11} ${S - 2} ${y0 + 9}M0 ${y0 + 9.6}V${g.y1}`}" stroke="${T.ln}" stroke-width="1" fill="none" opacity=".7"/>`);
    if (lv >= 2) det.push(`<path d="${hvD`M${-S * .78} ${y0 + 3}Q${-S * .4} ${y0 + 1.6} -1.4 ${y0 + 3.4}L-1.4 ${y0 + 8.6}Q${-S * .4} ${y0 + 10} ${-S * .78} ${y0 + 8}ZM${S * .78} ${y0 + 3}Q${S * .4} ${y0 + 1.6} 1.4 ${y0 + 3.4}L1.4 ${y0 + 8.6}Q${S * .4} ${y0 + 10} ${S * .78} ${y0 + 8}Z`}" fill="#fff" opacity=".22" stroke="${T.ln}" stroke-width=".8"/>`);
    if (lv >= 3) det.push(`<path d="${hvD`M${-W * .55} -21.6H${W * .55}M${-W * .5} -18.4H${W * .5}`}" stroke="${T.ln}" stroke-width=".9" opacity=".75"/>`);
    if (lv >= 4) det.push(`<path d="${hvD`M${-W + 1.2} -24v4M${-W + 2.6} -24.6v4.6M${W - 1.2} -24v4M${W - 2.6} -24.6v4.6`}" stroke="${T.j}" stroke-width=".9" opacity=".8"/>`);
  } else if (!top) {
    const ln = T.ln, mk = (d, w = 1, op = .6) => `<path d="${d}" stroke="${ln}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${op}"/>`;
    const hi = d => C.lite ? "" : `<path d="${d}" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".35"/>`;
    if (lv === 0) det.push(mk(hvD`M${-S + 2.6} -29.4q1.9 1 3.8 0M${-S + 2.8} -26.6q1.8 1 3.6 0M${S - 2.6} -29.4q-1.9 1 -3.8 0M${S - 2.8} -26.6q-1.8 1 -3.6 0`, .9, .5));
    if (!fem) {
      if (lv >= 1) { const sh = lv >= 2; det.push(sh && !C.lite ? `<path d="${hvD`M${-S * .7} -30.4Q${-S * .34} ${-25.8 - lv * .3} -.6 -29.4L-.6 -28Q${-S * .36} ${-24 - lv * .3} ${-S * .72} -28.6ZM${S * .7} -30.4Q${S * .34} ${-25.8 - lv * .3} .6 -29.4L.6 -28Q${S * .36} ${-24 - lv * .3} ${S * .72} -28.6Z`}" fill="${ln}" opacity="${.18 + lv * .06}"/>` : "");
        det.push(mk(hvD`M${-S * .7} -30Q${-S * .34} ${-25.8 - lv * .3} -.6 -29.2M${S * .7} -30Q${S * .34} ${-25.8 - lv * .3} .6 -29.2`, 1, lv >= 2 ? .75 : .45));
        det.push(hi(hvD`M${-S * .6} -32.6Q${-S * .32} -33.8 -1.6 -32.8M${S * .6} -32.6Q${S * .32} -33.8 1.6 -32.8`)); }
      if (lv >= 2) det.push(mk(hvD`M0 -27.4V${-17.6}`, .9, .55));
      if (lv >= 2) det.push(mk(`M-3.6 -24.2Q-2 -23.4 -.6 -24.2M.6 -24.2Q2 -23.4 3.6 -24.2M-3.6 -21.2Q-2 -20.4 -.6 -21.2M.6 -21.2Q2 -20.4 3.6 -21.2`, .9, .6));
      if (lv >= 3) det.push(mk(`M-3.4 -18.4Q-2 -17.8 -.6 -18.4M.6 -18.4Q2 -17.8 3.4 -18.4`, .9, .6) + mk(hvD`M${-W + 1} -25Q${-W + 2.8} -21.6 ${-W + 2.2} -17.4M${W - 1} -25Q${W - 2.8} -21.6 ${W - 2.2} -17.4`, .9, .55));
      if (lv >= 4) det.push(mk(hvD`M${-S + 1.6} -27.4l2 1M${-S + 1.8} -25.4l2 .9M${S - 1.6} -27.4l-2 1M${S - 1.8} -25.4l-2 .9`, .8, .55));
      if (lv >= 3) det.push(mk(hvD`M${-S + 3} ${y0 + .6 - g.T * .3}Q${-S * .5} ${y0 + 2} -4.4 ${y0 - g.T + 1.2}M${S - 3} ${y0 + .6 - g.T * .3}Q${S * .5} ${y0 + 2} 4.4 ${y0 - g.T + 1.2}`, .8, .4));
      if (lv <= 2) det.push(`<ellipse cx="0" cy="-19.6" rx=".8" ry="1.1" fill="${ln}" opacity=".8"/>`);
    } else {
      /* elle : brassière de départ + abdos qui se dessinent */
      det.push(`<path d="${hvD`M${-S - 1} ${y0 + 1.6}H${S + 1}V${y0 + 9.4}Q0 ${y0 + 11} ${-S - 1} ${y0 + 9.4}Z`}" fill="${C.mat("bra", ["#a8e0ff", "#6ec6ff", "#3d97d6"])}" ${C.sk(1.1)}/><path d="${hvD`M${-S - 1} ${y0 + 8.4}Q0 ${y0 + 10} ${S + 1} ${y0 + 8.4}`}" stroke="#f4f8ff" stroke-width="1.8" fill="none"/><path d="${hvD`M-5 ${y0 + 1.7}Q0 ${y0 + 4.6} 5 ${y0 + 1.7}`}" stroke="#3d97d6" stroke-width=".9" fill="none"/>`);
      if (lv >= 2) det.push(mk(`M0 -24.2V-18.6`, .9, .5) + mk(`M-3 -22.4Q-1.8 -21.8 -.6 -22.4M.6 -22.4Q1.8 -21.8 3 -22.4`, .8, .5));
      if (lv >= 3) det.push(mk(hvD`M${-W + 1.2} -23.6Q${-W + 2.6} -20.6 ${-W + 2} -17.6M${W - 1.2} -23.6Q${W - 2.6} -20.6 ${W - 2} -17.6`, .8, .5));
      det.push(`<ellipse cx="0" cy="-19.2" rx=".75" ry="1.05" fill="${ln}" opacity=".8"/>`);
    }
  }
  up.push(`<g clip-path="${C.clip("ct", tD)}">${det.join("")}</g>`);
  if (!top) up.push(C.rim(hvD`M${S - .9} ${y0 + 4}C${S - 1.1} ${y0 + 11} ${W} ${g.y1 - 7} ${W - .8} ${g.y1 - 2.6}`, 1, .75));
  if (rob) up.push(`<circle cx="0" cy="${top ? -21.4 : -25.6}" r="${top ? 0 : 3.8}" fill="#0b1120" ${C.sk(1)}/>${top ? "" : `<circle cx="0" cy="-25.6" r="2.1" fill="${HV_VOLT}"/>`}`);
  const upA = up.join("");
  /* bas */
  const hip = hvBottoms(C, g, bot, "hip");
  /* haut + cou + bras */
  const up2 = [];
  if (top) up2.push(hvTee(C, g, top, rob, fem, T));
  if (eq.neck) up2.push(hvNeck(C, eq.neck, g));
  else if (conva) up2.push("HVSKN");
  if (back) up2.push(hvBack(C, back, g, "f"));
  [-1, 1].forEach(sx => { const flip = sx < 0, a = g.A / 2, b = g.B, q = [];
    const hyT = `translate(0 ${hvR(g.hy - 15.6)})`;
    const hit = sx > 0 && eq.hand && hvHand(C, eq.hand) && (dyn || m !== "c") ? `<g class="hv-hit" transform="${hyT}">${hvHand(C, eq.hand)}</g>` : "";
    if (rob && !top) q.push(`<ellipse cx="0" cy="-.6" rx="${hvR(a + 1.6 + lv * .25)}" ry="${hvR(a * .9 + .8)}" fill="${flip ? skinB : skin}" ${SK}/>`);
    q.push(`<path d="${hvArmD(g)}" fill="${flip ? skinB : skin}" ${SK}/>`);
    if (rob) q.push(`<path d="${hvD`M${-a * .86} ${9.6 + (g.hy - 15.6) * .6}H${a * .86}`}" stroke="${T.j}" stroke-width="1.8"/>`);
    else { if (lv >= 2) q.push(`<path d="${hvD`M${-a - b * .5} ${8.6 + (g.hy - 15.6) * .5}Q${-a * .3} ${9.8 + (g.hy - 15.6) * .5} ${a * .2} ${9.2 + (g.hy - 15.6) * .5}`}" stroke="${T.ln}" stroke-width=".8" fill="none" opacity=".55" stroke-linecap="round"/>`);
      if (lv >= 3 && !top) q.push(`<path d="${hvD`M${-a * .7} 3.6Q0 5 ${a * .8} 2.8`}" stroke="${T.ln}" stroke-width=".8" fill="none" opacity=".5" stroke-linecap="round"/>`); }
    if (top) q.push(hvTeeSleeve(C, g, top, flip));
    else if (!flip) q.push(C.rim(hvD`M${a + .2} 1.4C${a + b * .9 - .5} 4 ${a + b * .5 - .5} 7.4 ${a * .82 - .4} 10`, .9, .7));
    if (hit) q.push(hit);
    if (flip && conva && !lite) q.push("HVSKM");
    q.push(rob ? `<circle cx="0" cy="${hvR(g.hy)}" r="${hvR(g.hr + .2)}" fill="${T.j}" ${SK}/><circle cx="0" cy="${hvR(g.hy)}" r="${hvR(g.hr - 1)}" fill="${flip ? skinB : skin}"/>` : `<circle cx="0" cy="${hvR(g.hy)}" r="${hvR(g.hr)}" fill="${flip ? skinB : skin}" ${SK}/>`);
    if (!rob) q.push(`<path d="${hvD`M${-g.hr * .55} ${g.hy - g.hr * .1}q-.8 1.4 .4 2.4`}" stroke="${T.ln}" stroke-width=".7" fill="none" opacity=".6" stroke-linecap="round"/>`);
    const inner = q.join(""), base = hvR(-sx * g.ang);
    up2.push(`<g transform="translate(${hvR(sx * g.px)} ${hvR(g.py)}) rotate(${base})"><g class="hv-arm hv-arm${flip ? "l" : "r"}">${flip ? `<g transform="scale(-1 1)">${inner}</g>` : inner}</g></g>`); });
  if (sick) up2.push("HVSKB");
  /* tête */
  const hd = [];
  if (hair) hd.push(hvHair(C, hair === "pony" ? "pony" : hair, flat ? "flat" : "full", T, hcol, hhl, "b"));
  if (blond) hd.push(hvHair(C, "blond", flat ? "flat" : "full", T, hcol, hhl, "b"));
  if (rob) {
    if (!flat) hd.push(`<g class="hv-ant" style="transform-origin:0px -75px"><path d="M0 -75V-80.6" stroke="${T.j}" stroke-width="2.2" stroke-linecap="round"/>${C.lite ? "" : `<circle cx="0" cy="-83.2" r="4.6" fill="${HV_VOLT}" opacity=".25"/>`}<circle cx="0" cy="-83.2" r="2.8" fill="${HV_VOLT}" ${C.sk(1)}/></g>`);
    [-1, 1].forEach(sv => hd.push(`<circle cx="${sv * 19.8}" cy="-57" r="3.9" fill="${T.j}" ${C.sk(1.2)}/><circle cx="${sv * 19.8}" cy="-57" r="1.5" fill="${HV_VOLT}"/>`));
    hd.push(`<rect x="-19.6" y="-75.6" width="39.2" height="36" rx="14" fill="${headF}" ${SK}/>`);
    hd.push(C.shine(`M-13 -71.6Q-6 -74 2 -73.4Q-5 -71.2 -12 -68.6Z`, .6));
    hd.push(C.rim(`M16.8 -70.4Q19.4 -66 19 -54`, 1, .7));
    hd.push(`<rect x="-15" y="-68.6" width="30" height="21.6" rx="8" fill="${C.lg("scr", [[0, "#1b2438"], [1, "#05080f"]])}" ${C.sk(1.2)}/>${C.lite ? "" : `<path d="M-12.6 -66.4Q-4 -67.6 6 -66.6" stroke="#fff" stroke-width="1" opacity=".18" fill="none" stroke-linecap="round"/>`}`);
    hd.push(`<ellipse cx="-12.4" cy="-43.6" rx="2.6" ry="1.4" fill="#ff7aa0" opacity=".5"/><ellipse cx="12.4" cy="-43.6" rx="2.6" ry="1.4" fill="#ff7aa0" opacity=".5"/>`);
  } else {
    [-1, 1].forEach(sv => hd.push(`<ellipse cx="${sv * 18.6}" cy="-54.6" rx="3.3" ry="4.1" fill="${T.m}" ${C.sk(1.2)}/><path d="${hvD`M${sv * 18.4} -56.4q${sv * 1.2} 1.6 0 3.2`}" stroke="${T.d}" stroke-width=".8" fill="none"/>`));
    hd.push(`<ellipse cx="0" cy="-57" rx="19" ry="17.6" fill="${headF}" ${SK}/>`);
    hd.push(C.rim(`M12.6 -69.6A18.1 16.8 0 0 1 16.2 -46.6`, 1.1, .75));
    if (hair === "chauve") hd.push(C.shine(`M-12 -66Q-6 -73 2 -72.6Q-5 -70 -10.6 -63.6Z`, .4));
    if (LX && LX.beard) hd.push(`<path d="M-18.4 -54C-18.6 -41.6 -10.6 -36.6 0 -36.6C10.6 -36.6 18.6 -41.6 18.4 -54C16.4 -48 12.8 -44.6 8.4 -44.8C5.6 -46.8 -5.6 -46.8 -8.4 -44.8C-12.8 -44.6 -16.4 -48 -18.4 -54Z" fill="${hcol}" ${C.sk(1.2)}/><path d="M-6 -47.6Q0 -50.4 6 -47.6Q0 -48.6 -6 -47.6Z" fill="${hcol}" ${C.sk(1)}/>`);
    hd.push(`<path d="M-.8 -50.4Q.2 -49.6 1 -50.4" stroke="${T.d}" stroke-width=".9" fill="none" stroke-linecap="round"/>`);
  }
  /* expressions */
  const hc = rob ? null : hcol;
  if (dyn) ["n", "h", "x", "s", "c"].forEach(k => hd.push(`<g class="hv-fx hv-fx-${k}">${hvExpr(C, k, rob, fem, T, hc, etat)}</g>`));
  else hd.push(hvExpr(C, m, rob, fem, T, hc, etat));
  if (sick) hd.push("HVSKH");
  if (hair && hair !== "chauve") hd.push(hvHair(C, hair === "pony" ? "pony" : hair, flat ? "flat" : "full", T, hcol, hhl, "f"));
  if (blond) hd.push(hvHair(C, "blond", flat ? "flat" : "full", T, hcol, hhl, "f"));
  if (eq.face) hd.push(hvFace(C, eq.face, rob));
  if (hat) hd.push(hvHat(C, hat, rob, T));
  /* assemblage */
  p.push(`<g transform="translate(0 ${-HV_LIFT})"><g class="hv-br">${upA}</g>${hip}<g class="hv-br">${up2.join("")}<g transform="translate(0 -38) scale(${HV_HS}) translate(0 38)"><g class="hv-hd" style="transform-origin:0px -40px">${hd.join("")}</g></g></g></g>`);
  /* quand il a froid, il pose son objet par terre pour se frotter les bras */
  if (eq.hand && hvHand(C, eq.hand) && (dyn || m === "c")) { const dp = { haltere: [19, -20.6], haltereor: [19, -22], kettle: [19, -27.8], shaker: [19, -29.2] }[eq.hand] || [19, -21];
    p.push(`<g class="hv-drop"${dyn ? "" : ' style="display:inline"'}><g transform="translate(${dp[0]} ${dp[1]})">${hvHand(C, eq.hand)}</g></g>`); }
  if (aura) p.push(hvAura(C, aura, "f"));
  if (etat === "pause") p.push("HVSKF");   /* flocons, devant */
  if (!lite && !st) p.push(`<g class="hv-zz" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="M16 -76h3.6l-3.6 4h3.6"/><path d="M22 -84h4.6l-4.6 5h4.6"/></g><g class="hv-puff" fill="#e8f6ff"><circle cx="7" cy="-44" r="1.8"/><circle cx="10" cy="-45.6" r="2.4"/><circle cx="13.6" cy="-44.6" r="1.6"/></g>`);
  p.push(`</g>`);
  const vb = o.vb || "-40 -94 80 98", ek = etat ? " hv-" + etat : "";
  let svg = `<svg class="hh ${cls}${lite ? " hv-lite" : ""}${ek}"${etat ? ` data-et="hv-${etat}"` : ""} viewBox="${vb}"${st ? ` xmlns="http://www.w3.org/2000/svg" width="${o.w || 400}" height="${o.h || 490}"` : ""} style="--hug:${g.hug}deg;--dl:-HVDLs" aria-hidden="true">${C.defs.length ? `<defs>${C.defs.join("")}</defs>` : ""}${p.join("")}</svg>`;
  if (etat) { /* couleurs passées, puis les accessoires d'état en couleurs franches */
    const A = hvCtx(true, HV_TOK);
    svg = hvDesat(svg, HV_ETATS[etat], HV_VOILE[etat]).replace("HVSKH", () => hvSickHead(rob)).replace("HVSKB", () => hvBlanket(g))
      .replace("HVSKN", () => hvNeck(A, "conva", g)).replace("HVSKM", () => hvMug(g)).replace("HVSKG", hvGivreSol).replace("HVSKF", hvGivre);
  }
  return svg;
}

/* ================================== ICÔNES D'OBJETS ================================== */
const HV_GHEAD = `<g class="hv-gh"><ellipse cx="0" cy="-57" rx="19" ry="17.6" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".14" stroke-width="1"/></g>`;
const HV_GBODY = `<g class="hv-gh" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".12" stroke-width="1"><ellipse cx="0" cy="-57" rx="19" ry="17.6"/><path d="M-10 -36H10Q13 -36 12.6 -32L10 -15H-10L-12.6 -32Q-13 -36 -10 -36Z"/><path d="M-7 -15H-1.4V-1H-7ZM1.4 -15H7V-1H1.4Z"/></g>`;
/* icône d'un objet seul (collection, ensembles) : modèle en cache, identifiants uniques à chaque copie */
const HV_ICACHE = new Map();
function drawItem(id, o = {}) {
  const k = id + "|" + (o.lite ? 1 : 0) + "|" + (o.cat || "");
  let t = HV_ICACHE.get(k); if (!t) { t = hvItemBuild(id, o); HV_ICACHE.set(k, t); }
  return t.split(HV_TOK).join("hv" + (++hvUid).toString(36) + "_");
}
function hvItemBuild(id, o) {
  const it = hvSafe(() => GM_IT[id]) || { cat: o.cat };
  const C = hvCtx(!!o.lite, HV_TOK), g = hvGeo("homme", 2), T = HV_TONE.human.clair; let vb = "-20 -20 40 40", body = "";
  const cat = it.cat;
  if (cat === "skin") { const P = HV_TEE[id], d = "M-9.6 -14.6L-4.2 -16.6Q0 -13.8 4.2 -16.6L9.6 -14.6L16 -8.2L12 -3.8L9.6 -5.8V13.2Q0 14.8 -9.6 13.2V-5.8L-12 -3.8L-16 -8.2Z";
    const q = [];
    if (id === "galaxie") { q.push(`<ellipse cx="-3" cy="2" rx="14" ry="4" fill="#ff7ae0" opacity=".35" transform="rotate(-18 0 2)"/>`); [[-6, -6, .8], [5, 3, .6], [7, -8, .9], [-2, 9, .6], [1, -2, .5], [-7, 4, .6]].forEach(([x, y, r]) => q.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`)); }
    if (id === "ocean") q.push(`<path d="M-16 5Q-8 2 0 5T16 5V16H-16Z" fill="${P[2]}" opacity=".35"/>`);
    if (id === "braise") q.push(`<path d="M-12 14L-9 6L-6 12L-3 4.6L0 11.4L3 5L6 12.4L9 6L12 14Z" fill="${P[2]}" opacity=".5"/>`);
    if (id === "chrome" || id === "or") q.push(`<path d="M-2 -18H4L-4 16H-10Z" fill="#fff" opacity="${id === "or" ? .32 : .14}"/>`);
    body = `<path d="${d}" fill="${C.mat("ti", P)}" ${C.sk(1.3)}/><g clip-path="${C.clip("ti", d)}">${q.join("")}<path d="M9 -5V12.6" stroke="${HV_VOLT}" stroke-width="1" opacity="${id === "volt" ? 0 : .7}"/></g><path d="M-4.2 -16.6Q0 -10.6 4.2 -16.6Q0 -13.4 -4.2 -16.6Z" fill="${P[2]}" ${C.sk(1)}/>${hvBolt(0, -3, 1.6, HV_LOGO[id], id === "blanc" ? HV_INK : null)}${id === "chrome" ? `<path d="M-4.6 -15.6Q0 -9.6 4.6 -15.6" stroke="${HV_VOLT}" stroke-width=".8" fill="none"/>` : ""}${id === "or" ? hvStar(6, -8, 2, "#fff") : ""}`; }
  else if (cat === "legs") { const B = HV_BOT[id];
    if (B.long) { const d = "M-9.6 -15H9.6L10.8 15.4H3.2L.4 -2.6L-2.8 15.4H-10.8Z";
      body = `<path d="${d}" fill="${C.mat("bi", B.c)}" ${C.sk(1.3)}/><rect x="-10.2" y="-17" width="20.4" height="3.6" rx="1.6" fill="${B.c[2]}" ${C.sk(1.1)}/>${id === "jogging" ? `<rect x="-11.4" y="11.6" width="8.6" height="3.8" rx="1.4" fill="${B.s}" ${C.sk(1)}/><rect x="3" y="11.6" width="8.6" height="3.8" rx="1.4" fill="${B.s}" ${C.sk(1)}/><path d="M-1.4 -13.4l-.8 4M1.4 -13.4l.8 4" stroke="#fff" stroke-width=".9" stroke-linecap="round"/>` : `<path d="M-7 -12L-8 13M7 -12L8 13" stroke="${B.s}" stroke-width=".9" opacity=".6"/>`}`; }
    else { const d = "M-12 -10H12L14 9Q7 11 1.6 9L0 1.6L-1.6 9Q-7 11 -14 9Z";
      body = `<path d="${d}" fill="${C.mat("bi", B.c)}" ${C.sk(1.3)}/><rect x="-12.6" y="-12.4" width="25.2" height="4" rx="1.8" fill="${B.c[2]}" ${C.sk(1.1)}/><path d="M11 -7L12.6 7.6M-11 -7L-12.6 7.6" stroke="${B.s}" stroke-width="1.5" stroke-linecap="round"/>${id === "short_or" ? `<path d="M-7 -7.4H-3L-6 7H-10Z" fill="#fff" opacity=".35"/>` : ""}`; }
    vb = "-19 -19 38 38"; }
  else if (cat === "feet") { const P = HV_SHOE[id], hi = P.hi;
    body = `${hi ? `<path d="M-12.6 -2V-13.6Q-12.6 -15.4 -10.8 -15.4H-3.6Q-1.8 -15.4 -1.8 -13.6V-4Z" fill="${C.lg("fi", [[0, P.u[0]], [1, P.u[1]]])}" ${C.sk(1.3)}/><path d="M-12.6 -12.6H-1.8" stroke="#fff" stroke-width="1.4"/>` : ""}<path d="M-14.6 3.6C-14.6 -2 -11.6 -6.6 -6 -6.6H-1.6C1 -6.6 2.4 -2.6 6.4 -1.6C11 -.6 15 .6 15 3.6Z" fill="${C.lg("fi", [[0, P.u[0]], [1, P.u[1]]])}" ${C.sk(1.3)}/><path d="M-15.6 2.8H15.6Q16.6 7.4 13.6 7.4H-13Q-16.4 7.4 -15.6 2.8Z" fill="${P.so}" ${C.sk(1.3)}/><path d="M-9.6 1L-1 -3.4M-6.6 1.8L1.4 -2" stroke="${P.a}" stroke-width="1.6" stroke-linecap="round"/><path d="M-.6 -5.6l1.6 1.4M1.6 -4.4l1.6 1.4M3.8 -3.2l1.6 1.4" stroke="${hi ? "#fff" : id === "baskets" ? HV_VOLT : "#fff"}" stroke-width=".9" stroke-linecap="round" opacity=".9"/>${C.lite ? "" : `<ellipse cx="-8.4" cy="-3.6" rx="2.6" ry=".9" fill="#fff" opacity=".5" transform="rotate(-20 -8.4 -3.6)"/>`}`;
    vb = "-18 -18 36 30"; }
  else if (cat === "hat") { body = HV_GHEAD + hvHat(C, id, false, T); vb = { couronne: "-20 -93 40 34", aureole: "-21 -96 42 34", crete: "-21 -95 42 40", casquette: "-23 -82 54 34", casque: "-28 -82 56 40", bandeau: "-23 -76 54 34" }[id] || "-24 -90 48 40"; }
  else if (cat === "face") { body = HV_GHEAD + hvFace(C, id, false); vb = "-22 -68 44 30"; }
  else if (cat === "neck") { body = hvNeck(C, id, g); vb = "-17 -44 34 30"; }
  else if (cat === "back") { const gg = hvGeo("homme", 1);
    if (id === "sac") { body = `<g transform="translate(26 0) scale(1.5)">${hvBack(C, "sac", gg, "b")}</g>`; vb = "-19 -42 34 30"; body = `<g transform="translate(12 6) scale(1.4) translate(0 0)">${hvBack(C, "sac", gg, "b")}</g><path d="M-4 -34Q-2 -44 4 -41Q10 -38 9 -30" stroke="${HV_INK}" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M-4 -34Q-2 -44 4 -41Q10 -38 9 -30" stroke="#ff7a3d" stroke-width="2" fill="none" stroke-linecap="round"/>`; vb = "-16 -46 32 34"; }
    else { body = hvBack(C, id, gg, "b") + HV_GBODY.replace(/<ellipse[^>]*\/>/, "") + hvBack(C, id, gg, "f"); vb = { cape: "-22 -50 44 50", ailes: "-40 -56 80 40", jetpack: "-22 -44 44 40" }[id]; } }
  else if (cat === "hand") { body = `<g transform="rotate(-24 2 16)">${hvHand(C, id)}</g>`; vb = { haltere: "-12 4 24 24", haltereor: "-13 3 27 26", kettle: "-9 6 18 22", shaker: "-8 7 16 24" }[id]; }
  else if (cat === "aura") { const gb = HV_GBODY.replace('fill-opacity=".05"', 'fill-opacity=".09"');
    if (id === "flammes") { body = hvAura(C, id, "b") + gb; vb = "-34 -102 68 106"; }
    else if (id === "eclairs") { body = gb + hvAura(C, id, "b") + hvAura(C, id, "f"); vb = "-32 -80 64 86"; }
    else { body = gb + `<g>${[[-20, -66, 7], [19, -46, 6], [-18, -26, 5.4], [16, -74, 4.4], [17, -14, 4]].map(([x, y, r]) => hvStar(x, y, r, "#fff6b0")).join("")}</g>`; vb = "-30 -82 60 88"; } }
  return `<svg class="hvi" viewBox="${vb}" aria-hidden="true">${C.defs.length ? `<defs>${C.defs.join("")}</defs>` : ""}${body}</svg>`;
}

/* =====================================================================================
   OUTILS PARTAGÉS : vibrations, légendes incarnées, « NOUVEAU »
   ===================================================================================== */
/* vibrations : pont natif HMGN (js/native.js) dans l'appli, sinon plugin Capacitor, sinon navigator.vibrate (Android).
   kind : "selection" | "light" | "medium" | "heavy" | "success" | "warning" */
function heroVibre(kind) {
  const ok = r => { if (r && r.catch) r.catch(() => { }); };
  try {
    const N = window.HMGN, H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (N && N.natif) return ok(kind === "success" ? N.succes && N.succes() : kind === "warning" ? N.alerte && N.alerte() : N.tap && N.tap());
    if (H) return ok(kind === "selection" ? H.selectionChanged() : kind === "success" || kind === "warning" ? H.notification({ type: kind.toUpperCase() }) : H.impact({ style: kind === "medium" ? "MEDIUM" : kind === "heavy" ? "HEAVY" : "LIGHT" }));
    if (navigator.vibrate) navigator.vibrate({ selection: 6, light: 10, medium: 18, heavy: 28, success: [12, 40, 18], warning: [20, 60, 20] }[kind] || 8);
  } catch (e) { }
}
/* incarner une légende : on garde le héros de base (gmS.eq.base) et la tenue d'avant (gmS.legPrev) pour pouvoir « Quitter » */
function heroIncarne(k) {
  const e = gmS.eq;
  if (!GM_LG[e.hero]) { e.base = e.hero || "homme"; gmS.legPrev = { skin: e.skin, legs: e.legs, feet: e.feet, hat: e.hat, aura: e.aura }; }
  e.hero = k; e.skin = null; e.legs = null; e.feet = null; e.hat = null; e.aura = null; gmSave();
}
/* quitter la légende : retour au héros de base, avec la tenue d'avant (si on a toujours les objets) */
function heroQuitte() {
  const e = gmS.eq; if (!GM_LG[e.hero]) return;
  e.hero = e.base && GM_HEROES.some(h => h.k === e.base) ? e.base : "homme";
  const pv = gmS.legPrev || {}; ["skin", "legs", "feet", "hat", "aura"].forEach(c => { if (!e[c] && pv[c] && gmOwn(pv[c])) e[c] = pv[c]; });
  delete gmS.legPrev; gmSave();
}
/* « NOUVEAU » : objets possédés jamais regardés dans la collection (gmS.vus) */
function heroVu(id) { if (!Array.isArray(gmS.vus)) gmS.vus = gmS.items.slice(); if (gmS.vus.includes(id)) return false; gmS.vus.push(id); return true; }
const heroNouveaux = () => { const v = Array.isArray(gmS.vus) ? gmS.vus : gmS.items; return gmS.items.filter(id => GM_IT[id] && !v.includes(id)); };

/* =====================================================================================
   « MA COLLECTION » : écran plein écran (remplace l'ancien gmColl, 5-inventaire.png)
   Toucher un objet = l'ESSAYER : rien n'est enregistré. « Porter », « Retirer », « Incarner », « Quitter » enregistrent.
   ===================================================================================== */
const HV_RAR = { C: "#c3cddf", R: "#3fd8ff", E: "#c08cff", L: "#ffc93d" };
const HC_CAT = { skin: "Hauts", legs: "Bas", feet: "Chaussures", hat: "Tête", neck: "Cou", face: "Lunettes", back: "Dos", hand: "Main", aura: "Auras" };
/* ensembles : des objets qui vont bien ensemble, « Tout porter » les enfile d'un coup (aucun bonus de jeu : à valider avec Mino) */
const HV_SETS = [
  { k: "recrue", n: "Recrue HMG", c: "#c3cddf", ids: ["blanc", "short_noir", "baskets", "haltere"] },
  { k: "volt", n: "Full Volt", c: "#c8ff1e", ids: ["volt", "short_volt", "baskets_volt", "bonnet_volt", "eclairs"] },
  { k: "hiver", n: "Hiver HMG", c: "#3fd8ff", ids: ["bonnet_hmg", "echarpe_hmg", "jogging", "montantes"] },
  { k: "cyber", n: "Cyber Nuit", c: "#c08cff", ids: ["chrome", "cyber", "legging", "jetpack"] },
  { k: "ange", n: "Petit ange", c: "#ffb3e6", ids: ["ailes", "aureole", "coeur", "baskets_bl"] },
  { k: "or", n: "Or massif", c: "#ffc93d", ids: ["or", "short_or", "baskets_or", "couronne", "echarpe_or", "haltereor"] }];
const hvSetOf = id => HV_SETS.find(S => S.ids.includes(id));
const hvA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const hvE = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const HC_IC = {
  x: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a0f02" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  back: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
  share: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>` };
const HC = { el: null, tab: "all", sel: null, cheer: 0, ct: 0, focus: null };
const hcQ = s => HC.el && HC.el.querySelector(s);
const hcRar = r => (GM_RAR[r] && GM_RAR[r].t) || "";
const hcHeroN = k => { const L = GM_LG[k]; if (L) return L.n; const h = GM_HEROES.find(x => x.k === k); return h ? h.n : "Lui"; };
const hcToneN = eq => { const t = gmTones(eq.hero).find(x => x.k === (eq.tone || "clair")); return t ? t.n : ""; };
const hcLegOn = () => GM_LG[gmS.eq.hero] ? gmS.eq.hero : null;
/* séance du grand coffre qui débloquera cette légende (même ordre que gmLegRoll, propre à chaque joueur) */
function hcLegAt(k) {
  const ord = GM_LEG.slice().sort((a, b) => gmHash(voterId + a.k) - gmHash(voterId + b.k)).filter(l => gmS.leg[l.k] == null);
  const j = ord.findIndex(l => l.k === k); return j < 0 ? null : 20 * (GM_LEG.length - ord.length + j + 1);
}
/* ce que le héros de la scène porte : la tenue enregistrée + l'objet (ou la légende, ou l'ensemble) en essai */
function hcEq() {
  const eq = { ...gmS.eq }, s = HC.sel; if (!s) return eq;
  if (s.startsWith("leg:")) { const k = s.slice(4); return gmS.leg[k] != null && eq.hero !== k ? { ...eq, hero: k, skin: null, legs: null, feet: null, hat: null, aura: null } : eq; }
  if (s.startsWith("set:")) { const S = HV_SETS.find(x => x.k === s.slice(4)); if (S) S.ids.filter(gmOwn).forEach(id => { eq[GM_IT[id].cat] = id; }); return eq; }
  const it = GM_IT[s]; if (it && gmOwn(s)) eq[it.cat] = s; return eq;
}
function hcDescribe(eq, lv) {
  const parts = GM_CATS.map(([c]) => eq[c] && GM_IT[eq[c]] ? GM_IT[eq[c]].n : null).filter(Boolean);
  return "Ton héros : " + hcHeroN(eq.hero) + (GM_LG[eq.hero] ? "" : ", " + hcToneN(eq).toLowerCase()) + ", " + GM_MUS[lv].n + (parts.length ? ", porte : " + parts.join(", ") : ", en caleçon");
}
const hcSay = t => { const l = hcQ(".hc-sr"); if (l) { l.textContent = ""; setTimeout(() => { l.textContent = t; }, 40); } };
function hcRenderStage(anim) {
  const st = hcQ(".hc-stage"); if (!st) return;
  const sel = HC.sel, it = sel && GM_IT[sel], lk = sel && sel.startsWith("leg:") ? sel.slice(4) : null, lg = lk && GM_LG[lk], S = sel && sel.startsWith("set:") ? HV_SETS.find(x => x.k === sel.slice(4)) : null;
  /* halo : couleur de la rareté essayée, sinon la couleur du thème (définie dans css/heros.css) */
  const gc = it ? HV_RAR[it.r] : lg ? HV_RAR.L : S ? S.c : null;
  if (gc) { st.style.setProperty("--gc", gc); st.style.setProperty("--gca", hvA(gc, .26)); st.style.setProperty("--gcb", hvA(gc, .42)); }
  else ["--gc", "--gca", "--gcb"].forEach(v => st.style.removeProperty(v));
  const lv = heroLvAff(), eq = hcEq(), d = gDays(), real = hvSafe(() => gmHeroLv()) || 0, M = GM_MUS[lv], N = GM_MUS[real + 1], sick = window.HMG_HEROS_ETAT === "malade";
  const hr = hcQ(".hc-hero");
  hr.innerHTML = drawHero(eq, { mus: lv, cls: HC.cheer ? "happy cheer" : sel && !(it && !gmOwn(sel)) ? "happy idle" : "idle", pad: true, etat: "" });
  hr.setAttribute("aria-label", hcDescribe(eq, lv));
  if (anim) { hr.classList.remove("pop"); void hr.offsetWidth; hr.classList.add("pop"); }
  const ns = hcQ(".hc-tt small"); if (ns) ns.textContent = `Aventure HMG · ${d} séance${d > 1 ? "s" : ""}`;
  const pct = N ? Math.max(0, Math.min(100, Math.round((d - GM_MUS[real].d) / (N.d - GM_MUS[real].d) * 100))) : 100;
  hcQ(".hc-chip").innerHTML = `<b><span aria-hidden="true">💪</span> ${hvE(M.n)}</b><small>${sick ? "Un peu malade" : N ? `${hvE(N.n)} à ${N.d} séances` : "Niveau max atteint"}</small><div class="pb"><i style="width:${pct}%"></i></div>`;
  hcQ(".hc-chip").setAttribute("aria-label", `Physique : ${M.n}${N && !sick ? `, ${N.n} à ${N.d} séances` : ""}`);
  const n = gmS.items.filter(id => GM_IT[id]).length, rg = hcQ(".hc-ring");
  rg.style.setProperty("--p", Math.round(n / GM_TOTAL * 100)); rg.innerHTML = `<span><b>${n}</b><small>/ ${GM_TOTAL}</small></span>`; rg.setAttribute("aria-label", `${n} objet${n > 1 ? "s" : ""} sur ${GM_TOTAL}`);
  let h;
  if (it) { const o = gmOwn(sel), on = gmS.eq[it.cat] === sel, Se = hvSetOf(sel), sn = Se ? Se.ids.filter(gmOwn).length : 0, nw = o && heroNouveaux().includes(sel);
    h = `<div class="info"><b>${o ? hvE(it.n) : "Objet mystère"}</b><small>${nw ? `<span class="pill nw">Nouveau</span>` : ""}<span class="pill r-${it.r}">${hcRar(it.r)}</span>${HC_CAT[it.cat]}${o && Se ? ` · ${hvE(Se.n)} ${sn}/${Se.ids.length}` : o ? "" : " · sort des coffres"}</small></div>`
      + (o ? `<button class="act${on ? " ghost" : ""}" data-act="${on ? "off" : "wear"}">${on ? "Retirer" : "Porter"}</button>` : `<button class="act" disabled>À trouver</button>`)
      + `<button class="x" data-act="close" aria-label="Annuler l'essai">${HC_IC.x}</button>`; }
  else if (lg) { const o = gmS.leg[lk] != null, on = gmS.eq.hero === lk, at = hcLegAt(lk);
    h = `<div class="info"><b>${o ? hvE(lg.n) : "Légende mystère"}</b><small><span class="pill r-L">Légende</span>${o ? hvE(lg.pw) : at ? `Grand coffre à ${at} séances` : "Grand coffre"}</small></div>`
      + (o ? `<button class="act${on ? " ghost" : ""}" data-act="${on ? "legoff" : "legon"}">${on ? "Quitter" : "Incarner"}</button>` : `<button class="act" disabled>À débloquer</button>`)
      + `<button class="x" data-act="close" aria-label="Annuler l'essai">${HC_IC.x}</button>`; }
  else if (S) { const k = S.ids.filter(gmOwn).length;
    h = `<div class="info"><b>${hvE(S.n)}</b><small><span class="pill" style="background:${S.c}">Ensemble</span>${k}/${S.ids.length} pièce${S.ids.length > 1 ? "s" : ""}</small></div>`
      + `<button class="act" data-act="setwear"${k ? "" : " disabled"}>${k === S.ids.length ? "Tout porter" : "Porter"}</button><button class="x" data-act="close" aria-label="Annuler l'essai">${HC_IC.x}</button>`; }
  else { const k = GM_CATS.filter(([c]) => gmS.eq[c]).length, L = hcLegOn();
    h = `<div class="info"><b>${hvE(hcHeroN(gmS.eq.hero))} · ${L ? "Légende" : hvE(hcToneN(gmS.eq))}</b><small>${gmS.items.length ? `${k} objet${k > 1 ? "s" : ""} porté${k > 1 ? "s" : ""} · touche pour essayer` : "Ton premier coffre va l'habiller"}</small></div><button class="act ghost" data-act="pick">Changer</button>`; }
  hcQ(".hc-sheet").innerHTML = h;
}
function hcRenderRbar() {
  hcQ(".hc-rbar").innerHTML = ["C", "R", "E", "L"].map(r => { const all = GM_ITEMS.filter(i => i.r === r), o = all.filter(i => gmOwn(i.id)).length;
    return `<div class="r-${r}" style="--p:${Math.round(o / all.length * 100)}" role="img" aria-label="${hcRar(r)} : ${o} sur ${all.length}"><span>${hcRar(r)}</span> <b>${o}/${all.length}</b><i></i></div>`; }).join("");
}
const hcTabs = () => [["all", "Tout"], ["leg", "Légendes"], ["sets", "Ensembles"], ...GM_CATS.map(([c]) => [c, HC_CAT[c]])];
function hcTabCount(k) {
  const nw = heroNouveaux();
  if (k === "all") return [gmS.items.filter(id => GM_IT[id]).length, GM_TOTAL, nw.length];
  if (k === "leg") return [GM_LEG.filter(l => gmS.leg[l.k] != null).length, GM_LEG.length, 0];
  if (k === "sets") return [HV_SETS.filter(S => S.ids.every(gmOwn)).length, HV_SETS.length, 0];
  const a = GM_ITEMS.filter(i => i.cat === k); return [a.filter(i => gmOwn(i.id)).length, a.length, a.filter(i => nw.includes(i.id)).length];
}
function hcRenderTabs() {
  hcQ(".hc-tabs").innerHTML = hcTabs().map(([k, n]) => { const [o, t, nw] = hcTabCount(k);
    return `<button role="tab" id="hc-tab-${k}" aria-controls="hcList" aria-selected="${HC.tab === k}" tabindex="${HC.tab === k ? 0 : -1}" data-tab="${k}" aria-label="${n}, ${o} sur ${t}${nw ? `, ${nw} nouveau${nw > 1 ? "x" : ""}` : ""}">${n} <small>${o}/${t}</small>${nw ? `<span class="dot" aria-hidden="true">${nw}</span>` : ""}</button>`; }).join("");
}
function hcCard(i) {
  const o = gmOwn(i.id), on = gmS.eq[i.cat] === i.id, nw = o && heroNouveaux().includes(i.id), S = hvSetOf(i.id), r = hcRar(i.r);
  const lab = o ? `${i.n}, ${r.toLowerCase()}${on ? ", porté" : ""}${nw ? ", nouveau" : ""}` : `Objet mystère, ${r.toLowerCase()}, pas encore trouvé`;
  return `<button class="hc-it r-${i.r}${o ? "" : " lock"}${on ? " on" : ""}${HC.sel === i.id ? " sel" : ""}" data-id="${i.id}" aria-label="${hvE(lab)}"${o ? ` aria-pressed="${on}"` : ""}>`
    + `<span class="ico">${drawItem(i.id)}</span>${o ? "" : '<span class="q" aria-hidden="true">?</span>'}<b>${o ? hvE(i.n) : "???"}</b><small>${r}</small>`
    + (on ? `<span class="eq" aria-hidden="true">${HC_IC.check}</span>` : "") + (nw ? `<span class="new" aria-hidden="true">NOUVEAU</span>` : "") + (o && S ? `<span class="set" style="background:${S.c}" aria-hidden="true"></span>` : "") + `</button>`;
}
function hcLegCard(l) {
  const o = gmS.leg[l.k] != null, on = gmS.eq.hero === l.k, at = hcLegAt(l.k);
  return `<button class="hc-lg${o ? "" : " lock"}${on ? " on" : ""}${HC.sel === "leg:" + l.k ? " sel" : ""}" data-leg="${l.k}" aria-label="${o ? hvE(l.n) + ", légende, " + hvE(l.pw) + (on ? ", incarnée" : "") : "Légende mystère" + (at ? ", grand coffre à " + at + " séances" : "")}"${o ? ` aria-pressed="${on}"` : ""}>`
    + `<span class="hh-w">${drawHero({ hero: l.k }, { cls: o ? "happy idle" : "", lite: !o, etat: "" })}</span><span class="tx"><b>${o ? hvE(l.n) : "Légende mystère"}</b><em>${hvE(l.pw)}</em><small>${o ? hvE(l.pd) : at ? `Grand coffre à ${at} séances` : "Grand coffre"}</small></span>`
    + (on ? `<span class="eq" aria-hidden="true">${HC_IC.check}</span>` : "") + `</button>`;
}
function hcSetCard(S) {
  const n = S.ids.filter(gmOwn).length, done = n === S.ids.length;
  return `<div class="hc-set${HC.sel === "set:" + S.k ? " sel" : ""}" style="--sc:${S.c};--sca:${hvA(S.c, .4)};--scb:${hvA(S.c, .13)}"><div class="hd"><div><b>${hvE(S.n)}</b><small>${done ? "Ensemble complet, bravo !" : `Encore ${S.ids.length - n} pièce${S.ids.length - n > 1 ? "s" : ""} à trouver`}</small></div><span class="pr">${n}/${S.ids.length}</span></div>`
    + `<div class="ics">${S.ids.map(id => `<span class="${gmOwn(id) ? "" : "lock"}" title="${gmOwn(id) ? hvE(GM_IT[id].n) : "???"}">${drawItem(id)}</span>`).join("")}</div><div class="bar"><i style="width:${Math.round(n / S.ids.length * 100)}%"></i></div>`
    + `<div class="bt"><button data-settry="${S.k}"${n ? "" : " disabled"}>Essayer</button><button class="v" data-setwear="${S.k}"${done ? "" : " disabled"}>${done ? "Tout porter" : `Encore ${S.ids.length - n}`}</button></div></div>`;
}
function hcRenderList() {
  const L = hcQ(".hc-list"), t = HC.tab; let h = "";
  if (!gmS.items.length) h += `<div class="hc-empty"><b>Ta collection t'attend</b><span>Chaque coffre du chemin cache un objet. Le premier s'ouvre dès ta première visite dans l'aventure.</span></div>`;
  const legs = () => GM_LEG.slice().sort((a, b) => (gmS.leg[b.k] != null) - (gmS.leg[a.k] != null));
  if (t === "all") { h += `<h4>Légendes <small>${GM_LEG.filter(l => gmS.leg[l.k] != null).length}/${GM_LEG.length}</small></h4><div class="hc-lrow">${legs().map(hcLegCard).join("")}</div>`;
    GM_CATS.forEach(([c, n]) => { const a = GM_ITEMS.filter(i => i.cat === c); h += `<h4>${n} <small>${a.filter(i => gmOwn(i.id)).length}/${a.length}</small></h4><div class="hc-grid">${a.map(hcCard).join("")}</div>`; }); }
  else if (t === "leg") h += `<h4>Légendes <small>une tous les 20 séances</small></h4><div class="hc-lgrid">${legs().map(hcLegCard).join("")}</div>`;
  else if (t === "sets") h += `<h4>Ensembles <small>${HV_SETS.filter(S => S.ids.every(gmOwn)).length}/${HV_SETS.length} complets</small></h4><div class="hc-sets">${HV_SETS.map(hcSetCard).join("")}</div>`;
  else { const a = GM_ITEMS.filter(i => i.cat === t), n = (GM_CATS.find(x => x[0] === t) || [, ""])[1]; h += `<h4>${n} <small>${a.filter(i => gmOwn(i.id)).length}/${a.length}</small></h4><div class="hc-grid">${a.map(hcCard).join("")}</div>`; }
  L.innerHTML = h + `<p class="hc-hint">Les objets sortent des coffres, au fil des séances. Touche un objet pour que ton héros l'essaie.</p>`;
  L.setAttribute("aria-labelledby", "hc-tab-" + t);
}
function hcSelCards() { HC.el.querySelectorAll(".hc-it,.hc-lg,.hc-set").forEach(b => { const k = b.dataset.id || (b.dataset.leg ? "leg:" + b.dataset.leg : b.querySelector("[data-settry]") ? "set:" + b.querySelector("[data-settry]").dataset.settry : ""); b.classList.toggle("sel", k === HC.sel); }); }
function hcBurst(cat, big) {
  const st = hcQ(".hc-stage"), hero = hcQ(".hc-hero"); if (!st || !hero || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = hero.getBoundingClientRect(), sr = st.getBoundingClientRect();
  const yU = { hat: -80, face: -58, neck: -43, skin: -30, back: -32, hand: -20, legs: -14, feet: -3, aura: -48 }[cat]; const y = (r.top - sr.top) + ((yU == null ? -40 : yU) + 94) / 98 * r.height;
  const b = document.createElement("div"); b.className = "hc-burst"; b.style.top = y + "px";
  const n = big ? 14 : 9; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, dd = (big ? 70 : 46) + (i % 3) * 10, s = document.createElement("i");
    s.style.setProperty("--x", Math.cos(a) * dd + "px"); s.style.setProperty("--y", Math.sin(a) * dd * .8 + "px"); s.style.animationDelay = (i % 3) * 40 + "ms"; b.appendChild(s); }
  st.appendChild(b); setTimeout(() => b.remove(), 1000);
  if (big) { const k = document.createElement("div"); k.className = "hc-shock"; st.appendChild(k); setTimeout(() => k.remove(), 950); }
}
function hcCheer(big, cat) { HC.cheer = 1; hcRenderStage(true); if (big) hcBurst(cat || "aura", true); clearTimeout(HC.ct); HC.ct = setTimeout(() => { HC.cheer = 0; if (HC.el) hcRenderStage(); }, 1500); }
function hcPaintMap() { hvSafe(() => gmPaintHero("happy cheer")); clearTimeout(HC.pt); HC.pt = setTimeout(() => hvSafe(() => gmPaintHero()), 1500); }
function hcRefresh() { hcRenderStage(); hcRenderRbar(); hcRenderTabs(); hcRenderList(); }
function hcSetTab(k, focus) {
  HC.tab = k; hcRenderTabs(); hcRenderList(); const L = hcQ(".hc-list"); L.scrollTop = 0; HC.el.classList.remove("compact");
  const tb = hcQ("#hc-tab-" + k), bar = hcQ(".hc-tabs");
  if (tb && bar) { bar.scrollTo({ left: tb.offsetLeft - (bar.clientWidth - tb.offsetWidth) / 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); if (focus) tb.focus({ preventScroll: true }); }
}
function hcClose() {
  const el = HC.el; if (!el) return; HC.el = null; clearTimeout(HC.ct); document.removeEventListener("keydown", hcKey, true);
  el.classList.remove("in"); el.classList.add("out"); setTimeout(() => el.remove(), 280);
  /* l'onglet Moi (js/onglets.js) montre le héros : on le remet à jour avec la nouvelle tenue */
  hvSafe(() => { if (CQ.tab === "moi" && !CQ.sub) cqMoi(); });
  if (HC.focus && HC.focus.focus && HC.focus.isConnected) try { HC.focus.focus({ preventScroll: true }); } catch (e) { }
}
function hcKey(e) {
  if (!HC.el || document.querySelector(".gm-pickov,.gm-chest")) return;
  if (e.key === "Escape") { e.preventDefault(); hcClose(); return; }
  if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && e.target.closest && e.target.closest(".hc-tabs")) { e.preventDefault();
    const T = hcTabs().map(x => x[0]), i = T.indexOf(HC.tab); hcSetTab(T[(i + (e.key === "ArrowRight" ? 1 : T.length - 1)) % T.length], true); heroVibre("selection"); }
}
function heroColl() {
  if (HC.el) return;
  if (!Array.isArray(gmS.vus)) { gmS.vus = gmS.items.slice(); gmSave(); }
  HC.sel = null; HC.cheer = 0; HC.tab = "all"; HC.focus = document.activeElement;
  /* objet mis en avant : la dernière nouveauté, essayée tout de suite (sans rien enregistrer) */
  const nw = heroNouveaux(); if (nw.length) { HC.sel = nw[nw.length - 1]; HC.tab = GM_IT[HC.sel].cat; }
  const el = document.createElement("div"); el.className = "hc"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Ma collection");
  el.innerHTML = `<div class="hc-in"><div class="hc-nav"><button class="hc-ib" data-act="back" aria-label="Retour à l'aventure">${HC_IC.back}</button><div class="hc-tt"><h2>Ma collection</h2><small></small></div><button class="hc-ib" data-act="share" aria-label="Partager mon héros">${HC_IC.share}</button></div>
    <div class="hc-stage"><div class="hc-floor" aria-hidden="true"></div><div class="hc-chip" role="img"></div><div class="hc-ring" role="img"></div><div class="hc-hero" role="img" data-act="hero"></div><div class="hc-sheet"></div></div>
    <div class="hc-rbar"></div><div class="hc-tabs" role="tablist" aria-label="Catégories"></div><div class="hc-list" id="hcList" role="tabpanel"></div><div class="hc-sr" aria-live="polite"></div></div>`;
  document.body.appendChild(el); HC.el = el; hcRefresh();
  /* le focus va sur la fenêtre elle-même (VoiceOver lit « Ma collection »), sans anneau sur le bouton retour */
  el.tabIndex = -1; requestAnimationFrame(() => { el.classList.add("in"); el.focus({ preventScroll: true }); if (HC.tab !== "all") hcSetTab(HC.tab); });
  if (HC.sel) hcSay(`Nouveau : ${GM_IT[HC.sel].n}. Bouton Porter pour l'équiper.`);
  document.addEventListener("keydown", hcKey, true);
  const L = el.querySelector(".hc-list"); let raf = 0;
  L.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const y = L.scrollTop; if (y > 40) el.classList.add("compact"); else if (y < 6) el.classList.remove("compact"); }); }, { passive: true });
  /* geste de retour d'iOS : glisser depuis le bord gauche ferme l'écran */
  let sw = null;
  el.addEventListener("touchstart", e => { const t = e.touches[0]; sw = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
  el.addEventListener("touchmove", e => { if (!sw) return; const t = e.touches[0], dx = t.clientX - sw.x, dy = Math.abs(t.clientY - sw.y); if (dy > 50) sw = null; else if (dx > 70) { sw = null; heroVibre("selection"); hcClose(); } }, { passive: true });
  el.addEventListener("click", hcClick);
}
async function hcClick(e) {
  const t = e.target, tb = t.closest("[data-tab]"), itb = t.closest("[data-id]"), lg = t.closest("[data-leg]"), a = t.closest("[data-act]"), st = t.closest("[data-settry]"), sw = t.closest("[data-setwear]");
  if (tb) { if (tb.dataset.tab !== HC.tab) { hcSetTab(tb.dataset.tab, true); heroVibre("selection"); } return; }
  if (itb) { const id = itb.dataset.id, i = GM_IT[id];
    if (!gmOwn(id)) { itb.classList.remove("shake"); void itb.offsetWidth; itb.classList.add("shake"); HC.sel = id; hcRenderStage(); hcSelCards(); heroVibre("warning"); hcSay(`Objet mystère ${hcRar(i.r).toLowerCase()}. Il sort des coffres.`); return; }
    HC.sel = HC.sel === id ? null : id;
    if (heroVu(id)) { gmSave(); const nb = itb.querySelector(".new"); if (nb) nb.remove(); hcRenderTabs(); }
    hcRenderStage(true); hcSelCards();
    if (HC.sel) { hcBurst(i.cat, false); heroVibre("light"); gmSnd("pop"); hcSay(gmS.eq[i.cat] === id ? `${i.n}, déjà porté. Bouton Retirer pour l'enlever.` : `Essai : ${i.n}. Bouton Porter pour l'équiper.`); } else heroVibre("selection");
    return; }
  if (lg) { const k = lg.dataset.leg, o = gmS.leg[k] != null; HC.sel = HC.sel === "leg:" + k ? null : "leg:" + k;
    if (!o) { lg.classList.remove("shake"); void lg.offsetWidth; lg.classList.add("shake"); }
    hcRenderStage(o); hcSelCards(); heroVibre(o ? "light" : "warning"); hcSay(o ? `Essai : ${GM_LG[k].n}. Bouton Incarner pour jouer avec.` : "Légende mystère. Elle sort d'un grand coffre."); return; }
  if (st) { HC.sel = "set:" + st.dataset.settry; hcRenderStage(true); hcSelCards(); hcBurst("skin", true); heroVibre("medium"); hcSay(`Essai de l'ensemble ${HV_SETS.find(x => x.k === st.dataset.settry).n}.`); return; }
  if (sw) { HC.sel = "set:" + sw.dataset.setwear; return hcAct("setwear"); }
  if (a) return hcAct(a.dataset.act);
}
async function hcAct(k) {
  const id = HC.sel, i = id && GM_IT[id];
  if (k === "back") { heroVibre("selection"); hcClose(); return; }
  if (k === "share") { heroVibre("light"); gmShare(); return; }
  if (k === "hero") { hcCheer(false); heroVibre("light"); gmSnd("pop"); return; }
  if (k === "close") { HC.sel = null; hcRenderStage(true); hcSelCards(); heroVibre("selection"); return; }
  if (k === "pick") { heroVibre("light"); await gmPickHero(false); if (HC.el) { hcRefresh(); hcCheer(false); } return; }
  if (k === "wear" && i && gmOwn(id)) { gmS.eq[i.cat] = id; heroVu(id); HC.sel = null; gmSave(); hcPaintMap(); gmSnd("pop");
    hcCheer(i.r === "L" || i.r === "E", i.cat); if (i.r !== "L" && i.r !== "E") hcBurst(i.cat, false); heroVibre(i.r === "L" ? "success" : "medium"); hcRenderTabs(); hcRenderList(); hcSay(`C'est porté : ${i.n}.`); return; }
  if (k === "off" && i) { gmS.eq[i.cat] = null; HC.sel = null; gmSave(); hvSafe(() => gmPaintHero()); hcRenderStage(true); hcRenderList(); heroVibre("light"); hcSay(`Retiré : ${i.n}.`); return; }
  if (k === "legon" && id && id.startsWith("leg:")) { const lk = id.slice(4); if (gmS.leg[lk] == null) return; heroIncarne(lk); HC.sel = null; hcPaintMap(); gmSnd("crown"); hcCheer(true); heroVibre("success"); hcRenderList(); hcRenderTabs(); hcSay(`Tu incarnes ${GM_LG[lk].n}.`); return; }
  if (k === "legoff") { heroQuitte(); HC.sel = null; hvSafe(() => gmPaintHero()); hcRenderStage(true); hcRenderList(); heroVibre("light"); hcSay("Tu retrouves ton héros."); return; }
  if (k === "setwear" && id && id.startsWith("set:")) { const S = HV_SETS.find(x => x.k === id.slice(4)), own = S ? S.ids.filter(gmOwn) : []; if (!own.length) return;
    own.forEach(x => { gmS.eq[GM_IT[x].cat] = x; heroVu(x); }); HC.sel = null; gmSave(); hcPaintMap(); gmSnd(own.length === S.ids.length ? "crown" : "pop");
    hcCheer(true, "skin"); heroVibre(own.length === S.ids.length ? "success" : "medium"); hcRenderTabs(); hcRenderList(); hcSay(`Ensemble ${S.n} porté.`); return; }
}

/* =====================================================================================
   « CHOISIS TON HÉROS » : le contenu de la fenêtre (la logique, qui ne bloque jamais, reste dans gmPickHero)
   ===================================================================================== */
function heroPickHtml(first, hero, tone) {
  const lv = heroLvAff(), T = gmTones(hero), tn = T.find(t => t.k === tone) || T[0], eq = GM_LG[gmS.eq.hero] ? { ...gmS.eq, ...(gmS.legPrev || {}), hero: null } : gmS.eq;
  return `<div class="card glass hv-pick" role="dialog" aria-modal="true" aria-label="${first ? "Choisis ton héros" : "Change de héros"}">${first ? "" : `<button class="x" data-k="x" aria-label="Fermer">${HC_IC.x}</button>`}
    <div class="kick">L'Aventure HMG</div><h2>${first ? "Choisis ton héros" : "Change de héros"}</h2>
    <p>${first ? `Il démarre en <b>caleçon</b>. Chaque séance validée à la salle le fait avancer d'un pas et grossir ses muscles. Les <b>coffres</b> l'habillent, à ton rythme.` : "Ta collection et ta progression restent les mêmes."}</p>
    <div class="gm-pick hv-pick-h">${GM_HEROES.map(h => `<button data-hero="${h.k}" aria-pressed="${h.k === hero}" aria-label="${hvE(h.n)}, ${hvE(h.s.toLowerCase())}">${drawHero({ ...eq, hero: h.k, tone }, { mus: lv, cls: h.k === hero ? "happy idle" : "idle", pad: h.k === hero, etat: "" })}<b>${hvE(h.n)}</b><small>${hvE(h.s)}</small></button>`).join("")}</div>
    <div class="hv-tones" role="radiogroup" aria-label="${hero === "robot" ? "Finition du robot" : "Couleur de peau"}">${T.map(t => `<button type="button" role="radio" data-tone="${t.k}" aria-checked="${t.k === tone}" aria-label="${hvE(t.n)}" style="--sw:${t.c}"><i aria-hidden="true"></i></button>`).join("")}</div>
    <div class="hv-tone-n" aria-hidden="true">${hvE(tn.n)}</div>
    <button class="cy gm-go" style="width:100%" data-k="ok">${hero === "femme" ? "C'est elle !" : hero === "robot" ? "C'est mon robot !" : "C'est lui !"}</button>
    ${first ? `<button type="button" class="gm-acct" data-acct="restore">J'ai déjà un compte sur un autre ${window.HMG_CIBLE === "appli" ? "appareil" : "navigateur"}</button>` : ""}</div>`; /* [natif] pas de « navigateur » dans l'appli */
}
