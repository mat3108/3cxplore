// ---------- Assistant « changement d'un employé » (20.8) : quelqu'un prend la place de quelqu'un, même poste et même téléphone ----------
// Plutôt qu'un départ suivi d'une arrivée : le poste garde tout ce qui pointe vers lui (SDA, menus, files, groupes, droits, touches des collègues,
// téléphone) ; il reste à changer ce qui appartient à la personne (nom, courriel, compte, cellulaire, renvois externes, messagerie).
V.changement = el => {
  const S = window.__ce ||= {seg: SEG && SEG[0] !== '@' ? SEG : '', ext: '', model: '', first: '', last: '', email: ''};
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  if(!stores.includes(S.seg)) S.seg = stores[0] || '';
  const nm = e => (e.first + ' ' + e.last).trim(), byNum = (a, b) => a.number.localeCompare(b.number, undefined, {numeric: true});
  const exts = FULL.extensions.filter(e => SEGOF[e.number] === S.seg).sort(byNum);
  if(!exts.some(e => e.number === S.ext)) S.ext = (exts[0] || {}).number || '';
  const E = EXT_BY[S.ext], models = exts.filter(e => e.number !== S.ext && e.email);
  if(S.model && !models.some(e => e.number === S.model)) S.model = '';
  const M = EXT_BY[S.model], who = `${S.first} ${S.last}`.trim() || 'Nouvel employé';
  const list = (ks, f) => ks.map(k => `<b>${esc(k)}</b> ${esc(f ? f(k) : dnName(k))}`).join(', ');
  const steps = [];
  if(E){
    const refs = dnRefs()[E.number] || [], route = refs.filter(r => r.cat === 'route'), sda = refs.filter(r => r.cat === 'sda'), fwd = refs.filter(r => r.cat === 'fwd'), nIn = route.length + sda.length + fwd.length;
    let W = []; try{ W = [...(blfAnalysis().watchers[E.number] || [])].filter(n => n !== E.number && EXT_BY[n]).sort((a, b) => a.localeCompare(b, undefined, {numeric: true})); }catch(e){}
    const mfa = (() => { try{ return mfaOf(E); }catch(e){ return null; } })();
    const VM = FULL.groups.some(g => g.roles) ? visModel() : {by: {}}, mg = VM.by[E.number] || [];
    const prim = (E.groups.find(g => g.primary) || {}).g;
    // 1. ce qui reste tel quel : tout ce qui est attaché au poste, pas à la personne
    steps.push(['Ce qui ne change pas', 'Rien à faire dans la console : tout cela est attaché au poste, pas à la personne', [
      `Le poste <b>${esc(E.number)}</b> garde son numéro${E.callerId ? ` et son numéro de sortie <b>${esc(phone(E.callerId) || E.callerId)}</b>` : ''}`,
      nIn ? `<b>${nIn}</b> élément${nIn > 1 ? 's' : ''} continue${nIn > 1 ? 'nt' : ''} d'envoyer des appels à ce poste : ${[route.length && `${route.length} menu, département, file ou groupe`, sda.length && `${sda.length} SDA`, fwd.length && `${fwd.length} renvoi${fwd.length > 1 ? 's' : ''} de collègue`].filter(Boolean).join(', ')} — à ne pas toucher`
        : 'Aucun menu, SDA ni renvoi de collègue ne pointe vers ce poste',
      E.queues.length ? `Files d'attente : ${list(E.queues)} — l'employé reste agent` : 'Aucune file d\'attente',
      E.ringGroups.length ? `Groupes de sonnerie : ${list(E.ringGroups)} — l'employé reste membre` : 'Aucun groupe de sonnerie',
      mg.length ? `Départements et rôles : ${mg.map(x => `${x.g.name === '__DEFAULT__' ? esc(gLabel(x.g)) : `<b>${esc(x.g.name)}</b>`} (${esc(VROLE_FR[x.role] || x.role)}${prim === x.g.name ? ', principal' : ''})`).join(', ')} — les mêmes droits que l'ancien employé`
        : 'Aucun département : les droits par défaut',
      W.length ? `<b>${W.length}</b> collègue${W.length > 1 ? 's ont' : ' a'} une touche BLF vers ce poste (${esc(W.join(', '))}) : elle${W.length > 1 ? 's restent' : ' reste'} bonne${W.length > 1 ? 's' : ''}, seul le nom affiché change` : 'Aucun collègue n\'a de touche BLF vers ce poste',
      ...(E.devices.length ? E.devices.map(d => `Téléphone <b>${esc(d.model || d.template)}</b> (gabarit <span class="mono">${esc(d.template || '—')}</span>, MAC <span class="mono">${esc(macFmt(d.mac))}</span>) : reste attribué au poste, avec ses touches programmées`) : ['Aucun téléphone de bureau (application ou client Web seulement)']),
      `Options du poste : enregistrement des appels <b>${E.record ? 'oui' : 'non'}</b>, messagerie vocale <b>${E.vm ? 'activée' : 'désactivée'}</b>, renvois vers la messagerie et les collègues — à garder tels quels`]]);
    // 2. l'identité
    steps.push(['Identité', 'Utilisateurs (Users) → poste → Général (General)', [
      `Prénom : <b>${esc(S.first || '…')}</b> · Nom : <b>${esc(S.last || '…')}</b> <span class="muted">(avant : ${esc(nm(E) || '—')})</span>`,
      `Courriel : <b>${esc(S.email || '…')}</b> <span class="muted">(avant : ${esc(E.email || 'aucun')})</span>`,
      E.mobile ? `Cellulaire : <b>celui du nouvel employé</b>, ou vide <span class="muted">(avant : ${esc(phone(E.mobile) || E.mobile)}, à ne pas laisser)</span>` : 'Cellulaire : celui du nouvel employé, s\'il en a un',
      ...(E.devices.length ? [`Téléphones (Phones) → le téléphone → <b>Reprovisionner</b> (Reprovision) : le nouveau nom s'affiche à l'écran et chez les collègues`] : [])]]);
    // 3. le compte : l'ancien employé ne doit plus pouvoir entrer
    steps.push(['Compte et sécurité', 'Utilisateurs → poste → Général / Sécurité (Security)', [
      '<b>Régénérer le mot de passe</b> (Regenerate) du client Web et de l\'application : l\'ancien employé ne doit plus pouvoir se connecter',
      mfa && mfa.k === 'ms' ? `Compte relié à Microsoft 365${mfa.upn ? ` (${esc(mfa.upn)})` : ''} : <b>délier</b> l'ancien compte, puis relier celui du nouvel employé (Intégrations → Microsoft 365)`
        : mfa && mfa.k === 'on' ? '<b>Réinitialiser la double authentification</b> (2FA) : l\'ancien appareil ne doit plus valider la connexion ; le nouvel employé la réactive à sa première connexion'
        : 'Activer la <b>double authentification</b> (2FA) ou relier le compte à Microsoft 365 avec le nouvel employé',
      'Envoyer le <b>courriel de bienvenue</b> (Send welcome email) au nouveau courriel : il contient les accès au client Web et à l\'application',
      `Réseau local seulement : <b>${E.lanOnly ? 'oui' : 'non'}</b> — ne pas changer`]]);
    // 4. ce qui pointe vers l'ancien employé lui-même : son cellulaire
    const ext = []; E.profiles.forEach(p => p.routes.forEach(([k, d]) => { if(d && d.to === 'External') ext.push(`<b>${esc(FWD_ST[p.name] || p.name)}</b> : ${esc(k.split(' › ').slice(1).join(' / '))} → ${esc(phone(d.ext) || d.ext)}`); }));
    const ringM = E.profiles.filter(p => p.ringMobile === 'True' || p.ringMobile === '1').map(p => FWD_ST[p.name] || p.name);
    steps.push(['Renvois vers l\'extérieur', 'Utilisateurs → poste → Renvois (Forwarding Rules) → chaque statut', ext.length || ringM.length ? [
      ...ext.map(x => `<b>Retirer ou remplacer</b> le renvoi ${x} <span class="muted">(numéro de l'ancien employé)</span>`),
      ...(ringM.length ? [`Le cellulaire sonne aussi (statut${ringM.length > 1 ? 's' : ''} ${esc(ringM.join(', '))}) : il sonnera sur le nouveau cellulaire, ou décocher si le nouvel employé n'en veut pas`] : [])]
      : ['Aucun renvoi vers un numéro externe : rien à retirer ; les renvois vers la messagerie et les collègues restent']]);
    // 5. la messagerie vocale et les enregistrements
    const vms = (FULL.voicemails || []).filter(v => v.ext === E.number).length, gr = (FULL.vmGreetings || []).filter(v => v.ext === E.number).length, recs = (FULL.recordings || []).filter(r => r[1] === E.number).length;
    steps.push(['Messagerie vocale et enregistrements', 'Utilisateurs → poste → Messagerie vocale (Voicemail) ; Enregistrements (Recordings)', [
      '<b>Réinitialiser le NIP</b> de la messagerie vocale (Voicemail PIN) et le remettre au nouvel employé',
      `Messages vocaux dans le backup : <b>${nf(vms)}</b>${vms ? ' — les écouter ou les transmettre, puis les supprimer avant l\'arrivée' : ''}`,
      `Message d'accueil personnel : <b>${nf(gr)}</b>${gr ? ' — à réenregistrer par le nouvel employé, ou remettre le message par défaut' : ' — aucun, le message par défaut reste'}`,
      `Enregistrements d'appels : <b>${nf(recs)}</b>${recs ? ' — ils restent au nom du poste ; vérifier la durée de conservation' : ''}`]]);
    // 6. si le travail change : ce que le collègue modèle a en plus ou en moins
    if(M){
      const items = [], diff = (a, b, lab, f) => { const add = b.filter(x => !a.includes(x)), rem = a.filter(x => !b.includes(x));
        if(add.length) items.push(`${lab} : <b>ajouter</b> ${list(add, f)}`); if(rem.length) items.push(`${lab} : <b>retirer</b> ${list(rem, f)}`); };
      diff(E.queues, M.queues, 'Files d\'attente (Call Queues → file → Agents)'); diff(E.ringGroups, M.ringGroups, 'Groupes de sonnerie (Ring Groups → groupe → Membres)');
      const mm = VM.by[M.number] || [], gn = x => x.g.name === '__DEFAULT__' ? gLabel(x.g) : x.g.name;
      mm.filter(x => !mg.some(y => y.g === x.g)).forEach(x => items.push(`Départements (Groups) : <b>ajouter</b> à <b>${esc(gn(x))}</b> avec le rôle <b>${esc(VROLE_FR[x.role] || x.role)}</b>`));
      mg.filter(x => !mm.some(y => y.g === x.g)).forEach(x => items.push(`Départements (Groups) : <b>retirer</b> de <b>${esc(gn(x))}</b>`));
      mg.filter(x => mm.some(y => y.g === x.g && y.role !== x.role)).forEach(x => { const y = mm.find(y => y.g === x.g); items.push(`Département <b>${esc(gn(x))}</b> : rôle <b>${esc(VROLE_FR[y.role] || y.role)}</b> au lieu de ${esc(VROLE_FR[x.role] || x.role)}`); });
      if(!!E.record !== !!M.record) items.push(`Enregistrement des appels : <b>${M.record ? 'oui' : 'non'}</b> comme ${esc(M.number)}`);
      const kE = new Set((E.blfs || []).filter(b => b.v && b.type !== 'None' && b.type !== 'Line').map(b => b.type + '|' + b.v)), kM = (M.blfs || []).filter(b => b.v && b.type !== 'None' && b.type !== 'Line' && b.v !== E.number && !kE.has(b.type + '|' + b.v)); /* pas de touche vers le poste lui-même */
      if(kM.length) items.push(`Touches du téléphone : <b>${kM.length}</b> touche${kM.length > 1 ? 's' : ''} que ${esc(M.number)} a et pas ce poste <span class="muted">(voir <a href="#blf">Touches BLF</a> : ${kM.slice(0, 4).map(b => esc(blfLabel(b))).join(', ')}${kM.length > 4 ? '…' : ''})</span>`);
      steps.push([`Si le travail change : comme ${M.number} ${nm(M)}`, 'Ce que le collègue modèle a en plus ou en moins que ce poste', items.length ? items : [`Mêmes files, mêmes groupes, mêmes départements et rôles que ${esc(M.number)} : rien à changer`]]);
    } else steps.push(['Si le travail change', 'Files, groupes, départements et touches', ['Le nouvel employé fait le même travail : rien à ajouter ni à retirer. Sinon, choisissez ci-dessus un collègue modèle qui fait le nouveau travail : la fiche dira quoi ajouter et quoi retirer.']]);
    // 7. après
    steps.push(['Après le changement', 'Au prochain backup', [
      `<a href="#historique">Historique d'un employé</a> : vérifier que le poste ${esc(E.number)} porte le nouveau nom et que rien d'autre n'a bougé`,
      `<a href="#securite">Sécurité</a> : plus aucun renvoi vers le cellulaire de l'ancien employé, et le compte protégé (2FA ou Microsoft 365)`]]);
  }
  el.innerHTML = `<div id="cewrap"><h2>Changement d'un employé</h2>
    <p class="lead">Quelqu'un prend la place de quelqu'un : même poste, même téléphone, mêmes files et mêmes droits. Au lieu d'un départ suivi d'une arrivée, l'assistant dit ce qui ne bouge pas et ce qu'il faut changer dans la console 3CX (nom, courriel, compte, cellulaire, renvois, messagerie). Une fiche à cocher et à imprimer, rien n'est modifié dans 3CX ; le nom saisi ici n'est pas conservé.</p>
    <div class="grid two"><div class="card">
      <label class="nvf">Magasin <select id="ceseg">${stores.map(s => `<option value="${esc(s)}"${s === S.seg ? ' selected' : ''}>${esc(segName(s))}</option>`).join('')}</select></label>
      <label class="nvf">Employé remplacé (le poste reste) <select id="ceext">${exts.map(e => `<option value="${esc(e.number)}"${e.number === S.ext ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))}</option>`).join('') || '<option value="">Aucun poste</option>'}</select></label>
      <label class="nvf">Collègue modèle, si le travail change (facultatif) <select id="cemod"><option value="">— même travail que l'employé remplacé —</option>${models.map(e => `<option value="${esc(e.number)}"${e.number === S.model ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))}</option>`).join('')}</select></label></div>
      <div class="card">
      <label class="nvf">Prénom du nouvel employé <input id="cefirst" value="${esc(S.first)}" autocomplete="off"></label>
      <label class="nvf">Nom <input id="celast" value="${esc(S.last)}" autocomplete="off"></label>
      <label class="nvf">Courriel <input id="cemail" value="${esc(S.email)}" autocomplete="off" placeholder="prenom.nom@…"></label></div></div>
    ${E ? `<div class="nvsheet report" id="cesheet"><header class="rpcover"><div class="rpk">Fiche de changement d'employé · 3CXplore</div><h1>${esc(who)} remplace ${esc(nm(E) || E.number)} — poste ${esc(E.number)}</h1>
        <div class="rpmeta">Magasin ${esc(segName(S.seg))}${M ? ` · nouveau travail comme <b>${esc(M.number + ' ' + nm(M))}</b>` : ' · même travail'} · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      ${steps.map(([t, path, items], i) => `<section class="rps"><h2>${i + 1}. ${esc(t)}</h2><div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(path)}</div><ul class="nvck">${items.map(x => `<li><label><input type="checkbox"> <span>${x}</span></label></li>`).join('')}</ul></section>`).join('')}
      <p class="note">Ne supprimez pas le poste et ne créez pas de nouveau poste : tout ce qui pointe vers ${esc(E.number)} (SDA, menus, files, touches des collègues) continuerait de viser un poste vide, et le nouveau n'aurait rien.</p></div>
      <p><button class="btn primary" id="ceprint">Imprimer / PDF</button> <button class="btn" id="cecopy">Copier la fiche</button> <span class="muted" id="cemsg" style="font-size:12.5px"></span></p>` : '<p class="muted">Aucun poste dans ce magasin.</p>'}</div>`;
  const re = () => V.changement(el);
  $('#ceseg').addEventListener('change', e => { S.seg = e.target.value; S.ext = ''; S.model = ''; re(); });
  $('#ceext').addEventListener('change', e => { S.ext = e.target.value; re(); });
  $('#cemod').addEventListener('change', e => { S.model = e.target.value; re(); });
  [['cefirst', 'first'], ['celast', 'last'], ['cemail', 'email']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { S[k] = e.target.value.trim(); re(); }));
  const pr = $('#ceprint'); if(pr) pr.addEventListener('click', () => { printHTML($('#cesheet').outerHTML.replace('id="cesheet"', '')); });
  const cp = $('#cecopy'); if(cp) cp.addEventListener('click', async () => { const t = [`${who} remplace ${nm(E)} — poste ${E.number} (${segName(S.seg)})${M ? `, nouveau travail comme ${M.number} ${nm(M)}` : ''}`, ...steps.map(([t, path, items], i) => `\n${i + 1}. ${t} (${path})\n` + items.map(x => { const t = document.createElement('div'); t.innerHTML = x; return '   [ ] ' + t.textContent; }).join('\n'))].join('\n');
    try{ await navigator.clipboard.writeText(t); $('#cemsg').textContent = 'Fiche copiée.'; }catch(er){ $('#cemsg').textContent = 'Copie impossible.'; } });
};
