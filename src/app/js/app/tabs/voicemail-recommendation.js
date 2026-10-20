// ---------- Recommandation BV (19.2.1, renommée en 19.2.2) : paramètres demandés par la direction — pas de boîte vocale générale, de file ni d'usager ----------
// 19.2.2 : chaque tableau montre toutes les conditions (départements, files) et tous les statuts (usagers), la messagerie en rouge
const RBV_VM = d => d && d.to === 'VoiceMail';
const RBV_GR = [['office', "Heures d'ouverture"], ['outOfOffice', 'Hors heures'], ['break', 'Pause'], ['holidays', 'Jours fériés']];
const RBV_ST = ['Available', 'Away', 'Out of office', 'Custom 1', 'Custom 2'];
// libellé d'une condition de renvoi d'un statut (« AvailableRoute › NoAnswer › AllCalls » → « sans réponse »)
function rbvCond(k){
  const p = k.split(' › '), C = {NoAnswer: 'sans réponse', Busy: 'occupé', NotRegistered: 'non connecté'};
  let s = C[p[1]] ? C[p[1]] + (p[2] === 'Internal' ? ' (appels internes)' : '') : p[1] === 'External' ? 'appels externes' : p[1] === 'Internal' ? 'appels internes' : p.slice(1).join(' › ');
  if(p.includes('OutOfOfficeHours')) s += ', hors heures';
  return s;
}
const rbvCell = d => RBV_VM(d) ? `<span class="pill bad">Messagerie vocale</span>${d.dn ? ' ' + dnLink(d.dn) : ''}` : destHTML(d);
const rbvTxt = d => !d || !d.to ? '' : (TO_FR[d.to] || d.to) + (d.dn ? ' ' + d.dn : d.ext ? ' ' + phone(d.ext) : '');
const rbvSeg = n => SEGOF[n] || SEG_COMMON, rbvIn = n => !SEG || rbvSeg(n) === SEG;
function rbvData(){
  const deps = FULL.groups.filter(g => !isSysGroup(g) && rbvIn(g.number)).map(g => ({n: g.number, g, bad: RBV_GR.filter(([k]) => RBV_VM(g.routes[k])).map(([, l]) => l)}));
  // autres éléments généraux : SDA, menus, groupes de sonnerie (Messageries vocales, vmRefs)
  const other = [];
  Object.entries(vmRefs()).forEach(([box, refs]) => refs.forEach(r => {
    if(r.cat === 'sda'){ if(!SEG || DIDSEG[r.did] === SEG) other.push({n: r.from, did: r.did, kind: 'SDA', what: `${r.what} — ${r.hrs}`, box}); return; }
    const kind = DN[r.from] ? DN[r.from].kind : '';
    if(r.cat === 'route' && rbvIn(r.from) && kind !== "File d'attente" && kind !== 'Département') other.push({n: r.from, kind, what: r.what, box});
  }));
  const QC = [['dest', 'Si personne ne répond', q => q.dest], ['office', "Heures d'ouverture", q => q.routes.office], ['outOfOffice', 'Hors heures', q => q.routes.outOfOffice]];
  const queues = FULL.queues.filter(q => rbvIn(q.number)).map(q => ({n: q.number, q, bad: QC.filter(([, , f]) => RBV_VM(f(q))).map(([, l]) => l)}));
  const names = [...RBV_ST, ...new Set(FULL.extensions.flatMap(e => e.profiles.map(p => p.name)).filter(n => !RBV_ST.includes(n)))];
  const users = FULL.extensions.filter(e => e.enabled && rbvIn(e.number)).map(e => {
    const st = Object.fromEntries(e.profiles.map(p => [p.name, p.routes.filter(([, d]) => RBV_VM(d)).map(([k]) => rbvCond(k))]));
    const bad = [...(e.vm ? ['messagerie activée'] : []), ...names.filter(n => st[n] && st[n].length).map(n => `${fwdName(n)} : ${st[n].join(', ')}`)];
    return {n: e.number, e, st, bad};
  });
  return {deps, other, QC, queues, names, users};
}
const rbvState = (id, def) => ((window.__rbvT ||= {})[id] ||= {fvals: {0: def}});
const rbvFilter = [{label: 'Tous', options: [['bad', 'À corriger'], ['ok', 'Conformes']], test: (x, v) => (v === 'bad') === !!x.bad.length}];
V.recobv = el => {
  const A = rbvData(), nDep = A.deps.filter(x => x.bad.length).length, nQ = A.queues.filter(x => x.bad.length).length, nU = A.users.filter(x => x.bad.length).length;
  const pts = [{id: 'general', titre: 'Pas de boîte vocale générale', n: nDep + A.other.length,
      exigence: "Aucun département, SDA, menu (IVR) ou groupe de sonnerie ne mène à une messagerie vocale, dans aucune condition (heures d'ouverture, hors heures, pause, jours fériés).",
      correction: "Dans la console, remplacer la destination « Messagerie vocale » par un poste, une file, un menu ou un message de fermeture."},
    {id: 'files', titre: 'Pas de boîte vocale de file', n: nQ,
      exigence: "Aucune file d'attente ne mène à une messagerie vocale : ni si personne ne répond, ni dans ses acheminements d'heures d'ouverture ou hors heures.",
      correction: "Dans la file, changer la destination « Si personne ne répond » ou l'acheminement pour un poste, une autre file ou un menu."},
    {id: 'usagers', titre: "Pas de boîte vocale d'usager", n: nU,
      exigence: "Aucun poste actif n'a sa messagerie vocale activée, ni de renvoi vers une messagerie dans aucun de ses statuts.",
      correction: "Dans le poste, désactiver la messagerie vocale et remplacer les renvois « Messagerie vocale » de chaque statut."}];
  const nBad = pts.filter(p => p.n).length, unit = {general: ['élément', 'éléments'], files: ['file', 'files'], usagers: ['poste', 'postes']};
  el.innerHTML = `<h2>Recommandation BV</h2>
    <p class="lead">Les paramètres demandés par la direction, vérifiés un à un dans ce backup${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Pour la direction, il n'y a pas de boîte vocale : ni générale, ni de file, ni d'usager.</p>
    <div class="card" style="border-left:4px solid var(--${nBad ? 'bad' : 'ok'})"><b>${nBad ? `${nf(nBad)} point${nBad > 1 ? 's' : ''} sur ${nf(pts.length)} à corriger` : `Les ${nf(pts.length)} points sont conformes`}</b> <span class="muted">${nBad ? 'Le détail de chaque point est plus bas.' : 'La configuration respecte la demande de la direction.'}</span></div>
    <div class="grid kpis">${pts.map(p => `<div class="card kpi ${p.n ? 'bad' : 'ok'}" data-go="${p.id}" style="cursor:pointer"><div class="v" style="font-size:21px">${p.n ? nf(p.n) : '✓'}</div><div class="l">${esc(p.titre)}</div><div class="muted" style="font-size:12px">${p.n ? `${unit[p.id][p.n > 1 ? 1 : 0]} à corriger` : 'Conforme'}</div></div>`).join('')}</div>
    <div class="bar noprint"><button class="btn" id="rbvexp">Exporter les points à corriger (CSV)</button></div>
    ${pts.map(p => `<h3 id="rbv-${p.id}">${p.n ? '<span class="pill bad">À corriger</span>' : '<span class="pill ok">Conforme</span>'} ${esc(p.titre)}</h3>
      <p><b>Exigence :</b> ${esc(p.exigence)}${p.n ? `<br><b>Correction :</b> ${esc(p.correction)}` : ''}</p>
      ${p.id === 'general' ? `<h4>Départements</h4><div id="rbvt-dep"></div>${A.other.length ? '<h4>SDA, menus et groupes de sonnerie</h4><div id="rbvt-oth"></div>' : '<p class="muted">Aucun SDA, menu ou groupe de sonnerie ne mène à une messagerie.</p>'}` : `<div id="rbvt-${p.id}"></div>`}`).join('')}
    <p class="note">Dans les tableaux, une destination « Messagerie vocale » est en rouge ; les autres destinations sont affichées telles quelles. Les sous-renvois décochés dans la console sont ignorés, comme les postes désactivés. Le statut actuel de chaque poste est marqué « actuel ». Le détail de chaque boîte (courriel, messages conservés, consultation) est dans <a href="#messageries">Messageries vocales</a>.</p>`;
  const segCol = {h: 'Magasin', v: x => segShort(rbvSeg(x.n))};
  table($('#rbvt-dep'), {rows: A.deps, pageSize: 25, sort: [0, 1], state: rbvState('dep', nDep ? 'bad' : ''), filters: rbvFilter, search: x => [x.n, dnName(x.n), ...x.bad].join(' '),
    cols: [{h: 'Département', v: x => dnName(x.n), f: x => dnLink(x.n)}, ...RBV_GR.map(([k, l]) => ({h: l, v: x => rbvTxt(x.g.routes[k]), f: x => rbvCell(x.g.routes[k])})), segCol]});
  if(A.other.length) table($('#rbvt-oth'), {rows: A.other, pageSize: 25, sort: [0, 1], state: rbvState('oth', ''), search: x => [x.n, dnName(x.n), x.did ? phone(x.did) : '', x.what].join(' '),
    cols: [{h: 'Élément', v: x => x.did || x.n, f: x => x.did ? `<span class="mono">${esc(phone(x.did))}</span> <span class="muted">SDA (trunk ${esc(x.n)})</span>` : `${dnLink(x.n)} <span class="muted">${esc(x.kind)}</span>`},
      {h: 'Où', v: x => x.what}, {h: 'Messagerie visée', v: x => x.box, f: x => x.box === x.n ? '<span class="pill bad">sa propre boîte</span>' : `<span class="pill bad">Messagerie vocale</span> ${dnLink(x.box)}`},
      {h: 'Magasin', v: x => segShort(x.did ? DIDSEG[x.did] || SEG_COMMON : rbvSeg(x.n))}]});
  table($('#rbvt-files'), {rows: A.queues, pageSize: 25, sort: [0, 1], state: rbvState('files', nQ ? 'bad' : ''), filters: rbvFilter, search: x => [x.n, dnName(x.n), ...x.bad].join(' '),
    cols: [{h: 'File', v: x => x.n, f: x => dnLink(x.n)}, ...A.QC.map(([, l, f]) => ({h: l, v: x => rbvTxt(f(x.q)), f: x => rbvCell(f(x.q))})), segCol]});
  table($('#rbvt-usagers'), {rows: A.users, pageSize: 25, sort: [0, 1], state: rbvState('usagers', nU ? 'bad' : ''), filters: rbvFilter, search: x => [x.n, dnName(x.n), ...x.bad].join(' '),
    cols: [{h: 'Poste', v: x => x.n, f: x => dnLink(x.n)}, {h: 'Messagerie', v: x => x.e.vm ? 1 : 0, f: x => x.e.vm ? '<span class="pill bad">activée</span>' : '<span class="muted">désactivée</span>'},
      ...A.names.map(n => ({h: fwdName(n), v: x => (x.st[n] || []).length, f: x => {
        const cur = x.e.profile === n ? ' <span class="pill">actuel</span>' : '';
        if(!x.st[n]) return '<span class="muted">—</span>' + cur;
        return (x.st[n].length ? `<span class="pill bad">Messagerie : ${esc(x.st[n].join(', '))}</span>` : '<span class="muted">aucun renvoi vers la messagerie</span>') + cur; }})), segCol]});
  el.querySelectorAll('[data-go]').forEach(k => k.addEventListener('click', () => $('#rbv-' + k.dataset.go).scrollIntoView({behavior: 'smooth'})));
  $('#rbvexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"', [g, f, u] = pts.map(p => p.titre);
    const out = [['Point', 'Élément', 'Nom', 'Magasin', 'Constat']]
      .concat(A.deps.filter(x => x.bad.length).map(x => [g, x.n, dnName(x.n), segShort(rbvSeg(x.n)), 'Messagerie vocale : ' + x.bad.join(', ')]))
      .concat(A.other.map(x => [g, x.did ? phone(x.did) : x.n, x.did ? 'SDA' : dnName(x.n), segShort(x.did ? DIDSEG[x.did] || SEG_COMMON : rbvSeg(x.n)), `${x.what} → messagerie ${x.box}`]))
      .concat(A.queues.filter(x => x.bad.length).map(x => [f, x.n, dnName(x.n), segShort(rbvSeg(x.n)), 'Messagerie vocale : ' + x.bad.join(', ')]))
      .concat(A.users.filter(x => x.bad.length).map(x => [u, x.n, dnName(x.n), segShort(rbvSeg(x.n)), x.bad.join(' ; ')]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(x => x.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'recommandation-bv.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
