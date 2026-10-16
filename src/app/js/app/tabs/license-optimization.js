// ---------- Optimisation des licences et des postes ----------
const LIC_REASONS = {never: {l: 'Jamais utilisé', c: 'bad'}, idle: {l: 'Inactif depuis plus de 60 jours', c: 'warn'}, dupName: {l: 'Nom en double', c: 'warn'}, dupMail: {l: 'Courriel en double', c: 'warn'},
  vacant: {l: 'Nom « vacant », « test »…', c: 'acc'}, disabled: {l: 'Désactivé', c: ''}};
function licAnalysis(){
  const all = FULL.calls, last = {}, touch = (x, t) => { if(x && (!last[x] || t > last[x])) last[x] = t; };
  all.forEach(c => { touch(c[2], c[0]); if(c[1] === 'int') touch(c[4], c[0]); touch(c[6], c[0]); if(Array.isArray(c[11])) c[11].forEach(([x]) => touch(x, c[0])); c[9].forEach(p => { if(p[1] === 'extension') touch(p[0], c[0]); }); });
  const histEnd = all.length ? all[0][0] : new Date().toISOString(), histStart = all.length ? all[all.length - 1][0] : histEnd;
  const lim60 = new Date(Date.parse(histEnd) - 60 * 864e5).toISOString();
  const nm = e => gsNorm((e.first + ' ' + e.last).trim()), byName = {}, byMail = {};
  FULL.extensions.forEach(e => { const n = nm(e); if(n) (byName[n] ||= []).push(e.number); const m = (e.email || '').toLowerCase().trim(); if(m) (byMail[m] ||= []).push(e.number); });
  const rows = FULL.extensions.map(e => {
    const r = [];
    if(!last[e.number]) r.push('never'); else if(last[e.number] < lim60) r.push('idle');
    if((byName[nm(e)] || []).length > 1) r.push('dupName');
    const m = (e.email || '').toLowerCase().trim(); if(m && byMail[m].length > 1) r.push('dupMail');
    if(/vacant|libre|test|temp|demo|formation|modele|modèle/i.test(e.first + ' ' + e.last)) r.push('vacant');
    if(!e.enabled) r.push('disabled');
    return {e, ext: e.number, name: (e.first + ' ' + e.last).trim(), seg: SEGOF[e.number] || SEG_COMMON, last: last[e.number] || null, reasons: r,
      twins: [...new Set([...(byName[nm(e)] || []), ...(m ? byMail[m] : [])])].filter(x => x !== e.number)};
  });
  // appels simultanés (externes : entrants + sortants), balayage des débuts et fins d'appel
  const peak = (from) => { const ev = []; all.forEach(c => { if(c[1] === 'int' || c[0] < from) return; const s = Date.parse(c[0]); ev.push([s, 1], [s + Math.max(1, c[7]) * 1000, -1]); });
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]); let cur = 0, mx = 0, at = null; const daily = {};
    ev.forEach(([t, d]) => { cur += d; if(cur > mx){ mx = cur; at = t; } if(d > 0){ const k = localParts(new Date(t).toISOString())[0]; daily[k] = Math.max(daily[k] || 0, cur); } });
    const dv = Object.values(daily).sort((a, b) => a - b); return {max: mx, at: at ? new Date(at).toISOString() : null, p95: dv.length ? dv[Math.floor(0.95 * (dv.length - 1))] : 0, days: dv.length}; };
  return {rows, histStart, histEnd, sc: peak(histStart), sc30: peak(new Date(Date.parse(histEnd) - 30 * 864e5).toISOString())};
}
V.licences = el => {
  const L = licAnalysis(), rows = L.rows.filter(r => !SEG || r.seg === SEG), cand = rows.filter(r => r.reasons.length);
  const cnt = k => rows.filter(r => r.reasons.includes(k)).length;
  const bySeg = {}; rows.forEach(r => { const b = bySeg[r.seg] ||= {seg: r.seg, n: 0, act30: 0, never: 0, idle: 0, dup: 0, vacant: 0};
    b.n++; if(r.last && r.last >= new Date(Date.parse(L.histEnd) - 30 * 864e5).toISOString()) b.act30++; if(r.reasons.includes('never')) b.never++; if(r.reasons.includes('idle')) b.idle++;
    if(r.reasons.includes('dupName') || r.reasons.includes('dupMail')) b.dup++; if(r.reasons.includes('vacant')) b.vacant++; });
  el.innerHTML = `<div id="licwrap"><h2>Licences et postes</h2>
    <p class="lead">Postes qui pourraient être supprimés ou réattribués (jamais utilisés, inactifs, en double, « vacant » ou « test », désactivés), par magasin, et pic d'appels simultanés. 3CX V20 est licencié par nombre d'appels simultanés (et non par poste) : supprimer des postes inutiles simplifie la gestion et libère des comptes Microsoft 365 éventuels, mais c'est le pic d'appels simultanés qui détermine la taille de licence. Historique analysé : du ${dayKey(L.histStart)} au ${dayKey(L.histEnd)}.</p>
    <div class="grid kpis">${[['Postes', nf(rows.length), ''], ['Jamais utilisés', nf(cnt('never')), 'bad'], ['Inactifs > 60 jours', nf(cnt('idle')), 'warn'], ['En double (nom ou courriel)', nf(rows.filter(r => r.reasons.includes('dupName') || r.reasons.includes('dupMail')).length), 'warn'], ['« Vacant », « test »…', nf(cnt('vacant')), ''], ['Désactivés', nf(cnt('disabled')), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Appels simultanés (externes, tout le système)</h3>
      <div class="grid kpis">${[['Pic sur tout l\'historique', nf(L.sc.max)], ['Atteint le', L.sc.at ? fmtD(L.sc.at) : '–'], ['Pic des 30 derniers jours', nf(L.sc30.max)], ['Pic quotidien habituel (95 %)', nf(L.sc.p95)]]
        .map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:19px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      <p class="note">Calculé à partir de la durée de chaque appel externe (entrant ou sortant). À comparer au nombre d'appels simultanés de votre licence 3CX (la clé n'est pas lisible dans le backup) : une licence nettement au-dessus du pic habituel peut être réduite au renouvellement ; un pic proche de la limite expose à des appels refusés.</p></div>
    ${SEG ? '' : `<h3>Par magasin</h3><div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Postes</th><th class="num">Actifs (30 j)</th><th class="num">Jamais utilisés</th><th class="num">Inactifs > 60 j</th><th class="num">En double</th><th class="num">« Vacant »/« test »</th></tr></thead><tbody>
      ${Object.values(bySeg).sort((a, b) => (b.never + b.idle) - (a.never + a.idle)).map(b => `<tr><td><b>${esc(segShort(b.seg))}</b></td><td class="num">${nf(b.n)}</td><td class="num">${nf(b.act30)} <span class="muted">${pct(b.act30, b.n)}</span></td><td class="num">${b.never ? `<span class="pill bad">${b.never}</span>` : 0}</td><td class="num">${b.idle ? `<span class="pill warn">${b.idle}</span>` : 0}</td><td class="num">${b.dup}</td><td class="num">${b.vacant}</td></tr>`).join('')}</tbody></table></div>`}
    <h3>Postes à examiner (${nf(cand.length)})</h3><div id="lict"></div>
    <p class="note">« Jamais utilisé » : aucun appel passé, reçu ou répondu sur toute la période de l'historique. Vérifiez avant de supprimer : un poste peut servir rarement (remplaçant, salle de réunion, portier) ou avoir été créé récemment.</p></div>`;
  table($('#lict'), {rows: cand, pageSize: 100, sort: [4, 1], state: (window.__licTable ||= {}),
    search: r => [r.ext, r.name, r.e.email, segShort(r.seg), ...r.reasons.map(k => LIC_REASONS[k].l)].join(' '),
    filters: [{label: 'Tous les motifs', options: Object.entries(LIC_REASONS).map(([k, v]) => [k, v.l]), test: (r, v) => r.reasons.includes(v)},
              {label: 'Tous les magasins', options: [...new Set(cand.map(r => r.seg))].map(s => [s, segShort(s)]), test: (r, v) => r.seg === v}],
    cols: [{h: 'Poste', v: r => r.ext, f: r => dnLink(r.ext)}, {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'}, {h: 'Courriel', v: r => r.e.email, cls: 'muted'},
      {h: 'Téléphone', v: r => r.e.devices.length, f: r => r.e.devices.map(d => esc(d.model || d.template)).join(', ') || '<span class="muted">aucun</span>'},
      {h: 'Dernière activité', v: r => r.last || '', f: r => r.last ? fmtD(r.last) : '<span class="pill bad">jamais</span>'},
      {h: 'Motifs', v: r => r.reasons.length, f: r => r.reasons.map(k => `<span class="pill ${LIC_REASONS[k].c}">${LIC_REASONS[k].l}</span>`).join('') + (r.twins.length ? `<div class="muted" style="font-size:11.5px">avec ${r.twins.map(x => dnLink(x)).join(', ')}</div>` : '')}]});
  $('#lict .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="licexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#licexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Poste', 'Nom', 'Magasin', 'Courriel', 'Téléphones', 'Dernière activité', 'Motifs', 'Postes liés']].concat(cand.map(r => [r.ext, r.name, segShort(r.seg), r.e.email, r.e.devices.map(d => d.model).join(', '), r.last ? fmtD(r.last) : 'jamais', r.reasons.map(k => LIC_REASONS[k].l).join(' | '), r.twins.join(' ')]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'postes-a-examiner.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};

