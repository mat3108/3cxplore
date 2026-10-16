// ---------- Destinations des appels sortants (15.4) : où appellent les postes, qui appelle le plus à l'extérieur ----------
// même découpage par indicatif que Provenance des appels ; en plus : services spéciaux (911, 411…) et numéros incomplets
const DST_SPECIAL = new Set(['211', '311', '411', '511', '611', '711', '811', '911']);
function dstOf(raw){
  const s = String(raw || '').trim(), d = s.replace(/\D/g, '');
  if(DST_SPECIAL.has(d)) return ['special', d];
  if(/^(\+|011)/.test(s.replace(/\s/g, '')) && !/^\+1/.test(s.replace(/\s/g, ''))) return ['intl', ''];
  if(d.length >= 12 && d.startsWith('011')) return ['intl', ''];
  if(d.length < 10) return ['incomplet', ''];
  const t = d.slice(-11); return prvOf(d.length === 10 ? d : t[0] === '1' ? t : d.slice(-10)); // 18.1.14 : préfixe de sortie (9, 0…) devant les 10 chiffres
}
const DST_REG = PRV_REG.filter(([k]) => k !== 'masque').concat([['special', 'Services spéciaux (911, 411…)', []], ['incomplet', 'Numéros incomplets', []]]);
const DST_COL = {...PRV_COL, special: '#dc2626', incomplet: '#a8a29e'};
const DST_KEY = 'destinations3cx-periode';
V.destinations = el => {
  const all = FULL.calls; let P = '30'; try{ P = localStorage.getItem(DST_KEY) || '30'; }catch(e){}
  if(!all.length){ el.innerHTML = '<h2>Destinations des appels sortants</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const last = localParts(all[0][0])[0], first = localParts(all[all.length - 1][0])[0];
  const [from, to] = perRange(P, first, last);
  // soirs, nuits et fins de semaine : avant 8 h, à partir de 20 h, samedi et dimanche (heure de l'Est)
  const offHours = lp => lp[1] < 8 || lp[1] >= 20 || lp[2] >= 5;
  const rows = []; // {c, s, r, ac, ext, off}
  for(const c of all){ if(c[1] !== 'out') continue; const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue; const s = callSeg(c); if(SEG && s !== SEG) continue;
    const [r, ac] = dstOf(c[4]); rows.push({c, s, r, ac, ext: c[2], off: offHours(lp)}); }
  const tot = rows.length, ok = rows.filter(x => x.c[10] === 'ans').length, by = {}, bySeg = {}, byExt = {}, byNum = {};
  rows.forEach(x => { const b = by[x.r] ||= {n: 0, ok: 0, talk: 0}; b.n++; if(x.c[10] === 'ans'){ b.ok++; b.talk += x.c[8] || 0; }
    const g = bySeg[x.s] ||= {s: x.s, n: 0, r: {}}; g.n++; g.r[x.r] = (g.r[x.r] || 0) + 1;
    const e = byExt[x.ext] ||= {e: x.ext, n: 0, ok: 0, talk: 0, intl: 0, lng: 0, off: 0, nums: new Set()}; e.n++; if(x.c[10] === 'ans'){ e.ok++; e.talk += x.c[8] || 0; } if(x.r === 'intl') e.intl++; if(['ont', 'can', 'intl'].includes(x.r)) e.lng++; if(x.off) e.off++;
    const k = x.r === 'incomplet' ? '' : normNum(x.c[4]) || String(x.c[4] || ''); if(k){ e.nums.add(k); const u = byNum[k] ||= {k, raw: x.c[4], r: x.r, n: 0, exts: new Set(), last: ''}; u.n++; u.exts.add(x.ext); if(x.c[0] > u.last) u.last = x.c[0]; } });
  const regs = DST_REG.filter(([k]) => by[k]), mx = Math.max(1, ...regs.map(([k]) => by[k].n)), off = rows.filter(x => x.off).length;
  const quebec = ['mtl', 'cour', 'qc', 'ouest'].reduce((a, k) => a + (by[k] ? by[k].n : 0), 0);
  const regName = k => (DST_REG.find(x => x[0] === k) || [, k])[1];
  const segs = Object.values(bySeg).sort((a, b) => b.n - a.n);
  el.innerHTML = `<div id="dstwrap"><h2>Destinations des appels sortants</h2>
    <p class="lead">Où appellent les postes : région du numéro composé d'après son indicatif, services spéciaux et international, qui appelle le plus à l'extérieur et les appels passés le soir, la nuit ou la fin de semaine${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('dstp', P, first, last)}<span class="count">du ${from} au ${to}</span><span style="flex:1"></span><button class="btn" id="dstexp">Exporter (CSV)</button></div>
    <div class="grid kpis">${[['Appels sortants', nf(tot), ''], ['Aboutis (répondus)', pct(ok, tot), ''], ['Numéros différents', nf(Object.keys(byNum).length), ''], ['Vers le Québec', pct(quebec, tot), ''], ['Hors Québec et international', nf(['ont', 'can', 'intl'].reduce((a, k) => a + (by[k] ? by[k].n : 0), 0)), ''], ['Soirs, nuits et fins de semaine', nf(off), ''], ['Services spéciaux (911, 411…)', nf(by.special ? by.special.n : 0), by.special && by.special.n ? 'warn' : '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Appels sortants par destination</h3>
        ${regs.map(([k, l]) => `<div class="stbar dstreg" data-r="${k}" style="cursor:pointer" title="Voir les numéros de cette destination"><span class="nm">${esc(l)}</span><span class="t"><span style="width:${100 * by[k].n / mx}%;background:${DST_COL[k]}"></span></span><span class="num">${nf(by[k].n)} <span class="muted">${pct(by[k].n, tot)}</span></span></div>`).join('') || '<p class="muted">Aucun appel sortant sur la période.</p>'}
        <p class="note">Cliquez sur une destination pour voir les numéros composés et les postes qui les ont appelés.</p></div>
      <div class="card"><h3 style="margin-top:0">Numéros les plus appelés</h3>
        <div class="tw"><table><thead><tr><th>Numéro</th><th>Destination</th><th class="num">Appels</th><th class="num">Postes</th></tr></thead><tbody>
        ${Object.values(byNum).sort((a, b) => b.n - a.n).slice(0, 12).map(u => `<tr style="white-space:nowrap"><td class="mono">${esc(phone(u.raw) || u.raw)}</td><td><span class="sw" style="background:${DST_COL[u.r]}"></span>${esc(regName(u.r))}</td><td class="num">${nf(u.n)}</td><td class="num">${nf(u.exts.size)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    ${SEG ? '' : `<h3>Par magasin</h3><div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Appels</th>${regs.map(([k, l]) => `<th class="num" title="${esc(l)}"><span class="sw" style="background:${DST_COL[k]}"></span>${esc(l)}</th>`).join('')}</tr></thead><tbody>
      ${segs.map(g => `<tr><td><b>${esc(segShort(g.s))}</b></td><td class="num">${nf(g.n)}</td>${regs.map(([k]) => { const v = g.r[k] || 0, p = g.n ? v / g.n : 0; return `<td class="num" style="background:color-mix(in srgb,${DST_COL[k]} ${Math.round(p * 55)}%,transparent)" title="${nf(v)} appel${v > 1 ? 's' : ''}">${v ? Math.round(p * 100) + ' %' : '<span class="muted">–</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`}
    <h3>Par poste</h3><div id="dstx"></div>
    <p class="note">Destination déduite des chiffres composés (après les règles sortantes). « Numéros incomplets » : moins de 10 chiffres, souvent un appel abandonné pendant la composition. « Hors Québec » : Ontario, autres provinces et États-Unis. Soirs, nuits et fins de semaine : avant 8 h, à partir de 20 h, samedi et dimanche (heure de l'Est). Durée : temps de conversation des appels aboutis.</p></div>`;
  table($('#dstx'), {rows: Object.values(byExt), pageSize: 25, sort: [2, -1], state: (window.__dstT ||= {}),
    search: e => e.e + ' ' + dnName(e.e) + ' ' + segShort(SEGOF[e.e] || SEG_COMMON),
    cols: [{h: 'Poste', v: e => e.e, f: e => dnLink(e.e)}, {h: 'Magasin', v: e => segShort(SEGOF[e.e] || SEG_COMMON), cls: 'muted'},
      {h: 'Appels sortants', num: 1, v: e => e.n, f: e => nf(e.n)}, {h: 'Aboutis', num: 1, v: e => e.ok / e.n, f: e => pct(e.ok, e.n)}, {h: 'Durée totale', num: 1, v: e => e.talk, f: e => dur(e.talk)},
      {h: 'Numéros', num: 1, v: e => e.nums.size, f: e => nf(e.nums.size)}, {h: 'Hors Québec', num: 1, v: e => e.lng, f: e => e.lng ? nf(e.lng) : '<span class="muted">0</span>'},
      {h: 'Soirs, nuits, fins de semaine', num: 1, v: e => e.off, f: e => e.off ? `<span class="pill${e.off / e.n > .3 ? ' warn' : ''}">${nf(e.off)}</span>` : '<span class="muted">0</span>'}]});
  perWire('dstp', P, first, last, v => { try{ localStorage.setItem(DST_KEY, v); }catch(er){} V.destinations(el); });
  el.querySelectorAll('.dstreg').forEach(b => b.addEventListener('click', () => { const k = b.dataset.r, list = Object.values(byNum).filter(u => u.r === k).sort((a, b) => b.n - a.n), inc = rows.filter(x => x.r === k && x.r === 'incomplet');
    openDrawer(`${esc(regName(k))} — ${nf(by[k].n)} appel${by[k].n > 1 ? 's' : ''}`, k === 'incomplet' ? `<p class="muted" style="font-size:12.5px;margin-top:0">Appels dont le numéro composé a moins de 10 chiffres, par poste.</p><div class="tw"><table><thead><tr><th>Poste</th><th class="num">Appels</th></tr></thead><tbody>${Object.entries(inc.reduce((a, x) => (a[x.ext] = (a[x.ext] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).map(([e, v]) => `<tr><td>${dnLink(e)}</td><td class="num">${nf(v)}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="muted" style="font-size:12.5px;margin-top:0">${nf(list.length)} numéro${list.length > 1 ? 's' : ''} différent${list.length > 1 ? 's' : ''} sur la période ; les 100 plus appelés.</p>
      <div class="tw"><table><thead><tr><th>Numéro</th><th class="num">Appels</th><th>Postes</th><th>Dernier appel</th></tr></thead><tbody>${list.slice(0, 100).map(u => `<tr><td class="mono" style="white-space:nowrap">${esc(phone(u.raw) || u.raw)}</td><td class="num">${nf(u.n)}</td><td>${[...u.exts].slice(0, 6).map(x => dnLink(x)).join(', ')}${u.exts.size > 6 ? ' …' : ''}</td><td style="white-space:nowrap">${esc(fmtD(u.last))}</td></tr>`).join('')}</tbody></table></div>`); }));
  $('#dstexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Poste', 'Nom', 'Magasin', 'Destination', 'Indicatif', 'Appels', 'Aboutis', 'Durée (s)']]; const agg = {};
    rows.forEach(x => { const k = x.ext + '|' + x.r + '|' + x.ac, a = agg[k] ||= [x.ext, dnName(x.ext), segShort(SEGOF[x.ext] || SEG_COMMON), regName(x.r), x.ac, 0, 0, 0]; a[5]++; if(x.c[10] === 'ans'){ a[6]++; a[7] += x.c[8] || 0; } });
    Object.values(agg).sort((a, b) => b[5] - a[5]).forEach(x => out.push(x));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'destinations-appels-sortants.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};

