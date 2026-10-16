// ---------- Taux d'occupation des agents (15.11) : part du temps connecté aux files passée en conversation ----------
// connexion : journal des connexions aux files (callcent_ag_queuestatus) ; un agent est connecté s'il l'est à au moins une file.
// conversation : tous ses appels répondus ou passés (files, appels directs, sortants, internes) qui commencent pendant qu'il est connecté.
const OCC_KEY = 'occupation3cx';
V.occupation = el => {
  let S = {p: '30', h: 'aff'}; try{ S = {...S, ...JSON.parse(localStorage.getItem(OCC_KEY) || '{}')}; }catch(e){}
  const ev = FULL.agentStatus || [], all = FULL.calls;
  if(!ev.length || !all.length){ el.innerHTML = `<h2>Taux d'occupation des agents</h2><p class="muted">${ev.length ? 'Aucun appel dans ce backup.' : "Ce backup ne contient pas le journal des connexions des agents aux files (ou il a été chargé avec une version trop ancienne : rouvrez le fichier .zip)."}</p>`; return; }
  const endIso = all[0][0] > ev[ev.length - 1][0] ? all[0][0] : ev[ev.length - 1][0], end = Date.parse(endIso);
  const evStart = Date.parse(ev[0][0]);
  const occFirst = localParts(new Date(evStart).toISOString())[0], occLast = localParts(endIso)[0], [occF, occT] = perRange(S.p, occFirst, occLast);
  const pStart = S.p === 'all' ? evStart : perIsC(S.p) ? Math.max(evStart, dayStartTs(occF)) : Math.max(evStart, end - (+S.p) * 864e5), pEnd = perIsC(S.p) ? Math.min(end, dayStartTs(addDaysISO(occT, 1))) : end;
  // heures comptées : heures d'affaires (7 h–20 h, lundi au samedi, heure de l'Est) ou toute la journée
  const biz = S.h === 'aff';
  const inBiz = t => { if(!biz) return true; const lp = localParts(new Date(t).toISOString()); return lp[2] < 6 && lp[1] >= 7 && lp[1] < 20; };
  // durée comptée d'un intervalle, découpée par heure (pour respecter les heures d'affaires et la répartition par heure)
  const hourly = Array.from({length: 24}, () => ({on: 0, talk: 0}));
  const countSpan = (a, b, perHour) => { let s = 0; for(let t = a; t < b;){ const nx = Math.min(b, (Math.floor(t / 3600000) + 1) * 3600000); if(inBiz(t)){ s += nx - t; if(perHour) hourly[localParts(new Date(t).toISOString())[1]].on += (nx - t) / 1000; } t = nx; } return s / 1000; };
  // intervalles de connexion par agent
  const st = {}; // agent -> {q: Set des files connectées, since, spans: [[a, b]]}
  const first = {}; ev.forEach(([t, q, a, on]) => { const k = a + '|' + q; if(!(k in first)) first[k] = on; });
  Object.entries(first).forEach(([k, on]) => { if(on === 0){ const [a, q] = k.split('|'); const x = st[a] ||= {q: new Set(), since: null, spans: []}; x.q.add(q); if(x.since == null) x.since = evStart; } });
  ev.forEach(([t, q, a, on]) => { const x = st[a] ||= {q: new Set(), since: null, spans: []}, ms = Date.parse(t), was = x.q.size > 0;
    if(on) x.q.add(q); else x.q.delete(q);
    if(!was && x.q.size) x.since = ms; else if(was && !x.q.size){ x.spans.push([x.since, ms]); x.since = null; } });
  Object.values(st).forEach(x => { if(x.q.size && x.since != null) x.spans.push([x.since, end]); });
  const queuesOf = {}; ev.forEach(([, q, a]) => (queuesOf[a] ||= new Set()).add(q));
  const rows = [];
  Object.entries(st).forEach(([a, x]) => { if(SEG && SEGOF[a] !== SEG) return;
    const spans = x.spans.map(([s, e]) => [Math.max(s, pStart), Math.min(e, pEnd)]).filter(([s, e]) => e > s);
    const onSec = spans.reduce((t, [s, e]) => t + countSpan(s, e, false), 0); if(onSec < 3600) return; spans.forEach(([s, e]) => countSpan(s, e, true)); // 18.1.37 : par heure, seulement les agents retenus
    rows.push({a, spans, on: onSec, talk: 0, calls: 0, seg: SEGOF[a] || SEG_COMMON, nq: (queuesOf[a] || new Set()).size}); });
  const byA = Object.fromEntries(rows.map(r => [r.a, r]));
  const inSpan = (r, t) => r.spans.some(([s, e]) => t >= s && t < e);
  for(const c of all){ const t = Date.parse(c[0]); if(t < pStart) break; if(t >= pEnd || !inBiz(t)) continue;
    const add = (a, secs) => { const r = byA[a]; if(!r || !secs || !inSpan(r, t)) return; r.talk += secs; r.calls++; hourly[localParts(c[0])[1]].talk += secs; };
    if(Array.isArray(c[11])) c[11].forEach(([a, secs]) => add(a, secs));
    if(c[1] === 'out' && ST_ANS.has(c[10])) add(c[2], c[8] || 0);
    else if(c[1] === 'int' && c[10] === 'ans' && !(c[11] || []).some(([a]) => a === c[2])) add(c[2], c[8] || 0); }
  const periodSec = countSpan(pStart, pEnd, false); // heures comptées de la période (pour la part du temps passée connecté)
  rows.forEach(r => { r.occ = r.on ? Math.min(1, r.talk / r.on) : 0; r.pres = periodSec ? Math.min(1, r.on / periodSec) : 0; });
  const always = rows.filter(r => r.pres >= .9).length;
  const totOn = rows.reduce((s, r) => s + r.on, 0), totTalk = rows.reduce((s, r) => s + r.talk, 0);
  const busy = rows.filter(r => r.occ >= .85 && r.on >= 5 * 3600).length, idle = rows.filter(r => r.occ < .15 && r.on >= 5 * 3600).length;
  const cls = v => v >= .85 ? 'bad' : v >= .6 ? 'warn' : v < .15 ? '' : 'ok';
  const hrs = (s, d = 0) => (s / 3600).toFixed(d).replace('.', ',') + ' h';
  const hours = [...Array(24).keys()].filter(h => hourly[h].on >= 3600), hmax = Math.max(.01, ...hours.map(h => hourly[h].talk / hourly[h].on));
  const bySeg = {}; rows.forEach(r => { const g = bySeg[r.seg] ||= {on: 0, talk: 0, n: 0}; g.on += r.on; g.talk += r.talk; g.n++; });
  const fromDay = localParts(new Date(pStart).toISOString())[0], toDay = localParts(new Date(pEnd - 1).toISOString())[0];
  el.innerHTML = `<div id="occwrap"><h2>Taux d'occupation des agents</h2>
    <p class="lead">Part du temps où un agent est connecté aux files qu'il passe réellement en conversation (appels de file, appels directs, sortants et internes). Au-dessus de 85 %, l'agent n'a presque plus de temps entre deux appels ; sous 15 %, il est connecté mais peu sollicité${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('occp', S.p, occFirst, occLast)}
      <label class="count">Heures comptées</label><select id="occh"><option value="aff"${biz ? ' selected' : ''}>heures d'affaires (7 h–20 h, lundi au samedi)</option><option value="all"${biz ? '' : ' selected'}>toute la journée</option></select><span class="count">du ${fromDay} au ${toDay}</span></div>
    ${S.p !== 'all' && !perIsC(S.p) && end - (+S.p) * 864e5 < evStart ? `<div class="card" style="border-left:3px solid var(--warn);margin-bottom:12px;font-size:13px">Le journal des connexions du backup commence le ${localParts(new Date(evStart).toISOString())[0]} : la période analysée commence à cette date.</div>` : ''}
    <div class="grid kpis">${[['Agents analysés', nf(rows.length), ''], ['Occupation moyenne', pct(totTalk, totOn), cls(totOn ? totTalk / totOn : 0)], ['Débordés (85 % et plus)', nf(busy), busy ? 'bad' : ''], ['Peu sollicités (moins de 15 %)', nf(idle), ''], ['Toujours connectés (90 % des heures ou plus)', nf(always), always / Math.max(1, rows.length) > .25 ? 'warn' : ''], ['Temps connecté', hrs(totOn), ''], ['Temps en conversation', hrs(totTalk), '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    ${rows.length && always / rows.length > .25 ? `<div class="card" style="border-left:3px solid var(--warn);margin-top:12px;font-size:13px">${pct(always, rows.length)} des agents restent connectés aux files pendant presque toutes les heures comptées : le taux mesure alors la part de la journée passée au téléphone, pas la charge pendant les moments où ils sont disponibles. Un taux bas est normal pour un employé qui sert aussi les clients sur place ; pour une mesure plus fine, les agents doivent se déconnecter des files quand ils ne sont pas disponibles.</div>` : ''}
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Occupation par heure</h3>
        ${hours.map(h => { const v = hourly[h].talk / hourly[h].on; return `<div class="stbar"><span class="nm">${h} h</span><span class="t"><span style="width:${100 * v / hmax}%;background:var(--${cls(v) || 'accent'})"></span></span><span class="num">${Math.round(v * 100)} % <span class="muted">${hrs(hourly[h].on)}</span></span></div>`; }).join('') || '<p class="muted">Pas assez de données.</p>'}
        <p class="note">Tous agents confondus : temps en conversation ÷ temps connecté, pour chaque heure (heure de l'Est).</p></div>
      ${SEG ? '' : `<div class="card"><h3 style="margin-top:0">Par magasin</h3><div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Agents</th><th class="num">Temps connecté</th><th class="num">Occupation</th></tr></thead><tbody>
        ${Object.entries(bySeg).sort((a, b) => b[1].on - a[1].on).map(([s, g]) => `<tr><td><b>${esc(segShort(s))}</b></td><td class="num">${nf(g.n)}</td><td class="num">${hrs(g.on)}</td><td class="num"><span class="pill ${cls(g.talk / g.on)}">${pct(g.talk, g.on)}</span></td></tr>`).join('')}</tbody></table></div></div>`}
    </div>
    <h3>Par agent</h3><div id="occt"></div>
    <p class="note">Temps connecté : périodes où l'agent est connecté à au moins une file, d'après le journal des connexions du backup, limitées aux heures comptées. Temps en conversation : durée de conversation de ses appels qui commencent pendant ces périodes. Un agent connecté en dehors de ses heures de travail (oubli de déconnexion) fait baisser son taux : comparez avec l'onglet Agents. Agents connectés moins d'une heure sur la période : non affichés.</p></div>`;
  table($('#occt'), {rows, pageSize: 25, sort: [6, -1], state: (window.__occT ||= {}),
    search: r => r.a + ' ' + dnName(r.a) + ' ' + segShort(r.seg),
    filters: [{label: 'Tous les niveaux', options: [['bad', '85 % et plus'], ['warn', '60 à 85 %'], ['ok', '15 à 60 %'], ['low', 'moins de 15 %']], test: (r, v) => v === 'low' ? r.occ < .15 : cls(r.occ) === v}],
    cols: [{h: 'Agent', v: r => r.a, f: r => dnLink(r.a)}, {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'}, {h: 'Files', num: 1, v: r => r.nq, f: r => nf(r.nq)},
      {h: 'Temps connecté', num: 1, v: r => r.on, f: r => hrs(r.on, 1)}, {h: 'Part des heures connectée', num: 1, v: r => r.pres, f: r => `${Math.round(r.pres * 100)} %`}, {h: 'En conversation', num: 1, v: r => r.talk, f: r => hrs(r.talk, 1)},
      {h: 'Occupation', num: 1, v: r => r.occ, f: r => `<span class="pill ${cls(r.occ)}">${Math.round(r.occ * 100)} %</span>`}, {h: 'Appels', num: 1, v: r => r.calls, f: r => nf(r.calls)}]});
  const save = () => { try{ localStorage.setItem(OCC_KEY, JSON.stringify(S)); }catch(e){} V.occupation(el); };
  perWire('occp', S.p, occFirst, occLast, v => { S.p = v; save(); });
  $('#occh').addEventListener('change', e => { S.h = e.target.value; save(); });
};

