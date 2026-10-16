// ---------- Priorités par impact : tous les problèmes, classés selon les appels touchés ----------
function prioAnalysis(){
  const all = FULL.calls, inSeg = n => !SEG || SEGOF[n] === SEG;
  const end = all.length ? all[0][0] : new Date().toISOString(), start = all.length ? all[all.length - 1][0] : end;
  const histDays = Math.max(1, (Date.parse(end) - Date.parse(start)) / 864e5), perMonth = n => Math.round(n * 30 / histDays);
  const lim30 = new Date(Date.parse(end) - 30 * 864e5).toISOString(), last = all.length ? localParts(end)[0] : '';
  const A = [], R = []; // A : appels touchés ; R : autres risques
  const add = (list, o) => list.push(Object.assign({calls: 0, sev: 'fix'}, o));
  // 1) SDA qui perdent des appels (Contrôle des SDA)
  const C = ctlRun();
  C.causes.forEach(x => {
    if(x.sev === 'bad') add(A, {cat: 'Acheminement', title: x.title + (x.detail ? ' — ' + x.detail : ''), calls: perMonth(x.calls), unit: 'appels / mois sur ces SDA',
      detail: `${x.dids.size} SDA (${[...x.dids].slice(0, 4).map(phone).join(', ')}${x.dids.size > 4 ? '…' : ''}) · moments : ${[...x.moments].join(', ')}`, fix: 'Définir une destination (département, menu ou file) pour ces SDA dans la console.', link: 'controle', sev: 'crit'});
  });
  // 2) menus qui raccrochent quand le client ne choisit rien : appels réellement raccrochés dans le menu (30 j)
  const hang = {}; C.causes.filter(x => x.key[0] === 'I').forEach(x => { const dn = (x.detail || '').split(' ')[0]; if(dn) hang[dn] = x; });
  if(Object.keys(hang).length){ const n = {}; all.forEach(c => { if(c[0] < lim30 || c[1] !== 'in' || c[10] !== 'ivr_ab') return; const last2 = c[9][c[9].length - 1]; if(last2 && hang[last2[0]]) n[last2[0]] = (n[last2[0]] || 0) + 1; });
    Object.entries(hang).forEach(([dn, x]) => add(A, {cat: 'Menus', title: `Le menu ${dn} ${dnName(dn)} raccroche si le client ne choisit rien`, calls: n[dn] || 0, unit: 'appels raccrochés dans ce menu (30 j)',
      detail: `${x.dids.size} SDA concernés · moments : ${[...x.moments].join(', ')}`, fix: 'Faire répéter le message ou envoyer vers la messagerie quand le client ne choisit rien (délai du menu).', link: 'menus', sev: n[dn] ? 'fix' : 'obs'})); }
  // 3) files sans agent connecté
  const qc30 = {}; FULL.queueCalls.forEach(r => { if(r[0] >= lim30) (qc30[r[1]] ||= {n: 0, lost: 0}).n++; if(r[0] >= lim30 && !r[6]) qc30[r[1]].lost++; });
  FULL.queues.filter(q => inSeg(q.number) && q.members.length && !q.members.some(m => !m.status || m.status === 'LoggedIn')).forEach(q => add(A, {cat: 'Files', title: `File ${q.number} ${q.name} : aucun agent connecté`, calls: (qc30[q.number] || {n: 0}).n, unit: 'appels dans la file (30 j)',
    detail: `${q.members.length} membre(s), tous déconnectés · si personne ne répond : ${destTxt1(q.dest)}`, fix: 'Reconnecter au moins un agent dans la file, ou retirer la file du parcours.', link: 'indisp', sev: 'crit'}));
  // 4) appels manqués non rappelés (30 j)
  if(last){ const miss = missedAnalysis(addDaysISO(last, -29), last).filter(r => r.st === 'todo' && (!SEG || r.seg === SEG)), by = {};
    miss.forEach(r => { by[r.seg] = (by[r.seg] || 0) + 1; });
    Object.entries(by).forEach(([s, n]) => add(A, {cat: 'Rappels', title: `${segShort(s)} : clients qui ont appelé sans être rappelés`, calls: n, unit: 'clients non rappelés (30 j)',
      detail: 'Appels perdus sans rappel ni nouvel appel servi ensuite.', fix: 'Traiter la liste des appels manqués (onglet Appels manqués) et prévoir un rappel quotidien.', link: 'rappels', sev: n >= 50 ? 'crit' : 'fix'})); }
  // 5) créneaux sous-dotés : appels abandonnés en attente (8 semaines → par mois)
  FULL.queues.filter(q => inSeg(q.number)).forEach(q => { const E = effAnalysis(new Set([q.number]), 8, '80|' + (objFor(SEGOF[q.number], 'wait') || 30)), slots = E.G.flatMap((r, wd) => r.map((c, h) => ({c, wd, h}))).filter(x => x.c.st === 'bad' || x.c.st === 'warn');
    const ab = slots.reduce((a, x) => a + x.c.ab, 0), nd = Math.max(1, Math.round((Date.parse(E.last) - Date.parse(E.first)) / 864e5) + 1); if(ab * 30 / nd < 10) return; // 18.1.8 : jours réellement analysés
    const worst = slots.sort((a, b) => b.c.ab - a.c.ab)[0];
    add(A, {cat: 'Effectif', title: `File ${q.number} ${q.name} : clients qui raccrochent aux heures chargées`, calls: Math.round(ab * 30 / nd), unit: 'appels abandonnés / mois',
      detail: `${slots.length} créneau(x) sous-doté(s), le pire : ${EFF_DAYS[worst.wd]} ${worst.h} h`, fix: 'Ajouter un agent ou une relève sur ces créneaux (onglet Effectif).', link: 'effectif', sev: ab > 60 ? 'crit' : 'fix'}); });
  // 6) jours fériés non configurés : appels attendus le prochain férié
  const today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ}), y0 = +today.slice(0, 4), cfgF = ferCfg();
  const nextH = [...qcHolidays(y0), ...qcHolidays(y0 + 1)].find(h => h[1] >= today && !cfgF.skip.includes(h[0]));
  if(nextH){ const missSeg = {};
    FULL.groups.filter(g => !isSysGroup(g) && !/^___FAVORITES/.test(g.name) && g.routes?.office?.to && g.routes.office.to !== 'None' && g.hours?.type !== 'AllHours' && SEGOF[g.number] !== SEG_BRIDGE && inSeg(g.number))
      .forEach(g => { const sch = deptSchedule(g); if(!sch.isHol(nextH[1]) && sch.per(simWd(nextH[1])).length) (missSeg[SEGOF[g.number] || SEG_COMMON] ||= []).push(g.name); });
    const inc30 = {}; all.forEach(c => { if(c[1] === 'in' && c[0] >= lim30 && c[10] !== 'bridge') { const s = callSeg(c); inc30[s] = (inc30[s] || 0) + 1; } });
    Object.entries(missSeg).forEach(([s, ds]) => add(A, {cat: 'Jours fériés', title: `${segShort(s)} : ${nextH[0]} (${nextH[1]}) non configuré`, calls: Math.round((inc30[s] || 0) / 30), unit: `appels attendus ce jour-là`,
      detail: `${ds.length} département(s) : ${ds.slice(0, 4).join(', ')}${ds.length > 4 ? '…' : ''}`, fix: 'Saisir le jour férié dans ces départements (liste prête dans l\'onglet Jours fériés).', link: 'feries', sev: 'fix'})); }
  // 7) dépendance à une seule personne
  const ID = indispAnalysis();
  // (appels répondus, pas perdus : classé dans les autres risques)
  const dep = ID.risky.filter(x => x.why.some(w => /répond à/.test(w[1]))).sort((a, b) => b.served * b.share - a.served * a.share);
  if(dep.length) add(R, {cat: 'Personnes', title: `${dep.length} file(s) qui reposent sur une seule personne`, detail: dep.slice(0, 5).map(x => `${x.name} → ${x.top} ${dnName(x.top)} (${Math.round(100 * x.share)} %, ${nf(Math.round(x.served * x.share))} appels / 30 j)`).join(' ; ') + (dep.length > 5 ? '…' : ''),
    fix: 'Ajouter un ou une remplaçante dans ces files pour les absences (onglet Personnes indispensables).', link: 'indisp', sev: 'obs'});
  // autres risques (sécurité, matériel, configuration) sans impact direct sur les appels
  const S = secAnalysis(), elevNo = S.elevated.filter(r => (!SEG || r.seg === SEG) && r.rank >= 5 && !['on', 'ms'].includes(r.fa));
  if(elevNo.length) add(R, {cat: 'Sécurité', title: `${elevNo.length} compte(s) avec accès complet au système sans MFA`, detail: elevNo.map(r => r.e.number + ' ' + (r.e.first + ' ' + r.e.last).trim()).join(', '), fix: 'Relier ces comptes à Microsoft 365 avec la connexion Microsoft, ou activer la double authentification 3CX.', link: 'securite', sev: 'crit'});
  const named = FULL.extensions.filter(e => inSeg(e.number) && e.email && !['on', 'ms'].includes(mfaOf(e).k));
  if(named.length) add(R, {cat: 'Sécurité', title: `${named.length} poste(s) nominatif(s) sans MFA`, detail: named.slice(0, 6).map(e => e.number).join(', ') + (named.length > 6 ? '…' : ''), fix: 'Relier ces postes à Microsoft 365 ou activer la double authentification 3CX.', link: 'securite', sev: 'fix'});
  if(S.intl.length && !S.intlCalls) add(R, {cat: 'Sécurité', title: 'Appels internationaux autorisés mais jamais utilisés', detail: S.intl.map(o => o.name).join(', '), fix: 'Désactiver ou restreindre la règle sortante internationale (risque de fraude).', link: 'securite', sev: 'fix'});
  const fwd = S.fwd.filter(r => (!SEG || r.seg === SEG) && r.active);
  if(fwd.length) add(R, {cat: 'Sécurité', title: `${fwd.length} renvoi(s) externe(s) actif(s)`, detail: fwd.slice(0, 5).map(r => r.e.number + ' → ' + r.nums.map(phone).join(', ')).join(' ; '), fix: 'Vérifier que ces numéros sont connus et toujours nécessaires.', link: 'securite', sev: 'obs'});
  const ph = phoneRows(), old = ph.filter(r => r.st === 'old'), er = (FULL.fwErased || []).filter(f => f[2] >= lim30 && inSeg(f[4]));
  if(old.length) add(R, {cat: 'Téléphones', title: `${old.length} téléphone(s) à mettre à jour`, detail: [...new Set(old.map(r => r.model))].join(', '), fix: 'Lancer « Mettre à jour le firmware » dans la console (onglet Téléphones).', link: 'telephones', sev: 'fix'});
  if(er.length) add(R, {cat: 'Téléphones', title: `${er.length} firmware(s) effacé(s) depuis 30 jours`, detail: [...new Set(er.map(f => f[4]))].slice(0, 8).join(', '), fix: 'Relancer « Mettre à jour le firmware » sur ces téléphones après chaque modification.', link: 'telephones', sev: 'obs'});
  analyse().filter(f => f.sev === 'crit' || f.sev === 'fix').forEach(f => { if(/SDA|acheminement|férié|firmware|téléphone|MFA|authentification|aucun agent n'est connecté/i.test(f.title)) return;
    add(R, {cat: f.cat, title: f.title, detail: f.items.slice(0, 4).map(i => i.text).join(' ; ') + (f.items.length > 4 ? '…' : ''), fix: f.reco, link: 'reco', sev: f.sev}); });
  A.sort((a, b) => b.calls - a.calls); const SEVR = {crit: 0, fix: 1, obs: 2}; R.sort((a, b) => SEVR[a.sev] - SEVR[b.sev]);
  return {A, R, histDays};
}
V.priorites = el => {
  const P = prioAnalysis(), SEVL = {crit: ['Critique', 'bad'], fix: ['À corriger', 'warn'], obs: ['Observation', '']};
  const tot = P.A.filter(x => x.unit && /mois|30 j/.test(x.unit)).reduce((a, x) => a + x.calls, 0), mx = Math.max(1, ...P.A.map(x => x.calls));
  const row = (x, i, withCalls) => `<div class="card prio"><div class="prn">${i + 1}</div><div style="flex:1;min-width:0">
      <div><span class="pill ${SEVL[x.sev][1]}">${SEVL[x.sev][0]}</span> <span class="muted" style="font-size:12px">${esc(x.cat)}</span></div>
      <div style="font-weight:600;margin:3px 0">${esc(x.title)}</div><div class="muted" style="font-size:12.5px">${esc(x.detail || '')}</div>
      <div style="font-size:12.5px;margin-top:4px">➜ ${esc(x.fix || '')} <a class="dlink" href="#${esc(x.link)}">ouvrir ▸</a></div></div>
    ${withCalls ? `<div class="prc"><b>${nf(x.calls)}</b><div class="muted" style="font-size:11.5px">${esc(x.unit || '')}</div><div class="prbar"><i style="width:${100 * x.calls / mx}%"></i></div></div>` : ''}</div>`;
  el.innerHTML = `<div id="prwrap"><h2>Priorités</h2>
    <p class="lead">Tous les problèmes trouvés par l'interface${SEG ? ` pour le magasin <b>${esc(segName(SEG))}</b>` : ''}, réunis en une seule liste. D'abord ceux qui font <b>perdre des appels</b>, classés selon le nombre d'appels touchés (ramené à un mois quand l'historique le permet), puis les autres risques (sécurité, téléphones, configuration), classés par gravité.</p>
    <p class="muted" style="font-size:12.5px;margin:0 0 6px">Un même appel peut compter dans plusieurs problèmes (numéro, menu, rappels, effectif) : cette somme sert à comparer les problèmes entre eux. Le nombre réel d'appels perdus est dans l'onglet Statistiques.</p>
    <div class="grid kpis">${[['Problèmes qui touchent des appels', nf(P.A.length), P.A.length ? 'warn' : 'ok'], ['Somme des appels touchés par mois', nf(tot), tot ? 'bad' : 'ok'], ['Autres risques', nf(P.R.length), ''], ['Dont critiques', nf([...P.A, ...P.R].filter(x => x.sev === 'crit').length), 'bad']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <h3>Problèmes qui font perdre des appels (${P.A.length})</h3>
    ${P.A.length ? P.A.map((x, i) => row(x, i, true)).join('') : '<p><span class="pill ok">Aucun</span></p>'}
    <h3>Autres risques (${P.R.length})</h3>
    ${P.R.length ? P.R.map((x, i) => row(x, i, false)).join('') : '<p><span class="pill ok">Aucun</span></p>'}
    <p class="note">Les files qui reposent sur une seule personne sont dans « Autres risques » : leurs appels sont répondus, mais une absence les mettrait en danger. Les volumes viennent de l'historique du backup : appels reçus sur les SDA concernés (ramenés à 30 jours), appels raccrochés dans les menus, appels des files, clients non rappelés et abandons des 30 derniers jours ; pour un jour férié, la moyenne quotidienne des appels du magasin. Ce sont des ordres de grandeur pour décider quoi corriger en premier.</p></div>`;
};

