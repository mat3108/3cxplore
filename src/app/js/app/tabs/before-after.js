// ---------- Avant / après : parcours des SDA dans le backup de référence et dans le backup actuel ----------
// contexte de simulation d'un autre backup (index des éléments, SDA, département par défaut)
function simCtx(X){
  const DNx = {}, add = (n, kind, name, obj) => { if(n) DNx[n] = {kind, name, obj}; };
  X.extensions.forEach(e => add(e.number, 'Poste', (e.first + ' ' + e.last).trim(), e)); X.queues.forEach(q => add(q.number, "File d'attente", q.name, q));
  X.ivrs.forEach(i => add(i.number, 'Standard (IVR)', i.name, i)); X.ringGroups.forEach(r => add(r.number, 'Groupe de sonnerie', r.name, r)); X.groups.forEach(g => add(g.number, 'Département', g.name, g));
  const dids = []; X.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(d => dids.push({did: d, line: l, rule: by[d] || def, isDefault: !by[d] && !!def})); });
  return {DN: DNx, dids, def: X.groups.find(g => g.name === '__DEFAULT__')};
}
const simSig = R => R.steps.map(s => [s.kind, s.dn || s.title, s.branch || '', s.cls || ''].join('·')).join(' > ') + ' => ' + R.end + '/' + (R.after || '');
const SIM_RANK = {human: 3, vm: 2, ext: 2, wait: 1, lost: 0};
// renvoi vers un autre système 3CX (bridge, ex. « 12GRP0000 ») : ce qui se passe ensuite n'est pas connu
const simBridge = R => R.steps.some(s => (s.kind === 'Numéro externe' && /[A-Za-z]/.test(s.title || '')) || (s.kind === 'Département' && /^Renvoi\b/i.test(s.title || '')) || (s.kind === 'Numéro externe' && (s.lines || []).some(l => /3CX|bridge/i.test(l))));
V.avantapres = el => {
  const REF = window.REF_D;
  if(!REF){ el.innerHTML = `<h2>Avant / après</h2><p class="lead">Compare le parcours de chaque SDA entre deux backups, pour vérifier qu'une correction faite dans la console a l'effet voulu (et rien d'autre).</p>
    <p>Aucun backup de référence : chargez l'ancien backup dans l'onglet <a class="dlink" href="#comparaison">Comparaison</a>, puis revenez ici.</p>`; return; }
  const refIso = backupDateISO(REF.info.date) || '', curIso = backupDateISO(FULL.info.date) || '';
  const curIsAfter = curIso >= refIso, ctxRef = simCtx(REF);
  const dk = X => { const i = backupDateISO(X.info.date); return i ? dayKey(i) : X.info.date; };
  const before = curIsAfter ? {ctx: ctxRef, date: dk(REF)} : {ctx: null, date: dk(FULL)}, after = curIsAfter ? {ctx: null, date: dk(FULL)} : {ctx: ctxRef, date: dk(REF)};
  // 18.1.41 : numéro retiré (absent du backup actuel) rattaché au magasin de la destination de sa règle dans le backup de référence
  const refSeg = d => { const r = ctxRef.dids.find(x => x.did === d), dn = r && r.rule && r.rule.office && r.rule.office.dn; return dn ? SEGOF[dn] : ''; };
  const CUR = simCtx(FULL); // 18.2.5 : backup actuel simulé comme le backup de référence (sans historique des pauses)
  const M = ctlMoments(), ids = new Set([...allDIDs.map(r => r.did), ...ctxRef.dids.map(r => r.did)].filter(d => !SEG || DIDSEG[d] === SEG || (!DIDSEG[d] && refSeg(d) === SEG)));
  const inB = new Set((before.ctx ? before.ctx.dids : allDIDs).map(r => r.did)), inA = new Set((after.ctx ? after.ctx.dids : allDIDs).map(r => r.did));
  const rows = [...ids].map(did => {
    if(!inB.has(did)) return {did, kind: 'new', calls: lineCalls[did] || 0, moments: []};
    if(!inA.has(did)) return {did, kind: 'gone', calls: lineCalls[did] || 0, moments: []};
    const moments = M.map(([k, l, day, t]) => { const [h, m] = t.split(':').map(Number), min = h * 60 + m;
      const b = simulate(did, day, min, {}, before.ctx || CUR), a = simulate(did, day, min, {}, after.ctx || CUR), sb = simSig(b), sa = simSig(a);
      if(sb === sa) return null;
      const rb = SIM_RANK[b.end] * 10 + (b.after ? SIM_RANK[b.after] : 5), ra = SIM_RANK[a.end] * 10 + (a.after ? SIM_RANK[a.after] : 5);
      let i = 0; while(i < Math.min(b.steps.length, a.steps.length) && simSig({steps: [b.steps[i]], end: ''}) === simSig({steps: [a.steps[i]], end: ''})) i++;
      const br = simBridge(b) || simBridge(a);
      return {k, l, day, t, b, a, br, trend: br ? 'same' : ra > rb ? 'up' : ra < rb ? 'down' : 'same', div: i}; }).filter(Boolean);
    return {did, kind: moments.length ? 'changed' : 'same', calls: lineCalls[did] || 0, moments, trend: moments.some(m => m.trend === 'down') ? 'down' : moments.some(m => m.trend === 'up') ? 'up' : 'same'};
  });
  const ch = rows.filter(r => r.kind !== 'same').sort((a, b) => ({down: 0, up: 1, same: 2})[a.trend || 'same'] - ({down: 0, up: 1, same: 2})[b.trend || 'same'] || b.calls - a.calls);
  const cnt = f => rows.filter(f).length, TR = {up: ['Amélioré', 'ok'], down: ['Dégradé', 'bad'], same: ['Modifié', 'acc']};
  const endTxt = R => SIM_END[R.end][0] + (R.after ? ' → si personne ne répond : ' + SIM_END[R.after][0] : '');
  el.innerHTML = `<div id="apwrap"><h2>Avant / après</h2>
    <p class="lead">Parcours de chaque SDA${SEG ? ` du magasin <b>${esc(segName(SEG))}</b>` : ''} simulé avec la configuration du backup <b>avant</b> (${esc(before.date)}) et du backup <b>après</b> (${esc(after.date)}), aux mêmes moments que le Contrôle des SDA : ${M.map(m => esc(m[1])).join(', ')}. Pour vérifier qu'une correction faite dans la console a eu l'effet voulu, et rien d'autre.</p>
    <div class="grid kpis">${[['SDA comparés', nf(rows.length), ''], ['Parcours changés', nf(cnt(r => r.kind === 'changed')), ''], ['Améliorés', nf(cnt(r => r.trend === 'up')), 'ok'], ['Dégradés', nf(cnt(r => r.trend === 'down')), cnt(r => r.trend === 'down') ? 'bad' : 'ok'], ['Nouveaux SDA', nf(cnt(r => r.kind === 'new')), ''], ['SDA retirés', nf(cnt(r => r.kind === 'gone')), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <h3>SDA dont le parcours a changé (${ch.length})</h3>
    ${ch.length ? ch.slice(0, 150).map(r => r.kind === 'new' ? `<div class="card apr"><span class="pill acc">Nouveau</span> <b class="mono">${esc(phone(r.did))}</b> <span class="muted">${esc(segShort(DIDSEG[r.did] || SEG_COMMON))} · n'existait pas dans le backup avant</span></div>`
      : r.kind === 'gone' ? `<div class="card apr"><span class="pill">Retiré</span> <b class="mono">${esc(phone(r.did))}</b> <span class="muted">n'existe plus dans le backup après</span></div>`
      : `<details class="card ccat apr"${r.trend === 'down' ? ' open' : ''}><summary><span class="pill ${TR[r.trend][1]}">${TR[r.trend][0]}</span> <b class="mono">${esc(phone(r.did))}</b> <span class="muted">${esc(segShort(DIDSEG[r.did] || SEG_COMMON))} · ${nf(r.calls)} appels${r.moments.some(m => m.br) ? ' · vers un autre 3CX : issue non comparable' : ''}</span>
          <span style="margin-left:auto;font-size:12.5px">${r.moments.map(m => `<span class="pill ${TR[m.trend][1]}" title="${esc(endTxt(m.b) + ' ⟶ ' + endTxt(m.a))}">${esc(m.l)}</span>`).join(' ')}</span></summary>
        <div style="padding:0 12px 12px">${r.moments.slice(0, 3).map(m => `<div class="apm"><div class="muted" style="font-size:12.5px;margin:6px 0"><b>${esc(m.l)}</b> (${esc(m.day)} ${esc(m.t)}) : ${esc(endTxt(m.b))} <b>⟶</b> ${esc(endTxt(m.a))}</div>
          <div class="apcols">${[['Avant', m.b], ['Après', m.a]].map(([lbl, R]) => `<div><div class="bkt">${lbl}</div><ol class="apsteps">${R.steps.map((s, i) => `<li class="${i >= m.div ? 'diff' : ''}${s.soft ? ' soft' : ''}"><span class="muted">${esc(s.kind)}</span> ${esc(s.dn ? s.dn + ' ' + s.title.replace(new RegExp('^' + s.dn + ' '), '') : s.title)}${s.branch ? ` <span class="pill">${esc(s.branch)}</span>` : ''}</li>`).join('')}</ol></div>`).join('')}</div></div>`).join('')}
          ${r.moments.length > 3 ? `<div class="muted" style="font-size:12.5px">+${r.moments.length - 3} autre(s) moment(s) modifié(s)</div>` : ''}
          <a class="dlink" href="#simulateur/${esc(r.did)}" style="font-size:12.5px">Ouvrir dans le simulateur (backup actuel) ▸</a></div></details>`).join('') + (ch.length > 150 ? `<p class="muted">+${ch.length - 150} autres SDA.</p>` : '')
      : '<p><span class="pill ok">Aucun changement</span> Tous les SDA suivent le même parcours dans les deux backups aux moments contrôlés.</p>'}
    <p class="note">« Amélioré » : l'issue est meilleure après (par exemple un appel perdu qui arrive maintenant à une personne ou à une messagerie). « Dégradé » : l'issue est moins bonne. « Modifié » : le parcours a changé mais l'issue est équivalente, ou l'un des deux parcours part vers un autre système 3CX (bridge), dont la suite n'est pas connue. Les étapes en couleur sont celles qui diffèrent. Les jours et heures simulés sont les mêmes pour les deux backups (horaires et jours fériés de chacun).</p></div>`;
};

