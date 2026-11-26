"use strict";
if(window.HMG_PRIVE) throw new Error("HMG : accès privé (test avant la sortie de l'appli)");
/* ================= MON COMPTE AVEC LE SERVEUR DU JEU =================
   Chargé après js/onglets.js (cqFeuille, cqI, cqVib) et js/serveur.js (HMGS). Rien ne change sans le serveur du jeu.
   1. Sauvegarde du héros sur le serveur (save_game « game ») : la clé du jeu, la tenue et « Mes salles ».
      La collection se reconstruit à partir de la clé et des séances (comme avec le code de secours), donc un nouveau
      téléphone ou une réinstallation retrouve exactement les mêmes objets.
   2. Changer de téléphone : code de transfert à usage unique, 15 minutes (Moi › Réglages › Changer de téléphone).
   3. Compte du site déjà repris sur un autre appareil (reprise « pris ») : on propose d'entrer un code de transfert.
   4. Appli en test privé sans invitation valable : écran pour entrer son code (ou lien hmgfitness.fr/invite/CODE).
   5. Classement : celui du serveur du jeu (plafonné, comptes masqués exclus) quand il est là (voir cqRang). */
const CP = { ver:undefined, dernier:null, pret:false, busy:false };
const cpSrv = () => { try{ const s=window.HMGS&&HMGS.statut&&HMGS.statut(); return !!s&&(s.mode==="serveur"||s.mode==="demo"); }catch(e){ return false; } };
const cpEtat = () => { try{ return (window.HMGS&&HMGS.etatCache&&HMGS.etatCache())||null; }catch(e){ return null; } };
const cpHeure = d => { try{ return d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}).replace(":"," h "); }catch(e){ return ""; } };
const cpDonnees = () => { const st=cpEtat(); return { v:voterId, no:st&&st.no||null, eq:gmS.eq, m:Object.keys(myVisits||{}).filter(id=>byId[id]).slice(0,400), at:new Date().toISOString() }; };

/* ---------- 1. sauvegarde du héros */
async function cpSauver(force){
  if(!CP.pret||CP.busy||!cpSrv()) return false;
  const st=cpEtat(); if(!st||!st.player) return false;            // pas encore de joueur : rien à sauver
  const d=cpDonnees(), cle=JSON.stringify([d.v,d.eq,d.m]);
  if(!force&&cle===CP.dernier) return true;
  CP.busy=true;
  try{
    let r=await HMGS.sauver("game",d,CP.ver);
    if(r&&r.ok===false&&r.why==="conflit"){ CP.ver=r.version; r=await HMGS.sauver("game",d,CP.ver); }
    if(r&&r.ok){ CP.ver=r.version; CP.dernier=cle; store.set("hmg-cp-no",d.no); return true; }
    if(r&&r.why==="vite") setTimeout(()=>cpSauver(),2500);
  }catch(e){ /* hors connexion : on réessaie plus tard */ }
  finally{ CP.busy=false; }
  return false;
}
/* adopter la sauvegarde du serveur (nouveau téléphone, réinstallation, code de transfert) puis recharger */
function cpRestaurer(d,pourquoi){
  if(voterId&&voterId!==d.v) store.set("hmg-voter-old",voterId);
  store.set("hmg-voter",d.v); if(d.no){ store.set("hmg-visitor",d.no); store.set("hmg-cp-no",d.no); }
  store.set("hmg-score",{}); store.set("hmg-pseudo",null); store.set("hmg-pseudo-later",true);
  const eq=d.eq&&typeof d.eq==="object"?d.eq:{};
  store.set("hmg-game",{seen:null,open:[],items:[],stars:0,leg:{},eq,rebuild:1});
  if(Array.isArray(d.m)){ const mv={...myVisits}; d.m.forEach(id=>{ if(byId[id]&&!mv[id]) mv[id]=today(); }); store.set("hmg-my-visits",mv); }
  store.set("hmg-cp-retour",pourquoi||"retour"); store.set("hmg-onb",{done:true,le:today()});   // un héros qui revient ne refait pas la présentation
  setTimeout(()=>location.replace(location.pathname+location.search),150);
}
async function cpCharger(){
  let g=null; try{ g=await HMGS.charger(); }catch(e){ return null; }
  const s=g&&g.game; CP.ver=s?s.version:undefined;
  const d=s&&s.data; return d&&typeof d==="object"&&/^[0-9a-f]{32}$/.test(d.v||"")?d:null;
}
async function cpDemarrer(){
  try{ await HMGS.pret(); }catch(e){}
  if(!cpSrv()) return;
  let st=null; try{ st=await HMGS.etat(); }catch(e){}
  if(!st||!st.player){ CP.pret=true; return; }
  const d=await cpCharger();
  if(d===null&&CP.ver===undefined&&!navigator.onLine) return;   // pas de réseau : on réessaiera au prochain lancement
  /* nouveau téléphone ou réinstallation : ce joueur a une sauvegarde avec une autre clé, et cet appareil ne l'a jamais eue */
  if(d&&d.v!==voterId&&store.get("hmg-cp-no",null)!==st.no&&(!d.no||d.no===st.no)){ cpRestaurer(d,"retour"); return; }
  CP.pret=true; cpSauver(true);
}
if(window.HMGS){
  setTimeout(cpDemarrer,600);
  setInterval(()=>{ if(document.visibilityState!=="hidden") cpSauver(); },20000);
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="hidden") cpSauver(); });
  window.addEventListener("hmg:etat-appli",e=>{ if(e.detail&&e.detail.actif===false) cpSauver(); });
}
{ const r=store.get("hmg-cp-retour",null); if(r){ store.set("hmg-cp-retour",null);
  setTimeout(()=>toast(r==="transfert"?"Ton héros est bien arrivé sur ce téléphone. Bon retour 💪":"Ton héros est de retour, avec toute sa collection 💪"),1200); } }

/* ---------- 2. changer de téléphone */
function cpTelephone(){
  const f=cqFeuille(`<h2>Changer de téléphone</h2><p>Ton héros, sa collection, tes cœurs et tes séances te suivent sur ton nouveau téléphone.</p>
    <div class="cq-list" style="margin-bottom:12px">
      <button class="cq-row" data-t="donner"><span class="ri">${cqI("share")}</span><span class="rt">Je suis sur mon ancien téléphone<small>Obtenir un code à taper sur le nouveau</small></span>${cqI("chev","chev")}</button>
      <button class="cq-row" data-t="entrer"><span class="ri">${cqI("key")}</span><span class="rt">Je suis sur mon nouveau téléphone<small>J'ai un code de transfert</small></span>${cqI("chev","chev")}</button></div>
    <p class="cq-note">Le code marche une seule fois, pendant 15 minutes.</p>`);
  f.el.addEventListener("click",e=>{ const b=e.target.closest("[data-t]"); if(!b) return; cqVib("choix"); f.fermer(); setTimeout(()=>b.dataset.t==="donner"?cpDonner():cpEntrer(),230); });
}
async function cpDonner(){
  const f=cqFeuille(`<h2>Ton code de transfert</h2><div class="cp-code" aria-live="polite"><span class="cp-wait"></span></div><p data-msg>Je prépare ton code…</p><div data-acts></div>`);
  const C=f.el.querySelector(".cp-code"), M=f.el.querySelector("[data-msg]"), A=f.el.querySelector("[data-acts]");
  await cpSauver(true);                                           // la tenue et « Mes salles » partent avec le héros
  let r=null, err=false; try{ r=await HMGS.codeTransfert(); }catch(e){ err=true; }
  if(r&&r.ok){
    const fin=new Date(Math.min(Date.parse(r.expires_at)||Infinity,Date.now()+15*60e3-5e3));   // l'horloge du téléphone peut différer de celle du serveur
    C.innerHTML=`<b>${esc(r.code)}</b><small data-reste></small>`;
    M.innerHTML=`Sur ton nouveau téléphone, ouvre HMG puis va dans <b style="color:#fff">Moi › Réglages › Changer de téléphone</b> et tape ce code.<br><br>Dès qu'il est utilisé, ton héros quitte ce téléphone-ci.`;
    A.innerHTML=`<button class="cq-btn" data-copy>Copier le code</button><button class="cq-link" data-sh-x>Fermer</button>`;
    A.querySelector("[data-copy]").onclick=async()=>{ try{ await navigator.clipboard.writeText(r.code); cqVib("succes"); toast("Code copié."); }catch(e){ toast("Note le code à la main."); } };
    const R=C.querySelector("[data-reste]"), tic=()=>{ if(!document.body.contains(R)) return clearInterval(t); const s=Math.max(0,Math.round((fin-Date.now())/1000));
      if(!s){ clearInterval(t); C.classList.add("fini"); R.textContent="Code expiré : demandes-en un autre."; return; } R.textContent=`Valable jusqu'à ${cpHeure(fin)} · encore ${Math.floor(s/60)} min ${String(s%60).padStart(2,"0")}`; };
    const t=setInterval(tic,1000); tic();
  } else {
    C.remove();
    M.textContent={vide:"Tu n'as pas encore de héros à transférer. Valide ta première séance d'abord.",apple:"Ton compte est relié à Apple : sur ton nouveau téléphone, connecte-toi simplement avec Apple.",
      limite:"Tu as demandé beaucoup de codes. Réessaie dans une heure."}[r&&r.why]||(err?"Pas de connexion. Vérifie ton réseau et réessaie.":"Le code n'a pas pu être créé. Réessaie dans un instant.");
    A.innerHTML=`<button class="cq-btn ghost" data-sh-x>OK</button>`;
  }
}
function cpEntrer(o={}){
  const f=cqFeuille(`<h2>${o.titre||"Entre ton code de transfert"}</h2><p>${o.texte||"Sur ton ancien téléphone : Moi › Réglages › Changer de téléphone › « Je suis sur mon ancien téléphone »."}</p>
    <input class="cq-field cp-champ" type="text" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" spellcheck="false" maxlength="14" placeholder="XXXXX-XXXXX" aria-label="Code de transfert">
    <div class="cp-msg" aria-live="polite"></div>
    <p class="cq-note">Le héros de ce téléphone-ci sera remplacé par celui de ton ancien téléphone. Si celui-ci a plus de séances, c'est lui qui est gardé.</p>
    <button class="cq-btn" data-ok disabled>Récupérer mon héros</button>${o.secours?`<button class="cq-link" data-secours><u>J'ai un code de secours du site</u></button>`:`<button class="cq-link" data-sh-x>Annuler</button>`}`);
  const I=f.el.querySelector(".cp-champ"), B=f.el.querySelector("[data-ok]"), M=f.el.querySelector(".cp-msg");
  const net=()=>I.value.toUpperCase().replace(/[^0-9A-Z]/g,"");
  const sec=f.el.querySelector("[data-secours]"); if(sec) sec.onclick=()=>{ f.fermer(); setTimeout(()=>{ try{ acctModal("restore"); }catch(e){} },230); };
  I.addEventListener("input",()=>{ const n=net().slice(0,10); I.value=n.length>5?n.slice(0,5)+"-"+n.slice(5):n; B.disabled=n.length!==10; M.textContent=""; });
  setTimeout(()=>{ try{ I.focus(); }catch(e){} },300);
  B.addEventListener("click",async()=>{
    B.disabled=true; B.textContent="Je récupère ton héros…"; M.textContent="";
    let r=null, err=false; try{ r=await HMGS.transfert(net()); }catch(e){ err=true; r=e&&e.why?{ok:false,why:e.why}:null; }
    if(r&&r.ok){
      cqVib("succes"); B.textContent="C'est bon !";
      const d=await cpCharger(), st=r.state||cpEtat();
      if(d&&d.v!==voterId) return cpRestaurer(Object.assign({},d,{no:(st&&st.no)||d.no}),"transfert");
      store.set("hmg-cp-no",(st&&st.no)||null); store.set("hmg-cp-retour","transfert"); store.set("hmg-onb",{done:true,le:today()});
      setTimeout(()=>location.replace(location.pathname+location.search),400); return;
    }
    B.disabled=false; B.textContent="Récupérer mon héros"; cqVib("alerte");
    M.textContent={code:"Ce code ne marche pas, ou il a expiré. Vérifie-le, ou demandes-en un nouveau sur ton ancien téléphone.",limite:"Trop d'essais. Réessaie dans une heure."}[r&&r.why]
      ||(err?"Pas de connexion. Vérifie ton réseau et réessaie.":"Ça n'a pas marché. Réessaie dans un instant.");
  });
}
/* ---------- 3. compte du site déjà repris sur un autre appareil */
window.addEventListener("hmgs:reprise",e=>{ if(!e.detail||e.detail.why!=="pris"||store.get("hmg-cp-pris",0)) return; store.set("hmg-cp-pris",1);
  setTimeout(()=>cpEntrer({titre:"Ton héros est sur un autre téléphone",texte:"Ce compte HMG est déjà utilisé ailleurs. Sur l'autre téléphone, va dans Moi › Réglages › Changer de téléphone pour obtenir un code, puis tape-le ici."}),1500); });

/* ---------- 4. appli en test privé : entrer son invitation */
function cpInvitation(){
  if(!APPLI||document.getElementById("cpInvite")) return;
  const d=document.createElement("div"); d.id="cpInvite"; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true"); d.setAttribute("aria-labelledby","cpInvT");
  d.innerHTML=`<div class="pv-card"><div class="pv-logo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg></div>
    <small>HMG Fitness</small><h1 id="cpInvT">Bienvenue dans le test</h1><p>HMG est en test privé. Tape le code d'invitation qu'on t'a envoyé, ou ouvre ton lien d'invitation sur ce téléphone.</p>
    <form autocomplete="off"><input name="code" placeholder="Ton code d'invitation" aria-label="Code d'invitation" autocapitalize="none" spellcheck="false" enterkeyhint="go"><button>Entrer</button></form>
    <div class="cp-msg" aria-live="polite"></div></div>`;
  document.body.appendChild(d); document.body.classList.add("cp-bloque");
  const F=d.querySelector("form"), M=d.querySelector(".cp-msg"), B=F.querySelector("button");
  F.addEventListener("submit",e=>{ e.preventDefault(); cpInviter(F.code.value.replace(/^.*\/invite\/|^.*[?&]c=|^.*invite=/,""),M,B); });
}
async function cpInviter(code,M,B){
  code=String(code||"").trim().toLowerCase(); if(code.length<4){ if(M) M.textContent="Tape le code complet."; return; }
  if(B){ B.disabled=true; B.textContent="…"; }
  let r=null, err=false; try{ r=await HMGS.invitation(code); }catch(e){ err=true; }
  if(r&&r.ok){ cqVib("succes"); store.set("hmg-parrain",code); if(M){ M.className="cp-msg ok"; M.textContent="C'est bon, bienvenue !"; } setTimeout(()=>location.replace(location.pathname+location.search),600); return true; }
  if(B){ B.disabled=false; B.textContent="Entrer"; } cqVib("alerte");
  if(M) M.textContent={code:"Ce code ne marche pas, ou il a déjà servi au maximum. Vérifie le lien qu'on t'a envoyé.",limite:"Trop d'essais. Réessaie dans une heure."}[r&&r.why]
    ||(err?"Pas de connexion. Vérifie ton réseau et réessaie.":"Ça n'a pas marché. Réessaie dans un instant.");
  return false;
}
if(window.HMGS){
  window.addEventListener("hmgs:invitation",()=>cpInvitation());
  HMGS.pret().then(s=>{ if(s&&s.acces===false) cpInvitation(); }).catch(()=>{});
  /* lien hmgfitness.fr/invite/CODE reçu pendant que l'écran d'invitation est affiché */
  window.addEventListener("hmg:route",e=>{ const r=e.detail; if(!r||r.chemin!=="invite"||!r.code||!document.getElementById("cpInvite")) return;
    e.preventDefault(); const d=document.getElementById("cpInvite"); cpInviter(r.code,d.querySelector(".cp-msg"),d.querySelector("form button")); });
}
