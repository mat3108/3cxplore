// ---------- Performance des agents ----------
const HAS_POLLS = FULL.agentPolls && typeof FULL.agentPolls === 'object';
const HAS_ANSLIST = FULL.calls.some(c => Array.isArray(c[11]));
V.agents = el => {
  const all = FULL.calls;
  if(!all.length){ el.innerHTML = '<h2>Performance des agents</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const meta = all.map(c => localParts(c[0])), qmeta = FULL.queueCalls.map(r => localParts(r[0]));
  const lastDay = meta[0][0], firstDay = meta[meta.length - 1][0];
  const P = statsPeriod();
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const range = () => P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDays(lastDay, -(+P.mode) + 1), lastDay];
  const agents = new Set(D.extensions.map(e => e.number)); // respecte le filtre magasin du bandeau
  el.innerHTML = `<div id="awrap"><h2>Performance des agents</h2>
  <p class="lead">Activité de chaque poste sur la période : appels entrants répondus, durée de conversation, appels sortants et, pour les files d'attente, taux de réponse (sonneries répondues ÷ sonneries répondues + expirées) et délai moyen de décroché. Les sonneries annulées parce qu'un collègue a répondu, ou parce que l'appelant a raccroché, ne pénalisent pas l'agent.</p>
  ${HAS_POLLS && HAS_ANSLIST ? '' : '<p class="segbar">Ce backup a été chargé avec une version antérieure de l\'interface : le détail des sonneries en file (taux de réponse, manqués, délai de décroché) et le détail des postes ayant répondu ne sont pas disponibles. Rechargez le .zip pour les obtenir.</p>'}
  <div class="bar"><label class="count">Période</label>
    <select id="apm">${[['7','7 derniers jours'],['30','30 derniers jours'],['90','90 derniers jours'],['all','Tout l\'historique'],['custom','Dates au choix']].map(([v,l]) => `<option value="${v}"${P.mode===v?' selected':''}>${l}</option>`).join('')}</select>
    <span id="apc" ${P.mode==='custom'?'':'hidden'}><input type="date" id="apf" value="${esc(P.from)}" min="${firstDay}" max="${lastDay}"> → <input type="date" id="apt" value="${esc(P.to)}" min="${firstDay}" max="${lastDay}"></span>
    <span class="count" id="aprange"></span></div>
  <div id="abody"></div></div>`;
  const save = () => { try{ localStorage.setItem(STATS_KEY, JSON.stringify(P)); }catch(e){} };
  let lastRows = [], lastFrom = '', lastTo = '';
  function compute(from, to){
    const by = {};
    const A = n => by[n] ||= {ext: n, inAns: 0, inTalk: 0, out: 0, outAns: 0, outTalk: 0, int: 0, qServed: 0, qTalk: 0, pAns: 0, pExp: 0, pDrop: 0, pCanc: 0, pRing: 0, hours: Array(24).fill(0), queues: {}};
    meta.forEach((m, i) => {
      if(m[0] < from || m[0] > to) return;
      const c = all[i];
      if(c[1] === 'in' && Array.isArray(c[11])){ c[11].forEach(([x, t]) => { if(agents.has(x)){ const a = A(x); a.inAns++; a.inTalk += t; a.hours[m[1]]++; } }); }
      else if(c[1] === 'in' && c[10] === 'ans' && agents.has(c[6])){ const a = A(c[6]); a.inAns++; a.inTalk += c[8]; a.hours[m[1]]++; }
      else if(c[1] === 'out' && agents.has(c[2])){ const a = A(c[2]); a.out++; if(c[8]){ a.outAns++; a.outTalk += c[8]; } }
      else if(c[1] === 'int'){ if(agents.has(c[2])) A(c[2]).int++; }
    });
    FULL.queueCalls.forEach((r, i) => { const d = qmeta[i][0]; if(d < from || d > to || !r[6] || !agents.has(r[7])) return; const a = A(r[7]); a.qServed++; a.qTalk += r[5]; });
    if(HAS_POLLS) Object.entries(FULL.agentPolls).forEach(([k, v]) => {
      const [d, q, ag] = k.split('|'); if(d < from || d > to || !agents.has(ag)) return;
      const a = A(ag); a.pAns += v[0]; a.pExp += v[1]; a.pDrop += v[2]; a.pCanc += v[3]; a.pRing += v[5];
      const qq = a.queues[q] ||= [0, 0, 0, 0, 0]; qq[0] += v[0]; qq[1] += v[1]; qq[2] += v[2]; qq[3] += v[3]; qq[4] += v[5];
    });
    return Object.values(by).map(a => ({...a, name: dnName(a.ext), seg: SEGOF[a.ext],
      avgIn: a.inAns ? a.inTalk / a.inAns : null, avgOut: a.outAns ? a.outTalk / a.outAns : null,
      qRate: (a.pAns + a.pExp) ? a.pAns / (a.pAns + a.pExp) : null, ring: a.pAns ? a.pRing / a.pAns : null}))
      .filter(a => a.inAns || a.out || a.qServed || a.pAns || a.pExp);
  }
  const pc = v => v == null ? '–' : Math.round(v * 100) + ' %';
  const rateCls = v => v == null ? '' : v >= 0.85 ? 'ok' : v >= 0.7 ? 'warn' : 'bad';
  function draw(){
    const [from, to] = range(); lastFrom = from; lastTo = to;
    $('#aprange').textContent = `du ${from} au ${to}`;
    const rows = compute(from, to); lastRows = rows;
    const t = rows.reduce((s, a) => { ['inAns','inTalk','out','outAns','outTalk','qServed','pAns','pExp','pRing'].forEach(k => s[k] += a[k]); return s; }, {inAns:0,inTalk:0,out:0,outAns:0,outTalk:0,qServed:0,pAns:0,pExp:0,pRing:0});
    // synthèse par magasin
    const segs = {}; rows.forEach(a => { const s = segs[a.seg || SEG_COMMON] ||= {seg: a.seg || SEG_COMMON, n: 0, inAns: 0, inTalk: 0, out: 0, pAns: 0, pExp: 0, pRing: 0};
      s.n++; s.inAns += a.inAns; s.inTalk += a.inTalk; s.out += a.out; s.pAns += a.pAns; s.pExp += a.pExp; s.pRing += a.pRing; });
    const segRows = Object.values(segs).sort((a, b) => b.inAns - a.inAns);
    $('#abody').innerHTML = `
    <div class="grid kpis">${[['Agents actifs', rows.length], ['Entrants répondus', nf(t.inAns)], ['Conversation moy.', t.inAns ? dur(Math.round(t.inTalk / t.inAns)) : '–'], ['Taux de réponse en file', HAS_POLLS ? pc((t.pAns + t.pExp) ? t.pAns / (t.pAns + t.pExp) : null) : '–'], ['Sonneries manquées (file)', HAS_POLLS ? nf(t.pExp) : '–'], ['Délai moy. de décroché', HAS_POLLS && t.pAns ? dur(Math.round(t.pRing / t.pAns)) : '–'], ['Appels sortants', nf(t.out)]]
      .map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <h3>Par magasin</h3>
    <div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Agents actifs</th><th class="num">Entrants répondus</th><th class="num">Par agent</th><th class="num">Conversation moy.</th><th class="num">Taux de réponse en file</th><th class="num">Manquées</th><th class="num">Décroché moy.</th><th class="num">Sortants</th></tr></thead><tbody>
    ${segRows.map(s => { const r = (s.pAns + s.pExp) ? s.pAns / (s.pAns + s.pExp) : null; return `<tr class="${s.seg === SEG ? 'cur' : ''}"><td><b>${esc(segShort(s.seg))}</b></td><td class="num">${s.n}</td><td class="num">${nf(s.inAns)}</td><td class="num">${s.n ? nf(Math.round(s.inAns / s.n)) : '–'}</td>
      <td class="num">${s.inAns ? dur(Math.round(s.inTalk / s.inAns)) : '–'}</td><td class="num">${HAS_POLLS ? objPill(s.seg, 'qRate', r == null ? null : r * 100, pc(r)) : '–'}</td><td class="num">${HAS_POLLS ? nf(s.pExp) : '–'}</td>
      <td class="num">${HAS_POLLS && s.pAns ? dur(Math.round(s.pRing / s.pAns)) : '–'}</td><td class="num">${nf(s.out)}</td></tr>`; }).join('')}</tbody></table></div>
    <h3>Par agent</h3><div id="at"></div>
    <p class="note">Entrants répondus : appels entrants externes auxquels le poste a répondu à un moment (directs, via une file ou après transfert) ; un appel répondu par la réception puis transféré compte pour les deux. « Servis en file » : appels servis par l'agent dans une file, y compris les appels internes passés par une file. Taux de réponse en file : calculé sur les sonneries proposées par les files (table callcent_ag_dropped_calls). Cliquez sur un agent pour le détail par file et par heure.</p>`;
    table($('#at'), {
      rows, pageSize: 60, sort: [2, -1],
      search: a => [a.ext, a.name, segName(a.seg)].join(' '),
      filters: [{label: 'Tous les magasins', options: [...new Set(rows.map(a => a.seg || SEG_COMMON))].map(s => [s, segShort(s)]), test: (a, v) => (a.seg || SEG_COMMON) === v},
                {label: 'Tous les taux', options: [['bad', 'Moins de 70 % en file'], ['warn', '70 à 85 % en file'], ['ok', '85 % et plus en file']], test: (a, v) => rateCls(a.qRate) === v}],
      cols: [
        {h: 'Poste', v: a => a.ext, f: a => dnLink(a.ext, true)},
        {h: 'Magasin', v: a => segShort(a.seg), cls: 'muted'},
        {h: 'Entrants répondus', num: 1, v: a => a.inAns, f: a => nf(a.inAns)},
        {h: 'Servis en file', num: 1, v: a => a.qServed, f: a => nf(a.qServed)},
        {h: 'Conversation moy.', num: 1, v: a => a.avgIn ?? -1, f: a => a.avgIn == null ? '–' : dur(Math.round(a.avgIn))},
        {h: 'Taux de réponse en file', num: 1, v: a => a.qRate ?? -1, f: a => HAS_POLLS ? `${objPill(a.seg, 'qRate', a.qRate == null ? null : a.qRate * 100, pc(a.qRate))}` : '–'},
        {h: 'Manquées (file)', num: 1, v: a => a.pExp, f: a => HAS_POLLS ? nf(a.pExp) : '–'},
        {h: 'Décroché moy.', num: 1, v: a => a.ring ?? -1, f: a => a.ring == null ? '–' : dur(Math.round(a.ring))},
        {h: 'Sortants', num: 1, v: a => a.out, f: a => nf(a.out)},
        {h: 'Durée moy. sortants', num: 1, v: a => a.avgOut ?? -1, f: a => a.avgOut == null ? '–' : dur(Math.round(a.avgOut))},
      ],
      onRow: showAgent,
    });
    $('#at .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="aexp" style="margin-left:auto">Exporter (CSV)</button>');
    $('#aexp').addEventListener('click', exportCsv);
  }
  function showAgent(a){
    const mx = Math.max(1, ...a.hours);
    const qs = Object.entries(a.queues).sort((x, y) => (y[1][0] + y[1][1]) - (x[1][0] + x[1][1]));
    openDrawer(`${esc(a.ext)} ${esc(a.name)}`, kv([
      ['Magasin', esc(segName(a.seg))], ['Période', `${lastFrom} → ${lastTo}`],
      ['Entrants répondus', nf(a.inAns)], ['Appels servis en file', nf(a.qServed)], ['Conversation moyenne', a.avgIn == null ? '–' : dur(Math.round(a.avgIn))],
      ['Taux de réponse en file', HAS_POLLS ? `${objPill(a.seg, 'qRate', a.qRate == null ? null : a.qRate * 100, pc(a.qRate))} — ${nf(a.pAns)} répondues, ${nf(a.pExp)} expirées` : '–'],
      ['Sonneries neutres', HAS_POLLS ? `${nf(a.pCanc)} annulées (un collègue a répondu), ${nf(a.pDrop)} l'appelant a raccroché` : '–'],
      ['Délai moyen de décroché', a.ring == null ? '–' : dur(Math.round(a.ring))],
      ['Appels sortants', `${nf(a.out)} (${nf(a.outAns)} aboutis, durée moy. ${a.avgOut == null ? '–' : dur(Math.round(a.avgOut))})`],
      ['Appels internes passés', nf(a.int)],
    ]) + (qs.length ? `<h3>Par file d'attente</h3><div class="tw"><table><thead><tr><th>File</th><th class="num">Répondues</th><th class="num">Expirées</th><th class="num">Taux</th><th class="num">Décroché moy.</th></tr></thead><tbody>
      ${qs.map(([q, v]) => { const r = (v[0] + v[1]) ? v[0] / (v[0] + v[1]) : null; return `<tr><td>${dnLink(q)}</td><td class="num">${nf(v[0])}</td><td class="num">${nf(v[1])}</td><td class="num"><span class="pill ${rateCls(r)}">${pc(r)}</span></td><td class="num">${v[0] ? dur(Math.round(v[4] / v[0])) : '–'}</td></tr>`; }).join('')}</tbody></table></div>` : '')
      + `<h3>Appels entrants répondus par heure</h3><div style="display:flex;align-items:flex-end;gap:2px;height:70px">${a.hours.map((h, i) => `<div title="${i} h : ${h}" style="flex:1;background:var(--accent);height:${100 * h / mx}%;min-height:${h ? 2 : 0}px;border-radius:2px 2px 0 0"></div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>`);
  }
  function exportCsv(){
    const q = v => '"' + csvSafe(v) + '"', r1 = v => v == null ? '' : Math.round(v);
    const out = [['Poste', 'Nom', 'Magasin', 'Du', 'Au', 'Entrants répondus', 'Via file', 'Conversation moy. (s)', 'Sonneries répondues (file)', 'Sonneries expirées (file)', 'Taux de réponse file (%)', 'Annulées (collègue)', 'Appelant raccroché', 'Décroché moy. (s)', 'Sortants', 'Sortants aboutis', 'Durée moy. sortants (s)', 'Internes']]
      .concat(lastRows.map(a => [a.ext, a.name, segShort(a.seg), lastFrom, lastTo, a.inAns, a.qServed, r1(a.avgIn), a.pAns, a.pExp, a.qRate == null ? '' : Math.round(a.qRate * 1000) / 10, a.pCanc, a.pDrop, r1(a.ring), a.out, a.outAns, r1(a.avgOut), a.int]));
    const el2 = document.createElement('a');
    el2.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    el2.download = `agents-${lastFrom}_${lastTo}.csv`; el2.click(); setTimeout(() => URL.revokeObjectURL(el2.href), 2000);
  }
  $('#apm').addEventListener('change', e => { P.mode = e.target.value; $('#apc').hidden = P.mode !== 'custom'; if(P.mode === 'custom'){ P.from ||= firstDay; P.to ||= lastDay; $('#apf').value = P.from; $('#apt').value = P.to; } save(); draw(); });
  $('#apf').addEventListener('change', e => { P.from = e.target.value; save(); draw(); });
  $('#apt').addEventListener('change', e => { P.to = e.target.value; save(); draw(); });
  draw();
};

