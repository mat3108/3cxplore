// ---------- Appels au 911 (20.6) : le numéro que reçoit le 911 pour chaque poste, et le magasin (donc l'adresse) auquel il appartient ----------
// numéro envoyé = Caller ID de la route de la règle 911 s'il y en a un, sinon celui du poste, sinon le numéro principal du trunk ; le 911 retrouve l'adresse à partir de ce numéro
const URG_ST = {other: ['Adresse d\'un autre magasin', 'bad'], nostore: ['Numéro sans magasin', 'warn'], unknown: ['Numéro inconnu du serveur', 'warn'], none: ['Aucun numéro envoyé', 'bad'], check: ['À vérifier (poste sans magasin)', ''], ok: ['Bon magasin', 'ok']};
function urgAnalysis(){
  const rule = FULL.outbound.find(o => (o.prefix || '').split(',').some(p => p.trim() === '911')) || null, route = rule && rule.routes[0] || null;
  const line = route ? FULL.lines.find(l => l.gateway === route.gw) || null : null, trunkNum = line ? line.extNumber : '';
  const didSeg = {}; FULL.lines.forEach(l => l.dids.forEach(d => { const k = normNum(d); if(k) didSeg[k] = DIDSEG[d] || SEG_COMMON; }));
  const inSeg = n => !SEG || (SEGOF[n] || SEG_COMMON) === SEG;
  const rows = !route ? [] : FULL.extensions.filter(e => inSeg(e.number) && SEGOF[e.number] !== SEG_BRIDGE).map(e => {
    const seg = SEGOF[e.number] || SEG_COMMON, src = route.cid ? 'route' : normNum(e.callerId) ? 'poste' : trunkNum ? 'trunk' : '', num = route.cid || (normNum(e.callerId) ? e.callerId : trunkNum);
    const k = normNum(num), ps = k ? didSeg[k] : undefined;
    const st = !k ? 'none' : ps === undefined ? 'unknown' : seg[0] === '@' ? 'check' : ps[0] === '@' ? 'nostore' : ps !== seg ? 'other' : 'ok';
    return {e, seg, name: (e.first + ' ' + e.last).trim(), num, k, src, ps, st}; });
  const calls = FULL.calls.filter(c => c[1] === 'out' && normNum(c[4]) === '911' && inSeg(c[2]));
  return {rule, route, line, trunkNum, trunkSeg: didSeg[normNum(trunkNum)], rows, calls, bad: rows.filter(x => x.st === 'other' || x.st === 'none'), warn: rows.filter(x => x.st === 'nostore' || x.st === 'unknown')};
}
V.urgence = el => {
  const U = urgAnalysis(), cnt = k => U.rows.filter(x => x.st === k).length, SRC = {route: 'règle 911', poste: 'numéro du poste', trunk: 'numéro principal du trunk'};
  if(!U.rule){ el.innerHTML = '<h2>Appels au 911</h2><p class="lead">Aucune règle sortante ne correspond au 911 : un appel au 911 ne sortirait pas. Créez une règle prioritaire pour le préfixe 911 vers un trunk qui achemine les appels d\'urgence.</p>'; return; }
  const dn = n => n ? `${esc(phone(n) || n)}` : '—';
  el.innerHTML = `<div id="urgwrap"><h2>Appels au 911</h2>
    <p class="lead">Quand un poste compose le 911, le service d'urgence reçoit un numéro et retrouve l'adresse à partir de ce numéro. Si c'est le numéro d'un autre magasin, les secours partent vers la mauvaise adresse${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="card" style="margin:10px 0"><b>Règle utilisée :</b> ${esc(U.rule.name)} (préfixe ${esc(U.rule.prefix)}) vers ${esc(U.route ? U.route.gw : 'aucun trunk')}.
      ${U.route && U.route.cid ? `Elle envoie toujours le <span class="mono">${dn(U.route.cid)}</span>, quel que soit le poste.` : `Elle n'impose pas de numéro : chaque poste envoie son numéro de sortie, ou à défaut le numéro principal du trunk, <span class="mono">${dn(U.trunkNum)}</span>${U.trunkSeg && U.trunkSeg[0] !== '@' ? ` (magasin ${esc(segShort(U.trunkSeg))})` : ''}.`}</div>
    <div class="grid kpis">${[['Postes vérifiés', nf(U.rows.length), ''], ['Adresse d\'un autre magasin', nf(cnt('other') + cnt('none')), cnt('other') + cnt('none') ? 'bad' : 'ok'], ['Numéro sans magasin ou inconnu', nf(U.warn.length), U.warn.length ? 'warn' : ''], ['Appels au 911 dans l\'historique', nf(U.calls.length), '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div id="urgt"></div>
    ${U.calls.length ? `<h3>Appels au 911 dans l'historique</h3><div class="tw"><table><thead><tr><th>Date</th><th>Poste</th><th>Numéro qui serait envoyé aujourd'hui</th><th>Constat</th></tr></thead><tbody>${U.calls.map(c => { const x = U.rows.find(r => r.e.number === c[2]);
      return `<tr><td>${esc(fmtD(c[0]))}</td><td>${dnLink(c[2])}</td><td class="mono">${x ? dn(x.num) : '—'}</td><td>${x ? `<span class="pill ${URG_ST[x.st][1]}">${esc(URG_ST[x.st][0])}</span>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
    <p class="note">Le numéro envoyé est déduit de la configuration actuelle (règle sortante 911, numéro de sortie du poste, numéro principal du trunk) ; l'adresse liée à chaque numéro est celle enregistrée chez l'opérateur. Pour corriger un poste : mettre comme numéro de sortie un SDA de son magasin (page Sans numéro de sortie). « Numéro sans magasin » : SDA qui ne mène à aucun magasin, l'adresse est à confirmer auprès de l'opérateur.</p></div>`;
  table($('#urgt'), {rows: U.rows, pageSize: 50, sort: [5, 1], state: (window.__urgT ||= {}),
    search: x => [x.e.number, x.name, segShort(x.seg), phone(x.num), x.ps ? segShort(x.ps) : '', URG_ST[x.st][0]].join(' '),
    filters: [{label: 'Tous les constats', options: Object.entries(URG_ST).map(([k, v]) => [k, v[0]]), test: (x, v) => x.st === v}],
    cols: [{h: 'Poste', v: x => x.e.number, f: x => dnLink(x.e.number)}, {h: 'Magasin du poste', v: x => segShort(x.seg)},
      {h: 'Numéro envoyé au 911', v: x => x.k, f: x => `<span class="mono">${dn(x.num)}</span>`}, {h: 'Provient du', v: x => SRC[x.src] || '', cls: 'muted'},
      {h: 'Magasin du numéro', v: x => x.ps ? segShort(x.ps) : '', f: x => x.ps === undefined ? '<span class="muted">—</span>' : esc(segShort(x.ps))},
      {h: 'Constat', v: x => ['other', 'none', 'unknown', 'nostore', 'check', 'ok'].indexOf(x.st), f: x => `<span class="pill ${URG_ST[x.st][1]}">${esc(URG_ST[x.st][0])}</span>`}],
    onRow: x => { location.hash = '#employe/' + encodeURIComponent(x.e.number); }});
  $('#urgt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="urgexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#urgexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Poste', 'Nom', 'Magasin du poste', 'Numéro envoyé au 911', 'Provient du', 'Magasin du numéro', 'Constat']].concat(U.rows.map(x => [x.e.number, x.name, segShort(x.seg), phone(x.num) || x.num, SRC[x.src] || '', x.ps ? segShort(x.ps) : '', URG_ST[x.st][0]]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'appels-911.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
