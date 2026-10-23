// ---------- Sans numéro de sortie (20.5.2) : postes sans numéro présenté (Outbound Caller ID), avec le numéro à mettre ----------
// liste commune à l'onglet, aux Priorités et aux Recommandations ; numéro suggéré = celui le plus présenté par les collègues du même magasin (un SDA de ce magasin d'abord)
function noCidRows(){
  const inSeg = n => !SEG || (SEGOF[n] || SEG_COMMON) === SEG, all = FULL.calls;
  const end = all.length ? all[0][0] : new Date().toISOString(), lim30 = new Date(Date.parse(end) - 30 * 864e5).toISOString();
  const didSeg = {}; FULL.lines.forEach(l => l.dids.forEach(d => { const k = normNum(d); if(k) didSeg[k] = DIDSEG[d] || SEG_COMMON; }));
  const bySeg = {}; FULL.extensions.forEach(e => { const k = normNum(e.callerId); if(!k) return; const s = SEGOF[e.number] || SEG_COMMON, m = bySeg[s] ||= {};
    const x = m[k] ||= {k, raw: e.callerId, n: 0, did: didSeg[k] === s}; x.n++; });
  const sugg = s => Object.values(bySeg[s] || {}).sort((a, b) => b.did - a.did || b.n - a.n)[0] || null;
  const out = {}; for(const c of all){ if(c[1] !== 'out') continue; const x = out[c[2]] ||= {n: 0, n30: 0, last: ''}; x.n++; if(c[0] >= lim30) x.n30++; if(c[0] > x.last) x.last = c[0]; }
  return FULL.extensions.filter(e => !normNum(e.callerId) && inSeg(e.number)).map(e => { const seg = SEGOF[e.number] || SEG_COMMON, o = out[e.number] || {n: 0, n30: 0, last: ''};
    return {e, seg, name: (e.first + ' ' + e.last).trim(), depts: (e.groups || []).map(g => g.g).filter(n => n && !/^__/.test(n)), out: o.n, out30: o.n30, last: o.last, sugg: sugg(seg)}; });
}
V.sanscid = el => {
  const rows = noCidRows(), calling = rows.filter(x => x.out30), withSugg = rows.filter(x => x.sugg);
  if(!rows.length){ el.innerHTML = `<h2>Sans numéro de sortie</h2><p class="lead">Tous les postes${SEG ? ` du magasin <b>${esc(segName(SEG))}</b>` : ''} ont un numéro présenté lors des appels sortants. Rien à corriger.</p>`; return; }
  el.innerHTML = `<h2>Sans numéro de sortie</h2>
    <p class="lead">Postes qui n'ont pas de numéro présenté (Outbound Caller ID). Quand ces employés appellent un client, c'est le numéro par défaut du trunk qui s'affiche : souvent le numéro principal d'un autre magasin, ou un numéro que le client ne reconnaît pas et ne rappellera pas${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="grid kpis">${[['Postes sans numéro de sortie', nf(rows.length), 'warn'], ['Ont appelé l\'extérieur (30 j)', nf(calling.length), calling.length ? 'bad' : ''],
      ['Appels sortants concernés (30 j)', nf(calling.reduce((a, x) => a + x.out30, 0)), ''], ['Numéro suggéré trouvé', `${nf(withSugg.length)} / ${nf(rows.length)}`, withSugg.length === rows.length ? 'ok' : '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div id="ncidt"></div>
    <p class="note">Pour corriger : dans la console 3CX, ouvrir l'utilisateur, onglet « Général », champ « Outbound Caller ID », et y mettre un SDA de son magasin. Le numéro suggéré est celui que présentent le plus souvent les collègues du même magasin (un SDA de ce magasin en priorité). Un poste qui n'appelle jamais l'extérieur (salle de réunion, fax, poste de test) peut rester sans numéro.</p>`;
  const sg = x => x.sugg ? `<span class="mono">${esc(phone(x.sugg.k) || x.sugg.raw)}</span> <span class="muted">(${nf(x.sugg.n)} collègue${x.sugg.n > 1 ? 's' : ''})</span>` : '<span class="muted">aucun collègue avec un numéro</span>';
  table($('#ncidt'), {rows, pageSize: 50, sort: [3, -1], state: (window.__ncidT ||= {}),
    search: x => [x.e.number, x.name, segShort(x.seg), x.depts.join(' '), x.sugg ? phone(x.sugg.k) : ''].join(' '),
    filters: [{label: 'Tous les postes', options: [['out', 'Ont appelé l\'extérieur (30 j)'], ['never', 'N\'appellent jamais l\'extérieur']], test: (x, v) => v === 'out' ? x.out30 > 0 : !x.out}],
    cols: [{h: 'Poste', v: x => x.e.number, f: x => dnLink(x.e.number)}, {h: 'Magasin', v: x => segShort(x.seg)}, {h: 'Département', v: x => x.depts.join(', '), cls: 'muted'},
      {h: 'Appels sortants (30 j)', num: 1, v: x => x.out30, f: x => x.out30 ? `<span class="pill warn">${nf(x.out30)}</span>` : '0'}, {h: 'Dernier appel sortant', v: x => x.last, f: x => x.last ? esc(fmtD(x.last)) : '<span class="muted">jamais</span>'},
      {h: 'Numéro à mettre', v: x => x.sugg ? x.sugg.k : '', f: sg}],
    onRow: x => { location.hash = '#employe/' + encodeURIComponent(x.e.number); }});
  $('#ncidt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="ncidexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#ncidexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Poste', 'Nom', 'Magasin', 'Département', 'Appels sortants (30 j)', 'Appels sortants (historique)', 'Dernier appel sortant', 'Numéro suggéré']]
      .concat(rows.map(x => [x.e.number, x.name, segShort(x.seg), x.depts.join(', '), x.out30, x.out, x.last ? fmtD(x.last) : 'jamais', x.sugg ? phone(x.sugg.k) || x.sugg.raw : '']));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'postes-sans-numero-de-sortie.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
