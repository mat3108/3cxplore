// ---------- Palette de commandes (⌘K / Ctrl+K) ----------
window.__app.openPalette = () => {
  if(document.querySelector('.cmdk')) return;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const tabs = NAV_GROUPS.flatMap(([g, ks]) => ks.filter(k => TAB_BY[k]).map(k => ({sec: 'Onglets', kind: g, label: TAB_BY[k][1], key: 'tab:' + k, icon: navIcon(k), run: () => { location.hash = '#' + k; }})));
  const segs = [['', 'Tous les magasins'], ...SEG_LIST.filter(s => s !== SEG_BRIDGE).map(s => [s, segName(s)])].map(([s, l]) => ({sec: 'Magasins', kind: 'Magasin', label: 'Afficher : ' + l, key: 'seg:' + s, run: () => window.__app.setSeg(s)}));
  const setPreset = p => { const A = window.loadAppearance(); A.preset = p[0]; delete A.accent; if(p[5]) window.applyTheme(p[5]); try{ localStorage.setItem('apparence3cx', JSON.stringify(A)); }catch(e){} window.applyAppearance(A); };
  const acts = [['light', 'Mode clair'], ['dark', 'Mode sombre'], ['', 'Mode automatique']].map(([t, l]) => ({sec: 'Actions', kind: 'Mode', label: l, key: 'mode:' + t, run: () => window.applyTheme(t)}))
    .concat((window.APP_PRESETS || []).map(p => ({sec: 'Actions', kind: 'Thème', label: 'Thème : ' + p[1], key: 'preset:' + p[0], run: () => setPreset(p)})))
    .concat([{sec: 'Actions', kind: 'Menu', label: 'Réduire ou étendre le menu', key: 'act:mini', run: () => { const c = document.getElementById('collapse'); if(c) c.click(); }},
      {sec: 'Actions', kind: 'Rapport', label: 'Rapport imprimable du magasin', key: 'act:rapport', run: () => { location.hash = '#rapport'; }},
      {sec: 'Actions', kind: 'Excel', label: 'Export Excel complet', key: 'act:xlsx', run: () => { location.hash = '#rapport'; setTimeout(() => { const b = document.getElementById('rpx'); if(b) b.scrollIntoView({block: 'center'}); }, 300); }},
      {sec: 'Actions', kind: 'Aide', label: 'Visite guidée', key: 'act:tour', run: () => setTimeout(() => window.__app.tour && window.__app.tour(), 200)},
      {sec: 'Actions', kind: 'Backup', label: 'Ouvrir un autre backup', key: 'act:bk', run: () => { location.hash = '#dashboard'; setTimeout(() => { const f = document.getElementById('bkfile'); if(f) f.click(); }, 300); }},
      {sec: 'Actions', kind: 'Aide', label: 'Documentation des versions', key: 'act:doc', run: () => { const a = document.querySelector('.vmenu a'); if(a) location.href = a.getAttribute('href'); }}]);
  const all = [...tabs, ...segs, ...acts], byKey = Object.fromEntries(all.map(c => [c.key, c]));
  let recents = []; try{ recents = JSON.parse(localStorage.getItem('palette3cx') || '[]'); }catch(e){}
  const ov = document.createElement('div'); ov.className = 'cmdk';
  ov.innerHTML = `<div class="cmdkbox" role="dialog" aria-modal="true" aria-label="Palette de commandes"><input id="cmdkq" placeholder="Aller à un onglet, un poste, un numéro, une file, un magasin ou une action…" autocomplete="off" spellcheck="false">
    <div class="cmdklist" id="cmdkl"></div><div class="cmdkft"><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>Entrée</kbd> ouvrir</span><span><kbd>Échap</kbd> fermer</span><span style="margin-left:auto"><kbd>${mac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd> palette · <kbd>/</kbd> recherche</span></div></div>`;
  document.body.appendChild(ov);
  const inp = ov.querySelector('#cmdkq'), list = ov.querySelector('#cmdkl');
  let cur = [], sel = 0;
  const find = q => {
    const t = gsNorm(q).trim();
    if(!t){ const rec = recents.map(k => byKey[k]).filter(Boolean).map(c => ({...c, sec: 'Récents'})); return [...rec, ...tabs.filter(c => !recents.includes(c.key))].slice(0, 30); }
    const words = t.split(/\s+/), score = c => { const s = gsNorm(c.label + ' ' + c.kind); if(!words.every(w => s.includes(w))) return 0; return gsNorm(c.label).startsWith(t) ? 3 : gsNorm(c.label).includes(t) ? 2 : 1; };
    const cmd = all.map(c => [score(c), c]).filter(x => x[0]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    const items = (window.__app.gsSearch ? window.__app.gsSearch(q) : []).map(r => ({sec: 'Éléments', kind: r.kind, label: r.label, sub: r.sub, run: r.open}));
    const order = ['Onglets', 'Éléments', 'Magasins', 'Actions'];
    return [...cmd.filter(c => c.sec === 'Onglets').slice(0, 8), ...items.slice(0, 12), ...cmd.filter(c => c.sec === 'Magasins').slice(0, 6), ...cmd.filter(c => c.sec === 'Actions').slice(0, 8)].sort((a, b) => order.indexOf(a.sec) - order.indexOf(b.sec));
  };
  const render = () => {
    let last = '';
    list.innerHTML = cur.length ? cur.map((c, i) => { const h = c.sec !== last ? `<div class="cmdksec">${esc(c.sec)}</div>` : ''; last = c.sec;
      return h + `<div class="cmdkit${i === sel ? ' on' : ''}" data-i="${i}">${c.icon || '<span class="cmdkdot"></span>'}<span class="cmdkl">${esc(c.label)}${c.sub ? `<span class="muted"> · ${esc(c.sub)}</span>` : ''}</span><span class="k">${esc(c.kind)}</span></div>`; }).join('') : '<div class="gsempty" style="padding:14px">Aucun résultat</div>';
    const on = list.querySelector('.cmdkit.on'); if(on) on.scrollIntoView({block: 'nearest'});
  };
  const close = () => { ov.remove(); document.removeEventListener('keydown', key, true); };
  const go = i => { const c = cur[i]; if(!c) return; if(c.key){ recents = [c.key, ...recents.filter(k => k !== c.key)].slice(0, 6); try{ localStorage.setItem('palette3cx', JSON.stringify(recents)); }catch(e){} }
    close(); document.body.classList.remove('navopen'); c.run(); };
  const key = e => { if(e.key === 'Escape'){ e.preventDefault(); close(); }
    else if(e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(sel + 1, cur.length - 1); render(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
    else if(e.key === 'Enter'){ e.preventDefault(); go(sel); } };
  document.addEventListener('keydown', key, true);
  inp.addEventListener('input', () => { cur = find(inp.value); sel = 0; render(); });
  list.addEventListener('mousemove', e => { const it = e.target.closest('.cmdkit'); if(it && +it.dataset.i !== sel){ sel = +it.dataset.i; list.querySelectorAll('.cmdkit').forEach(x => x.classList.toggle('on', +x.dataset.i === sel)); } });
  list.addEventListener('click', e => { const it = e.target.closest('.cmdkit'); if(it) go(+it.dataset.i); });
  ov.addEventListener('mousedown', e => { if(e.target === ov) close(); });
  cur = find(''); render(); inp.focus();
};
if(!window.__cmdkBound){
  window.__cmdkBound = true;
  document.addEventListener('keydown', e => { if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); if(window.__app && window.__app.openPalette) window.__app.openPalette(); } });
}
{ const gs = document.getElementById('gsearch');
  if(gs && !document.getElementById('cmdkbtn')){ gs.insertAdjacentHTML('afterend', `<button id="cmdkbtn" class="cmdkbtn" type="button" title="Palette de commandes">${/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'}</button>`);
    document.getElementById('cmdkbtn').addEventListener('click', () => window.__app.openPalette && window.__app.openPalette()); } }

