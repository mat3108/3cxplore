// ---------- Assistant jours fériés ----------
const FER_KEY = 'feries3cx:' + (FULL.info.fqdn || '');
const FER_FIXED = new Set(['Jour de l\'An', 'Fête nationale', 'Fête du Canada', 'Noël', 'Lendemain de Noël']); // même date chaque année : à saisir en « récurrent »
function ferCfg(){ let c = {}; try{ c = JSON.parse(localStorage.getItem(FER_KEY) || '{}'); }catch(e){} c.skip ||= []; return c; }
V.feries = el => {
  const cfg = ferCfg(), today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ}), y0 = +today.slice(0, 4);
  const year = window.__ferYear || y0;
  const hols = qcHolidays(year), observed = hols.filter(h => !cfg.skip.includes(h[0]));
  const depts = FULL.groups.filter(g => !isSysGroup(g) && !/^___FAVORITES/.test(g.name) && g.routes && g.routes.office && g.routes.office.to && g.routes.office.to !== 'None' && g.hours?.type !== 'AllHours' && SEGOF[g.number] !== SEG_BRIDGE && (!SEG || SEGOF[g.number] === SEG))
    .sort((a, b) => segShort(SEGOF[a.number] || SEG_COMMON).localeCompare(segShort(SEGOF[b.number] || SEG_COMMON)) || a.name.localeCompare(b.name));
  // état de chaque département pour chaque jour férié
  const st = (g, h) => { const sch = deptSchedule(g), wd = simWd(h[1]);
    if(sch.isHol(h[1])) return 'ok';
    if(!sch.per(wd).length) return 'closed';
    return h[1] < today ? 'past' : 'missing'; };
  const rows = depts.map(g => ({g, seg: SEGOF[g.number] || SEG_COMMON, cells: hols.map(h => st(g, h)), dest: g.routes.holidays && g.routes.holidays.to && g.routes.holidays.to !== 'None' ? g.routes.holidays : null}));
  const obsIdx = hols.map((h, i) => cfg.skip.includes(h[0]) ? -1 : i).filter(i => i >= 0);
  const missing = rows.flatMap(r => obsIdx.filter(i => r.cells[i] === 'missing').map(i => ({r, h: hols[i]})));
  const nextH = observed.find(h => h[1] >= today);
  // jours fériés passés présents dans l'historique : appels reçus et répondus ce jour-là
  const past = [];
  if(FULL.calls.length){ const first = localParts(FULL.calls[FULL.calls.length - 1][0])[0], last = localParts(FULL.calls[0][0])[0];
    Array.from({length: +last.slice(0, 4) - +first.slice(0, 4) + 1}, (_, i) => qcHolidays(+first.slice(0, 4) + i)).flat().filter( // 18.1.39 : toutes les années de l'historique
      h => h[1] >= first && h[1] <= last).forEach(h => {
      const x = {h, n: 0, ans: 0, lost: 0, vm: 0, ref: 0, refAns: 0}, ref = addDaysISO(h[1], -7);
      FULL.calls.forEach(c => { if(c[1] !== 'in' || c[10] === 'bridge') return; if(SEG && callSeg(c) !== SEG) return; const d = localParts(c[0])[0];
        if(d === h[1]){ x.n++; if(ANS_ST.has(c[10])) x.ans++; else if(c[10] === 'vm') x.vm++; else if(ST_LOST.has(c[10])) x.lost++; }
        else if(d === ref){ x.ref++; if(ANS_ST.has(c[10])) x.refAns++; } });
      if(x.n || x.ref) past.push(x); }); }
  const CL = {ok: ['✓', 'ok', 'Configuré'], missing: ['✗', 'bad', 'Manquant'], past: ['–', '', 'Passé, non configuré'], closed: ['·', '', 'Département fermé ce jour-là de toute façon']};
  const destTxt = d => d ? (d.dn ? `${d.dn} ${dnName(d.dn)}` : TO_FR[d.to] || d.to) : '';
  el.innerHTML = `<div id="ferwrap"><h2>Jours fériés</h2>
    <p class="lead">Jours fériés du Québec et du Canada pour chaque département qui reçoit des appels${SEG ? ` du magasin <b>${esc(segName(SEG))}</b>` : ''} : configurés ou non, destination utilisée ces jours-là, et la liste à saisir dans la console 3CX. Un jour férié non configuré fait suivre l'horaire normal : la réception sonne alors que personne n'est là (ou l'inverse si le magasin est ouvert).</p>
    <div class="bar"><label class="count">Année</label><select id="feryr">${[y0 - 1, y0, y0 + 1].map(y => `<option value="${y}"${y === year ? ' selected' : ''}>${y}</option>`).join('')}</select>
      <span class="count">${nextH ? `Prochain : <b>${esc(nextH[0])}</b> le ${esc(nextH[1])}` : `Aucun férié à venir en ${year}`}</span>
      ${year === y0 && observed.filter(h => h[1] >= today).length <= 2 ? `<button class="btn" id="fernext">Préparer ${y0 + 1} ▸</button>` : ''}</div>
    <div class="grid kpis">${[['Départements', nf(rows.length), ''], ['Fériés observés', `${observed.length} / ${hols.length}`, ''], [`À saisir (à venir en ${year})`, nf(missing.length), missing.length ? 'bad' : 'ok'], ['Départements complets', nf(rows.filter(r => obsIdx.every(i => r.cells[i] !== 'missing')).length), 'ok'], ['Sans destination « Fériés »', nf(rows.filter(r => !r.dest).length), rows.some(r => !r.dest) ? 'warn' : '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <h3>Fériés de ${year}</h3>
    <p class="muted" style="margin-top:-4px">Décochez un jour où l'entreprise reste ouverte : il ne sera plus compté comme manquant (réglage conservé dans ce navigateur).</p>
    <div class="ferhol">${hols.map(h => { const n = rows.filter((r, i) => r.cells[hols.indexOf(h)] === 'missing').length;
      return `<label class="card ferh${cfg.skip.includes(h[0]) ? ' off' : ''}"><input type="checkbox" data-h="${esc(h[0])}"${cfg.skip.includes(h[0]) ? '' : ' checked'}><span><b>${esc(h[0])}</b><br><span class="muted">${esc(h[1])} · ${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][simWd(h[1])]}${FER_FIXED.has(h[0]) ? ' · date fixe' : ''}</span><br>${h[1] < today ? '<span class="pill">passé</span>' : n && !cfg.skip.includes(h[0]) ? `<span class="pill bad">${n} manquant${n > 1 ? 's' : ''}</span>` : '<span class="pill ok">complet</span>'}</span></label>`; }).join('')}</div>
    ${past.length ? `<h3>Ce qui s'est passé les jours fériés de l'historique</h3><div class="tw"><table><thead><tr><th>Jour férié</th><th>Date</th><th class="num">Appels reçus</th><th class="num">Répondus</th><th class="num">Messagerie</th><th class="num">Perdus</th><th class="num">Une semaine avant</th></tr></thead><tbody>
      ${past.map(x => `<tr><td><b>${esc(x.h[0])}</b></td><td>${esc(x.h[1])}</td><td class="num">${nf(x.n)}</td><td class="num">${nf(x.ans)} <span class="muted">${pct(x.ans, x.n)}</span></td><td class="num">${nf(x.vm)}</td><td class="num">${x.lost ? `<span class="pill bad">${nf(x.lost)}</span>` : 0}</td><td class="num muted">${nf(x.ref)} reçus, ${pct(x.refAns, x.ref)} répondus</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Appels entrants${SEG ? ' du magasin' : ''} (hors transferts vers un autre 3CX). Beaucoup d'appels « perdus » un jour férié indiquent que les appels sonnaient dans un magasin fermé.</p>` : ''}
    <h3>Par département</h3>
    <div class="tw"><table class="fert"><thead><tr><th>Département</th><th>Magasin</th>${hols.map(h => `<th class="${cfg.skip.includes(h[0]) ? 'off' : ''}" title="${esc(h[0])} — ${esc(h[1])}">${esc(h[0].replace(/^(Journée nationale des patriotes)$/, 'Patriotes').replace(/^Lendemain de Noël$/, 'Lend. Noël'))}<br><span class="muted">${esc(h[1].slice(5))}</span></th>`).join('')}<th>Destination les jours fériés</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${dnLink(r.g.number)}</td><td class="muted">${esc(segShort(r.seg))}</td>${r.cells.map((c, i) => `<td class="ferc ${CL[c][1]}${cfg.skip.includes(hols[i][0]) ? ' off' : ''}" title="${esc(CL[c][2])}">${CL[c][0]}</td>`).join('')}
        <td style="font-size:12.5px">${r.dest ? esc(destTxt(r.dest)) + (JSON.stringify(r.dest) === JSON.stringify(r.g.routes.office) ? ' <span class="pill warn">même que « Ouvert »</span>' : '') : '<span class="pill warn">aucune (destination « Fermé » supposée)</span>'}</td></tr>`).join('')}</tbody></table></div>
    <div class="legend">${Object.values(CL).map(([s, c, l]) => `<span><b class="${c}" style="display:inline-block;width:16px;text-align:center">${s}</b> ${esc(l)}</span>`).join('')}</div>
    <h3>À saisir dans la console 3CX (${nf(missing.length)})</h3>
    ${missing.length ? `<p class="muted" style="margin-top:-4px">Dans la console, ouvrir chaque département, section des heures d'ouverture, puis ajouter les jours fériés ci-dessous. Les jours à date fixe peuvent être saisis une fois en « récurrent » ; les autres changent de date chaque année.</p>
      <div class="bar"><button class="btn primary" id="fercopy">Copier la liste</button><button class="btn" id="ferexp">Exporter (CSV)</button><span class="count" id="fermsg"></span></div>
      <pre class="ferlist" id="ferlist">${esc(ferText(missing))}</pre>` : '<p><span class="pill ok">Rien à saisir</span> Tous les jours fériés observés à venir sont configurés.</p>'}
    <p class="note">Fériés calculés automatiquement (Pâques, Patriotes, Travail et Action de grâce changent chaque année). « Fermé ce jour-là » : le département n'a aucune heure d'ouverture ce jour de la semaine, le férié n'a donc pas d'effet. Le Lendemain de Noël n'est pas férié pour tous : décochez-le si les magasins sont ouverts.</p></div>`;
  function ferText(list){ const by = {}; list.forEach(({r, h}) => (by[r.g.number] ||= {r, h: []}).h.push(h));
    return Object.values(by).map(({r, h}) => `${segShort(r.seg)} — ${r.g.name} (${r.g.number})\n` + h.map(x => `   • ${x[0]} : ${x[1]}${FER_FIXED.has(x[0]) ? ' (récurrent)' : ''}`).join('\n')).join('\n\n'); }
  const W = $('#ferwrap');
  W.addEventListener('change', e => {
    if(e.target.id === 'feryr'){ window.__ferYear = +e.target.value; V.feries(el); return; }
    const h = e.target.dataset.h; if(h == null) return;
    cfg.skip = e.target.checked ? cfg.skip.filter(x => x !== h) : [...new Set([...cfg.skip, h])];
    try{ localStorage.setItem(FER_KEY, JSON.stringify(cfg)); }catch(er){}
    V.feries(el);
  });
  const nx = $('#fernext'); if(nx) nx.addEventListener('click', () => { window.__ferYear = y0 + 1; V.feries(el); });
  const cp = $('#fercopy'); if(cp) cp.addEventListener('click', async () => { try{ await navigator.clipboard.writeText($('#ferlist').textContent); $('#fermsg').textContent = 'Liste copiée.'; }catch(er){ const rg = document.createRange(); rg.selectNodeContents($('#ferlist')); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); $('#fermsg').textContent = 'Liste sélectionnée : faites Cmd+C.'; } });
  const ex = $('#ferexp'); if(ex) ex.addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Magasin', 'Département', 'Numéro', 'Jour férié', 'Date', 'Récurrent']].concat(missing.map(({r, h}) => [segShort(r.seg), r.g.name, r.g.number, h[0], h[1], FER_FIXED.has(h[0]) ? 'oui' : 'non']));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(x => x.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = `feries-a-saisir-${year}${SEG ? '-' + segShort(SEG).replace(/[^\w-]+/g, '_') : ''}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};

