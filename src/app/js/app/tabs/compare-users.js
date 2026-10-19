// ---------- Comparer deux utilisateurs : fiche, départements et droits, visibilité, files ----------
V.comparer = el => {
  if(!FULL.groups.some(g => g.roles)){ el.innerHTML = '<h2>Comparer deux utilisateurs</h2><p class="lead">Les droits par département sont lus depuis la version 10.0 : rechargez le backup (.zip) depuis le tableau de bord pour les afficher.</p>'; return; }
  const exts = FULL.extensions.slice().sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  const S = window.__cmpu ||= {a: '', b: ''};
  const def = exts.filter(e => !SEG || SEGOF[e.number] === SEG);
  if(!exts.some(e => e.number === S.a)) S.a = (def[0] || exts[0] || {}).number || '';
  if(!exts.some(e => e.number === S.b) || S.b === S.a) S.b = (def.find(e => e.number !== S.a) || exts.find(e => e.number !== S.a) || {}).number || '';
  const A = exts.find(e => e.number === S.a), B = exts.find(e => e.number === S.b);
  if(!A || !B){ el.innerHTML = '<h2>Comparer deux utilisateurs</h2><p class="muted">Il faut au moins deux postes.</p>'; return; }
  const nm = e => (e.first + ' ' + e.last).trim(), VM = visModel(), yn = v => v ? 'oui' : 'non';
  const fwdOf = e => { try{ const f = secAnalysis().fwd.find(r => r.e === e); return f ? f.nums.map(phone).join(', ') + (f.active ? ' (actif)' : '') : 'aucun'; }catch(er){ return '—'; } };
  const mfa = e => { try{ return MFA_L[mfaOf(e).k][0]; }catch(er){ return '—'; } };
  const facts = [['Magasin', e => segName(SEGOF[e.number] || SEG_COMMON)], ['Courriel', e => e.email || '—'], ['Actif', e => yn(e.enabled)], ['MFA', mfa], ['Réseau local seulement', e => yn(e.lanOnly)],
    ['Profil actuel', e => fwdName(e.profile) || '—'], ['Caller ID', e => phone(e.callerId) || '—'], ['Téléphones', e => e.devices.map(d => d.model || d.template).join(', ') || 'aucun'], ['Enregistrement des appels', e => yn(e.record)],
    ['Messagerie vocale', e => yn(e.vm)], ['Renvoi vers l\'extérieur', fwdOf], ["Files d'attente", e => e.queues.map(q => q + ' ' + dnName(q)).join(', ') || 'aucune'], ['Groupes de sonnerie', e => e.ringGroups.map(q => q + ' ' + dnName(q)).join(', ') || 'aucun']];
  // départements et droits
  const mA = VM.by[S.a] || [], mB = VM.by[S.b] || [], gs = [...new Set([...mA, ...mB].map(x => x.g))].sort((x, y) => x.name.localeCompare(y.name));
  const drows = gs.map(g => { const a = mA.find(x => x.g === g), b = mB.find(x => x.g === g);
    const diff = a && b ? Object.keys(VR_FR).filter(k => !!a.eff[k] !== !!b.eff[k]) : [];
    return {g, a, b, diff, same: a && b && a.role === b.role && !diff.length}; });
  // visibilité de chacun sur les autres postes
  const others = exts.filter(e => e.number !== S.a && e.number !== S.b), sees = r => r.pres.length || r.outside.length;
  const rel = others.map(e => ({e, ra: visRel(S.a, e.number), rb: visRel(S.b, e.number)}));
  const only = (f, x, y) => rel.filter(o => f(o[x]) && !f(o[y]));
  const presA = only(sees, 'ra', 'rb'), presB = only(sees, 'rb', 'ra'), callA = only(r => r.calls.length, 'ra', 'rb'), callB = only(r => r.calls.length, 'rb', 'ra'), opsA = only(r => r.ops.length, 'ra', 'rb'), opsB = only(r => r.ops.length, 'rb', 'ra');
  // actions pour aligner B sur A
  const todo = [];
  drows.forEach(d => { const gl = gLabel(d.g);
    if(d.a && !d.b) todo.push(`Ajouter ${S.b} au département « ${gl} » avec le rôle « ${VROLE_FR[d.a.role] || d.a.role} »${d.a.own ? ' (A a aussi des droits propres dans ce département)' : ''}`);
    else if(d.b && !d.a) todo.push(`Retirer ${S.b} du département « ${gl} » (si A n'y est pas volontairement)`);
    else if(d.a.role !== d.b.role) todo.push(`Dans « ${gl} », passer ${S.b} du rôle « ${VROLE_FR[d.b.role] || d.b.role} » au rôle « ${VROLE_FR[d.a.role] || d.a.role} »`);
    else if(d.diff.length) todo.push(`Dans « ${gl} », ajuster les droits propres de ${S.b} : ${d.diff.map(k => (d.a.eff[k] ? '+ ' : '− ') + VR_FR[k]).join(', ')}`); });
  A.queues.filter(q => !B.queues.includes(q)).forEach(q => todo.push(`Ajouter ${S.b} comme agent de la file ${q} ${dnName(q)}`));
  A.ringGroups.filter(q => !B.ringGroups.includes(q)).forEach(q => todo.push(`Ajouter ${S.b} au groupe de sonnerie ${q} ${dnName(q)}`));
  const listE = (arr, label) => arr.length ? `<details class="card ccat"><summary><b>${esc(label)}</b> <span class="muted">${arr.length} poste${arr.length > 1 ? 's' : ''}</span></summary><div style="padding:0 12px 12px;font-size:12.5px">${arr.slice(0, 80).map(o => dnLink(o.e.number)).join(' · ')}${arr.length > 80 ? ` <span class="muted">+${arr.length - 80}</span>` : ''}</div></details>` : '';
  const opts = sel => exts.map(e => `<option value="${esc(e.number)}"${e.number === sel ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))} · ${esc(segShort(SEGOF[e.number] || SEG_COMMON))}</option>`).join('');
  const roleP = x => x ? `<span class="pill ${/system_|group_/.test(x.role) ? 'bad' : /managers|supervisors/.test(x.role) ? 'warn' : ''}">${esc(VROLE_FR[x.role] || x.role)}</span>${x.own ? ' <span class="pill acc">droits propres</span>' : ''}` : '<span class="muted">—</span>';
  el.innerHTML = `<div id="cuwrap"><h2>Comparer deux utilisateurs</h2>
    <p class="lead">Les deux utilisateurs côte à côte : fiche, départements et rôles, droits, ce que chacun voit, files et groupes. Pratique pour configurer un nouvel employé « comme son collègue » : la dernière section liste les changements à faire pour que B ait les mêmes accès que A.</p>
    <div class="grid two"><div class="card"><div class="bkt">Utilisateur A (référence)</div><input type="search" class="cuq" data-s="a" placeholder="Rechercher…" style="width:100%;margin:6px 0"><select id="cua" style="width:100%">${opts(S.a)}</select></div>
      <div class="card"><div class="bkt">Utilisateur B</div><input type="search" class="cuq" data-s="b" placeholder="Rechercher…" style="width:100%;margin:6px 0"><select id="cub" style="width:100%">${opts(S.b)}</select></div></div>
    <p><button class="btn" id="cusw">⇄ Inverser A et B</button></p>
    <h3>Fiche</h3>
    <div class="tw"><table><thead><tr><th></th><th>A · ${dnLink(A.number)}</th><th>B · ${dnLink(B.number)}</th></tr></thead><tbody>
      ${facts.map(([l, f]) => { const a = String(f(A)), b = String(f(B)); return `<tr><th>${esc(l)}</th><td${a !== b ? ' class="cud"' : ''}>${esc(a)}</td><td${a !== b ? ' class="cud"' : ''}>${esc(b)}</td></tr>`; }).join('')}</tbody></table></div>
    <h3>Départements et droits (${drows.filter(d => !d.same).length} différence${drows.filter(d => !d.same).length > 1 ? 's' : ''} sur ${drows.length})</h3>
    <div class="tw"><table><thead><tr><th>Département</th><th>Magasin</th><th>Rôle de A</th><th>Rôle de B</th><th>Différences de droits</th></tr></thead><tbody>
      ${drows.map(d => `<tr${d.same ? '' : ' class="cur"'}><td>${d.g.name === '__DEFAULT__' ? esc(gLabel(d.g)) : dnLink(d.g.number)}</td><td class="muted">${esc(segShort(SEGOF[d.g.number] || SEG_COMMON))}</td><td>${roleP(d.a)}</td><td>${roleP(d.b)}</td>
        <td style="font-size:12px">${!d.a ? '<span class="pill warn">B seulement</span>' : !d.b ? '<span class="pill warn">A seulement</span>' : d.diff.length ? d.diff.map(k => `<span class="vright">${d.a.eff[k] ? 'A' : 'B'} : ${esc(VR_FR[k])}</span>`).join(' ') : '<span class="muted">identiques</span>'}</td></tr>`).join('')}</tbody></table></div>
    <h3>Ce que chacun voit</h3>
    <div class="grid kpis">${[['Présence : A voit', rel.filter(o => sees(o.ra)).length], ['Présence : B voit', rel.filter(o => sees(o.rb)).length], ['Appels : A voit', rel.filter(o => o.ra.calls.length).length], ['Appels : B voit', rel.filter(o => o.rb.calls.length).length], ['A peut prendre', rel.filter(o => o.ra.ops.length).length], ['B peut prendre', rel.filter(o => o.rb.ops.length).length]]
      .map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:20px">${nf(v)}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    ${listE(presA, `Présence visible par A, pas par B`)}${listE(presB, `Présence visible par B, pas par A`)}${listE(callA, 'Appels visibles par A, pas par B')}${listE(callB, 'Appels visibles par B, pas par A')}${listE(opsA, 'Appels que A peut prendre, pas B')}${listE(opsB, 'Appels que B peut prendre, pas A')}
    ${!presA.length && !presB.length && !callA.length && !callB.length && !opsA.length && !opsB.length ? '<p><span class="pill ok">Même visibilité</span></p>' : ''}
    <h3>Pour que B ait les mêmes accès que A (${todo.length})</h3>
    ${todo.length ? `<div class="card"><ol class="cutodo">${todo.map(t => `<li>${esc(t)}</li>`).join('')}</ol><button class="btn" id="cucopy">Copier la liste</button> <span class="muted" id="cumsg" style="font-size:12.5px"></span></div>` : '<p><span class="pill ok">Rien à faire</span> B a déjà les mêmes départements, rôles, droits, files et groupes que A.</p>'}
    <p class="note">Comparaison faite à partir de la configuration du backup. Les changements se font dans la console 3CX : Utilisateurs → poste → Départements et rôles ; Files d'attente → Agents ; Groupes de sonnerie → Membres.</p></div>`;
  const W = $('#cuwrap');
  W.addEventListener('change', e => { if(e.target.id === 'cua'){ S.a = e.target.value; V.comparer(el); } if(e.target.id === 'cub'){ S.b = e.target.value; V.comparer(el); } });
  W.querySelectorAll('.cuq').forEach(q => q.addEventListener('input', () => { const v = gsNorm(q.value), sel = $(q.dataset.s === 'a' ? '#cua' : '#cub');
    [...sel.options].forEach(o => o.hidden = !!v && !gsNorm(o.text).includes(v)); const first = [...sel.options].find(o => !o.hidden); if(first && v && sel.selectedOptions[0].hidden){ sel.value = first.value; } }));
  W.querySelectorAll('.cuq').forEach(q => q.addEventListener('keydown', e => { if(e.key === 'Enter'){ const sel = $(q.dataset.s === 'a' ? '#cua' : '#cub'); S[q.dataset.s] = sel.value; V.comparer(el); } }));
  $('#cusw').addEventListener('click', () => { [S.a, S.b] = [S.b, S.a]; V.comparer(el); });
  const cp = $('#cucopy'); if(cp) cp.addEventListener('click', async () => { const t = todo.map((x, i) => `${i + 1}. ${x}`).join('\n'); try{ await navigator.clipboard.writeText(t); $('#cumsg').textContent = 'Liste copiée.'; }catch(er){ $('#cumsg').textContent = 'Copie impossible : sélectionnez la liste à la main.'; } });
};

