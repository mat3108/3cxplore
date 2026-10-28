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
// touches du téléphone (20.3.2) : ce que le nouveau poste doit recevoir, selon les options cochées
// o.copy = recopier les touches du collègue ; o.dept = touches que presque tout le département a ; o.watch = collègues qui surveillent le collègue modèle
function nvKeys(M, num, o){
  if(!FULL.extensions.some(e => e.blfs)) return {mine: ['Les touches des téléphones sont lues à l\'ouverture du backup : <b>rouvrez le backup</b> pour les voir ici.'], others: []};
  const keyOf = b => b.type + '|' + b.v, show = b => { const t = blfTarget(b); return t && DN[t] ? `${esc((BLF_T[b.type] || [b.type])[0])} : <b>${esc(t)}</b> ${esc(dnName(t))}` : esc(blfLabel(b)); };
  const B = (M.blfs || []).filter(b => b.v && b.type !== 'None' && b.type !== 'Line');
  let bad = []; try{ bad = blfAnalysis().issues.filter(i => i.e === M && (i.k === 'gone' || i.k === 'dup' || i.k === 'self')); }catch(e){}
  const skip = new Set(bad.map(i => i.b)), mine = [], used = new Set(), have = new Set();
  if(o.copy){
    B.filter(b => !skip.has(b)).sort((a, b) => a.no - b.no).forEach(b => { used.add(b.no); have.add(keyOf(b)); mine.push(`Touche <b>${b.no}</b> : ${show(b)}`); });
    if(!B.length) mine.push(`Le collègue ${esc(M.number)} n'a aucune touche programmée.`);
    bad.forEach(i => mine.push(`<span class="muted">Ne pas recopier la touche ${i.b.no || ''} : ${esc(i.t[0].toLowerCase() + i.t.slice(1))}</span>`));
  }
  if(o.dept){
    // comme l'onglet Modèle de touches : touche présente chez au moins 75 % des collègues du même département (même magasin) qui ont des touches
    const seg = SEGOF[M.number], done = new Set(o.copy ? [...have] : []);
    FULL.groups.filter(g => !isSysGroup(g) && g.members.some(m => m.dn === M.number)).forEach(g => {
      const mem = g.members.map(m => EXT_BY[m.dn]).filter(e => e && e !== M && SEGOF[e.number] === seg && (e.blfs || []).some(b => b.v && b.type !== 'None' && b.type !== 'Line'));
      if(mem.length < 3) return;
      const F = {}; mem.forEach(e => { const seen = new Set(); (e.blfs || []).filter(b => b.v && (b.type === 'BLF' || b.type === 'SharedParking' || b.type === 'SpeedDial' || b.type === 'CustomSpeedDial' || b.type === 'ProfileStatus' || b.type === 'QueueLogin')).forEach(b => { const k = keyOf(b); if(seen.has(k)) return; seen.add(k); const f = F[k] ||= {b, n: 0, pos: []}; f.n++; f.pos.push(b.no); }); });
      Object.entries(F).filter(([k, f]) => f.n / mem.length >= .75 && !done.has(k) && !(f.b.type === 'BLF' && (f.b.v === num || !(DN[f.b.v] || FULL.parks.includes(f.b.v))))).sort((a, b) => a[1].pos[0] - b[1].pos[0]).forEach(([k, f]) => {
        done.add(k); f.pos.sort((a, b) => a - b); const at = f.pos[Math.floor(f.pos.length / 2)];
        mine.push(`Touche ${!used.has(at) ? `<b>${at}</b>` : 'libre'} : ${show(f.b)} <span class="muted">(${f.n} des ${mem.length} collègues du département ${esc(g.name)} l'ont${o.copy ? `, pas ${esc(M.number)}` : ''})</span>`); used.add(at); }); });
  }
  if(!mine.length && (o.copy || o.dept)) mine.push('Aucune touche à programmer.');
  const others = [];
  if(o.watch){ let W = []; try{ W = [...(blfAnalysis().watchers[M.number] || [])].filter(n => n !== M.number && EXT_BY[n]).sort((a, b) => a.localeCompare(b, undefined, {numeric: true})); }catch(e){}
    W.forEach(n => others.push(`Chez <b>${esc(n)}</b> ${esc(dnName(n))} : ajouter une touche BLF vers <b>${esc(num)}</b> <span class="muted">(il a déjà une touche vers ${esc(M.number)})</span>`));
    if(!W.length) others.push(`Aucun collègue n'a de touche BLF vers ${esc(M.number)} : rien à ajouter ailleurs.`); }
  return {mine, others};
}
// numéro de sortie (20.6.1) : celui du collègue modèle s'il est un SDA du magasin, sinon le numéro suggéré du magasin ; alerte s'il n'y en a aucun
function nvCid(M, seg){
  const didSeg = cidDidSeg(), mk = normNum(M.callerId), ms = mk ? didSeg[mk] : undefined, out = [];
  if(mk && ms === seg) return [`Numéro de sortie (Outbound Caller ID) : <b>${esc(phone(M.callerId) || M.callerId)}</b> (comme ${esc(M.number)})`];
  const sg = cidForStore(seg, didSeg);
  if(sg){ out.push(`Numéro de sortie (Outbound Caller ID) : <b>${esc(phone(sg.k) || sg.raw)}</b> <span class="muted">(présenté par ${nf(sg.n)} collègue${sg.n > 1 ? 's' : ''} du magasin${sg.did ? '' : ' ; ce n\'est pas un SDA du serveur, à vérifier'})</span>`);
    out.push(mk ? `<span class="pill warn">À ne pas recopier</span> ${esc(M.number)} présente le ${esc(phone(M.callerId) || M.callerId)}, ${ms === undefined ? 'qui n\'est pas un SDA du serveur' : ms[0] === '@' ? 'un SDA qui ne mène à aucun magasin' : `un SDA du magasin ${esc(segShort(ms))}`}.`
      : `<span class="pill warn">À ne pas recopier</span> ${esc(M.number)} n'a pas de numéro de sortie.`);
    return out; }
  const U = urgAnalysis();
  return [`<span class="pill bad">À remplir</span> Numéro de sortie (Outbound Caller ID) : aucun numéro trouvé pour ce magasin. Demandez le SDA principal du magasin : sans numéro, le client et le 911 recevraient ${U.trunkNum ? `le ${esc(phone(U.trunkNum) || U.trunkNum)} du trunk${U.trunkSeg && U.trunkSeg[0] !== '@' ? ` (magasin ${esc(segShort(U.trunkSeg))})` : ''}` : 'le numéro du trunk'}.`];
}
V.nouvel = el => {
  const S = window.__nv ||= {seg: SEG && SEG[0] !== '@' ? SEG : '', model: '', num: '', first: '', last: '', email: ''};
  S.keys ||= {copy: true, watch: true, dept: true}; // 20.3.2 : options des touches du téléphone
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
  const K = M && (S.keys.copy || S.keys.dept || S.keys.watch) ? nvKeys(M, S.num || '…', S.keys) : null;
  const steps = M ? [
    ['Utilisateur', 'Console 3CX → Utilisateurs (Users) → Ajouter', [`Poste : <b>${esc(S.num || '—')}</b>`, `Prénom : <b>${esc(S.first || '…')}</b> · Nom : <b>${esc(S.last || '…')}</b>`, `Courriel : <b>${esc(S.email || '…')}</b>`, ...nvCid(M, S.seg)]],
    ['Sécurité', 'Utilisateurs → poste → Sécurité / Intégrations', [mfa && mfa.k === 'ms' ? 'Relier le compte à <b>Microsoft 365</b> (synchronisation Entra ID) et laisser la connexion Microsoft active : MFA géré par Microsoft' : 'Activer la <b>double authentification</b> (2FA) ou relier le compte à Microsoft 365', `Réseau local seulement : <b>${M.lanOnly ? 'oui' : 'non'}</b>`]],
    ['Départements et rôles', 'Utilisateurs → poste → Départements (Groups)', mg.length ? mg.map(x => `${x.g.name === '__DEFAULT__' ? esc(gLabel(x.g)) : `<b>${esc(x.g.name)}</b>`} — rôle <b>${esc(VROLE_FR[x.role] || x.role)}</b>${(M.groups.find(g => g.primary) || {}).g === x.g.name ? ' <span class="pill">département principal</span>' : ''}${x.own ? ' <span class="pill acc">le collègue a des droits propres ici : à vérifier</span>' : ''}`) : ['Aucun département chez le collègue modèle']],
    ["Files d'attente", "Files d'attente (Call Queues) → file → Agents → Ajouter", M.queues.length ? M.queues.map(q => `<b>${esc(q)}</b> ${esc(dnName(q))}`) : ['Aucune']],
    ['Groupes de sonnerie', 'Groupes de sonnerie (Ring Groups) → groupe → Membres', M.ringGroups.length ? M.ringGroups.map(q => `<b>${esc(q)}</b> ${esc(dnName(q))}`) : ['Aucun']],
    ['Téléphone', 'Téléphones (Phones) → Ajouter → modèle et MAC', M.devices.length ? M.devices.map(d => `Modèle <b>${esc(d.model || d.template)}</b> (gabarit <span class="mono">${esc(d.template || '—')}</span>)${recFor(d.model) ? ` · firmware recommandé <b>${esc(recFor(d.model).version)}</b> : le sélectionner après l'ajout` : ''}`) : ['Aucun téléphone chez le collègue (application ou client Web seulement)']],
    ...(K && (S.keys.copy || S.keys.dept) ? [['Touches du téléphone (BLF)', 'Utilisateurs → poste → Touches BLF (BLF / Programmable keys)', K.mine]] : []),
    ...(K && S.keys.watch ? [['Touches des collègues', 'Utilisateurs → poste du collègue → Touches BLF → Ajouter une touche BLF', K.others]] : []),
    ['Options du poste', 'Utilisateurs → poste → Options', [`Enregistrement des appels : <b>${M.record ? 'oui' : 'non'}</b>`, `Messagerie vocale : <b>${M.vm ? 'activée' : 'désactivée'}</b>`, `Délai sans réponse : <b>${esc((M.profiles.find(p => p.name === 'Available') || {}).noAnswer || M.noAnswer || '—')} s</b>`, fwd ? `Le collègue a un renvoi vers ${esc(fwd.nums.map(phone).join(', '))} : <b>ne pas le recopier</b>, définir celui du nouvel employé s'il y a lieu` : null].filter(Boolean)],
    ["Renvois d'appel selon le statut", 'Utilisateurs → poste → Renvois (Forwarding Rules) → chaque statut', M.profiles.length ? nvForwards(M, S.num || '…') : ['Aucun profil de renvoi chez le collègue : laisser les valeurs par défaut']]] : [];
  el.innerHTML = `<div id="nvwrap"><h2>Nouvel employé</h2>
    <p class="lead">Choisissez le magasin et un collègue qui fait le même travail : l'assistant propose un numéro de poste libre dans la plage du magasin et prépare la fiche complète à saisir dans la console 3CX (départements et rôles, files, groupes, téléphone, touches BLF, sécurité, options, renvois d'appel selon le statut). Rien n'est envoyé ni enregistré : le nom saisi ici n'est pas conservé.</p>
    <div class="grid two"><div class="card">
      <label class="nvf">Magasin <select id="nvseg">${stores.map(s => `<option value="${esc(s)}"${s === S.seg ? ' selected' : ''}>${esc(segName(s))}</option>`).join('')}</select></label>
      <label class="nvf">Collègue modèle <select id="nvmod">${models.map(e => `<option value="${esc(e.number)}"${e.number === S.model ? ' selected' : ''}>${esc(e.number + ' ' + nm(e))}${e.queues.length ? ` · ${e.queues.length} file(s)` : ''}</option>`).join('') || '<option value="">Aucun poste nominatif</option>'}</select></label>
      <label class="nvf">Numéro de poste <select id="nvnum">${free.map(f => `<option value="${esc(f.n)}"${f.n === S.num ? ' selected' : ''}>${esc(f.n)} (libre, plage ${f.block.b}–${f.block.b + 99})</option>`).join('') || '<option value="">Aucun numéro libre trouvé</option>'}</select></label></div>
      <div class="card">
      <label class="nvf">Prénom <input id="nvfirst" value="${esc(S.first)}" autocomplete="off"></label>
      <label class="nvf">Nom <input id="nvlast" value="${esc(S.last)}" autocomplete="off"></label>
      <label class="nvf">Courriel <input id="nvmail" value="${esc(S.email)}" autocomplete="off" placeholder="prenom.nom@…"></label></div></div>
    <div class="card nvkeys"><b>Touches du téléphone (BLF)</b>
      ${[['copy', 'Recopier les touches du collègue modèle', 'à la même position ; les touches cassées ou en double ne sont pas recopiées'], ['dept', 'Ajouter les touches du département', 'celles que presque tous les collègues du département ont (au moins 75 %)'], ['watch', 'Ajouter une touche vers le nouveau poste chez les collègues', 'ceux qui ont déjà une touche BLF vers le collègue modèle']].map(([k, l, d]) => `<label class="nvkey"><input type="checkbox" data-nvkey="${k}"${S.keys[k] ? ' checked' : ''}> <span>${esc(l)} <small class="muted">— ${esc(d)}</small></span></label>`).join('')}</div>
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
  el.querySelectorAll('[data-nvkey]').forEach(c => c.addEventListener('change', () => { S.keys[c.dataset.nvkey] = c.checked; re(); }));
  const pr = $('#nvprint'); if(pr) pr.addEventListener('click', () => { printHTML($('#nvsheet').outerHTML.replace('id="nvsheet"', '')); });
  const cp = $('#nvcopy'); if(cp) cp.addEventListener('click', async () => { const t = [`${who} — poste ${S.num} (${segName(S.seg)}), comme ${M.number} ${nm(M)}`, ...steps.map(([t, path, items], i) => `\n${i + 1}. ${t} (${path})\n` + items.map(x => { const t = document.createElement('div'); t.innerHTML = x; return '   [ ] ' + t.textContent; }).join('\n'))].join('\n'); // 18.1.40 : texte simple
    try{ await navigator.clipboard.writeText(t); $('#nvmsg').textContent = 'Fiche copiée.'; }catch(er){ $('#nvmsg').textContent = 'Copie impossible.'; } });
};

