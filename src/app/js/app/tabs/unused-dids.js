// ---------- SDA inutilisés (15.9) : numéros entrants payés mais (presque) jamais appelés ----------
const SDU_KEY = 'sdainutilises3cx';
const SDU_FLAG = {never: ['Jamais appelé', 'bad'], idle: ['Plus appelé depuis longtemps', 'warn'], rare: ['Très peu appelé', 'warn'], ok: ['Utilisé', 'ok']};
V.sdainut = el => {
  let S = {idle: 60, rare: 5, cost: ''}; try{ S = {...S, ...JSON.parse(localStorage.getItem(SDU_KEY) || '{}')}; }catch(e){}
  if(!allDIDs.length){ el.innerHTML = '<h2>SDA inutilisés</h2><p class="muted">Aucun SDA dans ce backup.</p>'; return; }
  const all = FULL.calls, histEnd = all.length ? all[0][0] : new Date().toISOString(), histStart = all.length ? all[all.length - 1][0] : histEnd;
  const days = Math.max(1, Math.round((Date.parse(histEnd) - Date.parse(histStart)) / 864e5) + 1), months = days / 30.4;
  const lim30 = new Date(Date.parse(histEnd) - 30 * 864e5).toISOString(), limIdle = new Date(Date.parse(histEnd) - S.idle * 864e5).toISOString();
  const st = {}; // SDA normalisé -> {n, n30, ok, last}
  for(const c of all){ if(c[1] !== 'in') continue; const k = normNum(c[5]); if(!k) continue; const x = st[k] ||= {n: 0, n30: 0, ok: 0, last: ''}; x.n++; if(c[0] >= lim30) x.n30++; if(ST_ANS.has(c[10])) x.ok++; if(c[0] > x.last) x.last = c[0]; }
  const dest = r => { const o = r.rule && r.rule.office; return o ? (o.dn ? `${o.dn} ${dnName(o.dn)}`.trim() : (TO_FR[o.to] || o.to || '')) : ''; };
  const rows = allDIDs.filter(r => !SEG || DIDSEG[r.did] === SEG).map(r => { const x = st[normNum(r.did)] || {n: 0, n30: 0, ok: 0, last: ''}, perM = x.n / months;
    const flag = !x.n ? 'never' : x.last < limIdle ? 'idle' : perM < S.rare ? 'rare' : 'ok';
    return {r, did: r.did, line: r.line, seg: DIDSEG[r.did] || SEG_COMMON, n: x.n, n30: x.n30, ok: x.ok, last: x.last, perM, flag, dest: dest(r), rule: ruleLabel(r)}; });
  const cnt = k => rows.filter(x => x.flag === k).length, waste = cnt('never') + cnt('idle') + cnt('rare'), cost = parseFloat(String(S.cost).replace(',', '.'));
  const lines = {}; rows.forEach(x => { const g = lines[x.line.number] ||= {l: x.line, n: 0, unused: 0}; g.n++; if(x.flag !== 'ok') g.unused++; });
  el.innerHTML = `<div id="sduwrap"><h2>SDA inutilisés</h2>
    <p class="lead">Numéros entrants (SDA) qui ne reçoivent jamais ou presque jamais d'appels : chacun est en général facturé chaque mois par l'opérateur. Historique analysé : du ${dayKey(histStart)} au ${dayKey(histEnd)} (${nf(days)} jours)${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Plus appelé depuis</label><select id="sduidle">${[30, 60, 90, 180].map(v => `<option value="${v}"${+S.idle === v ? ' selected' : ''}>${v} jours</option>`).join('')}</select>
      <label class="count">Très peu appelé</label><select id="sdurare">${[1, 5, 10].map(v => `<option value="${v}"${+S.rare === v ? ' selected' : ''}>moins de ${v} appel${v > 1 ? 's' : ''} par mois</option>`).join('')}</select>
      <label class="count">Coût d'un SDA</label><input id="sducost" type="text" inputmode="decimal" placeholder="ex. 1,50" value="${esc(S.cost)}" style="width:70px"> <span class="count">$ / mois</span></div>
    <div class="grid kpis">${[['SDA', nf(rows.length), ''], ['Jamais appelés', nf(cnt('never')), cnt('never') ? 'bad' : ''], [`Plus appelés depuis ${S.idle} jours`, nf(cnt('idle')), cnt('idle') ? 'warn' : ''], ['Très peu appelés', nf(cnt('rare')), ''], ['Économie possible', cost > 0 ? `${(waste * cost).toFixed(2).replace('.', ',')} $ / mois` : '—', cost > 0 && waste ? 'ok' : '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    ${cost > 0 ? '' : '<p class="muted" style="font-size:12.5px">Indiquez le coût mensuel d\'un SDA chez votre opérateur pour estimer l\'économie (mémorisé dans ce navigateur).</p>'}
    <h3>Par trunk</h3><div class="tw"><table><thead><tr><th>Trunk</th><th class="num">SDA</th><th class="num">Inutilisés ou peu utilisés</th></tr></thead><tbody>
      ${Object.values(lines).sort((a, b) => b.unused - a.unused).map(g => `<tr><td>${esc(g.l.gateway || g.l.number)}</td><td class="num">${nf(g.n)}</td><td class="num">${g.unused ? `<span class="pill warn">${nf(g.unused)}</span>` : '0'} <span class="muted">${pct(g.unused, g.n)}</span></td></tr>`).join('')}</tbody></table></div>
    <h3>SDA</h3><div id="sdut"></div>
    <p class="note">« Jamais appelé » : aucun appel entrant sur ce numéro dans tout l'historique du backup. Vérifiez avant de résilier : numéro publié dans une publicité saisonnière, ligne de secours, fax, numéro en cours de transfert chez un autre opérateur ou numéro gardé volontairement. Le coût réel dépend de votre contrat.</p></div>`;
  table($('#sdut'), {rows, pageSize: 50, sort: [6, 1], state: (window.__sduT ||= {}),
    search: x => [x.did, phone(x.did), x.line.gateway, segShort(x.seg), x.dest, x.rule, SDU_FLAG[x.flag][0]].join(' '),
    filters: [{label: 'Tous les constats', options: Object.entries(SDU_FLAG).map(([k, v]) => [k, v[0]]), test: (x, v) => x.flag === v}],
    cols: [{h: 'SDA', v: x => x.did, f: x => `<span class="mono">${esc(phone(x.did) || x.did)}</span>`}, {h: 'Trunk', v: x => x.line.gateway || x.line.number, cls: 'muted'}, {h: 'Magasin', v: x => segShort(x.seg)},
      {h: 'Mène à', v: x => x.dest, f: x => x.dest ? esc(x.dest) : `<span class="muted">${esc(x.rule)}</span>`}, {h: 'Appels', num: 1, v: x => x.n, f: x => nf(x.n)}, {h: 'Par mois', num: 1, v: x => x.perM, f: x => x.perM >= 10 ? nf(Math.round(x.perM)) : x.perM.toFixed(1).replace('.', ',')},
      {h: 'Dernier appel', v: x => x.last || '', f: x => x.last ? esc(fmtD(x.last)) : '<span class="pill bad">jamais</span>'}, {h: 'Constat', v: x => ['never', 'idle', 'rare', 'ok'].indexOf(x.flag), f: x => `<span class="pill ${SDU_FLAG[x.flag][1]}">${esc(SDU_FLAG[x.flag][0])}</span>`}],
    onRow: x => { location.hash = '#diagramme/' + encodeURIComponent(x.did); }});
  $('#sdut .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="sduexp" style="margin-left:auto">Exporter (CSV)</button>');
  const save = () => { try{ localStorage.setItem(SDU_KEY, JSON.stringify(S)); }catch(e){} V.sdainut(el); };
  $('#sduidle').addEventListener('change', e => { S.idle = +e.target.value; save(); });
  $('#sdurare').addEventListener('change', e => { S.rare = +e.target.value; save(); });
  $('#sducost').addEventListener('change', e => { S.cost = e.target.value.trim(); save(); });
  $('#sduexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['SDA', 'Trunk', 'Magasin', 'Mène à', 'Appels', 'Appels par mois', 'Appels (30 j)', 'Dernier appel', 'Constat']].concat(rows.map(x => [phone(x.did) || x.did, x.line.gateway || x.line.number, segShort(x.seg), x.dest || x.rule, x.n, x.perM.toFixed(1), x.n30, x.last ? fmtD(x.last) : 'jamais', SDU_FLAG[x.flag][0]]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'sda-inutilises.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};

// ---------- Ouverture d'un magasin (15.10) : liste de contrôle pour créer un magasin dans 3CX à partir d'un magasin modèle ;
// depuis 15.11.3 : « plan » du nouveau magasin, tiré du modèle et entièrement personnalisable ----------
