// ---------- Recommandations : analyse automatique du backup ----------
const SEV = {crit:{l:'Critique', c:'bad'}, fix:{l:'À corriger', c:'warn'}, obs:{l:'Observation', c:'acc'}};
const NOTE_ST = {todo:'À traiter', doing:'En cours', done:'Corrigé', ignore:'Ignoré'};
const ROUTING_TO = new Set(['Extension','Queue','IVR','RoutePoint','RingGroup']);
const isSystemGroup = g => /^(__|SYSTEM$|FGRP)/.test(g.number + '') || /^(__DEFAULT__|SYSTEM)$/.test(g.name) || /^__FAVORITES/.test(g.name);
const itemDN = n => ({html: dnLink(n), text: n + ' ' + dnName(n)});
const itemDID = d => ({html: `<a class="dlink" href="#diagramme/${esc(d)}" title="Voir le diagramme du flux"><span class="mono">${esc(phone(d))}</span></a>`, text: phone(d)});
const itemTxt = t => ({html: esc(t), text: t});

function analyse(){
  const F = [];
  const add = (id, sev, cat, title, detail, reco, items) => F.push({id, sev, cat, title, detail, reco, items: items || []});

  // --- Références (toutes les destinations configurées) ---
  const refs = []; // {from, label, dest}
  allDIDs.forEach(r => { if(!r.rule) return;
    [['office','ouvert'],['outOfOffice','fermé'],['holidays','fériés']].forEach(([k,l]) => { if(k==='office' || (k==='outOfOffice'&&r.rule.altOOO) || (k==='holidays'&&r.rule.altHol)) refs.push({from:'SDA '+phone(r.did), did:r.did, label:l, dest:r.rule[k]}); }); });
  D.groups.forEach(g => Object.entries(g.routes).forEach(([k,d]) => refs.push({from:g.number, label:k, dest:d})));
  D.ivrs.forEach(i => { i.options.forEach(o => refs.push({from:i.number, label:'touche '+o.key, dest:{to:o.type, dn:o.dn}}));
    if(i.timeoutDN) refs.push({from:i.number, label:'sans choix', dest:{to:i.timeoutType, dn:i.timeoutDN}}); });
  D.queues.forEach(q => refs.push({from:q.number, label:'délai max', dest:q.dest}));
  D.ringGroups.forEach(r => refs.push({from:r.number, label:'sans réponse', dest:r.dest}));

  // 1. SDA non acheminés
  const unrouted = allDIDs.filter(r => !r.rule || !r.rule.office || ['None','ProceedWithNoExceptions'].includes(r.rule.office.to));
  if(unrouted.length) add('unrouted', 'crit', 'Acheminement', `${unrouted.length} SDA sans destination`,
    'Ces numéros n\'ont pas de règle entrante propre, ou leur règle (souvent la règle par défaut « ForwardAll » du trunk) ne mène nulle part : les appels reçus sur ces numéros ne sont pas acheminés.',
    'Créer une règle entrante pour chaque SDA utilisé, ou donner une destination à la règle par défaut du trunk. Retirer du trunk les SDA qui ne sont plus utilisés.',
    unrouted.map(r => itemDID(r.did)));

  // 2. Destinations vers des éléments inexistants
  const broken = refs.filter(x => x.dest && ROUTING_TO.has(x.dest.to) && x.dest.dn && !DN[x.dest.dn]);
  if(broken.length) add('broken', 'crit', 'Acheminement', `${broken.length} destination${broken.length>1?'s':''} vers un élément inexistant`,
    'Ces renvois pointent vers un numéro interne qui n\'existe plus dans la configuration (élément supprimé ou renuméroté).',
    'Corriger chaque destination vers un élément existant.',
    broken.map(x => ({html: `${x.did ? itemDID(x.did).html : dnLink(x.from)} <span class="muted">(${esc(x.label)})</span> → <span class="mono">${esc(x.dest.dn)}</span>`, text: `${x.from} (${x.label}) -> ${x.dest.dn}`})));

  // 3. Files sans agent / sans agent connecté
  const qOff = D.queues.filter(q => q.members.length && q.members.every(m => m.status && m.status !== 'LoggedIn'));
  if(qOff.length) add('q-off', 'fix', "Files d'attente", `${qOff.length} file${qOff.length>1?'s':''} dont aucun agent n'est connecté`,
    'Au moment du backup, tous les agents de ces files étaient déconnectés de la file.',
    'Vérifier que c\'est voulu (file de nuit, file désactivée) ; sinon connecter les agents.',
    qOff.map(q => itemDN(q.number)));

  // 4. Files : abandons et « aucun agent »
  const qAb = D.queues.map(q => ({q, s: D.queueStats[q.number]})).filter(x => x.s && x.s.total >= 20 && x.s.abandoned / x.s.total > 0.2)
    .sort((a,b) => b.s.abandoned/b.s.total - a.s.abandoned/a.s.total);
  if(qAb.length) add('q-abandon', 'fix', "Files d'attente", `${qAb.length} file${qAb.length>1?'s':''} avec plus de 20 % d'appels non servis`,
    'Calculé sur les appels en file présents dans le backup (au moins 20 appels).',
    'Revoir le nombre d\'agents aux heures de pointe, les délais de sonnerie et la destination de débordement.',
    qAb.map(x => ({html: `${dnLink(x.q.number)} <span class="muted">— ${pct(x.s.abandoned, x.s.total)} non servis sur ${nf(x.s.total)}</span>`, text: `${x.q.number} ${x.q.name} : ${Math.round(100*x.s.abandoned/x.s.total)} % sur ${x.s.total}`})));
  const qNA = D.queues.map(q => ({q, s: D.queueStats[q.number]})).filter(x => x.s && x.s.noAgents > 0).sort((a,b) => b.s.noAgents - a.s.noAgents);
  if(qNA.length) add('q-noagents', 'fix', "Files d'attente", `${qNA.length} file${qNA.length>1?'s':''} ont reçu des appels sans aucun agent disponible`,
    '3CX a enregistré des appels arrivés dans la file alors qu\'aucun agent n\'était connecté (« NoAgents »).',
    'Prévoir une destination immédiate quand aucun agent n\'est connecté, ou ajuster les horaires du département.',
    qNA.map(x => ({html: `${dnLink(x.q.number)} <span class="muted">— ${nf(x.s.noAgents)} appel${x.s.noAgents>1?'s':''}</span>`, text: `${x.q.number} ${x.q.name} : ${x.s.noAgents}`})));
  const q1 = D.queues.filter(q => q.members.length === 1);
  if(q1.length) add('q-single', 'obs', "Files d'attente", `${q1.length} file${q1.length>1?'s':''} avec un seul agent`,
    'Si cet agent est absent ou occupé, personne d\'autre ne reçoit l\'appel.',
    'Ajouter un agent de relève ou un débordement court.',
    q1.map(q => ({html: `${dnLink(q.number)} <span class="muted">— ${esc(q.members[0].dn+' '+dnName(q.members[0].dn))}</span>`, text: `${q.number} ${q.name}`})));
  const qNoDest = D.queues.filter(q => q.members.length && (!q.dest || q.dest.to === 'None') && +q.masterTimeout >= 600);
  if(qNoDest.length) add('q-nodest', 'obs', "Files d'attente", `${qNoDest.length} file${qNoDest.length>1?'s':''} sans débordement et avec une attente maximale de 10 min ou plus`,
    'L\'appelant peut attendre longtemps sans autre option.',
    'Envisager un débordement (messagerie, autre file, rappel) après un délai raisonnable.',
    qNoDest.map(q => ({html: `${dnLink(q.number)} <span class="muted">— ${Math.round(q.masterTimeout/60)} min</span>`, text: `${q.number} ${q.name}`})));

  // 5. Renvois vers une messagerie désactivée
  const curProfile = e => e.profiles.find(p => p.name === e.profile) || null;
  const vmOff = D.extensions.filter(e => !e.vm && curProfile(e)?.routes.some(([, d]) => d.to === 'VoiceMail'));
  if(vmOff.length) add('vm-off', 'fix', 'Postes', `${vmOff.length} poste${vmOff.length>1?'s':''} renvoient vers la messagerie alors qu'elle est désactivée`,
    'Dans le profil actuellement actif de ces postes, un renvoi mène à la messagerie vocale, mais la messagerie est désactivée : l\'appelant ne peut pas laisser de message.',
    'Activer la messagerie de ces postes, ou changer la destination de renvoi du profil actif.',
    vmOff.map(e => ({html: `${dnLink(e.number)} <span class="muted">— profil ${esc(fwdName(e.profile))}</span>`, text: `${e.number} ${dnName(e.number)} (${fwdName(e.profile)})`})));

  // 6. MAC en double
  const macs = {}; D.extensions.forEach(e => e.devices.forEach(d => { if(d.mac) (macs[d.mac.toUpperCase()] ||= []).push(e.number); }));
  const dupMac = Object.entries(macs).filter(([, l]) => l.length > 1);
  if(dupMac.length) add('mac-dup', 'fix', 'Téléphones', `${dupMac.length} adresse${dupMac.length>1?'s':''} MAC utilisée${dupMac.length>1?'s':''} par plusieurs postes`,
    'Le même téléphone est provisionné sur plusieurs postes : seul le dernier provisionnement est réellement appliqué.',
    'Garder le téléphone sur un seul poste.',
    dupMac.map(([m, l]) => ({html: `<span class="mono">${esc(m)}</span> → ${l.map(n => dnLink(n)).join(', ')}`, text: `${m} -> ${l.join(', ')}`})));

  // 7. Urgences
  if(!D.outbound.some(o => (o.prefix||'').split(',').some(p => p.trim() === '911')))
    add('no-911', 'crit', 'Sortant', 'Aucune règle sortante pour le 911', 'Aucune règle sortante ne correspond au préfixe 911.', 'Créer une règle prioritaire pour le 911 vers un trunk qui achemine les appels d\'urgence.', []);
  const urg = urgAnalysis(); // 20.6 : numéro envoyé au 911 qui mène à l'adresse d'un autre magasin
  if(urg.bad.length) add('e911', 'crit', 'Sortant', `${urg.bad.length} poste${urg.bad.length>1?'s':''} enverrai${urg.bad.length>1?'ent':'t'} au 911 le numéro d'un autre magasin`,
    'Le service d\'urgence retrouve l\'adresse à partir du numéro reçu : pour ces postes, ce serait l\'adresse d\'un autre magasin.', 'Mettre comme numéro de sortie un SDA du magasin du poste (détail dans l\'onglet Appels au 911).',
    urg.bad.map(x => ({html: dnLink(x.e.number) + ` → <span class="mono">${esc(phone(x.num) || x.num || '—')}</span>${x.ps ? ' (' + esc(segShort(x.ps)) + ')' : ''}`, text: x.e.number + ' ' + dnName(x.e.number)})));

  // 8. Courriel
  if(!D.info.mailHost) add('no-mail', 'fix', 'Système', 'Serveur courriel non configuré', 'Sans serveur courriel, 3CX ne peut pas envoyer les messages vocaux, alertes et rapports.', 'Configurer le serveur SMTP dans les paramètres courriel.', []);

  // --- Accessibilité depuis les SDA ---
  const reach = new Set(); const stack = [];
  const push = n => { if(n && DN[n] && !reach.has(n)){ reach.add(n); stack.push(n); } };
  allDIDs.forEach(r => { if(r.rule) ['office','outOfOffice','holidays'].forEach(k => push(r.rule[k]?.dn)); });
  while(stack.length){ const n = stack.pop(), d = DN[n], o = d.obj;
    if(d.kind==='Département') Object.values(o.routes).forEach(x => push(x?.dn));
    else if(d.kind==='Standard (IVR)'){ o.options.forEach(x => push(x.dn)); push(o.timeoutDN); push(o.invalidDN); }
    else if(d.kind==="File d'attente"){ o.members.forEach(m => push(m.dn)); push(o.dest?.dn); }
    else if(d.kind==='Groupe de sonnerie'){ o.members.forEach(push); push(o.dest?.dn); }
    if(d.kind !== 'Département') try{ ownerBranches(n, o).forEach(([, r]) => push(r.dn)); }catch(e){} } // 18.1.35 : heures du département de la file ou du menu
  const qNo = D.queues.filter(q => !q.members.length), qNoR = qNo.filter(q => reach.has(q.number)), qNoU = qNo.filter(q => !reach.has(q.number));
  if(qNoR.length) add('q-empty', 'crit', "Files d'attente", `${qNoR.length} file${qNoR.length>1?'s':''} d'attente sans aucun agent, atteinte${qNoR.length>1?'s':''} par des appels entrants`,
    'Un parcours d\'appel entrant mène à ces files, mais personne ne peut y répondre : l\'appel attend jusqu\'au délai maximal puis suit le débordement (ou est perdu).',
    'Ajouter des agents, ou modifier les renvois qui mènent à ces files.', qNoR.map(q => itemDN(q.number)));
  if(qNoU.length) add('q-empty-unused', 'obs', "Files d'attente", `${qNoU.length} file${qNoU.length>1?'s':''} d'attente sans agent et non utilisée${qNoU.length>1?'s':''} par les SDA`,
    'Ces files n\'ont aucun agent et aucun parcours d\'appel entrant n\'y mène.', 'Les supprimer si elles ne servent plus.', qNoU.map(q => itemDN(q.number)));
  const orph = [...D.queues.map(q => q.number), ...D.ivrs.map(i => i.number), ...D.ringGroups.map(r => r.number)].filter(n => !reach.has(n));
  if(orph.length) add('orphans', 'obs', 'Acheminement', `${orph.length} file${orph.length>1?'s':''}, standard${orph.length>1?'s':''} ou groupe${orph.length>1?'s':''} jamais atteint${orph.length>1?'s':''} depuis un SDA`,
    'Aucun parcours d\'appel entrant ne mène à ces éléments. Ils peuvent encore servir en composition interne ou en transfert.',
    'Vérifier s\'ils sont encore utiles ; sinon les supprimer pour simplifier la configuration.',
    orph.map(itemDN));

  // 9. Postes sans activité
  const active = new Set();
  D.calls.forEach(c => { active.add(c[2]); active.add(c[4]); active.add(c[6]); c[9].forEach(p => active.add(p[0])); });
  const idle = D.extensions.filter(e => !active.has(e.number));
  if(idle.length) add('idle-ext', 'obs', 'Postes', `${idle.length} poste${idle.length>1?'s':''} sans aucun appel dans l'historique du backup`,
    'Ni appel passé, ni appel reçu ou répondu sur toute la période couverte par l\'historique.',
    'Vérifier si ces postes (et leurs licences) sont encore nécessaires.',
    idle.map(e => itemDN(e.number)));
  const vacant = D.extensions.filter(e => /vacant|libre|test|temp/i.test(e.first + ' ' + e.last));
  if(vacant.length) add('vacant', 'obs', 'Postes', `${vacant.length} poste${vacant.length>1?'s':''} nommé${vacant.length>1?'s':''} « vacant », « test » ou similaire`,
    'Ces postes semblent temporaires ou non attribués.', 'Les réattribuer ou les supprimer.', vacant.map(e => itemDN(e.number)));
  const noCid = noCidRows(); // 20.5.2 : problème à corriger (onglet Sans numéro de sortie)
  if(noCid.length) add('no-cid', 'fix', 'Postes', `${noCid.length} poste${noCid.length>1?'s':''} sans numéro de sortie (Outbound Caller ID)`,
    'Quand ces employés appellent l\'extérieur, c\'est le numéro par défaut du trunk qui s\'affiche chez le client, pas celui de leur magasin.', 'Mettre un SDA de leur magasin comme numéro de sortie (liste et numéro suggéré dans l\'onglet Sans numéro de sortie).',
    noCid.map(x => ({html: dnLink(x.e.number) + (x.sugg ? ` → <span class="mono">${esc(phone(x.sugg.k) || x.sugg.raw)}</span>` : ''), text: x.e.number + ' ' + dnName(x.e.number)})));
  const remote = D.extensions.filter(e => !e.lanOnly);
  if(remote.length) add('remote', 'obs', 'Sécurité', `${remote.length} poste${remote.length>1?'s':''} autorisé${remote.length>1?'s':''} à s'enregistrer hors du réseau local`,
    'L\'option « réseau local seulement » n\'est pas activée : ces postes peuvent s\'enregistrer depuis Internet (télétravail, application mobile).',
    'Normal pour les utilisateurs mobiles ; sinon activer la restriction au réseau local.', remote.map(e => itemDN(e.number)));

  // 10. Firmwares
  const fw = {}; D.extensions.forEach(e => e.devices.forEach(d => { if(d.model && d.firmware) ((fw[d.model] ||= {})[d.firmware] ||= []).push(e.number); }));
  const fwMix = Object.entries(fw).filter(([, v]) => Object.keys(v).length > 1);
  if(fwMix.length) add('fw', 'obs', 'Téléphones', `${fwMix.length} modèle${fwMix.length>1?'s':''} de téléphone avec plusieurs versions de firmware`,
    'Des téléphones du même modèle n\'ont pas tous la même version de firmware.', 'Uniformiser le firmware depuis la console 3CX (mise à jour des téléphones).',
    fwMix.map(([m, v]) => ({html: `<b>${esc(m)}</b> : ${Object.entries(v).map(([f, l]) => `<span class="pill">${esc(f)} × ${l.length}</span>`).join('')}`, text: `${m} : ${Object.entries(v).map(([f, l]) => f+' x'+l.length).join(', ')}`})));

  // 11. Départements
  const depts = D.groups.filter(g => !isSystemGroup(g) && g.members.length);
  const noHol = depts.filter(g => !g.holidays.length);
  if(noHol.length && !FULL.groups.some(g => Array.isArray(g.holidayDates))) add('no-holidays', 'obs', 'Horaires', `${noHol.length} département${noHol.length>1?'s':''} sans jour férié configuré`,
    'Les jours fériés ne sont pas définis : les jours fériés, ces départements suivent leur horaire normal.', 'Ajouter les jours fériés de l\'année (Québec / Canada).', noHol.map(g => itemDN(g.number)));
  const noRoute = depts.filter(g => (!g.routes.office || g.routes.office.to === 'None') && allDIDs.some(r => r.rule?.office?.dn === g.number));
  if(noRoute.length) add('dept-noroute', 'fix', 'Acheminement', `${noRoute.length} département${noRoute.length>1?'s':''} recevant des SDA sans acheminement défini`,
    'Des SDA arrivent sur ces départements, mais aucune destination n\'est définie pour les heures d\'ouverture.', 'Définir la destination des heures d\'ouverture et hors heures.', noRoute.map(g => itemDN(g.number)));

  // 12. Fichiers audio manquants
  const have = new Set(D.prompts.map(p => p.file));
  const used = [];
  D.ivrs.forEach(i => i.prompt && used.push([i.prompt, i.number]));
  D.queues.forEach(q => { if(q.intro && q.introEnabled) used.push([q.intro, q.number]); if(q.moh) used.push([q.moh, q.number]); });
  D.groups.forEach(g => Object.values(g.prompts).forEach(p => p && used.push([p, g.number])));
  const miss = used.filter(([f]) => !have.has(f) && !/^onhold|^default/i.test(f));
  if(miss.length && D.prompts.length) add('audio-miss', 'obs', 'Audio', `${miss.length} fichier${miss.length>1?'s':''} audio référencé${miss.length>1?'s':''} mais absent${miss.length>1?'s':''} du backup`,
    'Ces messages sont configurés, mais le fichier n\'est pas dans le dossier des invites du backup (il peut se trouver dans un jeu d\'invites système).', 'Vérifier que le message joue bien ; sinon le téléverser à nouveau.',
    miss.map(([f, n]) => ({html: `${esc(f)} <span class="muted">—</span> ${dnLink(n)}`, text: `${f} (${n})`})));

  // 13. Activité des appels entrants
  const inc = D.calls.filter(c => c[1]==='in' && (!SEG || callSeg(c) === SEG)), st = {}; inc.forEach(c => st[c[10]] = (st[c[10]]||0)+1); // 18.1.17
  if(inc.length){
    const lost = (st.q_ab||0) + (st.ivr_ab||0) + (st.miss||0) + (st.fwd_no||0) + (st.park_ab||0), base = inc.length - (st.bridge||0) || 1; // 18.1.16 : hors transferts vers un autre 3CX, comme les Statistiques
    add('lost', lost/base > 0.1 ? 'fix' : 'obs', 'Appels', `${pct(lost, base)} des appels entrants n'aboutissent pas`,
      `Sur ${nf(base)} appels entrants (hors transferts vers un autre 3CX) : ${nf(st.q_ab||0)} abandons en file, ${nf(st.ivr_ab||0)} raccrochés au menu, ${nf(st.fwd_no||0)} renvois externes sans réponse, ${nf(st.park_ab||0)} raccrochés en parking, ${nf(st.miss||0)} non répondus.`,
      'Analyser les heures de pointe (tableau de bord) et les files concernées (onglet Appels en file).', []);
    const top = {}; inc.filter(c => c[10]==='fwd_no').forEach(c => { const k = c[9].length ? c[9][c[9].length-1][0] : c[4]; top[k] = (top[k]||0)+1; });
  }

  // 14. Sécurité : connexions administrateur
  const logins = D.audit.filter(a => a[1]==='Connexion');
  const pubIps = [...new Set(logins.map(a => a[5]).filter(ip => ip && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(ip)))];
  if(pubIps.length) add('admin-ip', 'obs', 'Sécurité', `Connexions à la console depuis ${pubIps.length} adresse${pubIps.length>1?'s':''} IP publique${pubIps.length>1?'s':''}`,
    'Adresses Internet depuis lesquelles quelqu\'un s\'est connecté à la console d\'administration (journal d\'audit).', 'Vérifier que ces adresses sont connues ; restreindre l\'accès à la console par IP si possible.',
    pubIps.map(ip => { const l = logins.filter(a => a[5]===ip); return {html: `<span class="mono">${esc(ip)}</span> <span class="muted">— ${l.length} connexion${l.length>1?'s':''}, ${esc([...new Set(l.map(a => a[3]))].join(', '))}</span>`, text: `${ip} (${l.length})`}; }));
  const rec = D.extensions.filter(e => e.record).length;
  add('recording', 'obs', 'Système', `Enregistrement des appels activé sur ${rec} poste${rec>1?'s':''} sur ${D.extensions.length}`,
    D.recInBackup ? `${nf(D.recordings.length)} enregistrements sont référencés dans le backup, dont ${nf(D.recInBackup)} avec leur fichier audio.` : `${nf(D.recordings.length)} enregistrements sont référencés dans le backup ; les fichiers audio eux-mêmes n'y sont pas.`, 'Vérifier l\'espace disque et la durée de conservation des enregistrements sur le serveur.', []);

  const ph = phoneRows(), phOld = ph.filter(r => r.st === 'old'), phUnk = ph.filter(r => r.st === 'unk'), phMods = modelRows(ph);
  const srvBad = phMods.filter(m => m.st === 'missing' || m.st === 'srvold');
  if(srvBad.length) add('fw-server', 'fix', 'Téléphones', `${srvBad.length} modèle${srvBad.length>1?'s':''} de téléphone sans le firmware recommandé par 3CX sur le serveur`,
    `Le firmware recommandé par 3CX (liste du ${FW_REF.date}) pour ces modèles n'est pas présent sur le serveur, ou une version plus ancienne s'y trouve.`,
    'Lancer « Mettre à jour le firmware » sur ces téléphones depuis la console 3CX (le firmware recommandé est alors téléchargé), ou téléverser le fichier officiel (lien dans l\'onglet Téléphones).',
    srvBad.map(m => ({html: `<b>${esc(m.model)}</b> <span class="muted">— ${m.count} téléphone${m.count>1?'s':''} · recommandé ${esc(m.rec.version)} · serveur ${m.srv ? esc(fwVersion(m.srv)) : 'aucun'}</span>`, text: `${m.model} (${m.count}) : recommandé ${m.rec.version}, serveur ${m.srv ? fwVersion(m.srv) : 'aucun'}`})));
  if(phOld.length) add('fw-old', 'fix', 'Téléphones', `${phOld.length} téléphone${phOld.length>1?'s':''} avec un firmware plus ancien que la version recommandée par 3CX`,
    `Comparaison avec la liste officielle 3CX du ${FW_REF.date}.`,
    'Lancer « Mettre à jour le firmware » depuis la console 3CX, de préférence hors des heures d\'ouverture.',
    phOld.map(r => ({html: `${dnLink(r.ext)} <span class="muted">— ${esc(r.model)} ${esc(fwVersion(r.fw))} → ${esc(r.rec)}</span>`, text: `${r.ext} ${r.user} : ${r.model} ${r.fw} -> ${r.rec}`})));
  // 19.0.1 : téléphones dans une autre langue que le français
  const phLng = ph.filter(r => phLangBad(r.lang));
  if(phLng.length) add('ph-lang', 'fix', 'Téléphones', `${phLng.length} téléphone${phLng.length>1?'s':''} dans une autre langue que le français`,
    'La langue de l\'affichage du téléphone (menus, touches, messages) n\'est pas le français.',
    'Dans la console 3CX → Téléphones, ouvrir le téléphone, choisir la langue Français, enregistrer puis reprovisionner le téléphone.',
    phLng.map(r => ({html: `${dnLink(r.ext)} <span class="muted">— ${esc(r.model)} · </span><span class="phlang-bad">${esc(phLang(r.lang))}</span>`, text: `${r.ext} ${r.user} : ${r.model} en ${phLang(r.lang)}`})));
  const phProb = ph.filter(r => r.st === 'prob');
  if(phProb.length) add('fw-prob', 'obs', 'Téléphones', `${phProb.length} téléphone${phProb.length>1?'s':''} probablement à jour mais dont le firmware a été effacé`,
    'Le firmware recommandé leur avait été assigné, puis il a été effacé lors d\'une modification du téléphone dans la console. Ils l\'ont très probablement installé, mais 3CX ne le réinstallera plus en cas de réinitialisation.',
    'Relancer « Mettre à jour le firmware » sur ces téléphones pour rétablir l\'assignation (sans effet s\'ils sont déjà à jour).',
    phProb.map(r => ({html: `${dnLink(r.ext)} <span class="muted">— ${esc(r.model)} · ${esc(fwVersion(r.er[1]))} effacé le ${esc(fmtD(r.er[2]))} par ${esc(r.er[3])}</span>`, text: `${r.ext} ${r.user} : ${r.er[1]} effacé le ${fmtD(r.er[2])} par ${r.er[3]}`})));
  if(phUnk.length) add('fw-unk', 'fix', 'Téléphones', `${phUnk.length} téléphone${phUnk.length>1?'s':''} dont la version de firmware est inconnue`,
    'Aucun firmware n\'est assigné à ces téléphones et aucune version n\'a été observée (ni dans les rapports de qualité d\'appel, ni dans un historique d\'effacement) : ils ont probablement leur firmware d\'usine.',
    'Sélectionner ces téléphones dans la console 3CX (Téléphones) et lancer « Mettre à jour le firmware » ; après toute modification d\'un téléphone, refaire cette action.',
    phUnk.map(r => ({html: `${dnLink(r.ext)} <span class="muted">— ${esc(r.model)} · ${esc(macFmt(r.mac))}</span>`, text: `${r.ext} ${r.user} : ${r.model} ${macFmt(r.mac)}`})));
  if(FULL.calls.length){
    const last = localParts(FULL.calls[0][0])[0], d30 = (() => { const x = new Date(last + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 29); return x.toISOString().slice(0, 10); })();
    const H = hoursAnalysis(d30, last), cwo = H.filter(r => r.closedWhileOpen.length), mh = H.filter(r => r.missingHol.length);
    if(cwo.length) add('hours-closed', 'fix', 'Horaires', `${cwo.length} département${cwo.length>1?'s':''} ont envoyé des appels au menu fermé pendant leurs heures d'ouverture`,
      'Sur les 30 derniers jours du backup, des appels entrants ont pris la branche « fermé » (ou pause) alors que l\'horaire configuré indiquait ouvert.',
      'Vérifier les horaires du département, un éventuel mode « fermé » forcé manuellement, ou un jour férié non configuré (détail dans l\'onglet Horaires).',
      cwo.map(r => ({html: `${dnLink(r.g.number)} <span class="muted">— ${r.closedWhileOpen.length} appel${r.closedWhileOpen.length>1?'s':''}</span>`, text: `${r.g.number} ${r.g.name} : ${r.closedWhileOpen.length}`})));
    if(mh.length) add('hours-holidays', 'fix', 'Horaires', `Jours fériés à venir non configurés dans ${mh.length} département${mh.length>1?'s':''}`,
      'Jours fériés du Québec des 90 prochains jours absents des horaires de ces départements : ces jours-là, les appels suivront l\'horaire normal.',
      'Ajouter les jours fériés dans les horaires des départements (console 3CX → Départements → Jours fériés).',
      mh.map(r => ({html: `${dnLink(r.g.number)} <span class="muted">— ${r.missingHol.map(([n, d]) => esc(n) + ' ' + d.slice(5)).join(', ')}</span>`, text: `${r.g.number} ${r.g.name} : ${r.missingHol.map(([n, d]) => n + ' ' + d).join(', ')}`})));
  }
  // 15. (20.9) Postes 1000 à 1005 réservés aux comptes de l'intégrateur. Son nom n'est pas écrit dans le code :
  //     on compare l'empreinte FNV-1a de chaque suite de 8 lettres du prénom et du nom à celle du nom de l'intégrateur.
  const fnv = s => { let h = 0x811c9dc5; for(let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0; return h; };
  const INTEG = [0x0d6d2797, 8], isInteg = e => { const w = `${e.first || ''}${e.last || ''}`.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
    for(let i = 0; i + INTEG[1] <= w.length; i++) if(fnv(w.slice(i, i + INTEG[1])) === INTEG[0]) return true; return false; };
  const onlyDefault = e => (e.groups || []).length === 1 && e.groups[0].g === '__DEFAULT__';
  const resv = D.extensions.filter(e => /^\d+$/.test(e.number) && +e.number >= 1000 && +e.number <= 1005 && !isInteg(e) && onlyDefault(e));
  if(resv.length) add('reserved-1000', 'fix', 'Postes', `${resv.length} poste${resv.length>1?'s':''} de 1000 à 1005 utilisé${resv.length>1?'s':''} par un autre usager que l'intégrateur`,
    'Les postes 1000 à 1005 sont réservés aux comptes de l\'intégrateur. Ceux-ci portent le nom d\'un autre usager et ne sont que dans le département par défaut.',
    'Renuméroter ces usagers hors de la plage 1000 à 1005, ou rendre le poste au compte de l\'intégrateur (console 3CX → Utilisateurs).',
    resv.map(e => ({html: `${dnLink(e.number)} <span class="muted">— ${esc((e.first + ' ' + e.last).trim() || 'sans nom')}, département par défaut seulement</span>`, text: `${e.number} ${(e.first + ' ' + e.last).trim()}`})));
  const order = {crit:0, fix:1, obs:2};
  return F.sort((a,b) => order[a.sev]-order[b.sev]);
}

