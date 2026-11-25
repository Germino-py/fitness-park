"use strict";
/* ================= L'ACCUEIL DES NOUVEAUX (onboarding) =================
   8 écrans, une décision par écran, environ 55 secondes (3-ux-appli.md §3) :
   1 Bienvenue · 2 Héros · 3 Objectif · 4 Localisation · 5 Ta salle · 6 Notifications (appli seulement) · 7 Pseudo · 8 Coffre de bienvenue.
   Les écrans qui précèdent une autorisation n'ont qu'un bouton « Continuer » (règle d'Apple).
   Si la personne quitte en cours, elle reprend à l'écran où elle s'était arrêtée (hmg-onb). */
const HMGA = { actif:false, etape:1, fin:null, _fin:null };
const ONB_ETAPES = APPLI ? [1,2,3,4,5,6,7,8] : [1,2,3,4,5,7,8];   // sur le site, pas de notifications
const onbEtat = () => store.get("hmg-onb", {});
const onbNoms = ["Titan","Colosse","Fusée","Panthère","Spartan","Tornade","Volcan","Comète","Faucon","Bison"];

HMGA.lancer = function(revoir){
  if(HMGA.actif) return; HMGA.actif=true; HMGA.revoir=!!revoir;
  HMGA.fin=new Promise(r=>HMGA._fin=r);
  const e=onbEtat(); HMGA.etape=revoir?1:(e.etape&&ONB_ETAPES.includes(e.etape)?e.etape:1);
  if(!revoir&&store.get("hmg-acct-welcome",false)) HMGA.etape=3;   // compte retrouvé : héros déjà choisi
  const o=document.createElement("div"); o.id="onb"; o.setAttribute("role","dialog"); o.setAttribute("aria-modal","true"); o.setAttribute("aria-label","Bienvenue dans HMG");
  document.body.appendChild(o); document.body.classList.add("cq-full","onb-on");
  o.addEventListener("click",onbClic); onbAff();
};
function onbFini(){
  const o=$("onb"); store.set("hmg-onb",{done:true,le:today()}); HMGA.actif=false;
  if(o){ o.classList.add("out"); setTimeout(()=>o.remove(),380); } document.body.classList.remove("cq-full","onb-on");
  const f=HMGA._fin; HMGA._fin=null; if(f) f();
  if(!HMGA.revoir){ cqTab("aventure",{force:true});
    /* après le coffre de bienvenue, le héros accueille et montre le bouton */
    let t=0; const iv=setInterval(()=>{ t+=600; if(t>60000) return clearInterval(iv);
      if(GM.on&&!GM.busy&&!GM.sync&&!document.querySelector(".gm-chest,.gm-ov,.modal")){ clearInterval(iv);
        try{ gmSay(`Bienvenue, <b>${esc(myName())}</b> ! Tu es à la salle ? Touche le bouton en bas.`,5200); }catch(e){}
        const b=document.querySelector(".gm-go"); if(b){ b.classList.add("onb-tip"); setTimeout(()=>b.classList.remove("onb-tip"),5200); } } },600); }
  else cqTab(CQ.tab||"moi",{force:true});
  try{ HMGC.rafraichir(); }catch(e){}
}
function onbAller(n){ HMGA.etape=n; if(!HMGA.revoir||n>1) store.set("hmg-onb",{etape:n}); onbAff(); }
function onbSuivant(){ const i=ONB_ETAPES.indexOf(HMGA.etape); const n=ONB_ETAPES[i+1];
  if(n===7&&myPseudo&&!HMGA.revoir) return onbAller(8);
  if(!n||n===8&&HMGA.revoir) return onbFini();
  onbAller(n); }

/* ---------- l'affichage d'un écran */
function onbAff(){
  const o=$("onb"); if(!o) return; const n=HMGA.etape, prog=ONB_ETAPES.filter(x=>x>1&&x<8), k=prog.indexOf(n);
  const barre=k<0?"":`<div class="onb-prog" aria-hidden="true">${prog.map((x,i)=>`<i class="${i<=k?"on":""}"></i>`).join("")}</div>`;
  const retour=(n===2||n===3)?`<button class="onb-back" data-o="retour" aria-label="Retour">${cqI("back")}</button>`:"";
  o.innerHTML=`<div class="onb-top">${retour}${barre}</div><div class="onb-ecran e${n}">${ONB[n]()}</div>`;
  o.querySelector(".onb-ecran").classList.add("in");
  const f=o.querySelector("[data-focus]"); if(f) setTimeout(()=>{ try{ f.focus({preventScroll:true}); }catch(e){} }, TOUCH_DEV?380:60);
  if(ONB_APRES[n]) ONB_APRES[n](o);
}
const onbHeros = (eq,cls) => { try{ return gmBot(eq,{cls}); }catch(e){ return ""; } };
const onbTons = h => { try{ if(typeof gmTones==="function"){ const t=gmTones(h); if(Array.isArray(t)&&t.length) return t; } }catch(e){}
  const tc=GM_TONE[h==="robot"?"robot":"human"]; return [["clair",h==="robot"?"Blanc":"Peau claire"],["fonce",h==="robot"?"Noir":"Peau foncée"]].map(([k,n])=>({k,n,c:tc[k].s})); };
const ONB_CHOIX = { hero:null, tone:null, obj:null, gym:null, pos:null, ps:"" };

const ONB = {
  1:()=>`<div class="onb-scene">${onbHeros({...GM_EQ0,hero:gmS.eq.hero||"homme",tone:gmS.eq.tone||"clair"},"idle")}<div class="onb-chemin"></div></div>
    <small class="onb-kick">HMG FITNESS</small><h1>Ton héros t'attend.</h1>
    <p>Chaque séance à la salle le fait avancer, grossir ses muscles et ouvrir des coffres.</p>
    <div class="onb-bas"><button class="cq-btn" data-o="go">C'est parti</button>${HMGA.revoir?"":`<button class="cq-link" data-o="compte">J'ai déjà un compte</button>`}</div>`,
  2:()=>{ const h=ONB_CHOIX.hero||gmS.eq.hero||"homme", tons=onbTons(h), t=tons.some(x=>x.k===ONB_CHOIX.tone)?ONB_CHOIX.tone:(tons.some(x=>x.k===gmS.eq.tone)?gmS.eq.tone:tons[0].k);
    ONB_CHOIX.hero=h; ONB_CHOIX.tone=t;
    return `<h1>Choisis ton héros</h1><p>Il démarre en caleçon. À toi de l'habiller.</p>
    <div class="onb-heros" role="radiogroup">${GM_HEROES.map(x=>`<button role="radio" data-hero="${x.k}" aria-checked="${x.k===h}">${onbHeros({...GM_EQ0,hero:x.k,tone:x.k===h?t:(onbTons(x.k)[0]||{}).k},x.k===h?"happy idle":"idle")}<b>${esc(x.n)}</b><small>${esc(x.s)}</small></button>`).join("")}</div>
    <div class="onb-tons" role="radiogroup" aria-label="Teinte">${tons.map(x=>`<button role="radio" data-tone="${esc(x.k)}" aria-checked="${x.k===t}" aria-label="${esc(x.n)}"><i style="background:${esc(x.c)}"></i></button>`).join("")}</div>
    <div class="onb-bas"><button class="cq-btn" data-o="heros">${h==="femme"?"C'est elle !":h==="robot"?"C'est mon robot !":"C'est lui !"}</button><p class="onb-mini">Tu pourras changer de héros quand tu veux, ta progression reste.</p></div>`; },
  3:()=>{ const v=ONB_CHOIX.obj||store.get("hmg-objectif",3);
    return `<div class="onb-coeurs">${[0,1,2].map(i=>`<span style="animation-delay:${200+i*260}ms">${HMGC.coeur("plein",46)}</span>`).join("")}</div>
    <h1>Combien de séances par semaine ?</h1><p>Ton héros a 3 cœurs. Tiens au moins la moitié de ton objectif chaque semaine pour les garder.</p>
    <div class="cq-choice" role="radiogroup">${[2,3,4,5].map(n=>`<button role="radio" data-obj="${n}" aria-checked="${n===v}"><b>${n}</b> séances <small>· ${CQ_OBJ[n]}</small>${n===3?`<span class="tag">Conseillé</span>`:""}</button>`).join("")}</div>
    <ul class="onb-regles"><li>${HMGC.coeur("plein",16)} Objectif atteint : un cœur revient.</li><li>${HMGC.coeur("vide",16)} Moins de la moitié : un cœur s'envole.</li><li><span class="b">${cqI("bolt")}</span> Une séance, et tout repart.</li></ul>
    <div class="onb-bas"><button class="cq-btn" data-o="obj">Valider mon objectif</button><p class="onb-mini">Modifiable à tout moment. Vacances ou blessure ? Tu mets ton héros en pause.</p></div>`; },
  4:()=>`<div class="onb-radar"><i></i><i></i><i></i><span>${cqI("pin")}</span></div>
    <h1>Tes séances, validées sur place</h1><p>Quand tu touches « Je suis à la salle », HMG vérifie que tu es bien dans ta salle. Ta position sert aussi à trouver les salles autour de toi.</p>
    <p class="onb-sur">${cqI("shield")} Jamais affichée, jamais partagée, jamais suivie en arrière-plan.</p>
    <div class="onb-bas"><button class="cq-btn" data-o="pos">Continuer</button></div>`,
  5:()=>`<h1>C'est où, ta salle ?</h1><p>On la garde en favori. Tu pourras valider tes séances dans toutes les salles de la carte.</p>
    <input class="cq-field" id="onbQ" type="search" placeholder="Ville, code postal ou nom de la salle" autocomplete="off" enterkeyhint="search" ${ONB_CHOIX.pos?"":"data-focus"}>
    <div class="cq-gyms" id="onbL" role="radiogroup"></div>
    <div class="onb-bas"><button class="cq-btn" data-o="salle" ${ONB_CHOIX.gym?"":"disabled"}>C'est ma salle</button><button class="cq-link" data-o="sanssalle">Je n'ai pas encore de salle</button></div>`,
  6:()=>`<div class="onb-notif" aria-hidden="true"><span class="ic"></span><div><b>HMG</b><small>maintenant</small><strong>Ton cœur compte sur toi 💚</strong><span>Encore 1 séance d'ici dimanche pour le garder.</span></div></div>
    <h1>On veille sur tes cœurs</h1><p>Un rappel quand un cœur est en danger, un petit mot quand tu arrives à ta salle, et ton bilan chaque lundi. Jamais plus d'un message par jour.</p>
    <div class="onb-bas"><button class="cq-btn" data-o="notif">Continuer</button></div>`,
  7:()=>{ if(!ONB_CHOIX.ps){ for(let i=0;i<12&&!ONB_CHOIX.ps;i++){ const v=onbNoms[Math.floor(Math.random()*onbNoms.length)]+"_"+Math.floor(10+Math.random()*89); if(psLocal(v)==="ok") ONB_CHOIX.ps=v; } }
    return `<h1>Dernière chose : ton nom de légende</h1><p>Il s'affiche au classement et sur tes avis. Il est unique : personne d'autre ne pourra le prendre.</p>
    <form id="onbPs" autocomplete="off"><div class="ps-in"><input id="onbPsIn" class="cq-field" maxlength="20" value="${esc(ONB_CHOIX.ps)}" aria-label="Ton pseudo" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" data-focus><span id="onbPsSt" class="ps-st" aria-hidden="true"></span></div>
      <div id="onbPsMsg" class="ps-msg" aria-live="polite"></div><div id="onbPsIdeas" class="ps-ideas"></div>
      <div class="onb-bas"><button class="cq-btn" id="onbPsGo" type="submit">C'est mon pseudo</button>
      <p class="onb-mini">En continuant, tu acceptes les <a href="#" data-o="regles">Règles de la communauté</a> et la <a href="#" data-o="politique">Politique de confidentialité</a>.</p></div></form>`; },
  8:()=>`<div class="onb-coffre"><div class="glow"></div>${(()=>{ try{ return gmChestSvg(gmChestCol("g"),false,true); }catch(e){ return cqI("sac"); } })()}</div><small class="onb-kick">RÉCOMPENSE</small><h1>Ton coffre de bienvenue</h1>
    <p>Il t'attend au début du chemin. Ouvre-le, et ton aventure commence.</p><div class="onb-bas"><button class="cq-btn" data-o="fin">J'y vais</button></div>`
};
const ONB_APRES = {
  5:o=>{ const L=o.querySelector("#onbL"), Q=o.querySelector("#onbQ"), ok=o.querySelector('[data-o="salle"]');
    const draw=()=>{ const r=Q.value.trim()?cqChercher(Q.value,6):ONB_CHOIX.pos?cqSallesProches(ONB_CHOIX.pos,3):[];
      L.innerHTML=r.length?cqGymsHtml(r,ONB_CHOIX.gym)+(!Q.value.trim()&&ONB_CHOIX.pos?`<button class="cq-link" data-o="autres" style="margin:2px auto 0">Voir d'autres salles</button>`:""):`<div class="cq-empty" style="padding:12px">${Q.value.trim()?"Aucune salle trouvée. Essaie une ville ou un code postal.":"Tape ta ville ou le nom de ta salle."}</div>`; };
    Q.addEventListener("input",draw); draw();
    L.addEventListener("click",e=>{ const b=e.target.closest("[data-gym]"); if(!b) return; ONB_CHOIX.gym=b.dataset.gym; ok.disabled=false; L.querySelectorAll("[data-gym]").forEach(x=>x.setAttribute("aria-checked",String(x===b))); cqVib("choix"); }); },
  7:o=>{ const inp=o.querySelector("#onbPsIn"), go=o.querySelector("#onbPsGo"), msg=o.querySelector("#onbPsMsg"), st=o.querySelector("#onbPsSt"), ideas=o.querySelector("#onbPsIdeas"); let seq=0, tm=0;
    const show=(s,v)=>{ msg.textContent=s==="wait"?"Je vérifie qu'il est libre…":(PS_MSG[s]||PS_MSG.invalide); msg.className="ps-msg "+(s==="ok"?"ok":s==="wait"||s==="vide"||s==="court"?"":"ko");
      st.className="ps-st "+(s==="ok"?"ok":s==="wait"?"wait":s==="vide"?"":"ko"); go.disabled=s!=="ok";
      const id=s==="pris"||s==="reserve"?psIdeas(v):[]; ideas.innerHTML=id.map(x=>`<button type="button" data-idea="${esc(x)}">${esc(x)}</button>`).join(""); };
    const check=()=>{ const v=inp.value.trim().replace(/\s+/g," "); ONB_CHOIX.ps=v; const loc=psLocal(v); clearTimeout(tm); const q=++seq;
      if(loc!=="ok"){ show(loc,v); return; } if(!LIVE){ show("ok",v); return; } show("wait",v);
      tm=setTimeout(async()=>{ try{ const r=await rpc("pseudo_check",{p_pseudo:v,p_voter:voterId}); if(q===seq) show(r==="toi"?"ok":r,v); }catch(e){ if(q===seq) show("ok",v); } },320); };
    inp.addEventListener("input",check); ideas.addEventListener("click",e=>{ const b=e.target.closest("[data-idea]"); if(b){ inp.value=b.dataset.idea; check(); } });
    o.querySelector("#onbPs").addEventListener("submit",async e=>{ e.preventDefault(); const v=inp.value.trim().replace(/\s+/g," "); if(psLocal(v)!=="ok"||go.disabled) return;
      go.disabled=true; go.textContent="Un instant…";
      try{ const r=LIVE?await rpc("set_pseudo",{p_voter:voterId,p_no:myNo,p_pseudo:v}):{ok:true,pseudo:v,no:myNo};
        if(!r||!r.ok){ show((r&&r.why)||"invalide",v); go.textContent="C'est mon pseudo"; return; }
        if(r.no&&r.no!==myNo){ myNo=r.no; store.set("hmg-visitor",myNo); }
        myPseudo=r.pseudo; store.set("hmg-pseudo",myPseudo); store.set("hmg-pseudo-later",false);
        for(const k in PSEUDOS) if(PSEUDOS[k]===myPseudo) delete PSEUDOS[k]; PSEUDOS[myNo]=myPseudo;
        try{ if(window.HMGS&&HMGS.pseudo) HMGS.pseudo(myPseudo); }catch(er){}
        try{ updateHeader(); applyFeatures(); }catch(er){}
        cqVib("succes"); onbSuivant();
      }catch(err){ msg.textContent=/ouverte/.test(err.message)?"Les pseudos arrivent très bientôt.":"Pas de réseau ? Réessaie dans un instant."; msg.className="ps-msg ko"; go.disabled=false; go.textContent="C'est mon pseudo"; } });
    check(); }
};

/* ---------- les actions */
async function onbClic(e){
  const b=e.target.closest("[data-o],[data-hero],[data-tone],[data-obj]"); if(!b) return;
  if(b.tagName==="A") e.preventDefault();
  if(b.dataset.hero){ ONB_CHOIX.hero=b.dataset.hero; ONB_CHOIX.tone=null; cqVib("choix"); try{ gmSnd("pop"); }catch(er){} onbAff(); const s=$("onb").querySelector(`[data-hero="${b.dataset.hero}"] svg`); if(s) s.classList.add("gm-jump"); return; }
  if(b.dataset.tone){ ONB_CHOIX.tone=b.dataset.tone; cqVib("choix"); onbAff(); return; }
  if(b.dataset.obj){ ONB_CHOIX.obj=+b.dataset.obj; $("onb").querySelectorAll("[data-obj]").forEach(x=>x.setAttribute("aria-checked",String(x===b))); cqVib("choix"); return; }
  const k=b.dataset.o;
  if(k==="retour"){ const i=ONB_ETAPES.indexOf(HMGA.etape); if(i>0) onbAller(ONB_ETAPES[i-1]); return; }
  if(k==="go"){ cqVib("choix"); return onbSuivant(); }
  if(k==="compte"){ try{ acctModal("restore"); }catch(er){} return; }
  if(k==="heros"){ gmS.eq.hero=ONB_CHOIX.hero; gmS.eq.tone=ONB_CHOIX.tone; gmSave(); cqVib("succes"); try{ gmSnd("fanfare"); }catch(er){} return onbSuivant(); }
  if(k==="obj"){ const v=ONB_CHOIX.obj||store.get("hmg-objectif",3); store.set("hmg-objectif",v); try{ if(window.HMGS&&HMGS.objectif) await HMGS.objectif(v,{inscription:true}); }catch(er){} cqVib("succes"); return onbSuivant(); }
  if(k==="pos"){ b.disabled=true; b.textContent="Un instant…";
    try{ const g=await new Promise((ok,ko)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(ok,ko,{enableHighAccuracy:false,timeout:12000,maximumAge:600000}):ko(new Error("geo")));
      ONB_CHOIX.pos={lat:g.coords.latitude,lon:g.coords.longitude}; store.set("hmg-last-pos",ONB_CHOIX.pos); }catch(er){ ONB_CHOIX.pos=null; }
    return onbSuivant(); }
  if(k==="autres"){ const q=$("onbQ"); if(q) q.focus(); return; }
  if(k==="salle"){ if(ONB_CHOIX.gym){ store.set("hmg-ma-salle",ONB_CHOIX.gym); try{ if(window.HMGS&&HMGS.maSalle) HMGS.maSalle(ONB_CHOIX.gym); }catch(er){} cqVib("succes"); } return onbSuivant(); }
  if(k==="sanssalle") return onbSuivant();
  if(k==="notif"){ b.disabled=true; try{ if(window.HMGN&&HMGN.notifs&&HMGN.notifs.autoriser) await HMGN.notifs.autoriser(); }catch(er){} return onbSuivant(); }
  if(k==="regles") return cqOuvrir(cqSite("regles/"));
  if(k==="politique") return cqOuvrir(cqSite("confidentialite/"));
  if(k==="fin"){ cqVib("succes"); return onbFini(); }
}

/* ---------- pendant l'accueil, l'appli ne doit rien ouvrir par-dessus */
{ const _p=gmPickHero; gmPickHero=function(first){ if(HMGA.actif&&first) return HMGA.fin.then(()=>gmS.eq.hero?undefined:_p(first)); return _p(first); }; }
{ const _m=pseudoModal; pseudoModal=function(first){ if((HMGA.actif||!onbEtat().done)&&first) return; return _m.apply(this,arguments); }; }
if(typeof angelCheck==="function"){ const _a=angelCheck; angelCheck=function(){ if(HMGA.actif) return setTimeout(angelCheck,4000); return _a.apply(this,arguments); }; }

/* ---------- démarrage : un nouveau joueur commence par l'accueil */
if(!onbEtat().done && !/^#compte=/.test(location.hash)) HMGA.lancer(false);
