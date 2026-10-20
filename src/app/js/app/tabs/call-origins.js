// ---------- Provenance des appels (15.2) : appels entrants par indicatif régional, par magasin ----------
// région d'après l'indicatif du numéro de l'appelant (plan de numérotation nord-américain) ; un cellulaire garde l'indicatif où il a été ouvert
const PRV_REG = [
  ['mtl', 'Montréal', ['514', '438', '263']],
  ['cour', 'Couronne de Montréal', ['450', '579', '354']],
  ['qc', 'Québec et Est du Québec', ['418', '581', '367']],
  ['ouest', 'Ouest, Centre et Nord du Québec', ['819', '873', '468']],
  ['ont', 'Ontario', ['613', '343', '753', '416', '647', '437', '905', '289', '365', '742', '705', '249', '683', '519', '226', '548', '382', '807']],
  ['can', 'Autres provinces et États-Unis', []],
  ['sansfrais', 'Numéros sans frais', ['800', '833', '844', '855', '866', '877', '888']],
  ['intl', 'International', []],
  ['masque', 'Masqués ou inconnus', []],
];
const PRV_COL = {mtl: '#2563eb', cour: '#0d9488', qc: '#7c3aed', ouest: '#c2410c', ont: '#ca8a04', can: '#64748b', sansfrais: '#94a3b8', intl: '#db2777', masque: '#9ca3af'};
const PRV_AC = {}; PRV_REG.forEach(([k, , acs]) => acs.forEach(a => PRV_AC[a] = k));
// [région, indicatif] d'un numéro appelant
function prvOf(raw){
  const s = String(raw || '').trim();
  if(!s || /anonym|unknown|restrict|private|masqu/i.test(s)) return ['masque', ''];
  let d = s.replace(/[^\d+]/g, '');
  if(/^(\+|011)/.test(d) && !/^(\+1|0111)/.test(d)) return ['intl', ''];
  d = d.replace(/\D/g, '');
  if(d.length === 11 && d[0] === '1') d = d.slice(1);
  if(d.length !== 10) return d.length > 11 ? ['intl', ''] : ['masque', ''];
  const ac = d.slice(0, 3); return [PRV_AC[ac] || 'can', ac];
}
const PRV_KEY = 'provenance3cx-periode';
V.provenance = el => {
  const all = FULL.calls; let P = '30'; try{ P = localStorage.getItem(PRV_KEY) || '30'; }catch(e){}
  if(!all.length){ el.innerHTML = '<h2>Provenance des appels</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const last = localParts(all[0][0])[0], first = callHist().first;
  const [from, to] = perRange(P, first, last);
  const rows = []; // [appel, magasin, région, indicatif]
  for(const c of all){ if(c[1] !== 'in') continue; const day = localParts(c[0])[0]; if(day < from) break; if(day > to) continue; const s = callSeg(c); if(SEG && s !== SEG) continue; if(s === SEG_BRIDGE) continue; const [r, ac] = prvOf(c[2]); rows.push([c, s, r, ac]); }
  const tot = rows.length, by = {}, bySeg = {}, byAc = {}, nums = new Set();
  rows.forEach(([c, s, r, ac]) => { const b = by[r] ||= {n: 0, lost: 0, nums: new Set()}; b.n++; if(ST_LOST.has(c[10])) b.lost++; const k = normNum(c[2]); if(k){ b.nums.add(k); nums.add(k); }
    const g = bySeg[s] ||= {s, n: 0, r: {}}; g.n++; g.r[r] = (g.r[r] || 0) + 1;
    if(ac){ const a = byAc[ac] ||= {ac, r, n: 0, lost: 0, nums: new Set()}; a.n++; if(ST_LOST.has(c[10])) a.lost++; if(k) a.nums.add(k); } });
  const regs = PRV_REG.filter(([k]) => by[k]), mx = Math.max(1, ...regs.map(([k]) => by[k].n));
  const quebec = ['mtl', 'cour', 'qc', 'ouest'].reduce((a, k) => a + (by[k] ? by[k].n : 0), 0);
  const top = regs.slice().sort((a, b) => by[b[0]].n - by[a[0]].n)[0];
  const segs = Object.values(bySeg).sort((a, b) => b.n - a.n);
  el.innerHTML = `<div id="prvwrap"><h2>Provenance des appels</h2>
    <p class="lead">D'où viennent les appels entrants : région de l'appelant d'après l'indicatif de son numéro, par magasin${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Un cellulaire garde l'indicatif de la région où il a été ouvert, même si la personne a déménagé : ce sont des tendances, pas une adresse.</p>
    <div class="bar"><label class="count">Période</label>${perUI('prvp', P, first, last)}<span class="count">du ${from} au ${to}</span><span style="flex:1"></span><button class="btn" id="prvexp">Exporter (CSV)</button></div>
    <div class="grid kpis">${[['Appels entrants', nf(tot), ''], ['Numéros différents', nf(nums.size), ''], ['Du Québec', pct(quebec, tot), ''], ['Région principale', top ? esc(top[1]) : '—', ''], ['International', nf(by.intl ? by.intl.n : 0), ''], ['Masqués ou inconnus', pct(by.masque ? by.masque.n : 0, tot), (by.masque && by.masque.n / tot > .15) ? 'warn' : '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:${String(v).length > 12 ? 15 : 21}px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Appels par région</h3>
        ${regs.map(([k, l]) => `<div class="stbar prvreg" data-r="${k}" style="cursor:pointer" title="Voir les numéros de cette région"><span class="nm">${esc(l)}</span><span class="t"><span style="width:${100 * by[k].n / mx}%;background:${PRV_COL[k]}"></span></span><span class="num">${nf(by[k].n)} <span class="muted">${pct(by[k].n, tot)}</span></span></div>`).join('') || '<p class="muted">Aucun appel entrant sur la période.</p>'}
        <p class="note">Cliquez sur une région pour voir ses numéros les plus fréquents.</p></div>
      <div class="card"><h3 style="margin-top:0">Appels perdus selon la provenance</h3>
        <div class="tw"><table><thead><tr><th>Région</th><th class="num">Appels</th><th class="num">Perdus</th><th class="num">% perdus</th><th class="num">Numéros</th></tr></thead><tbody>
        ${regs.map(([k, l]) => `<tr><td><span class="sw" style="background:${PRV_COL[k]}"></span>${esc(l)}</td><td class="num">${nf(by[k].n)}</td><td class="num">${nf(by[k].lost)}</td><td class="num">${by[k].n >= 20 && by[k].lost / by[k].n > .2 ? `<span class="pill bad">${pct(by[k].lost, by[k].n)}</span>` : pct(by[k].lost, by[k].n)}</td><td class="num">${nf(by[k].nums.size)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    ${SEG ? '' : `<h3>Par magasin</h3><div class="tw"><table class="prvseg"><thead><tr><th>Magasin</th><th class="num">Appels</th>${regs.map(([k, l]) => `<th class="num" title="${esc(l)}"><span class="sw" style="background:${PRV_COL[k]}"></span>${esc(l)}</th>`).join('')}</tr></thead><tbody>
      ${segs.map(g => `<tr><td><b>${esc(segShort(g.s))}</b></td><td class="num">${nf(g.n)}</td>${regs.map(([k]) => { const v = g.r[k] || 0, p = g.n ? v / g.n : 0; return `<td class="num" style="background:color-mix(in srgb,${PRV_COL[k]} ${Math.round(p * 55)}%,transparent)" title="${nf(v)} appel${v > 1 ? 's' : ''}">${v ? Math.round(p * 100) + ' %' : '<span class="muted">–</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">Part des appels entrants de chaque magasin venant de chaque région ; plus la case est colorée, plus la part est grande.</p>`}
    <h3>Indicatifs les plus fréquents</h3><div id="prvac"></div>
    <p class="note">Région déduite des trois premiers chiffres du numéro de l'appelant tel que l'opérateur l'a transmis. « International » : numéro hors Amérique du Nord. « Masqués ou inconnus » : numéro caché ou absent. Les appels transférés vers un autre 3CX (bridge) ne sont pas comptés.</p></div>`;
  const regName = k => (PRV_REG.find(x => x[0] === k) || [, k])[1];
  table($('#prvac'), {rows: Object.values(byAc), pageSize: 25, sort: [2, -1], state: (window.__prvT ||= {}),
    search: a => a.ac + ' ' + regName(a.r),
    cols: [{h: 'Indicatif', v: a => a.ac, cls: 'mono'}, {h: 'Région', v: a => regName(a.r), f: a => `<span class="sw" style="background:${PRV_COL[a.r]}"></span>${esc(regName(a.r))}`},
      {h: 'Appels', num: 1, v: a => a.n, f: a => nf(a.n)}, {h: 'Part', num: 1, v: a => a.n, f: a => pct(a.n, tot)}, {h: 'Numéros', num: 1, v: a => a.nums.size, f: a => nf(a.nums.size)},
      {h: '% perdus', num: 1, v: a => a.lost / a.n, f: a => pct(a.lost, a.n)}]});
  perWire('prvp', P, first, last, v => { try{ localStorage.setItem(PRV_KEY, v); }catch(er){} V.provenance(el); });
  el.querySelectorAll('.prvreg').forEach(b => b.addEventListener('click', () => { const k = b.dataset.r, cnt = {};
    rows.forEach(([c, , r]) => { if(r !== k) return; const n = normNum(c[2]) || String(c[2] || '').trim() || '—'; const x = cnt[n] ||= {n, raw: c[2], k: 0, lost: 0, last: ''}; x.k++; if(ST_LOST.has(c[10])) x.lost++; if(c[0] > x.last) x.last = c[0]; });
    const list = Object.values(cnt).sort((a, b) => b.k - a.k);
    openDrawer(`${esc(regName(k))} — ${nf(by[k].n)} appel${by[k].n > 1 ? 's' : ''}`, `<p class="muted" style="font-size:12.5px;margin-top:0">${nf(list.length)} numéro${list.length > 1 ? 's' : ''} différent${list.length > 1 ? 's' : ''} sur la période ; les 100 plus fréquents.</p>
      <div class="tw"><table><thead><tr><th>Numéro</th><th class="num">Appels</th><th class="num">Perdus</th><th>Dernier appel</th></tr></thead><tbody>${list.slice(0, 100).map(x => `<tr style="white-space:nowrap"><td class="mono">${esc(phone(x.raw) || x.raw || '—')}${vipStar(x.raw)}</td><td class="num">${nf(x.k)}</td><td class="num">${nf(x.lost)}</td><td>${esc(fmtD(x.last))}</td></tr>`).join('')}</tbody></table></div>`); }));
  $('#prvexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Magasin', 'Région', 'Indicatif', 'Appels', 'Perdus']]; const agg = {};
    rows.forEach(([c, s, r, ac]) => { const k = s + '|' + r + '|' + ac, x = agg[k] ||= [segShort(s), regName(r), ac, 0, 0]; x[3]++; if(ST_LOST.has(c[10])) x[4]++; });
    Object.values(agg).sort((a, b) => b[3] - a[3]).forEach(x => out.push(x));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'provenance-des-appels.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};

