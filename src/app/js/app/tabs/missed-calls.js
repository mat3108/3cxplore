// ---------- Appels manqués non rappelés ----------
const normNum = s => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
const RAP_KEY = () => 'rappels3cx:' + (FULL.info.fqdn || '') + '|' + (FULL.info.date || '');
const LOST_WHERE = {q_ab: 'Abandon en file', ivr_ab: 'Raccroché au menu', miss: 'Non répondu', fwd_no: 'Renvoi externe sans réponse', park_ab: 'Raccroché en parking'};
const RAP_ST = {todo: {l: 'Non rappelé', c: 'bad'}, back: {l: 'Rappelé', c: 'ok'}, self: {l: 'A rappelé et a été servi', c: 'acc'}};
// analyse sur tout l'historique, période appliquée sur la date du dernier appel manqué
function missedAnalysis(from, to){
  const all = FULL.calls, n = all.length, meta = all.map(c => localParts(c[0])[0]);
  // index des événements par numéro client : rappels sortants et appels entrants servis
  const outBy = {}, servedBy = {};
  for(let i = 0; i < n; i++){ const c = all[i];
    if(c[1] === 'out' && c[10] === 'ans' && c[8] > 0){ const k = normNum(c[4]); if(k) (outBy[k] ||= []).push(i); } // 18.1.10 : rappel abouti seulement
    else if(c[1] === 'in' && (c[10] === 'ans' || c[10] === 'fwd_ok')){ const k = normNum(c[2]); if(k) (servedBy[k] ||= []).push(i); } } // 18.1.11 : un message laissé n'est pas un appel servi
  const segC = [], sg = i => segC[i] ??= callSeg(all[i]); // 18.1.9 : magasin de chaque appel (rappel compté seulement par le même magasin)
  const groups = {};
  for(let i = 0; i < n; i++){ const c = all[i];
    if(c[1] !== 'in' || !ST_LOST.has(c[10])) continue;
    const k = normNum(c[2]); if(!k) continue; // numéros masqués ou internes ignorés
    const s = callSeg(c), g = groups[s + '|' + k] ||= {num: k, raw: c[2], name: '', seg: s, lost: [], did: c[5]};
    g.lost.push(i); if(c[3] && normNum(c[3]) !== k) g.name = c[3]; }
  const rows = [];
  Object.values(groups).forEach(g => {
    const lastI = g.lost.reduce((a, b) => all[a][0] > all[b][0] ? a : b), last = all[lastI];
    if(meta[lastI] < from || meta[lastI] > to) return;
    const after = i => all[i][0] > last[0];
    const same = i => g.seg[0] === '@' || sg(i) === g.seg; // 18.2.8 : numéro commun ou autre site : n'importe quel magasin
    const back = (outBy[g.num] || []).filter(i => after(i) && same(i)).sort((a, b) => all[a][0] < all[b][0] ? -1 : 1)[0];
    const self = (servedBy[g.num] || []).filter(i => after(i) && same(i)).sort((a, b) => all[a][0] < all[b][0] ? -1 : 1)[0];
    let st = 'todo', when = null, by = '';
    if(back !== undefined && (self === undefined || all[back][0] <= all[self][0])){ st = 'back'; when = all[back][0]; by = all[back][2]; }
    else if(self !== undefined){ st = 'self'; when = all[self][0]; by = all[self][6]; }
    const p = last[9], lastEl = p.length ? p[p.length - 1] : null;
    // 18.1.12 : appels perdus depuis le dernier rappel ou appel servi du même magasin (avant le dernier appel perdu)
    const prev = (outBy[g.num] || []).concat(servedBy[g.num] || []).filter(i => same(i) && all[i][0] < last[0]).reduce((a, i) => all[i][0] > a ? all[i][0] : a, '');
    const cur = g.lost.filter(i => all[i][0] > prev);
    rows.push({...g, lost: cur, n: cur.length, first: all[cur.reduce((a, b) => all[a][0] < all[b][0] ? a : b)][0], last: last[0], where: LOST_WHERE[last[10]] || last[10],
      at: lastEl ? lastEl[0] : '', atName: lastEl ? dnName(lastEl[0]) : '', st, when, by, delay: when ? Math.round((Date.parse(when) - Date.parse(last[0])) / 60000) : null,
      attempts: cur.map(i => all[i][0]).sort()});
  });
  return rows;
}
const fmtDelay = m => m == null ? '–' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' j';

V.rappels = el => {
  const all = FULL.calls;
  if(!all.length){ el.innerHTML = '<h2>Appels manqués</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const lastDay = localParts(all[0][0])[0], firstDay = localParts(all[all.length - 1][0])[0];
  const P = statsPeriod();
  const range = () => P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDaysISO(lastDay, -(+P.mode) + 1), lastDay];
  let done = {}; try{ done = JSON.parse(localStorage.getItem(RAP_KEY()) || '{}'); }catch(e){}
  el.innerHTML = `<div id="rpwrap2"><div class="noprint"><h2>Appels manqués non rappelés</h2>
    <p class="lead">Clients qui ont appelé sans obtenir de réponse (abandon en file, raccroché au menu, non répondu, renvoi sans réponse, raccroché pendant qu'il était en parking) et qui n'ont pas été rappelés depuis. Un client est considéré « rappelé » si un appel sortant a été fait vers son numéro après son dernier appel manqué, ou s'il a rappelé lui-même et a été servi. Les numéros masqués sont ignorés. La période porte sur la date du dernier appel manqué ; le rappel est cherché jusqu'à la fin de l'historique du backup (${lastDay}).</p>
    <div class="bar"><label class="count">Période</label>
      <select id="rmpm">${[['7','7 derniers jours'],['30','30 derniers jours'],['90','90 derniers jours'],['all','Tout l\'historique'],['custom','Dates au choix']].map(([v,l]) => `<option value="${v}"${P.mode===v?' selected':''}>${l}</option>`).join('')}</select>
      ${SEG ? '' : `<label class="count">Magasin</label><select id="rmseg"><option value="">Tous les magasins</option>${SEG_LIST.map(s => `<option value="${esc(s)}"${window.__rapSeg === s ? ' selected' : ''}>${esc(segName(s))}</option>`).join('')}</select>`}
      <span class="count" id="rmrange"></span><span style="flex:1"></span><button class="btn" id="rmprint">Imprimer la liste</button></div></div>
    <div id="rmbody"></div></div>`;
  const save = () => { try{ localStorage.setItem(STATS_KEY, JSON.stringify(P)); }catch(e){} };
  let rows = [];
  function draw(){
    const [from, to] = range(); $('#rmrange').textContent = `du ${from} au ${to}`;
    const RS = SEG || window.__rapSeg || '';
    rows = missedAnalysis(from, to).filter(r => !RS || r.seg === RS);
    const n = s => rows.filter(r => r.st === s).length, delays = rows.filter(r => r.st === 'back').map(r => r.delay).sort((a, b) => a - b);
    const med = delays.length ? delays[Math.floor(delays.length / 2)] : null, in1h = delays.filter(d => d <= 60).length;
    const bySeg = {}; rows.forEach(r => { const b = bySeg[r.seg] ||= {seg: r.seg, total: 0, todo: 0, back: 0, self: 0, d: []}; b.total++; b[r.st]++; if(r.st === 'back') b.d.push(r.delay); });
    $('#rmbody').innerHTML = `
      <div class="grid kpis noprint">${[['Clients sans réponse', nf(rows.length), ''], ['Non rappelés', nf(n('todo')), 'bad'], ['Rappelés par le magasin', `${nf(n('back'))} (${pct(n('back'), rows.length)})`, 'ok'], ['Ont rappelé et été servis', nf(n('self')), ''], ['Délai médian de rappel', fmtDelay(med), ''], ['Rappelés en moins d\'1 h', pct(in1h, delays.length || 0), '']]
        .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      ${RS ? '' : `<h3 class="noprint">Par magasin</h3><div class="tw noprint"><table><thead><tr><th>Magasin</th><th class="num">Clients sans réponse</th><th class="num">Non rappelés</th><th class="num">Rappelés</th><th class="num">Ont rappelé eux-mêmes</th><th class="num">Délai médian</th></tr></thead><tbody>
        ${Object.values(bySeg).sort((a, b) => b.todo - a.todo).map(b => { const d = b.d.sort((x, y) => x - y); return `<tr><td><b>${esc(segShort(b.seg))}</b></td><td class="num">${nf(b.total)}</td><td class="num">${b.todo ? `<span class="pill bad">${nf(b.todo)}</span>` : 0}</td><td class="num">${nf(b.back)} (${pct(b.back, b.total)})</td><td class="num">${nf(b.self)}</td><td class="num">${fmtDelay(d.length ? d[Math.floor(d.length / 2)] : null)}</td></tr>`; }).join('')}</tbody></table></div>`}
      <h3>Liste de rappel${RS ? ' — ' + esc(segName(RS)) : ''}</h3><div id="rmt"></div>
      <p class="note noprint">Cochez « Traité » quand le client a été rappelé (mémorisé dans ce navigateur pour ce backup). Le backup suivant confirmera le rappel automatiquement.</p>`;
    table($('#rmt'), {
      rows, pageSize: 100, sort: [1, -1], state: (window.__rapTable ||= {}),
      search: r => [r.num, phone(r.num), r.name, segShort(r.seg), r.atName, r.where, phone(r.did)].join(' '),
      filters: [{label: 'Tous les statuts', options: [['todo', 'Non rappelés'], ['todo-open', 'Non rappelés et non traités'], ['back', 'Rappelés'], ['self', 'Ont rappelé et été servis']], test: (r, v) => v === 'todo-open' ? (r.st === 'todo' && !done[r.seg + '|' + r.num]) : r.st === v},
                {label: 'Toutes les causes', options: Object.entries(LOST_WHERE).map(([k, v]) => [v, v]), test: (r, v) => r.where === v}],
      cols: [
        {h: 'Client', v: r => r.num, f: r => `<span class="mono"><b>${esc(phone(r.num))}</b></span>${vipStar(r.num)}${r.name ? `<div class="muted" style="font-size:11.5px">${esc(r.name)}</div>` : ''}`},
        {h: 'Dernier appel manqué', v: r => r.last, f: r => fmtD(r.last)},
        {h: 'Tentatives', num: 1, v: r => r.n, f: r => r.n > 1 ? `<span class="pill warn">${r.n}</span>` : '1'},
        {h: 'Perdu à', v: r => r.where, f: r => `${esc(r.where)}${r.at ? `<div class="muted" style="font-size:11.5px">${esc(r.at + ' ' + r.atName)}</div>` : ''}`},
        {h: 'SDA appelé', v: r => r.did, f: r => `<span class="mono">${esc(phone(r.did))}</span>`},
        {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'},
        {h: 'Statut', v: r => ({todo: 0, self: 1, back: 2})[r.st], f: r => `<span class="pill ${RAP_ST[r.st].c}">${RAP_ST[r.st].l}</span>${r.st !== 'todo' ? `<div class="muted" style="font-size:11.5px">${fmtDelay(r.delay)} après${r.by ? ' · ' + esc(r.by + ' ' + dnName(r.by)) : ''}</div>` : ''}`},
        {h: 'Traité', v: r => done[r.seg + '|' + r.num] ? 1 : 0, f: r => r.st === 'todo' ? `<input type="checkbox" class="rmdone" data-k="${esc(r.seg + '|' + r.num)}"${done[r.seg + '|' + r.num] ? ' checked' : ''}>` : ''},
      ],
      onRow: r => openDrawer(`Client ${esc(phone(r.num))}`, kv([['Nom affiché', esc(r.name || '—')], ['Magasin', esc(segName(r.seg))], ['SDA appelé', esc(phone(r.did))], ['Appels manqués', String(r.n)],
        ['Dernier perdu à', esc(r.where + (r.at ? ' — ' + r.at + ' ' + r.atName : ''))], ['Statut', `<span class="pill ${RAP_ST[r.st].c}">${RAP_ST[r.st].l}</span>${r.when ? ' le ' + fmtD(r.when) + (r.by ? ' par ' + esc(r.by + ' ' + dnName(r.by)) : '') : ''}`]]) +
        `<p><a class="btn" href="#client/${r.num}">Voir l'historique complet du client</a></p><h3>Appels manqués</h3><ul>${r.attempts.map(a => `<li>${fmtD(a)}</li>`).join('')}</ul>`),
    });
    $('#rmt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="rmexp" style="margin-left:auto">Exporter (CSV)</button>');
    $('#rmexp').addEventListener('click', () => {
      const q = v => '"' + csvSafe(v) + '"';
      const out = [['Client', 'Nom affiché', 'Magasin', 'Dernier appel manqué', 'Tentatives', 'Perdu à', 'SDA appelé', 'Statut', 'Rappelé le', 'Par', 'Traité']]
        .concat(rows.map(r => [phone(r.num), r.name, segShort(r.seg), fmtD(r.last), r.n, r.where + (r.at ? ' ' + r.at + ' ' + r.atName : ''), phone(r.did), RAP_ST[r.st].l, r.when ? fmtD(r.when) : '', r.by ? r.by + ' ' + dnName(r.by) : '', done[r.seg + '|' + r.num] ? 'oui' : '']));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
      a.download = `rappels-${RS || 'tous'}-${from}_${to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    // affichage initial : non rappelés
    const fs = $('#rmt select[data-f="0"]'); if(fs && !window.__rapTable.fvals?.[0]){ fs.value = 'todo'; fs.dispatchEvent(new Event('change')); }
  }
  $('#rmpm').addEventListener('change', e => { P.mode = e.target.value; save(); draw(); });
  if($('#rmseg')) $('#rmseg').addEventListener('change', e => { window.__rapSeg = e.target.value; if(window.__rapTable) window.__rapTable.page = 0; draw(); });
  $('#rpwrap2').addEventListener('change', e => { const cb = e.target.closest('.rmdone'); if(!cb) return; if(cb.checked) done[cb.dataset.k] = new Date().toISOString(); else delete done[cb.dataset.k]; try{ localStorage.setItem(RAP_KEY(), JSON.stringify(done)); }catch(er){} });
  $('#rmprint').addEventListener('click', () => { document.body.classList.add('printing-report'); window.print(); setTimeout(() => document.body.classList.remove('printing-report'), 500); });
  draw();
};

