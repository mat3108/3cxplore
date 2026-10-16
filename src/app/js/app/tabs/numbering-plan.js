// ---------- Plan de numérotation (onglet) ----------
const NP_KIND = {'Poste': ['P', 'var(--accent)'], "File d'attente": ['F', 'var(--c-out)'], 'Menu (IVR)': ['M', 'var(--warn)'], 'Groupe de sonnerie': ['G', 'var(--k-rg)'], 'Parking': ['K', 'var(--muted)'], 'Trunk': ['T', 'var(--k-xt)']};
V.numerotation = el => {
  const P = numPlan(), S = window.__np ||= {open: ''};
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  const blocks = P.blocks.filter(x => !SEG || x.owner === SEG || x.items.some(u => SEGOF[u.n] === SEG));
  // postes hors de la plage de leur magasin
  const outRange = FULL.extensions.filter(e => { const s = SEGOF[e.number]; if(!s || s[0] === '@' || (SEG && s !== SEG)) return false;
    const b = P.blocks.find(x => x.len === e.number.length && x.b === Math.floor(+e.number / 100) * 100); return b && b.owner && b.owner !== s; });
  const sum = stores.filter(s => !SEG || s === SEG).map(s => { const bl = P.bySeg[s] || []; const posts = FULL.extensions.filter(e => SEGOF[e.number] === s).length;
    return {s, bl, posts, free: bl.reduce((a, x) => a + x.free.length, 0), next: (freeNumbers(s, 1)[0] || {}).n || '—'}; });
  const grid = x => { const cells = []; for(let i = 0; i < 100; i++){ const n = String(x.b + i).padStart(x.len, '0'); if(n.length !== x.len){ cells.push('<i class="npx"></i>'); continue; }
      const u = P.used[n]; if(!u){ cells.push(`<i class="npc free" title="${n} : libre"></i>`); continue; }
      const own = SEGOF[n] || SEG_COMMON, off = u.kind === 'Poste' && x.owner && own !== x.owner, k = NP_KIND[u.kind] || ['?', 'var(--muted)'];
      cells.push(`<a class="npc${off ? ' off' : ''}" href="#" data-dn="${esc(n)}" title="${esc(n + ' · ' + u.kind + ' · ' + dnName(n) + ' · ' + segShort(own) + (off ? ' (hors de la plage de son magasin)' : ''))}" style="background:${k[1]}">${k[0]}</a>`); }
    return `<div class="npgrid">${cells.join('')}</div>`; };
  el.innerHTML = `<div id="npwrap"><h2>Plan de numérotation</h2>
    <p class="lead">Les numéros internes par blocs de 100 : qui les utilise (poste, file, menu, groupe, parking, trunk), quel magasin possède chaque bloc (majorité de ses postes), les numéros libres et les postes rangés hors de la plage de leur magasin${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <h3>Par magasin</h3>
    <div class="tw"><table><thead><tr><th>Magasin</th><th>Plages</th><th class="num">Postes</th><th class="num">Numéros libres</th><th>Prochain numéro libre</th></tr></thead><tbody>
      ${sum.map(r => `<tr><td><b>${esc(segShort(r.s))}</b></td><td class="mono" style="font-size:12px">${esc(r.bl.slice().sort((x, y) => x.len - y.len || x.b - y.b).map(x => `${String(x.b).padStart(x.len, '0')}–${String(x.b + 99).padStart(x.len, '0')}`).join(', ') || '—')}</td><td class="num">${nf(r.posts)}</td><td class="num">${nf(r.free)}</td><td class="mono">${esc(r.next)}</td></tr>`).join('')}</tbody></table></div>
    ${outRange.length ? `<h3>Postes hors de la plage de leur magasin (${outRange.length})</h3><div class="card" style="font-size:13px">${outRange.map(e => { const b = P.blocks.find(x => x.b === Math.floor(+e.number / 100) * 100 && x.len === e.number.length);
      return `<div>${dnLink(e.number)} <span class="muted">— ${esc(segShort(SEGOF[e.number]))}, dans la plage de ${esc(segShort(b.owner))}</span></div>`; }).join('')}</div>` : ''}
    <h3>Blocs de numéros (${blocks.length})</h3>
    <div class="legend">${Object.entries(NP_KIND).map(([l, [c, col]]) => `<span><i style="background:${col}"></i>${c} ${esc(l)}</span>`).join('')}<span><i style="background:var(--panel2);border:1px dashed var(--line)"></i>Libre</span><span><i style="background:var(--accent);outline:2px solid var(--bad)"></i>Hors plage du magasin</span></div>
    ${blocks.map(x => { const p = x.items.filter(u => u.kind === 'Poste').length, key = x.len + ':' + x.b;
      return `<details class="card ccat npb"${S.open === key || blocks.length <= 6 ? ' open' : ''} data-k="${key}"><summary><b class="mono">${String(x.b).padStart(x.len, '0')}–${String(x.b + 99).padStart(x.len, '0')}</b> <span class="pill">${esc(x.owner ? segShort(x.owner) : 'partagé')}</span>
        <span class="muted" style="font-size:12.5px">${x.items.length} utilisé${x.items.length > 1 ? 's' : ''} (${p} poste${p > 1 ? 's' : ''}) · ${x.free.length} libre${x.free.length > 1 ? 's' : ''}</span>
        <span class="npbar"><i style="width:${x.items.length}%"></i></span></summary><div style="padding:0 12px 12px">${grid(x)}</div></details>`; }).join('')}
    <p class="note">Un bloc appartient au magasin qui y a la majorité des postes (sinon : partagé). Les numéros libres excluent tous les numéros déjà utilisés par un poste, une file, un menu, un groupe de sonnerie, un parking ou un trunk. Cliquez une case pour ouvrir l'élément.</p></div>`;
  $('#npwrap').addEventListener('click', e => { const a = e.target.closest('.npc[data-dn]'); if(a){ e.preventDefault(); showDN(a.dataset.dn); } });
  $('#npwrap').addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('.npb'); if(d && d.open) S.open = d.dataset.k; }, true);
};

