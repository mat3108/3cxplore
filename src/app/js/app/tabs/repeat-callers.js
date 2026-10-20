// ---------- Clients qui rappellent (15.17) : appels servis suivis d'un nouvel appel du même client peu après ----------
const REP_KEY = 'rappellent3cx';
// numéros d'exception (fournisseurs, partenaires, collègues d'un autre site…) : gardés dans ce navigateur (clé rappellentexc3cx:<système>), inclus dans la Sauvegarde des réglages
const REPX_KEY = 'rappellentexc3cx:' + (FULL.info.fqdn || '');
const repxLoad = () => { try{ const j = JSON.parse(localStorage.getItem(REPX_KEY) || '{}'); return Array.isArray(j.list) ? j.list : []; }catch(e){ return []; } };
const repxSave = list => { try{ localStorage.setItem(REPX_KEY, JSON.stringify({list})); }catch(e){} };
function repAnalysis(from, to, win){
  const all = FULL.calls, W = win * 3600e3;
  // numéros de l'entreprise exclus : SDA, cellulaires des employés, numéros présentés
  const own = new Set(repxLoad().map(x => x.num)); FULL.lines.forEach(l => l.dids.forEach(d => { const k = normNum(d); if(k) own.add(k); })); /* 18.2.34 : tous les SDA du système */ FULL.extensions.forEach(e => [e.mobile, e.callerId].forEach(x => { const k = normNum(x); if(k) own.add(k); }));
  const by = {}; // numéro -> appels entrants (ordre chronologique)
  for(let i = all.length - 1; i >= 0; i--){ const c = all[i]; if(c[1] !== 'in') continue; const k = normNum(c[2]); if(!k || own.has(k)) continue; (by[k] ||= []).push(c); }
  const served = [];
  Object.entries(by).forEach(([k, l]) => l.forEach((c, i) => { if(!ST_ANS.has(c[10])) return; const d = localParts(c[0])[0]; if(d < from || d > to) return;
    const t = Date.parse(c[0]); let j = i + 1; while(j < l.length && Date.parse(l[j][0]) <= t) j++; const nx = l[j], gap = nx ? Date.parse(nx[0]) - t : null;
    while(j < l.length && Date.parse(l[j][0]) - t <= 10 * 60e3) j++; const gap2 = l[j] ? Date.parse(l[j][0]) - t : null;
    const q = (c[9].find(p => p[1] === 'queue') || [])[0] || '', who = c[13] || c[6];
    served.push({c, k, seg: callSeg(c), q, who: who && who !== 'VM' && EXT_BY[who] ? who : '', rep: gap != null && gap <= W, slow: gap2 != null && gap2 <= W, quick: gap != null && gap <= 10 * 60e3, gap}); }));
  return {served, by};
}
V.rappellent = el => {
  const all = FULL.calls;
  if(!all.length){ el.innerHTML = '<h2>Clients qui rappellent</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const lastDay = localParts(all[0][0])[0], firstDay = callHist().first, P = statsPeriod();
  const range = () => P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDaysISO(lastDay, -(+P.mode) + 1), lastDay];
  let S = {win: 48, quick: false, freq: true}; try{ S = {...S, ...JSON.parse(localStorage.getItem(REP_KEY) || '{}')}; }catch(e){}
  const [from, to] = range(), A = repAnalysis(from, to, S.win), days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
  // appelants très fréquents (fournisseurs, partenaires, automates) : plus d'un appel servi tous les 2 jours en moyenne, et au moins 10
  const cntK = {}; A.served.forEach(x => cntK[x.k] = (cntK[x.k] || 0) + 1); const lim = Math.max(10, days / 2), freqK = new Set(Object.keys(cntK).filter(k => cntK[k] > lim));
  const rows = A.served.filter(x => (!SEG || x.seg === SEG) && (!S.freq || !freqK.has(x.k))), nFreq = [...freqK].filter(k => A.served.some(x => x.k === k && (!SEG || x.seg === SEG))).length;
  const isRep = x => S.quick ? x.rep : x.slow;
  const agg = key => { const m = {}; rows.forEach(x => { const k = key(x); if(!k) return; const g = m[k] ||= {k, n: 0, r: 0, q: 0}; g.n++; if(isRep(x)) g.r++; if(x.rep && x.quick) g.q++; }); return Object.values(m); };
  const nR = rows.filter(isRep).length, nQ = rows.filter(x => x.rep && x.quick).length, rate = rows.length ? nR / rows.length : 0;
  const segs = agg(x => x.seg).filter(g => g.n >= 20).sort((a, b) => b.r / b.n - a.r / a.n);
  const queues = agg(x => x.q).filter(g => g.n >= 20).sort((a, b) => b.r / b.n - a.r / a.n);
  const agents = agg(x => x.who).filter(g => g.n >= 30).sort((a, b) => b.r / b.n - a.r / a.n);
  // clients les plus récurrents : nombre de rappels après un appel servi
  const cli = {}; rows.filter(isRep).forEach(x => { const g = cli[x.k] ||= {k: x.k, rep: 0, served: 0, seg: x.seg, who: new Set(), last: ''}; g.rep++; if(x.who) g.who.add(x.who); });
  rows.forEach(x => { const g = cli[x.k]; if(g){ g.served++; if(x.c[0] > g.last) g.last = x.c[0]; } });
  const top = Object.values(cli).sort((a, b) => b.rep - a.rep || b.served - a.served);
  const rt = (r, n) => n ? `<span class="pill ${r / n >= Math.max(0.25, rate * 1.5) ? 'bad' : r / n >= rate * 1.15 ? 'warn' : 'ok'}">${pct(r, n)}</span>` : '–';
  const tbl = (title, list, lab, minTxt) => list.length ? `<h3>${title}</h3><div class="tw"><table><thead><tr><th>${lab}</th><th class="num">Appels servis</th><th class="num">Suivis d'un rappel</th><th class="num">Taux</th>${S.quick ? '<th class="num">dont moins de 10 min</th>' : ''}</tr></thead><tbody>
    ${list.slice(0, 25).map(g => `<tr><td>${lab === 'Magasin' ? esc(segName(g.k)) : dnLink(g.k)}</td><td class="num">${nf(g.n)}</td><td class="num">${nf(g.r)}</td><td class="num">${rt(g.r, g.n)}</td>${S.quick ? `<td class="num muted">${nf(g.q)}</td>` : ''}</tr>`).join('')}</tbody></table></div><p class="muted" style="font-size:12px">${minTxt}</p>` : '';
  el.innerHTML = `<div id="repwrap"><h2>Clients qui rappellent</h2>
    <p class="lead">Appels servis suivis d'un nouvel appel du même client dans les ${S.win} heures : souvent un problème qui n'a pas été réglé du premier coup (information manquante, mauvais service, promesse de rappel non tenue)${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('reppm', perOfStats(P), firstDay, lastDay)}
      <label class="count">Rappel dans les</label><select id="repwin">${[[24, '24 heures'], [48, '48 heures'], [168, '7 jours']].map(([v, l]) => `<option value="${v}"${S.win === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <label class="count"><input type="checkbox" id="repquick"${S.quick ? ' checked' : ''}> compter les rappels de moins de 10 min</label>
      <label class="count"><input type="checkbox" id="repfreq"${S.freq ? ' checked' : ''}> écarter les appelants très fréquents</label><span class="count">du ${esc(from)} au ${esc(to)}</span></div>
    <div class="grid kpis">${[['Appels servis', nf(rows.length), ''], ['Suivis d\'un rappel', nf(nR), ''], ['Taux de rappel', pct(nR, rows.length), rate >= 0.2 ? 'bad' : rate >= 0.12 ? 'warn' : 'ok'], [S.quick ? 'dont moins de 10 min (coupure ou transfert probable)' : 'Rappels de moins de 10 min écartés', nf(nQ), ''], ['Clients concernés', nf(top.length), ''], [S.freq ? 'Appelants très fréquents écartés' : 'Appelants très fréquents inclus', nf(nFreq), ''], ["Numéros d'exception", nf(repxLoad().length), '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    ${SEG ? '' : tbl('Par magasin', segs, 'Magasin', 'Magasins avec au moins 20 appels servis sur la période.')}
    ${tbl("Par file d'attente", queues, "File d'attente", 'Files avec au moins 20 appels servis ; la file est la première par laquelle l\'appel est passé.')}
    ${tbl('Par agent', agents, 'Agent', 'Agents avec au moins 30 appels servis ; l\'agent est la première personne qui a répondu au premier appel.')}
    <h3>Clients les plus récurrents</h3><div id="rept"></div>
    <details class="card" id="repxbox"${S.xopen ? ' open' : ''}><summary><b>Numéros d'exception</b> <span class="muted">(${repxLoad().length})</span></summary>
      <p class="muted" style="font-size:12.5px">Numéros à ne jamais compter comme clients qui rappellent : fournisseurs, partenaires, autres sites, services de livraison… Ils sont exclus de tous les calculs de cet onglet. Gardés dans ce navigateur et inclus dans la Sauvegarde des réglages.</p>
      <div class="ombar"><textarea id="repxnum" rows="2" placeholder="un ou plusieurs numéros (un par ligne ou séparés par des virgules)" style="flex:1;min-width:220px;font:inherit;font-size:12.5px"></textarea>
        <input id="repxlbl" placeholder="note (ex. fournisseur)" style="width:170px"> <button class="btn primary" id="repxadd">Ajouter</button></div><div id="repxmsg" class="muted" style="font-size:12.5px"></div>
      ${repxLoad().length ? `<div class="tw"><table><thead><tr><th>Numéro</th><th>Note</th><th>Ajouté le</th><th></th></tr></thead><tbody>${repxLoad().map(x => `<tr><td class="mono">${esc(phone(x.num) || x.num)}</td><td>${esc(x.label || '')}</td><td class="muted">${esc(x.at || '')}</td><td><button class="btn" data-rxdel="${esc(x.num)}">Retirer</button></td></tr>`).join('')}</tbody></table></div>
        <p><button class="btn" id="repxclr">Tout retirer</button></p>` : ''}
    </details>
    <p class="note">Un appel est « suivi d'un rappel » quand le même numéro rappelle l'entreprise (n'importe quel SDA) dans le délai choisi après avoir été servi. Les rappels de moins de 10 minutes sont souvent une coupure ou un transfert raté : ils sont écartés, sauf si vous cochez la case. Les appelants très fréquents (plus d'un appel servi tous les deux jours en moyenne sur la période, et au moins 10) sont en général des fournisseurs, partenaires ou automates : ils sont écartés, sauf si vous décochez la case. Les numéros de l'entreprise (SDA, cellulaires des employés, numéros présentés) et les numéros d'exception sont exclus. Un client peut aussi rappeler pour une autre raison : comparez les taux entre eux plutôt que de viser zéro.</p></div>`;
  table($('#rept'), {rows: top, pageSize: 25, sort: [2, -1], state: (window.__repT ||= {}),
    search: x => [x.k, phone(x.k), segShort(x.seg), ...[...x.who].map(w => w + ' ' + dnName(w))].join(' '),
    cols: [{h: 'Client', v: x => x.k, f: x => `<span class="mono">${esc(phone(x.k))}</span>${vipStar(x.k)}`}, {h: 'Magasin', v: x => segShort(x.seg)},
      {h: 'Rappels', num: 1, v: x => x.rep, f: x => nf(x.rep)}, {h: 'Appels servis', num: 1, v: x => x.served, f: x => nf(x.served)},
      {h: 'Servi par', v: x => x.who.size, f: x => [...x.who].slice(0, 3).map(w => dnLink(w)).join(', ') + (x.who.size > 3 ? ` <span class="muted">+${x.who.size - 3}</span>` : '')},
      {h: 'Dernier appel servi', v: x => x.last, f: x => esc(fmtD(x.last))},
      {h: '', v: () => 0, f: x => `<button class="btn" data-rxadd="${esc(x.k)}" title="Ne plus compter ce numéro">Exclure</button>`}],
    onRow: x => { location.hash = '#client/' + x.k; }});
  $('#rept .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="repexp" style="margin-left:auto">Exporter (CSV)</button>');
  const save = () => { try{ localStorage.setItem(REP_KEY, JSON.stringify(S)); }catch(e){} V.rappellent(el); };
  perWire('reppm', perOfStats(P), firstDay, lastDay, v => { perToStats(P, v); V.rappellent(el); });
  $('#repwin').addEventListener('change', e => { S.win = +e.target.value; save(); });
  $('#repquick').addEventListener('change', e => { S.quick = e.target.checked; save(); });
  $('#repfreq').addEventListener('change', e => { S.freq = e.target.checked; save(); });
  const xadd = (nums, label) => { const l = repxLoad(), have = new Set(l.map(x => x.num)), at = new Date().toLocaleDateString('fr-CA'); let n = 0, bad = 0;
    nums.forEach(v => { const k = normNum(v); if(!k){ if(v.trim()) bad++; return; } if(have.has(k)) return; have.add(k); l.push({num: k, label, at}); n++; }); repxSave(l); return [n, bad]; };
  $('#repxbox').addEventListener('toggle', e => { S.xopen = e.target.open; try{ localStorage.setItem(REP_KEY, JSON.stringify(S)); }catch(er){} });
  $('#repxadd').addEventListener('click', () => { const [n, bad] = xadd($('#repxnum').value.split(/[\n,;]+/), $('#repxlbl').value.trim());
    if(!n){ $('#repxmsg').textContent = bad ? 'Numéro non reconnu : saisissez au moins 10 chiffres.' : 'Aucun nouveau numéro.'; return; } S.xopen = true; save(); });
  $('#repxbox').addEventListener('click', e => { const d = e.target.closest('[data-rxdel]'); if(d){ repxSave(repxLoad().filter(x => x.num !== d.dataset.rxdel)); S.xopen = true; save(); }
    if(e.target.id === 'repxclr' && confirm('Retirer tous les numéros d\'exception ?')){ repxSave([]); save(); } });
  $('#rept').addEventListener('click', e => { const b = e.target.closest('[data-rxadd]'); if(!b) return; e.stopPropagation(); xadd([b.dataset.rxadd], 'exclu depuis la liste'); save(); });
  $('#repexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Client', 'Magasin', 'Rappels', 'Appels servis', 'Servi par', 'Dernier appel servi']].concat(top.map(x => [phone(x.k), segShort(x.seg), x.rep, x.served, [...x.who].map(w => `${w} ${dnName(w)}`).join(' | '), fmtD(x.last)]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'clients-qui-rappellent.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
