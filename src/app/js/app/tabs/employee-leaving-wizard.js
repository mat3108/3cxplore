// ---------- Assistant « départ d'un employé » ----------
V.depart = el => {
  const S = window.__dp ||= {seg: SEG && SEG[0] !== '@' ? SEG : '', ext: '', rep: ''};
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  if(!stores.includes(S.seg)) S.seg = stores[0] || '';
  const nm = e => (e.first + ' ' + e.last).trim();
  const byNum = (a, b) => a.number.localeCompare(b.number, undefined, {numeric: true});
  const exts = FULL.extensions.filter(e => SEGOF[e.number] === S.seg).sort(byNum);
  if(!exts.some(e => e.number === S.ext)) S.ext = (exts[0] || {}).number || '';
  const E = EXT_BY[S.ext];
  const reps = FULL.extensions.filter(e => e.number !== S.ext && SEGOF[e.number] === S.seg && e.email).sort(byNum);
  if(S.rep && !reps.some(e => e.number === S.rep)) S.rep = '';
  const RP = EXT_BY[S.rep];
  const to = RP ? `<b>${esc(RP.number)} ${esc(nm(RP))}</b>` : '<b>…</b> (remplaçant à choisir)';
  const refs = E ? (dnRefs()[E.number] || []) : [];
  const steps = [];
  if(E){
    const route = refs.filter(r => r.cat === 'route'), sda = refs.filter(r => r.cat === 'sda'), fwd = refs.filter(r => r.cat === 'fwd');
    steps.push(['Ce qui appelle ce poste', "Menus, départements, files, groupes de sonnerie → destination", route.length ? route.map(r => `${refLine(r)} — remplacer par ${to}`) : ["Aucun menu, département, file ni groupe n'envoie d'appels vers ce poste"]]);
    steps.push(['Numéros entrants (SDA)', 'Trunks (SIP Trunks) → trunk → règles entrantes (Inbound Rules)', sda.length ? sda.map(r => `${refLine(r)} — remplacer par ${to}`) : ['Aucun SDA ne mène directement à ce poste']]);
    steps.push(['Renvois des collègues', 'Utilisateurs → poste du collègue → Renvois (Forwarding Rules)', fwd.length ? fwd.map(r => `${refLine(r)} — remplacer par ${to}`) : ['Aucun collègue ne renvoie ses appels vers ce poste']]);
    steps.push(["Files d'attente", "Files d'attente (Call Queues) → file → Agents / Gestionnaires", E.queues.length || refs.some(r => r.what === 'Gestionnaire de la file') ? [
      ...E.queues.map(q => { const Q = FULL.queues.find(x => x.number === q); const others = Q ? Q.members.filter(m => m.dn !== E.number) : [];
        return `Retirer de ${dnLink(q)}${others.length ? ` <span class="muted">(${others.length} autre${others.length > 1 ? 's' : ''} agent${others.length > 1 ? 's' : ''}, ${others.filter(m => !m.status || m.status === 'LoggedIn').length} connecté${others.filter(m => !m.status || m.status === 'LoggedIn').length > 1 ? 's' : ''})</span>` : ' <span class="pill bad">seul agent de la file : ajouter le remplaçant d\'abord</span>'}${RP ? ` — ajouter ${to}` : ''}`; }),
      ...refs.filter(r => r.what === 'Gestionnaire de la file').map(r => `Retirer comme gestionnaire de ${dnLink(r.from)}${RP ? ` — nommer ${to}` : ''}`)] : ['Aucune file']]);
    steps.push(['Groupes de sonnerie', 'Groupes de sonnerie (Ring Groups) → groupe → Membres', E.ringGroups.length ? E.ringGroups.map(g => { const G = FULL.ringGroups.find(x => x.number === g); const n = G ? G.members.filter(m => m !== E.number).length : 0;
      return `Retirer de ${dnLink(g)}${n ? ` <span class="muted">(${n} autre${n > 1 ? 's' : ''} membre${n > 1 ? 's' : ''})</span>` : ' <span class="pill bad">seul membre du groupe</span>'}${RP ? ` — ajouter ${to}` : ''}`; }) : ['Aucun groupe']]);
    steps.push(['Départements et rôles', 'Utilisateurs → poste → Départements (Groups)', refs.filter(r => r.what === 'Membre du département').map(r => `${dnLink(r.from)} — rôle <b>${esc(r.how)}</b>${/Gestionnaire|Propriétaire|Administrateur|Superviseur|Réceptionniste/.test(r.how) ? ' <span class="pill acc">rôle à transmettre</span>' : ''}`).concat(['Les appartenances disparaissent avec la suppression du poste ; transmettre d\'abord les rôles de gestion au remplaçant']).slice(0, 99)]);
    const vms = (FULL.voicemails || []).filter(v => v.ext === E.number).length, gr = (FULL.vmGreetings || []).filter(v => v.ext === E.number).length, recs = (FULL.recordings || []).filter(r => r[1] === E.number).length;
    steps.push(['Messagerie vocale et enregistrements', 'Utilisateurs → poste → Messagerie vocale ; Enregistrements (Recordings)', [
      `Messages vocaux dans le backup : <b>${nf(vms)}</b>${vms ? ' — les écouter ou les transmettre au gestionnaire avant la suppression' : ''}`,
      `Messages d'accueil personnels : <b>${nf(gr)}</b>`,
      `Enregistrements d'appels : <b>${nf(recs)}</b>${recs ? ' — vérifier la durée de conservation avant de supprimer le poste' : ''}`]]);
    const mfa = (() => { try{ return mfaOf(E); }catch(e){ return null; } })(), ext = E.profiles.some(p => p.routes.some(([, d]) => d.to === 'External'));
    steps.push(['Téléphone et compte', 'Téléphones (Phones) ; Utilisateurs → poste', [
      ...E.devices.map(d => `Téléphone <b>${esc(d.model || d.template)}</b> (gabarit <span class="mono">${esc(d.template || '—')}</span>, MAC <span class="mono">${esc(d.mac)}</span>) — réinitialiser ou réattribuer${RP ? ` à ${to}` : ''}`),
      ...(E.devices.length ? [] : ['Aucun téléphone physique (application ou client Web seulement)']),
      ext ? '<b>Retirer les renvois vers un numéro externe</b> (cellulaire personnel) de tous les statuts' : 'Aucun renvoi externe à retirer',
      E.mobile ? 'Effacer le numéro de cellulaire du poste' : null,
      mfa && mfa.k === 'ms' ? `Compte relié à Microsoft 365 (${esc(mfa.upn || 'Entra ID')}) : la désactivation du compte Microsoft coupe l'accès 3CX ; prévenir le service informatique` : null,
      `Puis supprimer le poste ${esc(E.number)} : le numéro redevient libre dans le plan de numérotation`].filter(Boolean)]);
  }
  const total = refs.filter(r => r.cat !== 'member').length;
  el.innerHTML = `<div id="dpwrap"><h2>Départ d'un employé</h2>
    <p class="lead">Choisissez le poste qui part : l'assistant liste tout ce qui pointe vers lui (menus, départements, files, groupes, SDA, renvois de collègues) et tout ce qu'il faut retirer ou transmettre, avec un remplaçant facultatif. Une fiche à cocher et à imprimer, rien n'est modifié dans 3CX.</p>
    <div class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 16px">
      <label class="nvf">Magasin <select id="dpseg">${stores.map(s => `<option value="${esc(s)}"${s === S.seg ? ' selected' : ''}>${esc(segName(s))}</option>`).join('')}</select></label>
      <label class="nvf">Employé qui part <select id="dpext">${exts.map(e => `<option value="${esc(e.number)}"${e.number === S.ext ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))}</option>`).join('') || '<option value="">Aucun poste</option>'}</select></label>
      <label class="nvf">Remplaçant (facultatif) <select id="dprep"><option value="">— aucun pour l'instant —</option>${reps.map(e => `<option value="${esc(e.number)}"${e.number === S.rep ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))}</option>`).join('')}</select></label></div>
    ${E ? `<div class="nvsheet report" id="dpsheet"><header class="rpcover"><div class="rpk">Fiche de départ · 3CXplore</div><h1>${esc(nm(E) || E.number)} — poste ${esc(E.number)}</h1>
        <div class="rpmeta">Magasin ${esc(segName(S.seg))}${RP ? ` · remplaçant <b>${esc(RP.number + ' ' + nm(RP))}</b>` : ''} · ${total} élément${total > 1 ? 's' : ''} pointe${total > 1 ? 'nt' : ''} vers ce poste · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      ${steps.map(([t, path, items], i) => `<section class="rps"><h2>${i + 1}. ${esc(t)}</h2><div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(path)}</div><ul class="nvck">${items.map(x => `<li><label><input type="checkbox"> <span>${x}</span></label></li>`).join('')}</ul></section>`).join('')}
      <p class="note">Faire les étapes 1 à 3 avant de supprimer le poste : sinon les appels de ces menus, SDA et renvois n'aboutissent plus. Astuce : si le remplaçant arrive tout de suite, il est souvent plus simple de renommer le poste (nom, courriel, téléphone) que de le supprimer.</p></div>
      <p><button class="btn primary" id="dpprint">Imprimer / PDF</button> <button class="btn" id="dpcopy">Copier la fiche</button> <span class="muted" id="dpmsg" style="font-size:12.5px"></span></p>` : '<p class="muted">Aucun poste dans ce magasin.</p>'}</div>`;
  const re = () => V.depart(el);
  $('#dpseg').addEventListener('change', e => { S.seg = e.target.value; S.ext = ''; S.rep = ''; re(); });
  $('#dpext').addEventListener('change', e => { S.ext = e.target.value; re(); });
  $('#dprep').addEventListener('change', e => { S.rep = e.target.value; re(); });
  const pr = $('#dpprint'); if(pr) pr.addEventListener('click', () => { printHTML($('#dpsheet').outerHTML.replace('id="dpsheet"', '')); });
  const cp = $('#dpcopy'); if(cp) cp.addEventListener('click', async () => { const t = [`Départ : ${E.number} ${nm(E)} (${segName(S.seg)})${RP ? `, remplaçant ${RP.number} ${nm(RP)}` : ''}`, ...steps.map(([t, path, items], i) => `\n${i + 1}. ${t} (${path})\n` + items.map(x => { const t = document.createElement('div'); t.innerHTML = x; return '   [ ] ' + t.textContent; }).join('\n'))].join('\n'); // 18.1.40 : texte simple
    try{ await navigator.clipboard.writeText(t); $('#dpmsg').textContent = 'Fiche copiée.'; }catch(er){ $('#dpmsg').textContent = 'Copie impossible.'; } });
};

