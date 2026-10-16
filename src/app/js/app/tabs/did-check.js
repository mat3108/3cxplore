// ---------- Contrôle de tous les SDA : simulation à des moments clés ----------
function ctlMoments(){
  const today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ}), addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const next = test => { for(let i = 1; i <= 14; i++){ const d = addD(today, i); if(test(d)) return d; } return today; };
  const wkday = next(d => simWd(d) < 5 && !simHol(d)), sat = next(d => simWd(d) === 5), sun = next(d => simWd(d) === 6);
  const y = +today.slice(0, 4), hol = [...qcHolidays(y), ...qcHolidays(y + 1)].find(h => h[1] > today);
  return [['open', 'Semaine 10 h', wkday, '10:00'], ['noon', 'Midi', wkday, '12:15'], ['eve', 'Soir 20 h 30', wkday, '20:30'], ['night', 'Nuit 2 h', wkday, '02:00'],
    ['sat', 'Samedi 11 h', sat, '11:00'], ['sun', 'Dimanche 11 h', sun, '11:00'], ...(hol ? [['hol', `${hol[0]} 10 h`, hol[1], '10:00']] : [])];
}
const CTL_SEV = r => r.end === 'lost' ? (r.ivrHang ? 'warn' : 'bad') : r.after === 'lost' ? 'warn' : r.end === 'wait' ? 'info' : r.holWarn ? 'warn' : 'ok';
function ctlRun(){
  const M = ctlMoments(), dids = allDIDs.filter(r => !SEG || DIDSEG[r.did] === SEG);
  const rows = dids.map(e => {
    const cells = M.map(([k, l, day, t]) => { const [h, m] = t.split(':').map(Number), R = simulate(e.did, day, h * 60 + m, {});
      // élément en cause : celui qui précède « Fin » (le menu qui raccroche, le département sans destination…)
      const cause = list => { const i = list.length - 1; return list[i] && list[i].kind === 'Fin' && list[i - 1] ? list[i - 1] : list[i] || {}; };
      const main = R.steps.filter(s => !s.soft), last = cause(main), lastSoft = cause(R.steps);
      const ivrHang = R.end === 'lost' && last.kind === 'Menu (IVR)' && /^Sans choix/.test(last.branch || '');
      const holWarn = R.steps.some(s => s.lines && s.lines.some(x => /jour férié non configuré/.test(x)));
      const c = {k, l, day, t, end: R.end, after: R.after || null, why: R.why, afterWhy: R.afterWhy || '', last, lastSoft, holWarn, ivrHang};
      c.sev = CTL_SEV(c); return c; });
    const worst = ['bad', 'warn', 'info', 'ok'].find(s => cells.some(c => c.sev === s));
    return {e, did: e.did, seg: DIDSEG[e.did] || SEG_COMMON, calls: lineCalls[e.did] || 0, cells, worst};
  });
  // causes : même dernier élément et même raison → un seul problème, avec les SDA et les moments touchés
  const causes = {};
  rows.forEach(r => r.cells.forEach(c => {
    const add = (key, sev, title, detail, item) => { const x = causes[key] ||= {key, sev, title, detail, dids: new Set(), moments: new Set(), items: new Set(), calls: 0}; if(!x.dids.has(r.did)) x.calls += r.calls; x.dids.add(r.did); x.moments.add(c.l); if(item) x.items.add(item); };
    const where = s => s.dn ? `${s.dn} ${dnName(s.dn)}` : s.title || '';
    if(c.ivrHang) add('I|' + where(c.last), 'warn', 'Raccroche si le client ne choisit rien dans le menu', where(c.last));
    else if(c.end === 'lost') add('L|' + where(c.last) + '|' + c.why, 'bad', `${c.why[0].toUpperCase() + c.why.slice(1)}`, where(c.last));
    else if(c.after === 'lost') add('A|' + where(c.lastSoft) + '|' + c.afterWhy, 'warn', `Si personne ne répond : ${c.afterWhy}`, where(c.lastSoft));
    if(c.holWarn && c.k === 'hol') add('H|' + c.day, 'warn', `${c.l.replace(/ 10 h$/, '')} non configuré : l'horaire normal s'appliquera`, 'Départements traversés par ces SDA');
    if(c.end === 'wait') add('W', 'info', 'Le menu répète son message tant que le client ne choisit pas', '', where(c.last));
  }));
  return {M, rows, causes: Object.values(causes).sort((a, b) => ({bad: 0, warn: 1, info: 2})[a.sev] - ({bad: 0, warn: 1, info: 2})[b.sev] || b.calls - a.calls)};
}
V.controle = el => {
  if(!allDIDs.length){ el.innerHTML = '<h2>Contrôle des SDA</h2><p class="muted">Aucun SDA dans ce backup.</p>'; return; }
  const t0 = performance.now(), C = ctlRun(), ms = Math.round(performance.now() - t0);
  const cnt = s => C.rows.filter(r => r.worst === s).length, col = {ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--muted)'};
  const SEVL = {bad: ['Appel perdu', 'bad'], warn: ['À vérifier', 'warn'], info: ['Information', ''], ok: ['OK', 'ok']};
  el.innerHTML = `<div id="ctlwrap"><h2>Contrôle des SDA</h2>
    <p class="lead">Chaque SDA${SEG ? ` du magasin <b>${esc(segName(SEG))}</b>` : ''} est simulé à ${C.M.length} moments clés, sans choix du client dans les menus : ${C.M.map(m => `${esc(m[1])} (${esc(m[2].slice(5))})`).join(', ')}. Les problèmes sont regroupés par cause. ${nf(C.rows.length * C.M.length)} simulations en ${ms} ms.</p>
    <div class="grid kpis">${[['SDA contrôlés', nf(C.rows.length), ''], ['Avec appel perdu', nf(cnt('bad')), cnt('bad') ? 'bad' : 'ok'], ['À vérifier', nf(cnt('warn')), cnt('warn') ? 'warn' : ''], ['Sans problème', nf(cnt('ok') + cnt('info')), 'ok']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <h3>Problèmes par cause (${C.causes.length})</h3>
    ${C.causes.length ? C.causes.map((x, i) => `<details class="card ccat"${i < 3 ? ' open' : ''}><summary><span class="pill ${SEVL[x.sev][1]}">${SEVL[x.sev][0]}</span> <b>${esc(x.title)}</b> <span class="muted">${esc(x.detail || (x.items.size ? `${x.items.size} menu${x.items.size > 1 ? 's' : ''}` : ''))}</span>
        <span class="muted" style="margin-left:auto;font-size:12.5px">${x.dids.size} SDA · ${nf(x.calls)} appels dans l'historique</span></summary>
      <div style="padding:0 12px 12px"><div class="muted" style="font-size:12.5px;margin-bottom:6px">Moments touchés : ${esc([...x.moments].join(', '))}${x.items.size ? ` · ${esc([...x.items].join(', '))}` : ''}</div>
        ${x.key[0] === 'I' ? '<div class="muted" style="font-size:12.5px;margin-bottom:6px">Souvent voulu pour un menu « fermé » : vérifier que le message invite le client à choisir (ex. messagerie) avant que le système raccroche.</div>' : ''}
        ${[...x.dids].sort((a, b) => (lineCalls[b] || 0) - (lineCalls[a] || 0)).slice(0, 40).map(d => `<a class="pill dlink" href="#" data-ctl="${esc(d)}|${esc(C.M.find(m => x.moments.has(m[1]))?.[0] || 'open')}">${esc(phone(d))} · ${esc(segShort(DIDSEG[d] || SEG_COMMON))}</a>`).join(' ')}${x.dids.size > 40 ? ` <span class="muted">+${x.dids.size - 40}</span>` : ''}</div></details>`).join('')
      : '<p><span class="pill ok">Aucun problème</span> Tous les SDA mènent à une personne, une messagerie ou un renvoi à chacun des moments contrôlés.</p>'}
    <h3>Tous les SDA</h3><div id="ctlt"></div>
    <div class="legend">${[['ok', 'Une personne, une messagerie ou un renvoi'], ['warn', 'À vérifier (raccroche sans choix dans un menu, perdu si personne ne répond, férié non configuré)'], ['bad', 'Appel perdu'], ['info', 'Le menu attend un choix']].map(([k, l]) => `<span><i style="background:${col[k]}"></i>${esc(l)}</span>`).join('')}</div>
    <p class="note">Cliquez une case pour ouvrir le simulateur à ce moment-là et voir le parcours complet. Le contrôle suit la configuration du backup ; il ne tient pas compte des agents en pause ou occupés.</p></div>`;
  table($('#ctlt'), {rows: C.rows, pageSize: 50, state: (window.__ctlTable ||= {}),
    search: r => [r.did, phone(r.did), segShort(r.seg), dnName(r.e.rule?.office?.dn) || ''].join(' '),
    filters: [{label: 'Tous les résultats', options: [['bad', 'Avec appel perdu'], ['warn', 'À vérifier'], ['pb', 'Avec un problème'], ['ok', 'Sans problème']], test: (r, v) => v === 'pb' ? r.worst === 'bad' || r.worst === 'warn' : v === 'ok' ? r.worst === 'ok' || r.worst === 'info' : r.worst === v},
              ...(SEG ? [] : [{label: 'Tous les magasins', options: [...new Set(C.rows.map(r => r.seg))].sort().map(s => [s, segShort(s)]), test: (r, v) => r.seg === v}])],
    cols: [{h: 'SDA', v: r => r.did, f: r => `<span class="mono">${esc(phone(r.did))}</span>`}, {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'},
      {h: 'Appels', num: 1, v: r => r.calls, f: r => nf(r.calls)},
      ...C.M.map((m, i) => ({h: m[1], v: r => ({bad: 0, warn: 1, info: 2, ok: 3})[r.cells[i].sev], f: r => { const c = r.cells[i];
        return `<a href="#" class="ctlc" data-ctl="${esc(r.did)}|${m[0]}" title="${esc(SIM_END[c.end][0] + ' — ' + c.why + (c.after ? ' ; si personne ne répond : ' + SIM_END[c.after][0] : '') + (c.holWarn ? ' ; férié non configuré' : ''))}" style="background:${col[c.sev]}"></a>`; }}))]});
  $('#ctlwrap').addEventListener('click', e => { const a = e.target.closest('[data-ctl]'); if(!a) return; e.preventDefault();
    const [did, k] = a.dataset.ctl.split('|'), m = C.M.find(x => x[0] === k) || C.M[0];
    window.__sim = {did, day: m[2], time: m[3], keys: {}}; location.hash = '#simulateur/' + did; });
  $('#ctlt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="ctlexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#ctlexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['SDA', 'Magasin', 'Appels', ...C.M.map(m => `${m[1]} (${m[2]})`)]].concat(C.rows.map(r => [phone(r.did), segShort(r.seg), r.calls, ...r.cells.map(c => SIM_END[c.end][0] + (c.after ? ' / sinon ' + SIM_END[c.after][0] : '') + (c.holWarn ? ' / férié non configuré' : '') + ' — ' + c.why)]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(x => x.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = `controle-sda${SEG ? '-' + segShort(SEG).replace(/[^\w-]+/g, '_') : ''}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};

