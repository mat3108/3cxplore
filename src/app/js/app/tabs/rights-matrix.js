// ---------- Matrice des droits : départements × rôles, droits propres et incohérences ----------
const MX_ROLES = ['users', 'receptionists', 'supervisors', 'managers', 'observers', 'group_admins', 'group_owners', 'system_admins', 'system_owners'];
const MX_SENS = ['canBargeIn', 'canSeeGroupRecordings', 'performOperations', 'allowToManageCompanyBook', 'allowToChangePresence', 'canSeeGroupCalls'];
function mxAnalysis(){
  const depts = FULL.groups.filter(g => g.roles && Object.keys(g.roles).length && g.name !== 'SYSTEM' && !/^___FAVORITES/.test(g.name));
  const inSeg = g => !SEG || SEGOF[g.number] === SEG || g.name === '__DEFAULT__';
  // définition la plus courante de chaque droit pour chaque rôle (référence)
  const ref = {};
  MX_ROLES.forEach(r => Object.keys(VR_FR).forEach(k => { const v = depts.map(g => g.roles[r]).filter(Boolean).map(x => !!x[k]);
    const t = v.filter(Boolean).length; (ref[r] ||= {})[k] = {val: t * 2 >= v.length, n: v.length, t}; }));
  const issues = [];
  const add = (sev, cat, title, detail, items, link) => issues.push({sev, cat, title, detail, items, link});
  // 1) définitions de rôle différentes de la majorité
  MX_ROLES.forEach(r => Object.keys(VR_FR).forEach(k => { const R = ref[r][k]; if(!R.n) return;
    const odd = depts.filter(g => inSeg(g) && g.roles[r] && !!g.roles[r][k] !== R.val);
    if(odd.length && odd.length < R.n / 2) add(R.val ? 'warn' : (MX_SENS.includes(k) ? 'bad' : 'warn'), 'Définition des rôles',
      `« ${VROLE_FR[r] || r} » ${R.val ? 'n\'a pas' : 'a'} le droit « ${VR_FR[k]} » dans ${odd.length} département${odd.length > 1 ? 's' : ''}`,
      `Contrairement aux ${R.n - odd.length} autres départements.`, odd.map(g => g.name), 'droits'); }));
  // 2) droits propres qui ajoutent des droits sensibles, et accès hors du magasin
  const own = [], outside = [];
  depts.forEach(g => g.members.forEach(m => {
    const e = EXT_BY[m.dn]; if(!e) return;
    const base = g.roles[m.role] || {}, eff = {...base, ...(m.rights || {})};
    if(m.rights){ const plus = Object.keys(m.rights).filter(k => m.rights[k] && !base[k]), minus = Object.keys(m.rights).filter(k => !m.rights[k] && base[k]);
      if(plus.length || minus.length) own.push({e, g, role: m.role, plus, minus, sens: plus.filter(k => MX_SENS.includes(k))}); }
    const se = SEGOF[e.number] || SEG_COMMON, sg = SEGOF[g.number] || SEG_COMMON;
    if(g.name !== '__DEFAULT__' && se !== sg && se !== SEG_COMMON && sg !== SEG_COMMON && sg !== SEG_BRIDGE && (eff.canSeeGroupRecordings || eff.canBargeIn || eff.canSeeGroupCalls))
      outside.push({e, g, role: m.role, what: ['canSeeGroupRecordings', 'canBargeIn', 'canSeeGroupCalls'].filter(k => eff[k])});
  }));
  const ownS = own.filter(x => !SEG || SEGOF[x.e.number] === SEG || SEGOF[x.g.number] === SEG), outS = outside.filter(x => !SEG || SEGOF[x.e.number] === SEG || SEGOF[x.g.number] === SEG);
  const sensBy = {}; ownS.filter(x => x.sens.length).forEach(x => (sensBy[x.e.number] ||= {e: x.e, l: []}).l.push(x));
  const sens = Object.values(sensBy);
  if(sens.length) add('bad', 'Droits propres', `${sens.length} poste${sens.length > 1 ? 's ont' : ' a'} des droits sensibles ajoutés à leur rôle`, 'Intervention dans les appels, écoute des enregistrements, prise des appels, gestion de l\'annuaire ou du statut des autres.',
    sens.map(x => `${x.e.number} ${(x.e.first + ' ' + x.e.last).trim()} : + ${[...new Set(x.l.flatMap(y => y.sens))].map(k => VR_FR[k]).join(', ')} — ${x.l.length} département${x.l.length > 1 ? 's' : ''} (${x.l.slice(0, 4).map(y => y.g.name).join(', ')}${x.l.length > 4 ? '…' : ''})`), 'visibilite');
  const byExt = {}; outS.forEach(x => (byExt[x.e.number] ||= {e: x.e, gs: []}).gs.push(x));
  const outL = Object.values(byExt);
  if(outL.length) add('warn', 'Accès entre magasins', `${outL.length} poste${outL.length > 1 ? 's voient' : ' voit'} les appels ou les enregistrements d'un autre magasin`, 'Membres d\'un département d\'un autre magasin avec le droit de voir ses appels, d\'y intervenir ou d\'écouter ses enregistrements.',
    outL.map(x => `${x.e.number} ${(x.e.first + ' ' + x.e.last).trim()} (${segShort(SEGOF[x.e.number] || SEG_COMMON)}) → ${x.gs.map(y => y.g.name).join(', ')}`), 'visibilite');
  // 3) réceptions qui ne peuvent pas prendre les appels de leur département
  const rec = []; depts.filter(inSeg).forEach(g => g.members.forEach(m => { if(m.role !== 'receptionists') return; const eff = {...(g.roles[m.role] || {}), ...(m.rights || {})};
    if(!eff.performOperations) rec.push(`${m.dn} ${dnName(m.dn)} — ${g.name}`); }));
  if(rec.length) add('warn', 'Réception', `${rec.length} réceptionniste${rec.length > 1 ? 's ne peuvent' : ' ne peut'} pas prendre ou transférer les appels de leur département`, 'Le droit « Prendre ou transférer les appels des membres » est retiré.', rec, 'visibilite');
  // 4) observateurs qui écoutent les enregistrements ou interviennent
  const obsBy = {}; depts.filter(inSeg).forEach(g => g.members.forEach(m => { if(m.role !== 'observers') return; const eff = {...(g.roles[m.role] || {}), ...(m.rights || {})};
    const w = ['canSeeGroupRecordings', 'canBargeIn'].filter(k => eff[k]); if(w.length){ const o = obsBy[m.dn] ||= {w: new Set(), g: []}; w.forEach(k => o.w.add(k)); o.g.push(g.name); } }));
  const obs = Object.entries(obsBy).map(([dn, o]) => `${dn} ${dnName(dn)} : ${[...o.w].map(k => VR_FR[k]).join(', ')} — ${o.g.length} département${o.g.length > 1 ? 's' : ''} (${o.g.slice(0, 4).join(', ')}${o.g.length > 4 ? '…' : ''})`);
  if(obs.length) add('warn', 'Observateurs', `${obs.length} observateur${obs.length > 1 ? 's peuvent' : ' peut'} écouter les enregistrements ou intervenir dans les appels`, 'Le rôle Observateur est normalement en lecture seule.', obs, 'visibilite');
  const SEVO = {bad: 0, warn: 1, obs: 2}; issues.sort((a, b) => SEVO[a.sev] - SEVO[b.sev] || b.items.length - a.items.length);
  return {depts: depts.filter(inSeg), ref, issues, own: ownS};
}
V.droits = el => {
  if(!FULL.groups.some(g => g.roles)){ el.innerHTML = '<h2>Matrice des droits</h2><p class="lead">Les droits par département sont lus depuis la version 10.0 : rechargez le backup (.zip) depuis le tableau de bord pour les afficher.</p>'; return; }
  const S = window.__mx ||= {k: 'canSeeGroupCalls'}, M = mxAnalysis();
  const roles = MX_ROLES.filter(r => M.depts.some(g => g.roles[r])), SEVL = {bad: ['Important', 'bad'], warn: ['À vérifier', 'warn'], obs: ['Information', '']};
  const cell = (g, r) => { const d = g.roles[r]; if(!d) return '<td class="mxc muted">—</td>'; const v = !!d[S.k], dev = v !== M.ref[r][S.k].val, nMem = g.members.filter(m => m.role === r).length;
    return `<td class="mxc ${v ? 'y' : 'n'}${dev ? ' dev' : ''}" title="${esc(VROLE_FR[r] || r)} · ${esc(g.name)} : ${v ? 'oui' : 'non'}${dev ? ' (différent de la majorité)' : ''} · ${nMem} membre(s)">${v ? '✓' : '·'}${nMem ? `<sub>${nMem}</sub>` : ''}</td>`; };
  el.innerHTML = `<div id="mxwrap"><h2>Matrice des droits</h2>
    <p class="lead">Les droits de chaque rôle dans chaque département${SEG ? ` (magasin <b>${esc(segName(SEG))}</b>)` : ''}, les droits propres de certains postes et les incohérences détectées. Une case orange signale une définition différente de celle de la majorité des départements pour ce rôle ; le petit chiffre indique le nombre de membres ayant ce rôle.</p>
    <h3>Incohérences détectées (${M.issues.length})</h3>
    ${M.issues.length ? M.issues.map((x, i) => `<details class="card ccat"${i < 3 ? ' open' : ''}><summary><span class="pill ${SEVL[x.sev][1]}">${SEVL[x.sev][0]}</span> <span class="muted" style="font-size:12px">${esc(x.cat)}</span> <b>${esc(x.title)}</b></summary>
      <div style="padding:0 12px 12px"><div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(x.detail)} <a class="dlink" href="#${esc(x.link)}">ouvrir ▸</a></div><ul class="hspen">${x.items.slice(0, 40).map(t => `<li>${esc(t)}</li>`).join('')}${x.items.length > 40 ? `<li class="muted">+${x.items.length - 40} autres</li>` : ''}</ul></div></details>`).join('') : '<p><span class="pill ok">Aucune</span></p>'}
    ${FULL.groups.some(g => g.globalVis) ? `<div class="card" style="font-size:13px;margin-top:10px"><b>Présence visible par toute l'entreprise</b> <span class="muted">(réglage du département, indépendant des rôles) :</span> ${M.depts.filter(g => g.globalVis).map(g => `<span class="pill">${esc(g.name)}</span>`).join(' ') || '<span class="muted">aucun dans cette sélection</span>'}</div>` : ''}
    <h3>Départements × rôles</h3>
    <div class="bar"><label class="count">Droit affiché</label><select id="mxk">${Object.entries(VR_FR).map(([k, l]) => `<option value="${k}"${S.k === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <span class="count">Référence (majorité) : ${roles.map(r => `${esc(VROLE_FR[r] || r)} ${M.ref[r][S.k].val ? '✓' : '·'}`).join(' · ')}</span></div>
    <div class="tw"><table class="mxt"><thead><tr><th>Département</th><th>Magasin</th>${roles.map(r => `<th>${esc(VROLE_FR[r] || r)}</th>`).join('')}</tr></thead><tbody>
      ${M.depts.map(g => `<tr><td>${g.name === '__DEFAULT__' ? esc(gLabel(g)) : dnLink(g.number)}</td><td class="muted">${esc(segShort(SEGOF[g.number] || SEG_COMMON))}</td>${roles.map(r => cell(g, r)).join('')}</tr>`).join('')}</tbody></table></div>
    <h3>Droits propres des postes (${M.own.length})</h3><div id="mxown"></div>
    <p class="note">Les droits propres d'un poste remplacent ceux de son rôle dans le département concerné. « + » : droit ajouté par rapport au rôle ; « − » : droit retiré.</p></div>`;
  table($('#mxown'), {rows: M.own, pageSize: 50, state: (window.__mxT ||= {}),
    search: x => [x.e.number, x.e.first, x.e.last, x.g.name, VROLE_FR[x.role] || x.role].join(' '),
    filters: [{label: 'Tous', options: [['sens', 'Avec un droit sensible ajouté']], test: (x, v) => x.sens.length > 0}],
    cols: [{h: 'Poste', v: x => x.e.number, f: x => dnLink(x.e.number)}, {h: 'Département', v: x => x.g.name}, {h: 'Rôle', v: x => VROLE_FR[x.role] || x.role},
      {h: 'Droits ajoutés', v: x => x.plus.length, f: x => x.plus.map(k => `<span class="vright${MX_SENS.includes(k) ? ' own' : ''}">+ ${esc(VR_FR[k])}</span>`).join(' ') || '<span class="muted">—</span>'},
      {h: 'Droits retirés', v: x => x.minus.length, f: x => x.minus.map(k => `<span class="vright">− ${esc(VR_FR[k])}</span>`).join(' ') || '<span class="muted">—</span>'}]});
  $('#mxk').addEventListener('change', e => { S.k = e.target.value; V.droits(el); });
};

