// ---------- Liste d'actions pour la console 3CX ----------
const ACT_WHEN = {now: {l: 'Tout de suite', c: 'bad', o: 0}, evening: {l: 'Hors des heures d\'ouverture', c: 'warn', o: 1}, plan: {l: 'À planifier', c: 'acc', o: 2}};
const ACT_KEY = () => 'actions3cx:' + (FULL.info.fqdn || '') + '|' + (FULL.info.date || '');
function actState(){ try{ return JSON.parse(localStorage.getItem(ACT_KEY()) || '{}'); }catch(e){ return {}; } }
function actSave(s){ try{ localStorage.setItem(ACT_KEY(), JSON.stringify(s)); }catch(e){} }
function copyText(t){
  const fb = () => { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(fb); else fb();
}
function buildActions(){
  const A = [];
  const add = t => A.push({items: [], copy: '', ...t});
  const F = analyse(), byId = id => F.find(f => f.id === id);
  const today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ}), in7 = new Date(Date.now() + 7 * 864e5).toLocaleDateString('fr-CA', {timeZone: TZ}); // 18.2.17
  // 1) acheminement cassé ou absent
  const un = byId('unrouted');
  if(un) add({id: 'unrouted', when: 'now', cat: 'Acheminement', title: `Donner une destination à ${un.items.length} SDA non acheminé${un.items.length > 1 ? 's' : ''}`,
    path: 'Console 3CX → section des trunks (Voice & Chat / SIP Trunks) → trunk concerné → règles entrantes (Inbound rules) : créer une règle pour le SDA, ou donner une destination à la règle par défaut du trunk',
    impact: 'Aucun : les appels reçus sur ces numéros ne mènent actuellement nulle part.', why: un.detail, items: un.items, copy: un.items.map(i => i.text).join('\n')});
  const dn = byId('dept-noroute');
  if(dn) add({id: 'dept-noroute', when: 'now', cat: 'Acheminement', title: `Définir l'acheminement de ${dn.items.length} département${dn.items.length > 1 ? 's qui reçoivent' : ' qui reçoit'} des SDA`,
    path: 'Console 3CX → Départements (Departments) → département → Heures de bureau (Office hours) → destinations « ouvert » et « fermé »', impact: 'Aucun.', why: dn.detail, items: dn.items});
  const br = byId('broken');
  if(br) add({id: 'broken', when: 'now', cat: 'Acheminement', title: `Corriger ${br.items.length} destination${br.items.length > 1 ? 's' : ''} vers un élément inexistant`,
    path: 'Console 3CX → élément d\'origine (SDA, département, IVR, file) → destination', impact: 'Aucun.', why: br.detail, items: br.items});
  const qe = byId('q-empty');
  if(qe) add({id: 'q-empty', when: 'now', cat: "Files d'attente", title: `Ajouter des agents à ${qe.items.length} file${qe.items.length > 1 ? 's' : ''} sans agent`,
    path: 'Console 3CX → Files d\'attente (Call Queues) → file → Agents → Ajouter', impact: 'Aucun.', why: qe.detail, items: qe.items});
  if(FULL.calls.length){
    const last = localParts(FULL.calls[0][0])[0], miss = missedAnalysis(addDaysISO(last, -6), last).filter(r => r.st === 'todo');
    if(miss.length) add({id: 'rappels', when: 'now', cat: 'Clients', title: `Rappeler ${miss.length} client${miss.length > 1 ? 's' : ''} sans réponse (7 derniers jours)`,
      path: 'Onglet « Appels manqués » de l\'interface : liste de rappel par magasin (imprimable, export CSV)', impact: 'Aucun sur le système : action de la réception.',
      why: 'Ces clients ont appelé, n\'ont pas obtenu de réponse et n\'ont pas été rappelés depuis.',
      items: miss.sort((a, b) => b.n - a.n).slice(0, 60).map(r => ({html: `<span class="mono">${esc(phone(r.num))}</span> <span class="muted">${esc(segShort(r.seg))} · ${r.n} tentative${r.n > 1 ? 's' : ''}</span>`, text: `${phone(r.num)} ${segShort(r.seg)}`})),
      copy: miss.map(r => phone(r.num)).join('\n')});
  }
  // 2) jours fériés manquants (90 prochains jours), par département
  if(FULL.calls.length){
    const last = localParts(FULL.calls[0][0])[0], d30 = (() => { const x = new Date(last + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 29); return x.toISOString().slice(0, 10); })();
    const H = hoursAnalysis(d30, last).filter(r => r.missingHol.length);
    if(H.length){
      const soon = H.some(r => r.missingHol.some(([, d]) => d <= in7));
      const hols = [...new Set(H.flatMap(r => r.missingHol.map(([n, d]) => `${n} (${d})`)))];
      add({id: 'holidays', when: soon ? 'now' : 'plan', cat: 'Horaires', title: `Ajouter les jours fériés à venir dans ${H.length} département${H.length > 1 ? 's' : ''}`,
        path: 'Console 3CX → Départements (Departments) → département → jours fériés (Holidays) → ajouter chaque date',
        impact: 'Aucun. Sans cela, ces jours-là les appels suivent l\'horaire normal.' + (soon ? ' Un jour férié arrive dans moins de 7 jours.' : ''),
        why: 'Jours fériés à ajouter : ' + hols.join(', ') + '.',
        items: H.map(r => ({html: `${dnLink(r.g.number)} <span class="muted">— ${r.missingHol.map(([n, d]) => esc(n) + ' ' + d.slice(5)).join(', ')}</span>`, text: `${r.g.number} ${r.g.name}`})), copy: hols.join('\n')});
    }
    const hc = byId('hours-closed');
    if(hc) add({id: 'hours-closed', when: 'plan', cat: 'Horaires', title: `Vérifier les horaires de ${hc.items.length} département${hc.items.length > 1 ? 's' : ''} (appels au menu fermé pendant l'ouverture)`,
      path: 'Console 3CX → Départements → département → Heures de bureau et pauses ; vérifier aussi qu\'aucun mode « fermé » n\'a été forcé', impact: 'Aucun.', why: hc.detail, items: hc.items});
  }
  // 3) firmwares : d'abord le serveur, puis les téléphones (par magasin et par modèle)
  const ph = phoneRows(), mods = modelRows(ph), srvBad = mods.filter(m => m.st === 'missing' || m.st === 'srvold');
  srvBad.forEach(m => add({id: 'fwsrv:' + m.model, when: 'evening', cat: 'Téléphones', title: `Rendre disponible le firmware ${m.rec.version} pour les ${m.model} (${m.count})`,
    path: 'Console 3CX → Téléphones (Phones) → sélectionner un ' + m.model + ' → Mettre à jour le firmware (Upgrade firmware) : 3CX télécharge le firmware recommandé. En cas d\'échec, téléverser le fichier officiel.',
    impact: 'Préalable : à faire avant la mise à jour des téléphones de ce modèle (tâches suivantes). Seul le téléphone utilisé pour l\'essai redémarre.', why: `Le firmware recommandé par 3CX (${m.rec.file}) n'est pas sur le serveur.`,
    items: m.rec.url ? [{html: `<a class="dlink" href="${esc(m.rec.url)}" target="_blank" rel="noopener">Fichier officiel : ${esc(m.rec.file)}</a>`, text: m.rec.url}] : []}));
  const todo = ph.filter(r => (r.st === 'old' || r.st === 'unk' || r.st === 'prob') && r.rec && r.mac); // modèles de la liste 3CX, avec une MAC
  const groups = {};
  todo.forEach(r => { const k = (r.seg || SEG_COMMON) + '|' + r.model; (groups[k] ||= []).push(r); });
  Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, rows]) => {
    const [seg, model] = k.split('|'), nOld = rows.filter(r => r.st === 'old').length, nUnk = rows.filter(r => r.st === 'unk').length, nProb = rows.filter(r => r.st === 'prob').length;
    const needsSrv = srvBad.some(m => m.model === model);
    add({id: 'fw:' + k, when: 'evening', cat: 'Téléphones', seg, title: `Mettre à jour le firmware de ${rows.length} ${model} — ${segShort(seg)}`,
      path: 'Console 3CX → Téléphones (Phones) → rechercher chaque MAC (bouton « Copier les MAC ») → cocher → Mettre à jour le firmware (Upgrade firmware)',
      impact: 'Les téléphones redémarrent pendant quelques minutes (appels en cours coupés) : le soir ou la fin de semaine.' + (needsSrv ? ' Faire d\'abord l\'étape « Rendre disponible le firmware » de ce modèle.' : ''),
      why: [nOld && `${nOld} avec un firmware plus ancien que la recommandation`, nUnk && `${nUnk} sans firmware assigné et de version inconnue`, nProb && `${nProb} probablement à jour mais dont le firmware assigné a été effacé`].filter(Boolean).join(' ; ') + '.',
      items: rows.sort((a, b) => a.ext.localeCompare(b.ext)).map(r => ({html: `<span class="mono">${esc(macFmt(r.mac))}</span> ${dnLink(r.ext)} <span class="pill ${PH_ST[r.st].c}">${PH_ST[r.st].l}</span>`, text: `${macFmt(r.mac)} ${r.ext} ${r.user}`})),
      copy: rows.map(r => macFmt(r.mac)).join('\n')});
  });
  // 4) autres réglages
  const vm = byId('vm-off');
  if(vm) add({id: 'vm-off', when: 'plan', cat: 'Postes', title: `Activer la messagerie vocale de ${vm.items.length} poste${vm.items.length > 1 ? 's' : ''} (ou changer leur renvoi)`,
    path: 'Console 3CX → Utilisateurs (Users) → poste → Messagerie vocale (Voicemail) → Activer ; ou onglet Renvois (Forwarding rules) du profil actif',
    impact: 'Aucun. Penser à resélectionner le firmware si l\'onglet Téléphone (IP Phone) est modifié.', why: vm.detail, items: vm.items, copy: vm.items.map(i => i.text.split(' ')[0]).join('\n')});
  // 5) actions issues des analyses récentes (6.4 à 6.20)
  const inSegA = n => !SEG || SEGOF[n] === SEG, who = e => `${e.number} ${(e.first + ' ' + e.last).trim()}`;
  const SA = secAnalysis();
  const admNo = SA.elevated.filter(r => (!SEG || r.seg === SEG) && r.rank >= 5 && !['on', 'ms'].includes(r.fa));
  if(admNo.length) add({id: 'mfa-admin', when: 'now', cat: 'Sécurité', title: `Protéger par MFA ${admNo.length} compte${admNo.length > 1 ? 's' : ''} avec accès complet au système`,
    path: 'Console 3CX → Utilisateurs (Users) → utilisateur → relier le compte Microsoft 365 (synchronisation Microsoft 365 / Entra ID) avec la connexion Microsoft active, ou onglet Sécurité → activer la double authentification (2FA)',
    impact: 'Aucun sur les appels. L\'utilisateur devra valider la double authentification à sa prochaine connexion.', why: 'Ces comptes peuvent tout modifier dans le système et se connectent avec un simple mot de passe 3CX.',
    items: admNo.map(r => ({html: `${dnLink(r.e.number)} <span class="muted">${esc(secRole(r.role)[1])} · ${esc(mfaOf(r.e).why)}</span>`, text: who(r.e)})), copy: admNo.map(r => who(r.e)).join('\n')});
  const named = FULL.extensions.filter(e => inSegA(e.number) && e.email && ['off', 'req'].includes(mfaOf(e).k));
  if(named.length) add({id: 'mfa-named', when: 'plan', cat: 'Sécurité', title: `Relier ${named.length} poste${named.length > 1 ? 's' : ''} nominatif${named.length > 1 ? 's' : ''} à Microsoft 365 (MFA)`,
    path: 'Console 3CX → Intégrations → Microsoft 365 → utilisateurs synchronisés : ajouter ces personnes ; ou Utilisateurs → poste → activer la double authentification',
    impact: 'Aucun sur les appels.', why: 'Postes avec un courriel mais sans MFA (non reliés à Microsoft 365, ou connexion Microsoft désactivée).',
    items: named.slice(0, 80).map(e => ({html: `${dnLink(e.number)} <span class="muted">${esc(e.email)} · ${esc(mfaOf(e).why)}</span>`, text: `${who(e)} <${e.email}>`})), copy: named.map(e => e.email).join('\n')});
  if(SA.intl.length && !SA.intlCalls) add({id: 'intl', when: 'plan', cat: 'Sécurité', title: 'Restreindre la règle sortante des appels internationaux',
    path: 'Console 3CX → Règles sortantes (Outbound Rules) → ' + SA.intl.map(o => o.name).join(', ') + ' → limiter aux postes qui en ont besoin (« Appels depuis les postes ») ou désactiver la règle',
    impact: 'Aucun : aucun appel international dans l\'historique.', why: 'Une règle internationale ouverte à tous les postes expose à la fraude téléphonique si un compte est compromis.',
    items: SA.intl.map(o => ({html: `<b>${esc(o.name)}</b> <span class="muted">préfixe ${esc(o.prefix || '—')} · trunk ${esc(o.routes.map(r => r.gw).join(', ') || '—')}</span>`, text: o.name}))});
  const fwdA = SA.fwd.filter(r => (!SEG || r.seg === SEG) && r.active);
  if(fwdA.length) add({id: 'fwd-ext', when: 'plan', cat: 'Sécurité', title: `Vérifier ${fwdA.length} renvoi${fwdA.length > 1 ? 's' : ''} vers des numéros externes`,
    path: 'Console 3CX → Utilisateurs → poste → Renvois (Forwarding rules) → profil actif',
    impact: 'Aucun si le renvoi est conservé.', why: 'Chaque renvoi externe fait sortir des appels de clients et utilise une ligne : vérifier que ces numéros sont connus et toujours utiles.',
    items: fwdA.map(r => ({html: `${dnLink(r.e.number)} <span class="mono">${esc(r.nums.map(phone).join(', '))}</span> <span class="muted">profil ${esc(r.current)}</span>`, text: `${who(r.e)} → ${r.nums.map(phone).join(', ')}`}))});
  const C6 = ctlRun(), hangs = C6.causes.filter(x => x.key[0] === 'I');
  if(hangs.length) add({id: 'ivr-hang', when: 'plan', cat: 'Menus', title: `Revoir ${hangs.length} menu${hangs.length > 1 ? 's' : ''} qui raccroche${hangs.length > 1 ? 'nt' : ''} quand le client ne choisit rien`,
    path: 'Console 3CX → Standards (Digital Receptionists / IVR) → menu → « Si aucune touche n\'est faite » (Timeout) : renvoyer vers la messagerie ou répéter le message plutôt que raccrocher',
    impact: 'Aucun pendant la modification.', why: 'Dans ces menus (souvent ceux de fermeture), un client qui n\'appuie sur aucune touche est raccroché. Vérifier au moins que le message invite à choisir une option.',
    items: hangs.map(x => { const dn = (x.detail || '').split(' ')[0]; return {html: `${dnLink(dn)} <span class="muted">${x.dids.size} SDA · ${esc([...x.moments].join(', '))}</span>`, text: x.detail}; })});
  const qOff = FULL.queues.filter(q => inSegA(q.number) && q.members.length && !q.members.some(m => !m.status || m.status === 'LoggedIn'));
  if(qOff.length) add({id: 'q-off', when: 'now', cat: "Files d'attente", title: `Connecter au moins un agent dans ${qOff.length} file${qOff.length > 1 ? 's' : ''}`,
    path: 'Application 3CX de l\'agent → statut de file → se connecter à la file ; ou Console 3CX → Files d\'attente → file → Agents',
    impact: 'Aucun.', why: 'Des agents sont membres de ces files, mais aucun n\'est connecté : les appels attendent puis débordent.',
    items: qOff.map(q => ({html: `${dnLink(q.number)} <span class="muted">${q.members.length} membre(s) : ${esc(q.members.map(m => m.dn).join(', '))}</span>`, text: `${q.number} ${q.name}`}))});
  const IDa = indispAnalysis(), solo = IDa.risky.filter(x => x.kind === "File d'attente" && x.on === 1 && x.calls >= 50);
  if(solo.length) add({id: 'q-backup', when: 'plan', cat: "Files d'attente", title: `Ajouter un remplaçant dans ${solo.length} file${solo.length > 1 ? 's' : ''} qui repose${solo.length > 1 ? 'nt' : ''} sur une seule personne`,
    path: 'Console 3CX → Files d\'attente (Call Queues) → file → Agents → Ajouter un agent de relève',
    impact: 'Aucun.', why: 'Une seule personne connectée répond à ces files : son absence ou un appel en cours fait déborder ou perdre les appels.',
    items: solo.map(x => ({html: `${dnLink(x.dn)} <span class="muted">${nf(x.calls)} appels (30 j) · connectée : ${esc(x.onList.join(', '))}</span>`, text: `${x.dn} ${x.name}`}))});
  const effQ = FULL.queues.filter(q => inSegA(q.number)).map(q => { const E = effAnalysis(new Set([q.number]), 8), sl = E.G.flatMap((r, wd) => r.map((c, h) => ({c, wd, h}))).filter(x => x.c.st === 'bad');
    return {q, sl, ab: sl.reduce((a, x) => a + x.c.ab, 0)}; }).filter(x => x.ab * 30 / 56 >= 10).sort((a, b) => b.ab - a.ab);
  if(effQ.length) add({id: 'staff', when: 'plan', cat: 'Effectif', title: `Renforcer ${effQ.length} file${effQ.length > 1 ? 's' : ''} aux heures où les clients raccrochent`,
    path: 'Horaires des agents (hors console) ; pour ajouter des agents : Console 3CX → Files d\'attente → file → Agents',
    impact: 'Aucun.', why: 'Sur ces créneaux, 30 % ou plus des clients raccrochent en attente, ou il manque des agents (onglet Effectif).',
    items: effQ.map(x => ({html: `${dnLink(x.q.number)} <span class="muted">≈ ${nf(Math.round(x.ab * 30 / 56))} abandons / mois · ${esc(x.sl.sort((a, b) => b.c.ab - a.c.ab).slice(0, 3).map(s => EFF_DAYS[s.wd] + ' ' + s.h + ' h').join(', '))}</span>`, text: `${x.q.number} ${x.q.name}`}))});
  return A.sort((a, b) => ACT_WHEN[a.when].o - ACT_WHEN[b.when].o);
}

V.actions = el => {
  const A = buildActions(), S = actState(); S.done ||= {};
  el.innerHTML = `<div id="acwrap"><div class="noprint"><h2>Liste d'actions pour la console 3CX</h2>
    <p class="lead">Les corrections se font dans la console d'administration 3CX : l'interface ne modifie rien sur le serveur. Cette liste traduit les constats en tâches concrètes, dans l'ordre : quoi faire, où cliquer, sur quels éléments exactement, et à quel moment. Cochez les tâches au fur et à mesure (mémorisé dans ce navigateur pour ce backup) ; le backup suivant et l'onglet Comparaison confirmeront les corrections. Les libellés de la console peuvent varier légèrement selon la langue et la version de 3CX.</p>
    <div class="bar"><select id="acw"><option value="">Tous les moments</option>${Object.entries(ACT_WHEN).map(([k, v]) => `<option value="${k}">${v.l}</option>`).join('')}</select>
      <label class="count"><input type="checkbox" id="acdone"> Afficher les tâches faites</label><span style="flex:1"></span>
      <button class="btn" id="acprint">Imprimer / PDF</button></div></div>
    <div id="acprog"></div><div id="aclist"></div>
    <div class="card acnote"><b>Rappel important</b> — Modifier un téléphone dans la console sans resélectionner son firmware efface le firmware assigné${(FULL.fwErased || []).length ? ` <span>(constaté ${(FULL.fwErased || []).length} fois dans le journal d'audit de ce backup)</span>` : ''}<span>. Après toute modification d'un téléphone, relancez « Mettre à jour le firmware ».</span></div></div>`;
  function draw(){
    const w = $('#acw').value, showDone = $('#acdone').checked;
    const list = A.filter(t => (!w || t.when === w) && (showDone || !S.done[t.id]));
    const nDone = A.filter(t => S.done[t.id]).length;
    $('#acprog').innerHTML = `<div class="acp"><div class="acpb"><span style="width:${A.length ? 100 * nDone / A.length : 0}%"></span></div><span>Avancement : ${nDone} / ${A.length}${SEG ? ` · magasin ${esc(segShort(SEG))}` : ''}</span></div>`;
    let lastWhen = '';
    $('#aclist').innerHTML = list.map((t, i) => {
      const head = t.when !== lastWhen ? `<h3 class="acwhen"><span class="pill ${ACT_WHEN[t.when].c}">${ACT_WHEN[t.when].l}</span></h3>` : ''; lastWhen = t.when;
      return head + `<div class="card acard${S.done[t.id] ? ' done' : ''}" data-id="${esc(t.id)}">
        <div class="ach"><label class="accb"><input type="checkbox" data-id="${esc(t.id)}"${S.done[t.id] ? ' checked' : ''}><span class="acn">${A.indexOf(t) + 1}</span></label>
          <div class="act"><div class="actt">${esc(t.title)}</div><div class="muted" style="font-size:12px"><span class="pill">${esc(t.cat)}</span>${t.seg ? `<span class="pill">${esc(segShort(t.seg))}</span>` : ''}</div></div></div>
        <div class="acb"><div class="acrow"><span class="acl">Où</span><span>${esc(t.path)}</span></div>
          <div class="acrow"><span class="acl">Pourquoi</span><span>${esc(t.why)}</span></div>
          <div class="acrow"><span class="acl">Impact</span><span>${esc(t.impact)}</span></div>
          ${t.items.length ? `<div class="acrow"><span class="acl">Éléments (${t.items.length})</span><span class="acitems">${t.items.slice(0, 120).map(x => `<span class="ritem">${x.html}</span>`).join('')}${t.items.length > 120 ? `<span class="muted">+ ${t.items.length - 120} autres</span>` : ''}</span></div>` : ''}
          ${t.copy ? `<div class="noprint" style="margin-top:6px"><button class="btn accopy" data-id="${esc(t.id)}">Copier ${/^fw:/.test(t.id) ? 'les MAC' : 'la liste'}</button> <span class="muted accm" style="font-size:12px"></span></div>` : ''}</div></div>`; }).join('')
      || `<p class="muted">${A.length ? 'Toutes les tâches affichées sont faites. 🎉' : 'Aucune action à faire d\'après ce backup.'}</p>`;
  }
  draw();
  $('#acw').addEventListener('change', draw); $('#acdone').addEventListener('change', draw);
  $('#acwrap').addEventListener('change', e => { const cb = e.target.closest('.accb input'); if(!cb) return; if(cb.checked) S.done[cb.dataset.id] = new Date().toISOString(); else delete S.done[cb.dataset.id]; actSave(S); draw(); });
  $('#acwrap').addEventListener('click', e => { const b = e.target.closest('.accopy'); if(!b) return; const t = A.find(x => x.id === b.dataset.id); copyText(t.copy); const m = b.parentNode.querySelector('.accm'); m.textContent = `${t.copy.split('\n').length} ligne(s) copiée(s)`; setTimeout(() => { m.textContent = ''; }, 2500); });
  $('#acprint').addEventListener('click', () => { document.body.classList.add('printing-report'); window.print(); setTimeout(() => document.body.classList.remove('printing-report'), 500); });
};

