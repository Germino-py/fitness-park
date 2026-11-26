"use strict";
if(window.HMG_PRIVE) throw new Error("HMG : accès privé (test avant la sortie de l'appli)");
/* ================= LA SÉANCE EN 2 TEMPS (1-jeu-vies.md §1 et §14.2-14.3) =================
   Avec le serveur du jeu (HMGS en mode "serveur" ou "demo") :
   1. « Je suis à la salle » ouvre la séance sur place (session_start, la salle est choisie par le serveur) ;
   2. « J'ai fini », au moins 20 min plus tard et au plus 3 h, toujours sur place, la valide (session_confirm) :
      +1 pas, points, coffre, guérison. Une séance oubliée devient « courte » (compte pour l'objectif, sans pas).
   Sans serveur du jeu (mode "ancien" : migrations pas encore appliquées), l'ancien doCheckin d'app.js reste en place. */
const SE = { busy:false, tick:0, decal:0 };
const seSrv = () => { try{ const s=window.HMGS&&HMGS.statut&&HMGS.statut(); return !!s&&(s.mode==="serveur"||s.mode==="demo"); }catch(e){ return false; } };
const seOuverte = st => st&&st.session&&st.session.status==="ouverte"?st.session:null;
const seNow = () => Date.now()+SE.decal;
const seMin = iso => Math.max(0,Math.ceil((Date.parse(iso)-seNow())/60000));
const seHeure = iso => { try{ return new Date(Date.parse(iso)-SE.decal).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); }catch(e){ return ""; } };
const seHorloge = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
const seNom = s => esc((s&&(s.club_name||(byId[s.club]&&byId[s.club].n)))||"ta salle");
function seRecalage(st){ if(st&&st.server_now){ const t=Date.parse(st.server_now); if(t) SE.decal=t-Date.now(); } }

async function seEtat(frais){ let st=null; try{ st=await HMGS.etat({frais:!!frais}); }catch(e){} seRecalage(st); return st; }
async function sePosition(){
  ckModal(`<div class="radar"><i></i><i></i><i></i>${ic("loc")}</div><h2>Je cherche ta salle…</h2><p>Ta position sert seulement à vérifier que tu es sur place. Elle n'est jamais affichée.</p>`);
  const g=await new Promise((ok,ko)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(ok,ko,{enableHighAccuracy:true,timeout:20000,maximumAge:0}):ko(new Error("geo")));
  return {lat:g.coords.latitude,lon:g.coords.longitude,acc:Math.round(g.coords.accuracy||9999)};
}
function seErreurPosition(e){
  const refus=e&&e.code===1;
  ckModal(`<div class="ck-ico bad">${ic("loc")}</div><h2>Position introuvable</h2><p>${e&&e.texte?esc(e.texte):refus?"Tu as refusé la localisation. Autorise-la dans les réglages, puis réessaie.":"Impossible d'obtenir ta position. Vérifie que la localisation est activée, puis réessaie."}</p>
    <div class="row2">${refus&&window.HMGN&&HMGN.peutOuvrirReglages?`<button data-x data-hmgn-reglages>Ouvrir les Réglages</button>`:""}<button class="cy" data-x>OK</button></div>`);
}
function seRefus(r,acc){
  const n=seNom(r), d=r.dist!=null?fmtDist(r.dist):"";
  const t={
    loin:[ic("loc"),"","Encore un effort",r.club_name?`Tu es à environ ${d} de <b>${n}</b>. Rapproche-toi de l'entrée (moins de 200 m) et réessaie.`:`Aucune salle de la carte à moins de 200 m.${d?` La plus proche est à ${d}.`:""}`],
    precision:[ic("loc"),"","Position trop imprécise",window.HMGN&&HMGN.textes&&HMGN.textes.positionImprecise?HMGN.textes.positionImprecise(r.acc||acc):`Ton téléphone te situe à ±${r.acc||acc} m près. Active la position exacte, mets-toi près de l'entrée ou d'une fenêtre, puis réessaie.`],
    deja:[ic("check"),"ok","Séance déjà validée","Ta séance du jour est comptée. Reviens demain pour le pas suivant."],
    salle:[ic("loc"),"","Salle pas encore vérifiée",`La position exacte de <b>${n}</b> est en cours de vérification. Réessaie très bientôt.`],
    quota:[ic("x"),"bad","Trop d'essais aujourd'hui","Réessaie demain, depuis ta salle."],
    vite:[ic("x"),"","Doucement !","Réessaie dans une minute."],
    position:[ic("loc"),"bad","Position invalide","Réessaie dans un instant."],
    bloque:[ic("x"),"bad","Compte suspendu","Ton compte ne peut plus valider de séances. Écris-nous depuis Aide si c'est une erreur."],
    expiree:[ic("x"),"","Séance trop ancienne","Plus de 3 h se sont écoulées : elle compte comme une séance courte pour ton objectif. La prochaine fois, pense à « J'ai fini » avant de partir."],
    introuvable:[ic("x"),"","Séance introuvable","Touche « Je suis à la salle » pour en commencer une nouvelle."],
    autre_salle:[ic("loc"),"","Pas la même salle",`Ta séance a commencé à <b>${n}</b>. Valide-la depuis cette salle.`]
  }[r.why]||[ic("x"),"bad","Oups","Réessaie dans un instant."];
  ckModal(`<div class="ck-ico ${t[1]}">${t[0]}</div><h2>${t[2]}</h2><p>${t[3]}</p><div class="row2">${r.why==="precision"&&window.HMGN&&HMGN.peutOuvrirReglages?`<button data-x data-hmgn-reglages>Ouvrir les Réglages</button>`:""}<button class="cy" data-x>OK</button></div>`);
}
function seReseau(e){
  ckModal(`<div class="ck-ico bad">${ic("x")}</div><h2>Pas de réseau ?</h2><p>La séance n'a pas pu être envoyée. Vérifie ta connexion et réessaie, toujours depuis la salle.</p><button class="cy" data-x>OK</button>`);
}

/* ---------- 1. « Je suis à la salle » */
async function seDebut(){
  let p; try{ p=await sePosition(); }catch(e){ return seErreurPosition(e); }
  let r; try{ r=await HMGS.seanceDebut(p); }catch(e){ if(e&&e.hint==="ancien") return seAncien(); return seReseau(e); }
  seRecalage(r&&r.state);
  if(r&&r.ok){
    const s=seOuverte(r.state)||{club_name:r.club_name,club:r.club,confirm_from:new Date(seNow()+20*60000).toISOString()};
    cqVib("succes"); try{ gmSnd("pop"); }catch(e){}
    ckModal(`<div class="ck-ico ok">${seHorloge}</div><h2>C'est parti à ${seNom(s)} !</h2>
      <p>Ta séance a commencé. Entraîne-toi, puis touche <b>« J'ai fini »</b> sur place, à partir de <b>${seHeure(s.confirm_from)}</b>.${window.HMGN&&HMGN.natif?" On te le rappelle.":""}</p>
      <p class="mini" style="opacity:.75">Tu as jusqu'à 3 h. Une séance oubliée compte quand même pour ton objectif, mais sans pas ni coffre.</p>
      <button class="cy" data-x>Compris</button>`);
    try{ await HMGC.rafraichir(); }catch(e){}
    return;
  }
  if(r&&r.why==="en_cours") return seFin(seOuverte(await seEtat(true)));
  if(r&&r.why==="objectif"){ const m=$("ckModal"); if(m) m.remove(); toast("Choisis d'abord ton objectif de la semaine."); return cqObjectif(); }
  seRefus(r||{},p.acc);
}

/* ---------- 2. « J'ai fini » */
async function seFin(s){
  if(!s) return seDebut();
  const reste=seMin(s.confirm_from);
  if(reste>0){
    ckModal(`<div class="ck-ico">${seHorloge}</div><h2>Séance en cours</h2><p>À <b>${seNom(s)}</b>. Encore <b>${reste} min</b> avant de pouvoir la valider : reste sur place et reviens toucher « J'ai fini » à partir de ${seHeure(s.confirm_from)}.</p><button class="cy" data-x>OK</button>`);
    return;
  }
  let p; try{ p=await sePosition(); }catch(e){ return seErreurPosition(e); }
  let r; try{ r=await HMGS.seanceFin(s.id,p); }catch(e){ if(e&&e.hint==="ancien") return seAncien(); return seReseau(e); }
  seRecalage(r&&r.state);
  if(r&&r.ok) return seValidee(r,s);
  if(r&&r.why==="trop_tot"){ const m=Math.max(1,Math.ceil((r.wait_s||60)/60)); ckModal(`<div class="ck-ico">${seHorloge}</div><h2>Encore ${m} min</h2><p>Une séance dure au moins 20 minutes. Reste sur place et réessaie dans ${m} min.</p><button class="cy" data-x>OK</button>`); return; }
  if(r&&r.why==="loin"){ ckModal(`<div class="ck-ico">${ic("loc")}</div><h2>Tu as quitté la salle ?</h2><p>Pour valider, il faut être à moins de 200 m de <b>${seNom(s)}</b>${r.until?`, avant ${seHeure(r.until)}`:""}. Sinon, ta séance comptera comme courte : elle compte pour ton objectif, mais sans pas ni coffre.</p><button class="cy" data-x>OK</button>`); try{ HMGC.rafraichir(); }catch(e){} return; }
  seRefus(r||{},p.acc); try{ HMGC.rafraichir(); }catch(e){}
}

/* ---------- séance validée : le héros avance (même chemin que l'ancien doCheckin) */
function seValidee(r,s){
  const st=r.state||{}, club=(st.today&&st.today.club)||s.club;
  const m=$("ckModal"); if(m) m.remove();
  score.today=club||"ok"; score.day=today(); score.points=(score.points||0)+(r.points||0);
  if(club&&byId[club]&&typeof mineOn==="function"&&mineOn()&&!myVisits[club]){ myVisits[club]=today(); store.set("hmg-my-visits",myVisits); try{ drawMarker(byId[club]); }catch(e){} }
  score.days=Math.max((score.days||0)+1,typeof r.steps==="number"?r.steps:0); store.set("hmg-score",score);
  cqVib("succes");
  try{ applyFeatures(); }catch(e){}
  if(GM.on) gmSync(); else cqTab("aventure",{force:true});
  refreshScore(); try{ HMGC.rafraichir(); }catch(e){}
}
/* le serveur du jeu a disparu entre-temps (mode "ancien") : on repasse par l'ancienne validation */
function seAncien(){ const m=$("ckModal"); if(m) m.remove(); checking=false; return SE.ancien(); }

/* ---------- le bouton de l'Aventure suit la séance */
function seBouton(){
  clearTimeout(SE.tick); if(!seSrv()) return;
  const st=HMGC.etat, b=document.querySelector("#game .gm-go"); if(!b||!st) return; seRecalage(st);
  const s=seOuverte(st);
  if(s){ const reste=seMin(s.confirm_from);
    if(reste>0){ b.className="gm-go encours"; b.innerHTML=`${seHorloge} Séance en cours <em>J'ai fini dans ${reste} min</em>`; SE.tick=setTimeout(seBouton,Math.min(30000,Math.max(5000,(Date.parse(s.confirm_from)-seNow())%60000||30000))); }
    else { b.className="gm-go pret"; b.innerHTML=`${ic("check")} J'ai fini <em>valider ma séance</em>`; }
    b.setAttribute("aria-label",reste>0?`Séance en cours à ${s.club_name||"ta salle"}. Tu pourras la valider dans ${reste} minutes.`:"J'ai fini : valider ma séance");
  } else if(st.today&&st.today.status==="validee"){ b.className="gm-go done"; b.innerHTML=`${ic("check")} Séance du jour validée`; b.removeAttribute("aria-label");
  } else if(st.today&&st.today.status==="courte"&&!score.today){ b.className="gm-go done"; b.innerHTML=`${ic("check")} Séance courte comptée <em>à demain</em>`; }
}

/* ---------- branchements */
SE.ancien = doCheckin;
doCheckin = async function(){
  if(!seSrv()) return SE.ancien.apply(this,arguments);
  if(SE.busy) return; SE.busy=true;
  try{ const st=await seEtat(true);
    if(st&&st.today&&st.today.status==="validee"){ const m=$("ckModal"); if(m) m.remove(); try{ gmSay("Séance du jour déjà validée. Repos mérité, à demain !"); }catch(e){ toast("Séance du jour déjà validée."); } return; }
    const s=seOuverte(st); if(s) await seFin(s); else await seDebut();
  } finally { SE.busy=false; }
};
{ const _h=gmHud; gmHud=function(){ const r=_h.apply(this,arguments); try{ seBouton(); }catch(e){} return r; }; }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") try{ seBouton(); }catch(e){} });
