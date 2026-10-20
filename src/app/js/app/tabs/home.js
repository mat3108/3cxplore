// ---------- Accueil (20.0) : « Que voulez-vous faire ? » — les actions courantes, puis une tuile par rubrique, de la couleur de son menu ----------
V.accueil = el => {
  const n = RECO_COUNT, pages = id => NAV_SETS[id][2].filter(k => TAB_BY[k]);
  const tile = id => { const [l, ic] = NAV_SETS[id], ms = pages(id);
    return `<div class="hot" style="--rc:${navColor(id)}"><span class="hoti">${navIcon(ic)}</span><div class="hotb"><h4><a href="#${navLast(id)}" class="hotl">${esc(l)}</a></h4><p>${esc(NAV_HINT[id] || '')}</p>`
      + `<div class="hotp">${ms.slice(0, 3).map(k => `<a href="#${k}">${esc(TAB_BY[k][1])}</a>`).join('')}${ms.length > 3 ? `<span class="hotm">et ${ms.length - 3} autre${ms.length - 3 > 1 ? 's' : ''}</span>` : ''}</div></div></div>`; };
  const groups = NAV2.filter(([, ks]) => ks.some(k => k[0] === '@'));
  el.innerHTML = `<div class="home">
    <div class="hohead"><h2>Que voulez-vous faire ?</h2>
      <p class="lead">Choisissez une rubrique. Chacune a sa couleur, que vous retrouvez dans le menu à gauche.</p>
      <div class="hosearch"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5"/></svg><input id="hoq" type="search" autocomplete="off" spellcheck="false" placeholder="Chercher une page : appels manqués, jours fériés, poste…" aria-label="Chercher une page" aria-controls="hores"></div>
      <div id="hores" class="hores" role="listbox" aria-label="Pages trouvées" hidden></div></div>
    <a class="hofix${n ? '' : ' ok'}" href="#priorites" style="--rc:${n ? navColor('reparer') : 'var(--ok)'}"><span class="hofn">${n ? nf(n) : '✓'}</span><span class="hoft"><b>${n ? `${n > 1 ? 'choses' : 'chose'} à réparer` : 'Rien d\'urgent à réparer'}</b><span>${n ? 'Commencez par la plus urgente : la liste est triée pour vous.' : 'Vous pouvez quand même jeter un œil aux priorités.'}</span></span><span class="hofgo">Voir la liste</span></a>
    <h3 class="hoh">Je veux…</h3>
    <div class="hodo">${Object.keys(NAV_DO).filter(k => TAB_BY[k]).map(k => `<a href="#${k}" style="--rc:${navColor(k)}">${navIcon(k)}<span>${esc(NAV_DO[k])}</span></a>`).join('')}</div>
    ${groups.map(([g, ks]) => `<h3 class="hoh">${esc(g)}</h3><div class="hogrid">${ks.filter(k => k[0] === '@').map(k => tile(k.slice(1))).join('')}</div>`).join('')}
  </div>`;
  // recherche : les mêmes pages que la recherche du menu, avec leur rubrique
  const inp = el.querySelector('#hoq'), res = el.querySelector('#hores');
  inp.addEventListener('input', () => {
    const words = navNorm(inp.value.trim()).split(/\s+/).filter(Boolean); res.hidden = !words.length; if(!words.length){ res.innerHTML = ''; return; }
    const hits = navEntries().filter(e => { const s = navNorm([e.l, navTr(e.l), ...e.path, ...e.path.map(navTr)].join(' ')); return words.every(w => s.includes(w)); }).slice(0, 8);
    res.innerHTML = hits.length ? hits.map(e => `<a href="#${e.k}" role="option" style="--rc:${navColor(SET_OF[e.k] || e.k)}">${navIcon(e.k)}<span><b>${esc(navTr(e.l))}</b><small>${e.path.map(x => esc(navTr(x))).join(' › ')}</small></span></a>`).join('')
      : '<p class="muted">Aucune page ne correspond. Essayez un autre mot, par exemple « appels » ou « poste ».</p>';
  });
  inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ const a = res.querySelector('a'); if(a){ e.preventDefault(); location.hash = a.getAttribute('href'); } } });
};
