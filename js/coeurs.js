"use strict";
/* ================= LES CŒURS (système de vies) =================
   Affichage du jeu décrit dans 1-jeu-vies.md (règles) et 3-ux-appli.md §4 (dessin, animations, textes).
   Le serveur décide de tout (my_state) ; ce fichier ne fait qu'afficher, animer et proposer.
   Source de l'état : HMGS.etat() (js/serveur.js). Sans état, rien ne s'affiche et l'Aventure marche comme avant.
   HMGC.etat = dernier my_state reçu (voir le contrat §14.10) ; HMGC.coeursHtml(px) ; HMGC.rafraichir() ; HMGC.pause(). */
const HMGC = { etat:null, vu:{}, file:[], occupe:false };

/* ---------- le dessin du cœur : plein, en danger (fissure), vide, gelé (pause) */
(function cvDefs(){ const s=document.createElementNS("http://www.w3.org/2000/svg","svg"); s.setAttribute("width","0"); s.setAttribute("height","0"); s.setAttribute("aria-hidden","true"); s.style.position="absolute";
  s.innerHTML=`<defs><linearGradient id="cvG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6ff8a"/><stop offset=".55" stop-color="#c8ff1e"/><stop offset="1" stop-color="#9fe000"/></linearGradient>
    <linearGradient id="cvI" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9fbff"/><stop offset="1" stop-color="#7fe3ff"/></linearGradient>
    <clipPath id="cvClip"><path d="M16 28.6C9.6 24.4 2.4 19 2.4 11.2 2.4 6.6 5.8 3 10.2 3c2.6 0 4.6 1.3 5.8 3.2C17.2 4.3 19.2 3 21.8 3c4.4 0 7.8 3.6 7.8 8.2 0 7.8-7.2 13.2-13.6 17.4z"/></clipPath></defs>`;
  (document.body||document.documentElement).appendChild(s); })();
const CV_P="M16 28.6C9.6 24.4 2.4 19 2.4 11.2 2.4 6.6 5.8 3 10.2 3c2.6 0 4.6 1.3 5.8 3.2C17.2 4.3 19.2 3 21.8 3c4.4 0 7.8 3.6 7.8 8.2 0 7.8-7.2 13.2-13.6 17.4z";
function cvCoeur(et,px,cls=""){
  const lbl={plein:"cœur plein",danger:"cœur en danger",vide:"cœur vide",gele:"cœur gelé"}[et]||"";
  const reflet=`<ellipse cx="10" cy="9" rx="4.2" ry="2.6" transform="rotate(-28 10 9)" fill="#fff" opacity=".5"/>`;
  const corps=et==="vide"?`<path d="${CV_P}" fill="rgba(147,160,184,.08)" stroke="#93a0b8" stroke-width="2"/>`
    :et==="gele"?`<path d="${CV_P}" fill="url(#cvI)" stroke="#0d1322" stroke-width="1.8"/>${reflet}<path d="M22.5 6.5v6M19.9 8l5.2 3M19.9 11l5.2-3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>`
    :`<path d="${CV_P}" fill="url(#cvG)" stroke="#0d1322" stroke-width="1.8"/>${reflet}${et==="danger"?`<path class="fis" d="M16.2 6.6 14 12l3.2 2.6-2.6 5 1.4 3.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`:""}`;
  return `<svg class="cv-c ${et} ${cls}" viewBox="0 0 32 30" width="${px}" height="${Math.round(px*30/32)}" role="img" aria-label="${lbl}">${corps}</svg>`;
}
/* ---------- la semaine en cours */
const cvS = w => w?(w.v||0)+Math.min(1,w.c||0):0;                         // séances qui comptent
const cvDanger = st => { const w=st&&st.week; if(!w||st.pause||st.soft_mode||st.sick||w.kind==="essai"||w.kind==="reprise") return 0;
  const manque=(w.safe||Math.ceil((w.g||3)/2))-cvS(w); return manque>0&&(w.days_left||0)<=manque+1?manque:0; };
function cvEtats(st){ // état de chacun des cœurs, de gauche à droite
  const max=st.hearts_max||3, n=Math.max(0,Math.min(max,st.hearts||0)), dg=cvDanger(st);
  return Array.from({length:max},(_,i)=>i>=n?"vide":st.pause?"gele":(dg&&i===n-1)?"danger":"plein"); }
HMGC.coeursHtml = (px=20,st=HMGC.etat) => (!st||st.soft_mode)?"":cvEtats(st).map(e=>cvCoeur(e,px)).join("");
HMGC.coeur = cvCoeur;

/* ---------- dans l'Aventure : les cœurs en haut à droite, la bande L-M-M-J-V-S-D sous le monde */
const CV_J=["L","M","M","J","V","S","D"];
function cvSemaineJours(st){ const w=st.week||{}, s=w.start?new Date(w.start+"T12:00:00"):null; const days=new Map((w.days||[]).map(x=>typeof x==="string"?[x,"validee"]:[x.d,x.st||"validee"]));
  return CV_J.map((l,i)=>{ if(!s) return {l,k:"futur"}; const d=new Date(s); d.setDate(s.getDate()+i); const iso=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    return {l,iso,k:days.has(iso)?(days.get(iso)==="courte"?"courte":"ok"):iso===today()?"auj":iso<today()?"repos":"futur"}; }); }
function cvHud(){
  const st=HMGC.etat, g=$("game"); if(!g) return; const hud=g.querySelector(".gm-hud"); if(!hud) return;
  hud.querySelectorAll(".cv-hearts,.cv-sem,.cv-dg").forEach(x=>x.remove()); g.querySelectorAll(".cv-band").forEach(x=>x.remove());
  window.HMG_HEROS_ETAT = st&&!st.soft_mode?(st.pause?"pause":st.sick?((st.conva&&st.conva.n)?"convalescent":"malade"):null):null;
  if(!st) return;
  const btns=hud.querySelector(".btns");
  if(btns&&!st.soft_mode) btns.insertAdjacentHTML("afterbegin",`<button class="cv-hearts" data-cv="coeurs" aria-label="Tes cœurs : ${st.hearts||0} sur ${st.hearts_max||3}">${HMGC.coeursHtml(20)}</button>`);
  const w=st.week||{}, S=cvS(w), G=w.g||st.goal||3, ok=S>=G;
  hud.insertAdjacentHTML("beforeend",`<div class="cv-sem${ok?" ok":""}" data-cv="semaine" role="button" tabindex="0" aria-label="Cette semaine : ${S} séance${S>1?"s":""} sur ${G}">
    ${cvSemaineJours(st).map(d=>`<span class="d ${d.k}"><small>${d.l}</small><i></i></span>`).join("")}<b>${ok?`${S} / ${G} ✓`:`${S} / ${G}`}</b></div>`);
  const dg=cvDanger(st);
  if(dg) hud.insertAdjacentHTML("beforeend",`<div class="cv-dg">Encore ${dg} séance${dg>1?"s":""} d'ici dimanche pour garder ton cœur.</div>`);
  else if(w.kind==="reprise") hud.insertAdjacentHTML("beforeend",`<div class="cv-dg doux">Semaine de reprise : objectif ${G}, aucun cœur en jeu. On reprend en douceur.</div>`);
  else if(w.kind==="essai") hud.insertAdjacentHTML("beforeend",`<div class="cv-dg doux">Semaine d'essai : objectif ${G}, aucun cœur en jeu.</div>`);
  /* bandeaux doux : pause, coup de mou */
  let band="";
  if(st.pause) band=`<div class="cv-band glass" data-cv="pause"><span>❄️</span><span>En pause${st.pause.until?` jusqu'au ${frDate(st.pause.until)}`:""}</span><b>Reprendre</b></div>`;
  else if(st.sick) band=`<div class="cv-band glass" data-cv="zero"><span>💚</span><span>${(st.conva&&st.conva.n)?"Ça va déjà mieux ! Encore une séance et il est sur pied.":"Deux séances cette semaine et ton héros se relève."}</span></div>`;
  if(band){ hud.insertAdjacentHTML("afterend",band); const bd=g.querySelector(".cv-band"); if(bd) bd.style.top=(hud.offsetTop+hud.offsetHeight+8)+"px"; }
  const go=g.querySelector(".gm-go:not(.done) em"); if(go&&st.sick) go.textContent="relève-le";
}

/* ---------- état : chargement, mémoire, rafraîchissement */
HMGC.rafraichir = async function(){
  if(!(window.HMGS&&HMGS.etat)) return null;
  let st=null; try{ st=await HMGS.etat(); }catch(e){ st=null; }
  if(!st||typeof st!=="object") return HMGC.etat;
  const avant=HMGC.etat||store.get("hmg-c-dernier",null); HMGC.etat=st; store.set("hmg-c-dernier",{sick:!!st.sick,hearts:st.hearts,pause:!!st.pause,day:today()});
  try{ if(GM.on) gmHud(); }catch(e){}
  if(CQ&&CQ.tab==="moi"&&!CQ.sub) try{ cqMoi(); }catch(e){}
  try{ if(window.HMGN&&HMGN.notifs&&HMGN.notifs.programmer) HMGN.notifs.programmer(st,cqNotif()); }catch(e){}
  if(avant&&avant.sick&&!st.sick&&!st.soft_mode) cvFile(cvRetour);                 // guérison : « Le retour ! »
  if(st.unseen_bilan&&!HMGC.vu[st.unseen_bilan.week]) cvFile(()=>cvBilan(st.unseen_bilan));
  else if(st.sick&&!st.pause&&store.get("hmg-c-zero",null)!==today()) cvFile(cvZero);
  return st;
};
/* les grands moments passent un par un, jamais pendant l'accueil, un coffre ou une marche */
function cvFile(f){ HMGC.file.push(f); cvVider(); }
async function cvVider(){ if(HMGC.occupe) return; HMGC.occupe=true;
  try{ let t=0; while(HMGC.file.length){
      const libre=!(window.HMGA&&HMGA.actif)&&!(GM&&(GM.busy||GM.sync))&&!document.querySelector(".gm-chest,.gm-ov,.modal,.cq-sheet,.cv-plein,#angel");
      if(!libre){ if((t+=700)>90000) break; await new Promise(r=>setTimeout(r,700)); continue; }
      const f=HMGC.file.shift(); try{ await f(); }catch(e){} } }
  finally{ HMGC.occupe=false; } }

/* ---------- plein écran commun */
function cvPlein(html,cls=""){ const o=document.createElement("div"); o.className="cv-plein "+cls; o.setAttribute("role","dialog"); o.setAttribute("aria-modal","true"); o.innerHTML=`<div class="in">${html}</div>`;
  document.body.appendChild(o); document.body.classList.add("cq-full"); requestAnimationFrame(()=>o.classList.add("on"));
  return { el:o, fermer(){ o.classList.remove("on"); o.classList.add("out"); document.body.classList.remove("cq-full"); setTimeout(()=>o.remove(),320); } }; }
const cvSnd = n => { try{ gmSnd(n); }catch(e){} };
const cvAttendre = ms => new Promise(r=>setTimeout(r,ms));

/* ---------- le bilan du lundi (3-ux-appli.md §4.6, règles 1-jeu-vies.md §5.3) */
function cvTextes(b,st){
  const s=b.s!=null?b.s:"", g=b.g!=null?b.g:(st.goal||3), hb=b.hearts_before, ha=b.hearts_after, pl=n=>n>1?"s":"";
  const serie=b.streak_after>1?`${b.streak_after} semaines réussies d'affilée`:"";
  switch(b.outcome){
    case "atteint": return ha>hb?{t:"Un cœur revient !",p:"Objectif atteint : ton héros récupère un cœur. Continue comme ça.",x:serie,btn:"Je continue"}
      :(+s>+g)?{t:"Au-delà de l'objectif !",p:`${s} séances pour un objectif de ${g}. Tu es en avance sur ta légende.`,x:serie,btn:"Je continue"}
      :{t:"Semaine validée !",p:`${s} séance${pl(s)} sur ${g}. Tes ${ha} cœurs sont intacts. Quelle machine.`,x:serie,btn:"Je continue"};
    case "sauve": return {t:"Cœurs gardés",p:`${s} séance${pl(s)} sur ${g} : assez pour garder tes cœurs. Cette semaine est toute neuve.`,x:b.gel_used?"Un gel a protégé ta série ❄️":"",btn:"C'est reparti"};
    case "rate": return ha>0?{t:"Un cœur s'est envolé",p:`${s||0} séance${pl(s)} sur ${g} cette semaine. Pas de panique : il te reste ${ha} cœur${pl(ha)}, et cette semaine est toute neuve.`,x:"",btn:"C'est reparti"}
      :{t:"Ton héros a besoin de toi",p:"La semaine a été chargée. Ton héros a un coup de mou, mais deux séances suffisent pour le relever. Ses objets et ses mondes restent à lui.",x:"",btn:"Voir mon héros",zero:1};
    case "malade": return {t:"Ton héros garde ta place",p:"Ses objets et ses mondes sont toujours à lui. Deux séances en 7 jours, et il se relève.",x:"",btn:"Je vais à la salle",salle:1};
    case "pause": case "hibernation": return {t:"Ton héros était en pause",p:"Tes cœurs sont restés au chaud. Prêt à reprendre ?",x:"",btn:"Reprendre"};
    case "doux": return (+s>=+g)?{t:"Semaine réussie !",p:`${s} séance${pl(s)} sur ${g}. Bravo.`,x:"",btn:"Je continue"}:{t:"Une nouvelle semaine commence",p:"Chaque séance compte. On y retourne ?",x:"",btn:"C'est parti"};
    default: return {t:"Ta semaine",p:`${s} séance${pl(s)} sur ${g}.`,x:"",btn:"Je continue"};
  }
}
async function cvBilan(b){
  const st=HMGC.etat||{}; HMGC.vu[b.week]=1; const T=cvTextes(b,st), max=st.hearts_max||3, hb=Math.max(0,b.hearts_before!=null?b.hearts_before:st.hearts||0), ha=Math.max(0,b.hearts_after!=null?b.hearts_after:st.hearts||0);
  const doux=b.outcome==="doux"||st.soft_mode, gele=b.outcome==="pause"||b.outcome==="hibernation";
  const h0=Array.from({length:max},(_,i)=>cvCoeur(i<hb?(gele?"gele":"plein"):"vide",56,"c"+i)).join("");
  const p=cvPlein(`<small class="kick">Ton bilan de la semaine</small>
    <div class="bl-ring"><b>${b.s!=null?b.s:"–"}</b><span>/ ${b.g!=null?b.g:st.goal||3}</span><small>séances</small></div>
    ${doux?"":`<div class="bl-hearts">${h0}</div>`}
    <h2 class="bl-t">${esc(T.t)}</h2><p class="bl-p">${esc(T.p)}</p>${T.x?`<p class="bl-x">${esc(T.x)}</p>`:""}
    <button class="cq-btn bl-go">${esc(T.btn)}</button>`,"bilan");
  const el=p.el; cvSnd("pop");
  await cvAttendre(700);
  if(!doux&&ha<hb){ const c=el.querySelector(".bl-hearts .c"+(ha)); if(c){ c.classList.add("perd"); cqVib("alerte"); cvSnd("lose"); await cvAttendre(1300); c.outerHTML=cvCoeur("vide",56,"c"+ha+" respire"); } }
  else if(!doux&&ha>hb){ const c=el.querySelector(".bl-hearts .c"+hb); if(c){ c.outerHTML=cvCoeur("plein",56,"c"+hb+" gagne"); cqVib("succes"); cvSnd("crown"); await cvAttendre(900); } }
  el.querySelector(".in").classList.add("txt");
  try{ if(window.HMGS&&HMGS.ackBilan) HMGS.ackBilan(b.week); }catch(e){}
  await new Promise(res=>el.querySelector(".bl-go").addEventListener("click",()=>{ p.fermer(); res(); },{once:true}));
  if(T.zero) await cvZero(); else if(T.salle) cvAllerSalle(); else if(gele&&st.pause&&window.HMGS&&HMGS.finPause){ /* « Reprendre » : la pause continue, elle se règle dans Réglages */ }
}

/* ---------- 0 cœur : le coup de mou (3-ux-appli.md §4.7, guérison 1-jeu-vies.md §5.5) */
async function cvZero(){
  store.set("hmg-c-zero",today()); const st=HMGC.etat||{}, cv=st.conva&&st.conva.n;
  const p=cvPlein(`<button class="cv-x" data-z="x" aria-label="Fermer">${cqI("x")}</button>
    <div class="bl-hearts">${Array.from({length:st.hearts_max||3},()=>cvCoeur("vide",72)).join("")}</div>
    <div class="z-hero">${(()=>{ try{ return gmBot(gmS.eq,{cls:"sleep"}); }catch(e){ return ""; } })()}<span class="zz">Zzz</span></div>
    <h2 class="bl-t">${cv?"Ça va déjà mieux !":"Ton héros a un coup de mou"}</h2>
    <p class="bl-p">${cv?"Une séance de plus, et il se relève avec un cœur.":"Zéro cœur, ça arrive aux meilleurs. Deux séances en 7 jours, et il se relève avec un cœur."}</p>
    <p class="bl-x" style="color:#9aa6bf">Ses objets et ses mondes, eux, restent à lui.</p>
    <button class="cq-btn" data-z="salle">${cqI("bolt")} Je vais à la salle</button>
    <button class="cq-link" data-z="obj">Ajuster mon objectif</button><button class="cq-link" data-z="pause" style="margin-top:0">Mettre en pause (vacances, blessure)</button>`,"zero");
  await new Promise(res=>p.el.addEventListener("click",e=>{ const b=e.target.closest("[data-z]"); if(!b) return; const k=b.dataset.z; p.fermer(); res();
    if(k==="salle") cvAllerSalle(); else if(k==="obj") setTimeout(cqObjectif,350); else if(k==="pause") setTimeout(()=>HMGC.pause(),350); }));
}
function cvAllerSalle(){ const id=store.get("hmg-ma-salle",null); cqTab("salles"); if(id&&byId[id]) setTimeout(()=>{ try{ openClub(id,true); }catch(e){} },300); }

/* ---------- « Le retour ! » : la guérison est fêtée plus fort que la chute */
async function cvRetour(){
  const p=cvPlein(`<div class="confetti">${Array.from({length:34},(_,i)=>{ const a=Math.PI*2*i/34, d=120+Math.random()*120; return `<i style="background:${["#c8ff1e","#fff","#e6ff8a"][i%3]};--x:${Math.round(Math.cos(a)*d)}px;--y:${Math.round(Math.sin(a)*d+60)}px;--r:${Math.round(Math.random()*720-360)}deg"></i>`; }).join("")}</div>
    <div class="bl-hearts">${cvCoeur("plein",72,"gagne")}</div><h2 class="bl-t big">LE RETOUR !</h2>
    <p class="bl-p">Ton héros se relève avec un cœur. Les légendes tombent parfois. Elles se relèvent toujours.</p><button class="cq-btn bl-go">Et c'est reparti</button>`,"retour txt");
  cvSnd("fanfare"); cqVib("succes");
  await new Promise(res=>p.el.querySelector(".bl-go").addEventListener("click",()=>{ p.fermer(); res(); },{once:true}));
  try{ gmPaintHero("happy cheer"); setTimeout(()=>{ try{ gmPaintHero(); }catch(e){} },1600); }catch(e){}
}

/* ---------- la pause (1-jeu-vies.md §5.8 : début lundi si on la met du lundi au mercredi, sinon lundi prochain) */
const cvLundi = (n=0) => { const d=new Date(), j=(d.getDay()+6)%7, l=new Date(d.getFullYear(),d.getMonth(),d.getDate()-j+7*n); return l; };
HMGC.pause = function(){
  const st=HMGC.etat;
  if(st&&st.pause){ const f=cqFeuille(`<h2>Ton héros est en pause</h2><p>${st.pause.until?`Jusqu'au ${frDate(st.pause.until)}. `:""}Tes cœurs sont gelés, rien ne se perd. Une séance pendant la pause compte quand même.</p>
      <button class="cq-btn" data-fin>Reprendre lundi prochain</button><button class="cq-link" data-sh-x>Rester en pause</button>`);
    f.el.querySelector("[data-fin]").onclick=async()=>{ try{ await HMGS.finPause(); toast("C'est noté : ton héros reprend lundi."); }catch(e){ toast("Impossible pour le moment. Réessaie dans un instant.",1); } f.fermer(); HMGC.rafraichir(); };
    return; }
  const reste=st&&st.pause_left_52!=null?st.pause_left_52:6, max=Math.min(6,Math.max(0,reste)), j=(new Date().getDay()+6)%7, debut=j<=2?0:1;
  if(!max){ cqFeuille(`<h2>Plus de pause disponible</h2><p>Tu as utilisé tes 6 semaines de pause de l'année. Tu peux quand même passer en mode doux (sans cœurs) dans Réglages, ou ajuster ton objectif.</p><button class="cq-btn ghost" data-sh-x>OK</button>`); return; }
  let n=1, why=store.get("hmg-pause-raison","");
  const fin=()=>cvLundi(debut+n).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const f=cqFeuille(`<h2>Mettre ton héros en pause</h2><p>Vacances, blessure, grosse semaine ? Tes cœurs sont gelés pendant la pause. Rien ne se perd.${debut?" Elle commence lundi prochain.":" Elle commence cette semaine."}</p>
    <div class="cq-choice" role="radiogroup">${Array.from({length:Math.min(3,max)},(_,i)=>`<button role="radio" data-n="${i+1}" aria-checked="${i===0}"><b>${i+1}</b> semaine${i?"s":""}</button>`).join("")}</div>
    <p class="cq-note" style="margin:-6px 4px 14px">Il te reste ${max} semaine${max>1?"s":""} de pause cette année.</p>
    <div class="cv-raisons">${["Vacances","Blessure ou maladie","Autre"].map(r=>`<button data-r="${r}" aria-pressed="${r===why}">${r}</button>`).join("")}</div>
    <p class="cq-note" style="margin:6px 4px 14px">La raison reste sur ton téléphone. Elle n'est jamais envoyée.</p>
    <button class="cq-btn" data-ok>Mettre en pause jusqu'au ${fin()}</button>`);
  f.el.addEventListener("click",async e=>{ const c=e.target.closest("[data-n]"), r=e.target.closest("[data-r]");
    if(c){ n=+c.dataset.n; f.el.querySelectorAll("[data-n]").forEach(x=>x.setAttribute("aria-checked",String(x===c))); f.el.querySelector("[data-ok]").textContent=`Mettre en pause jusqu'au ${fin()}`; cqVib("choix"); return; }
    if(r){ why=r.dataset.r; store.set("hmg-pause-raison",why); f.el.querySelectorAll("[data-r]").forEach(x=>x.setAttribute("aria-pressed",String(x===r))); return; }
    if(!e.target.closest("[data-ok]")) return;
    try{ if(!(window.HMGS&&HMGS.pause)) throw new Error(); const r2=await HMGS.pause(n); if(r2&&r2.ok===false) throw new Error(r2.why||""); f.fermer(); cqVib("succes"); toast("Ton héros est en pause. Repose-toi bien 💚"); HMGC.rafraichir(); }
    catch(er){ toast("La pause n'a pas pu être enregistrée. Réessaie dans un instant.",1); }
  });
};

/* ---------- un toucher sur les cœurs : la règle en une phrase ; appui long : la pause */
document.addEventListener("click",e=>{ const b=e.target.closest("[data-cv]"); if(!b) return; const k=b.dataset.cv, st=HMGC.etat; if(!st) return;
  if(k==="coeurs"||k==="semaine"){ const w=st.week||{}, G=w.g||st.goal||3, S=cvS(w);
    const f=cqFeuille(`<h2>${HMGC.coeursHtml(28)}</h2><p>${G} séance${G>1?"s":""} par semaine pour regagner un cœur, ${w.safe||Math.ceil(G/2)} pour garder les tiens. Cette semaine : <b style="color:#fff">${S} sur ${G}</b>.</p>
      <button class="cq-btn ghost" data-sh-x>OK</button><button class="cq-link" data-plus>Comment ça marche ?</button>`);
    f.el.querySelector("[data-plus]").onclick=()=>{ f.fermer(); setTimeout(cqCommentCoeurs,250); }; }
  else if(k==="pause") HMGC.pause(); else if(k==="zero") cvZero(); });
{ let t=0; document.addEventListener("pointerdown",e=>{ if(!e.target.closest||!e.target.closest(".cv-hearts")) return; t=setTimeout(()=>{ t=0; cqVib("choix"); HMGC.pause(); },550); });
  ["pointerup","pointercancel","pointerleave"].forEach(n=>document.addEventListener(n,()=>{ if(t){ clearTimeout(t); t=0; } })); }

/* ---------- branchements */
{ const _h=gmHud; gmHud=function(){ const r=_h.apply(this,arguments); try{ cvHud(); }catch(e){} return r; }; }
{ const _r=refreshScore; refreshScore=async function(){ const r=await _r.apply(this,arguments); HMGC.rafraichir(); return r; }; }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") HMGC.rafraichir(); });
CQ.hooks.reglages.push(body=>{ const st=HMGC.etat; if(!st) return; const sec=body.querySelector(".cq-list"); if(!sec) return;
  sec.insertAdjacentHTML("beforeend",`<button class="cq-row" role="switch" data-cq="doux" aria-checked="${!!st.soft_mode}"><span class="ri">${cqI("heart")}</span><span class="rt">Jouer sans cœurs<small>Aucune perte : on compte tes semaines réussies</small></span><span class="cq-sw"></span></button>`); });
HMGC.doux = async on => { try{ if(!(window.HMGS&&HMGS.doux)) throw 0; await HMGS.doux(on); toast(on?"Mode doux : plus aucun cœur en jeu.":"Les cœurs sont de retour."); HMGC.rafraichir(); }catch(e){ toast("Réglage indisponible pour le moment.",1); } };
setTimeout(()=>HMGC.rafraichir(),1500);
