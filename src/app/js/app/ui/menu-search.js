// ---------- Recherche dans le menu (17.3) : trouve un menu ou un sous-menu par son nom, sans accents ni majuscules ----------
const navNorm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const navTr = x => window.LANG && window.LANG.lang === 'en' ? window.LANG.tr(x) : x;
function navEntries(){
  const simple = navMode() === 'simple', out = [];
  (simple ? NAV2 : NAV_GROUPS).forEach(([g, ks]) => ks.forEach(k => {
    if(k[0] === '@'){ const [l, , ms] = NAV_SETS[k.slice(1)]; ms.filter(m => TAB_BY[m]).forEach(m => out.push({k: m, l: TAB_BY[m][1], path: [g, l]})); }
    else if(TAB_BY[k]) out.push({k, l: TAB_BY[k][1], path: [g]}); }));
  return out;
}
function navSearch(){
  const inp = $('#navq'), res = $('#navqres'), nav = $('#nav'); if(!inp || !res) return;
  let sel = 0, cur = [];
  const show = () => {
    const q = navNorm(inp.value.trim()), words = q.split(/\s+/).filter(Boolean); window.__navQ = inp.value;
    nav.classList.toggle('searching', !!words.length); res.hidden = !words.length; if(!words.length){ cur = []; res.innerHTML = ''; return; }
    cur = navEntries().map(e => { const l = navNorm(e.l + ' ' + navTr(e.l)), p = navNorm(e.path.concat(e.path.map(navTr)).join(' ') + ' ' + e.k);
      if(!words.every(w => l.includes(w) || p.includes(w))) return null;
      const lt = navNorm(navTr(e.l)), lf = navNorm(e.l), w0 = words[0];
      return {...e, sc: (lt.startsWith(w0) || lf.startsWith(w0) ? 0 : words.every(w => l.includes(w)) ? 1 : 2)}; }).filter(Boolean)
      .sort((a, b) => a.sc - b.sc || navTr(a.l).localeCompare(navTr(b.l)));
    sel = 0;
    res.innerHTML = cur.length ? cur.map((e, i) => `<a href="#${e.k}" data-qk="${e.k}" role="option" class="navqr${i === sel ? ' sel' : ''}" aria-selected="${i === sel}" title="${esc(e.path.concat(e.l).map(navTr).join(' › '))}">${navIcon(e.k)}<span class="lb">${esc(navTr(e.l))}<small>${e.path.map(x => esc(navTr(x))).join(' › ')}</small></span></a>`).join('')
      : '<div class="navqn">Aucun menu trouvé</div>';
  };
  const mark = () => res.querySelectorAll('.navqr').forEach((a, i) => { a.classList.toggle('sel', i === sel); a.setAttribute('aria-selected', i === sel); if(i === sel) a.scrollIntoView({block: 'nearest'}); });
  const clear = () => { inp.value = ''; show(); };
  inp.addEventListener('input', show);
  inp.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown' && cur.length){ e.preventDefault(); sel = (sel + 1) % cur.length; mark(); }
    else if(e.key === 'ArrowUp' && cur.length){ e.preventDefault(); sel = (sel - 1 + cur.length) % cur.length; mark(); }
    else if(e.key === 'Enter' && cur.length){ e.preventDefault(); const k = cur[sel].k; clear(); inp.blur(); document.body.classList.remove('navopen'); location.hash = '#' + k; }
    else if(e.key === 'Escape'){ if(inp.value){ e.preventDefault(); e.stopPropagation(); clear(); } else inp.blur(); } });
  res.addEventListener('click', e => { const a = e.target.closest('[data-qk]'); if(!a) return; clear(); document.body.classList.remove('navopen'); });
  show();
}
{ let closed = []; try{ closed = JSON.parse(localStorage.getItem('navgroupes3cx') || '[]'); }catch(e){}
function buildNav(){
  const simple = navMode() === 'simple', groups = simple ? NAV2 : NAV_GROUPS;
  const sw = `<div class="navmode" role="group" aria-label="Type de menu">${[['simple', 'Simplifié', 'Menu simplifié : onglets voisins regroupés, avec des sous-onglets'], ['expert', 'Complet', `Menu complet : les ${TABS.length} onglets à plat`]].map(([v, l, t]) => `<button type="button" data-navmode="${v}" title="${t}"${(simple ? 'simple' : 'expert') === v ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>${l}</button>`).join('')}</div>`;
  const q = `<div class="navq"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5"/></svg><input id="navq" type="search" autocomplete="off" spellcheck="false" placeholder="Rechercher un menu…" aria-label="Rechercher un menu ou un sous-menu" aria-controls="navqres" value="${esc(window.__navQ || '')}"></div><div id="navqres" role="listbox" aria-label="Menus trouvés" hidden></div>`;
  const bt = simple ? `<label class="tourtgl navbeta" title="Menu simplifié organisé par question : au quotidien, analyser, technique"><input type="checkbox" id="navbeta"${navBeta() ? ' checked' : ''}> Nouveau menu (bêta)</label>` : '';
  $('#nav').innerHTML = sw + bt + q + groups.map(([g, ks], gi) => `<div class="ngrp${closed.includes(String(gi)) ? ' closed' : ''}" data-gi="${gi}"><div class="ng">${esc(g)}<span class="ngc">▾</span></div><div class="ngl">` + ks.map(k => {
    if(k[0] === '@'){ const [l, ic, ms] = NAV_SETS[k.slice(1)], m = ms.filter(x => TAB_BY[x]); if(!m.length) return '';
      return `<a href="#${navLast(k.slice(1))}" data-set="${k.slice(1)}" data-k="${m[0]}" title="${esc(l + ' : ' + m.map(x => TAB_BY[x][1]).join(', '))}">${navIcon(ic)}<span class="lb">${esc(l)}</span></a>`; }
    if(!TAB_BY[k]) return ''; const [, l, n] = TAB_BY[k];
    return `<a href="#${k}" data-k="${k}" title="${esc(l)}">${navIcon(k)}<span class="lb">${esc(l)}</span>${n!=null?`<span class="n">${nf(n)}</span>`:''}</a>`; }).join('') + '</div></div>').join('') + `<div class="navfoot"><a href="#" data-tour="1" class="navcl" title="Présentation de l'outil en quelques étapes">${navIcon('visite')}<span class="lb">Visite guidée</span></a><a href="${location.pathname.includes('/anciennes-versions/') ? '../' : ''}${document.documentElement.lang === 'en' ? 'documentation-en.html' : 'documentation.html'}#glossaire" class="navcl" title="Les mots de 3CX expliqués simplement">${navIcon('glossaire')}<span class="lb">Glossaire</span></a><a href="${location.pathname.includes('/anciennes-versions/') ? '../' : ''}changelog.html" class="navcl" title="Historique des versions de 3CXplore">${navIcon('changelog')}<span class="lb">Changelog</span></a></div>`;
}
buildNav(); navSearch();
// bouton Simplifié / Complet (branché une seule fois : le menu est reconstruit à chaque changement)
if(!window.__navModeWired){ window.__navModeWired = true;
  document.addEventListener('change', e => { if(e.target.id !== 'navbeta') return; try{ localStorage.setItem(NAVBETA_KEY, e.target.checked ? '1' : '0'); }catch(er){} (window.__app.navApply || navApply)(); window.__app.rebuildNav && window.__app.rebuildNav(); });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-navmode]'); if(!b) return;
    try{ localStorage.setItem(NAVMODE_KEY, b.dataset.navmode); }catch(er){} window.__app.rebuildNav && window.__app.rebuildNav(); }); }
window.__app.rebuildNav = () => { buildNav(); navSearch(); route(); };
}
$('#sub').textContent = `${D.info.company} · ${D.info.fqdn} · V${D.info.version}${SEG ? ' · magasin : ' + segShort(SEG) : ''}`;
{ const ss = $('#segsel'); ss.hidden = false; ss.classList.toggle('on', !!SEG);
  ss.innerHTML = `<option value="">Tous les magasins</option>` + SEG_LIST.map(c => `<option value="${esc(c)}"${c===SEG?' selected':''}>${esc(segShort(c))} · ${FULL.extensions.filter(e => SEGOF[e.number]===c).length} postes</option>`).join(''); }
{ const b = $('#fwhdr'), rows = phoneRows(), mods = modelRows(rows);
  const age = Math.round((Date.now() - Date.parse(FW_REF.date)) / 86400000);
  const issues = rows.filter(r => r.st === 'old' || r.st === 'unk').length + mods.filter(m => m.st === 'missing' || m.st === 'srvold').length;
  b.hidden = false; b.querySelector('.dot').hidden = !(age > 30 || issues);
  b.classList.toggle('stale', age > 30);
  b.title = `Vérifier les firmwares — liste 3CX du ${FW_REF.date}` + (age > 30 ? ` (${age} jours)` : '') + (issues ? ` · ${issues} point${issues>1?'s':''} à traiter` : ''); }
window.__app.openFwCheck = () => openFwCheck();
window.__app.setSeg = v => { try{ localStorage.setItem(SEG_SEL_KEY, v); }catch(e){} BK.rerun(); };
function route(){
  const [k, arg] = decodeURIComponent(location.hash.slice(1) || (window.loadAppearance ? window.loadAppearance().home : '') || 'dashboard').split('/');
  const tab = V[k] ? k : 'dashboard';
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on', a.dataset.set ? a.dataset.set === SET_OF[tab] : a.dataset.k===tab));
  const onA = document.querySelector('#nav a.on'); if(onA && onA.scrollIntoView) onA.scrollIntoView({block: 'nearest'});
  closeDrawer(); V[tab]($('#main'), arg); window.scrollTo(0,0);
}
// bandeau « magasin » et sous-onglets en haut de la page : ajoutés après chaque affichage d'un onglet,
// y compris quand l'onglet se redessine lui-même (période, seuil, filtre…), sinon ils disparaissaient
const CDRV = 7; // classement des appels attendu (voir D.cdrv à la lecture du backup)
function decorate(tab){
  const main = $('#main'); main.querySelectorAll(':scope > [data-deco]').forEach(x => x.remove());
  if(FULL.calls.length && !((FULL.cdrv || 0) >= CDRV)){ const w = document.createElement('div'); w.className = 'segbar'; w.dataset.deco = '1'; w.style.borderColor = 'var(--warn)';
    w.textContent = 'Les appels de ce backup ont été lus par une version précédente de 3CXplore : rouvrez le backup (Fermer le backup, puis le choisir de nouveau) pour appliquer les dernières corrections (classement des appels, masquage du journal d\'audit).'; main.prepend(w); }
  if(SEG && tab !== 'magasins'){ const b = document.createElement('div'); b.className = 'segbar'; b.dataset.deco = '1';
    b.innerHTML = `Affichage limité au magasin <b>${esc(segName(SEG))}</b> — ${D.extensions.length} postes, ${D.queues.length} files, ${allDIDs.length} SDA, ${nf(D.calls.filter(c => callSeg(c) === SEG).length)} appels. <a href="#" id="segall">Voir tous les magasins</a>`;
    main.prepend(b); b.querySelector('#segall').addEventListener('click', e => { e.preventDefault(); window.__app.setSeg(''); }); }
  const st = navMode() === 'simple' ? subTabs(tab) : null; if(st){ st.dataset.deco = '1'; main.prepend(st); }
  // 16.3 : bouton « ? » à côté du titre de l'onglet : ouvre sa section du guide de l'utilisateur dans un nouvel onglet
  const h = main.querySelector('h2'); if(h && TAB_BY[tab] && !h.querySelector('.tabhelp')){ const a = document.createElement('a'); a.className = 'tabhelp';
    a.href = `${location.pathname.includes('/anciennes-versions/') ? '../' : ''}${document.documentElement.lang === 'en' ? 'documentation-en.html' : 'documentation.html'}#o-${tab}`; a.target = '_blank'; a.rel = 'noopener';
    a.title = "Aide sur cet onglet (guide de l'utilisateur)"; a.setAttribute('aria-label', a.title); a.textContent = '?'; h.appendChild(a); }
}
Object.keys(V).forEach(k => { const f = V[k]; V[k] = function(el, ...a){ const r = f.call(this, el, ...a); if(el === $('#main')) decorate(k); return r; }; });
