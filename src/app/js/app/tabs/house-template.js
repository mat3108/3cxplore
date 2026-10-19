// ---------- Template maison (19.2.1) : paramètres demandés par la direction, vérifiés point par point dans le backup ----------
// Pour ajouter un point : une entrée de plus dans MAISON_RULES (id, titre, exigence, correction, colonnes, rows()).
// éléments d'acheminement qui mènent à une messagerie (vmRefs de Messageries vocales), triés entre général et files
function maisonRefs(){
  const R = vmRefs(), gen = [], fil = [], inSeg = n => !SEG || (SEGOF[n] || SEG_COMMON) === SEG;
  Object.entries(R).forEach(([box, refs]) => refs.forEach(r => {
    if(r.cat === 'sda'){ if(!SEG || DIDSEG[r.did] === SEG) gen.push({n: r.from, did: r.did, kind: 'SDA', what: `${r.what} — ${r.hrs}`, box}); return; }
    if(r.cat !== 'route' || !inSeg(r.from)) return;
    const kind = DN[r.from] ? DN[r.from].kind : '';
    (kind === "File d'attente" ? fil : gen).push({n: r.from, kind, what: r.what, box});
  }));
  return {gen, fil};
}
// postes actifs : messagerie activée, ou profil actif qui renvoie vers une messagerie
function maisonUsers(){
  const isVM = d => d && d.to === 'VoiceMail';
  return FULL.extensions.filter(e => e.enabled && (!SEG || (SEGOF[e.number] || SEG_COMMON) === SEG)).map(e => {
    const act = e.profiles.find(p => p.name === e.profile), fwd = act ? act.routes.filter(([, d]) => isVM(d)).map(([, d]) => d.dn || e.number) : [];
    return {n: e.number, e, on: e.vm, fwd: [...new Set(fwd)]};
  }).filter(x => x.on || x.fwd.length);
}
const maisonBox = x => x.box === x.n ? '<span class="muted">sa propre boîte</span>' : `${dnLink(x.box)}${EXT_BY[x.box] && !EXT_BY[x.box].vm ? ' <span class="muted">(désactivée)</span>' : ''}`;
const MAISON_RULES = [
  {id: 'general', titre: 'Pas de boîte vocale générale', exigence: "Aucun SDA, menu (IVR), département ou groupe de sonnerie ne mène à une messagerie vocale.",
    correction: "Dans la console, remplacer la destination « Messagerie vocale » par un poste, une file, un menu ou un message de fermeture.",
    rows: M => M.refs.gen,
    cols: [{h: 'Élément', v: x => x.did || x.n, f: x => x.did ? `<span class="mono">${esc(phone(x.did))}</span> <span class="muted">SDA (trunk ${esc(x.n)})</span>` : `${dnLink(x.n)} <span class="muted">${esc(x.kind)}</span>`},
      {h: 'Où', v: x => x.what}, {h: 'Messagerie visée', v: x => x.box, f: maisonBox}],
    csv: x => [x.did ? phone(x.did) : x.n, x.did ? 'SDA' : dnName(x.n), x.what, x.box]},
  {id: 'files', titre: 'Pas de boîte vocale de file', exigence: "Aucune file d'attente ne déborde ni ne s'achemine (heures d'ouverture ou hors heures) vers une messagerie vocale.",
    correction: "Dans la file, changer la destination « Si personne ne répond » ou l'acheminement hors heures pour un poste, une autre file ou un menu.",
    rows: M => M.refs.fil,
    cols: [{h: 'File', v: x => x.n, f: x => dnLink(x.n)}, {h: 'Où', v: x => x.what}, {h: 'Messagerie visée', v: x => x.box, f: maisonBox}],
    csv: x => [x.n, dnName(x.n), x.what, x.box]},
  {id: 'usagers', titre: "Pas de boîte vocale d'usager", exigence: "Aucun poste actif n'a sa messagerie vocale activée ni de renvoi vers une messagerie dans son statut actuel.",
    correction: "Dans le poste, désactiver la messagerie vocale et remplacer les renvois « Messagerie vocale » du statut actuel.",
    rows: M => M.users,
    cols: [{h: 'Poste', v: x => x.n, f: x => dnLink(x.n)},
      {h: 'Messagerie', v: x => x.on ? 1 : 0, f: x => x.on ? '<span class="pill bad">activée</span>' : '<span class="muted">désactivée</span>'},
      {h: 'Renvoi du statut actuel', v: x => x.fwd.length, f: x => x.fwd.length ? `<span class="pill warn">vers ${x.fwd.map(n => n === x.n ? 'sa messagerie' : `la messagerie de ${esc(n)}`).join(', ')}</span> <span class="muted">(${esc(fwdName(x.e.profile))})</span>` : '<span class="muted">—</span>'}],
    csv: x => [x.n, dnName(x.n), [x.on ? 'messagerie activée' : '', x.fwd.length ? `renvoi vers ${x.fwd.join(', ')} (${fwdName(x.e.profile)})` : ''].filter(Boolean).join(' ; '), x.fwd.join(', ')]},
];
V.maison = el => {
  const M = {refs: maisonRefs(), users: maisonUsers()}, res = MAISON_RULES.map(r => ({r, rows: r.rows(M)})), nBad = res.filter(x => x.rows.length).length;
  el.innerHTML = `<h2>Template maison</h2>
    <p class="lead">Les paramètres demandés par la direction, vérifiés un à un dans ce backup${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Pour la direction, il n'y a pas de boîte vocale : ni générale, ni de file, ni d'usager.</p>
    <div class="card" style="border-left:4px solid var(--${nBad ? 'bad' : 'ok'})"><b>${nBad ? `${nf(nBad)} point${nBad > 1 ? 's' : ''} sur ${nf(res.length)} à corriger` : `Les ${nf(res.length)} points sont conformes`}</b> <span class="muted">${nBad ? 'Le détail de chaque point est plus bas.' : 'La configuration respecte la demande de la direction.'}</span></div>
    <div class="grid kpis">${res.map(({r, rows}) => `<div class="card kpi ${rows.length ? 'bad' : 'ok'}" data-go="${r.id}" style="cursor:pointer"><div class="v" style="font-size:21px">${rows.length ? nf(rows.length) : '✓'}</div><div class="l">${esc(r.titre)}</div><div class="muted" style="font-size:12px">${rows.length ? (rows.length > 1 ? 'constats à corriger' : 'constat à corriger') : 'Conforme'}</div></div>`).join('')}</div>
    <div class="bar noprint"><button class="btn" id="mexp">Exporter les points à corriger (CSV)</button></div>
    ${res.map(({r, rows}) => `<h3 id="maison-${r.id}">${rows.length ? '<span class="pill bad">À corriger</span>' : '<span class="pill ok">Conforme</span>'} ${esc(r.titre)}</h3>
      <p><b>Exigence :</b> ${esc(r.exigence)}${rows.length ? `<br><b>Correction :</b> ${esc(r.correction)}` : ''}</p>
      ${rows.length ? `<div id="mt-${r.id}"></div>` : '<p class="muted">Rien à corriger.</p>'}`).join('')}
    <p class="note">Les messageries des postes désactivés ne sont pas vérifiées. Pour les usagers, seul le statut actuel du poste est lu : les autres statuts gardent souvent le renvoi par défaut de 3CX. Le détail de chaque boîte (courriel, messages conservés, consultation) est dans <a href="#messageries">Messageries vocales</a>.</p>`;
  res.forEach(({r, rows}) => { if(!rows.length) return;
    table($('#mt-' + r.id), {rows, pageSize: 25, sort: [0, 1], state: ((window.__maisonT ||= {})[r.id] ||= {}), search: x => [x.n, dnName(x.n), x.did ? phone(x.did) : '', x.what || '', x.box || ''].join(' '),
      cols: [...r.cols, {h: 'Magasin', v: x => segShort(x.did ? DIDSEG[x.did] || SEG_COMMON : SEGOF[x.n] || SEG_COMMON)}]}); });
  el.querySelectorAll('[data-go]').forEach(k => k.addEventListener('click', () => $('#maison-' + k.dataset.go).scrollIntoView({behavior: 'smooth'})));
  $('#mexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Point', 'Élément', 'Nom', 'Constat', 'Messagerie visée']].concat(res.flatMap(({r, rows}) => rows.map(x => [r.titre, ...r.csv(x)])));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(x => x.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'template-maison.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
