// ---------- Classement des magasins : achalandage, abandons, attente et couverture aux heures de pointe ----------
const RK_METRICS = [
  ['rate', 'Taux de réponse', '%', 1], ['qAb', 'Abandons en file', '%', -1], ['wait', 'Attente moy. en file (servis)', 's', -1],
  ['peakAb', 'Abandons aux heures de pointe', '%', -1], ['peakCover', 'Heures de pointe bien couvertes', '%', 1], ['perAgent', 'Appels servis par agent / jour', '', 0]];
function rankAnalysis(weeks){
  const endIso = FULL.calls.length ? FULL.calls[0][0] : new Date().toISOString(), last = localParts(endIso)[0];
  const oldest = FULL.calls.length ? localParts(FULL.calls[FULL.calls.length - 1][0])[0] : last;
  let first = weeks ? addDaysISO(last, -7 * weeks + 1) : oldest; if(first < oldest) first = oldest; // 18.1.8 : pas de jours sans données
  const days = Math.max(1, Math.round((Date.parse(last) - Date.parse(first)) / 864e5) + 1);
  const stores = SEG_LIST.filter(s => s[0] !== '@'), R = {};
  stores.forEach(s => R[s] = {s, inc: 0, base: 0, ans: 0, lost: 0, qn: 0, qs: 0, qab: 0, qov: 0, qw: 0, agents: new Set()});
  FULL.calls.forEach(c => { if(c[1] !== 'in') return; const d = localParts(c[0])[0]; if(d < first || d > last) return; const r = R[callSeg(c)]; if(!r) return;
    r.inc++; if(c[10] !== 'bridge'){ r.base++; if(ANS_ST.has(c[10])) r.ans++; else if(ST_LOST.has(c[10])) r.lost++; } });
  FULL.queueCalls.forEach(q => { const r = R[SEGOF[q[1]]]; if(!r) return; const d = localParts(q[0])[0]; if(d < first || d > last) return;
    r.qn++; if(q[6]){ r.qs++; r.qw += q[4]; if(q[7]) r.agents.add(q[7]); } else if(/MaxWait|NoAgents/i.test(q[8] || '')) r.qov++; else r.qab++; });
  const rows = stores.map(s => { const r = R[s], qset = new Set(FULL.queues.filter(q => SEGOF[q.number] === s).map(q => q.number));
    // heures de pointe : les 20 % de créneaux les plus chargés du magasin (au moins 1 appel par heure)
    const A = qset.size ? effAnalysis(qset, weeks, '80|' + (objFor(s, 'wait') || 30)) : null, slots = A ? // 18.2.6 : objectif du magasin
      A.G.flat().filter(c => c.cph >= 1).sort((a, b) => b.cph - a.cph) : [];
    const peak = slots.slice(0, Math.max(1, Math.ceil(slots.length * 0.2))).filter(Boolean), pn = peak.reduce((a, c) => a + c.n, 0), pab = peak.reduce((a, c) => a + c.ab, 0);
    const top = peak[0] ? A.G.flatMap((row, wd) => row.map((c, h) => ({c, wd, h}))).find(x => x.c === peak[0]) : null;
    return {s, inc: r.inc, rate: r.base ? 100 * r.ans / r.base : null, lostRate: r.base ? 100 * r.lost / r.base : null,
      qn: r.qn, qAb: r.qn ? 100 * r.qab / r.qn : null, qOv: r.qn ? 100 * r.qov / r.qn : null, wait: r.qs ? r.qw / r.qs : null,
      peakAb: pn ? 100 * pab / pn : null, peakCover: peak.length ? 100 * peak.filter(c => c.st === 'ok').length / peak.length : null, peakN: peak.length,
      top: top ? `${EFF_DAYS[top.wd]} ${top.h} h (${top.c.cph.toFixed(1).replace('.', ',')} appels/h)` : '', agents: r.agents.size,
      perAgent: r.agents.size ? r.qs / r.agents.size / days * 7 / 5 : null};
  }).filter(x => x.inc || x.qn);
  // trop peu d'appels (moins de 25 par semaine en moyenne) : affiché mais non classé
  const minInc = 25 * days / 7; rows.forEach(r => { r.small = r.inc < minInc; });
  // rang par indicateur, puis rang moyen (indicateurs de qualité seulement)
  RK_METRICS.forEach(([k, , , dir]) => { if(!dir) return; const v = rows.filter(r => !r.small && r[k] != null).sort((a, b) => dir * (b[k] - a[k])); v.forEach((r, i) => (r.rk ||= {})[k] = i + 1); });
  rows.forEach(r => { const rk = Object.values(r.rk || {}); r.score = r.small ? 999 + (1e6 - r.inc) / 1e6 : rk.length ? rk.reduce((a, b) => a + b, 0) / rk.length : 99; });
  rows.sort((a, b) => a.score - b.score);
  return {rows, first, last, days};
}
V.classement = el => {
  const S = window.__rk ||= {weeks: 8}, A = rankAnalysis(S.weeks), n = A.rows.filter(r => !r.small).length;
  if(!n){ el.innerHTML = '<h2>Classement des magasins</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const fx = (v, u) => v == null ? '–' : u === 's' ? dur(Math.round(v)) : u === '%' ? Math.round(v) + ' %' : v.toFixed(1).replace('.', ',');
  const cls = (r, k) => { const rk = r.rk && r.rk[k]; if(!rk || n < 4) return ''; return rk <= Math.ceil(n / 4) ? 'rkgood' : rk > n - Math.ceil(n / 4) ? 'rkbad' : ''; };
  const best = RK_METRICS.filter(m => m[3]).map(([k, l, u, dir]) => { const r = A.rows.filter(x => !x.small && x[k] != null).sort((a, b) => dir * (b[k] - a[k]))[0]; return r ? {k, l, u, r} : null; }).filter(Boolean);
  const mx = Math.max(...A.rows.map(r => r.rate || 0), 1);
  el.innerHTML = `<div id="rkwrap"><h2>Classement des magasins</h2>
    <p class="lead">Les magasins comparés sur la qualité de réponse et la tenue aux heures de pointe : taux de réponse, abandons et attente en file, abandons et couverture des agents pendant les créneaux les plus chargés (les 20 % de créneaux jour × heure avec le plus d'appels). Le classement est le rang moyen sur ces indicateurs. Du ${A.first} au ${A.last}.</p>
    <div class="bar"><label class="count">Période</label><select id="rkw">${[[4, '4 dernières semaines'], [8, '8 dernières semaines'], [13, '13 dernières semaines'], [0, 'Tout l\'historique']].map(([v, l]) => `<option value="${v}"${S.weeks === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="rkpod">${A.rows.filter(r => !r.small).slice(0, 3).map((r, i) => `<div class="card rkp"><div class="rkm">${['🥇', '🥈', '🥉'][i]}</div><div><b>${esc(segName(r.s))}</b><div class="muted" style="font-size:12.5px">Réponse ${fx(r.rate, '%')} · abandons en pointe ${fx(r.peakAb, '%')} · attente ${fx(r.wait, 's')}</div></div></div>`).join('')}</div>
    <h3>Classement</h3>
    <div class="tw"><table class="rkt"><thead><tr><th>#</th><th>Magasin</th><th class="num">Appels entrants</th>${RK_METRICS.map(m => `<th class="num">${esc(m[1])}</th>`).join('')}<th class="num">Agents actifs</th><th>Créneau le plus chargé</th></tr></thead><tbody>
      ${A.rows.map((r, i) => `<tr${r.small ? ' class="muted"' : ''}><td><b>${r.small ? '–' : i + 1}</b></td><td><a class="dlink" href="#" data-rk="${esc(r.s)}">${esc(segShort(r.s))}</a></td><td class="num">${nf(r.inc)}</td>
        ${RK_METRICS.map(([k, , u]) => `<td class="num ${cls(r, k)}">${fx(r[k], u)}</td>`).join('')}<td class="num">${nf(r.agents)}</td><td style="font-size:12.5px">${r.small ? '<span class="pill">trop peu d\'appels pour être classé</span> ' : ''}${esc(r.top)}</td></tr>`).join('')}</tbody></table></div>
    <div class="legend"><span><i style="background:var(--ok-soft)"></i>Meilleur quart</span><span><i style="background:var(--bad-soft)"></i>Moins bon quart</span></div>
    <h3>Taux de réponse</h3>
    <div class="card">${A.rows.slice().sort((a, b) => (b.rate || 0) - (a.rate || 0)).map(r => `<div class="rkbar"><span>${esc(segShort(r.s))}</span><div><i style="width:${100 * (r.rate || 0) / mx}%;background:${objOk(r.s, 'rate', r.rate) === false ? 'var(--bad)' : 'var(--ok)'}"></i></div><b>${fx(r.rate, '%')}</b></div>`).join('')}
      <p class="muted" style="font-size:12px;margin:6px 0 0">En rouge : sous l'objectif de taux de réponse du magasin (onglet Objectifs).</p></div>
    <h3>À qui s'inspirer</h3>
    <div class="grid two">${best.map(b => `<div class="card"><div class="bkt">${esc(b.l)}</div><b>${esc(segName(b.r.s))}</b> : ${fx(b.r[b.k], b.u)}
      <div class="muted" style="font-size:12.5px">${b.k === 'peakCover' || b.k === 'peakAb' ? 'Comparer ses horaires d\'agents aux heures de pointe (onglet Effectif).' : b.k === 'wait' || b.k === 'qAb' ? 'Comparer la configuration de ses files : sonnerie, stratégie, débordement (onglet Comparer les magasins).' : 'Comparer ses parcours d\'appel (menus, files, débordements).'}</div></div>`).join('')}</div>
    <p class="note">Appels entrants hors transferts vers un autre 3CX ; « Abandons en file » : le client raccroche en attente ; « Heures de pointe bien couvertes » : part des créneaux de pointe où les agents suffisent (onglet Effectif) ; « Appels servis par agent / jour » : appels de file servis par agent actif et par jour ouvrable (information, non classée). Les magasins avec moins de 25 appels entrants par semaine en moyenne sont affichés sans être classés.</p></div>`;
  const W = $('#rkwrap');
  W.addEventListener('change', e => { if(e.target.id === 'rkw'){ S.weeks = +e.target.value; V.classement(el); } });
  W.addEventListener('click', e => { const a = e.target.closest('[data-rk]'); if(!a) return; e.preventDefault(); window.__eff = {q: '*', weeks: S.weeks}; window.__app.setSeg(a.dataset.rk); location.hash = '#effectif'; });
};

