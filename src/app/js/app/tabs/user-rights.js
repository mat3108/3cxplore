// ---------- Visibilité et droits d'un utilisateur (droits par département et par rôle) ----------
const VR_FR = {canSeeGroupMembers: 'Voir les membres', showMyPresence: 'Montrer sa présence', showMyPresenceOutside: 'Présence visible hors du département', canSeeGroupCalls: 'Voir les appels des membres', showMyCalls: 'Montrer ses appels',
  performOperations: 'Prendre ou transférer les appels des membres', canBargeIn: 'Intervenir dans un appel (écoute, chuchotement)', canIntercom: 'Interphone', canSeeGroupRecordings: 'Écouter les enregistrements', allowToManageCompanyBook: 'Gérer l\'annuaire de l\'entreprise',
  allowToChangePresence: 'Changer le statut des autres', allowParking: 'Parquer des appels', allowIVR: 'Gérer les menus (IVR)', assignClearOperations: 'Assigner / libérer les appels'};
const VROLE_FR = {users: 'Utilisateur', managers: 'Gestionnaire', supervisors: 'Superviseur', receptionists: 'Réceptionniste', observers: 'Observateur', group_owners: 'Propriétaire de département', group_admins: 'Administrateur de département', system_owners: 'Propriétaire du système', system_admins: 'Administrateur du système', system: 'Système'};
const gLabel = g => g.name === '__DEFAULT__' ? 'Département par défaut (système)' : g.name;
let VIS_CACHE = null;
function visModel(){
  if(VIS_CACHE) return VIS_CACHE;
  const by = {}, favOf = {};
  FULL.groups.forEach(g => {
    if(g.name === 'SYSTEM') return;
    const fav = /^___FAVORITES___(\d+)/.exec(g.name);
    g.members.forEach(m => {
      if(fav){ (favOf[fav[1]] ||= new Set()).add(m.dn); return; }   // favoris personnels du poste fav[1]
      const base = (g.roles || {})[m.role] || {}, own = m.rights && Object.keys(m.rights).length ? m.rights : null;
      (by[m.dn] ||= []).push({g, role: m.role, eff: {...base, ...(own || {})}, own});
    });
  });
  return VIS_CACHE = {by, favOf};
}
// relation : ce que « u » voit et peut faire sur « m »
function visRel(u, m){
  const VM = visModel(), U = VM.by[u] || [], M = VM.by[m] || [];
  const shared = U.filter(x => M.some(y => y.g === x.g)).map(x => ({g: x.g, u: x, m: M.find(y => y.g === x.g)}));
  const pick = f => shared.filter(f).map(s => gLabel(s.g));
  const hidden = !!(DN[m] && DN[m].obj && DN[m].obj.hidePresence);
  const pres = hidden ? [] : pick(s => s.u.eff.canSeeGroupMembers && s.m.eff.showMyPresence);
  // présence publique : département visible par toute l'entreprise, ou droit « présence visible hors du département »
  const outside = hidden ? [] : [...new Set([...M.filter(y => y.g.globalVis).map(y => gLabel(y.g)), ...M.filter(y => y.eff.showMyPresenceOutside).map(y => gLabel(y.g))])];
  let presWhy = '';
  if(!pres.length){
    if(hidden) presWhy = 'ce poste cache sa présence (option du poste)';
    else if(outside.length) presWhy = '';
    else if(!shared.length) presWhy = 'aucun département en commun';
    else if(!shared.some(s => s.u.eff.canSeeGroupMembers)) presWhy = 'pas le droit de voir les membres (' + shared.map(s => gLabel(s.g)).join(', ') + ')';
    else presWhy = 'ce poste cache sa présence';
  }
  return {shared: shared.map(s => gLabel(s.g)), pres, outside: pres.length ? [] : outside, presWhy,
    calls: pick(s => s.u.eff.canSeeGroupCalls && s.m.eff.showMyCalls), ops: pick(s => s.u.eff.performOperations), barge: pick(s => s.u.eff.canBargeIn),
    rec: pick(s => s.u.eff.canSeeGroupRecordings), fav: !!(VM.favOf[u] && VM.favOf[u].has(m))};
}
V.visibilite = (el, arg) => {
  if(!FULL.groups.some(g => g.roles)){ el.innerHTML = '<h2>Visibilité et droits</h2><p class="lead">Les droits par département sont lus depuis la version 10.0 : rechargez le backup (.zip) depuis le tableau de bord pour les afficher.</p>'; return; }
  const S = window.__vis ||= {u: '', dir: 'voit', show: 'tout'};
  const exts = FULL.extensions.slice().sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  if(arg) S.u = decodeURIComponent(arg);
  if(!exts.some(e => e.number === S.u)) S.u = (exts.find(e => !SEG || SEGOF[e.number] === SEG) || exts[0] || {}).number || '';
  const U = exts.find(e => e.number === S.u), VM = visModel(), mine = VM.by[S.u] || [];
  const nm = e => (e.first + ' ' + e.last).trim();
  // relations avec tous les autres postes (dans un sens ou dans l'autre)
  const rows = exts.filter(e => e.number !== S.u && (!SEG || SEGOF[e.number] === SEG)).map(e => ({e, r: S.dir === 'voit' ? visRel(S.u, e.number) : visRel(e.number, S.u)}));
  const sees = r => r.pres.length || r.outside.length;
  const shown = rows.filter(x => S.show === 'tout' || (S.show === 'oui' ? sees(x.r) : !sees(x.r)));
  const cnt = f => rows.filter(x => f(x.r)).length;
  const who = S.dir === 'voit' ? `${S.u} ${nm(U)}` : `ces postes`;
  const yes = (list, title) => list.length ? `<span class="pill ok" title="${esc(title + ' : ' + list.join(', '))}">oui</span> <span class="muted" style="font-size:11.5px">${esc(list.slice(0, 2).join(', '))}${list.length > 2 ? '…' : ''}</span>` : '<span class="pill">non</span>';
  el.innerHTML = `<div id="viswrap"><h2>Visibilité et droits</h2>
    <p class="lead">Dans 3CX, ce qu'un utilisateur voit et peut faire dépend de son <b>rôle dans chaque département</b> (et de ses éventuels droits propres). Choisissez un utilisateur : sa fiche montre ses départements et ses droits, et le tableau indique, pour chaque poste${SEG ? ` du magasin <b>${esc(segName(SEG))}</b>` : ''}, s'il voit sa présence et ses appels, s'il peut les prendre ou y intervenir, et pourquoi.</p>
    ${FULL.groups.every(g => g.globalVis === undefined) ? `<div class="card" style="border-left:3px solid var(--warn)">Ce backup a été ouvert avec une version antérieure à 11.8.1 : <b>rouvrez-le</b> pour tenir compte des départements dont la présence est visible par toute l'entreprise (sinon la présence est sous-estimée).</div>` : (() => { const gv = FULL.groups.filter(g => g.globalVis && !isSysGroup(g)); return gv.length ? `<div class="card" style="font-size:13px"><b>Présence visible par toute l'entreprise</b> <span class="muted">— les membres de ces ${gv.length} départements sont vus par tous les utilisateurs, avec leur statut :</span> ${gv.map(g => `<span class="pill">${esc(g.name)}</span>`).join(' ')}</div>` : ''; })()}
    <div class="bar"><input type="search" id="visq" placeholder="Rechercher un utilisateur (poste ou nom)…" autocomplete="off" style="flex:1;min-width:200px">
      <select id="visu" style="max-width:100%">${exts.map(e => `<option value="${esc(e.number)}"${e.number === S.u ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))} · ${esc(segShort(SEGOF[e.number] || SEG_COMMON))}</option>`).join('')}</select></div>
    ${U ? `<div class="card" style="margin-top:8px"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><b style="font-size:17px">${dnLink(U.number)}</b><span class="muted">${esc(U.email || '')} · ${esc(segName(SEGOF[U.number] || SEG_COMMON))}</span>${(() => { try{ const m = mfaOf(U); return `<span class="pill ${MFA_L[m.k][1]}">${MFA_L[m.k][0]}</span>`; }catch(e){ return ''; } })()}</div>
      <h3>Départements et droits (${mine.length})</h3>
      ${mine.length ? `<div class="tw"><table><thead><tr><th>Département</th><th>Magasin</th><th>Rôle</th><th>Droits</th></tr></thead><tbody>${mine.map(x => `<tr><td>${x.g.name === '__DEFAULT__' ? esc(gLabel(x.g)) : dnLink(x.g.number)}</td><td class="muted">${esc(segShort(SEGOF[x.g.number] || SEG_COMMON))}</td>
        <td><span class="pill ${/system_(owners|admins)|group_(owners|admins)/.test(x.role) ? 'bad' : /managers|supervisors/.test(x.role) ? 'warn' : ''}">${esc(VROLE_FR[x.role] || x.role)}</span>${x.own ? ' <span class="pill acc" title="Droits propres à ce poste, qui remplacent ceux du rôle">droits propres</span>' : ''}</td>
        <td style="font-size:12px">${Object.keys(VR_FR).filter(k => x.eff[k]).map(k => `<span class="vright${x.own && k in x.own ? ' own' : ''}">${esc(VR_FR[k])}</span>`).join(' ') || '<span class="muted">aucun</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Ce poste n\'est membre d\'aucun département.</p>'}</div>` : ''}
    <div class="bar" style="margin-top:12px"><label class="count">Sens</label><select id="visdir"><option value="voit"${S.dir === 'voit' ? ' selected' : ''}>Ce que cet utilisateur voit</option><option value="vu"${S.dir === 'vu' ? ' selected' : ''}>Qui voit cet utilisateur</option></select>
      <label class="count">Afficher</label><select id="visshow">${[['tout', 'Tous les postes'], ['oui', S.dir === 'voit' ? 'Ceux qu\'il voit' : 'Ceux qui le voient'], ['non', S.dir === 'voit' ? 'Ceux qu\'il ne voit pas' : 'Ceux qui ne le voient pas']].map(([v, l]) => `<option value="${v}"${S.show === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="grid kpis">${[[S.dir === 'voit' ? 'Postes dont il voit la présence' : 'Postes qui voient sa présence', cnt(sees), 'ok'], ['… pas la présence', rows.length - cnt(sees), ''], [S.dir === 'voit' ? 'Voit leurs appels' : 'Voient ses appels', cnt(r => r.calls.length), ''], [S.dir === 'voit' ? 'Peut prendre leurs appels' : 'Peuvent prendre ses appels', cnt(r => r.ops.length), 'warn'], [S.dir === 'voit' ? 'Peut intervenir (écoute)' : 'Peuvent intervenir (écoute)', cnt(r => r.barge.length), 'warn'], [S.dir === 'voit' ? 'Écoute leurs enregistrements' : 'Écoutent ses enregistrements', cnt(r => r.rec.length), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${nf(v)}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <h3>${S.dir === 'voit' ? `Ce que ${esc(who)} voit` : `Qui voit ${esc(S.u + ' ' + nm(U))}`} (${nf(shown.length)} postes)</h3><div id="vist"></div>
    <p class="note">Présence visible si l'observateur a le droit « Voir les membres » et l'observé « Montrer sa présence » dans un département commun, si l'observé est membre d'un département dont la présence est visible par toute l'entreprise, ou s'il montre sa présence hors de son département — sauf si le poste cache sa présence. Appels : « Voir les appels des membres » et « Montrer ses appels ». Les droits propres d'un poste remplacent ceux de son rôle. Reconstitution à partir de la configuration du backup : l'application 3CX peut différer dans quelques cas particuliers (favoris personnels, comptes d'administration).</p></div>`;
  table($('#vist'), {rows: shown, pageSize: 100, state: (window.__visTable ||= {}),
    search: x => [x.e.number, nm(x.e), segShort(SEGOF[x.e.number] || SEG_COMMON), x.r.shared.join(' ')].join(' '),
    filters: [{label: 'Tous les magasins', options: [...new Set(shown.map(x => SEGOF[x.e.number] || SEG_COMMON))].sort().map(s => [s, segShort(s)]), test: (x, v) => (SEGOF[x.e.number] || SEG_COMMON) === v}],
    cols: [{h: 'Poste', v: x => x.e.number, f: x => dnLink(x.e.number) + (x.r.fav ? ' <span class="pill acc" title="Dans ses favoris personnels">favori</span>' : '')}, {h: 'Magasin', v: x => segShort(SEGOF[x.e.number] || SEG_COMMON), cls: 'muted'},
      {h: 'Présence', v: x => sees(x.r) ? 1 : 0, f: x => x.r.pres.length ? yes(x.r.pres, 'Visible par') : x.r.outside.length ? `<span class="pill ok">oui</span> <span class="muted" style="font-size:11.5px" title="${esc('Présence visible par toute l\'entreprise : ' + x.r.outside.join(', '))}">visible par toute l'entreprise (${esc(x.r.outside[0])}${x.r.outside.length > 1 ? '…' : ''})</span>` : `<span class="pill bad">non</span> <span class="muted" style="font-size:11.5px">${esc(x.r.presWhy)}</span>`},
      {h: 'Appels', v: x => x.r.calls.length, f: x => yes(x.r.calls, 'Appels visibles par')}, {h: 'Prendre / transférer', v: x => x.r.ops.length, f: x => yes(x.r.ops, 'Opérations par')},
      {h: 'Intervenir', v: x => x.r.barge.length, f: x => yes(x.r.barge, 'Intervention par')}, {h: 'Enregistrements', v: x => x.r.rec.length, f: x => yes(x.r.rec, 'Enregistrements par')},
      {h: 'Départements communs', v: x => x.r.shared.length, f: x => `<span style="font-size:12px">${esc(x.r.shared.join(', ') || '—')}</span>`}]});
  $('#vist .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="visexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#visexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"', yn = l => l.length ? 'oui (' + l.join(', ') + ')' : 'non';
    const out = [['Poste', 'Nom', 'Magasin', 'Présence', 'Appels', 'Prendre / transférer', 'Intervenir', 'Enregistrements', 'Départements communs']].concat(shown.map(x => [x.e.number, nm(x.e), segShort(SEGOF[x.e.number] || SEG_COMMON), x.r.pres.length ? yn(x.r.pres) : x.r.outside.length ? 'oui (visible par toute l\'entreprise : ' + x.r.outside.join(', ') + ')' : 'non : ' + x.r.presWhy, yn(x.r.calls), yn(x.r.ops), yn(x.r.barge), yn(x.r.rec), x.r.shared.join(', ')]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = `visibilite-${S.dir}-${S.u}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  const W = $('#viswrap');
  $('#visq').addEventListener('input', e => { const q = gsNorm(e.target.value), sel = $('#visu');
    [...sel.options].forEach(o => o.hidden = !!q && !gsNorm(o.text).includes(q)); const first = [...sel.options].find(o => !o.hidden);
    if(first && q && sel.selectedOptions[0].hidden){ S.u = first.value; window.__visTable = {}; V.visibilite(el); $('#visq').value = e.target.value; $('#visq').focus(); [...$('#visu').options].forEach(o => o.hidden = !gsNorm(o.text).includes(q)); } });
  W.addEventListener('change', e => { if(e.target.id === 'visu'){ S.u = e.target.value; window.__visTable = {}; history.replaceState(null, '', '#visibilite/' + S.u); V.visibilite(el); }
    if(e.target.id === 'visdir'){ S.dir = e.target.value; V.visibilite(el); } if(e.target.id === 'visshow'){ S.show = e.target.value; V.visibilite(el); } });
};

