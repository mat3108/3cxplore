// ---------- Messageries vocales (15.13) : boîtes, envoi par courriel, annonces, messages conservés, consultation et acheminements qui y mènent ----------
const VM_MAIL = {None: 'conservés sur le serveur', Notification: 'avis par courriel, conservés sur le serveur', Attachment: 'joints au courriel et conservés', AttachmentAndDelete: 'joints au courriel puis supprimés'};
const VM_FLAG = {off: ['Désactivée mais visée', 'bad'], nomail: ['Courriel impossible', 'bad'], offown: ['Renvoi vers une messagerie désactivée', 'warn'], old: ['Messages en attente', 'warn'], nocheck: ['Jamais consultée', 'warn'], nogreet: ['Annonce standard', ''], ok: ['Rien à signaler', 'ok']};
const VM_ORD = ['off', 'nomail', 'old', 'nocheck', 'offown', 'nogreet', 'ok'];
const VM_KEY = 'messageries3cx';
// tout ce qui mène à une messagerie vocale : menus, départements, files, groupes, SDA, renvois des postes (le sien et ceux des collègues)
function vmRefs(){
  const R = {}, add = (n, r) => { if(n) (R[n] ||= []).push(r); }, isVM = d => d && d.to === 'VoiceMail';
  const GR = {office: "heures d'ouverture", outOfOffice: 'hors heures', break: 'pause', holidays: 'jours fériés'};
  FULL.ivrs.forEach(i => {
    i.options.forEach(o => { if(o.type === 'VoiceMail') add(o.dn, {cat: 'route', from: i.number, what: `Touche ${o.key} du menu`}); });
    if(i.timeoutType === 'VoiceMail') add(i.timeoutDN, {cat: 'route', from: i.number, what: 'Sans choix (délai) du menu'});
    Object.entries(i.routes || {}).forEach(([k, d]) => { if(isVM(d)) add(d.dn, {cat: 'route', from: i.number, what: `Acheminement ${GR[k] || k} du menu`}); }); });
  FULL.groups.filter(g => !isSysGroup(g)).forEach(g => Object.entries(g.routes).forEach(([k, d]) => { if(isVM(d)) add(d.dn, {cat: 'route', from: g.number, what: `Acheminement ${GR[k] || k} du département`}); }));
  FULL.queues.forEach(q => { if(isVM(q.dest)) add(q.dest.dn || q.number, {cat: 'route', from: q.number, what: 'Débordement de la file'});
    Object.entries(q.routes || {}).forEach(([k, d]) => { if(isVM(d)) add(d.dn, {cat: 'route', from: q.number, what: `Acheminement ${GR[k] || k} de la file`}); }); });
  FULL.ringGroups.forEach(r => { if(isVM(r.dest)) add(r.dest.dn || r.number, {cat: 'route', from: r.number, what: 'Sans réponse du groupe de sonnerie'}); });
  // son propre renvoi : seulement dans le profil actif (les autres profils gardent souvent le renvoi par défaut de 3CX)
  FULL.extensions.forEach(e => { const oth = new Set(); let own = false;
    e.profiles.forEach(p => p.routes.forEach(([, d]) => { if(!isVM(d)) return; const n = d.dn || e.number; if(n !== e.number) oth.add(n); else if(p.name === e.profile) own = true; }));
    if(own) add(e.number, {cat: 'own', from: e.number, what: `Renvoi du profil actif (${e.profile}) vers sa propre messagerie`});
    oth.forEach(n => add(n, {cat: 'fwd', from: e.number, what: 'Renvoi du collègue'})); });
  FULL.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(did => { const r = by[did] || def; if(!r) return; ['office', 'outOfOffice', 'holidays'].forEach(k => { if(isVM(r[k])) add(r[k].dn, {cat: 'sda', from: l.number, did, what: `SDA ${phone(did)}`, hrs: GR[k]}); }); }); });
  return R;
}
function vmAnalysis(){
  const all = FULL.calls, histEnd = all.length ? all[0][0] : new Date().toISOString(), ref = Date.parse(histEnd);
  const R = vmRefs(), mailOK = !!(FULL.info.mailHost || '').trim();
  // 18.1.46 : heure du message lue dans le fuseau du système 3CX
  const vmIso = s => vmUTC(s); // 18.2.1 : heure du nom de fichier en UTC
  // consultation : appel interne vers la console de messagerie depuis le poste
  const chk = {}; for(const c of all) if(c[1] === 'int' && c[9].some(p => p[1] === 'vmail_console')){ /* 18.1.1 : consultation = appel vers la console de messagerie */ const x = chk[c[2]] ||= {n: 0, last: ''}; x.n++; if(c[0] > x.last) x.last = c[0]; }
  const msgs = {}; (FULL.voicemails || []).forEach(v => (msgs[v.ext] ||= []).push({...v, iso: vmIso(v.date)}));
  const greet = {}; (FULL.vmGreetings || []).forEach(g => (greet[g.ext] ||= []).push(g));
  const nums = new Set([...FULL.extensions.filter(e => e.vm).map(e => e.number), ...Object.keys(R), ...Object.keys(msgs), ...Object.keys(greet)]);
  const EXT = Object.fromEntries(FULL.extensions.map(e => [e.number, e]));
  const rows = [...nums].filter(n => DN[n] || EXT[n]).map(n => {
    const e = EXT[n], refs = R[n] || [], others = refs.filter(r => r.cat !== 'own'), m = (msgs[n] || []).sort((a, b) => a.iso < b.iso ? -1 : 1), g = greet[n] || [];
    const custom = g.filter(x => !/^self_id_prompt/i.test(x.file)).length, nameRec = g.some(x => /^self_id_prompt/i.test(x.file));
    const oldest = m.length && m[0].iso ? Math.max(0, Math.floor((ref - Date.parse(m[0].iso)) / 864e5)) : null;
    const opt = e ? e.vmEmail || 'None' : '', viaMail = e && /^Attachment/.test(opt), ck = chk[n] || null;
    const flags = [];
    if(e && !e.vm && others.length) flags.push('off');
    if(e && e.vm && opt !== 'None' && (!e.email || !mailOK)) flags.push('nomail');
    if(e && !e.vm && !others.length && refs.length) flags.push('offown');
    if(m.length && oldest != null && oldest >= 14) flags.push('old');
    if(e && e.vm && !viaMail && others.length && !ck) flags.push('nocheck');
    if((e ? e.vm : true) && refs.some(r => r.cat === 'route' || r.cat === 'sda') && !custom) flags.push('nogreet');
    if(!flags.length) flags.push('ok');
    return {n, e, kind: e ? 'Poste' : (DN[n] ? DN[n].kind : ''), seg: SEGOF[n] || SEG_COMMON, on: e ? e.vm : null, opt, refs, others, m, oldest, custom, nameRec, ck, flags, top: flags[0]};
  });
  return {rows, mailOK, histEnd, histStart: all.length ? all[all.length - 1][0] : histEnd, R};
}
V.messageries = el => {
  const A = vmAnalysis(), rows = A.rows.filter(x => !SEG || x.seg === SEG);
  let S = {only: 'pb'}; try{ S = {...S, ...JSON.parse(localStorage.getItem(VM_KEY) || '{}')}; }catch(e){}
  const cnt = k => rows.filter(x => x.flags.includes(k)).length, visees = rows.filter(x => x.others.length).length, nMsg = rows.reduce((a, x) => a + x.m.length, 0);
  const shown = S.only === 'pb' ? rows.filter(x => x.top !== 'ok') : rows;
  const refTxt = x => { const by = {}; x.refs.forEach(r => by[r.cat] = (by[r.cat] || 0) + 1);
    return [['sda', 'SDA', 'SDA'], ['route', 'acheminement', 'acheminements'], ['fwd', 'renvoi de collègue', 'renvois de collègues'], ['own', 'son renvoi']].filter(([k]) => by[k]).map(([k, l, pl]) => k === 'own' ? l : `${by[k]} ${by[k] > 1 ? pl : l}`).join(' · '); };
  el.innerHTML = `<div id="vmwrap"><h2>Messageries vocales</h2>
    <p class="lead">Chaque boîte vocale : activée ou non, envoi des messages par courriel, annonce d'accueil, messages encore conservés sur le serveur, dernière consultation depuis le poste, et tout ce qui y mène dans l'acheminement${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    ${A.mailOK ? '' : '<div class="card" style="border-left:4px solid var(--bad)"><b>Aucun serveur courriel configuré.</b> <span class="muted">3CX ne peut envoyer ni les messages vocaux ni les avis par courriel : les messages restent sur le serveur, ou sont perdus avec l\'option « joints au courriel puis supprimés ».</span></div>'}
    <div class="grid kpis">${[['Boîtes', nf(rows.length), ''], ['Visées par un acheminement ou un renvoi', nf(visees), ''], ['Désactivées mais visées', nf(cnt('off')), cnt('off') ? 'bad' : ''], ['Renvois vers une messagerie désactivée', nf(cnt('offown')), cnt('offown') ? 'warn' : ''], ['Courriel impossible', nf(cnt('nomail')), cnt('nomail') ? 'bad' : ''], ['Messages en attente (14 j et plus)', nf(cnt('old')), cnt('old') ? 'warn' : ''], ['Jamais consultées', nf(cnt('nocheck')), cnt('nocheck') ? 'warn' : ''], ['Messages conservés', nf(nMsg), '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="bar"><label class="count">Afficher</label><select id="vmonly"><option value="pb"${S.only === 'pb' ? ' selected' : ''}>Les boîtes à corriger ou à surveiller</option><option value="all"${S.only === 'all' ? ' selected' : ''}>Toutes les boîtes</option></select></div>
    <div id="vmt"></div>
    <p class="note">« Désactivée mais visée » : un acheminement, un SDA ou un renvoi mène à cette messagerie alors qu'elle est désactivée — l'appelant ne peut pas laisser de message. « Renvoi vers une messagerie désactivée » : le profil actif du poste renvoie vers sa propre messagerie (sans réponse, occupé…), qui est désactivée. « Courriel impossible » : envoi par courriel choisi, mais le poste n'a pas d'adresse ou le serveur courriel n'est pas configuré. « Messages en attente » : le plus ancien message conservé a 14 jours ou plus. « Jamais consultée » : messages conservés sur le serveur (sans pièce jointe par courriel), visée par d'autres que le poste lui-même, et aucun appel du poste vers la messagerie dans l'historique (${esc(dayKey(A.histStart))} au ${esc(dayKey(A.histEnd))}) — il peut aussi l'écouter depuis l'application 3CX. « Annonce standard » : des clients y arrivent (SDA, menu, département, file) mais aucune annonce personnalisée n'est enregistrée. Le backup ne dit pas si un message a été écouté.</p></div>`;
  table($('#vmt'), {rows: shown, pageSize: 50, sort: [6, 1], state: (window.__vmT ||= {}),
    search: x => [x.n, dnName(x.n), x.kind, segShort(x.seg), x.e ? x.e.email : '', ...x.flags.map(f => VM_FLAG[f][0])].join(' '),
    filters: [{label: 'Tous les constats', options: VM_ORD.map(k => [k, VM_FLAG[k][0]]), test: (x, v) => x.flags.includes(v)}, {label: 'Tous les types', options: [...new Set(rows.map(x => x.kind))].map(k => [k, k]), test: (x, v) => x.kind === v}],
    cols: [{h: 'Boîte', v: x => x.n, f: x => `${dnLink(x.n)} <span class="muted">${esc(x.kind)}</span>`}, {h: 'Magasin', v: x => segShort(x.seg)},
      {h: 'Messagerie', v: x => x.on == null ? 2 : x.on ? 1 : 0, f: x => x.on == null ? '<span class="muted">boîte de la file</span>' : x.on ? 'activée' : `<span class="pill${x.others.length ? ' bad' : x.refs.length ? ' warn' : ''}">désactivée</span>`},
      {h: 'Messages', v: x => x.opt, f: x => x.e ? esc(VM_MAIL[x.opt] || x.opt) + (x.opt !== 'None' && !x.e.email ? ' <span class="pill bad">sans adresse</span>' : '') : '<span class="muted">—</span>'},
      {h: 'Annonce', v: x => x.custom ? 2 : x.nameRec ? 1 : 0, f: x => x.custom ? 'personnalisée' : x.nameRec ? '<span class="muted">nom enregistré</span>' : '<span class="muted">standard</span>'},
      {h: 'Conservés', num: 1, v: x => x.m.length, f: x => x.m.length ? `${nf(x.m.length)}${x.oldest != null ? ` <span class="muted">· ${nf(x.oldest)} j</span>` : ''}` : '0'},
      {h: 'Constat', v: x => VM_ORD.indexOf(x.top), f: x => x.flags.map(f => `<span class="pill ${VM_FLAG[f][1]}">${esc(VM_FLAG[f][0])}</span>`).join(' ')},
      {h: 'Dernière consultation', v: x => x.ck ? x.ck.last : '', f: x => x.ck ? `${esc(fmtD(x.ck.last))} <span class="muted">(${nf(x.ck.n)})</span>` : x.e && /^Attachment/.test(x.opt) ? '<span class="muted">par courriel</span>' : '<span class="muted">—</span>'},
      {h: 'Y mènent', v: x => x.refs.length, f: x => x.refs.length ? esc(refTxt(x)) : '<span class="muted">rien</span>'}],
    onRow: x => vmDrawer(x)});
  $('#vmt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="vmexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#vmonly').addEventListener('change', e => { S.only = e.target.value; try{ localStorage.setItem(VM_KEY, JSON.stringify(S)); }catch(er){} V.messageries(el); });
  $('#vmexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Boîte', 'Nom', 'Type', 'Magasin', 'Messagerie', 'Messages', 'Courriel', 'Annonce', 'Messages conservés', 'Plus ancien (jours)', 'Dernière consultation', 'Y mènent', 'Constats']].concat(shown.map(x => [x.n, dnName(x.n), x.kind, segShort(x.seg), x.on == null ? 'boîte de la file' : x.on ? 'activée' : 'désactivée', x.e ? VM_MAIL[x.opt] || x.opt : '', x.e ? x.e.email : '', x.custom ? 'personnalisée' : x.nameRec ? 'nom enregistré' : 'standard', x.m.length, x.oldest ?? '', x.ck ? fmtD(x.ck.last) : '', refTxt(x), x.flags.map(f => VM_FLAG[f][0]).join(', ')]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'messageries-vocales.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
function vmDrawer(x){
  const CAT = {sda: 'Numéros entrants (SDA)', route: 'Acheminement (menus, départements, files, groupes)', fwd: 'Renvois de collègues', own: 'Le poste lui-même'};
  const refs = Object.entries(CAT).map(([k, l]) => { const rs = x.refs.filter(r => r.cat === k); return rs.length ? `<h4>${esc(l)}</h4><ul>${rs.map(r => `<li>${esc(r.what)} ${r.cat === 'sda' ? `<span class="muted">${esc(r.hrs)}</span> <span class="muted">(trunk ${esc(r.from)})</span>` : r.cat === 'own' ? '' : dnLink(r.from)}</li>`).join('')}</ul>` : ''; }).join('');
  openDrawer(`<span class="mono">${esc(x.n)}</span> ${esc(dnName(x.n))}`,
    kv([['Type', esc(x.kind)], ['Magasin', esc(segName(x.seg))], ['Messagerie', x.on == null ? 'boîte de la file' : x.on ? 'activée' : 'désactivée'],
      x.e ? ['Messages', esc(VM_MAIL[x.opt] || x.opt)] : null, x.e ? ['Courriel', x.e.email ? esc(x.e.email) : '<span class="pill bad">aucune adresse</span>'] : null,
      ['Annonce', x.custom ? `personnalisée (${x.custom})` : x.nameRec ? 'nom enregistré seulement' : 'standard'],
      ['Messages conservés', x.m.length ? `${nf(x.m.length)} — du ${esc(fmtD(x.m[0].iso))} au ${esc(fmtD(x.m[x.m.length - 1].iso))}` : '0'],
      x.e ? ['Consultations depuis le poste', x.ck ? `${nf(x.ck.n)} — dernière le ${esc(fmtD(x.ck.last))}` : 'aucune dans l\'historique'] : null,
      ['Constats', x.flags.map(f => `<span class="pill ${VM_FLAG[f][1]}">${esc(VM_FLAG[f][0])}</span>`).join(' ')]]) +
    `<h3>Ce qui mène à cette messagerie</h3>${refs || '<p class="muted">Rien dans la configuration ne mène à cette messagerie.</p>'}
    ${x.m.length ? `<p><a href="#audio">Écouter les messages dans Messagerie &amp; audio</a></p>` : ''}`);
}
