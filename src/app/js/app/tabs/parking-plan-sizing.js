// ---------- Plan des parkings : nombre de parkings nécessaires (16.4) ----------
// par magasin (poste qui parque), sur les 90 derniers jours : nombre maximal d'appels parqués en même temps, pic de chaque jour, heure de pointe
function pkNeed(){
  const P = (FULL.parkCalls || []).filter(r => r[3] !== 'direct' && r[4]), end = P.length ? P.reduce((a, r) => r[0] > a ? r[0] : a, '') : '', lim = end ? new Date(Date.parse(end) - 90 * 864e5).toISOString() : '';
  const by = {}; P.forEach(r => { if(r[0] < lim) return; const s = SEGOF[r[4]]; if(!s || s[0] === '@') return; const t = Date.parse(r[0]); (by[s] ||= []).push([t, 1], [t + Math.max(1, +r[2] || 0) * 1000, -1]); });
  const out = {};
  Object.entries(by).forEach(([s, ev]) => { ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0, max = 0, maxAt = 0; const day = {}, hour = Array(24).fill(0);
    ev.forEach(([t, d]) => { cur += d; if(d > 0){ const lp = localParts(new Date(t).toISOString()); if(cur > (day[lp[0]] || 0)) day[lp[0]] = cur; if(cur >= 2) hour[lp[1]]++; if(cur > max){ max = cur; maxAt = t; } } });
    const peaks = Object.values(day).sort((a, b) => a - b), p95 = peaks.length ? peaks[Math.min(peaks.length - 1, Math.floor(peaks.length * 0.95))] : 0;
    const hPeak = hour.some(Boolean) ? hour.indexOf(Math.max(...hour)) : null;
    out[s] = {max, maxAt, p95, days: peaks.length, day, hPeak, n: ev.length / 2, rec: Math.max(1, max + 1)}; });
  return out;
}
function pkNeedHTML(need, plan, stores, used){
  const rows = stores.map(s => { const x = need[s], planned = (plan[s] || []).length, have = planned || (used[s] || []).length;
    if(!x) return planned ? {s, planned, have, x: null, st: 'none'} : null;
    const full = Object.values(x.day).filter(v => v >= have).length;
    const st = !have ? 'noplan' : x.max > have ? 'manque' : x.max === have ? 'limite' : have > x.rec + 2 ? 'trop' : 'ok';
    return {s, planned, have, x, full, st}; }).filter(Boolean);
  if(!rows.length) return '<p class="muted">Aucun appel mis en parking dans les 90 derniers jours de l\'historique.</p>';
  const ST = {manque: ['Manque de parkings', 'bad'], limite: ['À la limite (aucune marge)', 'warn'], trop: ['Plus que nécessaire', ''], ok: ['Suffisant', 'ok'], noplan: ['Pas de plan', 'warn'], none: ['Aucun appel parqué', '']};
  return `<div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Parkings ${Object.keys(plan).length ? 'prévus' : 'utilisés'}</th><th class="num">Pic simultané</th><th>Le</th><th class="num">Pic habituel</th><th class="num">Jours saturés</th><th>Heure de pointe</th><th class="num">Recommandé</th><th>Constat</th></tr></thead><tbody>
    ${rows.sort((a, b) => ['manque', 'limite', 'noplan', 'trop', 'ok', 'none'].indexOf(a.st) - ['manque', 'limite', 'noplan', 'trop', 'ok', 'none'].indexOf(b.st) || (b.x ? b.x.max : 0) - (a.x ? a.x.max : 0)).map(r => `<tr><td>${esc(segName(r.s))}</td><td class="num">${nf(r.have)}</td>
      <td class="num">${r.x ? `<b>${nf(r.x.max)}</b>` : '–'}</td><td class="muted" style="font-size:12px">${r.x ? esc(fmtD(new Date(r.x.maxAt).toISOString())) : ''}</td><td class="num">${r.x ? nf(r.x.p95) : '–'}</td>
      <td class="num">${r.x && r.have ? (r.full ? `<span class="pill bad">${nf(r.full)}</span>` : '0') : '–'}</td><td>${r.x && r.x.hPeak != null ? `${r.x.hPeak} h` : '<span class="muted">—</span>'}</td>
      <td class="num">${r.x ? nf(r.x.rec) : '–'}</td><td><span class="pill ${ST[r.st][1]}">${esc(ST[r.st][0])}${r.st === 'manque' || r.st === 'limite' ? ` (+${nf(r.x.rec - r.have)})` : r.st === 'trop' ? ` (${nf(r.have - r.x.rec)} de trop)` : ''}</span></td></tr>`).join('')}</tbody></table></div>
    <p class="muted" style="font-size:12px">D'après les appels mis en parking par les employés de chaque magasin sur les 90 derniers jours. Pic simultané : le plus grand nombre d'appels en parking en même temps. Pic habituel : 95 % des jours restent sous cette valeur. Jours saturés : jours où tous les parkings ${Object.keys(plan).length ? 'prévus' : 'utilisés'} ont été occupés en même temps (un appel de plus n'aurait pas trouvé de place). « Manque » : plus d'appels ont été parqués en même temps qu'il n'y a de parkings ; « À la limite » : le pic atteint exactement ce nombre, sans marge. Recommandé : pic simultané + 1 parking de marge.</p>`;
}
V.pkplan = el => {
  let plan = pkpLoad(); const A = pkpAnalysis(plan), stores = A.stores.filter(s => !SEG || s === SEG), users = pkpUsers(A, plan).filter(u => !SEG || u.s === SEG);
  const rows = A.out.filter(x => !SEG || x.seg === SEG), sev = k => rows.filter(x => x.sev === k).length, planned = Object.values(plan).reduce((a, l) => a + l.length, 0);
  const phones = s => Object.keys(A.keys).filter(n => SEGOF[n] === s).length, inUse = s => Object.entries(A.use).filter(([, by]) => by[s]).map(([p]) => p);
  const free = pkSort([...A.exist].filter(p => !A.owner[p]));
  el.innerHTML = `<div id="pkpwrap"><h2>Plan des parkings</h2>
    <p class="lead">Attribuez à chaque magasin ses parkings partagés (SP0, SP1…). L'outil compare ce plan aux touches de parking des téléphones et aux appels réellement parqués, et liste ce qui pose problème${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="grid kpis">${[['Parkings dans 3CX', nf(A.exist.size), ''], ['Parkings prévus', nf(planned), ''], ['À corriger', nf(sev('bad')), sev('bad') ? 'bad' : 'ok'], ['À vérifier', nf(sev('warn')), sev('warn') ? 'warn' : ''], ['Usagers en problème', nf(users.length), users.length ? 'warn' : '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <h3>Plan par magasin</h3>
    <div class="bar"><button class="btn" id="pkppro">Proposer un plan d'après l'usage actuel</button>${planned ? '<button class="btn" id="pkpclr">Effacer le plan</button>' : ''}${planned && users.length ? `<button class="btn primary" id="pkpxl" style="margin-left:auto" title="Fichier Excel : une ligne par usager à corriger, avec les touches à retirer et à ajouter">Exporter pour corriger (${nf(users.length)} usager${users.length > 1 ? 's' : ''})</button>` : ''}<span class="count">Format : SP10-SP14, SP20 (ou 10-14, 20)</span></div>
    <div class="tw"><table><thead><tr><th>Magasin</th><th>Parkings prévus</th><th class="num">Nombre</th><th class="num">Téléphones avec touches</th><th>Utilisés (90 j)</th></tr></thead><tbody>
      ${stores.map(s => `<tr><td>${esc(segName(s))}</td><td><input class="pkpin" data-s="${esc(s)}" value="${esc(pkFmt(plan[s] || []))}" placeholder="ex. SP10-SP14" style="width:220px"></td>
        <td class="num">${nf((plan[s] || []).length)}</td><td class="num">${nf(phones(s))}</td><td style="font-size:12.5px">${esc(pkFmt(inUse(s))) || '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>
    ${SEG ? '' : `<p class="muted" style="font-size:12.5px">Parkings non attribués : ${free.length ? esc(pkFmt(free)) : 'aucun'}.</p>`}
    <h3>Nombre de parkings nécessaires</h3>${pkNeedHTML(A.need, plan, stores, Object.fromEntries(stores.map(s => [s, Object.entries(A.use).filter(([, by]) => by[s]).map(([p]) => p)])))}
    ${planned ? `<h3>Usagers en problème (${nf(users.length)})</h3>${pkUsersHTML(users, A)}${users.length ? '<p><button class="btn" id="pkuprint">Imprimer la liste des usagers</button></p>' : ''}` : ''}
    <h3>Problèmes selon le plan (${rows.length})</h3>
    ${planned ? '<div id="pkpt"></div>' : '<p class="muted">Saisissez le plan (ou cliquez « Proposer un plan d\'après l\'usage actuel ») pour voir ce qui pose problème.</p>'}
    ${A.sheet.length && planned ? `<h3>Touches à modifier par téléphone</h3><div class="tw" id="pkpsheet"><table><thead><tr><th>Poste</th><th>Magasin</th><th>Ajouter</th><th>Retirer</th></tr></thead><tbody>
      ${A.sheet.filter(x => !SEG || x.s === SEG).sort((a, b) => a.n.localeCompare(b.n, undefined, {numeric: true})).map(x => `<tr><td>${dnLink(x.n)}</td><td>${esc(segShort(x.s || SEG_COMMON))}</td><td>${x.addk.length ? `<span class="pill ok">${esc(pkFmt(x.addk))}</span>` : '<span class="muted">—</span>'}</td><td>${x.rem.length ? `<span class="pill bad">${esc(pkFmt(x.rem))}</span>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>
      <p><button class="btn" id="pkpprint">Imprimer la fiche des touches</button></p>` : ''}
    <p class="note">« Touche d'un parking d'un autre magasin » : le téléphone affiche un parking prévu pour un autre magasin — l'employé peut reprendre l'appel d'un client d'un autre magasin. « Touches manquantes » : le téléphone affiche déjà des parkings de son magasin, mais pas tous. « Appels parqués sur un parking d'un autre magasin » : d'après l'historique des 90 derniers jours. La proposition automatique attribue chaque parking au magasin qui l'utilise le plus (touches des téléphones et appels parqués), s'il y sert vraiment (sur au moins un quart des téléphones du magasin qui ont des touches de parking, ou 6 appels parqués sur 90 jours) ; vérifiez-la avant de l'appliquer dans 3CX. Le plan reste dans ce navigateur et fait partie de la Sauvegarde des réglages.</p></div>`;
  if(planned) table($('#pkpt'), {rows, pageSize: 50, sort: [0, 1], state: (window.__pkpT ||= {}),
    search: x => [PKP_K[x.k][0], x.detail, segShort(x.seg), ...x.items, ...x.items.map(n => dnName(n))].join(' '),
    filters: [{label: 'Tous les constats', options: Object.entries(PKP_K).map(([k, v]) => [k, v[0]]), test: (x, v) => x.k === v}, {label: 'Tous les magasins', options: [...new Set(rows.map(x => x.seg))].map(s => [s, segShort(s)]), test: (x, v) => x.seg === v}],
    cols: [{h: 'Constat', v: x => Object.keys(PKP_K).indexOf(x.k), f: x => `<span class="pill ${x.sev}">${esc(PKP_K[x.k][0])}</span>`}, {h: 'Magasin', v: x => segShort(x.seg)},
      {h: 'Poste', v: x => x.items.join(' '), f: x => x.items.map(n => dnLink(n)).join(', ') || '<span class="muted">—</span>'}, {h: 'Détail', v: x => x.detail}]});
  if(planned && $('#pkpt .bar')){ $('#pkpt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="pkpexp" style="margin-left:auto">Exporter (CSV)</button>');
    $('#pkpexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
      const out = [['Constat', 'Magasin', 'Poste', 'Détail']].concat(rows.map(x => [PKP_K[x.k][0], segShort(x.seg), x.items.map(n => `${n} ${dnName(n)}`).join(' | '), x.detail]));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'plan-des-parkings.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }); }
  el.querySelectorAll('.pkpin').forEach(i => i.addEventListener('change', () => { const l = pkParse(i.value); if(l.length) plan[i.dataset.s] = l; else delete plan[i.dataset.s]; pkpSave(plan); V.pkplan(el); }));
  $('#pkppro').addEventListener('click', () => { if(planned && !confirm('Remplacer le plan actuel par une proposition d\'après l\'usage actuel ?')) return; pkpSave(pkpPropose(A)); V.pkplan(el); });
  const clr = $('#pkpclr'); if(clr) clr.addEventListener('click', () => { if(confirm('Effacer tout le plan des parkings ?')){ pkpSave({}); V.pkplan(el); } });
  const xl = $('#pkpxl'); if(xl) xl.addEventListener('click', () => pkpExport(A, plan, users));
  if(planned) pkUsersTable(users, A);
  const up = $('#pkuprint'); if(up) up.addEventListener('click', () => printHTML(`<h2>Plan des parkings — usagers en problème${SEG ? ' — ' + esc(segName(SEG)) : ''}</h2>${$('.pkleg').outerHTML}<table><thead><tr><th>Usager</th><th>Magasin</th><th>Touches de parking</th><th>À faire</th></tr></thead><tbody>${users.map(u => `<tr><td><b>${esc((u.e.first + ' ' + u.e.last).trim())}</b> ${esc(u.n)}</td><td>${esc(segShort(u.s))}</td><td>${pkChips(u, A)}</td><td>${[u.rem.length ? 'retirer ' + u.rem.map(k => `touche ${k.no} (${k.v})`).join(', ') : '', u.addk.length ? 'ajouter ' + pkFmt(u.addk) : '', u.hors.length ? 'vérifier ' + pkFmt(u.hors.map(k => k.v)) : ''].filter(Boolean).join(' ; ')}</td></tr>`).join('')}</tbody></table>`));
  const pr = $('#pkpprint'); if(pr) pr.addEventListener('click', () => printHTML(`<h2>Plan des parkings — touches à modifier</h2>${$('#pkpsheet').outerHTML.replace('id="pkpsheet"', '')}`));
};
