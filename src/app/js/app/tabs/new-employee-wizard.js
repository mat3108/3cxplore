// ---------- Assistant « nouvel employé » ----------
const FWD_ORDER = Object.keys(FWD_ST);
// une ligne de fiche par statut : où vont les appels, avec le poste du collègue remplacé par le nouveau poste
function nvForwards(M, num){
  const dst = (d, k) => {
    if(k && fwdBusy(k, d)) return '<b>refusé (occupé)</b>';
    if(!d || !d.to || d.to === 'None') return null;
    const n = d.dn === M.number ? num : d.dn, mine = d.dn === M.number;
    if(d.to === 'VoiceMail') return `messagerie vocale de <b>${esc(n || num)}</b>${!mine && d.dn ? ` <span class="muted">(${esc(dnName(d.dn))})</span>` : ''}`;
    if(d.to === 'External'){ const own = M.mobile && String(d.ext).replace(/\D/g, '').endsWith(M.mobile.replace(/\D/g, '').slice(-10));
      return own ? '<b>cellulaire du nouvel employé</b> (à saisir : celui du collègue ne doit pas être recopié)' : `numéro externe <b>${esc(phone(d.ext))}</b> <span class="muted">(à confirmer)</span>`; }
    if(d.dn) return `${esc(TO_FR[d.to] || d.to).toLowerCase()} <b>${esc(n)}</b>${mine ? '' : ` ${esc(dnName(d.dn))}`}`;
    return `<b>${esc((TO_FR[d.to] || d.to).toLowerCase())}</b>`; };
  const COND = {NoAnswer: 'sans réponse', Busy: 'occupé', NotRegistered: 'téléphone non connecté'}, HRS = {AllHours: 'heures d\'ouverture', OutOfOfficeHours: 'hors heures'};
  return M.profiles.slice().sort((a, b) => (FWD_ORDER.indexOf(a.name) + 1 || 99) - (FWD_ORDER.indexOf(b.name) + 1 || 99)).map(p => {
    const r = {}, away = p.routes.some(([k]) => /^AwayRoute/.test(k)); p.routes.forEach(([k, d]) => { const t = k.split(' › '); r[t.slice(1).join('|')] = d; });
    const parts = [];
    if(Object.keys(r).some(k => /^(NoAnswer|Busy|NotRegistered)\|/.test(k))){
      Object.keys(COND).forEach(c => { const all = dst(r[c + '|AllCalls']), int = dst(r[c + '|Internal']);
        if(all || int) parts.push(`${COND[c]}${c === 'NoAnswer' && p.noAnswer ? ` (${esc(p.noAnswer)} s)` : ''} → ${all || '<span class="muted">aucun renvoi</span>'}${int ? ` ; appels internes → ${int}` : ''}`); });
    } else {
      // 19.0.3 : sans renvoi hors heures actif (case décochée), les appels suivent le renvoi des heures d'ouverture à toute heure
      [['External', 'appels externes'], ['Internal', 'appels internes']].forEach(([w, l]) => { const a = dst(r[w + '|AllHours'], away && 'AwayRoute'), o = r[w + '|OutOfOfficeHours'] ? dst(r[w + '|OutOfOfficeHours'], away && 'AwayRoute') : a;
        if(a || o) parts.push(a === o ? `${l} → ${a}` : `${l} : ${HRS.AllHours} → ${a || '<span class="muted">aucun renvoi</span>'}, ${HRS.OutOfOfficeHours} → ${o || '<span class="muted">aucun renvoi</span>'}`); });
    }
    if(p.ringMobile === 'True' || p.ringMobile === '1') parts.push('faire sonner aussi le cellulaire');
    const lab = FWD_ST[p.name] || p.name;
    return `<b>${esc(lab)}</b>${p.display && p.display !== p.name && p.display !== lab ? ` <span class="muted">« ${esc(p.display)} »</span>` : ''}${M.profile === p.name ? ' <span class="pill acc">statut actuel du collègue</span>' : ''} — ${parts.length ? parts.join(' · ') : '<span class="muted">aucun renvoi : les appels sonnent seulement sur le poste</span>'}`;
  });
}
V.nouvel = el => {
  const S = window.__nv ||= {seg: SEG && SEG[0] !== '@' ? SEG : '', model: '', num: '', first: '', last: '', email: ''};
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  if(!stores.includes(S.seg)) S.seg = stores[0] || '';
  const nm = e => (e.first + ' ' + e.last).trim();
  const models = FULL.extensions.filter(e => SEGOF[e.number] === S.seg && e.email).sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  if(!models.some(e => e.number === S.model)) S.model = (models[0] || {}).number || '';
  const M = EXT_BY[S.model], free = freeNumbers(S.seg, 40);
  if(!S.num || numPlan().used[S.num]) S.num = (free[0] || {}).n || '';
  const VM = FULL.groups.some(g => g.roles) ? visModel() : {by: {}}, mg = M ? (VM.by[M.number] || []) : [];
  const fwd = M ? (() => { try{ return secAnalysis().fwd.find(r => r.e === M); }catch(e){ return null; } })() : null;
  const mfa = M ? (() => { try{ return mfaOf(M); }catch(e){ return null; } })() : null;
  const who = `${S.first} ${S.last}`.trim() || 'Nouvel employé';
  const steps = M ? [
    ['Utilisateur', 'Console 3CX → Utilisateurs (Users) → Ajouter', [`Poste : <b>${esc(S.num || '—')}</b>`, `Prénom : <b>${esc(S.first || '…')}</b> · Nom : <b>${esc(S.last || '…')}</b>`, `Courriel : <b>${esc(S.email || '…')}</b>`, `Caller ID sortant : <b>${esc(phone(M.callerId) || 'celui du trunk')}</b> (comme ${esc(M.number)})`]],
    ['Sécurité', 'Utilisateurs → poste → Sécurité / Intégrations', [mfa && mfa.k === 'ms' ? 'Relier le compte à <b>Microsoft 365</b> (synchronisation Entra ID) et laisser la connexion Microsoft active : MFA géré par Microsoft' : 'Activer la <b>double authentification</b> (2FA) ou relier le compte à Microsoft 365', `Réseau local seulement : <b>${M.lanOnly ? 'oui' : 'non'}</b>`]],
    ['Départements et rôles', 'Utilisateurs → poste → Départements (Groups)', mg.length ? mg.map(x => `${x.g.name === '__DEFAULT__' ? esc(gLabel(x.g)) : `<b>${esc(x.g.name)}</b>`} — rôle <b>${esc(VROLE_FR[x.role] || x.role)}</b>${(M.groups.find(g => g.primary) || {}).g === x.g.name ? ' <span class="pill">département principal</span>' : ''}${x.own ? ' <span class="pill acc">le collègue a des droits propres ici : à vérifier</span>' : ''}`) : ['Aucun département chez le collègue modèle']],
    ["Files d'attente", "Files d'attente (Call Queues) → file → Agents → Ajouter", M.queues.length ? M.queues.map(q => `<b>${esc(q)}</b> ${esc(dnName(q))}`) : ['Aucune']],
    ['Groupes de sonnerie', 'Groupes de sonnerie (Ring Groups) → groupe → Membres', M.ringGroups.length ? M.ringGroups.map(q => `<b>${esc(q)}</b> ${esc(dnName(q))}`) : ['Aucun']],
    ['Téléphone', 'Téléphones (Phones) → Ajouter → modèle et MAC', M.devices.length ? M.devices.map(d => `Modèle <b>${esc(d.model || d.template)}</b> (gabarit ${esc(d.template || '—')})${recFor(d.model) ? ` · firmware recommandé <b>${esc(recFor(d.model).version)}</b> : le sélectionner après l'ajout` : ''}`) : ['Aucun téléphone chez le collègue (application ou client Web seulement)']],
    ['Options du poste', 'Utilisateurs → poste → Options', [`Enregistrement des appels : <b>${M.record ? 'oui' : 'non'}</b>`, `Messagerie vocale : <b>${M.vm ? 'activée' : 'désactivée'}</b>`, `Délai sans réponse : <b>${esc((M.profiles.find(p => p.name === 'Available') || {}).noAnswer || M.noAnswer || '—')} s</b>`, fwd ? `Le collègue a un renvoi vers ${esc(fwd.nums.map(phone).join(', '))} : <b>ne pas le recopier</b>, définir celui du nouvel employé s'il y a lieu` : null].filter(Boolean)],
    ["Renvois d'appel selon le statut", 'Utilisateurs → poste → Renvois (Forwarding Rules) → chaque statut', M.profiles.length ? nvForwards(M, S.num || '…') : ['Aucun profil de renvoi chez le collègue : laisser les valeurs par défaut']]] : [];
  el.innerHTML = `<div id="nvwrap"><h2>Nouvel employé</h2>
    <p class="lead">Choisissez le magasin et un collègue qui fait le même travail : l'assistant propose un numéro de poste libre dans la plage du magasin et prépare la fiche complète à saisir dans la console 3CX (départements et rôles, files, groupes, téléphone, sécurité, options, renvois d'appel selon le statut). Rien n'est envoyé ni enregistré : le nom saisi ici n'est pas conservé.</p>
    <div class="grid two"><div class="card">
      <label class="nvf">Magasin <select id="nvseg">${stores.map(s => `<option value="${esc(s)}"${s === S.seg ? ' selected' : ''}>${esc(segName(s))}</option>`).join('')}</select></label>
      <label class="nvf">Collègue modèle <select id="nvmod">${models.map(e => `<option value="${esc(e.number)}"${e.number === S.model ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))}${e.queues.length ? ` · ${e.queues.length} file(s)` : ''}</option>`).join('') || '<option value="">Aucun poste nominatif</option>'}</select></label>
      <label class="nvf">Numéro de poste <select id="nvnum">${free.map(f => `<option value="${esc(f.n)}"${f.n === S.num ? ' selected' : ''}>${esc(f.n)} (libre, plage ${f.block.b}–${f.block.b + 99})</option>`).join('') || '<option value="">Aucun numéro libre trouvé</option>'}</select></label></div>
      <div class="card">
      <label class="nvf">Prénom <input id="nvfirst" value="${esc(S.first)}" autocomplete="off"></label>
      <label class="nvf">Nom <input id="nvlast" value="${esc(S.last)}" autocomplete="off"></label>
      <label class="nvf">Courriel <input id="nvmail" value="${esc(S.email)}" autocomplete="off" placeholder="prenom.nom@…"></label></div></div>
    ${M ? `<div class="nvsheet report" id="nvsheet"><header class="rpcover"><div class="rpk">Fiche de création de poste · 3CXplore</div><h1>${esc(who)} — poste ${esc(S.num || '…')}</h1>
        <div class="rpmeta">Magasin ${esc(segName(S.seg))} · configuré comme <b>${esc(M.number + ' ' + nm(M))}</b> · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      ${steps.map(([t, path, items], i) => `<section class="rps"><h2>${i + 1}. ${esc(t)}</h2><div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(path)}</div><ul class="nvck">${items.map(x => `<li><label><input type="checkbox"> <span>${x}</span></label></li>`).join('')}</ul></section>`).join('')}
      <p class="note">Après la création : vérifier dans l'onglet « Comparer deux utilisateurs » (au prochain backup) que le nouveau poste a les mêmes accès que ${esc(M.number)}.</p></div>
      <p><button class="btn primary" id="nvprint">Imprimer / PDF</button> <button class="btn" id="nvcopy">Copier la fiche</button> <span class="muted" id="nvmsg" style="font-size:12.5px"></span></p>` : '<p class="muted">Aucun collègue modèle dans ce magasin.</p>'}</div>`;
  const re = () => V.nouvel(el);
  $('#nvseg').addEventListener('change', e => { S.seg = e.target.value; S.model = ''; S.num = ''; re(); });
  $('#nvmod').addEventListener('change', e => { S.model = e.target.value; re(); });
  $('#nvnum').addEventListener('change', e => { S.num = e.target.value; re(); });
  [['nvfirst', 'first'], ['nvlast', 'last'], ['nvmail', 'email']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { S[k] = e.target.value.trim(); re(); }));
  const pr = $('#nvprint'); if(pr) pr.addEventListener('click', () => { printHTML($('#nvsheet').outerHTML.replace('id="nvsheet"', '')); });
  const cp = $('#nvcopy'); if(cp) cp.addEventListener('click', async () => { const t = [`${who} — poste ${S.num} (${segName(S.seg)}), comme ${M.number} ${nm(M)}`, ...steps.map(([t, path, items], i) => `\n${i + 1}. ${t} (${path})\n` + items.map(x => { const t = document.createElement('div'); t.innerHTML = x; return '   [ ] ' + t.textContent; }).join('\n'))].join('\n'); // 18.1.40 : texte simple
    try{ await navigator.clipboard.writeText(t); $('#nvmsg').textContent = 'Fiche copiée.'; }catch(er){ $('#nvmsg').textContent = 'Copie impossible.'; } });
};

