// ---------- Visite guidée (17.1) : quelques bulles qui présentent l'essentiel ; lancée une fois automatiquement, puis depuis le menu ----------
const TOUR_KEY = 'visite3cx';
const TOUR = [
  {t: 'Bienvenue dans 3CXplore', d: "Une visite en quelques étapes pour trouver l'essentiel. Passez-la à tout moment (touche Échap) et relancez-la avec « Visite guidée », en bas du menu de gauche.", sel: null},
  {t: 'Choisir un magasin', d: 'Cette liste limite tous les onglets à un magasin ; « Tous les magasins » montre tout le système.', sel: '#segsel'},
  {t: 'Le menu', d: "Les onglets sont regroupés par thème. « Simplifié » réunit les onglets voisins avec des sous-onglets en haut de la page ; « Complet » les affiche tous. L'interrupteur « Nouveau menu (bêta) » propose une organisation par question, et le champ juste en dessous trouve un menu ou un sous-menu par son nom.", sel: '#nav .navmode', nav: true},
  {t: 'Priorités', d: 'Tous les problèmes en une seule liste, classés selon le nombre d\'appels touchés : un bon point de départ chaque jour.', sel: '#nav a[data-k="priorites"]', nav: true},
  {t: 'Rechercher', d: 'Tapez « / » pour chercher un poste, un SDA, une adresse MAC ou un nom ; Ctrl+K (Cmd+K sur Mac) ouvre la palette de commandes.', sel: '#gsearch'},
  {t: 'Aide sur chaque onglet', d: "Le « ? » à côté du titre ouvre l'explication de l'onglet dans le guide de l'utilisateur.", sel: '#main .tabhelp'},
  {t: 'Exporter et imprimer', d: 'La plupart des tableaux ont un bouton « Exporter (CSV) » ; les fiches et rapports s\'impriment ou s\'enregistrent en PDF.', sel: null},
  {t: 'Langue', d: "Le bouton FR / EN passe l'interface, et le guide, en anglais ou en français.", sel: '#langbtn'},
  {t: 'Guide, glossaire et changelog', d: "« Documentation », en haut, ouvre le guide de l'utilisateur ; en bas du menu : la visite guidée, le glossaire des termes 3CX et l'historique des versions.", sel: '#nav .navfoot', nav: true},
  {t: 'Bonne exploration !', d: 'Vos réglages (magasins, notes, objectifs…) restent dans ce navigateur ; exportez-les avec « Sauvegarde des réglages ».', sel: null}];
function tourStart(){
  if(document.getElementById('tour')) return;
  let i = 0; const ov = document.createElement('div'); ov.id = 'tour'; ov.innerHTML = '<div class="tour-hole"></div><div class="tour-box" role="dialog" aria-modal="true" aria-live="polite"></div>';
  document.body.appendChild(ov); const hole = ov.firstChild, box = ov.lastChild, wasOpen = document.body.classList.contains('navopen');
  const end = () => { ov.remove(); document.removeEventListener('keydown', key, true); window.removeEventListener('resize', draw); document.body.classList.toggle('navopen', wasOpen); try{ localStorage.setItem(TOUR_KEY, 'vue'); }catch(e){} };
  const go = d => { i = Math.max(0, Math.min(TOUR.length - 1, i + d)); draw(); };
  const key = e => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); end(); } else if(e.key === 'ArrowRight'){ e.preventDefault(); go(1); } else if(e.key === 'ArrowLeft'){ e.preventDefault(); go(-1); } };
  function draw(){
    const s = TOUR[i], narrow = innerWidth < 900;
    document.body.classList.toggle('navopen', !!(s.nav && narrow) || (wasOpen && !s.nav));
    const el = s.sel ? document.querySelector(s.sel) : null; if(el) el.scrollIntoView({block: 'nearest'});
    const r = el && el.getBoundingClientRect(), vis = !!(r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
    hole.style.cssText = vis ? `left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px` : `left:${innerWidth / 2}px;top:${innerHeight / 2}px;width:0;height:0;outline:0`;
    const last = i === TOUR.length - 1;
    box.innerHTML = `<div class="tour-n">${i + 1} / ${TOUR.length}</div><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p>
      <div class="tour-b"><button class="btn" data-t="end">${last ? 'Fermer' : 'Passer la visite'}</button><span style="flex:1"></span>${i ? '<button class="btn" data-t="prev">Précédent</button>' : ''}<button class="btn primary" data-t="next">${last ? 'Terminer' : 'Suivant'}</button></div>`;
    const bw = Math.min(360, innerWidth - 24); box.style.width = bw + 'px'; const bh = box.offsetHeight; let left, top;
    if(vis){ left = Math.min(Math.max(12, r.left), innerWidth - bw - 12); top = r.bottom + 14; if(top + bh > innerHeight - 12) top = Math.max(12, r.top - bh - 14);
      if(r.right + bw + 24 < innerWidth && r.left < innerWidth / 3){ left = r.right + 18; top = Math.min(Math.max(12, r.top), innerHeight - bh - 12); } }
    else { left = (innerWidth - bw) / 2; top = Math.max(12, (innerHeight - bh) / 2); }
    box.style.left = left + 'px'; box.style.top = top + 'px'; box.querySelector('[data-t="next"]').focus({preventScroll: true});
  }
  box.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if(!b) return; const t = b.dataset.t; if(t === 'next'){ if(i === TOUR.length - 1) end(); else go(1); } else if(t === 'prev') go(-1); else end(); });
  document.addEventListener('keydown', key, true); window.addEventListener('resize', draw); draw();
}
window.__app.tour = tourStart;
if(!window.__tourWired){ window.__tourWired = true; document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-tour]'); if(!a) return; e.preventDefault(); window.__app.tour && window.__app.tour(); }); }
// 17.1.2 : à l'import d'un backup (pas au simple rechargement de la page), si l'interrupteur « Visite guidée à l'ouverture du backup » est activé — désactivé par défaut
{ let on = ''; try{ on = localStorage.getItem('visiteauto3cx') || ''; }catch(e){} const fresh = !!window.__bkImported; window.__bkImported = false;
  if(on === '1' && fresh) setTimeout(() => { if(!document.getElementById('tour')) tourStart(); }, 1500); }
window.__app.route = route;
try{ const t=localStorage.getItem('theme3cx'); if(t) document.documentElement.dataset.theme=t; }catch(e){}
route();
