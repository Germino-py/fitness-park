"use strict";
if(window.HMG_PRIVE) throw new Error("HMG : accès privé (test avant la sortie de l'appli)");
/* ================= CONFIGURATION ================
   Base Supabase : colle ici la « Project URL » et la clé « anon public ».
   Laisse vide pour le mode démo (tout reste sur l'appareil). */
const CONFIG = { url: "https://zjuabjlhktmptbgdgzke.supabase.co", key: "sb_publishable_lmH0AIyp09ymAb3p2aF7og_YIjrX95a", owner: "HMG", start: {label:"Lognes (77185)", lat:48.8357, lon:2.6290} };

const CSSV = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ACC = CSSV("--a2")||"#3fd8ff", ACC1 = CSSV("--a1")||ACC, ACC3 = CSSV("--a3")||ACC;
const MAPC = "#3fd8ff"; // la carte garde ses couleurs d'origine
const LIVE = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(CONFIG.url) && CONFIG.key.length > 20;

const $ = id => document.getElementById(id);
const store = { get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}, set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}} };
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fold = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const frDate = s => { if(!s) return ""; const d=new Date(s.length<=10?s+"T12:00:00":s); return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"}); };
const frDateTime = s => new Date(s).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)));
const ic = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
/* ================= APPLI (installation sur le téléphone) =================
   Le site s'installe comme une appli (manifest + service worker) et tourne aussi dans l'appli native (Capacitor). */
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const IS_APP = IS_NATIVE || matchMedia("(display-mode: standalone)").matches || navigator.standalone === true || /[?&]app=1\b/.test(location.search);
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if(IS_APP) document.documentElement.classList.add("is-app");
{ const q=new URLSearchParams(location.search); if(q.has("sim")){ // simulateur : marges d'écran (encoche, barre du bas) du téléphone imité
  [["sat","top"],["sab","bottom"]].forEach(([k,n])=>{ if(q.has(k)) document.documentElement.style.setProperty("--sa-"+n, (+q.get(k)||0)+"px"); }); } }
if(IS_NATIVE) document.documentElement.classList.add("is-native");
if("serviceWorker" in navigator && !IS_NATIVE && (location.protocol === "https:" || location.hostname === "localhost")) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; });
addEventListener("appinstalled", () => { store.set("hmg-app-installed", 1); const b=$("appInv"); if(b) b.remove(); toast("HMG est sur ton écran d'accueil 💪"); });
addEventListener("offline", () => toast("Hors connexion : la carte reste là, les avis reviendront avec le réseau.", 1));
addEventListener("online", () => toast("De retour en ligne ✅"));
if(IS_APP) document.addEventListener("pointerdown", e => { if(navigator.vibrate && e.target.closest && e.target.closest("button")) try{ navigator.vibrate(8); }catch(_){} }, {passive:true});
const APP_ICON = "icons/icon-192.png";
function appInvite(force){
  if(!force){
    if(IS_APP || !feat("feat_app") || store.get("hmg-app-installed", 0)) return;
    if(Date.now() - (+store.get("hmg-app-ask", 0)) < 7*864e5) return;
    if(!IS_IOS && !installEvt) return; // ordinateur ou navigateur qui ne sait pas installer
    if(document.querySelector(".modal")) { setTimeout(()=>appInvite(), 8000); return; }
  }
  if($("appInv")) return;
  store.set("hmg-app-ask", Date.now());
  const b = document.createElement("div"); b.id = "appInv"; b.className = "glass";
  b.innerHTML = `<img class="ai-ic" src="${APP_ICON}" alt=""><div class="ai-t"><b>Installe l'appli HMG</b><span>Sur ton écran d'accueil, en plein écran, même sans réseau.</span></div><button class="cy" data-ai>Installer</button><button class="ai-x" data-aix aria-label="Plus tard">${ic("x")}</button>`;
  document.body.appendChild(b); requestAnimationFrame(()=>requestAnimationFrame(()=>b.classList.add("on")));
  const close = () => { b.classList.remove("on"); setTimeout(()=>b.remove(), 500); };
  b.querySelector("[data-aix]").onclick = close;
  b.querySelector("[data-ai]").onclick = async () => {
    if(installEvt){ installEvt.prompt(); try{ const r = await installEvt.userChoice; if(r && r.outcome === "accepted") store.set("hmg-app-installed", 1); }catch(_){} installEvt = null; close(); return; }
    close(); appHowTo();
  };
}
function appHowTo(){
  const m = document.createElement("div"); m.className = "modal";
  const share = `<span class="ai-share"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span>`;
  const notSafari = IS_IOS && /CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV|TikTok|musical_ly/i.test(navigator.userAgent);
  m.innerHTML = `<div class="card glass"><div style="display:flex;align-items:center;gap:12px"><img src="${APP_ICON}" alt="" style="width:52px;height:52px;border-radius:13px"><div><h2>HMG sur ton iPhone</h2><p>2 gestes, 5 secondes.</p></div></div>
    ${notSafari ? `<p style="color:var(--a2)">Ouvre d'abord hmgfitness.fr dans <b>Safari</b> (l'installation ne marche que là).</p>` : ""}
    <ol class="ai-steps"><li><span>Touche ${share} <b>Partager</b> en bas de Safari</span></li><li><span>Choisis <b>« Sur l'écran d'accueil »</b> puis <b>Ajouter</b></span></li></ol>
    <div style="display:flex;justify-content:flex-end"><button class="cy" data-x>J'ai compris</button></div></div>${notSafari ? "" : `<div class="ai-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v15M5 12l7 7 7-7"/></svg></div>`}`;
  document.body.appendChild(m);
  m.addEventListener("click", e => { if(e.target === m || e.target.closest("[data-x]")) m.remove(); });
}

const fmt1 = x => x.toLocaleString("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:1});
function toast(t,err){ const el=document.createElement("div"); el.id="toast"; el.className="glass"; el.style.color=err?"var(--danger)":""; el.textContent=t; document.querySelectorAll("#toast").forEach(x=>x.remove()); document.body.appendChild(el); setTimeout(()=>el.remove(),3200); }

const byId = Object.fromEntries(CLUBS.map(c=>[c.id,c]));
const isDom = c => c.d.startsWith("97");
const fullAddr = c => [c.a, (c.cp+" "+c.c).trim()].filter(Boolean).join(", ");
const DEPNAME = Object.fromEntries(DEPS.map(d=>[d.c,d.n]));
const depName = c => DEPNAME[c.d] || ({"971":"Guadeloupe","972":"Martinique","973":"Guyane","974":"La Réunion","976":"Mayotte"})[c.d] || c.d;

/* ================= DONNÉES (Supabase ou démo locale) ================ */
let session = store.get("hmg-session", null);
const isAdmin = () => !!(session && session.admin);
const db = { reviews:[], photos:[], visits:{}, geo:{}, settings:{show_progress:false} };
const myRated = store.get("hmg-rated", {});
/* pouces sur les commentaires : un vote par appareil, identifiant anonyme aléatoire */
const myVotes = store.get("hmg-votes", {});
let voterId = store.get("hmg-voter", null);
if(!/^[0-9a-f]{32}$/.test(voterId||"")){ voterId = uuid().replace(/-/g,"").toLowerCase(); store.set("hmg-voter", voterId); }
let VOTES = true;
/* numéro de visiteur : un simple numéro tiré au hasard, gardé sur l'appareil et affiché à côté des avis de la personne.
   Il est rangé à la fin de l'identifiant de l'avis (ex. …-000000048213), donc rien à ajouter dans la base. */
let myNo = +store.get("hmg-visitor", 0);
if(!(Number.isInteger(myNo) && myNo>=10000 && myNo<=99999)){ myNo = 10000 + crypto.getRandomValues(new Uint32Array(1))[0] % 90000; store.set("hmg-visitor", myNo); }
const reviewId = () => uuid().toLowerCase().slice(0,24) + String(myNo).padStart(12,"0");
const visitorOf = r => { const m=/-0{6,9}([1-9]\d{2,5})$/.exec((r&&r.id)||""); return m?+m[1]:null; };
/* pseudos uniques (feat_pseudo) : le visiteur choisit un pseudo à la place de « Machine 48213 » */
let myPseudo = store.get("hmg-pseudo", null);
let PSEUDOS = {};
const psOn = () => feat("feat_pseudo");
const nameOf = no => (psOn() && (PSEUDOS[no] || (no===myNo && myPseudo))) || "Machine "+no;
const myName = () => nameOf(myNo);
const meIs = () => psOn()&&myPseudo ? myPseudo : "la Machine "+myNo;
const whoHtml = r => { const n=visitorOf(r); return n?`${esc(nameOf(n))}${n===myNo?" (toi)":""}`:"Anonyme"; };
async function api(path, opt={}){
  const h = { apikey: CONFIG.key }; if(session && session.access_token) h.Authorization = "Bearer " + session.access_token; else if(CONFIG.key.startsWith("eyJ")) h.Authorization = "Bearer " + CONFIG.key;
  let body = opt.body;
  if(body && !(body instanceof Blob)){ h["Content-Type"]="application/json"; body=JSON.stringify(body); }
  if(opt.type) h["Content-Type"]=opt.type;
  if(opt.prefer) h.Prefer=opt.prefer;
  const r = await fetch(CONFIG.url + path, { method: opt.method||"GET", headers: h, body });
  if(r.status===401 && session && !opt.retried){ if(await refresh()) return api(path,{...opt,retried:true}); }
  if(!r.ok){ let m=""; try{ const j=await r.json(); m=j.message||j.msg||j.error_description||j.error||""; }catch(e){} throw new Error(m||("Erreur "+r.status)); }
  if(r.status===204) return null;
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
async function refresh(){
  try{ const r=await fetch(CONFIG.url+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:CONFIG.key,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
    if(!r.ok) throw 0; const j=await r.json(); session={...session,access_token:j.access_token,refresh_token:j.refresh_token}; store.set("hmg-session",session); return true;
  }catch(e){ session=null; store.set("hmg-session",null); return false; }
}
const demo = { get:k=>store.get("hmg-demo-"+k,null), set:(k,v)=>store.set("hmg-demo-"+k,v) };

async function loadAll(){
  if(!LIVE){
    db.reviews = demo.get("reviews")||[]; db.photos = demo.get("photos")||[];
    db.visits = demo.get("visits") || migrateOldVisits(); db.settings = demo.get("settings")||{show_progress:false};
    return;
  }
  const adm = isAdmin();
  const [rv,ph,st,vi,ge,ps] = await Promise.all([
    api("/rest/v1/reviews?select=id,club_id,rating,comment,created_at,hidden,up,down&order=created_at.desc&limit=10000")
      .then(x=>{ VOTES=true; return x; })
      .catch(()=>{ VOTES=false; return api("/rest/v1/reviews?select=id,club_id,rating,comment,created_at,hidden&order=created_at.desc&limit=10000"); }),
    api("/rest/v1/photos?select=id,club_id,path,approved,by_admin,created_at&order=created_at.desc&limit=5000"),
    api("/rest/v1/settings?select=key,value"),
    api("/rest/v1/visits?select="+(adm?"club_id,visited_on,note":"club_id,visited_on")).catch(()=>[]),
    api("/rest/v1/club_geo?select=club_id,lat,lon").catch(()=>[]),
    rpc("pseudo_list").catch(()=>({}))
  ]);
  db.reviews = rv||[]; db.photos = (ph||[]).filter(p=>/^(pending|admin)\/[a-z0-9-]{1,80}\/[0-9a-f-]{36}\.jpg$/.test(p.path));
  db.settings = Object.fromEntries((st||[]).map(s=>[s.key,s.value]));
  db.visits = Object.fromEntries((vi||[]).map(v=>[v.club_id,{d:v.visited_on,n:v.note||""}]));
  db.geo = Object.fromEntries((ge||[]).map(g=>[g.club_id,{lat:g.lat,lon:g.lon}]));
  PSEUDOS = (ps && typeof ps==="object") ? ps : {};
  if(PSEUDOS[myNo] && PSEUDOS[myNo]!==myPseudo){ myPseudo=PSEUDOS[myNo]; store.set("hmg-pseudo",myPseudo); }
}
function migrateOldVisits(){ const old=store.get("fp-visited-v1",{}); const o={}; for(const k in old) if(byId[k]) o[k]={d:(old[k]&&old[k].d)||today(),n:(old[k]&&old[k].n)||""}; return o; }
const photoUrl = p => p.dataUrl || (CONFIG.url + "/storage/v1/object/public/photos/" + p.path);
const showProgress = () => isAdmin() || db.settings.show_progress===true;
const visited = id => showProgress() && !!db.visits[id];
/* salles visitées par un visiteur : gardées seulement sur son appareil, jamais envoyées */
const myVisits = store.get("hmg-my-visits", {});
const mineOn = () => !isAdmin() && db.settings.visitor_visits !== false;
const mine = id => mineOn() && !!myVisits[id];

/* ================= FONCTIONNALITÉS (activées une par une par l'admin) =================
   Une fonctionnalité masquée reste visible pour l'admin connecté, pour tester et filmer. */
const FEATURES = [
  {k:"feat_points", t:"Je suis à la salle + classement", d:"Le visiteur appuie sur « Je suis à la salle » : sa position est vérifiée (moins de 200 m de la salle) et il gagne 10 points, une fois par jour maximum. Classement du mois et général, série de jours d'affilée.", def:false},
  {k:"feat_welcome", t:"Message de bienvenue", d:"À l'ouverture du site : un accueil selon l'heure (« La séance du midi t'attend »), et pour un habitué « Content de te revoir, Machine 48213 » avec un compliment, ses salles, ses points et sa série.", def:false},
  {k:"feat_profile", t:"Profil du sportif", d:"Le profil de la personne : « Toi · Machine 48213 », son niveau (Recrue, Motivé, Régulier, Acharné, Machine de guerre, Légende HMG) et un compliment. On touche le profil : il se déplie avec ses points, son rang, sa série, ses salles et les boutons « Je suis à la salle », « Classement », « Mes salles ». La carte s'ouvre tout de suite : le bonjour s'affiche sous la pastille « Toi · Machine 48213 » en haut à droite, qui déplie le profil.", def:false},
  {k:"feat_pseudo", t:"Pseudos uniques", d:"À sa première visite, le visiteur choisit son pseudo (unique : personne d'autre ne peut le prendre). Il remplace « Machine 48213 » sur ses avis, au classement et dans son profil. Gros mots et noms réservés (HMG, Mino, Admin) refusés.", def:false},
  {k:"feat_angel", t:"Ange de la semaine", d:"Le sportif qui a validé au moins 3 séances (« Je suis à la salle ») la semaine précédente, du lundi au dimanche, voit un petit ange venir le féliciter à sa première visite de la semaine. Tu choisis l'animation ci-dessous et tu peux la tester.", def:false},
  {k:"feat_game", t:"Aventure HMG (jeu)", d:"Un bouton Aventure / Carte en haut. Chaque sportif choisit son héros (lui, elle ou le robot Mini-Machine, peau claire ou noire) qui démarre en caleçon et avance d'un pas à chaque séance validée (« Je suis à la salle »). Les coffres l'habillent (hauts, bas, baskets, accessoires : 42 objets), ses muscles grossissent avec les séances (de Crevette à Colosse), 4 légendes à débloquer, 7 mondes, les autres sportifs du classement visibles sur le chemin, image à partager en story. Points et classement inchangés.", def:false},
  {k:"feat_app", t:"Appli sur le téléphone", d:"Une bulle « Installe l'appli HMG » propose d'ajouter HMG sur l'écran d'accueil, comme une vraie appli (icône HMG, plein écran, s'ouvre même sans réseau). Sur Android : installation en un appui. Sur iPhone : les 2 gestes expliqués avec une petite animation. Montrée une fois par semaine maximum.", def:false},
  {k:"visitor_visits", t:"Salles des visiteurs", d:"Chaque visiteur coche « J'y suis déjà allé » et voit ses salles en doré (« Visitée par moi »). Gardé seulement sur son appareil.", def:true},
];
/* [coque] dans l'appli à onglets (js/onglets.js), le jeu, le profil, les pseudos, l'ange et les séances sont toujours là (pas d'interrupteur à distance pour Apple) */
const COQUE_FEATS = ["feat_points","feat_welcome","feat_profile","feat_pseudo","feat_angel","feat_game"];
const featOn = k => { if(COQUE_FEATS.includes(k)) return true; const f=FEATURES.find(x=>x.k===k), v=db.settings[k]; return v===true||v==="true"||((v===undefined||v===null)&&!!(f&&f.def)); };
const feat = k => isAdmin() || featOn(k);
const SCORE0 = {points:0,month:0,rank:null,rank_month:null,streak:0,today:null,clubs:0,days:0};
let score = {...SCORE0, ...store.get("hmg-score", {})};
if(score.day!==today()) score.today=null;
let ptsReady = null; // null : pas encore vérifié · true : base prête · false : script SQL pas encore collé
const ptsOn = () => feat("feat_points") && (isAdmin() || ptsReady !== false);

function stats(id){
  const rs = db.reviews.filter(r=>r.club_id===id && !r.hidden);
  const n = rs.length, avg = n ? rs.reduce((s,r)=>s+r.rating,0)/n : 0;
  const dist = Array(10).fill(0); rs.forEach(r=>dist[r.rating-1]++);
  return {n,avg,dist,rs};
}
let STATS = {};
function computeStats(){ STATS={}; for(const r of db.reviews){ if(r.hidden) continue; const s=STATS[r.club_id]||(STATS[r.club_id]={n:0,sum:0}); s.n++; s.sum+=r.rating; } }
const avgOf = id => STATS[id] ? STATS[id].sum/STATS[id].n : null;

/* ================= POSITIONS ================ */
let geoCache = store.get("fp-geo-v2", {});
function pos(c){ const g=db.geo[c.id]||(geoCache[c.id]&&geoCache[c.id].lat&&geoCache[c.id]); if(g) return {lat:g.lat,lon:g.lon}; const p=PRE[c.id]; return p?{lat:p[0],lon:p[1],approx:1}:null; }
async function ban(q,params){ const r=await fetch("https://api-adresse.data.gouv.fr/search/?q="+encodeURIComponent(q)+"&limit=1"+(params||"")); if(!r.ok) throw new Error(r.status); const j=await r.json(); return j.features&&j.features[0]; }
async function geocodeMissing(){
  const todo=CLUBS.filter(c=>c.a&&!isDom(c)&&!db.geo[c.id]&&!geoCache[c.id]);
  let i=0, fails=0, done=0;
  async function w(){ while(i<todo.length&&fails<6){ const c=todo[i++]; try{
      let f=await ban(c.a+" "+c.cp+" "+c.c,"&postcode="+c.cp); if(!f) f=await ban(c.a+" "+c.c);
      geoCache[c.id]=(f&&f.properties.type!=="municipality"&&f.properties.score>=.4)?{lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0]}:{tried:1};
      done++; if(markers[c.id]) markers[c.id].setLatLng([pos(c).lat,pos(c).lon]);
      if(done%25===0) store.set("fp-geo-v2",geoCache);
    }catch(e){ fails++; } await new Promise(r=>setTimeout(r,50)); } }
  await Promise.all([w(),w(),w(),w()]); store.set("fp-geo-v2",geoCache);
  return done;
}

/* ================= CARTE ================ */
const FR_BOUNDS=[[41.3,-5.2],[51.15,9.6]];
const TOUCH_DEV = matchMedia("(pointer:coarse)").matches;
const map = L.map("map",{zoomControl:false,minZoom:5,maxZoom:18,maxBounds:[[24,-34],[64,38]],maxBoundsViscosity:.5,zoomSnap:TOUCH_DEV?0:.25,bounceAtZoomLimits:false,zoomDelta:.75,wheelPxPerZoomLevel:90,attributionControl:false,preferCanvas:false});
const isMobile = () => innerWidth<=760;
function fitFrance(anim){ map.fitBounds(FR_BOUNDS,{paddingTopLeft:[10,isMobile()?130:90],paddingBottomRight:[isMobile()?60:20,isMobile()?150:20],animate:!!anim}); }
fitFrance(false); $("map").classList.toggle("far",map.getZoom()<7.5);
map.createPane("land").style.zIndex=250; map.createPane("deps").style.zIndex=260; map.createPane("lbls").style.zIndex=450;
/* Les contours (France, pays voisins, départements) ne sont recalculés que si on zoome ou si on sort de la zone déjà dessinée,
   au lieu de l'être à chaque fin de glissement : la carte ne « bloque » plus quand on lâche le doigt. */
const lazyUpdate = Base => Base.extend({ _update(){ const m=this._map;
  if(m && this._bounds && this._zoom===m.getZoom() && !m._animatingZoom){ const v=L.bounds(m.containerPointToLayerPoint([0,0]),m.containerPointToLayerPoint(m.getSize()));
    if(this._bounds.contains(v)) return; }
  Base.prototype._update.call(this); } });
const LazySVG=lazyUpdate(L.SVG), LazyCanvas=lazyUpdate(L.Canvas);
const landR=new LazySVG({pane:"land",padding:.6}), depsR=new LazySVG({pane:"deps",padding:.6});
map.getPane("lbls").style.pointerEvents="none";
const nbLayer=L.polygon(OUTLINE.nb,{pane:"land",renderer:landR,stroke:true,color:"rgba(147,160,184,.18)",weight:1,fillColor:"#0a0f1b",fillOpacity:.9,interactive:false}).addTo(map);
const frGlow=L.polygon(OUTLINE.fr,{pane:"land",renderer:landR,color:MAPC,weight:7,opacity:.10,fill:false,interactive:false}).addTo(map);
const frLayer=L.polygon(OUTLINE.fr,{pane:"land",renderer:landR,color:MAPC,weight:1.4,opacity:.75,fillColor:"#0d1626",fillOpacity:.92,interactive:false}).addTo(map);
const depLayer=L.layerGroup(DEPS.map(d=>L.polygon(d.r,{pane:"deps",renderer:depsR,color:MAPC,weight:.8,opacity:.22,fill:false,interactive:false}))).addTo(map);
const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'});
let tileErr=0; tiles.on("tileerror",()=>{ if(++tileErr===6&&tilesOn){ setTiles(false); toast("Le plan des rues est indisponible pour le moment.",1); } }); tiles.on("tileload",()=>{tileErr=0});
let tilesOn=false;
const lblLayer=L.layerGroup().addTo(map);
const lblCache=new Map();
function lbl(key,ll,html,cls){ let m=lblCache.get(key); if(!m){ m=L.marker(ll,{pane:"lbls",interactive:false,keyboard:false,icon:L.divIcon({className:"lbl "+cls,html,iconSize:null})}); lblCache.set(key,m);} return m; }
function updateLabels(){
  const z=map.getZoom(), b=map.getBounds().pad(.1), want=new Set(), boxes=[];
  const free=(ll,w,h)=>{ const pt=map.latLngToContainerPoint(ll), r=[pt.x-w/2-4,pt.y-h/2-2,pt.x+w/2+4,pt.y+h/2+2];
    for(const q of boxes) if(r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]) return false; boxes.push(r); return true; };
  if(!tilesOn){
    const minPop = z<5.75?250000 : z<6.5?100000 : z<7.25?40000 : z<8?20000 : z<8.75?10000 : z<9.5?6000 : 4000;
    const cand=[];
    for(const [n,la,lo,p] of CITIES){ if(p<minPop) break; if(b.contains([la,lo])) cand.push({k:"c"+n+la,ll:[la,lo],w:n.length*(p>=150000?8.4:7),h:p>=150000?30:26,html:esc(n),cls:"city"+(p>=150000?" t1":p>=50000?" t2":""),pr:p>=100000?0:2}); }
    if(z>=6&&z<10.5) DEPS.forEach(d=>{ if(b.contains(d.l)) cand.push({k:"d"+d.c,ll:d.l,w:d.n.length*(z<7?8.5:10)+6,h:28,html:`${esc(d.n)}<small>${d.c}</small>`,cls:"dep",pr:1}); });
    cand.sort((x,y)=>x.pr-y.pr);
    for(const c of cand) if(free(c.ll,c.w,c.h)) want.add(lbl(c.k,c.ll,c.html,c.cls));
  }
  lblLayer.eachLayer(l=>{ if(!want.has(l)) lblLayer.removeLayer(l); });
  want.forEach(l=>{ if(!lblLayer.hasLayer(l)) lblLayer.addLayer(l); });
  const o=tilesOn?.35:Math.round(Math.min(.55,Math.max(.18,(z-5)*.09))*100)/100; if(o!==depOp){ depOp=o; depLayer.eachLayer(p=>p.setStyle({opacity:o})); }
}
let depOp=null, lblRaf=0;
map.on("zoomend moveend",()=>{ cancelAnimationFrame(lblRaf); lblRaf=requestAnimationFrame(updateLabels); });
/* pendant qu'on fait glisser la carte sur téléphone, les panneaux en verre coupent le flou (très coûteux à recalculer à chaque image) */
if(TOUCH_DEV){ let mvT=0; const root=document.documentElement;
  const on=()=>{ clearTimeout(mvT); root.classList.add("moving"); }, off=()=>{ clearTimeout(mvT); mvT=setTimeout(()=>root.classList.remove("moving"),220); };
  map.on("movestart zoomstart",on); map.on("moveend zoomend",off); }
map.on("zoomend",()=>$("map").classList.toggle("far",map.getZoom()<7.5));
function setTiles(on){ tilesOn=on; if(on){ tiles.addTo(map); frLayer.setStyle({fillOpacity:0}); nbLayer.setStyle({fillOpacity:0}); } else { map.removeLayer(tiles); frLayer.setStyle({fillOpacity:.92}); nbLayer.setStyle({fillOpacity:.9}); }
  $("bTiles").classList.toggle("on",on); $("legal").classList.toggle("osm-on",on); $("bTiles").setAttribute("aria-pressed",on); updateLabels(); }
if(store.get("hmg-tiles",true)) setTiles(true);

/* marqueurs : dessinés sur un seul canvas (et non 375 éléments de page) pour une carte fluide sur téléphone.
   Chaque style de pastille est dessiné une fois dans une petite image, puis recopiée : très rapide. */
map.createPane("pins").style.zIndex=600;
const TOUCH = TOUCH_DEV;
const pinRenderer=new LazyCanvas({pane:"pins",padding:.4,tolerance:TOUCH?12:4});
const clubLayer=L.layerGroup().addTo(map);
const markers={};
let selected=null, startMarker=null, routeLine=null;
const PINCOL={}; const pinCol=k=>PINCOL[k]||(PINCOL[k]=CSSV("--"+k)||({gold:"#ffd166",done:"#2bffa0",soon:"#b18cff",todo:"#ff6a2b"})[k]);
const SPR=new Map(), DPR=Math.min(3,devicePixelRatio||1), SPS=64;
function sprite(kind,colKey,sel,far){
  const key=kind+colKey+(sel?1:0)+(far?1:0); let cv=SPR.get(key); if(cv) return cv;
  cv=document.createElement("canvas"); cv.width=cv.height=SPS*DPR; const x=cv.getContext("2d"); x.scale(DPR,DPR); x.translate(SPS/2,SPS/2);
  const col=pinCol(colKey), big=kind==="done"||kind==="mine", k=sel?1.5:1;
  let r=(big?(far?5:7):(far?3.5:5))*k;
  if(kind==="done"){ x.globalAlpha=.5; x.lineWidth=1.5; x.strokeStyle=col; x.beginPath(); x.arc(0,0,14*k,0,7); x.stroke(); x.globalAlpha=1; }
  if(kind==="soon"){ /* chantier : petit panneau carré à bandes, net, sans flou */
    const h=(far?4.6:6)*k, rr=2*k, sq=()=>{ x.beginPath(); x.roundRect?x.roundRect(-h,-h,2*h,2*h,rr):x.rect(-h,-h,2*h,2*h); };
    x.save(); x.rotate(Math.PI/4); sq(); x.fillStyle="#05070d"; x.lineWidth=4; x.strokeStyle="rgba(5,7,13,.9)"; x.stroke(); x.fill();
    sq(); x.clip(); x.fillStyle=col; x.fillRect(-h,-h,2*h,2*h); x.fillStyle="#1a1030"; x.rotate(-Math.PI/4);
    for(let i=-4;i<=4;i++){ x.beginPath(); const o=i*3.6*k; x.moveTo(o-12*k,-12*k); x.lineTo(o-12*k+1.6*k,-12*k); x.lineTo(o+12*k+1.6*k,12*k); x.lineTo(o+12*k,12*k); x.closePath(); x.fill(); }
    x.restore(); x.save(); x.rotate(Math.PI/4); sq(); x.lineWidth=1.2; x.strokeStyle="rgba(255,255,255,.85)"; x.stroke(); x.restore(); }
  else { x.shadowColor=col; x.shadowBlur=big?22:16; x.fillStyle=col; x.beginPath(); x.arc(0,0,r,0,7); x.fill(); x.fill(); x.shadowBlur=4; x.fill(); x.shadowBlur=0;
    x.lineWidth=2; x.strokeStyle="rgba(5,7,13,.85)"; x.beginPath(); x.arc(0,0,r+1,0,7); x.stroke(); }
  if(kind==="mine"){ x.strokeStyle="#05070d"; x.lineWidth=2*k; x.lineCap="round"; x.lineJoin="round"; x.beginPath(); x.moveTo(-r*.42,0); x.lineTo(-r*.08,r*.36); x.lineTo(r*.45,-r*.34); x.stroke(); }
  if(sel){ x.shadowColor="#3fd8ff"; x.shadowBlur=18; x.lineWidth=2; x.strokeStyle="#3fd8ff"; x.beginPath(); x.arc(0,0,18*k*.95,0,7); x.stroke(); }
  SPR.set(key,cv); return cv;
}
/* apparition au lancement : une onde part de Lognes (le départ de HMG) et allume les salles une à une */
let PIN_T0=0, pinAnimRaf=0; const PIN_DUR=520, PIN_SPREAD=1300;
const easeBack=t=>{ const c=1.9; t-=1; return 1+(c+1)*t*t*t+c*t*t; };
function pinWave(){ PIN_T0=performance.now()+120; let maxD=0; const o=CONFIG.start;
  for(const id in markers){ const m=markers[id], ll=m.getLatLng(); m._d=Math.hypot(ll.lat-o.lat,(ll.lng-o.lon)*.68); if(m._d>maxD) maxD=m._d; }
  for(const id in markers){ const m=markers[id]; m._delay=Math.pow(m._d/(maxD||1),.75)*PIN_SPREAD; }
  cancelAnimationFrame(pinAnimRaf); const end=PIN_T0+PIN_SPREAD+PIN_DUR+60;
  (function f(){ pinRenderer._redrawBounds=null; pinRenderer._redraw(); if(performance.now()<end) pinAnimRaf=requestAnimationFrame(f); else PIN_T0=0; })(); }
let FARZ=map.getZoom()<7.5, TAGZ=map.getZoom()>=9; const TAGFONT="700 9.5px "+(CSSV("--f-d")||"sans-serif");
const Pin=L.CircleMarker.extend({
  _updateBounds(){ const p=[30,34]; this._pxBounds=new L.Bounds(this._point.subtract(p),this._point.add(p)); },
  _updatePath(){ const R=this._renderer; if(!R._drawing||this._empty()) return; const ctx=R._ctx, p=this._point, c=this.club, sel=selected===c.id;
    const v=visited(c.id), m=mine(c.id), kind=m?"mine":v?"done":c.s?"soon":"todo", col=m?"gold":v?"done":c.s?"soon":"todo";
    const sp=sprite(kind,col,sel,FARZ&&isMobile());
    if(PIN_T0){ const t=(performance.now()-PIN_T0-(this._delay||0))/PIN_DUR; if(t<=0) return;
      if(t<1){ const sc=Math.max(0,easeBack(t)), w=SPS*sc; ctx.globalAlpha=Math.min(1,t*2.5); ctx.drawImage(sp,p.x-w/2,p.y-w/2,w,w);
        ctx.globalAlpha=(1-t)*.8; ctx.strokeStyle=pinCol(col); ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(p.x,p.y,4+t*16,0,7); ctx.stroke(); ctx.globalAlpha=1; return; } }
    ctx.drawImage(sp,p.x-SPS/2,p.y-SPS/2,SPS,SPS);
    if(TAGZ){ const a=avgOf(c.id); if(a!=null){ ctx.font=TAGFONT; ctx.textAlign="center"; ctx.textBaseline="bottom"; ctx.lineWidth=3; ctx.strokeStyle="#05070d"; ctx.fillStyle=pinCol("gold");
      const t=fmt1(a), y=p.y-(sel?16:10); ctx.strokeText(t,p.x,y); ctx.fillText(t,p.x,y); } } }
});
function crowdZoom(m){ if(map.getZoom()>=11) return false; const p=map.latLngToContainerPoint(m.getLatLng()); let n=0;
  for(const id in markers){ const q=map.latLngToContainerPoint(markers[id].getLatLng()); if(Math.abs(q.x-p.x)<20&&Math.abs(q.y-p.y)<20) n++; }
  if(n<3) return false; map.flyTo(m.getLatLng(),Math.min(13,map.getZoom()+2.5),{duration:.6}); return true; }
function drawMarker(c){
  const p=pos(c); if(!p||isDom(c)) return;
  let m=markers[c.id];
  if(m){ m.setLatLng([p.lat,p.lon]); if(selected===c.id) m.bringToFront(); m.redraw(); return; }
  m=new Pin([p.lat,p.lon],{renderer:pinRenderer,radius:9,stroke:false,fill:true,fillOpacity:0,bubblingMouseEvents:false}); m.club=c;
  if(!TOUCH) m.bindTooltip(()=>{ const a=avgOf(c.id); return esc(c.n)+(a!=null?` · ${fmt1(a)}/10`:""); },{className:"tip",direction:"top",offset:[0,-8]});
  m.on("click",()=>{ if(crowdZoom(m)) return; openClub(c.id); });
  clubLayer.addLayer(m); markers[c.id]=m;
}
function refreshMarkers(){ CLUBS.forEach(c=>drawMarker(c)); }
map.on("zoomend",()=>{ const f=map.getZoom()<7.5, t=map.getZoom()>=9; if(f!==FARZ||t!==TAGZ){ FARZ=f; TAGZ=t; for(const id in markers) markers[id].redraw(); } });
function drawStart(){
  if(startMarker){ map.removeLayer(startMarker); startMarker=null; }
  if(!isAdmin()) return;
  startMarker=L.marker([CONFIG.start.lat,CONFIG.start.lon],{icon:L.divIcon({className:"",html:'<div class="start-pin"><span>D</span></div>',iconSize:[30,30],iconAnchor:[0,30]}),zIndexOffset:1000}).addTo(map).bindTooltip("Départ : "+CONFIG.start.label,{className:"tip",direction:"top",offset:[15,-30]});
}

/* ================= EN-TÊTE / LÉGENDE ================ */
function countUp(el,to){ const from=+el.dataset.v||0; el.dataset.v=to; const t0=performance.now(), d=1100;
  (function f(t){ const k=Math.min(1,(t-t0)/d), e=1-Math.pow(1-k,3); el.textContent=Math.round(from+(to-from)*e).toLocaleString("fr-FR"); if(k<1) requestAnimationFrame(f); })(t0); }
function updateHeader(){
  const nVis=Object.keys(db.visits).filter(id=>byId[id]).length, sp=showProgress();
  /* compteurs du haut : un visiteur voit SES avis et SES salles (gardés sur son appareil), l'admin voit le total des avis et ses visites */
  const adm=isAdmin(), mOn=mineOn(), nMine=Object.keys(myVisits).filter(id=>byId[id]).length, nMyRevs=Object.keys(myRated).filter(id=>byId[id]).length;
  countUp($("sClubs"),CLUBS.length);
  const po=ptsOn(); $("sPtsBox").hidden=!po; $("stats").classList.toggle("has-pts",po); if(po) countUp($("sPts"),score.points||0);
  countUp($("sRevs"),adm?db.reviews.filter(r=>!r.hidden).length:nMyRevs);
  $("sRevsL").textContent=adm?"avis":"mes avis"; $("sRevsBox").title=adm?"Avis publiés sur le site":"Les salles que tu as notées depuis cet appareil. Tu es "+meIs();
  const pb=$("sProgBox"); pb.hidden=!(mOn||sp); pb.classList.toggle("mine",mOn);
  pb.title=mOn?"Les salles où tu es déjà allé (visible seulement par toi)":"";
  if(mOn||sp) countUp($("sProg"),mOn?nMine:nVis);
  $("lgDone").hidden=!sp; $("progBox").hidden=!sp;
  $("lgTodo").textContent=sp?"À visiter":"Salle ouverte";
  if(sp){ $("progTxt").textContent=`${CONFIG.owner} : ${nVis} / ${CLUBS.length} salles visitées`; requestAnimationFrame(()=>$("progBar").style.width=(100*nVis/CLUBS.length)+"%"); }
  const mo=mOn&&nMine>0;
  $("lgMine").hidden=!mo; $("mineBox").hidden=!mo;
  if(mo){ $("mineTxt").textContent=`Moi : ${nMine} / ${CLUBS.length} salles visitées`; requestAnimationFrame(()=>$("mineBar").style.width=(100*nMine/CLUBS.length)+"%"); }
  $("demo").hidden=LIVE;
  const pend=db.photos.filter(p=>!p.approved).length+db.reviews.filter(r=>r.hidden).length; $("aPend").hidden=!pend; $("aPend").textContent=pend;
}

/* ================= FICHE D'UNE SALLE ================ */
let sheetMode=null, clubTab="avis", draftRating=0;
/* Aventure : la fenêtre du bas reste visible pour le classement (et le centre de contrôle), les autres restent sur la carte */
function gmKeep(){ $("sheet").classList.toggle("gm-keep",sheetMode==="rank"||sheetMode==="feat"); }
function closeSheet(){ $("sheet").hidden=true; sheetMode=null; const prev=selected; selected=null; if(prev&&byId[prev]) drawMarker(byId[prev]); }
function openClub(id,fly){
  const prev=selected; selected=id; if(prev&&byId[prev]) drawMarker(byId[prev]);
  const c=byId[id]; drawMarker(c);
  if(fly){ const p=pos(c); if(p&&!isDom(c)) map.flyTo(isMobile()?[p.lat-0.012*Math.pow(2,13-Math.max(map.getZoom(),12)),p.lon]:[p.lat,p.lon],Math.max(map.getZoom(),12.5),{duration:1.2}); }
  sheetMode="club",gmKeep(); draftRating=0; renderClub();
}
function ringSvg(avg){ const C=2*Math.PI*36, off=C*(1-avg/10);
  return `<svg viewBox="0 0 84 84"><circle class="bgc" cx="42" cy="42" r="36"/><circle class="fg" cx="42" cy="42" r="36" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}"/></svg>`; }
function renderClub(){
  const c=byId[selected]; if(!c) return;
  const st=stats(c.id), p=pos(c), v=db.visits[c.id], adm=isAdmin();
  const photos=db.photos.filter(x=>x.club_id===c.id&&(x.approved||adm));
  const maxd=Math.max(1,...st.dist);
  const gmaps="https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent("Fitness Park "+fullAddr(c));
  const sh=$("sheet"); sh.hidden=false; sh.classList.remove("big");
  sh.innerHTML=`
  <div class="sh-head"><h2>${esc(c.n)}</h2><button class="x" data-close aria-label="Fermer">${ic("x")}</button></div>
  <div class="sh-body">
    <p class="addr">${esc(fullAddr(c))||"Adresse pas encore publiée"} · ${esc(depName(c))}</p>
    <div class="chips">
      ${c.s?`<span class="chip soon">${esc(c.note||"Ouverture prochaine")}</span>`:`<span class="chip">Ouverte</span>`}
      ${visited(c.id)?`<span class="chip done">Visitée par ${esc(CONFIG.owner)} · ${frDate(v.d)}</span>`:""}
      ${p&&p.approx&&!isDom(c)?`<span class="chip approx">Position approximative</span>`:""}
      ${isDom(c)?`<span class="chip">Outre-mer</span>`:""}
    </div>
    <div class="score">
      <div class="ring">${ringSvg(st.avg)}<div>${st.n?fmt1(st.avg):"–"}<small>/ 10</small></div></div>
      <div class="meta"><b>${st.n?(st.avg>=8?"Excellente salle":st.avg>=6?"Bonne salle":st.avg>=4?"Avis partagés":"À améliorer"):"Pas encore notée"}</b>
        ${st.n} avis de la communauté
        ${st.n?`<div class="dist" title="Répartition des notes de 1 à 10">${st.dist.map(n=>`<i style="height:${Math.max(8,100*n/maxd)}%;opacity:${n?1:.25}"></i>`).join("")}</div>`:""}</div>
    </div>
    ${ptsOn()&&!c.s&&!isDom(c)?`<button class="pts-ban${score.today?" done":""}" data-checkin-here>
      <span class="pb-ico">${ic(score.today?"check":"bolt")}</span>
      <span class="pb-t">${score.today?`<b>Séance du jour validée</b><small>${score.today===c.id?"Ici même. Respect.":"Reviens demain pour 10 points de plus."}</small>`:`<b>+10 points</b><small>chaque jour où tu t'entraînes ici</small>`}</span>
      ${score.today?"":`<span class="pb-go">J'y suis</span>`}</button>`:""}
    <div class="acts">
      <a class="btn pri" href="${gmaps}" target="_blank" rel="noopener">${ic("nav")} Itinéraire</a>
      <a class="btn" href="${esc(c.u)}" target="_blank" rel="noopener">${ic("ext")} Site officiel</a>
    </div>
    ${mineOn()?mineHtml(c):""}
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="avis" aria-selected="${clubTab==="avis"}">Avis (${st.n})</button>
      <button role="tab" data-tab="photos" aria-selected="${clubTab==="photos"}">Photos (${photos.filter(x=>x.approved).length})</button>
    </div>
    <div id="tabBody">${clubTab==="avis"?reviewsHtml(c,st):photosHtml(c,photos)}</div>
    ${adm?adminClubHtml(c):""}
  </div>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ const fg=sh.querySelector(".fg"); if(fg) fg.style.strokeDashoffset=fg.dataset.off; }));
}
function mineHtml(c){
  const d=myVisits[c.id];
  return `<div class="mine-row"><button type="button" class="mine-btn${d?" on":""}" data-mine="${c.id}" aria-pressed="${!!d}">${ic("check")} ${d?"J'y suis allé · "+frDate(d):"J'y suis déjà allé"}</button><span>${d?"Recliquer pour retirer. ":""}Visible seulement par toi</span></div>`;
}
function toggleMine(id){
  const c=byId[id]; if(!c) return;
  if(myVisits[id]) delete myVisits[id]; else myVisits[id]=today();
  store.set("hmg-my-visits",myVisits);
  drawMarker(c); updateHeader();
  const row=document.querySelector(".mine-row"); if(row&&selected===id) row.outerHTML=mineHtml(c);
  if(sheetMode==="list") renderList();
  const n=Object.keys(myVisits).filter(k=>byId[k]).length;
  if(myVisits[id]) toast(n===1?"Première salle ajoutée ! Tes salles apparaissent en doré sur la carte.":`Ajoutée à tes salles : ${n} / ${CLUBS.length}`);
}
function reviewsHtml(c,st){
  const adm=isAdmin(), already=myRated[c.id];
  const list=(adm?db.reviews.filter(r=>r.club_id===c.id):st.rs);
  const form = already&&!adm ? `<div class="msg">Merci ! Tu as noté cette salle ${already}/10. Les commentaires sont publiés après validation.</div>` : `
    <div class="form" id="rForm">
      <h3>Donne ta note</h3>
      <p class="who">${psOn()&&myPseudo?`Tu es <b>${esc(myPseudo)}</b>. Ton pseudo s'affiche à côté de tes avis. <a href="#" data-pseudo>Changer</a>`:`Tu es la <b>Machine ${myNo}</b>. Ce surnom s'affiche à côté de tes avis, à la place de ton nom.${psOn()?` <a href="#" data-pseudo>Choisir mon pseudo</a>`:""}`}</p>
      <div class="rate" role="radiogroup" aria-label="Note sur 10">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button type="button" role="radio" aria-checked="${draftRating===n}" data-rate="${n}" class="${draftRating===n?"sel":draftRating>n?"lit":""}">${n}</button>`).join("")}</div>
      <textarea id="rText" maxlength="120" placeholder="Un commentaire ? (facultatif, 15 mots max, publié après validation)" aria-label="Commentaire, 15 mots maximum"></textarea>
      <div class="frow"><span id="rCount">0 / 15 mots</span><button class="cy" id="rSend" ${draftRating?"":"disabled"}>Publier anonymement</button></div>
      <div id="rMsg"></div>
    </div>`;
  const items = list.length ? list.map(r=>`<div class="rev${r.hidden?" hid":""}">
      <div class="n" style="color:${r.rating>=8?"var(--a2)":r.rating>=5?"var(--ink)":"var(--muted)"}">${r.rating}</div>
      <div class="t">${r.comment?esc(r.comment):"<i>Note sans commentaire</i>"}</div>
      <div class="d">${whoHtml(r)} · ${adm?frDateTime(r.created_at):frDate(r.created_at)}${r.hidden?" · en attente":""}</div>
      ${voteHtml(r)}
      ${adm?`<div class="adm"><button class="mini" data-hide="${r.id}">${r.hidden?"Publier":"Masquer"}</button><button class="mini danger" data-delrev="${r.id}">Suppr.</button></div>`:""}
    </div>`).join("") : `<div class="empty">Aucun avis pour l'instant. Sois le premier à noter cette salle !</div>`;
  return form+items;
}
function voteHtml(r){
  if(!VOTES || !r.comment || r.hidden) return "";
  const v=myVotes[r.id]||0, u=r.up||0, d=r.down||0;
  return `<div class="vt"><button type="button" class="vote up${v===1?" on":""}" data-vote="${r.id}" data-v="1" aria-pressed="${v===1}" title="D'accord" aria-label="D'accord, ${u}">${ic("up")}<span>${u}</span></button><button type="button" class="vote down${v===-1?" on":""}" data-vote="${r.id}" data-v="-1" aria-pressed="${v===-1}" title="Pas d'accord" aria-label="Pas d'accord, ${d}">${ic("down")}<span>${d}</span></button></div>`;
}
function refreshVotes(r){ const seen=new Set(); document.querySelectorAll('[data-vote="'+r.id+'"]').forEach(b=>{ const box=b.closest(".vt"); if(box&&!seen.has(box)){ seen.add(box); box.outerHTML=voteHtml(r); } }); }
const voteBusy = {};
async function vote(id,v){
  const r=db.reviews.find(x=>x.id===id); if(!r||voteBusy[id]) return;
  const old=myVotes[id]||0, nv=old===v?0:v;
  const apply=(o,n)=>{ r.up=Math.max(0,(r.up||0)-(o===1?1:0)+(n===1?1:0)); r.down=Math.max(0,(r.down||0)-(o===-1?1:0)+(n===-1?1:0)); if(n) myVotes[id]=n; else delete myVotes[id]; store.set("hmg-votes",myVotes); };
  apply(old,nv); refreshVotes(r); voteBusy[id]=1;
  try{
    if(LIVE){ const res=await api("/rest/v1/rpc/vote_review",{method:"POST",body:{p_review:id,p_voter:voterId,p_value:nv}}); if(res&&typeof res.up==="number"){ r.up=res.up; r.down=res.down; } }
    else demo.set("reviews",db.reviews);
  }catch(e){ apply(nv,old); toast("Vote impossible : "+e.message,1); }
  delete voteBusy[id]; refreshVotes(r);
}
function photosHtml(c,photos){
  const adm=isAdmin();
  return `<div class="upl"><label class="btn cy" style="cursor:pointer">${ic("cam")} Ajouter une photo<input type="file" accept="image/*" id="pFile" hidden></label>
    <span style="font-size:12px;color:var(--muted)">${adm?"Publiée directement (admin)":"Visible après validation"}</span></div>
    <div id="pMsg"></div>
    ${photos.length?`<div class="gal">${photos.map(p=>`<figure data-img="${p.id}">
      <img src="${esc(photoUrl(p))}" alt="Photo de ${esc(c.n)}" loading="lazy">
      ${!p.approved?`<span class="tag p">En attente</span>`:p.by_admin?`<span class="tag">${esc(CONFIG.owner)}</span>`:""}
      ${adm?`<div class="adm">${!p.approved?`<button class="mini" data-approve="${p.id}">Valider</button>`:""}<button class="mini danger" data-delph="${p.id}">Suppr.</button></div>`:""}
    </figure>`).join("")}</div>`:`<div class="empty">Pas encore de photo de cette salle.</div>`}`;
}
function adminClubHtml(c){
  const v=db.visits[c.id];
  return `<div class="adminBox"><h3>${ic("shield")} Ma visite</h3>
    ${v?`<div class="row"><label style="font-size:12px;color:var(--muted)">Visitée le</label><input type="date" id="vDate" value="${esc(v.d)}"></div>
      <textarea id="vNote" maxlength="500" placeholder="Note perso (privée)">${esc(v.n||"")}</textarea>
      <div class="row"><button class="mini" id="vSave">Enregistrer</button><button class="mini danger" id="vDel">Retirer des visitées</button></div>`
     :`<button class="cy" id="vAdd">Marquer comme visitée aujourd'hui</button>`}
  </div>`;
}

/* ---- envoi d'un avis */
function words(s){ return s.trim()?s.trim().split(/\s+/).length:0; }
function hasBad(s){ return fold(s).split(/[^a-z0-9'-]+/).some(w=>w&&(BAD.has(w)||BAD.has(w.replace(/'/g,"")))); }
async function sendReview(){
  const c=byId[selected], txt=$("rText").value.trim().replace(/\s+/g," "), n=words(txt);
  const msg=$("rMsg");
  if(!draftRating){ return; }
  if(n>15){ msg.innerHTML=`<div class="msg err">15 mots maximum (tu en as ${n}).</div>`; return; }
  if(txt&&hasBad(txt)){ msg.innerHTML=`<div class="msg err">Ton commentaire contient un mot refusé. Reformule-le gentiment 🙂</div>`; return; }
  $("rSend").disabled=true;
  const row={club_id:c.id,rating:draftRating,comment:txt||null,hidden:!!txt&&!isAdmin()};
  let rid=reviewId();
  try{
    if(LIVE){
      try{ await api("/rest/v1/reviews",{method:"POST",body:{...row,id:rid},prefer:"return=minimal"}); }
      /* si la base refusait cet identifiant, l'avis part quand même, sans numéro */
      catch(e){ if(e instanceof TypeError || /Trop d.avis/.test(e.message)) throw e; await api("/rest/v1/reviews",{method:"POST",body:row,prefer:"return=minimal"}); rid=uuid(); }
    }
    db.reviews.unshift({...row,id:rid,created_at:new Date().toISOString()});
    if(!LIVE) demo.set("reviews",db.reviews);
    myRated[c.id]=draftRating; store.set("hmg-rated",myRated);
    computeStats(); drawMarker(c); updateHeader(); renderClub(); toast(row.hidden?"Merci ! Ton avis sera visible dès qu'il aura été validé.":"Merci, ta note est publiée !");
  }catch(e){ $("rSend").disabled=false; msg.innerHTML=`<div class="msg err">${esc(e.message)}</div>`; }
}

/* ---- photos : redimensionnées dans le navigateur (max 1600 px, JPEG) */
function resize(file){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>{ const k=Math.min(1,1600/Math.max(img.width,img.height)); const cv=document.createElement("canvas"); cv.width=Math.round(img.width*k); cv.height=Math.round(img.height*k); cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height); cv.toBlob(b=>b?res(b):rej(new Error("Image illisible")),"image/jpeg",.82); URL.revokeObjectURL(img.src); }; img.onerror=()=>rej(new Error("Ce fichier n'est pas une image lisible.")); img.src=URL.createObjectURL(file); }); }
async function sendPhoto(file){
  const c=byId[selected], adm=isAdmin(), msg=$("pMsg"); if(!file) return;
  msg.innerHTML=`<div class="msg">Envoi en cours…</div>`;
  try{
    const blob=await resize(file); if(blob.size>3e6) throw new Error("Image trop lourde, même réduite.");
    const id=uuid(), path=(adm?"admin/":"pending/")+c.id+"/"+id+".jpg";
    const row={club_id:c.id,path,approved:adm,by_admin:adm};
    if(LIVE){ await api("/storage/v1/object/photos/"+path,{method:"POST",body:blob,type:"image/jpeg"}); await api("/rest/v1/photos",{method:"POST",body:row,prefer:"return=minimal"}); }
    else { row.dataUrl=await new Promise(r=>{const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(blob);}); }
    const full={...row,id,created_at:new Date().toISOString()};
    if(adm||!LIVE) db.photos.unshift(full); if(!LIVE){ try{ demo.set("photos",db.photos); }catch(e){} }
    clubTab="photos"; renderClub(); updateHeader();
    $("pMsg").innerHTML=`<div class="msg">${adm?"Photo publiée.":"Merci ! Ta photo sera visible dès qu'elle aura été validée."}</div>`;
  }catch(e){ msg.innerHTML=`<div class="msg err">${esc(e.message)}</div>`; }
}

/* ================= LISTE DES SALLES ================ */
let listSort="note", listQ="";
function openList(){ sheetMode="list",gmKeep(); renderList(); }
function renderList(){
  const sh=$("sheet"); sh.hidden=false; sh.classList.add("big");
  const q=fold(listQ.trim());
  let rows=CLUBS.filter(c=>!q||fold(c.n+" "+c.a+" "+c.cp+" "+c.c+" "+c.d+" "+depName(c)).includes(q));
  const groups=[];
  if(listSort==="note"){ rows.sort((a,b)=>(avgOf(b.id)??-1)-(avgOf(a.id)??-1)||(STATS[b.id]?.n||0)-(STATS[a.id]?.n||0)||a.n.localeCompare(b.n,"fr")); groups.push(["Les mieux notées",rows]); }
  else if(listSort==="dep"){ const m={}; rows.forEach(c=>(m[c.d]=m[c.d]||[]).push(c)); Object.keys(m).sort().forEach(k=>groups.push([k+" · "+depName(m[k][0]),m[k].sort((a,b)=>a.n.localeCompare(b.n,"fr"))])); }
  else if(listSort==="mine"&&mineOn()){ const l=rows.filter(c=>myVisits[c.id]).sort((a,b)=>myVisits[b.id].localeCompare(myVisits[a.id])||a.n.localeCompare(b.n,"fr")); if(l.length) groups.push(["Visitées par moi · "+l.length+" / "+CLUBS.length,l]); }
  else if(listSort==="near"&&me){ rows.sort((a,b)=>dkm(a)-dkm(b)); groups.push(["Autour de toi",rows]); }
  else groups.push(["De A à Z",rows.sort((a,b)=>a.n.localeCompare(b.n,"fr"))]);
  const html=groups.map(([t,l])=>l.length?`<div class="grp">${esc(t)}</div>`+l.map(c=>{ const a=avgOf(c.id), v=visited(c.id), m=mine(c.id);
    return `<div class="item${selected===c.id?" sel":""}" data-open="${c.id}"><span class="dot ${m?"mine":v?"done":c.s?"soon":"todo"}"></span><b>${esc(c.n)}</b>
      <span>${esc(c.c||"")} ${esc(c.cp||"")}${listSort==="near"&&me?" · "+Math.round(dkm(c))+" km":""}${listSort==="mine"&&m?" · "+frDate(myVisits[c.id]):""}</span>
      <em>${a!=null?fmt1(a):"–"}<small>${STATS[c.id]?STATS[c.id].n+" avis":"/ 10"}</small></em></div>`}).join(""):"").join("");
  sh.innerHTML=`<div class="sh-head"><h2>Toutes les salles</h2><button class="x" data-close aria-label="Fermer">${ic("x")}</button></div>
   <div class="sh-body"><div class="lst-tools"><input id="lq" type="search" placeholder="Filtrer…" value="${esc(listQ)}" aria-label="Filtrer la liste">
     <select id="ls" aria-label="Trier">${[["note","Mieux notées"],["az","A → Z"],["dep","Département"],...(me?[["near","Autour de moi"]]:[]),...(mineOn()?[["mine","Visitées par moi"]]:[])].map(([k,t])=>`<option value="${k}"${k===listSort?" selected":""}>${t}</option>`).join("")}</select></div>
     <div id="lrows">${html||(listSort==="mine"&&mineOn()&&!q?'<div class="empty">Tu n\'as encore ajouté aucune salle. Ouvre une salle et clique sur « J\'y suis déjà allé ».</div>':'<div class="empty">Aucune salle ne correspond.</div>')}</div></div>`;
  const lq=$("lq"); lq.addEventListener("input",()=>{ listQ=lq.value; const p=lq.selectionStart; renderList(); const n=$("lq"); n.focus(); n.setSelectionRange(p,p); });
  $("ls").addEventListener("change",e=>{ listSort=e.target.value; renderList(); });
}

/* ================= RECHERCHE ================ */
let suggIdx=-1, suggRows=[];
function updateSugg(){
  const q=fold($("search").value.trim()); const box=$("sugg");
  if(q.length<2){ box.hidden=true; return; }
  suggRows=CLUBS.map(c=>{ const h=fold(c.n+" "+c.c+" "+c.cp+" "+c.d+" "+depName(c)); const i=h.indexOf(q); return i<0?null:[i===0?0:fold(c.n).includes(q)?1:2,c]; }).filter(Boolean).sort((a,b)=>a[0]-b[0]||a[1].n.localeCompare(b[1].n,"fr")).slice(0,8).map(x=>x[1]);
  suggIdx=-1;
  box.innerHTML=suggRows.length?suggRows.map((c,i)=>{ const a=avgOf(c.id); return `<div class="sg" role="option" data-open="${c.id}"><b>${esc(c.n)}</b><span>${esc(fullAddr(c))}</span><em>${a!=null?fmt1(a)+"/10":""}</em></div>`; }).join(""):`<div class="empty">Aucune salle trouvée</div>`;
  box.hidden=false;
}
$("search").addEventListener("input",updateSugg);
$("search").addEventListener("focus",updateSugg);
$("search").addEventListener("keydown",e=>{
  const els=[...$("sugg").querySelectorAll(".sg")]; if(!els.length) return;
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); suggIdx=(suggIdx+(e.key==="ArrowDown"?1:-1)+els.length)%els.length; els.forEach((x,i)=>x.classList.toggle("act",i===suggIdx)); }
  if(e.key==="Enter"){ const t=els[Math.max(0,suggIdx)]; if(t){ openClub(t.dataset.open,true); $("sugg").hidden=true; $("search").blur(); } }
  if(e.key==="Escape"){ $("sugg").hidden=true; }
});
document.addEventListener("pointerdown",e=>{ if(!e.target.closest("#searchBox")) $("sugg").hidden=true; });

/* ================= AUTOUR DE MOI ================ */
let me=null, meMarker=null;
const dkm=c=>{ const p=pos(c); if(!p||!me) return 1e9; const R=6371,t=Math.PI/180,dl=(p.lat-me.lat)*t,dn=(p.lon-me.lon)*t; const h=Math.sin(dl/2)**2+Math.cos(me.lat*t)*Math.cos(p.lat*t)*Math.sin(dn/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
$("bMe").addEventListener("click",()=>{
  if(!navigator.geolocation){ toast("La localisation n'est pas disponible sur cet appareil.",1); return; }
  navigator.geolocation.getCurrentPosition(g=>{ me={lat:g.coords.latitude,lon:g.coords.longitude};
    if(meMarker) map.removeLayer(meMarker);
    meMarker=L.circleMarker([me.lat,me.lon],{radius:7,color:"#fff",weight:2,fillColor:MAPC,fillOpacity:1}).addTo(map).bindTooltip("Tu es ici",{className:"tip"});
    map.flyTo([me.lat,me.lon],11,{duration:1.2}); listSort="near"; openList();
  },()=>toast("Localisation refusée.",1),{enableHighAccuracy:false,timeout:10000});
});

/* ================= ADMIN ================ */
function loginModal(){
  if(!LIVE){ toast("Branche d'abord la base Supabase (voir CONFIG) pour activer l'espace admin.",1); return; }
  const m=document.createElement("div"); m.className="modal"; m.innerHTML=`<form class="card glass" id="lf">
    <h2>Espace admin</h2><p>Réservé à ${esc(CONFIG.owner)}.</p>
    <input type="email" id="le" placeholder="E-mail" autocomplete="username" required>
    <input type="password" id="lp" placeholder="Mot de passe" autocomplete="current-password" required>
    <div id="lmsg"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="ghost" data-x>Annuler</button><button class="cy">Se connecter</button></div></form>`;
  document.body.appendChild(m); $("le").focus();
  m.addEventListener("click",e=>{ if(e.target===m||e.target.closest("[data-x]")) m.remove(); });
  $("lf").addEventListener("submit",async e=>{ e.preventDefault();
    try{ const r=await fetch(CONFIG.url+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:CONFIG.key,"Content-Type":"application/json"},body:JSON.stringify({email:$("le").value,password:$("lp").value})});
      const j=await r.json(); if(!r.ok) throw new Error(j.error_description||j.msg||"Connexion refusée");
      session={access_token:j.access_token,refresh_token:j.refresh_token,admin:false};
      const a=await api("/rest/v1/rpc/is_admin",{method:"POST",body:{}}); session.admin=a===true;
      if(!session.admin) throw new Error("Ce compte n'est pas admin.");
      store.set("hmg-session",session); m.remove(); await reloadEverything(); toast("Bienvenue "+CONFIG.owner+" !");
    }catch(err){ session=null; $("lmsg").innerHTML=`<div class="msg err">${esc(err.message)}</div>`; }
  });
}
function applyAdminUi(){ $("adminBar").hidden=!isAdmin(); $("aShowProg").checked=db.settings.show_progress===true; drawStart(); $("bAdmin").textContent=isAdmin()?"Admin connecté":"Admin"; applyFeatures(); }
async function reloadEverything(){ try{ await loadAll(); }catch(e){ toast("Impossible de charger les avis : "+e.message,1); } computeStats(); refreshMarkers(); updateHeader(); applyAdminUi(); if(sheetMode==="club") renderClub(); else if(sheetMode==="list") renderList(); else if(sheetMode==="mod") renderMod(); else if(sheetMode==="visits") renderVisits(); else if(sheetMode==="rank") renderRank(); else if(sheetMode==="feat") renderFeat(); refreshScore(); }
$("bAdmin").addEventListener("click",()=>isAdmin()?null:loginModal());
$("aOut").addEventListener("click",async()=>{ session=null; store.set("hmg-session",null); if(routeLine){map.removeLayer(routeLine);routeLine=null;} await reloadEverything(); toast("Déconnecté."); });
$("aShowProg").addEventListener("change",async e=>{
  const on=e.target.checked; try{ if(LIVE) await api("/rest/v1/settings?key=eq.show_progress",{method:"PATCH",body:{value:on},prefer:"return=minimal"}); db.settings.show_progress=on; if(!LIVE) demo.set("settings",db.settings); updateHeader(); toast(on?"Ta progression est maintenant visible par tous.":"Ta progression est masquée au public."); }
  catch(err){ e.target.checked=!on; toast(err.message,1); } });

/* ---- panneau admin « Fonctionnalités » */
const rpc = (name, body) => api("/rest/v1/rpc/"+name, {method:"POST", body:body||{}});
const isMissing = e => /Could not find|PGRST202|schema cache|Erreur 404/i.test((e&&e.message)||"");
const SQL_URL = "supabase-competition.sql", SUPA_SQL = "https://supabase.com/dashboard/project/"+(CONFIG.url.match(/\/\/([a-z0-9]+)\./)||[,""])[1]+"/sql/new";
let sqlText = null, dbState = null;
function geoStats(){ const list=CLUBS.filter(c=>!c.s&&!isDom(c)); return {saved:list.filter(c=>db.geo[c.id]).length, total:list.length}; }
async function saveGeo(){
  const rows=CLUBS.filter(c=>geoCache[c.id]&&geoCache[c.id].lat&&!db.geo[c.id]).map(c=>({club_id:c.id,lat:geoCache[c.id].lat,lon:geoCache[c.id].lon}));
  if(!rows.length) return 0;
  await api("/rest/v1/club_geo",{method:"POST",body:rows,prefer:"resolution=merge-duplicates,return=minimal"});
  rows.forEach(r=>db.geo[r.club_id]=r); return rows.length;
}
/* ---- Centre de contrôle (admin) : les chiffres du moment, les nouveautés à allumer, les outils de la tournée.
   Plus de bloc technique (script de base, Supabase) : la base est installée. */
const CC_F={
  feat_points:{t:"Séances et classement",s:"+10 points par séance vérifiée sur place, classement du mois.",i:"bolt"},
  feat_welcome:{t:"Message de bienvenue",s:"Un mot d'accueil selon l'heure, un compliment aux habitués.",i:"flame"},
  feat_profile:{t:"Profil du sportif",s:"La pastille « Toi » : niveau, points et série.",i:"db"},
  feat_pseudo:{t:"Pseudos uniques",s:"Chacun choisit son nom, gros mots refusés.",i:"pen"},
  feat_angel:{t:"Ange de la semaine",s:"Félicite ceux qui ont fait 3 séances la semaine passée.",i:"trophy"},
  feat_game:{t:"Aventure HMG",s:"Le héros en caleçon qui s'habille et se muscle à chaque séance, au fil des saisons.",i:"hero"},
  feat_app:{t:"Appli sur le téléphone",s:"Propose d'installer HMG sur l'écran d'accueil (iPhone et Android).",i:"down"}};
let ccStats=null, ccAngOpen=false;
async function ccLoad(){
  try{ const rows=LIVE?(await rpc("leaderboard",{p_period:"all",p_voter:voterId}))||[]:[]; ccStats={n:rows.length,s:rows.reduce((a,r)=>a+Math.round((r.points||0)/10),0)}; }
  catch(e){ ccStats={n:null,s:null}; }
  if(sheetMode==="feat") renderFeat(); }
function renderFeat(){
  if(!isAdmin()) return;
  const sh=$("sheet"), was=sheetMode==="feat"&&!sh.hidden, body0=sh.querySelector(".sh-body"), sc=was&&body0?body0.scrollTop:0;
  sheetMode="feat",gmKeep(); sh.hidden=false; sh.classList.add("big"); const sy=$("meSay"); if(sy) sy.remove();
  const pend=db.photos.filter(p=>!p.approved).length+db.reviews.filter(r=>r.hidden).length, revs=db.reviews.filter(r=>!r.hidden).length;
  const list=FEATURES.filter(f=>CC_F[f.k]), onN=list.filter(f=>featOn(f.k)).length, ang=ANGEL_STYLES.find(a=>a.k===angelStyle())||ANGEL_STYLES[0];
  const st=(v,l,cls,act)=>`<${act?`button type="button" data-cc="${act}"`:"div"} class="cc-st${cls?" "+cls:""}"><b>${v==null?"–":v}</b><span>${l}</span></${act?"button":"div"}>`;
  sh.innerHTML=`<div class="sh-head cc-head"><div class="cc-logo" aria-hidden="true">${ic("sliders")}</div><div class="cc-t"><small>HMG · Espace admin</small><h2>Centre de contrôle</h2></div><button class="x" data-close aria-label="Fermer">${ic("x")}</button></div>
  <div class="sh-body cc">
    <div class="cc-stats">${st(ccStats&&ccStats.n!=null?ccStats.n+(ccStats.n>=50?"+":""):null,"sportifs en jeu","main")}${st(ccStats?ccStats.s:null,"séances validées")}${st(pend,pend?"à valider, touche ici":"à valider",pend?"hot":"","mod")}${st(revs,"avis publiés")}</div>
    <div class="cc-sec"><span>Fonctionnalités</span><em>${onN}/${list.length} en ligne</em></div>
    <div class="cc-grid">${list.map(f=>{ const m=CC_F[f.k], on=featOn(f.k); return `<div class="cc-f${on?" on":""}">
      <div class="cc-ic">${ic(m.i)}</div>
      <div class="cc-tx"><b>${esc(m.t)}</b><span>${esc(m.s)}</span><em>${on?"En ligne pour tout le monde":"Caché : toi seul le vois"}</em></div>
      <label class="toggle" aria-label="${esc(m.t)}"><input type="checkbox" data-feat="${f.k}"${on?" checked":""}></label>
      ${f.k==="feat_game"?`<div class="cc-act"><button type="button" class="mini cy" data-gm-open>${ic("hero")} Ouvrir l'aventure</button></div>`:""}
      ${f.k==="feat_angel"?`<details class="cc-more"${ccAngOpen?" open":""}><summary>Animation : <b>${esc(ang.t)}</b></summary><div class="ang-pick">${ANGEL_STYLES.map(a=>`<label class="${angelStyle()===a.k?"on":""}"><input type="radio" name="angSt" value="${a.k}" data-angel-style${angelStyle()===a.k?" checked":""}><span><b>${esc(a.t)}</b><small>${esc(a.d)}</small></span><button type="button" class="mini" data-angel-test="${a.k}">Tester</button></label>`).join("")}</div></details>`:""}
    </div>`; }).join("")}</div>
    <div class="cc-sec"><span>Ma tournée des salles</span></div>
    <div class="cc-tools"><button type="button" data-cc="visits">${ic("check")} Mes visites</button><button type="button" data-cc="route" class="${routeLine?"on":""}">${ic("nav")} ${routeLine?"Effacer le tracé":"Tracer ma tournée"}</button>
      <label class="toggle cc-tg"><input type="checkbox" data-cc-prog${db.settings.show_progress===true?" checked":""}><span>Ma progression visible par tous</span></label></div>
  </div>`;
  const nb=sh.querySelector(".sh-body"); if(sc) nb.scrollTop=sc;
  const mo=sh.querySelector(".cc-more"); if(mo) mo.addEventListener("toggle",()=>ccAngOpen=mo.open);
  if(!was) ccLoad();
}
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest("[data-cc]"); if(!b) return; const k=b.dataset.cc;
  if(k==="mod") renderMod(); else if(k==="visits") renderVisits(); else if(k==="route"){ closeSheet(); drawRoute(false); } });
document.addEventListener("change",e=>{ if(!(e.target.matches&&e.target.matches("[data-cc-prog]"))) return; const t=$("aShowProg"); t.checked=e.target.checked; t.dispatchEvent(new Event("change")); });
$("adminBar").addEventListener("click",()=>{ const s=$("meSay"); if(s) s.remove(); },true);

async function checkDb(){
  if(!LIVE){ dbState=true; return; }
  try{ await rpc("leaderboard",{p_period:"all"}); dbState=true; ptsReady=true; }
  catch(e){ dbState=isMissing(e)?false:true; if(dbState===false) ptsReady=false; }
  if(sheetMode==="feat") renderFeat();
}
async function setFeature(k,on){
  if(LIVE) await api("/rest/v1/settings",{method:"POST",body:{key:k,value:on},prefer:"resolution=merge-duplicates,return=minimal"});
  db.settings[k]=on; if(!LIVE) demo.set("settings",db.settings);
}
function applyFeatures(){
  const po=ptsOn(), b=$("bCheck");
  b.hidden=!po; $("bRank").hidden=!po;
  const pf=feat("feat_profile"); $("meChip").hidden=!pf; $("meChip").classList.toggle("crowned",crowned()&&angelStyle()==="couronne"); $("meChipN").textContent=myName(); if(!pf) closeMe(); else if(meOpen) openMe();
  const gmf=feat("feat_game"); $("modeSw").hidden=!gmf; if(!gmf&&GM.on) gmSet(false); if(GM.on){ gmHud(); if(!GM.busy) gmMark(GM.pos); }
  refreshProfile();
  b.classList.toggle("done",!!score.today); $("bCheckT").innerHTML=score.today?`<span class="t-l">Séance validée</span><span class="t-s">Validée</span>`:`<span class="t-l">Je suis à la salle</span><span class="t-s">À la salle</span>`; $("bCheckP").hidden=!!score.today;
  const rk=score.rank_month; $("sPtsL").textContent=rk&&score.month?(rk===1?"1er du mois":rk+"e du mois"):"points"; $("sPtsBox").classList.toggle("top3",!!(rk&&rk<=3&&score.month));
  b.title=score.today?"Ta séance du jour est validée. Reviens demain pour 10 points de plus.":"Tu es à la salle ? Gagne 10 points (une fois par jour)";
}

/* ---- « Je suis à la salle » */
async function refreshScore(){
  if(!feat("feat_points")){ applyFeatures(); return; }
  if(LIVE){ try{ const s=await rpc("my_score",{p_voter:voterId}); ptsReady=true;
      score={...SCORE0,...s,day:today()}; if(s.no&&s.no!==myNo){ myNo=s.no; store.set("hmg-visitor",myNo); } store.set("hmg-score",score); }
    catch(e){ if(isMissing(e)) ptsReady=false; } }
  updateHeader(); applyFeatures(); if(sheetMode==="rank") renderRank(false);
  if(GM.on) gmSync();
}
const mDist = (a,b) => { const R=6371000,t=Math.PI/180,dl=(b.lat-a.lat)*t,dn=(b.lon-a.lon)*t; const h=Math.sin(dl/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dn/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
const fmtDist = m => m<1000?Math.round(m/10)*10+" m":(m/1000).toFixed(m<10000?1:0).replace(".",",")+" km";
function ckModal(html){
  let m=$("ckModal");
  if(!m){ m=document.createElement("div"); m.className="modal"; m.id="ckModal"; document.body.appendChild(m);
    m.addEventListener("click",e=>{ if(e.target===m||e.target.closest("[data-x]")) m.remove(); }); }
  m.innerHTML=`<div class="card glass ck" role="dialog" aria-live="polite">${html}</div>`; return m;
}
let checking=false;
async function doCheckin(){
  if(checking) return;
  if(!navigator.geolocation){ toast("La localisation n'est pas disponible sur cet appareil.",1); return; }
  checking=true;
  ckModal(`<div class="radar"><i></i><i></i><i></i>${ic("loc")}</div><h2>Je cherche ta salle…</h2><p>Autorise la localisation : ta position sert seulement à vérifier que tu es sur place, elle n'est jamais affichée.</p>`);
  let g;
  try{ g=await new Promise((ok,ko)=>navigator.geolocation.getCurrentPosition(ok,ko,{enableHighAccuracy:true,timeout:20000,maximumAge:0})); }
  catch(e){ checking=false; ckModal(`<div class="ck-ico bad">${ic("loc")}</div><h2>Position introuvable</h2><p>${e&&e.code===1?"Tu as refusé la localisation. Autorise-la pour hmgfitness.fr dans les réglages de ton navigateur, puis réessaie.":"Impossible d'obtenir ta position. Vérifie que la localisation est activée, puis réessaie."}</p><button class="cy" data-x>OK</button>`); return; }
  const here={lat:g.coords.latitude,lon:g.coords.longitude}, acc=Math.round(g.coords.accuracy||9999);
  let best=null, bd=1e12;
  for(const c of CLUBS){ if(c.s) continue; const p=pos(c); if(!p) continue; const d=mDist(here,p); if(d<bd){ bd=d; best=c; } }
  if(!best||bd>350+Math.min(acc,150)){ checking=false;
    ckModal(`<div class="ck-ico">${ic("loc")}</div><h2>Pas de salle ici</h2><p>Les points se gagnent sur place, dans une salle de la carte.${best?` La plus proche : <b>${esc(best.n)}</b>, à ${fmtDist(bd)}.`:""}</p><div class="row2">${best?`<button data-x data-open="${best.id}">Voir la salle</button>`:""}<button class="cy" data-x>OK</button></div>`); return; }
  try{
    const r=LIVE?await rpc("checkin",{p_voter:voterId,p_no:myNo,p_club:best.id,p_lat:here.lat,p_lon:here.lon,p_acc:acc}):{ok:false,why:"demo"};
    checking=false;
    if(r.no&&r.no!==myNo){ myNo=r.no; store.set("hmg-visitor",myNo); }
    if(r.ok){
      if(mineOn()&&!myVisits[best.id]){ myVisits[best.id]=today(); store.set("hmg-my-visits",myVisits); drawMarker(best); }
      const before=score.points||0; score.today=best.id; score.day=today(); score.points=before+10;
      if(GM.on){ const m=$("ckModal"); if(m) m.remove(); score.days=(score.days||0)+1; store.set("hmg-score",score); applyFeatures(); gmSync(); }
      else celebrate(best,r,before);
      refreshScore();
    } else ckWhy(r,best,acc);
  }catch(e){ checking=false;
    ckModal(`<div class="ck-ico bad">${ic("x")}</div><h2>${isMissing(e)?"Bientôt disponible":"Oups"}</h2><p>${isMissing(e)?(isAdmin()?"Il manque le script dans la base. Ouvre Admin → Fonctionnalités et suis l'étape indiquée.":"Les points arrivent très vite. Reviens bientôt !"):esc(e.message)}</p><button class="cy" data-x>OK</button>`); }
}
function ckWhy(r,c,acc){
  const n=esc(c.n);
  const t={
    deja:[`${ic("check")}`,"ok","Séance déjà validée",`Ta séance du jour est comptée${r.club&&byId[r.club]?` à <b>${esc(byId[r.club].n)}</b>`:""}. Tu en veux encore : respect. Reviens demain pour 10 points de plus.`],
    loin:[ic("loc"),"","Encore un effort",`Tu es à environ ${fmtDist(r.dist||0)} de <b>${n}</b>. Rapproche-toi de l'entrée (moins de 200 m) et réessaie.`],
    precision:[ic("loc"),"","Position trop imprécise",`Ton téléphone te situe à ±${r.acc||acc} m près. Active la localisation précise (GPS), mets-toi près de l'entrée ou d'une fenêtre, puis réessaie.`],
    salle:[ic("loc"),"","Salle pas encore vérifiée",isAdmin()?`La position exacte de <b>${n}</b> n'est pas encore enregistrée. Ouvre Admin → Fonctionnalités → « Enregistrer les positions ».`:`La position exacte de <b>${n}</b> est en cours de vérification. Réessaie très bientôt.`],
    demo:[ic("loc"),"","Mode démo","Branche la base Supabase pour activer les points."]
  }[r.why]||[ic("x"),"bad","Oups","Réessaie dans un instant."];
  ckModal(`<div class="ck-ico ${t[1]}">${t[0]}</div><h2>${t[2]}</h2><p>${t[3]}</p><div class="row2">${r.why==="deja"?`<button data-x data-rank>Voir le classement</button>`:""}<button class="cy" data-x>OK</button></div>`);
}
function celebrate(c,r,before){
  const cols=[ACC,ACC1,ACC3,"#ffffff",ACC,"#ffffff"];
  const conf=Array.from({length:34},(_,i)=>{ const a=Math.PI*2*i/34+Math.random()*.4, d=110+Math.random()*120;
    return `<i style="background:${cols[i%cols.length]};--x:${Math.round(Math.cos(a)*d)}px;--y:${Math.round(Math.sin(a)*d+60)}px;--r:${Math.round(Math.random()*720-360)}deg;animation-delay:${Math.round(Math.random()*120)}ms"></i>`; }).join("");
  const ici=r.ici>1?`${r.ici}e sportif à pointer ici aujourd'hui`:"Premier sportif à pointer ici aujourd'hui";
  ckModal(`<div class="confetti">${conf}</div><div class="plus">+10</div><h2>Séance validée !</h2><p>À <b>${esc(c.n)}</b>. ${pickR(["Quelle machine !","Tu es inarrêtable.","Encore une séance dans la poche. Bravo.","Ton corps te dit merci."])}</p>
    <div class="tot">Total <b id="ckTot">${before}</b> points</div>
    <div class="chips2" id="ckChips"><span>${ici}</span></div>
    <div class="row2"><button data-x data-rank>${ic("trophy")} Classement</button><button class="cy" data-x>Fermer</button></div>`);
  const el=$("ckTot"), t0=performance.now(); (function step(t){ const k=Math.min(1,(t-t0)/900); el.textContent=Math.round(before+10*k); if(k<1) requestAnimationFrame(step); })(t0);
  setTimeout(()=>{ const ch=$("ckChips"); if(!ch) return; const x=[];
    if(score.streak>=2) x.push(`<span class="fire">${ic("flame")} ${score.streak} jours d'affilée</span>`);
    if(score.rank_month) x.push(`<span>${ic("trophy")} ${score.rank_month===1?"1er":score.rank_month+"e"} ce mois-ci</span>`);
    ch.insertAdjacentHTML("beforeend",x.join("")); },1200);
}

/* ---- classement */
let rankPeriod="month", rankRows={};
async function renderRank(load=true){
  if(!ptsOn()) return;
  sheetMode="rank",gmKeep(); const sh=$("sheet"); sh.hidden=false; sh.classList.add("big");
  const mo=rankPeriod==="month", s=score, rk=mo?s.rank_month:s.rank, rows=rankRows[rankPeriod];
  const ord=n=>n===1?"1er":n+"e";
  sh.innerHTML=`<div class="sh-head"><h2>Classement</h2><button class="x" data-close aria-label="Fermer">${ic("x")}</button></div><div class="sh-body">
    ${!featOn("feat_points")?`<div class="msg warn">Masqué au public : toi seul le vois. Active-le dans Admin → Fonctionnalités.</div>`:""}
    <div class="me-card"><div class="me-n"><small>Toi</small><b>${esc(myName())}</b></div>
      <div><b>${mo?s.month||0:s.points||0}</b><small>points</small></div>
      <div><b>${rk?ord(rk):"–"}</b><small>rang</small></div>
      <div><b>${s.streak||0}</b><small>${(s.streak||0)>1?"jours":"jour"} d'affilée</small></div></div>
    <button class="cy big-ck${s.today?" done":""}" data-checkin>${ic(s.today?"check":"bolt")} ${s.today?"Séance du jour validée":"Je suis à la salle · +10 points"}</button>
    <div class="tabs" role="tablist"><button role="tab" data-period="month" aria-selected="${mo}">Ce mois-ci</button><button role="tab" data-period="all" aria-selected="${!mo}">Depuis le début</button></div>
    <div id="rankList">${rows===undefined?`<div class="empty">Chargement…</div>`:rows===null?`<div class="empty">Classement indisponible pour le moment.</div>`:rows.length?rows.map((r,i)=>`<div class="rk${r.me?" me":""}"><span class="p${i<3?" g"+(i+1):""}">${i+1}</span><b>${esc(nameOf(r.no))}${r.me?" (toi)":""}</b><span>${r.clubs} salle${r.clubs>1?"s":""}</span><em>${r.points}<small> pts</small></em></div>`).join(""):`<div class="empty">Personne n'a encore pointé${mo?" ce mois-ci":""}. Sois le premier : rends-toi dans une salle et appuie sur « Je suis à la salle ».</div>`}</div>
    <p class="rules">10 points par jour maximum, seulement sur place : ta position est vérifiée (moins de 200 m de la salle) et n'est jamais affichée. Tes points sont liés à cet appareil.</p>
  </div>`;
  if(load){ try{ rankRows[rankPeriod]=LIVE?await rpc("leaderboard",{p_period:rankPeriod,p_voter:voterId}):[]; }catch(e){ rankRows[rankPeriod]=null; if(isMissing(e)) ptsReady=false; }
    if(sheetMode==="rank") renderRank(false); }
}


/* ---- pseudo unique (feat_pseudo) */
const needPseudo = () => psOn() && !myPseudo && !store.get("hmg-pseudo-later",false);
const PS_RE = /^[A-Za-z0-9À-ÖØ-öø-ÿ][A-Za-z0-9À-ÖØ-öø-ÿ _.-]{1,18}[A-Za-z0-9À-ÖØ-öø-ÿ]$/;
const psKey = s => fold(s).replace(/[^a-z0-9]/g,"");
function psLocal(v){
  if(!v) return "vide";
  if(v.length<3) return "court";
  if(!PS_RE.test(v)||/[ _.-]{2}/.test(v)||psKey(v).length<3) return "invalide";
  if(!isAdmin()&&(/^machine\d*$/.test(psKey(v))||/(admin|moderat|hmg|fitnesspark|anonyme)/.test(psKey(v))||["mino","toi","moi","visiteur"].includes(psKey(v)))) return "reserve";
  if(hasBad(v.replace(/\d/g," "))) return "mot";
  for(const no in PSEUDOS) if(+no!==myNo&&psKey(PSEUDOS[no])===psKey(v)) return "pris";
  return "ok";
}
const PS_MSG = { vide:"", court:"Encore un effort : 3 caractères minimum.", invalide:"Lettres, chiffres, espace, point, tiret ou _ (3 à 20 caractères).", reserve:"Ce nom est réservé. Trouve-toi un nom de légende.",
  mot:"On garde ça propre ici. Un autre pseudo ?", pris:"Déjà pris par une autre machine. Essaie une variante.", vite:"Doucement, champion : attends quelques secondes avant de rechanger.", toi:"C'est déjà ton pseudo.", ok:"Libre ! Il n'attend que toi." };
const psIdeas = v => { const b=(v||"").replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ]/g,"").slice(0,14)||"Titan"; const r=()=>Math.floor(10+Math.random()*89);
  return [...new Set([b+r(), b+"_"+["Fit","Pro","Gym","Max"][Math.floor(Math.random()*4)], b+"."+r()])].filter(x=>psLocal(x)==="ok").slice(0,3); };
let psTimer=0, psSeq=0;
function pseudoModal(first){
  const m=ckModal(`<div class="ps-ico">${ic("pen")}</div>
    <h2>${myPseudo?"Change ton pseudo":"Choisis ton pseudo"}</h2>
    <p>${myPseudo?`Aujourd'hui tu es <b>${esc(myPseudo)}</b>.`:`Pour l'instant tu es la <b>Machine ${myNo}</b>.`} Ton pseudo est <b>unique</b> : personne d'autre ne pourra le porter. Il s'affiche sur tes avis et au classement.</p>
    <form id="psForm" class="ps-form" autocomplete="off">
      <div class="ps-in"><input id="psIn" maxlength="20" placeholder="Ex. : Titan_77" aria-label="Ton pseudo" value="${esc(myPseudo||"")}" autocapitalize="off" spellcheck="false" enterkeyhint="done"><span id="psSt" class="ps-st" aria-hidden="true"></span></div>
      <div id="psMsg" class="ps-msg" aria-live="polite">3 à 20 caractères.</div>
      <div id="psIdeas" class="ps-ideas"></div>
      <button class="cy" id="psGo" type="submit" disabled>${myPseudo?"Valider mon nouveau pseudo":"C'est mon pseudo"}</button>
    </form>
    ${myPseudo?"":`<button class="ghost ps-acct" type="button" data-acct="restore">J'ai déjà un compte</button>`}<button class="ghost" data-x id="psLater">${myPseudo?"Annuler":first?"Plus tard, je reste Machine "+myNo:"Plus tard"}</button>`);
  const inp=$("psIn"), go=$("psGo");
  const show=(st,v)=>{ const ok=st==="ok"; $("psMsg").textContent=PS_MSG[st]||PS_MSG.invalide; $("psMsg").className="ps-msg "+(st==="ok"?"ok":st==="wait"||st==="vide"||st==="court"?"":"ko");
    $("psSt").className="ps-st "+(st==="ok"?"ok":st==="wait"?"wait":st==="vide"?"":"ko"); go.disabled=!ok;
    const ideas=st==="pris"||st==="reserve"?psIdeas(v):[]; $("psIdeas").innerHTML=ideas.map(x=>`<button type="button" data-idea="${esc(x)}">${esc(x)}</button>`).join(""); };
  const check=()=>{ const v=inp.value.trim().replace(/\s+/g," "); const loc=psLocal(v); clearTimeout(psTimer); const seq=++psSeq;
    if(loc!=="ok"||(myPseudo&&psKey(v)===psKey(myPseudo))){ show(myPseudo&&psKey(v)===psKey(myPseudo)?"toi":loc,v); return; }
    if(!LIVE){ show("ok",v); return; }
    show("wait",v); $("psMsg").textContent="Je vérifie qu'il est libre…";
    psTimer=setTimeout(async()=>{ try{ const r=await rpc("pseudo_check",{p_pseudo:v,p_voter:voterId}); if(seq===psSeq) show(r==="toi"?"toi":r,v); }catch(e){ if(seq===psSeq) show("ok",v); } },320); };
  inp.addEventListener("input",check);
  m.querySelector("#psIdeas").addEventListener("click",e=>{ const b=e.target.closest("[data-idea]"); if(!b) return; inp.value=b.dataset.idea; check(); inp.focus(); });
  $("psLater").addEventListener("click",()=>{ if(!myPseudo) store.set("hmg-pseudo-later",true); });
  m.addEventListener("click",e=>{ if(e.target===m&&!myPseudo) store.set("hmg-pseudo-later",true); });
  $("psForm").addEventListener("submit",async e=>{ e.preventDefault(); const v=inp.value.trim().replace(/\s+/g," "); if(psLocal(v)!=="ok"||go.disabled) return;
    go.disabled=true; go.textContent="Un instant…";
    try{
      const r=LIVE?await rpc("set_pseudo",{p_voter:voterId,p_no:myNo,p_pseudo:v}):{ok:true,pseudo:v,no:myNo};
      if(!r||!r.ok){ show((r&&r.why)||"invalide",v); go.textContent=myPseudo?"Valider mon nouveau pseudo":"C'est mon pseudo"; return; }
      if(r.no&&r.no!==myNo){ myNo=r.no; store.set("hmg-visitor",myNo); }
      const wasNew=!myPseudo; myPseudo=r.pseudo; store.set("hmg-pseudo",myPseudo); store.set("hmg-pseudo-later",false);
      for(const k in PSEUDOS) if(PSEUDOS[k]===myPseudo) delete PSEUDOS[k]; PSEUDOS[myNo]=myPseudo;
      psWelcome(wasNew);
      updateHeader(); applyFeatures(); if(sheetMode==="club") renderClub(); else if(sheetMode==="rank") renderRank(false); else if(sheetMode==="mod") renderMod();
    }catch(err){ $("psMsg").textContent=/ouverte/.test(err.message)?"Les pseudos arrivent très bientôt.":err.message; $("psMsg").className="ps-msg ko"; go.disabled=false; go.textContent=myPseudo?"Valider mon nouveau pseudo":"C'est mon pseudo"; }
  });
  check(); setTimeout(()=>{ try{ inp.focus({preventScroll:true}); }catch(e){} }, TOUCH_DEV?350:50);
}
function psWelcome(wasNew){
  const cols=[ACC,ACC1,ACC3,"#ffffff",ACC,"#ffffff"];
  const conf=Array.from({length:30},(_,i)=>{ const a=Math.PI*2*i/30+Math.random()*.4, d=100+Math.random()*110;
    return `<i style="background:${cols[i%cols.length]};--x:${Math.round(Math.cos(a)*d)}px;--y:${Math.round(Math.sin(a)*d+60)}px;--r:${Math.round(Math.random()*720-360)}deg;animation-delay:${Math.round(Math.random()*120)}ms"></i>`; }).join("");
  ckModal(`<div class="confetti">${conf}</div><div class="ps-ico ok">${ic("check")}</div><h2>${wasNew?"Bienvenue":"Enchanté"}, <span class="gr">${esc(myPseudo)}</span> !</h2>
    <p>${pickR(["Un nom de champion. Il est à toi, et à personne d'autre.","Ça sonne comme un futur numéro 1.","Retiens bien ce nom : bientôt en haut du classement.","Nom de légende validé. La salle n'a qu'à bien se tenir."])}</p>
    <button class="cy" data-x>Voir la carte</button>`);
}

/* ================= ANGE DE LA SEMAINE (feat_angel) =================
   Si le sportif a validé au moins 3 séances la semaine précédente (lundi → dimanche),
   un petit ange vient le féliciter à sa première visite de la semaine. L'admin choisit l'animation. */
const ANGEL_STYLES=[
  {k:"magie",t:"Le tour de magie",d:"L'ange arrive, tapote trois fois un chapeau haut-de-forme avec sa baguette et en fait sortir une médaille d'or."},
  {k:"coeur",t:"Le cœur magique",d:"L'ange dessine un cœur avec sa baguette. Le cœur bat, éclate en petits cœurs, puis l'ange envoie un bisou."},
  {k:"couronne",t:"La couronne",d:"L'ange apporte une couronne d'or et la pose sur la tête du sportif : « Machine de la semaine ». Sa pastille de profil garde la couronne toute la semaine."}];
const angelStyle=()=>{ const v=db.settings.angel_style; return ANGEL_STYLES.some(a=>a.k===v)?v:"magie"; };
const isoWeek=()=>{ const d=new Date(), t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())), wd=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-wd);
  const y=t.getUTCFullYear(); return y+"-"+String(Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7)).padStart(2,"0"); };
const crowned=()=>featOn("feat_angel")&&store.get("hmg-crown-week",null)===isoWeek();
const ANGEL_SVG=`<svg class="ag" viewBox="-110 -125 220 240" aria-hidden="true">
  <g class="ag-halo"><ellipse cx="0" cy="-97" rx="28" ry="7.5" fill="none" stroke="url(#agGold)" stroke-width="5.5"/><ellipse cx="0" cy="-97" rx="28" ry="7.5" fill="none" stroke="#fffbe0" stroke-width="1.2" opacity=".9"/></g>
  <g transform="translate(-16,6)"><g class="flap">
    <path d="M0,0 C-14,-30 -50,-46 -78,-28 C-68,-22 -72,-12 -64,-8 C-74,-2 -70,10 -58,10 C-64,20 -50,28 -38,20 C-30,26 -14,20 0,0Z" fill="url(#agWing)" stroke="#c4d6f7" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M-12,-4 Q-38,-14 -62,-20 M-16,4 Q-36,2 -54,0 M-16,10 Q-28,14 -40,16" fill="none" stroke="#c4d6f7" stroke-width="1.5" stroke-linecap="round"/></g></g>
  <g transform="translate(16,6) scale(-1,1)"><g class="flap">
    <path d="M0,0 C-14,-30 -50,-46 -78,-28 C-68,-22 -72,-12 -64,-8 C-74,-2 -70,10 -58,10 C-64,20 -50,28 -38,20 C-30,26 -14,20 0,0Z" fill="url(#agWing)" stroke="#c4d6f7" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M-12,-4 Q-38,-14 -62,-20 M-16,4 Q-36,2 -54,0 M-16,10 Q-28,14 -40,16" fill="none" stroke="#c4d6f7" stroke-width="1.5" stroke-linecap="round"/></g></g>
  <ellipse cx="-11" cy="82" rx="7" ry="4.5" fill="#ffd3bb"/><ellipse cx="11" cy="82" rx="7" ry="4.5" fill="#ffd3bb"/>
  <path d="M-20,-6 C-26,20 -38,50 -46,74 Q-38,82 -30,76 Q-22,84 -14,77 Q-7,85 0,78 Q7,85 14,77 Q22,84 30,76 Q38,82 46,74 C38,50 26,20 20,-6Z" fill="url(#agRobe)" stroke="#d3def5" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M-14,0 Q0,9 14,0" fill="none" stroke="url(#agGold)" stroke-width="4" stroke-linecap="round"/>
  <path d="M0,22 l2.4,5.2 5.6,.6 -4.2,3.8 1.2,5.6 -5,-2.9 -5,2.9 1.2,-5.6 -4.2,-3.8 5.6,-.6Z" fill="#c8ff1e" stroke="#9fe000" stroke-width=".8" stroke-linejoin="round"/>
  <g transform="translate(-19,8)"><g class="arm-l"><path d="M0,0 Q-10,14 -14,28" fill="none" stroke="#f3f7ff" stroke-width="11" stroke-linecap="round"/><path d="M0,0 Q-10,14 -14,28" fill="none" stroke="#d3def5" stroke-width="1.2" stroke-linecap="round" opacity=".7" transform="translate(4,0)"/><circle cx="-14" cy="31" r="6" fill="url(#agSkin)"/></g></g>
  <g class="ag-head">
    <circle cx="0" cy="-38" r="34" fill="url(#agSkin)"/>
    <g fill="url(#agHair)"><circle cx="-28" cy="-55" r="9"/><circle cx="-18" cy="-66" r="12"/><circle cx="-3" cy="-72" r="13"/><circle cx="12" cy="-69" r="12"/><circle cx="25" cy="-58" r="9.5"/></g>
    <path d="M-2,-80 q8,-10 14,-2 q4,6 -3,8" fill="none" stroke="#f6b93b" stroke-width="3.2" stroke-linecap="round"/>
    <g class="ag-eyes">
      <g><ellipse cx="-12" cy="-36" rx="4.6" ry="6.2" fill="#2a1f3d"/><circle cx="-10.3" cy="-38.6" r="1.9" fill="#fff"/><circle cx="-13.3" cy="-33.4" r=".9" fill="#fff"/></g>
      <g class="eye-r"><ellipse cx="12" cy="-36" rx="4.6" ry="6.2" fill="#2a1f3d"/><circle cx="13.7" cy="-38.6" r="1.9" fill="#fff"/><circle cx="10.7" cy="-33.4" r=".9" fill="#fff"/></g>
      <path class="wink-r" d="M6,-36 Q12,-41.5 18,-36" fill="none" stroke="#2a1f3d" stroke-width="2.8" stroke-linecap="round"/>
    </g>
    <ellipse cx="-22" cy="-24" rx="7" ry="4.4" fill="#ff8fab" opacity=".55"/><ellipse cx="22" cy="-24" rx="7" ry="4.4" fill="#ff8fab" opacity=".55"/>
    <ellipse cx="0" cy="-28" rx="1.7" ry="1.2" fill="#f0a487"/>
    <path class="ag-mouth" d="M-6,-21 Q0,-14.5 6,-21" fill="none" stroke="#8a3d55" stroke-width="2.6" stroke-linecap="round"/>
    <path class="ag-kiss" d="M-1.5,-22 a3,3 0 1 1 3,0 a3,3 0 1 1 -3,0" fill="#c2506f"/>
  </g>
  <g transform="translate(19,8)"><g class="arm-r">
    <path d="M0,0 Q14,6 22,16" fill="none" stroke="#f3f7ff" stroke-width="11" stroke-linecap="round"/>
    <line x1="22" y1="17" x2="50" y2="-25" stroke="#4b3a6e" stroke-width="4" stroke-linecap="round"/>
    <circle cx="24" cy="17" r="6" fill="url(#agSkin)"/>
    <g transform="translate(52,-28)"><g class="ag-star"><path d="M0,-11 L3.2,-3.4 11,-3.4 4.8,1.6 7,9.4 0,4.8 -7,9.4 -4.8,1.6 -11,-3.4 -3.2,-3.4Z" fill="url(#agGold)" stroke="#fff6c2" stroke-width="1"/></g></g>
  </g></g>
</svg>`;
const ANGEL_DEFS=`<svg class="ang-defs" width="0" height="0" aria-hidden="true"><defs>
    <radialGradient id="agSkin" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff3ea"/><stop offset="1" stop-color="#ffcfb4"/></radialGradient>
    <linearGradient id="agRobe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8fb"/></linearGradient>
    <linearGradient id="agWing" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfe0ff"/></linearGradient>
    <linearGradient id="agGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#f2a300"/></linearGradient>
    <linearGradient id="agHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#f6b93b"/></linearGradient>
  </defs></svg>`;
const HAT_SVG=`<svg viewBox="0 0 100 92"><ellipse cx="50" cy="80" rx="47" ry="10" fill="#10131f" stroke="#2c3350" stroke-width="2"/><path d="M22,79 L27,16 Q50,8 73,16 L78,79 Q50,88 22,79Z" fill="#1a1f33" stroke="#2c3350" stroke-width="2"/><path d="M24,58 Q50,66 76,58 L77,70 Q50,78 23,70Z" fill="#c8ff1e"/><ellipse cx="50" cy="16" rx="23" ry="6.5" fill="#262d47"/><path d="M33,24 L30,54" stroke="rgba(255,255,255,.14)" stroke-width="4" stroke-linecap="round"/></svg>`;
const MEDAL=n=>`<svg viewBox="0 0 120 150"><path d="M30,0 L56,58 L42,64 L14,4Z" fill="#c8ff1e"/><path d="M90,0 L64,58 L78,64 L106,4Z" fill="#9fe000"/><circle cx="60" cy="95" r="46" fill="url(#agGold)" stroke="#fff3b0" stroke-width="3"/><circle cx="60" cy="95" r="36" fill="none" stroke="#e39b00" stroke-width="2.5" stroke-dasharray="3 4"/><text x="60" y="104" text-anchor="middle" font-family="Space Grotesk,Inter,sans-serif" font-weight="700" font-size="40" fill="#5b3a00">${n}</text><text x="60" y="123" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="10" letter-spacing="1.5" fill="#7a5000">SÉANCES</text></svg>`;
const CROWN_SVG=`<svg viewBox="0 0 100 72"><path d="M8,58 L4,16 L28,36 L50,6 L72,36 L96,16 L92,58Z" fill="url(#agGold)" stroke="#d08c00" stroke-width="2.5" stroke-linejoin="round"/><rect x="7" y="54" width="86" height="12" rx="4" fill="url(#agGold)" stroke="#d08c00" stroke-width="2.2"/><circle cx="4" cy="16" r="5" fill="#ff6b9a" stroke="#fff" stroke-width="1.2"/><circle cx="50" cy="6" r="6" fill="#3fd8ff" stroke="#fff" stroke-width="1.2"/><circle cx="96" cy="16" r="5" fill="#ff6b9a" stroke="#fff" stroke-width="1.2"/><circle cx="50" cy="60" r="4.5" fill="#c8ff1e"/><circle cx="28" cy="60" r="3.2" fill="#3fd8ff"/><circle cx="72" cy="60" r="3.2" fill="#3fd8ff"/><path d="M18,48 L20,30" stroke="#fffbe0" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>`;
const HEART_D="M0,34 C-46,4 -66,-28 -38,-50 C-20,-63 -4,-52 0,-40 C4,-52 20,-63 38,-50 C66,-28 46,4 0,34Z";
/* ---- sons de l'ange : composés en direct dans le navigateur (Web Audio), aucun fichier à charger */
const SND={ctx:null,want:false,unlockedAt:0,padV:null,sc:null,onchange:null,LOUD:1.9,
  on(){ return store.get("hmg-sound",true)!==false; },
  ready(){ return !!this.ctx&&this.ctx.state==="running"; },
  forced(){ return store.get("hmg-sound-force",false)===true; },
  canForce(){ return !!navigator.audioSession&&matchMedia("(pointer:coarse)").matches&&!this.forced(); },
  force(){ store.set("hmg-sound-force",true); try{ navigator.audioSession.type="playback"; }catch(e){} },
  /* après l'ange : on endort le son pour rendre la main à la musique et économiser la batterie */
  sleep(){ this.want=false; setTimeout(()=>{ if(!angelBusy&&this.ready()) this.ctx.suspend().catch(()=>{}); },2600); },
  fresh(){ return performance.now()-this.unlockedAt<900; },
  init(){
    if(this.ctx) return this.ctx;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    /* iPhone : par défaut le son se mélange à la musique du sportif et respecte le mode silencieux.
       S'il touche « Pas de son ? », on passe en « playback » : le son sort même en silencieux (sa musique se met en pause le temps de l'ange). */
    try{ if(navigator.audioSession) navigator.audioSession.type=this.forced()?"playback":"ambient"; }catch(e){}
    let c; try{ c=this.ctx=new AC({latencyHint:"interactive"}); }catch(e){ return null; }
    c.onstatechange=()=>{ try{ this.onchange&&this.onchange(); }catch(e){} };
    const comp=c.createDynamicsCompressor(); comp.threshold.value=-18; comp.knee.value=14; comp.ratio.value=3.5; comp.attack.value=.003; comp.release.value=.25;
    const lim=c.createDynamicsCompressor(); lim.threshold.value=-2; lim.knee.value=0; lim.ratio.value=20; lim.attack.value=.001; lim.release.value=.1; comp.connect(lim); lim.connect(c.destination);
    const vol=this.vol=c.createGain(); vol.gain.value=this.on()?this.LOUD:0; vol.connect(comp);
    this.dry=c.createGain(); this.dry.gain.value=.85; this.dry.connect(vol);
    /* réverbe « petite chapelle » : bruit qui s'éteint doucement */
    const rate=c.sampleRate, len=Math.floor(rate*2.8), ir=c.createBuffer(2,len,rate);
    for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); let lp=0; for(let i=0;i<len;i++){ const k=i/len; lp+=((Math.random()*2-1)-lp)*(.55-.4*k); d[i]=lp*Math.pow(1-k,2.6)*Math.min(1,i/(rate*.015)); } }
    this.rev=c.createConvolver(); this.rev.buffer=ir; const rg=c.createGain(); rg.gain.value=.5; this.rev.connect(rg); rg.connect(vol);
    /* écho léger pour les clochettes */
    const dl=this.echo=c.createDelay(1), fb=c.createGain(), lp=c.createBiquadFilter(), eg=c.createGain();
    dl.delayTime.value=.21; fb.gain.value=.3; lp.type="lowpass"; lp.frequency.value=3800; eg.gain.value=.2;
    dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(eg); eg.connect(vol); eg.connect(this.rev);
    const nb=this.nbuf=c.createBuffer(1,rate*2,rate), nd=nb.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
    this.scene(); return c;
  },
  unlock(){ const c=this.init(); if(!c||c.state==="running") return; this.unlockedAt=performance.now();
    try{ c.resume(); const s=c.createBufferSource(); s.buffer=c.createBuffer(1,1,22050); s.connect(c.destination); s.start(0); }catch(e){} },
  /* attend que le visiteur touche l'écran (les téléphones interdisent le son avant) */
  gesture(ms){ return new Promise(res=>{ if(this.ready()) return res(true); let ok=false; const evs=["pointerup","touchend","click","keydown"];
    const done=v=>{ if(ok) return; ok=true; clearTimeout(tm); evs.forEach(e=>removeEventListener(e,f,true)); res(v); };
    const f=()=>{ this.unlock(); setTimeout(()=>{ this.unlockedAt=0; done(true); },320); }, tm=setTimeout(()=>done(false),ms);
    evs.forEach(e=>addEventListener(e,f,{capture:true,passive:true})); }); },
  mute(off){ store.set("hmg-sound",!off); if(this.vol){ const t=this.ctx.currentTime; this.vol.gain.cancelScheduledValues(t); this.vol.gain.setTargetAtTime(off?0:this.LOUD,t,.06); } },
  /* chaque animation a sa « scène » : si on accélère, on coupe les sons déjà programmés */
  scene(){ const c=this.ctx, s={}; for(const k of ["dry","rev","echo"]){ s[k]=c.createGain(); s[k].connect(this[k]); } this.sc=s; return s; },
  hush(){ if(!this.ctx||!this.sc) return; const t=this.ctx.currentTime; Object.values(this.sc).forEach(g=>{ g.gain.setTargetAtTime(0,t,.03); setTimeout(()=>g.disconnect(),600); }); this.scene(); },
  bus(g,{rev=.35,echo=0,pan=0}={}){ const c=this.ctx, s=this.sc; let n=g;
    if(pan&&c.createStereoPanner){ const p=c.createStereoPanner(); p.pan.value=Math.max(-1,Math.min(1,pan)); g.connect(p); n=p; }
    n.connect(s.dry); if(rev){ const r=c.createGain(); r.gain.value=rev; n.connect(r); r.connect(s.rev); } if(echo){ const e=c.createGain(); e.gain.value=echo; n.connect(e); e.connect(s.echo); } },
  env(t,a,d,peak){ const g=this.ctx.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(.0001,t+a+d); return g; },
  osc(type,f,t,end){ const o=this.ctx.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t); o.start(t); o.stop(end+.05); return o; },
  hz:m=>440*Math.pow(2,(m-69)/12),
  PENTA:[0,2,4,7,9],
  note(i,base=72){ const P=this.PENTA; return base+12*Math.floor(i/5)+P[((i%5)+5)%5]; },
  /* clochette de verre (FM) */
  bell(m,t,g=.1,d=1.8,o={}){ const c=this.ctx, f=this.hz(m), e=this.env(t,.003,d,g), car=this.osc("sine",f,t,t+d), mod=this.osc("sine",f*(o.ratio||3.5),t,t+d), mi=c.createGain();
    mi.gain.setValueAtTime(f*(o.idx||1.8),t); mi.gain.exponentialRampToValueAtTime(f*.04,t+d*.5); mod.connect(mi); mi.connect(car.frequency); car.connect(e);
    const h=this.osc("sine",f*2.756,t,t+d*.4), he=this.env(t,.002,d*.3,g*.18); h.connect(he);
    this.bus(e,{rev:.5,echo:.3,...o}); this.bus(he,{rev:.4,pan:o.pan||0}); },
  /* corde de harpe */
  pluck(m,t,g=.12,d=1.5,o={}){ const c=this.ctx, f=this.hz(m), e=this.env(t,.004,d,g), lp=c.createBiquadFilter();
    lp.type="lowpass"; lp.Q.value=2; lp.frequency.setValueAtTime(Math.min(16000,f*9),t); lp.frequency.exponentialRampToValueAtTime(f*1.5,t+d*.55);
    const a=this.osc("triangle",f,t,t+d), b=this.osc("sine",f*2.003,t,t+d), bg=c.createGain(); bg.gain.value=.4;
    a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(e); this.bus(e,{rev:.55,...o}); },
  /* souffle filtré (vol, poudre magique, pouf) */
  noise(t,d,{f1=500,f2=2000,f3=0,q=1,g=.12,a=.4,type="bandpass",rev=.3,flutter=0,pan=0,pan2=null}={}){ const c=this.ctx, s=c.createBufferSource(), bp=c.createBiquadFilter(), e=c.createGain();
    s.buffer=this.nbuf; s.loop=true; bp.type=type; bp.Q.value=q; bp.frequency.setValueAtTime(f1,t);
    if(f3){ bp.frequency.exponentialRampToValueAtTime(f2,t+d*a); bp.frequency.exponentialRampToValueAtTime(f3,t+d); } else bp.frequency.exponentialRampToValueAtTime(f2,t+d);
    e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(g,t+d*a); e.gain.linearRampToValueAtTime(0,t+d);
    s.connect(bp); let n=bp;
    if(flutter){ const am=c.createGain(), lfo=this.osc("sine",flutter,t,t+d), lg=c.createGain(); am.gain.value=.55; lg.gain.value=.45; lfo.connect(lg); lg.connect(am.gain); bp.connect(am); n=am; }
    n.connect(e);
    if(pan2!=null&&c.createStereoPanner){ const p=c.createStereoPanner(); p.pan.setValueAtTime(pan,t); p.pan.linearRampToValueAtTime(pan2,t+d); e.connect(p); this.bus(p,{rev}); }
    else this.bus(e,{rev,pan});
    s.start(t,Math.random()*1.5); s.stop(t+d+.05); },
  /* note qui glisse (bulle, pop, bisou, sifflet de chute) */
  chirp(f1,f2,t,d,{type="sine",g=.12,rev=.25,a=.006,pan=0}={}){ const o=this.osc(type,f1,t,t+d), e=this.env(t,a,d,g); o.frequency.exponentialRampToValueAtTime(f2,t+d*.85); o.connect(e); this.bus(e,{rev,pan}); },
  /* poussière d'étoiles : clochettes aiguës au hasard */
  sparkle(t,n=6,span=.6,g=.035,lo=10,hi=19){ for(let i=0;i<n;i++){ const k=lo+Math.floor(Math.random()*(hi-lo)); this.bell(this.note(k,72),t+Math.random()*span,g*(.6+Math.random()*.6),.9,{pan:Math.random()*1.4-.7,echo:.4}); } },
  /* glissando de harpe */
  gliss(t,from,to,step=.045,g=.09,o={}){ const dir=to>from?1:-1; for(let i=from,j=0;dir>0?i<=to:i>=to;i+=dir,j++) this.pluck(this.note(i,60),t+j*step,g*(o.fade?Math.max(.25,1-j*.06):1),1.3,{pan:o.pan?o.pan*(j/Math.abs(to-from))-o.pan/2:0}); },
  /* chœur céleste très doux sous toute l'animation */
  pad(){ if(!this.ready()||this.padV) return; const c=this.ctx, t=c.currentTime, out=c.createGain(), lp=c.createBiquadFilter(), lfo=this.osc("sine",4.6,t,t+60), lg=c.createGain(), oscs=[lfo];
    out.gain.setValueAtTime(0,t); out.gain.linearRampToValueAtTime(.32,t+2.4); lp.type="lowpass"; lp.frequency.value=2600; lg.gain.value=5; lfo.connect(lg);
    const forms=[[800,7,1],[1150,8,.6],[2900,11,.22]].map(([f,q,g])=>{ const b=c.createBiquadFilter(), bg=c.createGain(); b.type="bandpass"; b.frequency.value=f; b.Q.value=q; bg.gain.value=g; b.connect(bg); bg.connect(lp); return b; });
    [60,67,72,76].forEach((m,i)=>[-7,7].forEach(dt=>{ const o=this.osc("sawtooth",this.hz(m),t,t+60), g=c.createGain(); o.detune.value=dt; lg.connect(o.detune); g.gain.value=[.5,.4,.32,.22][i]*.5; o.connect(g); forms.forEach(b=>g.connect(b)); oscs.push(o); }));
    lp.connect(out); const s=c.createGain(); s.gain.value=.9; out.connect(s); s.connect(this.rev); const d=c.createGain(); d.gain.value=.35; out.connect(d); d.connect(this.dry);
    this.padV={out,oscs}; },
  padOff(){ const v=this.padV; if(!v) return; this.padV=null; const t=this.ctx.currentTime; v.out.gain.cancelScheduledValues(t); v.out.gain.setTargetAtTime(0,t,.35); v.oscs.forEach(o=>{ try{ o.stop(t+2); }catch(e){} }); },
  /* les sons de l'ange */
  play(name,arg){ if(!this.ready()||!this.on()) return; const t=this.ctx.currentTime+.02;
    switch(name){
      case "arrive": this.noise(t,1.45,{f1:280,f2:1500,f3:520,q:.8,g:.11,a:.45,flutter:8.5,pan:arg||-.6,pan2:0});
        [7,10,12,14].forEach((k,i)=>this.bell(this.note(k,72),t+.55+i*.17,.075,1.6,{pan:-.3+i*.12})); this.sparkle(t+.2,4,1); break;
      case "drop": this.chirp(1900,560,t,.52,{type:"sine",g:.035,rev:.3});
        this.chirp(170,58,t+.55,.28,{g:.32,rev:.15}); this.noise(t+.55,.16,{f1:900,f2:160,type:"lowpass",q:.6,g:.16,a:.08,rev:.1});
        this.chirp(260,90,t+.8,.14,{g:.12,rev:.15}); this.pluck(55,t+.58,.06,.6); break;
      case "tap": { const i=arg||0; this.bell([91,93,96][i],t+.15,.1,1.4,{pan:.25}); this.noise(t+.14,.06,{f1:5000,f2:7000,type:"highpass",q:.7,g:.05,a:.1,rev:.2}); this.sparkle(t+.18,2+i,.35,.03,12,19); break; }
      case "magic": this.chirp(330,1100,t,.11,{g:.16,rev:.3}); this.noise(t,.5,{f1:1200,f2:6000,f3:3000,q:.7,g:.08,a:.25,rev:.6});
        this.gliss(t+.04,5,16,.042,.085); this.sparkle(t+.3,10,1.2,.035); [84,88,91,96].forEach((m,i)=>this.bell(m,t+1.18+i*.012,.06,2.2)); break;
      case "fanfare": { const v=arg||"magie", up=v==="couronne"?2:0;
        [[79,0],[84,.12],[88,.24],[91,.36]].forEach(([m,dt])=>this.bell(m+up,t+dt,.11,1.4,{pan:(dt-.18)*2}));
        [84,88,91,96].forEach((m,i)=>this.bell(m+up,t+.52+i*.015,.085,2.6,{pan:i*.2-.3}));
        (v==="coeur"?[57,64,69,72,76]:[60,64,67,72,76]).forEach((m,i)=>this.pluck(m+up,t+.5+i*.035,i?.09:.07,2.2));
        if(v==="couronne") [79,84].forEach((m,i)=>this.pluck(m+up,t+.62+i*.06,.06,2));
        this.sparkle(t+.55,8,1.2,.03); break; }
      case "wink": this.bell(100,t,.045,.6,{pan:.4}); this.bell(103,t+.08,.04,.7,{pan:.5}); break;
      case "poof": this.noise(t,.5,{f1:4200,f2:280,type:"lowpass",q:.7,g:.2,a:.1,rev:.45}); this.chirp(900,260,t,.3,{type:"triangle",g:.05}); break;
      case "bye": this.noise(t,1.5,{f1:380,f2:2600,q:.8,g:.1,a:.35,flutter:9.5,pan:0,pan2:.9});
        [12,13,14,15,17].forEach((k,i)=>this.bell(this.note(k,72),t+.15+i*.13,.06*(1-i*.14),1.2,{pan:.1+i*.18})); break;
      case "draw": { const seq=[10,11,12,13,14,13,12,11,10,9,8,9,10]; seq.forEach((k,i)=>this.pluck(this.note(k,60),t+i*(1.75/seq.length),.075,1.1,{pan:Math.sin(i/seq.length*Math.PI*2)*.5}));
        this.noise(t,1.8,{f1:3000,f2:7000,q:2,g:.025,a:.5,rev:.5}); break; }
      case "warm": [72,76,79,84].forEach((m,i)=>{ const f=this.hz(m), o=this.osc("triangle",f,t,t+2.4), e=this.ctx.createGain(); e.gain.setValueAtTime(0,t); e.gain.linearRampToValueAtTime(.05,t+.35); e.gain.exponentialRampToValueAtTime(.0001,t+2.4); o.connect(e); this.bus(e,{rev:.7,pan:i*.25-.37}); });
        this.bell(96,t+.05,.06,2); break;
      case "beat": [.17,.64].forEach((dt,i)=>{ const g=i?.24:.3; this.chirp(150,52,t+dt,.2,{g,rev:.12,a:.004}); this.chirp(300,110,t+dt,.12,{type:"triangle",g:g*.3,rev:.1,a:.004}); this.noise(t+dt,.07,{f1:420,f2:180,type:"lowpass",q:.5,g:.07,a:.15,rev:0}); }); break;
      case "hearts": this.chirp(400,1250,t,.1,{g:.12}); this.sparkle(t+.03,9,1,.035,8,17); break;
      case "kiss": this.noise(t,.05,{f1:2600,f2:1800,q:3,g:.16,a:.15,rev:.15}); this.chirp(620,1350,t+.05,.24,{type:"triangle",g:.07,rev:.35,a:.03});
        this.bell(96,t+.85,.05,1.4); this.sparkle(t+.9,3,.4,.025); break;
      case "pop": this.chirp(320,980,t,.1,{g:.15,rev:.25}); this.pluck(79,t+.04,.07,1); break;
      case "crown": this.noise(t,1.4,{f1:2400,f2:900,f3:1600,q:1.4,g:.05,a:.5,rev:.6});
        [19,18,17,16,15,14,13,12].forEach((k,i)=>this.bell(this.note(k,72),t+i*.15,.04,1,{pan:Math.sin(i*1.4)*.5}));
        [84,91,96,100].forEach((m,i)=>this.bell(m,t+1.3+i*.02,.1,2.4,{pan:i*.2-.3})); this.chirp(500,1500,t+1.3,.08,{g:.1}); this.sparkle(t+1.32,8,.9,.035); break;
    } }
};
["pointerdown","touchend","click","keydown"].forEach(ev=>addEventListener(ev,()=>{ if(SND.want) SND.unlock(); },{capture:true,passive:true}));
const SPK_ON=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>`;
const SPK_OFF=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>`;
let angelBusy=false;
async function playAngel(style,n,test){
  if(angelBusy) return; angelBusy=true; try{ closeMe(); }catch(e){}
  SND.want=true; SND.unlock(); if(SND.ctx) SND.hush();
  const W=innerWidth, H=innerHeight, cx=W/2, cy=Math.max(200,Math.min(H*.38,H/2-110));
  const stage=document.createElement("div"); stage.id="angel"; stage.setAttribute("role","dialog"); stage.setAttribute("aria-label","Félicitations"); document.body.appendChild(stage); stage.innerHTML=ANGEL_DEFS+`<button class="ang-snd" data-ang-snd type="button"></button>`;
  let spd=matchMedia("(prefers-reduced-motion: reduce)").matches?4:1, shown=false, closed=false;
  const sfx=(nm,a)=>{ if(!closed&&(spd===1||nm==="fanfare")) SND.play(nm,a); };
  const sb=stage.querySelector("[data-ang-snd]");
  const sndUI=()=>{ const on=SND.on(), lock=on&&!SND.ready(), ask=on&&!lock&&SND.canForce(); sb.className="ang-snd"+(on?"":" off")+(lock?" lock":"")+(ask?" ask":"");
    sb.innerHTML=(on?SPK_ON:SPK_OFF)+(lock?"<span>Touche pour le son</span>":ask?"<span>Pas de son ?</span>":""); sb.setAttribute("aria-label",on?"Couper le son":"Activer le son"); };
  SND.onchange=()=>{ if(closed) return; sndUI(); if(SND.ready()&&SND.on()) SND.pad(); };
  sndUI(); if(SND.on()) SND.pad();
  const z=ms=>new Promise(r=>setTimeout(r,ms/spd));
  const an=(el,kf,o)=>{ const a=el.animate(kf,{fill:"forwards",...o}); a.playbackRate=spd; return a.finished.catch(()=>{}); };
  const close=()=>{ if(closed) return; closed=true; SND.onchange=null; SND.padOff(); SND.sleep(); stage.classList.add("out"); setTimeout(()=>{ stage.remove(); angelBusy=false; },480); };
  stage.addEventListener("click",e=>{
    const fr=SND.fresh(); SND.unlockedAt=0;
    if(e.target.closest("[data-ang-snd]")){ const wake=fr||!SND.ready();
      if(!SND.on()){ SND.mute(false); SND.unlock(); SND.pad(); }
      else if(wake){ if(SND.canForce()) SND.force(); SND.unlock(); SND.pad(); }
      else if(SND.canForce()) SND.force();   // iPhone en silencieux : on force le son
      else SND.mute(true);
      SND.unlockedAt=0; sndUI(); return; }
    if(e.target.closest("[data-ang-ok]")||shown){ close(); return; }
    if(fr&&SND.on()) return;   // ce toucher vient d'allumer le son : on laisse l'animation à sa vitesse
    spd=5; SND.hush(); stage.getAnimations({subtree:true}).forEach(a=>{ try{ a.playbackRate=5; }catch(_){} }); });
  setTimeout(()=>{ if(!closed) close(); },22000);
  const name=esc(myName());
  const card=(k,h,p,btn)=>{ const c=document.createElement("div"); c.className="ang-card"; c.innerHTML=`<small class="k">${k}</small><h2>${h}</h2><p>${p}</p><button class="cy" data-ang-ok>${btn}</button>${test?`<em class="ang-test">Aperçu admin</em>`:""}`; stage.appendChild(c); requestAnimationFrame(()=>c.classList.add("in")); shown=true; };
  /* paillettes */
  const spk=(x,y,o={})=>{ const cols=o.cols||["#ffd166","#fff6c2","#ffffff","#c8ff1e"]; for(let i=0;i<(o.n||10);i++){ const s=document.createElement("i"); s.className=o.heart?"spk hrt":"spk";
      const a=(o.a0??0)+Math.random()*(o.spread??Math.PI*2), d=(o.d||60)*(.5+Math.random()*.7), sz=(o.s||10)*(.6+Math.random()*.8), c=cols[i%cols.length];
      s.style.cssText=`--s:${sz}px;--c:${c}`; stage.appendChild(s);
      const fx=x+Math.cos(a)*d, fy=y+Math.sin(a)*d;
      an(s,[{transform:`translate(${x}px,${y}px) scale(0) rotate(0deg)`,opacity:1},{transform:`translate(${x+(fx-x)*.7}px,${y+(fy-y)*.7}px) scale(1) rotate(${o.heart?0:90}deg)`,opacity:1,offset:.45},{transform:`translate(${fx}px,${fy+(o.g??14)}px) scale(.25) rotate(${o.heart?0:200}deg)`,opacity:0}],{duration:(o.t||1000)*(.7+Math.random()*.6),easing:"cubic-bezier(.2,.7,.3,1)"}).then(()=>s.remove()); } };
  /* l'ange */
  const fly=document.createElement("div"); fly.className="ang-fly"; fly.innerHTML=`<div class="ang-bob">${ANGEL_SVG}</div>`; stage.appendChild(fly);
  const svg=fly.querySelector("svg"), st={x:0,y:0,r:0};
  const tf=(x,y,r=0,s=1)=>`translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
  const place=(x,y,r=0)=>{ st.x=x; st.y=y; st.r=r; fly.style.transform=tf(x,y,r); };
  const go=async(pts,dur,ease="cubic-bezier(.45,.05,.3,1)")=>{ const kf=[{transform:tf(st.x,st.y,st.r)}].concat(pts.map(p=>({transform:tf(p.x,p.y,p.r||0)})));
    const a=fly.animate(kf,{duration:dur,easing:ease,fill:"forwards"}); a.playbackRate=spd; await a.finished.catch(()=>{}); const L=pts[pts.length-1]; place(L.x,L.y,L.r||0); a.cancel(); };
  const arm=svg.querySelector(".arm-r"), armL=svg.querySelector(".arm-l");
  const tap=()=>an(arm,[{transform:"rotate(0deg)"},{transform:"rotate(34deg)"},{transform:"rotate(0deg)"}],{duration:320,easing:"ease-in-out",fill:"none"});
  const wave=()=>an(armL,[{transform:"rotate(0deg)"},{transform:"rotate(-70deg)"},{transform:"rotate(-35deg)"},{transform:"rotate(-70deg)"},{transform:"rotate(-35deg)"},{transform:"rotate(0deg)"}],{duration:1300,easing:"ease-in-out",fill:"none"});
  const wink=()=>{ sfx("wink"); svg.classList.add("wink"); setTimeout(()=>svg.classList.remove("wink"),900/spd); };
  let trailT=0; const trail=on=>{ clearInterval(trailT); if(on) trailT=setInterval(()=>{ const r=fly.getBoundingClientRect(); spk(r.left+r.width*.5,r.top+r.height*.62,{n:2,d:18,s:9,g:22,t:900}); },60); };
  const bye=async()=>{ sfx("bye"); trail(true); await go([{x:st.x+50,y:st.y-60,r:8},{x:W+160,y:-170,r:18}],1500,"cubic-bezier(.55,0,.85,.45)"); trail(false); fly.remove(); };

  if(style==="coeur"){
    place(W+130,cy+160,14); sfx("arrive",.7);
    await go([{x:W*.82,y:cy-10,r:6},{x:cx+78,y:cy-120,r:0}],1500);
    const hx=cx-14, hy=cy+46;
    const hw=document.createElement("div"); hw.className="ang-heart"; hw.style.transform=`translate(${hx}px,${hy}px)`;
    hw.innerHTML=`<div class="hb"><svg viewBox="-75 -72 150 116"><defs><linearGradient id="agHeartG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8fb8"/><stop offset=".55" stop-color="#ff4f8b"/><stop offset="1" stop-color="#ff2e63"/></linearGradient></defs>
      <path class="hf" d="${HEART_D}" fill="url(#agHeartG)" opacity="0"/><path class="hs" d="${HEART_D}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-30,-38 Q-40,-26 -34,-12" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="5" stroke-linecap="round" class="hl" opacity="0"/>
      <text class="hn" x="0" y="-6" text-anchor="middle" font-family="Space Grotesk,Inter,sans-serif" font-weight="700" font-size="34" fill="#fff" opacity="0">${n}</text>
      <text class="hn" x="0" y="11" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="9" letter-spacing="1.6" fill="#fff" opacity="0">SÉANCES</text></svg></div>`;
    stage.appendChild(hw);
    const ps=hw.querySelector(".hs"), L=ps.getTotalLength(); ps.style.strokeDasharray=L; ps.style.strokeDashoffset=L;
    const swirl=an(arm,[{transform:"rotate(0deg)"},{transform:"rotate(30deg)"},{transform:"rotate(-8deg)"},{transform:"rotate(30deg)"},{transform:"rotate(-8deg)"},{transform:"rotate(30deg)"},{transform:"rotate(0deg)"}],{duration:1800,easing:"ease-in-out",fill:"none"});
    sfx("draw"); const draw=an(ps,[{strokeDashoffset:L},{strokeDashoffset:0}],{duration:1800,easing:"cubic-bezier(.5,.1,.4,1)"});
    const t0=performance.now(); const drawSpk=setInterval(()=>{ const k=Math.min(1,(performance.now()-t0)*spd/1800); const pt=ps.getPointAtLength(L*k), m=ps.getScreenCTM(); if(!m) return;
      spk(m.a*pt.x+m.c*pt.y+m.e, m.b*pt.x+m.d*pt.y+m.f,{n:2,d:16,s:9,g:8,t:700}); if(k>=1) clearInterval(drawSpk); },70);
    await Promise.all([swirl,draw]); clearInterval(drawSpk); sfx("warm");
    an(hw.querySelector(".hf"),[{opacity:0},{opacity:1}],{duration:450}); an(hw.querySelector(".hl"),[{opacity:0},{opacity:1}],{duration:450});
    hw.querySelectorAll(".hn").forEach(t=>an(t,[{opacity:0},{opacity:1}],{duration:500,delay:200}));
    await z(350);
    const hb=hw.querySelector(".hb"); sfx("beat");
    await an(hb,[{transform:"scale(1)"},{transform:"scale(1.16)"},{transform:"scale(.98)"},{transform:"scale(1.12)"},{transform:"scale(1)"}],{duration:950,easing:"ease-in-out",fill:"none"});
    sfx("hearts"); spk(hx,hy-6,{n:16,d:150,s:15,g:40,heart:true,cols:["#ff4f8b","#ff8fb8","#ffd166","#ffffff"],t:1300});
    hb.classList.add("beat");
    sfx("fanfare","coeur"); card("Cœur de champion",`${n} séances la semaine dernière !`,`Ta régularité fait chaud au cœur, <b>${name}</b>. Tu es une vraie machine.`,"Merci l'ange !");
    await z(500);
    svg.classList.add("kiss"); await z(350);
    const k=document.createElement("i"); k.className="spk hrt kiss"; k.style.cssText="--s:22px;--c:#ff4f8b"; stage.appendChild(k);
    const r=fly.getBoundingClientRect(); sfx("kiss");
    await an(k,[{transform:`translate(${r.left+r.width*.5}px,${r.top+r.height*.4}px) scale(.3)`,opacity:1},{transform:`translate(${cx}px,${cy+60}px) scale(2.2)`,opacity:.9,offset:.7},{transform:`translate(${cx}px,${cy+80}px) scale(3.2)`,opacity:0}],{duration:1200,easing:"cubic-bezier(.3,.6,.4,1)"});
    k.remove(); svg.classList.remove("kiss");
    await wave(); await bye();
  } else if(style==="couronne"){
    const ax=cx, ay=cy+64;
    const av=document.createElement("div"); av.className="ang-av"; av.style.transform=`translate(${ax}px,${ay}px)`;
    av.innerHTML=`<div class="ab">${ic("db")}</div><b>${name}</b>`; stage.appendChild(av); sfx("pop");
    an(av.querySelector(".ab"),[{transform:"scale(0)"},{transform:"scale(1.12)",offset:.7},{transform:"scale(1)"}],{duration:700,easing:"ease-out"});
    an(av.querySelector("b"),[{opacity:0,transform:"translateY(8px)"},{opacity:1,transform:"none"}],{duration:500,delay:300});
    const cr=document.createElement("div"); cr.className="ang-carry"; cr.innerHTML=CROWN_SVG; fly.appendChild(cr);
    place(-140,cy-230,-18); sfx("arrive",-.7);
    await go([{x:cx*.55,y:cy-200,r:-6},{x:cx-6,y:cy-150,r:0}],1600);
    await z(250);
    const r0=cr.getBoundingClientRect(); cr.remove();
    const cw=document.createElement("div"); cw.className="ang-crown"; cw.innerHTML=CROWN_SVG; stage.appendChild(cw);
    const sx=r0.left+r0.width/2, sy=r0.top+r0.height/2, ex=ax, ey=ay-62;
    go([{x:st.x-30,y:st.y-30,r:-6}],700); sfx("crown");
    await an(cw,[{transform:`translate(${sx}px,${sy}px) rotate(0deg)`},{transform:`translate(${sx+(ex-sx)*.35+18}px,${sy+(ey-sy)*.35}px) rotate(10deg)`,offset:.3},{transform:`translate(${sx+(ex-sx)*.7-14}px,${sy+(ey-sy)*.7}px) rotate(-9deg)`,offset:.65},{transform:`translate(${ex}px,${ey+6}px) rotate(3deg)`,offset:.88},{transform:`translate(${ex}px,${ey}px) rotate(-8deg)`}],{duration:1500,easing:"ease-in-out"});
    spk(ex,ey,{n:20,d:110,s:13,g:20,t:1200});
    av.classList.add("glow");
    sfx("fanfare","couronne"); card("Machine de la semaine",`${n} séances la semaine dernière !`,`La couronne te va à merveille, <b>${name}</b>. Tu la gardes toute la semaine.`,"Je la garde !");
    store.set("hmg-crown-week",isoWeek()); try{ applyFeatures(); }catch(e){}
    wink();
    await an(fly.querySelector(".ang-bob"),[{transform:"rotate(0deg)"},{transform:"rotate(22deg) translateY(6px)"},{transform:"rotate(22deg) translateY(6px)",offset:.6},{transform:"rotate(0deg)"}],{duration:1100,easing:"ease-in-out",fill:"none"});
    await wave(); await bye();
  } else {
    place(-130,cy-200,-20); sfx("arrive",-.7);
    await go([{x:cx*.45,y:cy-110,r:-10},{x:cx-72,y:cy+8,r:0}],1500);
    const hx=cx+52, hy=cy+96;
    const hat=document.createElement("div"); hat.className="ang-hat"; hat.innerHTML=HAT_SVG; stage.appendChild(hat); sfx("drop");
    await an(hat,[{transform:`translate(${hx}px,${hy-320}px) rotate(-24deg)`,opacity:0},{transform:`translate(${hx}px,${hy}px) rotate(5deg)`,opacity:1,offset:.68},{transform:`translate(${hx}px,${hy-14}px) rotate(-3deg)`,opacity:1,offset:.84},{transform:`translate(${hx}px,${hy}px) rotate(0deg)`,opacity:1}],{duration:850,easing:"ease-out"});
    await z(200);
    for(let i=0;i<3;i++){ sfx("tap",i); await tap(); spk(hx,hy-34,{n:6+i*3,d:36+i*10,s:8,g:6,t:700});
      an(hat,[{transform:`translate(${hx}px,${hy}px) scale(1)`},{transform:`translate(${hx}px,${hy}px) scale(1.06,.92)`},{transform:`translate(${hx}px,${hy}px) scale(1)`}],{duration:220}); await z(90); }
    await z(150);
    sfx("magic"); spk(hx,hy-40,{n:26,d:140,s:13,g:30,t:1300});
    const med=document.createElement("div"); med.className="ang-med"; med.innerHTML=MEDAL(n); stage.appendChild(med);
    const my=Math.max(150,cy-118);
    await an(med,[{transform:`translate(${hx}px,${hy-30}px) scale(.15) rotateY(0deg)`,opacity:0},{transform:`translate(${(hx+cx)/2+20}px,${my-30}px) scale(.9) rotateY(400deg)`,opacity:1,offset:.55},{transform:`translate(${cx}px,${my-6}px) scale(1.12) rotateY(680deg)`,opacity:1,offset:.82},{transform:`translate(${cx}px,${my}px) scale(1) rotateY(720deg)`,opacity:1}],{duration:1500,easing:"cubic-bezier(.2,.75,.3,1)"});
    med.classList.add("glow"); spk(cx,my,{n:14,d:90,s:11,g:10});
    sfx("fanfare","magie"); card("Tour de magie !",`${n} séances la semaine dernière !`,`Abracadabra, <b>${name}</b> : tu es une vraie machine. Continue comme ça !`,"Merci l'ange !");
    wink(); await wave();
    sfx("poof"); an(hat,[{transform:`translate(${hx}px,${hy}px) scale(1)`,opacity:1},{transform:`translate(${hx}px,${hy}px) scale(1.25)`,opacity:.6,offset:.4},{transform:`translate(${hx}px,${hy}px) scale(0)`,opacity:0}],{duration:500}).then(()=>hat.remove());
    spk(hx,hy-10,{n:12,d:50,s:14,g:-10,cols:["#ffffff","#e8eefc","#c8d4ee"],t:800});
    await bye();
  }
}
let angelChecked=false;
async function angelCheck(){
  if(angelChecked||!featOn("feat_angel")||!LIVE) return; angelChecked=true;
  try{ const r=await rpc("prev_week",{p_voter:voterId}); if(!r||!(r.n>=3)||store.get("hmg-angel-week",null)===r.week) return;
    SND.want=true; if(SND.on()&&!SND.ready()) await SND.gesture(12000);   // le son ne peut démarrer qu'après un toucher
    for(let i=0;i<40&&(document.querySelector(".modal")||!$("intro").classList.contains("out")||!$("sheet").hidden&&sheetMode!=="club");i++) await new Promise(res=>setTimeout(res,500));
    store.set("hmg-angel-week",r.week); playAngel(angelStyle(),r.n);
  }catch(e){}
}

/* ---- message de bienvenue */
function welcome(){
  const it=$("intro"), out=()=>it.classList.add("out"), late=it.classList.contains("out");
  if(late&&!feat("feat_profile")){ store.set("hmg-last-visit",today()); return; }
  if(feat("feat_profile")){ const last=store.get("hmg-last-visit",null); store.set("hmg-last-visit",today()); applyFeatures(); out(); if(!needPseudo()) setTimeout(()=>meGreet(last),700); return; }
  if(!feat("feat_welcome")){ out(); return; }
  const h=new Date().getHours(), last=store.get("hmg-last-visit",null); store.set("hmg-last-visit",today());
  const g=h<5?"Séance de nuit ? Respect.":h<11?"Bien réveillé ? La salle t'attend.":h<14?"La séance du midi t'attend.":h<18?"Bon après-midi, sportif.":h<23?"Bonsoir. L'heure de la séance.":"Séance de nuit ? Respect.";
  const nMine=Object.keys(myVisits).filter(id=>byId[id]).length, c=[];
  if(last){
    $("introT").innerHTML=`Content de te revoir,<br><span class="gr">${esc(myName())}</span>`;
    if(mineOn()&&nMine) c.push(`<b>${nMine}</b> salle${nMine>1?"s":""} visitée${nMine>1?"s":""}`);
    if(ptsOn()&&score.points) c.push(`<b>${score.points}</b> points`);
    if(ptsOn()&&score.streak>=2) c.push(`<b>${score.streak}</b> jours d'affilée`);
    if(!c.length) c.push(`<b>${CLUBS.length}</b> salles à explorer`);
  } else {
    $("introT").innerHTML=`Bienvenue sur<br><span class="gr">HMG Fitness</span>`;
    c.push(`<b>${CLUBS.length}</b> salles`,`Notes sur <b>10</b>`,ptsOn()?`Défis entre <b>sportifs</b>`:`Avis et <b>photos</b>`);
  }
  $("introS").textContent=last?flatter():g; $("introC").innerHTML=c.map(x=>`<span>${x}</span>`).join("");
  it.insertAdjacentHTML("beforeend",`<div class="skip">Touche l'écran pour entrer</div>`);
  it.classList.add("hello"); it.addEventListener("click",out,{once:true}); setTimeout(out,last?1500:1900);
}

/* ---- profil du sportif sur l'écran d'accueil (feat_profile). Le site brosse dans le sens du poil. */
const SEED = Math.random();
const pick = a => a[Math.floor(SEED*a.length)];
const pickR = a => a[Math.floor(Math.random()*a.length)];
const ordFr = n => n===1?"1er":n+"e";
const nSalles = () => Object.keys(isAdmin()?db.visits:myVisits).filter(id=>byId[id]).length;
function level(){ const p=ptsOn()?(score.points||0):nSalles()*10;
  return p>=1000?"Légende HMG":p>=400?"Machine de guerre":p>=150?"Acharné":p>=50?"Régulier":p>=10?"Motivé":"Recrue"; }
function flatter(){
  const s=score, n=nSalles(), po=ptsOn(), h=new Date().getHours();
  if(po&&s.rank_month===1&&s.month) return "Numéro 1 du mois. Les autres te courent après.";
  if(po&&s.streak>=3) return `${s.streak} jours d'affilée. Rien ne t'arrête.`;
  if(po&&s.rank_month&&s.rank_month<=3&&s.month) return `${ordFr(s.rank_month)} du mois. Le podium te va très bien.`;
  if(po&&s.today) return pick(["Séance du jour validée. Tu assures.","Séance validée. Ton corps te dit merci.","Déjà passé à la salle aujourd'hui. Respect."]);
  if(n>=5) return `${n} salles conquises. Une vraie machine.`;
  if(n>=1) return `${n} salle${n>1?"s":""} déjà visitée${n>1?"s":""}. Ça commence fort.`;
  if(po&&s.points) return `${s.points} points au compteur. Continue, champion.`;
  return h<5||h>=23?"Séance de nuit ? Respect total.":h<11?"Prêt à tout casser aujourd'hui ?":h<14?"La séance du midi t'attend, champion.":h<18?"L'après-midi parfait pour pousser lourd.":"Ce soir, on soulève lourd.";
}
function profCard(say){
  const po=ptsOn(), s=score, n=nSalles(), nr=Object.keys(myRated).filter(id=>byId[id]).length;
  const sum=[`<i>${level()}</i>`, po?`${s.points||0} pts`:null, `${n} salle${n>1?"s":""}`].filter(Boolean).join(" · ");
  const st=po?[[s.points||0,"points"],[s.rank_month?ordFr(s.rank_month):"–","ce mois-ci"],[s.streak||0,(s.streak||0)>1?"jours d'affilée":"jour d'affilée",s.streak>=2],[n,n>1?"salles":"salle"]]
             :[[n,n>1?"salles visitées":"salle visitée"],[nr,"avis donnés"]];
  return `<button class="pf-top" data-pf aria-expanded="false"><span class="pf-av">${ic("db")}</span><span class="pf-id"><small>Toi</small><b>${esc(myName())}</b><em>${sum}</em></span><span class="pf-chev">${ic("chev")}</span></button>
    <div class="pf-more"><div>
      ${say?`<p class="pf-say">${flatter()}</p>`:""}
      ${!featOn("feat_profile")?`<div class="msg warn">Masqué au public : toi seul le vois. Active-le dans Admin → Fonctionnalités.</div>`:""}
      <div class="pf-stats${po?"":" n2"}">${st.map(([v,l,hot])=>`<div${hot?' class="hot"':""}><b>${v}</b><small>${l}</small></div>`).join("")}</div>
      ${po?`<button class="cy big-ck${s.today?" done":""}" data-pf-go="ck">${ic(s.today?"check":"bolt")} ${s.today?"Séance du jour validée":"Je suis à la salle · +10 points"}</button>`:""}
      <div class="row2">${po?`<button data-pf-go="rank">${ic("trophy")} Classement</button>`:""}${mineOn()&&!document.body.classList.contains("gm-on")?`<button data-pf-go="mine">${ic("list")} Mes salles</button>`:""}${psOn()?`<button data-pf-go="pseudo">${ic("pen")} ${myPseudo?"Changer de pseudo":"Choisir mon pseudo"}</button>`:""}<button data-acct="save">${ic("shield")} Mon compte</button></div>
    </div></div>`;
}
let introTimer=null, pfMode=null;
function pfOpen(o){ const p=$("pf"); if(!p) return; p.classList.toggle("open",o); p.querySelector("[data-pf]").setAttribute("aria-expanded",String(o)); const h=$("pfHint"); if(h) h.hidden=o; }
function showProfile(mode){
  const it=$("intro"), sk=it.querySelector(".skip"); if(sk) sk.remove(); pfMode=mode;
  $("introT").innerHTML=mode==="new"?`Bienvenue sur<br><span class="gr">HMG Fitness</span>`:mode==="open"?`Ton <span class="gr">profil</span>`:`Content de te revoir !`;
  $("introS").textContent=mode==="new"?"Ta légende commence ici.":flatter();
  const c=$("introC"); c.className="prof";
  c.innerHTML=`<div class="pf glass" id="pf">${profCard()}</div><p class="pf-hint" id="pfHint">Touche ton profil pour le déplier</p><button class="pf-enter" data-enter>Voir la carte</button>`;
  it.classList.add("hello","prof"); it.classList.remove("out"); it.setAttribute("aria-hidden","false");
  clearTimeout(introTimer); if(mode==="open") pfOpen(true); else introTimer=setTimeout(enterMap,mode==="new"?3200:2600);
}
function refreshProfile(){ const p=$("pf"); if(!p||$("intro").classList.contains("out")) return; const o=p.classList.contains("open"); p.innerHTML=profCard(); pfOpen(o); if(pfMode!=="new") $("introS").textContent=flatter(); }
function enterMap(){ clearTimeout(introTimer); const it=$("intro"); it.classList.add("out"); it.setAttribute("aria-hidden","true"); }
$("intro").addEventListener("click",e=>{
  if(!$("intro").classList.contains("prof")) return;
  const t=e.target;
  if(t.closest("[data-pf]")){ clearTimeout(introTimer); pfOpen(!$("pf").classList.contains("open")); return; }
  const g=t.closest("[data-pf-go]");
  if(g){ enterMap(); const k=g.dataset.pfGo; if(k==="ck") doCheckin(); else if(k==="rank") renderRank(); else if(k==="pseudo") pseudoModal(); else { listSort="mine"; openList(); } return; }
  if(t.closest("#pf")){ clearTimeout(introTimer); return; }
  enterMap();
});
document.addEventListener("keydown",e=>{ const it=$("intro"); if(e.key==="Escape"&&it.classList.contains("prof")&&!it.classList.contains("out")) enterMap(); });

/* bonjour sur la carte, sous la pastille du profil (la carte n'attend plus l'écran d'accueil) */
function meGreet(last){
  const chip=$("meChip"); if(chip.hidden||meOpen) return;
  let b=$("meSay"); if(!b){ b=document.createElement("div"); b.id="meSay"; b.className="glass"; document.body.appendChild(b);
    b.addEventListener("click",e=>{ e.stopPropagation(); b.remove(); openMe(); }); }
  b.innerHTML=last?`Content de te revoir, <b>${esc(myName())}</b> !<br>${flatter()}`:`Bienvenue, <b>${esc(myName())}</b> !<br>Ta légende commence ici. Touche ton profil.`;
  const r=chip.getBoundingClientRect(); b.style.top=(r.bottom+8)+"px"; b.style.right=Math.max(8,innerWidth-r.right)+"px";
  setTimeout(()=>{ if(!b.isConnected) return; b.classList.add("out"); setTimeout(()=>b.remove(),450); },5000);
}
/* ---- profil sur la page de la carte : la pastille en haut à droite se déplie */
let meOpen=false;
function placeMeDrop(){ const d=$("meDrop"), r=$("meChip").getBoundingClientRect(), w=d.offsetWidth; d.style.top=(r.bottom+8)+"px"; d.style.left=Math.max(8,Math.min(innerWidth-w-8,r.right-w))+"px"; }
function openMe(){ const sy=$("meSay"); if(sy) sy.remove(); const d=$("meDrop"); d.innerHTML=`<div class="pf open" id="pfMe">${profCard(true)}</div>`; d.querySelector("[data-pf]").setAttribute("aria-expanded","true");
  d.hidden=false; meOpen=true; placeMeDrop(); $("meChip").setAttribute("aria-expanded","true"); }
function closeMe(){ const sy=$("meSay"); if(sy) sy.remove(); if(!meOpen) return; meOpen=false; $("meDrop").hidden=true; $("meChip").setAttribute("aria-expanded","false"); }
$("meChip").addEventListener("click",e=>{ e.stopPropagation(); meOpen?closeMe():openMe(); });
$("meDrop").addEventListener("click",e=>{ e.stopPropagation(); const t=e.target;
  if(t.closest("[data-pf]")){ closeMe(); return; }
  const g=t.closest("[data-pf-go]"); if(g){ closeMe(); const k=g.dataset.pfGo; if(k==="ck") doCheckin(); else if(k==="rank") renderRank(); else if(k==="pseudo") pseudoModal(); else { listSort="mine"; openList(); } } });
document.addEventListener("click",()=>{ if(meOpen) closeMe(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeMe(); });
addEventListener("resize",()=>{ if(meOpen) placeMeDrop(); });
map.on("movestart",()=>{ if(meOpen) closeMe(); });

/* ---- événements des nouveautés */
$("aFeat").addEventListener("click",()=>sheetMode==="feat"?closeSheet():renderFeat());
$("bCheck").addEventListener("click",doCheckin);
$("bRank").addEventListener("click",()=>sheetMode==="rank"?closeSheet():renderRank());
$("sPtsBox").addEventListener("click",()=>renderRank());
$("sPtsBox").addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); renderRank(); } });
document.addEventListener("click",async e=>{
  const t=e.target;
  if(t.closest("[data-checkin]")){ doCheckin(); return; }
  if(t.closest("[data-gm-open]")){ closeSheet(); gmSet(true); return; }
  const at=t.closest("[data-angel-test]"); if(at){ e.preventDefault(); playAngel(at.dataset.angelTest,3,true); return; }
  if(t.closest("[data-rank]")){ renderRank(); return; }
  const pr=t.closest("[data-period]"); if(pr){ rankPeriod=pr.dataset.period; renderRank(rankRows[rankPeriod]===undefined); return; }
  if(t.closest("#fCopy")){ const b=t.closest("#fCopy"); const txt=sqlText||await fetch(SQL_URL,{cache:"no-store"}).then(r=>r.text()).catch(()=>"");
    try{ await navigator.clipboard.writeText(txt); b.textContent="Copié ✓"; toast("Script copié. Colle-le dans Supabase → SQL Editor → New query, puis Run."); }
    catch(err){ window.open(SQL_URL,"_blank"); toast("Le script s'ouvre dans un onglet : sélectionne tout, copie, puis colle-le dans Supabase.",1); } return; }
  if(t.closest("#fGeo")){ const b=t.closest("#fGeo"); b.disabled=true; b.textContent="Calcul des positions…";
    try{ await geocodeMissing(); const n=await saveGeo(); toast(n?`${n} positions enregistrées.`:"Aucune nouvelle position trouvée."); }catch(err){ toast(err.message,1); }
    renderFeat(); return; }
});
document.addEventListener("change",async e=>{
  if(e.target.matches&&e.target.matches("[data-angel-style]")){ const v=e.target.value; try{ await setFeature("angel_style",v); toast("Animation de l'ange : "+ANGEL_STYLES.find(a=>a.k===v).t+"."); }catch(err){ toast(err.message,1); } if(sheetMode==="feat") renderFeat(); return; }
  const k=e.target.dataset&&e.target.dataset.feat; if(!k) return;
  const on=e.target.checked;
  try{ await setFeature(k,on); toast(on?"Activé : tout le monde le voit maintenant.":"Masqué au public. Toi, tu le vois toujours.");
    updateHeader(); applyFeatures(); refreshMarkers(); if(sheetMode==="feat") renderFeat(); }
  catch(err){ e.target.checked=!on; toast(err.message,1); }
});
function renderMod(){
  sheetMode="mod",gmKeep(); const sh=$("sheet"); sh.hidden=false; sh.classList.add("big");
  const pend=db.photos.filter(p=>!p.approved), pendR=db.reviews.filter(r=>r.hidden), last=db.reviews.filter(r=>!r.hidden).slice(0,150);
  const revRow=r=>`<div class="rev${r.hidden?" hid":""}" style="opacity:1"><div class="n">${r.rating}</div><div class="t"><b data-open="${r.club_id}" style="cursor:pointer">${esc(byId[r.club_id]?.n||r.club_id)}</b> · ${r.comment?esc(r.comment):"<i>sans commentaire</i>"}</div><div class="d">${whoHtml(r)} · ${frDateTime(r.created_at)}${VOTES&&r.comment&&!r.hidden?` · <span style="color:var(--done)">${r.up||0} d'accord</span> · <span style="color:var(--danger)">${r.down||0} pas d'accord</span>`:""}</div><div class="adm"><button class="mini${r.hidden?" cy":""}" data-hide="${r.id}">${r.hidden?"Publier":"Masquer"}</button><button class="mini danger" data-delrev="${r.id}">Suppr.</button></div></div>`;
  sh.innerHTML=`<div class="sh-head cc-head"><div class="cc-logo" aria-hidden="true">${ic("shield")}</div><div class="cc-t"><small>HMG · Espace admin</small><h2>Modération</h2></div><button class="x" data-close aria-label="Fermer">${ic("x")}</button></div><div class="sh-body">
   <div class="grp">Photos à valider (${pend.length})</div>
   ${pend.length?`<div class="gal">${pend.map(p=>`<figure data-img="${p.id}"><img src="${esc(photoUrl(p))}" alt="" loading="lazy"><span class="tag p">${esc(byId[p.club_id]?.n||p.club_id)}</span><div class="adm"><button class="mini" data-approve="${p.id}">Valider</button><button class="mini danger" data-delph="${p.id}">Suppr.</button></div></figure>`).join("")}</div>`:`<div class="empty">Rien à valider.</div>`}
   <div class="grp">Commentaires à valider (${pendR.length})</div>
   ${pendR.map(revRow).join("")||'<div class="empty">Rien à valider.</div>'}
   <div class="grp">Avis publiés (${db.reviews.length-pendR.length})</div>
   ${last.map(revRow).join("")||'<div class="empty">Aucun avis.</div>'}
  </div>`;
}
function renderVisits(){
  sheetMode="visits",gmKeep(); const sh=$("sheet"); sh.hidden=false; sh.classList.add("big");
  const ids=Object.keys(db.visits).filter(id=>byId[id]).sort((a,b)=>(db.visits[b].d||"").localeCompare(db.visits[a].d||""));
  const local=migrateOldVisits(), toImport=Object.keys(local).filter(k=>!db.visits[k]);
  sh.innerHTML=`<div class="sh-head cc-head"><div class="cc-logo" aria-hidden="true">${ic("check")}</div><div class="cc-t"><small>Ma tournée des salles</small><h2>Mes visites · ${ids.length} / ${CLUBS.length}</h2></div><button class="x" data-close aria-label="Fermer">${ic("x")}</button></div><div class="sh-body">
    <div class="bar" style="margin-bottom:14px"><i style="width:${100*ids.length/CLUBS.length}%"></i></div>
    ${LIVE&&toImport.length?`<div class="form"><p style="margin:0;font-size:13px">Cet appareil contient ${toImport.length} visite(s) de l'ancienne carte.</p><button class="cy" id="vImport">Les importer</button></div>`:""}
    ${ids.length?ids.map(id=>`<div class="item" data-open="${id}"><span class="dot done"></span><b>${esc(byId[id].n)}</b><span>${frDate(db.visits[id].d)}${db.visits[id].n?" · "+esc(db.visits[id].n):""}</span><em></em></div>`).join(""):`<div class="empty">Aucune visite. Ouvre une salle sur la carte et clique sur « Marquer comme visitée ».</div>`}
  </div>`;
  const b=$("vImport"); if(b) b.addEventListener("click",async()=>{ b.disabled=true; try{ await api("/rest/v1/visits",{method:"POST",body:toImport.map(k=>({club_id:k,visited_on:local[k].d,note:local[k].n||null})),prefer:"resolution=merge-duplicates,return=minimal"}); toImport.forEach(k=>db.visits[k]=local[k]); refreshMarkers(); updateHeader(); renderVisits(); toast("Visites importées."); }catch(e){ b.disabled=false; toast(e.message,1); } });
}
async function saveVisit(id,val){
  try{
    if(val){ if(LIVE) await api("/rest/v1/visits",{method:"POST",body:{club_id:id,visited_on:val.d,note:val.n||null},prefer:"resolution=merge-duplicates,return=minimal"}); db.visits[id]=val; }
    else { if(LIVE) await api("/rest/v1/visits?club_id=eq."+encodeURIComponent(id),{method:"DELETE"}); delete db.visits[id]; }
    if(!LIVE) demo.set("visits",db.visits);
    drawMarker(byId[id]); updateHeader(); if(routeLine) drawRoute(true);
    if(sheetMode==="club") renderClub();
  }catch(e){ toast(e.message,1); }
}
/* tournée depuis le départ : plus proche voisin + 2-opt */
function drawRoute(keep){
  if(routeLine&&!keep){ map.removeLayer(routeLine); routeLine=null; $("aRoute").classList.remove("on"); return; }
  if(routeLine) map.removeLayer(routeLine);
  const S={lat:CONFIG.start.lat,lon:CONFIG.start.lon}, pts=CLUBS.filter(c=>!isDom(c)&&!c.s&&!db.visits[c.id]&&pos(c)), P=[S,...pts.map(pos)], n=P.length;
  const dd=(a,b)=>{const R=6371,t=Math.PI/180,dl=(b.lat-a.lat)*t,dn=(b.lon-a.lon)*t;const h=Math.sin(dl/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
  const D=[];for(let i=0;i<n;i++){D[i]=new Float64Array(n);for(let j=0;j<n;j++)D[i][j]=dd(P[i],P[j]);}
  const used=new Uint8Array(n);used[0]=1;const r=[0];
  for(let k=1;k<n;k++){const l=r[r.length-1];let b=-1,bd=1e9;for(let j=1;j<n;j++)if(!used[j]&&D[l][j]<bd){bd=D[l][j];b=j}used[b]=1;r.push(b)}
  let imp=true,g=0; while(imp&&g++<60){imp=false;for(let i=1;i<n-1;i++)for(let k=i+1;k<n;k++){const a=r[i-1],b=r[i],c=r[k],d=k+1<n?r[k+1]:-1;if(D[a][c]+(d>=0?D[b][d]:0)<D[a][b]+(d>=0?D[c][d]:0)-1e-9){let lo=i,hi=k;while(lo<hi){const t=r[lo];r[lo]=r[hi];r[hi]=t;lo++;hi--}imp=true}}}
  let km=0;for(let i=1;i<n;i++)km+=D[r[i-1]][r[i]];
  routeLine=L.polyline(r.map(i=>[P[i].lat,P[i].lon]),{color:MAPC,weight:1.6,opacity:.6,dashArray:"4 6",interactive:false}).addTo(map);
  $("aRoute").classList.add("on"); if(!keep) toast(`Tournée : ${n-1} salles restantes, environ ${Math.round(km).toLocaleString("fr-FR")} km à vol d'oiseau.`);
}
$("aRoute").addEventListener("click",()=>drawRoute(false));
$("aMod").addEventListener("click",renderMod);
$("aVisits").addEventListener("click",renderVisits);

/* ================= ÉVÉNEMENTS ================ */
document.addEventListener("click",async e=>{
  const t=e.target;
  if(t.closest("[data-close]")){ closeSheet(); return; }
  const op=t.closest("[data-open]"); if(op&&!t.closest("button:not([data-open])")){ $("sugg").hidden=true; openClub(op.dataset.open,true); return; }
  const tb=t.closest("[data-tab]"); if(tb){ clubTab=tb.dataset.tab; renderClub(); return; }
  const rt=t.closest("[data-rate]"); if(rt){ draftRating=+rt.dataset.rate; document.querySelectorAll("[data-rate]").forEach(b=>{const n=+b.dataset.rate; b.className=n===draftRating?"sel":n<draftRating?"lit":""; b.setAttribute("aria-checked",n===draftRating);}); $("rSend").disabled=false; return; }
  const mb=t.closest("[data-mine]"); if(mb){ toggleMine(mb.dataset.mine); return; }
  const vb=t.closest("[data-vote]"); if(vb){ vote(vb.dataset.vote,+vb.dataset.v); return; }
  if(t.closest("#rSend")){ sendReview(); return; }
  if(t.closest("[data-checkin-here]")){ if(!score.today) doCheckin(); else renderRank(); return; }
  if(t.closest("[data-pseudo]")){ e.preventDefault(); pseudoModal(); return; }
  const hd=t.closest("[data-hide]"); if(hd){ const r=db.reviews.find(x=>x.id===hd.dataset.hide); if(!r) return; try{ if(LIVE) await api("/rest/v1/reviews?id=eq."+r.id,{method:"PATCH",body:{hidden:!r.hidden},prefer:"return=minimal"}); r.hidden=!r.hidden; if(!LIVE) demo.set("reviews",db.reviews); afterMod(r.club_id);}catch(err){toast(err.message,1)} return; }
  const dr=t.closest("[data-delrev]"); if(dr){ if(dr.dataset.sure!=="1"){ dr.dataset.sure="1"; dr.textContent="Sûr ?"; return; } const r=db.reviews.find(x=>x.id===dr.dataset.delrev); try{ if(LIVE) await api("/rest/v1/reviews?id=eq."+r.id,{method:"DELETE"}); db.reviews=db.reviews.filter(x=>x!==r); if(!LIVE) demo.set("reviews",db.reviews); afterMod(r.club_id);}catch(err){toast(err.message,1)} return; }
  const ap=t.closest("[data-approve]"); if(ap){ const p=db.photos.find(x=>x.id===ap.dataset.approve); try{ if(LIVE) await api("/rest/v1/photos?id=eq."+p.id,{method:"PATCH",body:{approved:true},prefer:"return=minimal"}); p.approved=true; afterMod(p.club_id);}catch(err){toast(err.message,1)} return; }
  const dp=t.closest("[data-delph]"); if(dp){ if(dp.dataset.sure!=="1"){ dp.dataset.sure="1"; dp.textContent="Sûr ?"; return; } const p=db.photos.find(x=>x.id===dp.dataset.delph); try{ if(LIVE){ await api("/rest/v1/photos?id=eq."+p.id,{method:"DELETE"}); await api("/storage/v1/object/photos/"+p.path,{method:"DELETE"}).catch(()=>{}); } db.photos=db.photos.filter(x=>x!==p); if(!LIVE) demo.set("photos",db.photos); afterMod(p.club_id);}catch(err){toast(err.message,1)} return; }
  const im=t.closest("[data-img]"); if(im&&!t.closest("button")){ const p=db.photos.find(x=>x.id===im.dataset.img); if(!p) return; const m=document.createElement("div"); m.className="modal"; m.innerHTML=`<img src="${esc(photoUrl(p))}" alt="">`; m.addEventListener("click",()=>m.remove()); document.body.appendChild(m); return; }
  if(t.closest("#vAdd")){ saveVisit(selected,{d:today(),n:""}); return; }
  if(t.closest("#vSave")){ saveVisit(selected,{d:$("vDate").value||today(),n:$("vNote").value.trim()}); toast("Visite enregistrée."); return; }
  if(t.closest("#vDel")){ saveVisit(selected,null); return; }
});
function afterMod(cid){ computeStats(); if(byId[cid]) drawMarker(byId[cid]); updateHeader(); if(sheetMode==="mod") renderMod(); else if(sheetMode==="club") renderClub(); }
document.addEventListener("input",e=>{ if(e.target.id==="rText"){ const n=words(e.target.value); const el=$("rCount"); el.textContent=n+" / 15 mots"; el.className=n>15?"bad":""; $("rSend").disabled=!draftRating||n>15; } });
document.addEventListener("change",e=>{ if(e.target.id==="pFile"){ sendPhoto(e.target.files[0]); e.target.value=""; } });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ const m=document.querySelector(".modal"); if(m) m.remove(); else if(!$("sheet").hidden) closeSheet(); } });
$("bZin").addEventListener("click",()=>map.zoomIn());
$("bZout").addEventListener("click",()=>map.zoomOut());
$("bHome").addEventListener("click",()=>fitFrance(true));
$("bTiles").addEventListener("click",()=>{ setTiles(!tilesOn); store.set("hmg-tiles",tilesOn); });
$("bList").addEventListener("click",()=>sheetMode==="list"?closeSheet():openList());
map.on("click",()=>{ if(sheetMode==="club") closeSheet(); });

/* ================= MON COMPTE : le retrouver sur un autre navigateur ou un autre téléphone =================
   Le compte d'un sportif, c'est sa clé secrète (voterId, 32 caractères) gardée dans le navigateur. Chaque navigateur a la sienne :
   d'où un « nouveau compte » quand on passe de Chrome à Safari. On peut maintenant l'emporter :
   - un lien secret (hmgfitness.fr/#compte=…) qui transporte la clé, le héros, sa tenue et « Mes salles » ;
   - ou un code de 28 caractères (la clé en base 32 + le héros et sa peau + 1 caractère de contrôle) à recopier, par exemple pour la future appli.
     Les anciens codes de 27 caractères (sans le héros) restent acceptés.
   Le serveur garde déjà tout ce qui compte (séances, points, pseudo) sous cette clé : rien à changer dans la base.
   La collection de l'aventure se reconstruit à l'identique (tirages déterministes à partir de la clé). */
const ACB32="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/* héros + peau dans le code : liste à ne jamais réordonner (on ajoute seulement à la fin), sinon les anciens codes changent de héros */
const acctHeroes=()=>typeof GM_HEROES==="undefined"?[]:[...GM_HEROES.map(h=>h.k),...Object.keys(GM_LG)].flatMap(h=>["clair","fonce"].map(t=>[h,t]));
const acctHeroIdx=(eq)=>{ if(!eq||!eq.hero) return 0; const i=acctHeroes().findIndex(([h,t])=>h===eq.hero&&t===(eq.tone||"clair")); return i<0||i>30?0:i+1; };
function acctCode(hex,hi){ let bits=""; for(const c of hex) bits+=parseInt(c,16).toString(2).padStart(4,"0"); bits+="00";
  let s=""; for(let i=0;i<130;i+=5) s+=ACB32[parseInt(bits.slice(i,i+5),2)];
  if(hi!==undefined) s+=ACB32[hi||0];
  let ck=7; for(const c of s) ck=(ck*33+ACB32.indexOf(c))%32; return s+ACB32[ck]; }
const acctMyCode=()=>acctCode(voterId,acctHeroIdx(typeof gmS!=="undefined"?gmS.eq:null));
const acctFmt=c=>c.match(c.length===28?/.{1,7}/g:/.{1,9}/g).join(" ");
function acctDecode(txt){ const s=String(txt||"").toUpperCase().replace(/[IL]/g,"1").replace(/O/g,"0").replace(/U/g,"V").replace(/[^0-9A-Z]/g,"");
  if(s.length!==27&&s.length!==28) return null; const n=s.length-1; let ck=7; for(const c of s.slice(0,n)){ const i=ACB32.indexOf(c); if(i<0) return null; ck=(ck*33+i)%32; }
  if(ACB32[ck]!==s[n]) return null; let bits=""; for(const c of s.slice(0,26)) bits+=ACB32.indexOf(c).toString(2).padStart(5,"0");
  let hex=""; for(let i=0;i<128;i+=4) hex+=parseInt(bits.slice(i,i+4),2).toString(16);
  const hi=n===27?ACB32.indexOf(s[26]):0, h=hi?acctHeroes()[hi-1]:null; return {v:hex,h:h||null}; }
const acctB64=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const acctUnB64=s=>{ try{ return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/"))))); }catch(e){ return null; } };
function acctLink(){ const g=typeof gmS!=="undefined"?gmS.eq:{}, e={}; for(const k in g) if(g[k]) e[k]=g[k];
  const p={v:voterId}; if(e.hero) p.g=e; const m=Object.keys(myVisits||{}); if(m.length) p.m=m; return location.origin+location.pathname+"#compte="+acctB64(p); }
/* ce que contient un lien ou un code collé */
function acctParse(txt){ const t=String(txt||"").trim(), h=t.match(/#compte=([A-Za-z0-9_-]+)/)||t.match(/^compte=([A-Za-z0-9_-]+)$/);
  if(h){ const p=acctUnB64(h[1]); return p&&/^[0-9a-f]{32}$/.test(p.v||"")?p:null; }
  const r=acctDecode(t); if(!r) return null; const p={v:r.v}; if(r.h) p.g={hero:r.h[0],tone:r.h[1]}; return p; }
async function acctPeek(v){ if(!LIVE) return null; try{ return await rpc("my_score",{p_voter:v}); }catch(e){ return null; } }
function acctModalEl(){ let m=$("acctModal"); if(!m){ m=document.createElement("div"); m.className="modal acct-m"; m.id="acctModal"; document.body.appendChild(m);
    m.addEventListener("click",e=>{ if(e.target===m||e.target.closest("[data-acct-x]")) m.remove(); }); } return m; }
/* la fenêtre « Mon compte » : sauvegarder (code + lien) ou retrouver un compte */
function acctModal(mode){
  const m=acctModalEl(), code=acctMyCode(), d=score.days||0;
  m.innerHTML=`<div class="card glass acct" role="dialog" aria-label="Mon compte HMG"><button class="x" data-acct-x aria-label="Fermer">${ic("x")}</button>
    <div class="acct-tabs" role="tablist"><button role="tab" data-acct-tab="save" aria-selected="${mode!=="restore"}">Mon compte</button><button role="tab" data-acct-tab="restore" aria-selected="${mode==="restore"}">J'ai déjà un compte</button></div>
    ${mode!=="restore"?`<div class="acct-ico">${ic("shield")}</div><h2>Emporte ton compte partout</h2>
    <p>Tes séances, tes points${psOn()?", ton pseudo":""} et ton héros sont liés à <b>ce navigateur</b>. Pour les retrouver dans un autre navigateur ou sur un autre téléphone, garde ton code secret.</p>
    <div class="acct-who"><b>${esc(myName())}</b><span>${d} séance${d>1?"s":""} · ${score.points||0} points</span></div>
    <div class="acct-code" aria-label="Ton code secret">${acctFmt(code).split(" ").map(g=>`<span>${g}</span>`).join(" ")}</div>
    <div class="acct-row"><button class="cy" data-acct-do="link">${ic("ext")} Envoyer mon lien</button><button data-acct-do="copy">${ic("check")} Copier le code</button></div>
    <p class="acct-tip">Le plus simple : <b>Envoyer mon lien</b> (à toi-même, ou dans tes notes), puis ouvre-le dans l'autre navigateur. Ton compte arrive tout seul.</p>
    <p class="acct-warn">Ne le donne à personne : c'est la clé de ton compte.</p>`
    :`<div class="acct-ico">${ic("loc")}</div><h2>Retrouve ton compte</h2>
    <p>Sur ton autre navigateur, ouvre ton profil puis <b>Mon compte</b>, et envoie-toi le lien. Tu peux aussi coller ici ton lien ou ton code secret.</p>
    <form id="acctForm" class="acct-form" autocomplete="off"><textarea id="acctIn" rows="2" placeholder="Colle ton lien ou ton code (28 caractères)" aria-label="Ton lien ou ton code" autocapitalize="characters" spellcheck="false"></textarea>
      <div id="acctMsg" class="acct-msg" aria-live="polite"></div><button class="cy" type="submit">Retrouver mon compte</button></form>
    ${d?`<p class="acct-warn">Ce navigateur a déjà ${d} séance${d>1?"s":""} sous ${esc(myName())} : elles resteront sur l'autre compte.</p>`:""}`}
  </div>`;
  const f=$("acctForm"); if(f) f.addEventListener("submit",async e=>{ e.preventDefault(); const p=acctParse($("acctIn").value), msg=$("acctMsg");
    if(!p){ msg.textContent="Ce n'est pas un lien ou un code HMG valide. Vérifie qu'il est complet."; msg.className="acct-msg ko"; return; }
    if(p.v===voterId){ msg.textContent="C'est déjà le compte de ce navigateur."; msg.className="acct-msg ok"; return; }
    msg.textContent="Je cherche ton compte…"; msg.className="acct-msg"; const s=await acctPeek(p.v);
    if(s&&!s.no&&!s.days){ msg.textContent="Aucun compte trouvé avec ce code."; msg.className="acct-msg ko"; return; }
    acctAdopt(p,s); });
}
/* adopter le compte : clé, numéro, score, héros et « Mes salles », puis on recharge proprement (sans le lien dans l'adresse) */
function acctAdopt(p,s){
  if(voterId) store.set("hmg-voter-old",voterId);
  store.set("hmg-voter",p.v); if(s&&s.no) store.set("hmg-visitor",s.no);
  store.set("hmg-pseudo",null); store.set("hmg-pseudo-later",true); store.set("hmg-score",s?{...s,day:today()}:{});
  const eq=p.g&&typeof p.g==="object"?p.g:{}; store.set("hmg-game",{seen:null,open:[],items:[],stars:0,leg:{},eq,rebuild:1});
  if(Array.isArray(p.m)){ const mv={...myVisits}; p.m.forEach(id=>{ if(byId[id]&&!mv[id]) mv[id]=today(); }); store.set("hmg-my-visits",mv); }
  store.set("hmg-acct-welcome",true); setTimeout(()=>location.replace(location.pathname+location.search),150);
}
/* ouverture d'un lien « #compte=… » : on montre de qui il s'agit avant de basculer */
async function acctFromHash(){
  const p=acctParse(location.hash); history.replaceState(null,"",location.pathname+location.search); if(!p) return;
  if(p.v===voterId){ toast("Tu es déjà sur ton compte."); return; }
  const m=acctModalEl(); m.innerHTML=`<div class="card glass acct"><div class="acct-ico">${ic("loc")}</div><h2>Je retrouve ton compte…</h2></div>`;
  const s=await acctPeek(p.v); if(s&&!s.no&&!s.days){ m.innerHTML=`<div class="card glass acct"><button class="x" data-acct-x aria-label="Fermer">${ic("x")}</button><div class="acct-ico">${ic("x")}</div><h2>Compte introuvable</h2><p>Ce lien ne correspond à aucun compte HMG.</p><button class="cy" data-acct-x>OK</button></div>`; return; }
  const nm=s&&s.no?(PSEUDOS[s.no]||"Machine "+s.no):"", d=s?s.days||0:0, here=score.days||0;
  const info=[s?d+" séance"+(d>1?"s":""):"", s&&s.points?s.points+" points":"", p.g&&p.g.hero?"ton héros t'attend":""].filter(Boolean).join(" · ");
  m.innerHTML=`<div class="card glass acct"><button class="x" data-acct-x aria-label="Fermer">${ic("x")}</button><div class="acct-ico ok">${ic("check")}</div>
    <h2>Content de te revoir${nm?`, <span class="gr">${esc(nm)}</span>`:""} !</h2><p>${info?info+". ":""}Ce navigateur va utiliser ce compte.</p>
    ${here?`<p class="acct-warn">Les ${here} séance${here>1?"s":""} faites ici sous ${esc(myName())} restent sur l'autre compte.</p>`:""}
    <div class="acct-row"><button data-acct-x>Annuler</button><button class="cy" id="acctGo">C'est moi</button></div></div>`;
  $("acctGo").addEventListener("click",()=>acctAdopt(p,s));
}
document.addEventListener("click",async e=>{ const t=e.target;
  const o=t.closest&&t.closest("[data-acct]"); if(o){ e.preventDefault(); e.stopPropagation(); if(typeof closeMe==="function") closeMe(); acctModal(o.dataset.acct); return; }
  const tb=t.closest&&t.closest("[data-acct-tab]"); if(tb){ acctModal(tb.dataset.acctTab); return; }
  const a=t.closest&&t.closest("[data-acct-do]"); if(!a) return; const k=a.dataset.acctDo;
  if(k==="copy"){ try{ await navigator.clipboard.writeText(acctFmt(acctMyCode())); a.innerHTML=ic("check")+" Code copié"; }catch(err){ toast("Recopie ton code à la main, ou utilise « Envoyer mon lien ».",1); } }
  if(k==="link"){ const url=acctLink();
    if(navigator.share){ try{ await navigator.share({title:"Mon compte HMG",text:"Mon lien secret HMG Fitness : ouvre-le dans ton autre navigateur pour retrouver ton compte. Ne le partage avec personne.",url}); return; }catch(err){ if(err&&err.name==="AbortError") return; } }
    try{ await navigator.clipboard.writeText(url); a.innerHTML=ic("check")+" Lien copié"; toast("Lien copié : colle-le dans ton autre navigateur."); }catch(err){ prompt("Copie ton lien :",url); } }
}, true);


/* ================= AVENTURE HMG (feat_game) =================
   Chaque séance validée (« Je suis à la salle », vérifiée par le serveur) fait avancer le petit héros d'un pas.
   Tous les 3 pas un coffre, au bout de chaque monde (10 pas) un grand coffre. La progression vient uniquement du
   nombre de séances renvoyé par my_score (score.days) : rien à tricher, rien de plus à stocker en base.
   La collection (coffres ouverts, objets, tenue portée) reste sur l'appareil, comme les points. */
const GM_PER=10, GM_STEP=118, GM_PADT=330, GM_PADB=250;
const GM_W=[
  {k:"plaine", n:"Plaine Néon",          d:"Là où tout commence",            c:["#0b2b2a","#04120e"], wc:"#2bffa0", mon:[["msm",.42,-100]]},
  {k:"cite",   n:"Paris Néon",           d:"La ville lumière, version muscle", c:["#2a0a2c","#0b0414"], wc:"#ff4fd8", mon:[["sacre",.1,110],["eiffel",.36,-95],["louvre",.62,95],["arc",.88,-100]]},
  {k:"desert", n:"Désert des Haltères",  d:"Le sable ne fait pas peur aux machines", c:["#3a1a0c","#1a0b06"], wc:"#ffb547", mon:[["gard",.55,110]]},
  {k:"glacier",n:"Glacier du Mont-Blanc", d:"La récup' à -30 °C",             c:["#0a2238","#050e1c"], wc:"#7fe3ff", mon:[["blanc",.32,-60]]},
  {k:"jungle", n:"Jungle Protéine",      d:"Ça pousse, comme tes muscles",    c:["#1d0f33","#0a0718"], wc:"#c77dff"},
  {k:"volcan", n:"Volcans d'Auvergne",   d:"Là où l'on forge les légendes",   c:["#3a0c06","#140303"], wc:"#ff5a36", mon:[["puy",.55,100]]},
  {k:"cosmos", n:"Station Orbitale",     d:"Au-delà de tes limites",          c:["#0b0a2a","#020208"], wc:"#c8ff1e", mon:[["ariane",.45,-110]]}];
const GM_RAR={C:{t:"Commun",c:"#c9d3e6"},R:{t:"Rare",c:"#3fd8ff"},E:{t:"Épique",c:"#c77dff"},L:{t:"Légendaire",c:"#ffd166"}};
const GM_CATS=[["skin","Hauts"],["legs","Bas"],["feet","Chaussures"],["hat","Sur la tête"],["neck","Au cou"],["face","Lunettes"],["back","Dans le dos"],["hand","En main"],["aura","Auras"]];
const GM_ITEMS=[
  {id:"blanc",cat:"skin",n:"T-shirt blanc",r:"C",say:"Enfin un t-shirt ! Ton héros a déjà moins froid."},{id:"volt",cat:"skin",n:"T-shirt Volt",r:"R"},{id:"braise",cat:"skin",n:"T-shirt Braise",r:"R"},{id:"ocean",cat:"skin",n:"T-shirt Océan",r:"R"},
  {id:"chrome",cat:"skin",n:"T-shirt Chrome noir",r:"E"},{id:"or",cat:"skin",n:"T-shirt Or massif",r:"L"},{id:"galaxie",cat:"skin",n:"T-shirt Galaxie",r:"L"},
  {id:"short_noir",cat:"legs",n:"Short noir",r:"C",say:"Adieu le caleçon, bonjour le short !"},{id:"jogging",cat:"legs",n:"Jogging gris",r:"C"},{id:"short_volt",cat:"legs",n:"Short Volt",r:"R"},{id:"legging",cat:"legs",n:"Legging néon",r:"E"},{id:"short_or",cat:"legs",n:"Short doré",r:"L"},
  {id:"baskets",cat:"feet",n:"Baskets HMG",r:"C",hmg:1,say:"Des baskets ! Fini de marcher pieds nus."},{id:"baskets_bl",cat:"feet",n:"Baskets blanches",r:"C"},{id:"baskets_volt",cat:"feet",n:"Baskets Volt",r:"R"},{id:"montantes",cat:"feet",n:"Baskets montantes",r:"E"},{id:"baskets_or",cat:"feet",n:"Baskets dorées",r:"L"},
  {id:"bandeau",cat:"hat",n:"Bandeau",r:"C"},{id:"casquette",cat:"hat",n:"Casquette",r:"C"},{id:"bonnet",cat:"hat",n:"Bonnet",r:"C"},{id:"casque",cat:"hat",n:"Casque audio",r:"R"},
  {id:"bonnet_hmg",cat:"hat",n:"Bonnet HMG",r:"R",hmg:1},{id:"bonnet_volt",cat:"hat",n:"Bonnet HMG Volt",r:"E",hmg:1},
  {id:"echarpe_hmg",cat:"neck",n:"Écharpe HMG",r:"R",hmg:1},{id:"echarpe_or",cat:"neck",n:"Écharpe HMG dorée",r:"L",hmg:1},
  {id:"crete",cat:"hat",n:"Crête punk",r:"E"},{id:"aureole",cat:"hat",n:"Auréole",r:"E"},{id:"couronne",cat:"hat",n:"Couronne",r:"L"},
  {id:"soleil",cat:"face",n:"Lunettes de soleil",r:"C"},{id:"cyber",cat:"face",n:"Visière cyber",r:"R"},{id:"coeur",cat:"face",n:"Lunettes cœur",r:"E"},
  {id:"sac",cat:"back",n:"Sac de sport",r:"C"},{id:"cape",cat:"back",n:"Cape de héros",r:"R"},{id:"ailes",cat:"back",n:"Ailes d'ange",r:"E"},{id:"jetpack",cat:"back",n:"Jetpack",r:"L"},
  {id:"haltere",cat:"hand",n:"Haltère",r:"C",say:"Ton tout premier haltère ! Maintenant, il faut l'habiller…"},{id:"kettle",cat:"hand",n:"Kettlebell",r:"C"},{id:"shaker",cat:"hand",n:"Shaker protéiné",r:"C"},{id:"haltereor",cat:"hand",n:"Haltère d'or",r:"L"},
  {id:"etincelles",cat:"aura",n:"Étincelles",r:"R"},{id:"flammes",cat:"aura",n:"Aura de feu",r:"E"},{id:"eclairs",cat:"aura",n:"Éclairs Volt",r:"L"}];
const GM_IT=Object.fromEntries(GM_ITEMS.map(i=>[i.id,i]));
const GM_TOTAL=GM_ITEMS.length;
/* le héros démarre en caleçon : les premiers coffres l'habillent (haltère, t-shirt, short, baskets), ensuite c'est le hasard */
const GM_START={0:"haltere",3:"blanc",6:"short_noir",13:"baskets"};
/* Légendes : débloquées dans les grands coffres à 20, 40, 60 et 80 séances. Chacune a un pouvoir, actif dès qu'on l'a. */
const GM_LEG=[
  {k:"l_masse",n:"Le Roi de la Masse",s:"Huit fois couronné, une montagne de muscles",pw:"Force brute",pd:"Tous tes coffres montent d'un cran de rareté.",base:"homme",tone:"fonce",hair:"chauve",beard:1,wide:1.42,skin:"braise",legs:"short_noir"},
  {k:"l_classique",n:"Le Prince du Classique",s:"Les plus belles poses de la planète",pw:"Pose classique",pd:"Chaque grand coffre te donne 2 objets.",base:"homme",tone:"bronze",hair:"court",beard:1,wide:1.26,skin:"or",legs:"short_or",aura:"etincelles"},
  {k:"l_coach",n:"Le Coach du Peuple",s:"Il motive la France entière",pw:"Motivation",pd:"Un coffre bonus au 5e pas de chaque monde.",base:"homme",tone:"clair",hair:"court",beard:1,wide:1.14,skin:"ocean",legs:"short_volt",hat:"bandeau"},
  {k:"l_reine",n:"La Reine du Fitness",s:"Personne ne lui résiste",pw:"Œil de reine",pd:"Tu vois la rareté du prochain coffre avant de l'ouvrir.",base:"femme",tone:"clair",hair:"blond",wide:1,skin:"galaxie",legs:"legging",hat:"couronne",aura:"etincelles"}];
const GM_LG=Object.fromEntries(GM_LEG.map(l=>[l.k,l]));
const GM_HEROES=[{k:"homme",n:"Lui",s:"Le sportif"},{k:"femme",n:"Elle",s:"La sportive"},{k:"robot",n:"Mini-Machine",s:"Le robot HMG"}];
const GM_SKIN={blanc:["#ffffff","#e2e8f4","#a7b3ca"],volt:["#f2ffbf","#c8ff1e","#7fae00"],braise:["#ffd0b5","#ff7a3d","#c2410c"],ocean:["#d2f6ff","#3fd8ff","#1479a8"],
  chrome:["#646d83","#2a3142","#0e121b"],or:["#fff4b8","#ffd166","#c48a00"],galaxie:["#dcc2ff","#7b5cff","#2a1670"]};
const GM_TONE={human:{clair:{s:"#ffd8bf",d:"#e9ab84",h:"#4a2e1c"},fonce:{s:"#8d5838",d:"#663a22",h:"#15100d"}},robot:{clair:{s:"#f2f5fc",d:"#b5c0d5",h:"#8792aa"},fonce:{s:"#30374a",d:"#161a26",h:"#0c0f16"}}};
const gmS=Object.assign({seen:null,open:[],items:[],stars:0,eq:{},leg:{}},store.get("hmg-game",{}));
const GM_EQ0={hero:null,tone:"clair",skin:null,legs:null,feet:null,hat:null,neck:null,face:null,back:null,hand:null,aura:null};
gmS.eq=Object.assign({...GM_EQ0},gmS.eq||{});
if(!gmS.leg||typeof gmS.leg!=="object") gmS.leg={};
const gmLegOn=(k,n)=>gmS.leg[k]!=null&&(n==null||n>gmS.leg[k]);
const gmSave=()=>store.set("hmg-game",gmS);
const gmOwn=id=>!!(GM_IT[id]&&(GM_IT[id].def||gmS.items.includes(id)));
GM_CATS.forEach(([c])=>{ if(gmS.eq[c]&&!gmOwn(gmS.eq[c])) gmS.eq[c]=null; });
const gmTest=()=>isAdmin()?(store.get("hmg-game-test",0)|0):0;
const gDays=()=>Math.max(0,(score.days||0)+gmTest());
/* physique : les muscles grossissent avec les séances */
const GM_MUS=[{d:0,n:"Crevette",w:.9,t:"Tout commence ici"},{d:5,n:"Affûté",w:1,t:"Les premiers muscles pointent le bout de leur nez"},{d:15,n:"Costaud",w:1.1,t:"Le t-shirt commence à serrer"},
  {d:30,n:"Massif",w:1.2,t:"Les portes deviennent étroites"},{d:50,n:"Titan",w:1.3,t:"La salle tremble à ton arrivée"},{d:80,n:"Colosse",w:1.4,t:"Une légende vivante"}];
const gmMusLv=d=>{ let l=0; GM_MUS.forEach((m,i)=>{ if(d>=m.d) l=i; }); return l; };
const gmHeroLv=()=>gmMusLv(gmS.seen==null?gDays():Math.min(gmS.seen,gDays()));
/* saisons : l'aventure suit la vraie date (hiver dès le 15 novembre, comme le ressenti en France) */
const GM_SSN={hiver:{n:"Hiver",e:"❄️",h:"L'hiver est arrivé",t:"La neige tombe sur l'aventure"},printemps:{n:"Printemps",e:"🌸",h:"Le printemps est là",t:"Les fleurs reviennent, les gains aussi"},
  ete:{n:"Été",e:"☀️",h:"C'est l'été",t:"Grand soleil sur l'aventure"},automne:{n:"Automne",e:"🍂",h:"L'automne est là",t:"Les feuilles tombent, pas ta motivation"}};
const GM_SSN_T=["","hiver","printemps","ete","automne"];
function gmSeason(){ const t=isAdmin()?store.get("hmg-season-test",""):""; if(GM_SSN[t]) return t;
  const d=new Date(), v=(d.getMonth()+1)*100+d.getDate(); return v>=1115||v<301?"hiver":v<601?"printemps":v<915?"ete":"automne"; }
const gmBase=eq=>GM_LG[eq.hero]?GM_LG[eq.hero].base:(eq.hero||"homme");
const gmNone=(c,eq)=>({skin:gmBase(eq)==="robot"?"Châssis nu":gmBase(eq)==="femme"?"Brassière":"Torse nu",legs:"Caleçon",feet:"Pieds nus",hand:"Mains libres"}[c]||"Aucun");
const GM={on:false,busy:false,pos:0,lay:null,ghosts:null,tm:null};
let gmUid=0;
function gmHash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function gmRng(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const gmKind=n=>n===0?"w":n%GM_PER===0?"g":(n%GM_PER===3||n%GM_PER===6||(n%GM_PER===5&&gmLegOn("l_coach",n)))?"c":null;
const gmNextChest=d=>{ let n=d+1; while(!gmKind(n)) n++; return n; };
const gmWorld=w=>GM_W[((w%GM_W.length)+GM_W.length)%GM_W.length];
const gmLap=w=>Math.floor(w/GM_W.length)+1;
const gmWorldOf=d=>Math.min(Math.floor(d/GM_PER),Math.floor(Math.max(0,d-1)/GM_PER)+(d%GM_PER===0&&d>0?1:0));

/* ---------- le petit héros (SVG) : homme, femme ou robot, peau claire ou foncée, + objets de la collection */
function gmBot(eq,o={}){
  const LG=GM_LG[eq.hero];
  if(LG) eq={...eq,tone:LG.tone,skin:eq.skin||LG.skin,legs:eq.legs||LG.legs||"short_noir",feet:eq.feet||"baskets",hat:eq.hat||LG.hat||null,aura:eq.aura||LG.aura||null};
  const u="gb"+(++gmUid), hero=LG?LG.base:(eq.hero||"homme"), rob=hero==="robot", fem=hero==="femme", tone=eq.tone==="fonce"?"fonce":eq.tone==="bronze"?"bronze":"clair";
  const lv=LG?4:(o.mus!=null?o.mus:gmHeroLv()), wd=LG?LG.wide:GM_MUS[lv].w, dx=12*(wd-1), hs=LG?LG.hair:"";
  const T={...(rob?GM_TONE.robot[tone==="bronze"?"clair":tone]:tone==="bronze"?{s:"#dc9a6a",d:"#b47248",h:"#24160d"}:GM_TONE.human[tone]),...(hs==="blond"?{h:"#e8b84f"}:{})}, K=GM_SKIN[eq.skin]||GM_SKIN.blanc, st=!!o.static;
  const hat=eq.hat, face=eq.face, back=eq.back, hand=eq.hand, aura=eq.aura, top=!!GM_SKIN[eq.skin];
  const emb=(eq.skin==="volt"||eq.skin==="or")?"#0a0f02":"#c8ff1e";
  const ey=rob?-53:-48, p=[];
  p.push(`<defs><linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${K[0]}"/><stop offset=".55" stop-color="${K[1]}"/><stop offset="1" stop-color="${K[2]}"/></linearGradient>
    <radialGradient id="${u}h" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${T.s}"/><stop offset=".75" stop-color="${T.s}"/><stop offset="1" stop-color="${T.d}"/></radialGradient>
    <linearGradient id="${u}au" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c4"/><stop offset=".5" stop-color="#ffd166"/><stop offset="1" stop-color="#c48a00"/></linearGradient>
    <radialGradient id="${u}fl" cx=".5" cy=".62" r=".6"><stop offset="0" stop-color="#ffe08a" stop-opacity=".95"/><stop offset=".45" stop-color="#ff7a3d" stop-opacity=".7"/><stop offset="1" stop-color="#ff3b1f" stop-opacity="0"/></radialGradient>
    <linearGradient id="${u}sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset="1" stop-color="#2b1460"/></linearGradient>
    <linearGradient id="${u}bd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${T.d}"/><stop offset=".28" stop-color="${T.s}"/><stop offset=".72" stop-color="${T.s}"/><stop offset="1" stop-color="${T.d}"/></linearGradient>
    <linearGradient id="${u}lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset="1" stop-color="#7b5cff"/></linearGradient></defs>`);
  p.push(`<ellipse cx="0" cy="0" rx="16" ry="3.6" fill="#000" opacity=".38"/><g class="b-all">`);
  /* dans le dos */
  if(aura==="flammes") p.push(`<g class="b-aura"><path d="M0 -90 C12 -78 30 -66 28 -36 C27 -12 14 2 0 2 C-14 2 -27 -12 -28 -36 C-30 -66 -12 -78 0 -90Z" fill="url(#${u}fl)"/><path d="M-8 -78 C-4 -70 -14 -66 -12 -56 M9 -80 C14 -70 6 -66 10 -58" stroke="#ffd166" stroke-width="1.4" fill="none" opacity=".7"/></g>`);
  if(back==="cape") p.push(`<path class="b-cape" d="M-10 -32 Q0 -35 10 -32 L19 -4 Q10 0 0 -3 Q-10 0 -19 -4Z" fill="#e8264a"/><path class="b-cape" d="M-6 -31 L-12 -6 Q-15 -5 -17 -5 L-9 -31Z" fill="#ff5a77" opacity=".7"/>`);
  if(back==="ailes"){ const w=`<path d="M9 -28 C18 -46 38 -50 41 -36 C37 -37 35 -32 31 -32 C33 -26 28 -23 24 -25 C23 -19 17 -19 12 -22Z" fill="#fff" stroke="#cfe3ff" stroke-width="1"/><path d="M16 -33 C24 -40 32 -41 36 -37 M17 -27 C22 -31 26 -31 29 -30" stroke="#cfe3ff" stroke-width="1" fill="none"/>`;
    p.push(`<g class="b-wingR">${w}</g><g class="b-wingL"><g transform="scale(-1,1)">${w}</g></g>`); }
  if(back==="jetpack") p.push(`<g class="b-flame"><path d="M-17 -15 Q-22 -4 -17 3 Q-12 -4 -17 -15Z" fill="#ffb547"/><path d="M17 -15 Q12 -4 17 3 Q22 -4 17 -15Z" fill="#ffb547"/><path d="M-17 -14 Q-19 -8 -17 -4 Q-15 -8 -17 -14Z M17 -14 Q15 -8 17 -4 Q19 -8 17 -14Z" fill="#fff4c4"/></g>
    <rect x="-22" y="-35" width="9" height="21" rx="4.5" fill="#3a4256"/><rect x="13" y="-35" width="9" height="21" rx="4.5" fill="#3a4256"/><rect x="-22" y="-28" width="9" height="3" fill="#c8ff1e"/><rect x="13" y="-28" width="9" height="3" fill="#c8ff1e"/><rect x="-21" y="-16" width="7" height="3" rx="1" fill="#1b2130"/><rect x="14" y="-16" width="7" height="3" rx="1" fill="#1b2130"/>`);
  if(back==="sac") p.push(`<rect x="-16.5" y="-34" width="33" height="21" rx="7" fill="#ff7a3d"/><rect x="-16.5" y="-24" width="33" height="3" fill="#c2410c"/>`);
  /* jambes */
  const LEGS={short_noir:{c:"#1b2130",s:"#c8ff1e"},jogging:{c:"#6b7489",s:"#3d4456",long:1},short_volt:{c:"#c8ff1e",s:"#0a0f02"},legging:{c:`url(#${u}lg)`,s:"#ff4fd8",long:1},short_or:{c:`url(#${u}au)`,s:"#fff4b8"}};
  const SHOES={baskets:{c:"#1b2130",s:"#c8ff1e"},baskets_bl:{c:"#f4f6fb",s:"#c8ff1e",b:"#a7b3ca"},baskets_volt:{c:"#c8ff1e",s:"#0a0f02"},montantes:{c:"#ff3b5c",s:"#fff",hi:1},baskets_or:{c:`url(#${u}au)`,s:"#fff4b8"}};
  const BAS=LEGS[eq.legs], SH=SHOES[eq.feet], limb=rob?T.d:T.s;
  const leg=x=>`<rect x="${x}" y="-15" width="6.4" height="13" rx="3.2" fill="${BAS&&BAS.long?BAS.c:limb}"/>`+(BAS&&BAS.long?`<rect x="${x-.2}" y="-5.8" width="6.8" height="2.2" rx="1" fill="${BAS.s}"/>`:"")
    +(SH?`${SH.hi?`<rect x="${x-.7}" y="-8.2" width="7.8" height="6.6" rx="2.6" fill="${SH.c}"/><path d="M${x+.4} -6.2 H${x+6}" stroke="${SH.s}" stroke-width="1.1"/>`:""}<ellipse cx="${x+3.2}" cy="-1.9" rx="5.6" ry="3.1" fill="${SH.c}"/>${SH.b?`<path d="M${x-2.4} -.5 H${x+8.8}" stroke="${SH.b}" stroke-width="1.8" stroke-linecap="round"/>`:""}<path d="M${x-2.2} -0.4 H${x+8.6}" stroke="${SH.s}" stroke-width="1.3" stroke-linecap="round"/>`
      :`<ellipse cx="${x+3.2}" cy="-1.8" rx="4.7" ry="2.7" fill="${rob?T.h:T.d}"/>${rob?"":`<ellipse cx="${x+2.4}" cy="-2.6" rx="2.2" ry="1" fill="${T.s}" opacity=".7"/>`}`);
  p.push(`<g class="b-legL">${leg(-8.4)}</g><g class="b-legR">${leg(2)}</g>`);
  /* corps : le t-shirt gagné, sinon torse nu (les muscles se dessinent avec le physique) */
  const tw=12*wd, sw=12*Math.min(wd,1.2), mc=`stroke="${T.d}" stroke-width="1.1" fill="none" stroke-linecap="round"`;
  if(top){
    p.push(`<rect x="${-tw}" y="-34" width="${2*tw}" height="22" rx="9" fill="url(#${u}k)"/>`);
    if(wd>1.15) p.push(`<path d="M${-7*wd} -27 Q0 -23 ${7*wd} -27 M-1 -24 V-14" stroke="#000" stroke-opacity=".18" stroke-width="1.2" fill="none"/>`);
    if(!rob) p.push(fem?`<path d="M-4.5 -34 Q0 -28.5 4.5 -34Z" fill="${T.s}"/>`:`<path d="M-4 -34 Q0 -30.5 4 -34Z" fill="${T.d}" opacity=".9"/>`);
    if(eq.skin==="galaxie") p.push(`<circle cx="-6" cy="-27" r=".8" fill="#fff"/><circle cx="5" cy="-22" r=".6" fill="#fff"/><circle cx="7" cy="-29" r=".9" fill="#fff"/><circle cx="-3" cy="-19" r=".6" fill="#fff"/>`);
    if(!rob) p.push(`<path d="M1 -29 L-2.6 -24.2 H0 L-1 -20.5 L2.8 -25.6 H0.2Z" fill="${emb}"/>`);
  } else {
    p.push(`<rect x="${-tw}" y="-34" width="${2*tw}" height="22" rx="9" fill="url(#${u}bd)"/><ellipse cx="${-tw*.42}" cy="-30" rx="${tw*.26}" ry="1.6" fill="#fff" opacity="${tone==="fonce"&&!rob?.07:.16}"/>`);
    if(rob) p.push(`<path d="M${-tw+3} -29.5 H${tw-3} M${-tw+3} -19.5 H${tw-3}" stroke="${T.h}" stroke-opacity=".55" stroke-width="1"/>${[[-1,-31.6],[1,-31.6],[-1,-17.4],[1,-17.4]].map(([s,y])=>`<circle cx="${s*(tw-3.6)}" cy="${y}" r=".9" fill="${T.h}"/>`).join("")}`);
    else {
      if(lv===0) p.push(`<path d="M${-tw+2.6} -28 q1.8 1 3.6 0 M${-tw+2.6} -25.4 q1.8 1 3.6 0 M${tw-2.6} -28 q-1.8 1 -3.6 0 M${tw-2.6} -25.4 q-1.8 1 -3.6 0" ${mc} opacity=".7"/>`);
      if(lv>=2) p.push(`<path d="M${-7*wd} -27.4 Q${-3.6*wd} -24.4 -.6 -27.4 M.6 -27.4 Q${3.6*wd} -24.4 ${7*wd} -27.4" ${mc}/>`);
      if(lv>=3) p.push(`<path d="M0 -24 V-19 M-3.2 -22.4 H-1.1 M1.1 -22.4 H3.2 M-3 -19.9 H-1.1 M1.1 -19.9 H3" ${mc} opacity=".85"/>`);
      if(lv>=4) p.push(`<path d="M${-tw+2.4} -25 Q${-tw+4.2} -21.6 ${-tw+3.2} -18.8 M${tw-2.4} -25 Q${tw-4.2} -21.6 ${tw-3.2} -18.8" ${mc} opacity=".7"/>`);
      if(lv<3) p.push(`<ellipse cx="0" cy="-20.4" rx=".75" ry="1" fill="${T.d}"/>`);
      if(fem) p.push(`<path d="M${-tw+.8} -32.2 Q0 -35.8 ${tw-.8} -32.2 L${tw-.8} -26.6 Q0 -24.2 ${-tw+.8} -26.6Z" fill="#6ec6ff"/><path d="M${-tw+.8} -26.8 Q0 -24.4 ${tw-.8} -26.8" stroke="#f4f8ff" stroke-width="1.6" fill="none"/><circle cx="-4" cy="-30.4" r=".85" fill="#fff"/><circle cx="3.6" cy="-29.4" r=".85" fill="#fff"/>`);
    }
  }
  if(rob) p.push(`<circle cx="0" cy="-25" r="3.6" fill="#0a0f1c"/><circle cx="0" cy="-25" r="2" fill="#c8ff1e"/>`);
  /* bas : caleçon à pois au début, puis shorts, jogging, legging… */
  if(!BAS) p.push(`<path d="M${-sw} -18.6 H${sw} V-11.4 Q${sw} -9.2 ${sw-2.4} -9.2 H1.5 L0 -11.4 L-1.5 -9.2 H${-sw+2.4} Q${-sw} -9.2 ${-sw} -11.4Z" fill="#6ec6ff"/><rect x="${-sw}" y="-19.4" width="${2*sw}" height="2.9" rx="1.3" fill="#f4f8ff"/>${[[-7,-14.2],[-2.6,-15.4],[3.4,-13.8],[7.8,-15.2],[-8.8,-11.4],[6.4,-11.2],[-4.4,-11.8],[1,-12.6]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r=".95" fill="#fff"/>`).join("")}`);
  else p.push(`<path d="M${-sw} -18.5 H${sw} V-14.5 Q${sw} -11.5 9 -11.5 H-9 Q${-sw} -11.5 ${-sw} -14.5Z" fill="${BAS.c}"/>${BAS.long?`<path d="M${-sw} -18.4 H${sw}" stroke="${BAS.s}" stroke-width="1.6"/><path d="M-1.4 -17.6 l-.8 3 M1.4 -17.6 l.8 3" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`:`<path d="M${-sw+1.6} -17 V-12.6 M${sw-1.6} -17 V-12.6" stroke="${BAS.s}" stroke-width="1.2" stroke-linecap="round"/>`}`);
  if(eq.neck){ const sc=eq.neck==="echarpe_or"?["#ffd166","#c48a00","#fff4b8"]:["#11151f","#c8ff1e","#c8ff1e"];
    p.push(`<path d="M-13 -37 Q0 -30 13 -37 L13.5 -31.5 Q0 -24.5 -13.5 -31.5Z" fill="${sc[0]}"/><path d="M-11 -35.6 Q0 -29.6 11 -35.6" stroke="${sc[1]}" stroke-width="1.3" fill="none"/>
      <path d="M-9 -31 L-12 -16 L-5.5 -16 L-3.6 -29.6Z" fill="${sc[0]}"/><path d="M-10.6 -22 L-5 -22 M-11.2 -19 L-5.4 -19" stroke="${sc[1]}" stroke-width="1.2"/><path d="M-12 -16 v2.4 M-10 -16 v2.4 M-8 -16 v2.4 M-6 -16 v2.4" stroke="${sc[2]}" stroke-width=".9"/>`); }
  if(back==="sac") p.push(`<path d="M-7.5 -34 L-6.5 -19 M7.5 -34 L6.5 -19" stroke="#ff7a3d" stroke-width="2.6" stroke-linecap="round"/>`);
  /* bras */
  const aw=6*Math.min(wd,1.35), arm=(x,hx)=>`<rect x="${x-(aw-6)/2}" y="-32" width="${aw}" height="15" rx="${aw/2}" fill="${limb}"/>${!rob&&lv>=3?`<ellipse cx="${x+3}" cy="-26.2" rx="${(aw/2+.5+.45*(lv-3)).toFixed(2)}" ry="4.6" fill="${limb}"/>`:""}${rob||!top?"":`<rect x="${(x-(aw-6)/2-.4).toFixed(2)}" y="-33" width="${(aw+.8).toFixed(2)}" height="6.5" rx="3" fill="${K[1]}"/>`}<circle cx="${hx}" cy="-16.5" r="3.3" fill="${T.s}"/>`;
  p.push(`<g transform="translate(${-dx} 0)"><g class="b-armL"><g transform="rotate(10 -12 -29)">${arm(-16.5,-13.5)}</g></g></g>`);
  /* tête */
  p.push(`<g class="b-head">`);
  if(fem) p.push(`<g class="b-ponytail"><path d="M9 -67 C24 -74 34 -61 31 -45 C30 -37 26 -32 22 -30 C25 -40 23 -52 9 -58Z" fill="${T.h}"/><path d="M14 -64 C24 -66 29 -56 28 -46" stroke="#fff" stroke-opacity=".18" stroke-width="1.6" fill="none"/><ellipse cx="12" cy="-64" rx="3.4" ry="2.6" fill="#c8ff1e"/></g>`);
  if(rob){
    p.push(`<circle cx="-17" cy="-51" r="3.3" fill="${T.d}"/><circle cx="17" cy="-51" r="3.3" fill="${T.d}"/><circle cx="-17" cy="-51" r="1.4" fill="#c8ff1e"/><circle cx="17" cy="-51" r="1.4" fill="#c8ff1e"/>`);
    if(!hat||hat==="aureole"||hat==="bandeau") p.push(`<g class="b-ant"><path d="M0 -67 V-74" stroke="${T.h}" stroke-width="2"/><circle cx="0" cy="-76" r="3.2" fill="#c8ff1e"/></g>`);
    p.push(`<rect x="-17" y="-68" width="34" height="33" rx="14" fill="url(#${u}h)"/><ellipse cx="-8" cy="-63" rx="5" ry="2.4" fill="#fff" opacity=".45"/>
      <rect x="-13" y="-62" width="26" height="19" rx="8.5" fill="#0a0f1c"/>
      <g class="b-eyes"><rect x="-8" y="-57.5" width="4.4" height="8.5" rx="2.2" fill="#c8ff1e"/><rect x="3.6" y="-57.5" width="4.4" height="8.5" rx="2.2" fill="#c8ff1e"/><path d="M-2.4 -46.4 Q0 -44.6 2.4 -46.4" stroke="#c8ff1e" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>
      ${st?"":`<g class="b-happy" stroke="#c8ff1e" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M-8.6 -52 Q-5.8 -57 -3 -52"/><path d="M3 -52 Q5.8 -57 8.6 -52"/><path d="M-3 -47.4 Q0 -44 3 -47.4"/></g>
      <g class="b-sleep" stroke="#c8ff1e" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M-8.4 -53 Q-5.8 -51 -3.2 -53"/><path d="M3.2 -53 Q5.8 -51 8.4 -53"/></g>`}
      <ellipse cx="-12" cy="-40.5" rx="2.6" ry="1.4" fill="#ff7aa0" opacity=".5"/><ellipse cx="12" cy="-40.5" rx="2.6" ry="1.4" fill="#ff7aa0" opacity=".5"/>`);
  } else {
    p.push(`<circle cx="-16.4" cy="-48" r="3.4" fill="${T.d}"/><circle cx="16.4" cy="-48" r="3.4" fill="${T.d}"/><circle cx="0" cy="-50" r="17" fill="url(#${u}h)"/>`);
    p.push(`<g class="b-eyes"><ellipse cx="-6.2" cy="-48" rx="2.5" ry="3.3" fill="#1a1322"/><ellipse cx="6.2" cy="-48" rx="2.5" ry="3.3" fill="#1a1322"/><circle cx="-5.3" cy="-49.4" r="1" fill="#fff"/><circle cx="7.1" cy="-49.4" r="1" fill="#fff"/>
      ${fem?`<path d="M-8.4 -50 L-10.6 -51.6 M-8 -51.2 L-9.6 -53.2 M8.4 -50 L10.6 -51.6 M8 -51.2 L9.6 -53.2" stroke="#1a1322" stroke-width="1.1" stroke-linecap="round"/>`:""}${fem?`<path d="M-3.2 -42.2 Q0 -38.6 3.2 -42.2 Q0 -41 -3.2 -42.2Z" fill="#e0476f"/>`:`<path d="M-3 -42 Q0 -39.2 3 -42" stroke="#7a2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/>`}</g>`);
    if(!st) p.push(`<g class="b-happy"><path d="M-8.6 -47.5 Q-6.2 -51.6 -3.8 -47.5 M3.8 -47.5 Q6.2 -51.6 8.6 -47.5" stroke="#1a1322" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M-3.6 -42.6 Q0 -36.6 3.6 -42.6Z" fill="#7a2b2b"/></g>
      <g class="b-sleep" stroke="#1a1322" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M-8.6 -48 Q-6.2 -46 -3.8 -48"/><path d="M3.8 -48 Q6.2 -46 8.6 -48"/></g>`);
    p.push(`<path d="M-8.8 -54.6 Q-6.2 -56.2 -3.6 -55 M3.6 -55 Q6.2 -56.2 8.8 -54.6" stroke="${T.h}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="-10.6" cy="-43" rx="2.8" ry="1.6" fill="#ff7aa0" opacity="${tone==="fonce"?.3:.45}"/><ellipse cx="10.6" cy="-43" rx="2.8" ry="1.6" fill="#ff7aa0" opacity="${tone==="fonce"?.3:.45}"/>`);
    if(hs==="chauve") p.push(`<ellipse cx="-6" cy="-62" rx="5" ry="2.6" fill="#fff" opacity=".3" transform="rotate(-25 -6 -62)"/>`);
    else if(!/^(casquette|bonnet)/.test(hat||"")) p.push(fem
      ?`<path d="M-17.6 -47 C-19.6 -65 -8 -71.5 1 -71 C13 -71 20 -63 17.8 -47 C16 -55 12 -60 5 -60.5 C0 -57.5 -7 -57.5 -11 -59.5 C-14 -56.5 -16 -52 -17.6 -47Z" fill="${T.h}"/><path d="M-17.4 -51 C-19 -43 -17.5 -37 -14 -34.5 C-15.2 -40 -15.2 -46 -14 -52Z" fill="${T.h}"/>`
      :`<path d="M-17 -53 C-18.6 -66 -8 -71.6 1 -71 C12 -70.6 18.6 -64.5 17 -53 C16 -58 13.5 -61.5 8.5 -62 C4 -65.5 -4 -65 -8.5 -62.5 C-12.5 -62 -15.6 -58.5 -17 -53Z" fill="${T.h}"/><path d="M-6 -70 C0 -79 12 -76 10.5 -67.5 C6 -71.5 0 -71.5 -6 -70Z" fill="${T.h}"/><path d="M-16.8 -53 V-47 M16.8 -53 V-47" stroke="${T.h}" stroke-width="2" stroke-linecap="round"/>`);
    else if(hs!=="chauve") p.push(fem?`<path d="M-17.4 -51 C-19 -43 -17.5 -37 -14 -34.5 C-15.2 -40 -15.2 -46 -14 -52Z" fill="${T.h}"/>`:"");
  }
  if(LG&&LG.beard&&!rob) p.push(`<path d="M-15.6 -46 Q-15 -34 0 -32.6 Q15 -34 15.6 -46 Q12 -38.4 6 -38.6 Q3 -41.4 0 -40.6 Q-3 -41.4 -6 -38.6 Q-12 -38.4 -15.6 -46Z" fill="${T.h}"/><path d="M-3.2 -39.6 Q0 -37.8 3.2 -39.6" stroke="#7a2b2b" stroke-width="1.3" fill="none" stroke-linecap="round"/>`);
  /* lunettes */
  if(face==="soleil") p.push(`<path d="M-17 ${ey-2} H-12 M12 ${ey-2} H17" stroke="#111" stroke-width="1.4"/><rect x="-12.5" y="${ey-4.5}" width="10.5" height="8" rx="3.4" fill="url(#${u}sg)" stroke="#111" stroke-width="1"/><rect x="2" y="${ey-4.5}" width="10.5" height="8" rx="3.4" fill="url(#${u}sg)" stroke="#111" stroke-width="1"/><path d="M-2 ${ey-2} H2" stroke="#111" stroke-width="1.4"/><path d="M-10 ${ey-2.6} l3 -1 M4.4 ${ey-2.6} l3 -1" stroke="#fff" stroke-width="1" opacity=".8" stroke-linecap="round"/>`);
  if(face==="cyber") p.push(`<rect x="-16.5" y="${ey-4.6}" width="33" height="8.4" rx="4.2" fill="rgba(63,216,255,.42)" stroke="#3fd8ff" stroke-width="1"/><path d="M-13 ${ey-2.6} H6" stroke="#e6fbff" stroke-width="1" opacity=".75" stroke-linecap="round"/>`);
  if(face==="coeur"){ const h=cx=>`<path d="M${cx} ${ey+3.6} C${cx-6.4} ${ey-.6} ${cx-3.8} ${ey-6.4} ${cx} ${ey-2.6} C${cx+3.8} ${ey-6.4} ${cx+6.4} ${ey-.6} ${cx} ${ey+3.6}Z" fill="#ff3b7a" stroke="#b0124a" stroke-width=".8"/>`; p.push(h(-6.4)+h(6.4)+`<path d="M-1.6 ${ey-2} H1.6" stroke="#b0124a" stroke-width="1.2"/>`); }
  /* sur la tête */
  if(hat==="bandeau") p.push(`<path d="M-17.6 -56 Q0 -64.5 17.6 -56 L17.8 -51.6 Q0 -60 -17.8 -51.6Z" fill="#ff3b5c"/><path d="M16.5 -55 L25 -53.5 L22.5 -49.5Z M16.5 -53.5 L23.5 -48 L19.5 -46.5Z" fill="#e8264a"/>`);
  if(hat==="casquette") p.push(`<path d="M-18 -52.5 C-18.5 -66 -9 -72.5 0 -72.5 C9 -72.5 18.5 -66 18 -52.5 Q0 -57.5 -18 -52.5Z" fill="#1b2130"/><path d="M3 -55 Q20 -59.5 31 -53 Q19.5 -50 3 -52Z" fill="#0e121b"/><path d="M1 -68 L-2.4 -63.4 H0 L-1 -59.8 L2.6 -64.6 H0.2Z" fill="#c8ff1e"/><circle cx="0" cy="-72.4" r="1.6" fill="#c8ff1e"/>`);
  if(hat==="bonnet") p.push(`<path d="M-18 -52 C-18 -68 -9 -74 0 -74 C9 -74 18 -68 18 -52Z" fill="#3fd8ff"/><path d="M-9 -72 V-56 M0 -74 V-56 M9 -72 V-56" stroke="#2aa9d6" stroke-width="1.4"/><rect x="-19" y="-57.5" width="38" height="7" rx="3.5" fill="#1f9fd0"/><circle cx="0" cy="-75.5" r="4.4" fill="#fff"/>`);
  if(hat==="bonnet_hmg"||hat==="bonnet_volt"){ const v=hat==="bonnet_volt", a=v?"#c8ff1e":"#11151f", b=v?"#0a0f02":"#c8ff1e";
    p.push(`<path d="M-18 -52 C-18 -68 -9 -74 0 -74 C9 -74 18 -68 18 -52Z" fill="${a}"/><path d="M-9 -72 V-58 M0 -74 V-58 M9 -72 V-58" stroke="#000" stroke-opacity=".18" stroke-width="1.4"/><rect x="-19" y="-58" width="38" height="8" rx="3.5" fill="${b}"/><text x="0" y="-51.9" text-anchor="middle" font-family="Space Grotesk,Arial,sans-serif" font-weight="700" font-size="6.4" letter-spacing=".6" fill="${a}">HMG</text><circle cx="0" cy="-75.5" r="4.6" fill="${b}"/>`); }
  if(hat==="casque") p.push(`<path d="M-19 -50 C-21 -76 21 -76 19 -50" stroke="#1b2130" stroke-width="3.6" fill="none"/><rect x="-23" y="-57" width="7.4" height="14" rx="3.4" fill="#1b2130" stroke="#c8ff1e" stroke-width="1.1"/><rect x="15.6" y="-57" width="7.4" height="14" rx="3.4" fill="#1b2130" stroke="#c8ff1e" stroke-width="1.1"/>`);
  if(hat==="crete") p.push(`<path d="M-7 -64.5 L-6.5 -78 L-2.2 -68 L0 -84 L3.2 -68 L7.6 -77.5 L8 -63.5 Q0 -67.5 -7 -64.5Z" fill="#ff4fd8" stroke="#b0129a" stroke-width=".8"/>`);
  if(hat==="aureole") p.push(`<g class="b-halo"><ellipse cx="0" cy="-81" rx="12.5" ry="3.6" fill="none" stroke="#ffd166" stroke-opacity=".35" stroke-width="5"/><ellipse cx="0" cy="-81" rx="12.5" ry="3.6" fill="none" stroke="#ffe9a3" stroke-width="2.2"/></g>`);
  if(hat==="couronne") p.push(`<path d="M-11.5 -63.5 L-13.5 -78 L-6 -71 L0 -82.5 L6 -71 L13.5 -78 L11.5 -63.5Z" fill="url(#${u}au)" stroke="#a87400" stroke-width=".8"/><circle cx="0" cy="-67.5" r="2" fill="#ff3b5c"/><circle cx="-6.5" cy="-66.5" r="1.4" fill="#3fd8ff"/><circle cx="6.5" cy="-66.5" r="1.4" fill="#2bffa0"/>`);
  p.push(`</g>`);
  /* bras droit + objet en main */
  const it={haltere:`<rect x="6" y="-17.6" width="15" height="2.2" rx="1" fill="#cfd6e6"/><rect x="4.4" y="-21.5" width="3.6" height="10" rx="1.3" fill="#2a3142"/><rect x="19" y="-21.5" width="3.6" height="10" rx="1.3" fill="#2a3142"/><rect x="4.4" y="-17.4" width="3.6" height="1.8" fill="#c8ff1e"/><rect x="19" y="-17.4" width="3.6" height="1.8" fill="#c8ff1e"/>`,
    haltereor:`<rect x="5" y="-17.8" width="17" height="2.6" rx="1" fill="#fff2b0"/><rect x="2.8" y="-23" width="4.6" height="13" rx="1.6" fill="url(#${u}au)"/><rect x="19.6" y="-23" width="4.6" height="13" rx="1.6" fill="url(#${u}au)"/><circle cx="4" cy="-22" r=".9" fill="#fff"/><circle cx="21" cy="-21" r=".9" fill="#fff"/>`,
    kettle:`<path d="M9.6 -18.5 Q13.5 -25 17.4 -18.5" stroke="#2a3142" stroke-width="2.2" fill="none"/><circle cx="13.5" cy="-11.5" r="6" fill="#2a3142"/><circle cx="11.6" cy="-13.2" r="1.6" fill="#fff" opacity=".35"/><path d="M10 -10 H17" stroke="#c8ff1e" stroke-width="1.2"/>`,
    shaker:`<rect x="10" y="-25.5" width="7" height="14" rx="2.2" fill="#c8ff1e" opacity=".9"/><rect x="9.6" y="-28" width="7.8" height="3.6" rx="1.2" fill="#1b2130"/><rect x="11" y="-21" width="5" height="1.4" fill="#0a0f02" opacity=".5"/>`}[hand]||"";
  p.push(`<g transform="translate(${dx} 0)"><g class="b-armR"><g transform="rotate(-10 12 -29)">${hand==="shaker"?it+arm(10.5,13.5):arm(10.5,13.5)+it}</g></g></g>`);
  /* devant */
  if(aura==="etincelles") p.push(`<g class="b-spk" fill="#fff6b0">${[[-25,-62],[24,-46],[-21,-22],[23,-74]].map(([x,y])=>`<path d="M${x} ${y-5} L${x+1.3} ${y-1.3} L${x+5} ${y} L${x+1.3} ${y+1.3} L${x} ${y+5} L${x-1.3} ${y+1.3} L${x-5} ${y} L${x-1.3} ${y-1.3}Z"/>`).join("")}</g>`);
  if(aura==="eclairs") p.push(`<path class="b-bolt" d="M-27 -66 L-21 -54 L-26 -52 L-19 -38" stroke="#c8ff1e" stroke-width="2.2" fill="none" stroke-linejoin="round"/><path class="b-bolt" d="M27 -60 L21 -48 L26 -46 L19 -31" stroke="#c8ff1e" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`);
  if(!st) p.push(`<g class="b-zz"><text x="15" y="-70">z</text><text x="20" y="-77">Z</text></g>`);
  p.push(`</g>`);
  return `<svg class="gmb ${o.cls==null?"idle":o.cls}" viewBox="-40 -94 80 98"${st?` xmlns="http://www.w3.org/2000/svg" width="${o.w||400}" height="${o.h||490}"`:""} aria-hidden="true">${p.join("")}</svg>`;
}

/* ---------- coffre (SVG) */
function gmChestSvg(col,opened,big){
  const u="gc"+(++gmUid), dark=big?"#3a2a08":"#1a2238";
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${big?"#5a4210":"#2c3858"}"/><stop offset="1" stop-color="${big?"#22170a":"#0e1426"}"/></linearGradient>
    <linearGradient id="${u}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity=".75"/></linearGradient></defs>
    ${opened?`<ellipse cx="100" cy="93" rx="58" ry="9" fill="${col}" opacity=".35"/>`:""}
    <rect x="36" y="90" width="128" height="78" rx="13" fill="url(#${u}b)" stroke="url(#${u}t)" stroke-width="4"/>
    <rect x="36" y="110" width="128" height="9" fill="url(#${u}t)" opacity=".9"/><rect x="60" y="90" width="11" height="78" fill="url(#${u}t)" opacity=".75"/><rect x="129" y="90" width="11" height="78" fill="url(#${u}t)" opacity=".75"/>
    <ellipse cx="72" cy="150" rx="22" ry="4" fill="#fff" opacity=".06"/>
    <g class="lid"${opened?` transform="translate(0 -30) rotate(-24 100 90)"`:""}><path d="M36 92 V76 Q36 44 100 44 Q164 44 164 76 V92Z" fill="url(#${u}b)" stroke="url(#${u}t)" stroke-width="4"/>
      <path d="M60 92 V52 M71 92 V48 M129 92 V48 M140 92 V52" stroke="${col}" stroke-opacity=".75" stroke-width="5.5"/><path d="M50 66 Q70 54 100 53" stroke="#fff" stroke-opacity=".3" stroke-width="4" fill="none" stroke-linecap="round"/></g>
    <rect x="86" y="96" width="28" height="31" rx="6" fill="url(#${u}t)" stroke="${dark}" stroke-width="2"/><circle cx="100" cy="108" r="4.4" fill="${dark}"/><path d="M100 110 V118" stroke="${dark}" stroke-width="3.4" stroke-linecap="round"/></svg>`;
}
const gmChestCol=k=>k==="g"?"#ffd166":k==="w"?"#3fd8ff":"#c8ff1e";

/* ---------- décor de chaque monde (SVG procédural, centré sur le chemin) */
function gmDeco(w,h){
  const W=gmWorld(w), r=gmRng(gmHash("deco"+w)), R=(a,b)=>a+(b-a)*r(), o=[], c=W.wc;
  const n=Math.round(h/95), side=()=>{ const s=r()<.5?-1:1; return s*(r()<.6?R(70,260):R(260,620)); };
  for(let i=0;i<Math.round(h/30);i++) o.push(`<circle cx="${R(-700,700)|0}" cy="${R(0,h)|0}" r="${R(.5,1.6).toFixed(1)}" fill="#fff" opacity="${R(.15,.6).toFixed(2)}"/>`);
  if(W.k==="plaine"){ const ss=gmSeason(), hv=ss==="hiver", au=ss==="automne", pr=ss==="printemps";
    const hill=hv?["#2b3d52","#243447","#1d2b3b","#172331"]:au?["#3d2a12","#33230f","#2a1c0c","#22170a"]:pr?["#124430","#0e3828","#0b2e21","#09261b"]:["#0f3a2c","#0c3024","#0a281e","#082018"];
    const fol=hv?["#1d5a46","#2c7a5c"]:au?["#c2551f","#ff9a3d"]:["#1f8a5c","#2bc27a"], gr=hv?"#e6f4ff":au?"#ffb547":c;
    for(let i=0;i<4;i++){ const y=h*(i+.8)/4; o.push(`<path d="M-700 ${y} C-420 ${y-120} -260 ${y-30} -60 ${y-90} C160 ${y-150} 360 ${y-20} 700 ${y-110} V${y+300} H-700Z" fill="${hill[i]}" opacity=".85"/><path d="M-700 ${y} C-420 ${y-120} -260 ${y-30} -60 ${y-90} C160 ${y-150} 360 ${y-20} 700 ${y-110}" stroke="${hv?"#f4f9ff":c}" stroke-opacity="${hv?.55:.25}" stroke-width="${hv?4:2}" fill="none"/>`); }
    for(let i=0;i<n*1.6;i++){ const x=side(), y=R(60,h-20), s=R(.7,1.4); o.push(`<g transform="translate(${x|0} ${y|0}) scale(${s.toFixed(2)})"><rect x="-3" y="-22" width="6" height="24" rx="3" fill="#3b2a1e"/><circle cx="0" cy="-36" r="20" fill="${fol[0]}"/><circle cx="-9" cy="-44" r="12" fill="${fol[1]}"/>${hv?`<path d="M-19.6 -40 C-19 -52 -11 -57 -2 -56.6 C9 -56.6 18 -51 19.8 -40 C14 -45 8 -44 4 -46.5 C-1 -43.6 -6 -45.6 -10 -44 C-14 -45 -17 -43 -19.6 -40Z" fill="#f4f9ff"/><circle cx="-10" cy="-52" r="4" fill="#fff"/>`:pr?`<circle cx="7" cy="-30" r="3.4" fill="#ffc2e3"/><circle cx="-6" cy="-28" r="3" fill="#ff9ad5"/><circle cx="10" cy="-42" r="3" fill="#fff0f8"/><circle cx="-13" cy="-36" r="2.6" fill="#ffc2e3"/><circle cx="2" cy="-48" r="2.6" fill="#ff9ad5"/>`:`<circle cx="-11" cy="-47" r="4" fill="${au?"#ffd166":"#bfffe0"}" opacity=".6"/>`}</g>`); }
    for(let i=0;i<n*4;i++){ const x=R(-700,700), y=R(0,h); o.push(`<path d="M${x|0} ${y|0} q-3 -12 -7 -16 M${x|0} ${y|0} q1 -14 4 -18 M${x|0} ${y|0} q4 -9 9 -11" stroke="${gr}" stroke-opacity="${R(.25,.6).toFixed(2)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`); }
    for(let i=0;i<n*(pr?4:2);i++) o.push(hv?`<ellipse cx="${R(-700,700)|0}" cy="${R(0,h)|0}" rx="${R(6,16).toFixed(1)}" ry="${R(2,4).toFixed(1)}" fill="#f4f9ff" opacity="${R(.35,.7).toFixed(2)}"/>`
      :`<circle cx="${R(-700,700)|0}" cy="${R(0,h)|0}" r="${R(2,3.4).toFixed(1)}" fill="${(au?["#ff9a3d","#e8542a","#ffc24a"]:pr?["#ff9ad5","#ffe066","#ffffff","#c77dff"]:["#ff7ab8","#ffe066","#9ad7ff"])[i%(pr?4:3)]}" opacity=".8"/>`);
  } else if(W.k==="desert"){
    o.push(`<g opacity=".9"><circle cx="0" cy="${h*.12}" r="150" fill="url(#sun${w})"/>${[0,1,2,3,4].map(i=>`<rect x="-160" y="${h*.12+20+i*22}" width="320" height="${4+i*2}" fill="${W.c[0]}"/>`).join("")}</g>`);
    for(let i=0;i<6;i++){ const y=h*(i+.6)/6; o.push(`<path d="M-700 ${y} Q-300 ${y-90} 0 ${y-30} T700 ${y-60} V${y+260} H-700Z" fill="${["#6b3414","#5a2c12","#4a240f","#3d1d0c","#33180a","#2a1408"][i]}" opacity=".8"/>`); }
    for(let i=0;i<n;i++){ const x=side(), y=R(80,h), s=R(.8,1.5), a=R(-25,25); o.push(`<g transform="translate(${x|0} ${y|0}) rotate(${a|0}) scale(${s.toFixed(2)})"><rect x="-38" y="-5" width="76" height="10" rx="4" fill="#9aa3b5"/><rect x="-52" y="-24" width="16" height="48" rx="5" fill="#2a3142"/><rect x="36" y="-24" width="16" height="48" rx="5" fill="#2a3142"/><rect x="-52" y="-4" width="16" height="6" fill="${c}"/><rect x="36" y="-4" width="16" height="6" fill="${c}"/></g>`); }
    for(let i=0;i<n*1.2;i++){ const x=side(), y=R(40,h), s=R(.6,1.2); o.push(`<g transform="translate(${x|0} ${y|0}) scale(${s.toFixed(2)})"><rect x="-8" y="-60" width="16" height="62" rx="8" fill="#2f8f5a"/><path d="M-8 -30 H-20 Q-26 -30 -26 -38 V-48" stroke="#2f8f5a" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M8 -22 H18 Q24 -22 24 -30 V-40" stroke="#2f8f5a" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="0" cy="-62" r="4" fill="#ff7ab8"/></g>`); }
  } else if(W.k==="glacier"){
    o.push(`<path d="M-700 ${h*.1} C-300 ${h*.02} -100 ${h*.2} 200 ${h*.08} S600 ${h*.15} 700 ${h*.05}" stroke="#2bffa0" stroke-opacity=".22" stroke-width="70" fill="none" filter="url(#bl${w})"/><path d="M-700 ${h*.16} C-200 ${h*.1} 0 ${h*.26} 300 ${h*.14} S600 ${h*.2} 700 ${h*.12}" stroke="#7fe3ff" stroke-opacity=".2" stroke-width="50" fill="none" filter="url(#bl${w})"/>`);
    for(let i=0;i<5;i++){ const y=h*(i+.7)/5; o.push(`<path d="M-700 ${y} Q-350 ${y-60} 0 ${y-20} T700 ${y-40} V${y+300} H-700Z" fill="${["#16385a","#12304e","#0e2842","#0b2036","#08192c"][i]}" opacity=".85"/>`); }
    for(let i=0;i<n*1.4;i++){ const x=side(), y=R(60,h), s=R(.6,1.5); o.push(`<g transform="translate(${x|0} ${y|0}) scale(${s.toFixed(2)})"><path d="M0 -90 L18 -60 L14 0 H-14 L-18 -60Z" fill="url(#ice${w})" opacity=".85"/><path d="M0 -90 L18 -60 L0 -50Z" fill="#fff" opacity=".35"/><path d="M26 -50 L36 -32 L34 0 H18 L16 -32Z" fill="url(#ice${w})" opacity=".7"/></g>`); }
  } else if(W.k==="jungle"){
    for(let i=0;i<n*1.6;i++){ const x=side(), y=R(40,h), s=R(.8,1.8), a=R(-60,60); o.push(`<path transform="translate(${x|0} ${y|0}) rotate(${a|0}) scale(${s.toFixed(2)})" d="M0 0 C-30 -20 -30 -70 0 -100 C30 -70 30 -20 0 0Z" fill="${["#2a1458","#1d3b2a","#3a1a6a"][i%3]}" opacity=".9"/>`); }
    for(let i=0;i<n*1.3;i++){ const x=R(-640,640), y=R(60,h), s=R(.5,1.2), cc=["#c77dff","#ff4fd8","#3fd8ff"][i%3]; o.push(`<g transform="translate(${x|0} ${y|0}) scale(${s.toFixed(2)})"><rect x="-5" y="-24" width="10" height="26" rx="5" fill="#e9dcff" opacity=".85"/><path d="M-26 -22 Q-24 -50 0 -52 Q24 -50 26 -22Z" fill="${cc}"/><path d="M-26 -22 Q-24 -50 0 -52 Q24 -50 26 -22Z" fill="${cc}" opacity=".35" filter="url(#bl${w})"/><circle cx="-10" cy="-36" r="3.5" fill="#fff" opacity=".8"/><circle cx="6" cy="-42" r="2.5" fill="#fff" opacity=".8"/><circle cx="12" cy="-30" r="2" fill="#fff" opacity=".7"/></g>`); }
    for(let i=0;i<n*.7;i++){ const x=R(-650,650); o.push(`<path d="M${x|0} 0 C${(x+40)|0} ${h*.2} ${(x-40)|0} ${h*.4} ${(x+20)|0} ${h*R(.5,.9)}" stroke="#2f7a4a" stroke-width="3" fill="none" opacity=".5"/>`); }
  } else if(W.k==="cite"){
    for(let i=0;i<9;i++){ const y=h*(i+1)/9; for(const s of [-1,1]){ let x=150; while(x<700){ const bw=R(40,90), bh=R(80,220), X=s<0?-x-bw:x; o.push(`<rect x="${X|0}" y="${(y-bh)|0}" width="${bw|0}" height="${bh|0}" fill="#14081f" stroke="${c}" stroke-opacity=".25"/>`);
      for(let wy=y-bh+10;wy<y-8;wy+=14) for(let wx=X+7;wx<X+bw-8;wx+=12) if(r()<.45) o.push(`<rect x="${wx|0}" y="${wy|0}" width="5" height="7" fill="${r()<.5?c:"#3fd8ff"}" opacity="${R(.35,.9).toFixed(2)}"/>`);
      x+=bw+R(4,20); } } }
    for(let i=0;i<n*.8;i++){ const x=side(), y=R(60,h), t=["GYM","HMG","PARIS","24/7","CAFÉ"][i%5], cc=i%2?c:"#3fd8ff"; o.push(`<g transform="translate(${x|0} ${y|0})"><text x="0" y="0" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="26" fill="none" stroke="${cc}" stroke-opacity=".5" stroke-width="5" filter="url(#bl${w})">${t}</text><text x="0" y="0" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="26" fill="#fff" stroke="${cc}" stroke-width="1.2">${t}</text></g>`); }
  } else if(W.k==="volcan"){
    o.push(`<path d="M-520 ${h*.32} L-140 ${h*.05} H140 L520 ${h*.32}Z" fill="#2a0c08"/><path d="M-140 ${h*.05} H140 L110 ${h*.09} Q0 ${h*.06} -110 ${h*.09}Z" fill="#ff5a36"/><ellipse cx="0" cy="${h*.05}" rx="160" ry="40" fill="#ff7a3d" opacity=".55" filter="url(#bl${w})"/>
      <path d="M-20 ${h*.07} C-60 ${h*.15} 30 ${h*.2} -40 ${h*.31}" stroke="#ff7a3d" stroke-width="10" fill="none" opacity=".8"/>`);
    for(let i=0;i<5;i++){ const y=h*(i+1.3)/5.5; o.push(`<path d="M-700 ${y} L-420 ${y-70} L-260 ${y-20} L-60 ${y-90} L160 ${y-30} L380 ${y-100} L700 ${y-40} V${y+300} H-700Z" fill="${["#2a0c08","#240a07","#1e0806","#180605","#120404"][i]}"/><path d="M-700 ${y} L-420 ${y-70} L-260 ${y-20} L-60 ${y-90} L160 ${y-30} L380 ${y-100} L700 ${y-40}" stroke="#ff5a36" stroke-opacity=".35" stroke-width="2" fill="none"/>`); }
    for(let i=0;i<n*.8;i++){ const x=side(), y=R(h*.3,h), rx=R(30,70); o.push(`<ellipse cx="${x|0}" cy="${y|0}" rx="${rx|0}" ry="${(rx*.28)|0}" fill="#ff5a36" opacity=".85"/><ellipse cx="${x|0}" cy="${y|0}" rx="${(rx*.6)|0}" ry="${(rx*.14)|0}" fill="#ffd166" opacity=".8"/><ellipse cx="${x|0}" cy="${y|0}" rx="${(rx*1.4)|0}" ry="${(rx*.6)|0}" fill="#ff5a36" opacity=".3" filter="url(#bl${w})"/>`); }
    for(let i=0;i<n;i++){ const x=side(), y=R(80,h), s=R(.7,1.3); o.push(`<g transform="translate(${x|0} ${y|0}) scale(${s.toFixed(2)})"><path d="M-12 -40 Q0 -56 12 -40" stroke="#3a3f4c" stroke-width="6" fill="none"/><circle cx="0" cy="-20" r="22" fill="#2b2f3a"/><path d="M-14 -14 Q0 -4 14 -14" stroke="#ff5a36" stroke-width="2" fill="none" opacity=".8"/></g>`); }
  } else {
    for(let i=0;i<Math.round(h/12);i++) o.push(`<circle cx="${R(-700,700)|0}" cy="${R(0,h)|0}" r="${R(.6,2).toFixed(1)}" fill="#fff" opacity="${R(.3,.95).toFixed(2)}"/>`);
    for(let i=0;i<n*.5;i++){ const x=side(), y=R(60,h), a=R(-40,40); o.push(`<g transform="translate(${x|0} ${y|0}) rotate(${a|0})"><rect x="-6" y="-12" width="12" height="24" rx="3" fill="#cfd6e6"/><rect x="-26" y="-6" width="18" height="12" fill="#3fd8ff" opacity=".7"/><rect x="8" y="-6" width="18" height="12" fill="#3fd8ff" opacity=".7"/><circle cx="0" cy="-16" r="3" fill="#c8ff1e"/></g>`); }
    o.push(`<ellipse cx="-260" cy="${h*.3}" rx="300" ry="120" fill="#7b5cff" opacity=".18" filter="url(#bl${w})"/><ellipse cx="300" cy="${h*.7}" rx="320" ry="140" fill="#ff4fd8" opacity=".12" filter="url(#bl${w})"/>`);
    [[-200,.2,70,"#ff7a3d","#7a1f00"],[190,.45,46,"#3fd8ff","#0b3a66"],[-170,.7,34,"#c8ff1e","#3d5200"],[230,.9,90,"#c77dff","#2a1670"]].forEach(([x,yy,rr,a,b],i)=>{ o.push(`<g transform="translate(${x} ${(h*yy)|0})"><circle r="${rr}" fill="url(#pl${w}_${i})"/>${i%2?`<ellipse rx="${rr*1.7}" ry="${rr*.32}" fill="none" stroke="${a}" stroke-opacity=".6" stroke-width="4" transform="rotate(-18)"/>`:""}</g>`);
      o.push(`<radialGradient id="pl${w}_${i}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`); });
  }
  const defs=`<defs><filter id="bl${w}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
    <radialGradient id="sun${w}"><stop offset="0" stop-color="#ffe08a"/><stop offset=".7" stop-color="#ff7a3d"/><stop offset="1" stop-color="#ff3b5c" stop-opacity="0"/></radialGradient>
    <linearGradient id="ice${w}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6fbff"/><stop offset=".5" stop-color="#7fe3ff"/><stop offset="1" stop-color="#1f6f9a"/></linearGradient></defs>`;
  for(const [mk,yy,mx] of (W.mon||[])) o.push(`<g transform="translate(${mx} ${(h*yy)|0})">${gmMon(mk,w)}</g>`);
  return `<svg viewBox="-700 0 1400 ${h}" preserveAspectRatio="none" aria-hidden="true">${defs}${o.join("")}</svg>`;
}


/* ---------- monuments de France (décor des mondes) */
function gmMon(k,w){
  const id=k+w, lbl=(t,y)=>`<text x="0" y="${y||26}" text-anchor="middle" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="13" letter-spacing="3" fill="#fff" opacity=".72">${t}</text>`;
  const tw=(x,y,c,d)=>`<circle cx="${x}" cy="${y}" r="1.8" fill="${c||"#ffe9a3"}"><animate attributeName="opacity" values="1;.15;1" dur="${d||1.4}s" begin="-${(Math.abs(x*7+y*3)%14)/10}s" repeatCount="indefinite"/></circle>`;
  if(k==="eiffel"){ const legs="M-72 0 C-44 -50 -26 -110 -16 -168 H16 C26 -110 44 -50 72 0 H50 C40 -28 22 -52 0 -54 C-22 -52 -40 -28 -50 0Z", top="M-14 -160 C-8 -210 -5 -250 -3 -282 H3 C5 -250 8 -210 14 -160Z";
    let L=""; for(let i=0;i<26;i++){ const y=-8-i*10.6, hw=y>-168?16+(72-16)*Math.pow((y+168)/168,2.2):3+11*((y+282)/122); L+=tw(((i%2?1:-1)*hw*.7)|0,y|0,"#ffe9a3",1+(i%4)*.3); }
    return `<defs><linearGradient id="e${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a8"/><stop offset=".5" stop-color="#d79a45"/><stop offset="1" stop-color="#7a4f1c"/></linearGradient>
      <pattern id="lt${id}" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 0 L7 7 M7 0 L0 7" stroke="#2a1606" stroke-width=".9" opacity=".55"/></pattern>
      <linearGradient id="bm${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff6c4" stop-opacity=".55"/><stop offset="1" stop-color="#fff6c4" stop-opacity="0"/></linearGradient></defs>
      <ellipse cx="0" cy="-140" rx="110" ry="170" fill="#ffb547" opacity=".16" filter="url(#bl${w})"/>
      <g><path d="M0 -296 L-320 -350 L-320 -318Z" fill="url(#bm${id})" transform="scale(-1,1)"/><animateTransform attributeName="transform" type="rotate" values="-30 0 -296;35 0 -296;-30 0 -296" dur="7s" repeatCount="indefinite"/></g>
      <path d="${legs}" fill="url(#e${id})"/><path d="${legs}" fill="url(#lt${id})"/><path d="${top}" fill="url(#e${id})"/><path d="${top}" fill="url(#lt${id})"/>
      <rect x="-46" y="-74" width="92" height="7" rx="1.5" fill="#ffd98a"/><rect x="-22" y="-162" width="44" height="6" rx="1.5" fill="#ffd98a"/><rect x="-6" y="-291" width="12" height="10" rx="2" fill="#ffd98a"/><path d="M0 -291 V-318" stroke="#ffd98a" stroke-width="2"/>${L}${tw(0,-320,"#ff4d6d",1)}${lbl("TOUR EIFFEL")}`; }
  if(k==="louvre"){ let g=""; for(let y=-14;y>-88;y-=14){ const hw=95*(1+y/88); g+=`<path d="M${-hw|0} ${y} H${hw|0}" />`; } for(let i=1;i<10;i++){ const x0=-95+i*19; g+=`<path d="M${x0} 0 L${((x0+95)/2)|0} ${(-(95-x0)*88/190)|0}"/><path d="M${x0} 0 L${((x0-95)/2)|0} ${(-(95+x0)*88/190)|0}"/>`; }
    let pal=""; for(const s0 of [-1,1]) for(let i=0;i<9;i++){ const x=s0*(110+i*20); pal+=`<rect x="${x-7}" y="-38" width="10" height="14" fill="#ffd98a" opacity="${.3+((i*7)%5)/10}"/>`; }
    return `<defs><linearGradient id="lv${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6fbff" stop-opacity=".75"/><stop offset="1" stop-color="#3fa9d8" stop-opacity=".3"/></linearGradient></defs>
      <rect x="-300" y="-58" width="600" height="58" fill="#2a2030"/><rect x="-300" y="-64" width="600" height="8" fill="#3a2e44"/>${pal}
      <ellipse cx="0" cy="-30" rx="120" ry="60" fill="#7fe3ff" opacity=".25" filter="url(#bl${w})"/>
      <path d="M-95 0 L0 -88 L95 0Z" fill="url(#lv${id})" stroke="#d8f6ff" stroke-width="1.6"/><g stroke="#d8f6ff" stroke-width=".7" opacity=".55">${g}</g>
      <path d="M-150 0 L-128 -22 L-106 0Z M106 0 L128 -22 L150 0Z" fill="url(#lv${id})" stroke="#d8f6ff"/><rect x="-200" y="0" width="400" height="5" fill="#7fe3ff" opacity=".6"/>${lbl("LE LOUVRE")}`; }
  if(k==="arc") return `<ellipse cx="0" cy="-40" rx="80" ry="60" fill="#ffd98a" opacity=".18" filter="url(#bl${w})"/><path fill-rule="evenodd" d="M-50 0 V-112 H50 V0Z M-18 0 V-54 A18 18 0 0 1 18 -54 V0Z M-44 -64 V-40 A6 6 0 0 1 -32 -40 V-64Z M32 -64 V-40 A6 6 0 0 1 44 -40 V-64Z" fill="#cdbd94"/>
      <rect x="-54" y="-118" width="108" height="10" fill="#b5a47a"/><rect x="-50" y="-100" width="100" height="4" fill="#a8966c"/><path d="M-50 -76 H50" stroke="#a8966c" stroke-width="2"/><ellipse cx="0" cy="-4" rx="14" ry="4" fill="#ffb547" opacity=".9"/>${tw(0,-30,"#ffb547",2)}${lbl("ARC DE TRIOMPHE")}`;
  if(k==="sacre") return `<ellipse cx="0" cy="-60" rx="90" ry="70" fill="#fff" opacity=".1" filter="url(#bl${w})"/><rect x="-62" y="-58" width="124" height="58" fill="#efeadf"/><rect x="52" y="-112" width="13" height="56" fill="#e2dccf"/><path d="M52 -112 Q58.5 -128 65 -112Z" fill="#e2dccf"/>
      <rect x="-18" y="-74" width="36" height="16" fill="#e8e2d6"/><path d="M-24 -72 C-24 -110 24 -110 24 -72Z" fill="#f6f2ea"/><rect x="-4" y="-116" width="8" height="12" fill="#efeadf"/><path d="M-4 -116 Q0 -126 4 -116Z" fill="#efeadf"/>
      <path d="M-54 -58 C-54 -76 -30 -76 -30 -58Z M30 -58 C30 -76 54 -76 54 -58Z" fill="#f6f2ea"/><g fill="#ffd98a" opacity=".75">${[-48,-34,-20,20,34,48].map(x=>`<rect x="${x-3}" y="-40" width="6" height="14" rx="3"/>`).join("")}</g><path d="M-12 0 V-22 A12 12 0 0 1 12 -22 V0Z" fill="#ffb547" opacity=".8"/>${lbl("SACRÉ-CŒUR")}`;
  if(k==="msm"){ let hs=""; for(let i=0;i<14;i++){ const x=-80+i*12, y=-18-Math.max(0,60-Math.abs(x+5)*.75); hs+=`<rect x="${x}" y="${y|0}" width="10" height="12" fill="#5a5448"/><rect x="${x+3}" y="${(y+3)|0}" width="3" height="4" fill="#ffd98a" opacity="${.4+(i%3)*.2}"/>`; }
    return `<ellipse cx="0" cy="2" rx="230" ry="16" fill="#1f6f8a" opacity=".5"/><path d="M-115 0 C-85 -30 -62 -70 -32 -90 C-12 -108 22 -104 42 -80 C72 -50 96 -24 118 0Z" fill="#33403a"/>${hs}
      <rect x="-30" y="-126" width="60" height="38" fill="#7a7468"/><path d="M-34 -126 L0 -146 L34 -126Z" fill="#5f5a50"/><path d="M-5 -140 L0 -210 L5 -140Z" fill="#8a8478"/><circle cx="0" cy="-213" r="3.6" fill="#ffd166"/><circle cx="0" cy="-213" r="10" fill="#ffd166" opacity=".3" filter="url(#bl${w})"/>
      <path d="M-115 4 C-85 30 -62 50 -32 58 C-12 64 22 62 42 50 C72 34 96 18 118 4Z" fill="#33403a" opacity=".25"/>${lbl("MONT-SAINT-MICHEL",44)}`; }
  if(k==="gard"){ const row=(y0,h,aw,sp,n)=>{ let d=`M${-n*sp/2} ${y0} V${y0-h} H${n*sp/2} V${y0}Z`; for(let i=0;i<n;i++){ const x=-n*sp/2+i*sp+(sp-aw)/2; d+=` M${x} ${y0} V${y0-h+aw/2+4} A${aw/2} ${aw/2} 0 0 1 ${x+aw} ${y0-h+aw/2+4} V${y0}Z`; } return `<path fill-rule="evenodd" d="${d}" fill="#d9b77a"/><rect x="${-n*sp/2}" y="${y0-h}" width="${n*sp}" height="3" fill="#b8955a"/>`; };
    return `<rect x="-240" y="-6" width="480" height="10" fill="#2e8fb0" opacity=".6"/>${row(0,62,40,52,7)}${row(-62,44,30,40,9)}${row(-106,22,10,14,26)}${lbl("PONT DU GARD")}`; }
  if(k==="blanc") return `<defs><linearGradient id="mb${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#bfe6f7"/><stop offset="1" stop-color="#1d4a6a"/></linearGradient></defs>
      <path d="M-280 0 L-130 -150 L-70 -108 L10 -240 L82 -132 L132 -164 L280 0Z" fill="url(#mb${id})"/><path d="M10 -240 L82 -132 L132 -164 L280 0 L60 0 L40 -120Z" fill="#0d2a44" opacity=".35"/>
      <path d="M-20 -196 L10 -240 L36 -200 L22 -206 L10 -192 L-4 -204Z" fill="#fff"/>${lbl("MONT BLANC · 4 806 M")}`;
  if(k==="puy") return `<path d="M-210 0 C-150 -34 -92 -124 0 -128 C92 -124 150 -34 210 0Z" fill="#3b1612"/><path d="M-150 -20 C-110 -60 -70 -100 0 -110" stroke="#ff5a36" stroke-opacity=".3" stroke-width="3" fill="none"/>
      <rect x="-14" y="-140" width="28" height="14" fill="#5a4a48"/><path d="M0 -140 V-206" stroke="#cfd6e6" stroke-width="5"/><path d="M-6 -170 H6 M-5 -186 H5" stroke="#cfd6e6" stroke-width="2"/>${tw(0,-208,"#ff3b3b",1.1)}${lbl("PUY DE DÔME")}`;
  if(k==="ariane") return `<defs><linearGradient id="fl${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c4"/><stop offset=".4" stop-color="#ffb547"/><stop offset="1" stop-color="#ff3b1f" stop-opacity="0"/></linearGradient></defs>
      <rect x="-86" y="-250" width="16" height="250" fill="none" stroke="#5a6378" stroke-width="2"/><path d="M-86 -250 L-70 -230 M-70 -250 L-86 -230 M-86 -200 L-70 -180 M-70 -200 L-86 -180 M-86 -150 L-70 -130 M-70 -150 L-86 -130 M-86 -100 L-70 -80 M-70 -100 L-86 -80" stroke="#5a6378" stroke-width="1.4"/>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="2.6s" repeatCount="indefinite"/>
      <path d="M-30 -30 Q-20 40 -20 70 Q-14 40 -8 -30Z M8 -30 Q14 40 20 70 Q20 40 30 -30Z M-10 -20 Q0 70 0 100 Q0 70 10 -20Z" fill="url(#fl${id})"><animate attributeName="opacity" values="1;.7;1" dur=".2s" repeatCount="indefinite"/></path>
      <rect x="-13" y="-230" width="26" height="206" rx="10" fill="#f2f5fc"/><path d="M-13 -228 Q0 -268 13 -228Z" fill="#f2f5fc"/><rect x="-13" y="-150" width="26" height="6" fill="#c8ff1e"/>
      <rect x="-30" y="-120" width="14" height="96" rx="6" fill="#dfe6f3"/><path d="M-30 -118 Q-23 -138 -16 -118Z" fill="#dfe6f3"/><rect x="16" y="-120" width="14" height="96" rx="6" fill="#dfe6f3"/><path d="M16 -118 Q23 -138 30 -118Z" fill="#dfe6f3"/></g>${lbl("ARIANE 6",30)}`;
  return "";
}

/* ---------- mise en page : chemin, mondes, cases, coffres */
function gmLayout(from,to){
  const wc=Math.floor(to/GM_PER), w0=Math.max(0,Math.floor(Math.min(from,to)/GM_PER)-1), w1=wc+1;
  const i0=w0*GM_PER, i1=(w1+1)*GM_PER, H=GM_PADT+GM_PADB+(i1-i0)*GM_STEP;
  const A=Math.max(70,Math.min(140,(innerWidth-120)/2));
  const P=i=>({x:Math.round(Math.sin(i*.82+.4)*A*(i===0?0:1)), y:H-GM_PADB-(i-i0)*GM_STEP});
  return {w0,w1,wc,i0,i1,H,A,P};
}
function gmSeg(L,i){ const p0=L.P(Math.max(L.i0,i-1)),p1=L.P(i),p2=L.P(i+1),p3=L.P(Math.min(L.i1,i+2));
  return [p1,{x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6},{x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6},p2]; }
function gmBez(s,t){ const u=1-t; return {x:u*u*u*s[0].x+3*u*u*t*s[1].x+3*u*t*t*s[2].x+t*t*t*s[3].x, y:u*u*u*s[0].y+3*u*u*t*s[1].y+3*u*t*t*s[2].y+t*t*t*s[3].y}; }
function gmPathD(L,a,b,tEnd){ if(b<=a&&!tEnd) return ""; const s0=L.P(a); let d=`M${s0.x} ${s0.y}`;
  for(let i=a;i<b;i++){ const s=gmSeg(L,i); d+=` C${s[1].x} ${s[1].y} ${s[2].x} ${s[2].y} ${s[3].x} ${s[3].y}`; }
  if(tEnd){ const s=gmSeg(L,b), N=12; for(let k=1;k<=N;k++){ const q=gmBez(s,tEnd*k/N); d+=` L${q.x.toFixed(1)} ${q.y.toFixed(1)}`; } }
  return d; }

function gmBuild(pos){
  const g=$("game"), L=GM.lay=gmLayout(pos,gDays()), d=gDays(), wcur=Math.floor(d/GM_PER), h=[];
  for(let w=L.w0;w<=L.w1;w++){ const W=gmWorld(w), top=w===L.w1?0:L.P((w+1)*GM_PER).y, bot=w===L.w0?L.H:L.P(w*GM_PER).y, bh=bot-top, nx=gmWorld(w+1);
    h.push(`<div class="gm-band${w>wcur?" lock":""}" style="top:${top}px;height:${bh}px;background:linear-gradient(${W.c[1]},${W.c[0]} 55%,${W.c[1]})">${gmDeco(w,bh)}<div class="gm-tint"></div><div style="position:absolute;left:0;right:0;top:0;height:140px;background:linear-gradient(${nx.c[1]},transparent)"></div>`);
    const rp=gmRng(gmHash("pt"+w)), snow=W.k==="glacier", up=W.k==="volcan"||W.k==="plaine"||W.k==="jungle";
    for(let i=0;i<16;i++){ const s=(2+rp()*3.5).toFixed(1); h.push(`<i class="gm-pt" style="left:${(rp()*100).toFixed(1)}%;top:${(rp()*bh)|0}px;width:${s}px;height:${s}px;background:${snow?"#fff":W.wc};box-shadow:0 0 ${s*3}px ${snow?"#fff":W.wc};--d:${(6+rp()*8).toFixed(1)}s;--dl:-${(rp()*10).toFixed(1)}s;--dx:${((rp()-.5)*60)|0}px;--dy:${snow?(120+rp()*160)|0:up?-(120+rp()*200)|0:((rp()-.5)*120)|0}px;--o:${(.4+rp()*.5).toFixed(2)}"></i>`); }
    h.push(`</div>`); }
  /* chemin */
  h.push(`<svg class="gm-path" style="height:${L.H}px" viewBox="-700 0 1400 ${L.H}" aria-hidden="true"><defs><filter id="gmGlow" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <path d="${gmPathD(L,L.i0,L.i1)}" stroke="rgba(0,0,0,.42)" stroke-width="30" fill="none" stroke-linecap="round"/>
    <path d="${gmPathD(L,L.i0,L.i1)}" stroke="rgba(255,255,255,.08)" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="${gmPathD(L,L.i0,L.i1)}" stroke="rgba(255,255,255,.28)" stroke-width="3" stroke-dasharray="1 12" fill="none" stroke-linecap="round"/>
    <path id="gmDoneG" stroke="${ACC}" stroke-opacity=".55" stroke-width="16" fill="none" stroke-linecap="round" filter="url(#gmGlow)"/>
    <path id="gmDone" stroke="${ACC}" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`);
  h.push(`<div class="gm-col" id="gmCol">`);
  for(let w=L.w0;w<=L.w1;w++){ const W=gmWorld(w+1), gp=L.P((w+1)*GM_PER), y=gp.y+59, gx=gp.x>0?-Math.min(80,L.A*.6):Math.min(80,L.A*.6), lock=(w+1)*GM_PER>d;
    h.push(`<div class="gm-gate" style="left:${gx|0}px;top:${y}px;--wc:${W.wc}"><b>Monde ${w+2}${gmLap(w+1)>1?" · Tour "+gmLap(w+1):""}</b><span>${esc(W.n)}</span>${lock?`<small>Se débloque à ${(w+1)*GM_PER} séances</small>`:""}</div>`); }
  for(let i=L.i0;i<=L.i1;i++){ const p=L.P(i), k=gmKind(i);
    h.push(`<div class="gm-node" data-n="${i}" style="left:${p.x}px;top:${p.y}px">${i||ic("loc")}</div>`);
    if(k){ const big=k==="g", side=p.x>0?-1:p.x<0?1:(i===0?1:-1), cx=p.x+side*(big?84:70);
      h.push(`<div class="gm-node chest${big?" big":""}" data-chest="${i}" style="left:${cx}px;top:${p.y-8}px;--cc:${gmChestCol(k)}" role="button" aria-label="Coffre de la séance ${i}"></div>`); } }
  h.push(`<div class="gm-hero" id="gmHero" role="button" aria-label="Ton héros"></div></div>`);
  g.querySelector(".gm-world").style.height=L.H+"px"; g.querySelector(".gm-world").innerHTML=h.join("");
  gmPaintHero(); gmMark(pos); gmPlace(pos,0); gmGhosts();
}
function gmMark(pos){ const L=GM.lay; if(!L) return; const d=Math.floor(pos);
  $("game").querySelectorAll(".gm-node[data-n]").forEach(el=>{ const n=+el.dataset.n; el.classList.toggle("done",n<=d); el.classList.toggle("next",n===d+1); });
  $("game").querySelectorAll(".gm-node[data-chest]").forEach(el=>{ const n=+el.dataset.chest, k=gmKind(n), op=gmS.open.includes(n), rd=!op&&n<=d;
    const st=(op?"o":"c")+(rd?"r":""); if(el.dataset.st!==st){ el.dataset.st=st; el.innerHTML=gmChestSvg(gmChestCol(k),op,k==="g"); }
    el.classList.toggle("opened",op); el.classList.toggle("ready",rd); el.classList.toggle("far",!op&&!rd); });
  const done=gmPathD(L,L.i0,Math.max(L.i0,Math.floor(pos)),pos%1||0); $("gmDone").setAttribute("d",done); $("gmDoneG").setAttribute("d",done); }
function gmPoint(pos){ const L=GM.lay, i=Math.floor(pos), t=pos-i; if(t<.001||i>=L.i1) return L.P(Math.min(i,L.i1)); return gmBez(gmSeg(L,i),t); }
function gmPlace(pos,scroll){ const p=gmPoint(pos), hr=$("gmHero"); if(!hr) return; hr.style.left=p.x+"px"; hr.style.top=p.y+"px"; GM.pos=pos;
  if(scroll!==false){ const sc=$("game").querySelector(".gm-scroll"); const target=p.y-sc.clientHeight*.56, tx=(sc.scrollWidth-sc.clientWidth)/2+p.x*.55;
    sc.scrollTop=scroll===0?target:sc.scrollTop+(target-sc.scrollTop)*.14; sc.scrollLeft=scroll===0?tx:sc.scrollLeft+(tx-sc.scrollLeft)*.14; } }
function gmMood(){ const hh=new Date().getHours(); return score.today?"happy idle":(hh>=23||hh<6)?"sleep":"idle"; }
function gmPaintHero(cls){ const hr=$("gmHero"); if(!hr) return; hr.innerHTML=gmBot(gmS.eq,{cls:cls||gmMood()}); hr.classList.toggle("cold",gmSeason()==="hiver"&&!gmS.eq.skin&&!GM_LG[gmS.eq.hero]); }
function gmSky(){ const g=$("game"); if(!g) return; const s=gmSeason(); g.dataset.ssn=s; let k=g.querySelector(".gm-sky");
  if(!k){ k=document.createElement("div"); k.className="gm-sky"; k.setAttribute("aria-hidden","true"); g.querySelector(".gm-scroll").after(k); }
  if(k.dataset.s===s) return; k.dataset.s=s; const r=gmRng(gmHash("sky"+s)), o=[], N={hiver:48,printemps:26,ete:18,automne:24}[s];
  if(s==="ete") o.push(`<div class="sun"></div>`);
  for(let i=0;i<N;i++){ const sz=s==="hiver"?2+r()*4.6:s==="ete"?2+r()*3:9+r()*9, d=(s==="hiver"?7+r()*9:s==="ete"?9+r()*8:9+r()*9).toFixed(1);
    const col=s==="automne"?["#ff9a3d","#e8542a","#ffc24a","#c2551f"][i%4]:s==="printemps"?["#ffc2e3","#ff9ad5","#fff0f8"][i%3]:s==="ete"?"#fff2b0":"#ffffff";
    o.push(`<i style="left:${(r()*100).toFixed(1)}%;--s:${sz.toFixed(1)}px;--d:${d}s;--dl:-${(r()*18).toFixed(1)}s;--dx:${((r()-.5)*(s==="hiver"?120:260))|0}px;--r:${((r()-.5)*1440)|0}deg;--c:${col};--o:${(.45+r()*.5).toFixed(2)}"></i>`); }
  k.innerHTML=o.join(""); }
function gmSsnBanner(s){ return new Promise(res=>{ const S=GM_SSN[s], b=document.createElement("div"); b.className="gm-banner glass ssn"; b.style.setProperty("--wc",{hiver:"#bfe6ff",printemps:"#ff9ad5",ete:"#ffd166",automne:"#ff9a3d"}[s]);
  b.innerHTML=`<b>${esc(S.h)}</b><span>${S.e} ${esc(S.n)}</span><small>${esc(S.t)}</small>`; document.body.appendChild(b); gmSnd("magic");
  setTimeout(()=>{ b.remove(); res(); },3200); }); }
function gmHeroCls(c){ const s=$("gmHero")&&$("gmHero").querySelector(".gmb"); if(s) s.setAttribute("class","gmb "+c); }

/* ---------- les autres sportifs (classement) en petits fantômes sur le chemin */
async function gmGhosts(){
  if(!LIVE||!GM.lay) return;
  if(GM.ghosts===null){ GM.ghosts=[]; try{ GM.ghosts=(await rpc("leaderboard",{p_period:"all",p_voter:voterId}))||[]; }catch(e){ GM.ghosts=[]; } }
  const col=$("gmCol"); if(!col) return; col.querySelectorAll(".gm-ghost").forEach(x=>x.remove());
  const L=GM.lay, per={}; let k=0;
  for(const r of GM.ghosts){ if(r.me) continue; const d=Math.round((r.points||0)/10); if(d<L.i0||d>L.i1||k>=24) continue; const j=per[d]=(per[d]||0)+1; if(j>3) continue; k++;
    const p=L.P(d), x=p.x+(j===1?-48:j===2?48:0), y=p.y+(j===3?44:4), r2=gmRng(gmHash(String(r.no)))();
    const eq={hero:GM_HEROES[(r2*3)|0].k,tone:r2>.5?"fonce":"clair",skin:d>=3?["blanc","volt","braise","ocean"][(r2*4)|0]:null,legs:d>=6?(r2>.7?"jogging":"short_noir"):null,feet:d>=13?"baskets":null,hand:"haltere"}, ml=gmMusLv(d);
    const el=document.createElement("div"); el.className="gm-ghost"; el.style.left=x+"px"; el.style.top=y+"px"; el.dataset.ghost=`${nameOf(r.no)} · ${d} séance${d>1?"s":""} · ${GM_MUS[ml].n}`;
    el.innerHTML=gmBot(eq,{cls:"idle",mus:ml})+`<i>${esc(String(nameOf(r.no)).replace(/^Machine /,"n°"))}</i>`; col.appendChild(el); }
}

/* ---------- interface */
function gmHud(){
  const g=$("game"); if(!g) return; const d=gDays(), w=Math.floor(d/GM_PER), W=gmWorld(w), inW=d%GM_PER;
  const nx=gmNextChest(d), left=nx-d, pend=gmPending().length, eye=gmLegOn("l_reine")?(gmLegRoll(nx)?"Légende":GM_RAR[(gmRoll(nx)||{r:"L"}).r].t):"";
  g.style.setProperty("--wc",W.wc);
  g.querySelector(".gm-hud").innerHTML=`<div><div class="w">Monde ${w+1}${gmLap(w)>1?" · Tour "+gmLap(w):""}<span class="ssn"> · ${GM_SSN[gmSeason()].e} ${GM_SSN[gmSeason()].n}</span></div><h3>${esc(W.n)}</h3></div>
    <div class="btns"><button data-gm="coll" aria-label="Ma collection" title="Ma collection"><svg class="i" viewBox="0 0 24 24"><path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span class="bdg">${gmS.items.length}</span></button>
    <button data-gm="share" aria-label="Partager mon héros" title="Partager mon héros"><svg class="i" viewBox="0 0 24 24"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg></button></div>
    <div class="bar"><i style="width:${inW*10}%"></i><u style="left:30%"></u>${gmLegOn("l_coach")?`<u style="left:50%"></u>`:""}<u style="left:60%"></u></div>
    <div class="sub"><span><b>${d}</b> séance${d>1?"s":""} · 💪 <b>${GM_MUS[gmHeroLv()].n}</b></span><span>${pend?`<b style="color:var(--a2)">Coffre à ouvrir !</b>`:`${left>1?"Coffre dans":"Coffre à la"} <b>${left>1?left+" séances":"prochaine séance"}</b>${eye?` · <b style="color:var(--gold)">${eye}</b>`:""}`}</span></div>`;
  const today=!!score.today, nm=esc(myName()), nu=!GM_LG[gmS.eq.hero]&&!gmS.eq.skin&&!gmS.eq.legs;
  g.querySelector(".gm-cta").innerHTML=`<p>${today?`Séance validée, <b>${nm}</b>. Ton héros a avancé : reviens demain pour le pas suivant.`:pend?`Un coffre t'attend, <b>${nm}</b>. Touche-le pour l'ouvrir.`:nu?`Ton héros est encore en caleçon, <b>${nm}</b>. Chaque séance le fait avancer, les coffres l'habillent.`:`Ton héros t'attend, <b>${nm}</b>. Chaque séance à la salle le fait avancer d'un pas.`}</p>
    <button class="gm-go${today?" done":""}" data-gm="go">${today?ic("check")+" Séance du jour validée":ic("bolt")+` Je suis à la salle <em>+1 pas</em>`}</button>`;
  let t=g.querySelector(".gm-test"); if(isAdmin()&&!GM.hideTest){ if(!t){ t=document.createElement("div"); t.className="gm-test glass"; g.appendChild(t); }
    t.innerHTML=`<small>TEST ADMIN</small><button class="mini" data-gm="t1">+1 séance</button><button class="mini" data-gm="t5">+5</button><button class="mini" data-gm="t0">Remise à zéro</button><button class="mini" data-gm="ts">${(()=>{ const t=store.get("hmg-season-test",""); return GM_SSN[t]?GM_SSN[t].e+" "+GM_SSN[t].n:"Saison : auto"; })()}</button><button class="mini ghost" data-gm="th">Masquer</button>`; } else if(t) t.remove();
}
function gmPending(){ const d=gDays(), o=[]; for(let n=0;n<=d;n++) if(gmKind(n)&&!gmS.open.includes(n)) o.push(n); return o; }
function gmSay(html,ms){ const col=$("gmCol"), hr=$("gmHero"); if(!col||!hr) return; col.querySelectorAll(".gm-say").forEach(x=>x.remove());
  const s=document.createElement("div"); s.className="gm-say"; s.innerHTML=html; s.style.left=hr.style.left; s.style.top=(parseFloat(hr.style.top)+(parseFloat(getComputedStyle(hr).marginTop)||-108)-4)+"px"; col.appendChild(s);
  const g=$("game"), vw=g.clientWidth, cx=col.getBoundingClientRect().left-g.getBoundingClientRect().left+parseFloat(hr.style.left), bw=s.offsetWidth, m=10;
  let sx=0; if(cx+bw/2>vw-m) sx=vw-m-(cx+bw/2); if(cx-bw/2+sx<m) sx=m-(cx-bw/2);
  if(sx){ s.style.marginLeft=sx.toFixed(1)+"px"; s.style.setProperty("--ax",sx.toFixed(1)+"px"); }
  s._fit=()=>{ const r=s.getBoundingClientRect(), gr=g.getBoundingClientRect(); if(r.right<gr.right-4&&r.left>gr.left+4) return; s.style.marginLeft=""; s.style.removeProperty("--ax");
    const c2=col.getBoundingClientRect().left-gr.left+parseFloat(hr.style.left), w2=s.offsetWidth; let z=0; if(c2+w2/2>vw-m) z=vw-m-(c2+w2/2); if(c2-w2/2+z<m) z=m-(c2-w2/2);
    if(Math.abs(z)>w2/2-14){ s.remove(); return; } if(z){ s.style.marginLeft=z.toFixed(1)+"px"; s.style.setProperty("--ax",z.toFixed(1)+"px"); } };
  clearTimeout(GM.sayT); GM.sayT=setTimeout(()=>s.remove(),ms||3200); }
function gmSnd(nm,a){ if(SND.ready()&&SND.on()) try{ SND.play(nm,a); }catch(e){} }
function gmStepSnd(i){ if(!SND.ready()||!SND.on()) return; try{ const t=SND.ctx.currentTime+.01; SND.pluck(SND.note(7+(i%5),60),t,.08,.7); SND.noise(t,.08,{f1:900,f2:300,type:"lowpass",g:.05,a:.2,rev:.05}); }catch(e){} }
const gmSleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- avancer : le héros marche case par case, ouvre les coffres, débloque les mondes */
/* une seule synchro à la fois : le score du serveur, le minuteur d'ouverture et la séance validée peuvent tous la demander
   en même temps ; sans ce verrou, deux fenêtres « Choisis ton héros » s'empilaient (la 2e revenait après le coffre) */
async function gmSync(){ if(!GM.on) return; if(GM.sync){ GM.again=true; return; } GM.sync=true;
  try{ await gmSync0(); } finally{ GM.sync=false; } if(GM.again&&GM.on){ GM.again=false; setTimeout(gmSync,60); } }
/* compte retrouvé depuis un autre navigateur : on rouvre en silence tous les coffres déjà gagnés (mêmes tirages, même ordre) */
function gmRebuild(d){ const eq={...GM_EQ0,...gmS.eq}, bare=!GM_CATS.some(([c])=>gmS.eq[c]); Object.assign(gmS,{open:[],items:[],stars:0,leg:{}});
  for(let n=0;n<=d;n++){ const k=gmKind(n); if(!k) continue; const leg=gmLegRoll(n), item=leg?null:gmRoll(n); gmS.open.push(n);
    if(leg) gmS.leg[leg.k]=n; else if(item) gmS.items.push(item.id); else gmS.stars=(gmS.stars||0)+1;
    const item2=(!leg&&item&&k==="g"&&gmLegOn("l_classique",n))?gmRoll(n,"b"):null; if(item2) gmS.items.push(item2.id); }
  GM_CATS.forEach(([c])=>{ if(eq[c]&&!gmOwn(eq[c])) eq[c]=null; });
  /* compte retrouvé avec le seul code : on le rhabille avec le plus beau de sa collection */
  if(bare){ const R={C:0,R:1,E:2,L:3}; GM_CATS.forEach(([c])=>{ const best=gmS.items.map(id=>GM_IT[id]).filter(i=>i&&i.cat===c).sort((x,y)=>R[y.r]-R[x.r])[0]; if(best) eq[c]=best.id; }); } if(GM_LG[eq.hero]&&gmS.leg[eq.hero]==null) eq.hero="homme";
  if(eq.hero&&!GM_LG[eq.hero]&&!GM_HEROES.some(h=>h.k===eq.hero)) eq.hero=null;
  gmS.eq=eq; gmS.seen=d; delete gmS.rebuild; gmSave(); }
async function gmSync0(){
  if(GM.busy) return; const d=gDays();
  if(gmS.rebuild){ gmRebuild(d); gmBuild(d); gmHud(); }
  if(gmS.seen===null||gmS.seen>d){ gmS.seen=Math.max(0,d-1); gmSave(); }
  if(!gmS.eq.hero){ await gmPickHero(true); }
  if(gmS.ssn!==gmSeason()&&!GM.busy){ gmS.ssn=gmSeason(); gmSave(); GM.busy=true; gmPaintHero("happy cheer"); await gmSsnBanner(gmS.ssn); gmPaintHero(); GM.busy=false; }
  if(d>gmS.seen){ GM.busy=true; const from=Math.max(gmS.seen,d-6); if(!GM.lay||Math.floor(d/GM_PER)+1>GM.lay.w1) gmBuild(from); gmPlace(from,0);
    await gmSleep(500); gmHeroCls("walk");
    for(let i=from;i<d;i++){ const t0=performance.now(), dur=640;
      await new Promise(res=>{ (function f(t){ const k=Math.min(1,(t-t0)/dur), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2; gmPlace(i+e,true); gmMark(i+e); if(k<1) requestAnimationFrame(f); else res(); })(t0); });
      gmStepSnd(i); const p=GM.lay.P(i+1), pl=document.createElement("div"); pl.className="gm-plus"; pl.textContent="+1"; pl.style.left=p.x+"px"; pl.style.top=(p.y-100)+"px"; $("gmCol").appendChild(pl); setTimeout(()=>pl.remove(),1700);
      gmS.seen=i+1; gmSave();
      if(gmMusLv(i+1)>gmMusLv(i)){ gmPaintHero("happy cheer"); await gmLvBanner(gmMusLv(i+1)); gmPaintHero("walk"); }
      if(gmKind(i+1)){ gmHeroCls("happy cheer"); await gmSleep(380); await gmOpenChest(i+1); gmHeroCls("walk"); }
      if((i+1)%GM_PER===0){ gmHeroCls("happy cheer"); await gmBanner(Math.floor((i+1)/GM_PER)); gmHeroCls("walk"); } }
    gmPaintHero("happy cheer"); const hr=$("gmHero"); hr.classList.remove("gm-jump"); void hr.offsetWidth; hr.classList.add("gm-jump"); gmSnd("pop");
    gmSay(pickR([`Quelle machine, <b>${esc(myName())}</b> !`,"Encore un pas vers la légende.","Personne ne t'arrête.","Ton héros est fier de toi."]),3000);
    setTimeout(()=>gmPaintHero(),1600); GM.busy=false; gmHud(); }
  const pend=gmPending(); if(pend.length&&!GM.busy&&!document.querySelector(".gm-chest")){ GM.busy=true; for(const n of pend){ await gmOpenChest(n); } GM.busy=false; gmMark(GM.pos); gmHud(); }
}
function gmLvBanner(lv){ return new Promise(res=>{ const M=GM_MUS[lv], b=document.createElement("div"); b.className="gm-banner glass"; b.style.setProperty("--wc",ACC);
  b.innerHTML=`<b>Physique · niveau ${lv+1}</b><span>💪 ${esc(M.n)}</span><small>${esc(M.t)}</small>`; document.body.appendChild(b); gmSnd("fanfare");
  if(navigator.vibrate) try{ navigator.vibrate([20,40,60]); }catch(e){}
  setTimeout(()=>{ b.remove(); res(); },3200); }); }
function gmBanner(wi){ return new Promise(res=>{ const W=gmWorld(wi), b=document.createElement("div"); b.className="gm-banner glass"; b.style.setProperty("--wc",W.wc);
  b.innerHTML=`<b>Monde ${wi+1} débloqué</b><span>${esc(W.n)}</span><small>${esc(W.d)}</small>`; document.body.appendChild(b); gmSnd("crown");
  setTimeout(()=>{ b.remove(); res(); },3500); }); }

/* ---------- coffre : on le touche 3 fois, il s'ouvre et révèle un objet */
function gmLegRoll(n){ if(!(n>0&&n%20===0)) return null; const ord=GM_LEG.slice().sort((a,b)=>gmHash(voterId+a.k)-gmHash(voterId+b.k)); return ord.find(l=>gmS.leg[l.k]==null)||null; }
function gmRoll(n,salt){ const st=GM_START[n]; if(!salt&&st&&!gmOwn(st)) return GM_IT[st]; const k=gmKind(n), r=gmRng(gmHash(voterId+":"+n+(salt||"")))(), w=Math.floor(n/GM_PER);
  let rar=k==="w"?"C":k==="c"&&n%GM_PER===3?(r<.7?"C":"R"):k==="c"?(r<.6?"R":"E"):(w>=2||r<.35)?"L":"E";
  if(gmLegOn("l_masse",n)) rar={C:"R",R:"E",E:"L",L:"L"}[rar];
  const order={C:["C","R","E","L"],R:["R","C","E","L"],E:["E","R","L","C"],L:["L","E","R","C"]}[rar];
  for(const q of order){ const pool=GM_ITEMS.filter(i=>i.r===q&&!gmOwn(i.id)); if(pool.length){ const rr=gmRng(gmHash(voterId+"#"+n+q)); return pool[Math.floor(gmRng(gmHash(voterId+"#"+n+q+(salt||"")))()*pool.length)]; } }
  return null; }
function gmOpenChest(n){ return new Promise(res=>{
  if(gmS.open.includes(n)){ res(); return; }
  const k=gmKind(n), leg=gmLegRoll(n), item=leg?null:gmRoll(n), col=gmChestCol(k), rc=leg?"#ffd166":item?GM_RAR[item.r].c:"#ffd166";
  const ttl=k==="w"?"Coffre de bienvenue":k==="g"?`Grand coffre · Monde ${n/GM_PER}`:`Coffre de la séance ${n}`;
  const ov=document.createElement("div"); ov.className="gm-chest"; ov.style.setProperty("--rc",col);
  ov.innerHTML=`<div class="rays"></div><div class="glow"></div><div class="title"><b>${leg?"Légende à l'intérieur":k==="g"?"Épique ou légendaire":"Récompense"}</b><span>${ttl}</span></div>
    <div class="box in" role="button" aria-label="Ouvrir le coffre">${gmChestSvg(col,false,k==="g")}</div>
    <div class="hint">Touche 3 fois pour l'ouvrir<div class="dots"><i></i><i></i><i></i></div></div><div class="loot"></div>`;
  document.body.appendChild(ov); gmSnd("drop");
  let taps=0; const box=ov.querySelector(".box"), glow=ov.querySelector(".glow");
  const tap=e=>{ if(e) e.stopPropagation(); if(taps>=3) return; taps++; ov.querySelectorAll(".dots i").forEach((d,j)=>d.classList.toggle("on",j<taps));
    box.classList.remove("in","sh1","sh2","sh3"); void box.offsetWidth; box.classList.add("sh"+taps); glow.style.opacity=.25+taps*.22; glow.style.transform=`scale(${1+taps*.18})`; gmSnd("tap",Math.min(2,taps-1));
    if(navigator.vibrate) try{ navigator.vibrate(taps<3?18:[30,40,60]); }catch(err){}
    if(taps===3) setTimeout(reveal,420); };
  box.addEventListener("click",tap);
  const auto=setTimeout(()=>{ if(!taps){ const h=ov.querySelector(".hint"); if(h) h.innerHTML=`Touche le coffre !<small>3 petits coups et il s'ouvre</small><div class="dots"><i></i><i></i><i></i></div>`; } },4000);
  function reveal(){ clearTimeout(auto);
    gmS.open.push(n); if(leg) gmS.leg[leg.k]=n; else if(item) gmS.items.push(item.id); else gmS.stars=(gmS.stars||0)+1;
    const item2=(!leg&&item&&k==="g"&&gmLegOn("l_classique",n))?gmRoll(n,"b"):null; if(item2) gmS.items.push(item2.id); gmSave();
    ov.style.setProperty("--rc",rc); ov.classList.add("open"); gmSnd("magic"); setTimeout(()=>gmSnd(leg||(item&&item.r==="L")?"crown":"fanfare"),650);
    const cols=[rc,"#ffffff",ACC,rc,ACC1]; for(let j=0;j<46;j++){ const a=Math.PI*2*j/46+Math.random()*.3, dd=160+Math.random()*260, c=document.createElement("i"); c.className="cf";
      c.style.cssText=`background:${cols[j%cols.length]};--x:${Math.round(Math.cos(a)*dd)}px;--y:${Math.round(Math.sin(a)*dd-60)}px;--r:${Math.round(Math.random()*900-450)}deg;animation-delay:${Math.round(Math.random()*150)}ms`; ov.appendChild(c); setTimeout(()=>c.remove(),2000); }
    const pv=item?{...gmS.eq,[item.cat]:item.id}:gmS.eq, worn=item&&gmS.eq[item.cat]===item.id;
    ov.querySelector(".loot").innerHTML=leg?`<span class="rar">Légende débloquée</span>${gmBot({...gmS.eq,hero:leg.k,hat:null,aura:null,skin:null,legs:null,feet:null},{cls:"happy cheer"}).replace('class="gmb','class="pv gmb')}<h3>${esc(leg.n)}</h3>
      <p>${esc(leg.s)}.</p><div class="pwr"><b>Pouvoir · ${esc(leg.pw)}</b>${esc(leg.pd)} Actif dès maintenant.</div>
      <div class="row2"><button data-k="later">Plus tard</button><button class="cy" data-k="leg">Jouer avec</button></div>`
      :item?`<span class="rar">${GM_RAR[item.r].t}</span>${gmBot(pv,{cls:"happy idle"}).replace('class="gmb','class="pv gmb')}<h3>${esc(item.n)}</h3>
      <p>${item.say?esc(item.say):pickR(["Il te va à merveille.","Avec ça, la salle va trembler.","Style de champion, ","Les autres vont être jaloux."]).replace(/, $/,`, <b>${esc(myName())}</b>.`)}</p>
      ${item2?`<div class="pwr"><b>Pose classique · 2e objet</b>${esc(item2.n)} (${GM_RAR[item2.r].t.toLowerCase()}) rejoint ta collection.</div>`:""}
      <div class="row2"><button data-k="later">Plus tard</button><button class="cy" data-k="wear">${worn?"Super !":"Le porter"}</button></div>`
      :`<span class="rar">Étoile HMG</span><div style="font-size:84px;line-height:1.4">⭐</div><h3>Collection complète !</h3><p>Tu as déjà tous les objets : <b>+1 étoile</b>. Respect, ${esc(myName())}.</p><div class="row2"><button class="cy" data-k="later">Continuer</button></div>`;
    ov.querySelector(".loot").addEventListener("click",e=>{ const b=e.target.closest("[data-k]"); if(!b) return; e.stopPropagation();
      if(b.dataset.k==="leg"&&leg){ gmS.eq.hero=leg.k; gmS.eq.hat=null; gmS.eq.aura=null; gmS.eq.skin=null; gmS.eq.legs=null; gmS.eq.feet=null; gmSave(); gmPaintHero("happy cheer"); setTimeout(()=>gmPaintHero(),1500); }
      if(b.dataset.k==="wear"&&item){ gmS.eq[item.cat]=item.id; gmSave(); gmPaintHero("happy cheer"); setTimeout(()=>gmPaintHero(),1500); }
      ov.style.transition="opacity .3s"; ov.style.opacity=0; setTimeout(()=>{ ov.remove(); gmMark(GM.pos); gmHud(); res(); },300); }); }
}); }

/* ---------- choix du héros (première fois) */
function gmPickHero(first){ if(GM.pick) return GM.pick; return GM.pick=new Promise(res0=>{ const res=v=>{ GM.pick=null; res0(v); };
  let hero=gmS.eq.hero||"homme", tone=gmS.eq.tone||"clair";
  const ov=document.createElement("div"); ov.className="gm-ov gm-pickov";
  const draw=()=>{ const tc=GM_TONE[hero==="robot"?"robot":"human"];
    ov.innerHTML=`<div class="card glass" role="dialog" aria-label="Choisis ton héros">${first?"":`<button class="x" data-k="x" aria-label="Fermer">${ic("x")}</button>`}
      <div class="kick">L'Aventure HMG</div><h2>${first?"Choisis ton héros":"Change de héros"}</h2>
      <p>${first?`Il démarre en <b>caleçon</b>. Chaque séance validée à la salle le fait avancer d'un pas et grossir ses muscles. Les <b>coffres</b> l'habillent, à ton rythme.`:"Ta collection et ta progression restent les mêmes."}</p>
      <div class="gm-pick">${GM_HEROES.map(h=>`<button data-hero="${h.k}" aria-pressed="${h.k===hero}">${gmBot({...gmS.eq,hero:h.k,tone},{cls:h.k===hero?"happy idle":"idle"})}<b>${h.n}</b><small>${h.s}</small></button>`).join("")}</div>
      <div class="gm-tone">${["clair","fonce"].map(t=>`<button data-tone="${t}" aria-pressed="${t===tone}"><i style="background:${tc[t].s}"></i>${hero==="robot"?(t==="clair"?"Blanc":"Noir"):(t==="clair"?"Peau claire":"Peau noire")}</button>`).join("")}</div>
      <button class="cy gm-go" style="width:100%" data-k="ok">${hero==="femme"?"C'est elle !":hero==="robot"?"C'est mon robot !":"C'est lui !"}</button>
      ${first?`<button type="button" class="gm-acct" data-acct="restore">J'ai déjà un compte sur un autre navigateur</button>`:""}</div>`; };
  draw(); document.body.appendChild(ov);
  ov.addEventListener("click",e=>{ const t=e.target, h=t.closest("[data-hero]"), tn=t.closest("[data-tone]"), k=t.closest("[data-k]");
    if(h){ hero=h.dataset.hero; draw(); gmSnd("pop"); return; } if(tn){ tone=tn.dataset.tone; draw(); return; }
    if(k){ const ok=k.dataset.k==="ok"; if(!ok&&first) return;
      /* d'abord fermer et enregistrer : la fenêtre ne doit jamais rester bloquée, même si un effet plante */
      ov.remove(); if(ok){ gmS.eq.hero=hero; gmS.eq.tone=tone; gmSave(); } res();
      try{ gmHud(); if(ok){ gmPaintHero("happy cheer"); setTimeout(()=>{ try{ gmPaintHero(); }catch(er){} },1500); gmSnd("fanfare"); } }catch(er){} } });
}); }

/* ---------- collection */
function gmColl(){
  const ov=document.createElement("div"); ov.className="gm-ov gm-coll";
  const draw=()=>{ ov.innerHTML=`<div class="card glass" role="dialog" aria-label="Ma collection"><button class="x" data-k="x" aria-label="Fermer">${ic("x")}</button>
    <div class="top">${gmBot(gmS.eq,{cls:"happy idle"})}<h2>Ma collection</h2><div class="cnt"><b>${gmS.items.length}</b> / ${GM_TOTAL} objets${gmS.stars?` · ⭐ ${gmS.stars}`:""} · ${gDays()} séance${gDays()>1?"s":""}</div>
      <div class="cnt mus">💪 Physique <b>${GM_MUS[gmHeroLv()].n}</b>${GM_MUS[gmHeroLv()+1]?` · <span>${GM_MUS[gmHeroLv()+1].n} à ${GM_MUS[gmHeroLv()+1].d} séances</span>`:" · niveau max"}</div>
      <div class="row"><button class="mini" data-k="hero">Changer de héros</button><button class="mini" data-k="share">Partager</button></div></div>
    <div class="body"><h4>Légendes · ${Object.keys(gmS.leg).length}/${GM_LEG.length}</h4><div class="gm-grid leg">${GM_LEG.map((l,i)=>{ const own=gmS.leg[l.k]!=null, on=gmS.eq.hero===l.k;
      return `<button class="gm-it leg${own?" own":" lock"}${on?" on":""}" style="--rc:#ffd166" ${own?`data-hero="${l.k}"`:"disabled"}>${gmBot({...gmS.eq,hero:l.k,hat:null,aura:null,skin:null,legs:null,feet:null},{cls:""})}<b>${own?esc(l.n):"Légende mystère"}</b><small>${esc(l.pw).toUpperCase()}</small><em>${own?esc(l.pd):`Grand coffre à ${20*(i+1)} séances`}</em></button>`; }).join("")}</div>
      ${GM_CATS.map(([c,t])=>`<h4>${t}</h4><div class="gm-grid">${[{id:"",cat:c,n:gmNone(c,gmS.eq),r:"C",def:1}].concat(GM_ITEMS.filter(i=>i.cat===c)).map(i=>{ const own=i.def||gmOwn(i.id), on=(gmS.eq[c]||"")===i.id;
      return `<button class="gm-it${own?" own":" lock"}${on?" on":""}" style="--rc:${GM_RAR[i.r].c}" ${own?`data-eq="${c}:${i.id}"`:"disabled"} aria-label="${esc(i.n)}">${gmBot({...gmS.eq,[c]:i.id||null},{cls:""})}<b>${own?esc(i.n):"???"}</b><small>${i.id?GM_RAR[i.r].t.toUpperCase():""}${i.hmg?" · HMG":""}</small></button>`; }).join("")}</div>`).join("")}
      <p style="color:var(--muted);font-size:12px;margin:16px 0 0">Les objets sortent des coffres au hasard. Ta collection est gardée sur cet appareil, comme tes points.</p></div></div>`; };
  draw(); document.body.appendChild(ov);
  ov.addEventListener("click",async e=>{ const t=e.target, q=t.closest("[data-eq]"), k=t.closest("[data-k]");
    const lh=t.closest("[data-hero]"); if(lh){ gmS.eq.hero=lh.dataset.hero; gmSave(); const sc=ov.querySelector(".body").scrollTop; draw(); ov.querySelector(".body").scrollTop=sc; gmPaintHero("happy cheer"); setTimeout(()=>gmPaintHero(),1400); gmSnd("crown"); return; }
    if(q){ const [c,id]=q.dataset.eq.split(":"); gmS.eq[c]=id||null; gmSave(); const sc=ov.querySelector(".body").scrollTop; draw(); ov.querySelector(".body").scrollTop=sc; gmPaintHero(); gmSnd("pop"); return; }
    if(k||t===ov){ const v=k&&k.dataset.k; ov.remove(); if(v==="hero"){ await gmPickHero(false); } else if(v==="share") gmShare(); } });
}

/* ---------- partager son héros (image story 1080×1920 pour Insta / TikTok) */
async function gmShare(){
  try{
    const d=gDays(), w=Math.floor(d/GM_PER), W=gmWorld(w), cv=document.createElement("canvas"); cv.width=1080; cv.height=1920; const x=cv.getContext("2d");
    const gr=x.createLinearGradient(0,0,0,1920); gr.addColorStop(0,W.c[1]); gr.addColorStop(.5,W.c[0]); gr.addColorStop(1,"#04060b"); x.fillStyle=gr; x.fillRect(0,0,1080,1920);
    const rg=x.createRadialGradient(540,900,40,540,900,620); rg.addColorStop(0,W.wc+"55"); rg.addColorStop(1,"transparent"); x.fillStyle=rg; x.fillRect(0,0,1080,1920);
    const rr=gmRng(7); for(let i=0;i<140;i++){ x.globalAlpha=.2+rr()*.6; x.fillStyle="#fff"; x.beginPath(); x.arc(rr()*1080,rr()*1920,rr()*2.4+.6,0,7); x.fill(); } x.globalAlpha=1;
    const svg=gmBot(gmS.eq,{static:true,w:720,h:882}), img=new Image(); img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
    await new Promise((ok,ko)=>{ img.onload=ok; img.onerror=ko; });
    x.fillStyle="rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(540,1310,250,40,0,0,7); x.fill(); x.drawImage(img,180,440,720,882);
    x.textAlign="center"; x.fillStyle=W.wc; x.font="700 34px 'Space Grotesk',sans-serif"; x.fillText(("MONDE "+(w+1)+" · "+W.n).toUpperCase(),540,250);
    x.fillStyle="#fff"; x.font="700 84px 'Space Grotesk',sans-serif"; x.fillText(myName(),540,350);
    x.font="700 60px 'Space Grotesk',sans-serif"; x.fillText(d+" séance"+(d>1?"s":"")+" à la salle",540,1470);
    x.fillStyle="#c9d3e6"; x.font="500 40px Inter,sans-serif"; x.fillText("💪 "+GM_MUS[gmHeroLv()].n+" · "+gmS.items.length+" / "+GM_TOTAL+" objets",540,1540);
    x.fillStyle=ACC; x.font="700 54px 'Space Grotesk',sans-serif"; x.fillText("hmgfitness.fr",540,1760); x.fillStyle="#93a0b8"; x.font="500 34px Inter,sans-serif"; x.fillText("Explore. Note. Conquiers.",540,1815);
    const blob=await new Promise(r=>cv.toBlob(r,"image/png")), f=new File([blob],"mon-heros-hmg.png",{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],title:"Mon héros HMG",text:"Mon héros avance à chaque séance 💪 hmgfitness.fr"}); }
    else { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="mon-heros-hmg.png"; document.body.appendChild(a); a.click(); a.remove(); toast("Image enregistrée : partage-la en story !"); }
  }catch(e){ if(e&&e.name==="AbortError") return; toast("Partage impossible sur cet appareil.",1); }
}

/* ---------- bascule carte ↔ aventure */
function gmSet(on,silent){
  if(on&&!feat("feat_game")) on=false;
  GM.on=on; document.body.classList.toggle("gm-on",on); store.set("hmg-mode",on?"game":"map");
  const sw=$("modeSw"); sw.classList.toggle("game",on); sw.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.mode==="game")===on)));
  if(on){ if(!silent){ SND.want=true; SND.unlock(); } closeSheet(); closeMe();
    if(!$("game")){ const g=document.createElement("div"); g.id="game"; g.innerHTML=`<div class="gm-scroll"><div class="gm-world"></div></div><div class="gm-hud glass"></div><div class="gm-cta"></div>`; document.body.appendChild(g); gmBind(g); }
    gmSky();
    GM.ghosts=null; gmBuild(gmS.seen==null?Math.max(0,gDays()-1):Math.min(gmS.seen,gDays())); gmHud(); setTimeout(gmSync,silent?900:450); }
  else { SND.want=false; }
}
function gmBind(g){
  const sc=g.querySelector(".gm-scroll"); let dr=null, raf=0;
  sc.addEventListener("scroll",()=>{ if(raf) return; raf=requestAnimationFrame(()=>{ raf=0; const b=g.querySelector(".gm-say"); if(b&&b._fit) b._fit(); }); },{passive:true});
  sc.addEventListener("pointerdown",e=>{ if(e.pointerType!=="mouse"||e.button!==0) return; dr={x:e.clientX,y:e.clientY,l:sc.scrollLeft,t:sc.scrollTop,m:false}; });
  addEventListener("pointermove",e=>{ if(!dr) return; const ddx=e.clientX-dr.x, ddy=e.clientY-dr.y;
    if(!dr.m&&Math.abs(ddx)+Math.abs(ddy)>6){ dr.m=true; sc.classList.add("drag"); } if(dr.m){ sc.scrollLeft=dr.l-ddx; sc.scrollTop=dr.t-ddy; } });
  addEventListener("pointerup",()=>{ if(dr&&dr.m){ GM.drag=Date.now(); sc.classList.remove("drag"); } dr=null; });
  g.addEventListener("click",async e=>{ if(Date.now()-(GM.drag||0)<300) return; const t=e.target, b=t.closest("[data-gm]");
    if(b){ const k=b.dataset.gm;
      if(k==="go"){ if(score.today){ gmSay(pickR(["Repos mérité. À demain, champion.","Ton héros récupère. Toi aussi.","Demain, on avance encore !"])); return; } if(!ptsOn()){ toast("Bientôt disponible !"); return; } doCheckin(); }
      else if(k==="coll") gmColl(); else if(k==="share") gmShare();
      else if(k==="t1"||k==="t5"){ store.set("hmg-game-test",gmTest()+(k==="t1"?1:5)); gmHud(); gmSync(); }
      else if(k==="t0"){ store.set("hmg-game-test",0); Object.assign(gmS,{seen:null,open:[],items:[],stars:0,leg:{}}); gmS.eq={...GM_EQ0}; gmSave(); toast("Test remis à zéro : ton aventure repart du début."); gmSet(true); }
      else if(k==="th"){ GM.hideTest=true; gmHud(); }
      else if(k==="ts"){ const t=store.get("hmg-season-test",""), nx=GM_SSN_T[(GM_SSN_T.indexOf(GM_SSN[t]?t:"")+1)%GM_SSN_T.length]; store.set("hmg-season-test",nx); gmSky(); gmBuild(GM.pos); gmHud(); toast(nx?"Saison de test : "+GM_SSN[nx].n+" (toi seul).":"Saison automatique, selon la date."); }
      return; }
    const ch=t.closest("[data-chest]"); if(ch&&ch.classList.contains("ready")&&!GM.busy){ GM.busy=true; await gmOpenChest(+ch.dataset.chest); GM.busy=false; gmHud(); return; }
    const gh=t.closest("[data-ghost]"); if(gh){ toast(gh.dataset.ghost); return; }
    if(t.closest("#gmHero")&&!GM.busy){ const hr=$("gmHero"); hr.classList.remove("gm-jump"); void hr.offsetWidth; hr.classList.add("gm-jump"); gmSnd("pop");
      const was=gmMood(); gmHeroCls("happy idle"); setTimeout(()=>gmHeroCls(was),1800);
      const d=gDays(), left=gmNextChest(d)-d;
      const ss=gmSeason(), nu=!gmS.eq.skin&&!GM_LG[gmS.eq.hero], sl={hiver:nu?"Brrr… il caille ! Vite, un t-shirt.":"Il neige dehors, mais à la salle il fait chaud !",printemps:"Le printemps, la saison des gains !",ete:nu?"En caleçon ? Parfait pour l'été !":"Objectif été : on y est presque !",automne:"Les feuilles tombent, pas ta motivation."}[ss];
      if(Math.random()<.4){ gmSay(sl); return; }
      gmSay(pickR([`Prêt pour la séance, <b>${esc(myName())}</b> ?`,`Encore <b>${left}</b> séance${left>1?"s":""} et on ouvre un coffre !`,"On forme une sacrée équipe, toi et moi.","Tu es plus fort qu'hier.",gmMood()==="sleep"?"Zzz… on y va demain matin ?":"Allez, on va soulever de la fonte !"])); } });
  addEventListener("resize",()=>{ if(GM.on&&!GM.busy){ clearTimeout(GM.rz); GM.rz=setTimeout(()=>gmBuild(gmS.seen==null?gDays():Math.min(gmS.seen,gDays())),200); } });
}
$("modeSw").addEventListener("click",e=>{ const b=e.target.closest("[data-mode]"); if(b) gmSet(b.dataset.mode==="game"); });


/* ================= DÉMARRAGE ================ */
(async function init(){
  updateLabels();
  const introSafety=setTimeout(()=>$("intro").classList.add("out"),1200);
  if(session&&LIVE){ if(!(await refresh())) session=null; }
  try{ await loadAll(); }catch(e){ toast("Avis indisponibles pour le moment.",1); }
  computeStats(); applyAdminUi();
  const order=CLUBS.filter(c=>!isDom(c)).map(c=>({c,p:pos(c)})).filter(x=>x.p).sort((a,b)=>b.p.lat-a.p.lat);
  order.forEach(x=>drawMarker(x.c)); pinWave();
  updateHeader();
  if(/^#compte=/.test(location.hash)) acctFromHash();
  if(store.get("hmg-acct-welcome",false)){ store.set("hmg-acct-welcome",false); setTimeout(()=>toast("Compte retrouvé : bon retour parmi nous !"),1200); }
  clearTimeout(introSafety); welcome(); refreshScore();
  if(feat("feat_game")&&location.hash!=="#carte"&&(location.hash==="#aventure"||store.get("hmg-mode","game")==="game")) gmSet(true,true);
  setTimeout(appInvite,feat("feat_game")?9000:6500);
  setTimeout(angelCheck,1600);
  if(needPseudo()) setTimeout(()=>{ if(needPseudo()&&!document.querySelector(".modal")) pseudoModal(true); }, feat("feat_profile")?650:(store.get("hmg-last-visit",null)?1700:2100));
  const h=decodeURIComponent(location.hash.slice(1)); if(byId[h]) setTimeout(()=>openClub(h,true),900); else if(h==="admin"&&!isAdmin()) setTimeout(loginModal,900);
  const n=await geocodeMissing();
  if(isAdmin()&&LIVE) saveGeo().catch(()=>{}); // l'admin enregistre les positions exactes pour tous les visiteurs (et pour vérifier « Je suis à la salle »)
})();
if(window.visualViewport) visualViewport.addEventListener("resize",()=>map.invalidateSize());
addEventListener("orientationchange",()=>setTimeout(()=>map.invalidateSize(),300));
addEventListener("hashchange",()=>{ const h=decodeURIComponent(location.hash.slice(1)); if(byId[h]) openClub(h,true); else if(h==="admin"&&!isAdmin()&&!document.querySelector(".modal")) loginModal(); });
