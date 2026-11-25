"use strict";
/* ================= L'APPLI À ONGLETS (coque) =================
   Aventure · Salles · Classement · Moi, comme une vraie appli iPhone (3-ux-appli.md §2).
   Chargé après js/app.js : s'appuie sur ses fonctions globales (gmSet, gmBot, rpc, score…).
   Les cœurs (js/coeurs.js) et l'accueil des nouveaux (js/accueil.js) se branchent sur l'objet CQ ci-dessous.
   Données du joueur : window.HMGS (js/serveur.js) quand il est là, sinon l'ancien fonctionnement du site. */
const CQ = { tab:null, page:null, sub:null, rgP:"month", hooks:{moi:[], reglages:[]} };
const APPLI = window.HMG_CIBLE === "appli";
const CQ_VERSION = "1.0.0";

/* ---------- icônes (traits de 24 px, style SF Symbols) */
const CQI = {
  aventure:'<circle cx="12" cy="8.3" r="5.2"/><path d="M10.1 7.8v1.3M13.9 7.8v1.3"/><path d="M4.4 21.6c.7-4.3 3.8-7.1 7.6-7.1s6.9 2.8 7.6 7.1"/><path class="fill" stroke="none" d="m12.9 15.6-2.6 3.3h1.9l-.9 2.7 2.8-3.6h-2z"/>',
  salles:'<path d="M12 21.8s-7.4-6.1-7.4-12a7.4 7.4 0 0 1 14.8 0c0 5.9-7.4 12-7.4 12z"/><circle cx="12" cy="9.8" r="2.7"/>',
  classement:'<path d="M8 21h8M12 16.8V21M7 3.8h10v5.1a5 5 0 0 1-10 0z"/><path d="M17 5.2h3v1.6a3.3 3.3 0 0 1-3.3 3.3M7 5.2H4v1.6a3.3 3.3 0 0 0 3.3 3.3"/>',
  moi:'<circle cx="12" cy="12" r="9.6"/><circle cx="12" cy="9.9" r="3.3"/><path d="M6.3 18.7c1.3-2.3 3.4-3.6 5.7-3.6s4.4 1.3 5.7 3.6"/>',
  gear:'<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chev:'<path d="m9 6 6 6-6 6"/>', back:'<path d="m15 5-7 7 7 7"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>',
  sac:'<path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  swap:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>', share:'<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>', pause:'<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="m9.2 4.3 2.8 2 2.8-2M9.2 19.7l2.8-2 2.8 2M4.6 10.6l3.1-1.3-.4-3.4M19.4 13.4l-3.1 1.3.4 3.4M4.6 13.4l3.1 1.3-.4 3.4M19.4 10.6l-3.1-1.3.4-3.4"/>',
  pin:'<path d="M12 21.8s-7.4-6.1-7.4-12a7.4 7.4 0 0 1 14.8 0c0 5.9-7.4 12-7.4 12z"/><circle cx="12" cy="9.8" r="2.7"/>',
  bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>', sound:'<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  vib:'<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M3 8v8M21 8v8"/>', user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M15 8l2 2"/>', loc:'<path d="m3 11 19-9-9 19-2-8z"/>',
  data:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>', doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', help:'<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 4"/><path d="M12 17.5h.01"/>',
  play:'<circle cx="12" cy="12" r="9.5"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>', mail:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  info:'<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/>', flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', heart:'<path d="M12 20.5s-7.3-4.4-9.3-8.9C1.3 8.3 3.2 4.6 6.8 4.6c2 0 3.5 1.2 5.2 3 1.7-1.8 3.2-3 5.2-3 3.6 0 5.5 3.7 4.1 7-2 4.5-9.3 8.9-9.3 8.9z"/>',
  admin:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>', bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'
};
const cqI = (n, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls?` class="${cls}"`:""}>${CQI[n]||""}</svg>`;
const cqVib = k => { if(store.get("hmg-vib",true)===false) return; try{ if(window.HMGN&&HMGN.vibrer) HMGN.vibrer(k); else if(navigator.vibrate&&!(navigator.userActivation&&!navigator.userActivation.hasBeenActive)) navigator.vibrate(k==="succes"?[12,60,24]:k==="alerte"?[30,50,30]:8); }catch(e){} };
const cqOuvrir = url => { try{ if(window.HMGN&&HMGN.ouvrir) return HMGN.ouvrir(url); }catch(e){} window.open(url,"_blank","noopener"); };
const cqSite = p => (APPLI?"https://hmgfitness.fr/":"")+p;

/* ---------- les vibrations suivent le réglage « Vibrations » */
if(navigator.vibrate){ const v0=navigator.vibrate.bind(navigator); try{ navigator.vibrate=function(p){ if(store.get("hmg-vib",true)===false||(navigator.userActivation&&!navigator.userActivation.hasBeenActive)) return false; return v0(p); }; }catch(e){} }

/* ---------- barre d'onglets */
const CQ_TABS=[["aventure","Aventure"],["salles","Salles"],["classement","Classement"],["moi","Moi"]];
function cqBar(){
  const n=document.createElement("nav"); n.id="cqTabs"; n.setAttribute("role","tablist"); n.setAttribute("aria-label","Onglets");
  n.innerHTML=CQ_TABS.map(([k,t])=>`<button role="tab" data-tab="${k}" aria-selected="false" aria-label="${t}">${cqI(k)}<span>${t}</span></button>`).join("");
  n.addEventListener("click",e=>{ const b=e.target.closest("[data-tab]"); if(b) cqTab(b.dataset.tab); });
  document.body.appendChild(n);
}
function cqMark(t){
  CQ.tab=t; const B=document.body.classList; ["aventure","salles","classement","moi"].forEach(k=>B.toggle("t-"+k,k===t));
  document.querySelectorAll("#cqTabs [data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===t)));
}
function cqTab(t,o={}){
  if(CQ.tab===t&&!o.force){ // toucher l'onglet déjà ouvert : remonter en haut / recentrer
    if(CQ.sub){ cqSubClose(); return; }
    const b=CQ.page&&CQ.page.querySelector(".cq-body"); if(b) b.scrollTo({top:0,behavior:"smooth"});
    if(t==="aventure"&&GM.on&&!GM.busy) try{ gmMark(GM.pos); }catch(e){}
    if(t==="salles") try{ $("bMe").click(); }catch(e){}
    return; }
  cqVib("choix"); cqSubClose(true); cqMark(t);
  if(t==="aventure"){ cqPageClose(); CQ.lock=true; try{ if(!GM.on) gmSet(true); }finally{ CQ.lock=false; } }
  else if(t==="salles"){ cqPageClose(); CQ.lock=true; try{ if(GM.on) gmSet(false); }finally{ CQ.lock=false; } setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} },60); }
  else if(t==="classement") cqRang();
  else cqMoi();
  try{ history.replaceState(null,"",location.pathname+location.search+(t==="aventure"?"":"#"+(t==="salles"?"carte":t))); }catch(e){}
}

/* ---------- pages pleine hauteur */
function cqPage(id,titre,o={}){
  let p=$("pg-"+id);
  if(!p||p!==CQ.page){ cqPageClose(); p=document.createElement("section"); p.id="pg-"+id; p.className="cq-page"; p.setAttribute("aria-label",titre);
    p.innerHTML=`<header class="cq-head"><h1>${esc(titre)}</h1>${o.gear?`<button class="ico" data-cq="reglages" aria-label="Réglages">${cqI("gear")}</button>`:""}</header><div class="cq-body"></div>`;
    document.body.appendChild(p); CQ.page=p; p.addEventListener("click",cqClick); }
  return p.querySelector(".cq-body");
}
function cqPageClose(){ if(CQ.page){ CQ.page.remove(); CQ.page=null; } }
function cqSub(id,titre){ // page qui glisse par-dessus (Réglages)
  cqSubClose(true); const p=document.createElement("section"); p.id="pg-"+id; p.className="cq-page sub"; p.setAttribute("aria-label",titre);
  p.innerHTML=`<header class="cq-head"><button class="back" data-cq="retour">${cqI("back")}Retour</button></header><div class="cq-body"><h1 style="margin:0 4px 6px;font:700 30px/1.1 var(--f-d);color:#fff">${esc(titre)}</h1></div>`;
  document.body.appendChild(p); CQ.sub=p; p.addEventListener("click",cqClick); return p.querySelector(".cq-body"); }
function cqSubClose(now){ if(!CQ.sub) return; const p=CQ.sub; CQ.sub=null; if(now) p.remove(); else { p.style.transition="transform .25s"; p.style.transform="translateX(100%)"; setTimeout(()=>p.remove(),250); } }

/* ---------- feuille du bas (style iOS) : cqFeuille(html, {fermer:false}) → {el, fermer} */
function cqFeuille(html,o={}){
  const m=document.createElement("div"); m.className="cq-sheet"; m.innerHTML=`<div class="sh" role="dialog" aria-modal="true"><div class="grab"></div>${o.croix===false?"":`<button class="x" data-sh-x aria-label="Fermer">${cqI("x")}</button>`}${html}</div>`;
  document.body.appendChild(m);
  const fermer=()=>{ if(m.classList.contains("out")) return; m.classList.add("out"); setTimeout(()=>m.remove(),220); if(o.apres) try{ o.apres(); }catch(e){} };
  m.addEventListener("click",e=>{ if((e.target===m&&o.fond!==false)||e.target.closest("[data-sh-x]")) fermer(); });
  /* glisser vers le bas pour fermer */
  const sh=m.firstElementChild; let y0=null, dy=0;
  sh.addEventListener("touchstart",e=>{ if(sh.scrollTop>0||o.fond===false){ y0=null; return; } y0=e.touches[0].clientY; dy=0; },{passive:true});
  sh.addEventListener("touchmove",e=>{ if(y0==null) return; dy=Math.max(0,e.touches[0].clientY-y0); sh.style.transform=`translateY(${dy}px)`; },{passive:true});
  sh.addEventListener("touchend",()=>{ if(y0==null) return; y0=null; sh.style.transform=""; if(dy>90) fermer(); });
  return {el:m, fermer};
}

/* ---------- les clics des pages */
function cqClick(e){
  const b=e.target.closest("[data-cq]"); if(!b) return; const k=b.dataset.cq;
  const A={
    retour:()=>cqSubClose(), reglages:()=>cqReglages(), vestiaire:()=>gmColl(), heros:()=>gmPickHero(false).then(()=>{ if(CQ.tab==="moi") cqMoi(); }), partager:()=>gmShare(),
    objectif:()=>cqObjectif(), pause:()=>(window.HMGC&&HMGC.pause)?HMGC.pause():toast("La pause arrive avec la prochaine mise à jour."), masalle:()=>cqMaSalle(),
    pseudo:()=>pseudoModal(false), code:()=>acctModal("save"), donnees:()=>cqDonnees(), suppr:()=>cqSupprimer(),
    politique:()=>cqOuvrir(cqSite("confidentialite/")), regles:()=>cqOuvrir(cqSite("regles/")), aide:()=>cqOuvrir(cqSite("aide/")), contact:()=>cqOuvrir(cqSite("aide/#contact")),
    signalersalle:()=>cqOuvrir(cqSite("aide/#salle")), coeurs:()=>cqCommentCoeurs(), presentation:()=>{ if(window.HMGA) HMGA.lancer(true); }, apropos:()=>cqAPropos(),
    position:()=>cqPosition(), admin:()=>{ cqTab("salles"); setTimeout(()=>{ try{ isAdmin()?toast("Tu es déjà connecté en admin."):loginModal(); }catch(er){} },300); },
    salle:()=>{ const id=b.dataset.id; cqTab("salles"); setTimeout(()=>{ try{ openClub(id,true); }catch(er){} },250); },
    rgP:()=>{ CQ.rgP=b.dataset.p; cqRang(); }
  };
  if(b.getAttribute("role")==="switch"){ cqSwitch(b); return; }
  if(A[k]){ cqVib("choix"); A[k](); }
}

/* ================= CLASSEMENT ================= */
async function cqRang(load=true){
  const body=cqPage("classement","Classement"), mo=CQ.rgP==="month", rows=rankRows[CQ.rgP];
  const sean=r=>Math.round((r.points||0)/10), mine=rows&&rows.findIndex(r=>r.me);
  const pod=rows&&rows.length?[1,0,2].map(i=>rows[i]?`<div class="pl p${i+1}"><div class="av" style="--c:${["linear-gradient(135deg,#fff1b0,#ffd166 60%,#d9a400)","linear-gradient(135deg,#ffffff,#cfd8ea 60%,#8f9bb3)","linear-gradient(135deg,#ffd2ae,#f0a067 60%,#b8642c)"][i]};--g:${["rgba(255,209,102,.45)","rgba(200,210,230,.3)","rgba(240,160,103,.35)"][i]}">${esc((nameOf(rows[i].no)||"?").slice(0,1).toUpperCase())}<i>${i+1}</i></div><b>${esc(nameOf(rows[i].no))}${rows[i].me?" (toi)":""}</b><small>${sean(rows[i])} séance${sean(rows[i])>1?"s":""}</small><div class="step" style="--h:${[64,44,30][i]}px"></div></div>`:`<div class="pl"></div>`).join(""):"";
  const lundi=[1,2].includes(new Date().getDay());
  body.innerHTML=`<div class="rg-seg" role="tablist"><button role="tab" data-cq="rgP" data-p="month" aria-selected="${mo}">Ce mois-ci</button><button role="tab" data-cq="rgP" data-p="all" aria-selected="${!mo}">Depuis le début</button></div>
    ${mine>4?`<div class="rg-pin">Toi : <b>${mine+1}e</b> · ${sean(rows[mine])} séance${sean(rows[mine])>1?"s":""}</div>`:""}
    ${lundi&&typeof crowned==="function"&&crowned()?`<div class="rg-ange"><span>👼</span><div><b>Tu es l'ange de la semaine !</b><br>3 séances ou plus la semaine dernière. Respect.</div></div>`:""}
    ${rows===undefined?`<div class="cq-empty">Chargement…</div>`:rows===null?`<div class="cq-empty">Le classement est indisponible pour le moment. Réessaie dans un instant.</div>`:!rows.length?`<div class="cq-empty">Personne n'a encore validé de séance${mo?" ce mois-ci":""}.<br><b style="color:#fff">La première place t'attend.</b></div>`:
      `<div class="rg-pod">${pod}</div><div class="cq-list">${rows.slice(3).map((r,i)=>`<div class="rg-row${r.me?" me":""}"><span class="n">${i+4}</span><div style="min-width:0"><b>${esc(nameOf(r.no))}${r.me?" (toi)":""}</b><small>${r.clubs} salle${r.clubs>1?"s":""}</small></div><em>${sean(r)}<small>séance${sean(r)>1?"s":""}</small></em></div>`).join("")||`<div class="cq-empty" style="padding:18px">Le podium est complet. Le reste du classement s'écrit avec toi.</div>`}</div>`}
    <p class="cq-note" style="text-align:center;margin-top:18px">Une séance validée par jour, sur place. Ta position sert seulement à vérifier que tu es à la salle : elle n'est jamais montrée.</p>`;
  if(load){ try{ rankRows[CQ.rgP]=LIVE?await rpc("leaderboard",{p_period:CQ.rgP,p_voter:voterId}):[]; }catch(e){ rankRows[CQ.rgP]=rankRows[CQ.rgP]||null; }
    if(CQ.tab==="classement") cqRang(false); }
}

/* ================= MOI ================= */
const cqSemaine = () => { const d=new Date(), j=(d.getDay()+6)%7, l=new Date(d); l.setDate(d.getDate()-j); return Array.from({length:7},(_,i)=>{ const x=new Date(l); x.setDate(l.getDate()+i); return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); }); };
const cqJours = () => { const st=window.HMGC&&HMGC.etat; if(st&&st.week&&Array.isArray(st.week.days)) return st.week.days.map(x=>x.d||x); return store.get("hmg-seances",[]); };
const cqObj = () => { const st=window.HMGC&&HMGC.etat; return (st&&st.goal)||store.get("hmg-objectif",3); };
const CQ_OBJ={2:"Je reprends",3:"Le bon rythme",4:"Motivé",5:"À fond"};
function cqMoi(){
  const body=cqPage("moi","Moi",{gear:true}); const st=window.HMGC&&HMGC.etat;
  const lv=GM_MUS[gmHeroLv()]||GM_MUS[0], d=gDays(), avis=db.reviews.filter(r=>visitorOf(r)===myNo).length;
  const sem=cqSemaine(), jours=new Set(cqJours()), auj=today();
  const ma=byId[store.get("hmg-ma-salle",null)], vis=Object.keys(myVisits||{}).filter(id=>byId[id]&&id!==(ma&&ma.id)).slice(0,4);
  const coeurs=window.HMGC&&HMGC.coeursHtml?HMGC.coeursHtml(24):"";
  body.innerHTML=`<div class="cq-card moi-hero"><button class="moi-av" data-cq="vestiaire" aria-label="Ouvrir le vestiaire">${gmBot(gmS.eq,{cls:"happy idle"})}${typeof crowned==="function"&&crowned()?`<span class="crown" aria-label="Ange de la semaine">👑</span>`:""}</button>
      <div class="moi-id"><h2>${esc(myName())}</h2><div class="lv">💪 ${esc(lv.n)}</div>${coeurs?`<div class="hearts">${coeurs}${st&&st.streak?`<small>${st.streak} sem. d'affilée</small>`:""}</div>`:""}</div></div>
    <div class="moi-stats"><div><b>${d}</b><small>séance${d>1?"s":""}</small></div><div><b>${st?st.streak||0:score.streak||0}</b><small>${st?"semaines d'affilée":"jours d'affilée"}</small></div><div><b>${score.clubs||0}</b><small>salle${(score.clubs||0)>1?"s":""}</small></div><div><b>${avis}</b><small>avis</small></div></div>
    <div class="cq-sec">Mon héros</div>
    <div class="moi-acts"><button data-cq="vestiaire">${cqI("sac")}Vestiaire</button><button data-cq="heros">${cqI("swap")}Changer de héros</button><button data-cq="partager">${cqI("share")}Partager</button></div>
    <div class="cq-sec">Ma semaine</div>
    <div class="cq-card"><button class="cq-row" data-cq="objectif" style="padding:0;min-height:44px"><span class="rt"><b>${cqObj()} séances par semaine</b><small>${esc(CQ_OBJ[cqObj()]||"")} · Modifier</small></span>${cqI("chev","chev")}</button>
      <div class="cal">${["L","M","M","J","V","S","D"].map(x=>`<span class="h">${x}</span>`).join("")}${sem.map(x=>`<span class="${jours.has(x)?"on":""}${x===auj?" today":""}">${+x.slice(8)}</span>`).join("")}</div></div>
    <div class="cq-sec">Mes salles</div>
    <div class="cq-list">${ma?`<button class="cq-row" data-cq="salle" data-id="${esc(ma.id)}"><span class="ri">${cqI("pin")}</span><span class="rt">${esc(ma.n)}<small>Ma salle</small></span>${cqI("chev","chev")}</button>`:`<button class="cq-row" data-cq="masalle"><span class="ri">${cqI("pin")}</span><span class="rt">Choisir ma salle<small>Elle s'affiche en premier sur la carte</small></span>${cqI("chev","chev")}</button>`}
      ${vis.map(id=>`<button class="cq-row" data-cq="salle" data-id="${esc(id)}"><span class="ri" style="background:rgba(255,209,102,.14);color:#ffd166">${cqI("pin")}</span><span class="rt">${esc(byId[id].n)}<small>${esc(byId[id].c||"")}</small></span>${cqI("chev","chev")}</button>`).join("")}</div>
    <div class="cq-sec">Mes avis</div>
    <div class="cq-list">${avis?db.reviews.filter(r=>visitorOf(r)===myNo).slice(0,5).map(r=>`<button class="cq-row" data-cq="salle" data-id="${esc(r.club_id)}"><span class="ri" style="font:800 13px var(--f-d)">${esc(r.rating)}</span><span class="rt">${esc((byId[r.club_id]||{}).n||"Salle")}<small>${esc(r.comment||"Note sans commentaire")}</small></span>${cqI("chev","chev")}</button>`).join(""):`<div class="cq-empty" style="padding:20px">Pas encore d'avis. Note ta salle sur 10 depuis l'onglet Salles.</div>`}</div>`;
  CQ.hooks.moi.forEach(f=>{ try{ f(body); }catch(e){} });
}

/* ================= RÉGLAGES ================= */
const cqNotif = () => Object.assign({danger:true,arrivee:true,bilan:true,rappel:false}, store.get("hmg-notif",{}));
function cqSwitch(b){
  const on=b.getAttribute("aria-checked")!=="true"; b.setAttribute("aria-checked",String(on)); const k=b.dataset.cq;
  if(k==="son"){ try{ SND.mute(!on); }catch(e){} }
  else if(k==="vib"){ store.set("hmg-vib",on); if(on) cqVib("choix"); }
  else if(k.startsWith("n-")){ const n=cqNotif(); n[k.slice(2)]=on; store.set("hmg-notif",n); try{ if(window.HMGN&&HMGN.notifs&&window.HMGC&&HMGC.etat) HMGN.notifs.programmer(HMGC.etat,n); }catch(e){} }
  else if(k==="doux"){ if(window.HMGC&&HMGC.doux) HMGC.doux(on); }
  else cqVib("choix");
}
function cqReglages(){
  const body=cqSub("reglages","Réglages"), n=cqNotif(), st=window.HMGC&&HMGC.etat, ma=byId[store.get("hmg-ma-salle",null)];
  const row=(k,ic,t,v,sm)=>`<button class="cq-row" data-cq="${k}"><span class="ri">${cqI(ic)}</span><span class="rt">${t}${sm?`<small>${sm}</small>`:""}</span>${v!=null?`<span class="rv">${v}</span>`:""}${cqI("chev","chev")}</button>`;
  const sw=(k,ic,t,on,sm)=>`<button class="cq-row" role="switch" data-cq="${k}" aria-checked="${!!on}"><span class="ri">${cqI(ic)}</span><span class="rt">${t}${sm?`<small>${sm}</small>`:""}</span><span class="cq-sw"></span></button>`;
  body.insertAdjacentHTML("beforeend",`
    <div class="cq-sec">Entraînement</div><div class="cq-list">
      ${row("objectif","target","Objectif par semaine",cqObj()+" séances")}
      ${row("pause","pause","Mode pause",st&&st.pause?"En pause":null,"Vacances, blessure : tes cœurs sont gelés")}
      ${row("masalle","pin","Ma salle",ma?esc(ma.n):"À choisir")}</div>
    <div class="cq-sec">Notifications</div><div class="cq-list">
      ${sw("n-danger","heart","Cœur en danger",n.danger)}${sw("n-arrivee","pin","Arrivée à ma salle",n.arrivee)}${sw("n-bilan","bell","Bilan du lundi",n.bilan)}${sw("n-rappel","bell","Rappel de séance",n.rappel,"Désactivé par défaut")}</div>
    ${APPLI?"":`<p class="cq-note">Sur le site, rien n'est envoyé : les rappels arrivent avec l'appli iPhone.</p>`}
    <div class="cq-sec">Sons et vibrations</div><div class="cq-list">
      ${sw("son","sound","Sons du jeu",(()=>{ try{ return SND.on(); }catch(e){ return true; } })())}${sw("vib","vib","Vibrations",store.get("hmg-vib",true)!==false)}</div>
    <div class="cq-sec">Compte</div><div class="cq-list">
      ${row("pseudo","user","Pseudo",esc(myName()))}${row("code","key","Code de secours",null,"Pour retrouver ton héros sur un autre téléphone")}</div>
    <div class="cq-sec">Confidentialité</div><div class="cq-list">
      ${row("position","loc","Localisation",null,"Seulement quand l'appli est ouverte")}${row("donnees","data","Mes données","Télécharger")}
      ${row("politique","shield","Politique de confidentialité")}${row("regles","doc","Règles de la communauté")}</div>
    <div class="cq-sec">Aide</div><div class="cq-list">
      ${row("coeurs","heart","Comment marchent les cœurs ?")}${row("presentation","play","Revoir la présentation")}${row("contact","mail","Contacter HMG")}${row("signalersalle","flag","Signaler une salle mal placée")}</div>
    <div class="cq-sec">À propos</div><div class="cq-list">${row("apropos","info","HMG Fitness","Version "+CQ_VERSION)}
      ${APPLI?"":row("admin","admin","Espace admin",null,"Réservé à l'équipe HMG")}</div>
    <div class="cq-list" style="margin-top:26px"><button class="cq-row danger" data-cq="suppr">Supprimer mon compte</button></div>
    <p class="cq-note" style="text-align:center">HMG est une appli indépendante, non affiliée aux enseignes de salles citées.</p>`);
  CQ.hooks.reglages.forEach(f=>{ try{ f(body); }catch(e){} });
}

/* ---------- objectif par semaine */
function cqObjectif(){
  let v=cqObj();
  const f=cqFeuille(`<h2>Combien de séances par semaine ?</h2><p>Ton héros a 3 cœurs. Tiens au moins la moitié de ton objectif chaque semaine pour les garder. Le changement compte à partir de lundi prochain.</p>
    <div class="cq-choice" role="radiogroup">${[2,3,4,5].map(n=>`<button role="radio" data-n="${n}" aria-checked="${n===v}"><b>${n}</b> séances <small>· ${CQ_OBJ[n]}</small>${n===3?`<span class="tag">Conseillé</span>`:""}</button>`).join("")}</div>
    <button class="cq-btn" data-ok>Valider mon objectif</button><p class="cq-note" style="text-align:center">Le repos fait partie de l'entraînement : pas besoin d'y aller tous les jours.</p>`);
  f.el.addEventListener("click",async e=>{ const c=e.target.closest("[data-n]"); if(c){ v=+c.dataset.n; f.el.querySelectorAll("[data-n]").forEach(x=>x.setAttribute("aria-checked",String(+x.dataset.n===v))); cqVib("choix"); return; }
    if(!e.target.closest("[data-ok]")) return; store.set("hmg-objectif",v);
    try{ if(window.HMGS&&HMGS.objectif){ const r=await HMGS.objectif(v); if(r&&r.ok===false&&r.why==="trop_tot"){ toast(`Tu pourras le changer à partir du ${frDate(r.next_date)}.`); f.fermer(); return; } } }catch(er){}
    f.fermer(); cqVib("succes"); toast(`Objectif : ${v} séances par semaine, à partir de lundi.`); if(window.HMGC&&HMGC.rafraichir) HMGC.rafraichir(); if(CQ.sub) cqReglages(); else if(CQ.tab==="moi") cqMoi(); });
}

/* ---------- ma salle : les plus proches, ou une recherche */
function cqSallesProches(p,n=3){ return CLUBS.filter(c=>!c.s).map(c=>{ const q=pos(c); return q?{c,d:mDist(p,q)}:null; }).filter(Boolean).sort((a,b)=>a.d-b.d).slice(0,n); }
function cqChercher(q,n=8){ const f=fold(q.trim()); if(f.length<2) return []; return CLUBS.filter(c=>fold([c.n,c.c,c.cp,c.a].join(" ")).includes(f)).slice(0,n).map(c=>({c})); }
const cqGymsHtml = (L,sel) => L.map(({c,d})=>`<button role="radio" data-gym="${esc(c.id)}" aria-checked="${c.id===sel}"><span class="pin">${cqI("pin")}</span><span style="min-width:0"><b>${esc(c.n)}</b><small>${esc([c.cp,c.c].filter(Boolean).join(" "))}${c.s?" · ouverture prochaine":""}</small></span>${d!=null?`<em>${fmtDist(d)}</em>`:""}</button>`).join("");
function cqMaSalle(){
  let sel=store.get("hmg-ma-salle",null), here=store.get("hmg-last-pos",null);
  const f=cqFeuille(`<h2>C'est où, ta salle ?</h2><p>On la garde en favori. Tu peux quand même valider tes séances dans toutes les salles de la carte.</p>
    <input class="cq-field" id="cqGymQ" type="search" placeholder="Ville, code postal ou nom de la salle" autocomplete="off" enterkeyhint="search">
    <div class="cq-gyms" id="cqGymL" role="radiogroup"></div><button class="cq-btn" data-ok ${sel?"":"disabled"}>C'est ma salle</button>`);
  const L=f.el.querySelector("#cqGymL"), Q=f.el.querySelector("#cqGymQ"), ok=f.el.querySelector("[data-ok]");
  const draw=()=>{ const r=Q.value.trim()?cqChercher(Q.value):here?cqSallesProches(here,4):(sel&&byId[sel]?[{c:byId[sel]}]:[]); L.innerHTML=r.length?cqGymsHtml(r,sel):`<div class="cq-empty" style="padding:14px">${Q.value.trim()?"Aucune salle trouvée. Essaie une ville ou un code postal.":"Tape ta ville ou le nom de ta salle."}</div>`; };
  Q.addEventListener("input",draw); draw();
  L.addEventListener("click",e=>{ const b=e.target.closest("[data-gym]"); if(!b) return; sel=b.dataset.gym; ok.disabled=false; L.querySelectorAll("[data-gym]").forEach(x=>x.setAttribute("aria-checked",String(x===b))); cqVib("choix"); });
  ok.addEventListener("click",()=>{ if(!sel) return; store.set("hmg-ma-salle",sel); try{ if(window.HMGS&&HMGS.maSalle) HMGS.maSalle(sel); }catch(e){} f.fermer(); cqVib("succes"); toast(`${byId[sel].n} est ta salle.`); try{ drawMarker(byId[sel]); }catch(e){} if(CQ.sub) cqReglages(); else if(CQ.tab==="moi") cqMoi(); });
}

/* ---------- mes données, position, aide, à propos */
async function cqDonnees(){
  let data=null; try{ if(window.HMGS&&HMGS.exporter) data=await HMGS.exporter(); }catch(e){}
  if(!data){ data={appareil:{pseudo:myPseudo,numero:myNo,heros:gmS.eq,collection:gmS.items,seances:score.days||0,objectif:cqObj(),ma_salle:store.get("hmg-ma-salle",null),mes_salles:myVisits},
    note:"Données gardées sur ce téléphone. Les séances et le classement sont aussi sur le serveur HMG."}; }
  const txt=JSON.stringify(data,null,2), nom="mes-donnees-hmg.json";
  try{ const file=new File([txt],nom,{type:"application/json"}); if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"Mes données HMG"}); return; } }catch(e){ if(e&&e.name==="AbortError") return; }
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"application/json"})); a.download=nom; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); toast("Tes données sont téléchargées.");
}
async function cqPosition(){
  let et="inconnu"; try{ if(window.HMGN&&HMGN.position&&HMGN.position.etat) et=await HMGN.position.etat(); else if(navigator.permissions) et=(await navigator.permissions.query({name:"geolocation"})).state; }catch(e){}
  const t={granted:"Autorisée quand l'appli est ouverte",prompt:"Pas encore demandée",denied:"Refusée"}[et]||"Gérée par ton téléphone";
  const f=cqFeuille(`<h2>Localisation</h2><p><b style="color:#fff">${t}</b></p><p>HMG utilise ta position seulement quand tu touches « Je suis à la salle », pour vérifier que tu es bien dans ta salle (moins de 200 m), et pour te montrer les salles autour de toi. Elle n'est jamais affichée, jamais partagée, jamais suivie en arrière-plan.</p>
    ${et==="denied"?`<button class="cq-btn" data-reg>Ouvrir les Réglages</button>`:`<button class="cq-btn ghost" data-sh-x>OK</button>`}`);
  const r=f.el.querySelector("[data-reg]"); if(r) r.onclick=()=>{ try{ if(window.HMGN&&HMGN.reglages) HMGN.reglages(); else toast("Ouvre les réglages de ton navigateur pour autoriser la position."); }catch(e){} f.fermer(); };
}
function cqCommentCoeurs(){
  cqFeuille(`<h2>Comment marchent les cœurs ?</h2>
    <p>Ton héros a <b style="color:#fff">3 cœurs</b>. Chaque semaine, du lundi au dimanche, tu vises ton objectif (2 à 5 séances).</p>
    <div class="cq-list" style="margin-bottom:14px">
      <div class="cq-row"><span class="ri">${cqI("heart")}</span><span class="rt">Objectif atteint<small>Un cœur revient (jusqu'à 3)</small></span></div>
      <div class="cq-row"><span class="ri">${cqI("shield")}</span><span class="rt">Au moins la moitié<small>Tes cœurs sont gardés</small></span></div>
      <div class="cq-row"><span class="ri" style="background:rgba(147,160,184,.15);color:#93a0b8">${cqI("heart")}</span><span class="rt">Moins de la moitié<small>Un cœur s'envole</small></span></div>
      <div class="cq-row"><span class="ri">${cqI("bolt")}</span><span class="rt">À 0 cœur<small>Ton héros a un coup de mou. 2 séances en 7 jours et il se relève. Il ne perd jamais ses objets ni ses mondes.</small></span></div>
      <div class="cq-row"><span class="ri" style="background:rgba(127,227,255,.14);color:#7fe3ff">${cqI("pause")}</span><span class="rt">Vacances, blessure ?<small>Mets ton héros en pause : tes cœurs sont gelés.</small></span></div></div>
    <p>Le bilan tombe chaque lundi matin. Le repos fait partie de l'entraînement : pas besoin d'y aller tous les jours.</p>
    <button class="cq-btn" data-sh-x>J'ai compris</button>`);
}
function cqAPropos(){
  cqFeuille(`<h2>HMG Fitness</h2><p>Version ${CQ_VERSION}${APPLI?"":" · aperçu web"}</p>
    <p>HMG est une appli indépendante, non affiliée aux enseignes de salles citées. Les marques citées appartiennent à leurs propriétaires.</p>
    <p style="font-size:13.5px">Carte © contributeurs OpenStreetMap · Adresses : Base Adresse Nationale · Polices Space Grotesk et Inter (licence OFL) · Carte : Leaflet.</p>
    <button class="cq-btn ghost" data-sh-x>Fermer</button>`);
}

/* ---------- supprimer mon compte (obligatoire pour Apple, règle 5.1.1 v) */
function cqSupprimer(){
  const f=cqFeuille(`<h2>Supprimer ton compte ?</h2><p>Ton héros, ta collection, tes séances, ton classement, ton pseudo, tes avis et tes photos seront effacés pour toujours. Impossible de revenir en arrière.</p>
    <button class="cq-btn red" data-ok>Supprimer définitivement</button><button class="cq-link" data-sh-x>Annuler</button>`);
  f.el.querySelector("[data-ok]").addEventListener("click",async e=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Suppression…";
    try{
      if(!(window.HMGS&&HMGS.supprimerCompte)) throw new Error("indispo");
      await HMGS.supprimerCompte();
      try{ if(window.HMGN&&HMGN.notifs&&HMGN.notifs.annulerTout) await HMGN.notifs.annulerTout(); }catch(er){}
      const garder=["hmg-invite","hmg-session"]; Object.keys(localStorage).filter(k=>/^hmg-/.test(k)&&!garder.includes(k)).forEach(k=>localStorage.removeItem(k));
      store.set("hmg-adieu",1); location.replace(location.pathname);
    }catch(er){ b.disabled=false; b.textContent="Supprimer définitivement"; f.fermer(); toast("La suppression n'a pas abouti. Vérifie ta connexion et réessaie, ou écris-nous depuis Aide.",1); }
  });
}

/* ================= BRANCHEMENTS SUR L'APPLI EXISTANTE ================= */
/* l'ancienne bascule Carte / Aventure suit les onglets */
{ const _set=gmSet; gmSet=function(on,silent){ const r=_set(on,silent); if(!CQ.lock&&CQ.tab){ if(GM.on&&CQ.tab!=="aventure"){ cqPageClose(); cqMark("aventure"); } else if(!GM.on&&CQ.tab==="aventure") cqMark("salles"); } return r; }; }
/* l'ancien classement en panneau et la pastille « Toi » deviennent des onglets */
renderRank=function(){ cqTab("classement"); };
openMe=function(){ cqTab("moi"); };
/* une fiche de salle s'ouvre dans l'onglet Salles */
{ const _oc=openClub; openClub=function(id,fly){ if(CQ.tab!=="salles"){ cqPageClose(); cqMark("salles"); if(GM.on){ CQ.lock=true; try{ gmSet(false); }finally{ CQ.lock=false; } } } return _oc(id,fly); }; }
/* une séance validée est aussi notée sur l'appareil (bande de la semaine, calendrier de Moi) */
{ const _as=applyFeatures; applyFeatures=function(){ const r=_as.apply(this,arguments); try{ if(score.today){ const L=store.get("hmg-seances",[]); if(!L.includes(today())){ L.push(today()); store.set("hmg-seances",L.slice(-120)); } } }catch(e){} return r; }; }

/* ---------- démarrage */
(function cqInit(){
  document.body.classList.add("coque");
  cqBar();
  { const q=$("search"); if(q) q.placeholder="Une salle, une ville…"; }
  const h=decodeURIComponent(location.hash.slice(1));
  const t=h==="classement"||h==="moi"?h:(h==="carte"||byId[h])?"salles":"aventure";
  store.set("hmg-mode",t==="aventure"?"game":"map");
  cqMark(t==="classement"||t==="moi"?"aventure":t);
  if(t==="classement"||t==="moi") setTimeout(()=>cqTab(t),400);
  if(store.get("hmg-adieu",0)){ store.set("hmg-adieu",0); setTimeout(()=>toast("Ton compte a été supprimé. Merci d'avoir fait partie de l'aventure."),900); }
})();
