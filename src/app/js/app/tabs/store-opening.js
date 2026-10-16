// ---------- Ouverture d'un magasin : parkings partagés (16.5) ----------
// parkings du magasin modèle : ceux du Plan des parkings, sinon ceux affichés sur ses téléphones ou utilisés (90 jours)
function omParksOf(M){
  const plan = pkpLoad(); if((plan[M] || []).length) return plan[M];
  const set = new Set(); FULL.extensions.forEach(e => { if(SEGOF[e.number] !== M) return; (e.blfs || []).forEach(b => { if(b.type === 'SharedParking' && /^SP\d+$/.test(b.v || '')) set.add(b.v); }); });
  return pkSort([...set]);
}
// n parkings libres : existants dans 3CX, attribués à aucun magasin du plan, sur aucun téléphone, sans appel parqué depuis 90 jours ; un bloc continu si possible, sinon les plus petits ; au besoin, de nouveaux numéros à créer
function omFreeParks(n, keep){
  if(!(n > 0)) return {slots: [], create: []};
  const plan = pkpLoad(), info = FULL.parkInfo || (FULL.parks || []).map(x => ({number: x})), exist = pkSort(info.map(p => p.number).filter(x => /^SP\d+$/.test(x)));
  const busy = new Set(Object.entries(plan).filter(([k]) => k !== keep).flatMap(([, l]) => l));
  FULL.extensions.forEach(e => (e.blfs || []).forEach(b => { if(b.type === 'SharedParking' && b.v) busy.add(b.v); }));
  const P = FULL.parkCalls || [], end = P.length ? P.reduce((a, r) => r[0] > a ? r[0] : a, '') : '', lim = end ? new Date(Date.parse(end) - 90 * 864e5).toISOString() : '';
  P.forEach(r => { if(r[0] >= lim) busy.add(r[1]); });
  const mine = keep ? (plan[keep] || []).filter(x => exist.includes(x)) : [];
  if(mine.length >= n) return {slots: mine.slice(0, n), create: []};
  const free = exist.filter(x => !busy.has(x)).map(pkNum);
  let pick = null; for(let i = 0; i + n - 1 < free.length && !pick; i++) if(free[i + n - 1] - free[i] === n - 1) pick = free.slice(i, i + n);
  pick = pick || free.slice(0, n);
  const slots = pick.map(x => 'SP' + x), create = []; let nx = exist.length ? Math.max(...exist.map(pkNum)) + 1 : 0;
  while(slots.length + create.length < n) create.push('SP' + nx++);
  return {slots, create};
}
V.ouvmag = el => {
  // ---------- état : magasin modèle, identité, plan du nouveau magasin (personnalisable), sections ouvertes ----------
  const S = window.__om ||= {model: '', code: '', name: '', plan: null, planOf: '', custom: false, open: {}, did: ''};
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  if(!stores.includes(S.model)) S.model = stores.slice().sort((a, b) => FULL.extensions.filter(e => SEGOF[e.number] === b).length - FULL.extensions.filter(e => SEGOF[e.number] === a).length)[0] || '';
  const M = S.model, NEW = (S.code || '').trim().toUpperCase(), NEWN = (S.name || '').trim(), oldName = (SEGCFG.names[M] || '').trim();
  const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rn = name => { let x = String(name || ''); if(oldName && NEWN) x = x.replace(new RegExp(reEsc(oldName), 'gi'), NEWN); return NEW ? x.replace(new RegExp('\\b' + reEsc(M) + '\\b', 'g'), NEW) : x; };
  const mine = n => SEGOF[n] === M;
  const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
  // nom d'une copie : code et nom du magasin d'origine remplacés par ceux du nouveau magasin (recalculé à chaque affichage)
  const copyName = d => { const src = SEGOF[d.copyOf] || '', sn = (SEGCFG.names[src] || '').trim(); let x = String(d.name || '');
    if(sn && NEWN) x = x.replace(new RegExp(reEsc(sn), 'gi'), NEWN); if(NEW && src && src[0] !== '@') x = x.replace(new RegExp('\\b' + reEsc(src) + '\\b', 'g'), NEW); return x; };
  const today = new Date().toLocaleDateString('fr-CA', {timeZone: TZ}), y0 = +today.slice(0, 4); // 18.2.19
  // ---------- modèle → plan ----------
  const KIND_ID = {'Département': 'g', 'Standard (IVR)': 'i', "File d'attente": 'q', 'Groupe de sonnerie': 'r'};
  const ref = d => { if(!d || !d.to || d.to === 'None' || d.to === 'ProceedWithNoExceptions') return {t: 'none'};
    if(d.to === 'EndCall') return {t: 'end'}; if(d.to === 'RepeatPrompt') return {t: 'repeat'};
    if(d.to === 'External') return {t: 'ext', num: d.ext || ''};
    if(d.to === 'VoiceMail') return {t: 'vm', dn: d.dn && !mine(d.dn) ? d.dn : ''};
    if(d.dn && mine(d.dn)){ const k = DN[d.dn] && KIND_ID[DN[d.dn].kind]; return k ? {t: 'new', id: k + d.dn} : {t: 'post', dn: d.dn}; }
    if(d.dn) return {t: 'dn', dn: d.dn};
    return {t: 'raw', to: d.to}; };
  const freeBlock = (after, len) => { const used = numPlan().used; for(let b = Math.max(len === 3 && after >= 1000 ? 100 : after, len === 3 ? 100 : 1000); b < (len === 3 ? 1000 : 10000); b += 100){ let ok = true; for(let i = b; i < b + 100 && ok; i++) if(used[String(i)]) ok = false; if(ok) return String(b); } return ''; };
  function baseOf(M){
    const groups = FULL.groups.filter(g => !isSysGroup(g) && SEGOF[g.number] === M), ivrs = FULL.ivrs.filter(i => SEGOF[i.number] === M);
    const queues = FULL.queues.filter(q => SEGOF[q.number] === M), rgs = FULL.ringGroups.filter(r => SEGOF[r.number] === M);
    const allD = []; FULL.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll'); l.dids.forEach(d => allD.push({did: d, line: l, rule: by[d] || def, isDefault: !by[d] && !!def})); }); // 18.2.24 : tout le système
    const dids = allD.filter(r => DIDSEG[r.did] === M), exts = FULL.extensions.filter(e => SEGOF[e.number] === M);
    const phones = {}; exts.forEach(e => e.devices.forEach(d => { const k = d.model || d.template || '?'; phones[k] = (phones[k] || 0) + 1; }));
    const cid = {}; exts.forEach(e => { if(e.callerId) cid[e.callerId] = (cid[e.callerId] || 0) + 1; });
    const len = exts.length ? Math.max(...exts.map(e => e.number.length)) : 4, extStart = freeBlock(1000, len), svcStart = freeBlock(+extStart + 100, len);
    return {
      depts: groups.map(g => ({id: 'g' + g.number, from: g.number, name: g.name, hours: clone(g.hours) || {type: '', days: []}, brk: clone(g.breakTime), routes: {office: ref(g.routes.office), outOfOffice: ref(g.routes.outOfOffice), holidays: ref(g.routes.holidays), break: ref(g.routes.break)}, prompts: {...g.prompts}})),
      ivrs: ivrs.map(i => ({id: 'i' + i.number, from: i.number, name: i.name, prompt: i.prompt || '', timeout: i.timeout || '', tAct: i.timeoutType === 'RepeatPrompt' ? {t: 'repeat'} : ref(i.timeoutType ? {to: i.timeoutType, dn: i.timeoutDN} : null), invalid: i.invalidDN ? ref({to: 'X', dn: i.invalidDN}) : {t: 'none'},
        options: i.options.slice().sort((a, b) => a.key.localeCompare(b.key)).map(o => ({key: o.key, dest: ref({to: o.type, dn: o.dn, ext: o.data})}))})),
      queues: queues.map(q => ({id: 'q' + q.number, from: q.number, name: q.name, strategy: q.strategy || '', ring: q.ringTimeout || '', maxWait: q.masterTimeout || '', overflow: ref(q.dest), intro: q.introEnabled ? q.intro || '' : '', announce: !!q.announcePos, agents: q.members.length})),
      rgs: rgs.map(r => ({id: 'r' + r.number, from: r.number, name: r.name, strategy: r.strategy || '', ringTime: r.ringTime || '', members: r.members.length, dest: ref(r.dest)})),
      dids: dids.map((r, i) => { const ru = r.rule || {}; return {id: 'd' + i, from: r.did, number: '', line: r.line.number, office: ref(ru.office), ooo: ru.altOOO ? ref(ru.outOfOffice) : {t: 'same'}}; }),
      hols: qcHolidays(y0).concat(qcHolidays(y0 + 1)).filter(h => h[1] >= today).slice(0, 12).map(h => ({name: h[0], date: h[1], on: true})), holsCustom: [],
      exts: {count: exts.length, start: extStart, len, phones, blf: true}, svcStart, parks: omParksOf(M).length,
      out: {cid: '', modelCid: (Object.entries(cid).sort((a, b) => b[1] - a[1])[0] || [''])[0], line: (dids[0] && dids[0].line.number) || ''}};
  }
  if(!S.plan || S.planOf !== M){ S.plan = baseOf(M); S.planOf = M; }
  const P = S.plan, B = baseOf(M);
  // ---------- numérotation proposée : postes, puis menus, files, groupes et parkings dans une plage libre ----------
  const num = (() => { const used = numPlan().used, out = {}, taken = new Set(), take = start => { let n = +start || 0; return () => { while(used[String(n)] || taken.has(String(n))) n++; taken.add(String(n)); return String(n++); }; };
    const ex = take(P.exts.start), sv = take(P.svcStart);
    out.exts = Array.from({length: Math.max(0, +P.exts.count || 0)}, () => ex());
    P.ivrs.forEach(x => out[x.id] = sv()); P.queues.forEach(x => out[x.id] = sv()); P.rgs.forEach(x => out[x.id] = sv());
    const fp = omFreeParks(Math.max(0, +P.parks || 0), NEW); out.parks = [...fp.slots, ...fp.create]; out.parksNew = fp.create; return out; })();
  const nm = x => x.nameEd != null && x.nameEd !== '' ? x.nameEd : x.copyOf ? copyName(x) : rn(x.name);
  const all = () => [...P.depts.map(x => ['Département', x]), ...P.ivrs.map(x => ['Standard (IVR)', x]), ...P.queues.map(x => ["File d'attente", x]), ...P.rgs.map(x => ['Groupe de sonnerie', x])];
  const byId = id => { const f = all().find(([, x]) => x.id === id); return f ? {kind: f[0], x: f[1]} : null; };
  const lineName = n => { const l = FULL.lines.find(x => x.number === n); return l ? (l.gateway || l.number) : n || '—'; };
  // destination en texte simple
  const descRef = r => { if(!r) return 'aucune destination';
    switch(r.t){
      case 'none': return 'aucune destination'; case 'end': return 'Raccrocher'; case 'repeat': return 'Répéter le message'; case 'same': return 'comme pendant les heures';
      case 'ext': return `Numéro externe ${phone(r.num) || r.num || '(à saisir)'}`.trim();
      case 'vm': return r.dn ? `Messagerie vocale ${r.dn} ${dnName(r.dn)}`.replace(/\s+/g, ' ').trim() : 'Messagerie vocale';
      case 'post': return `Poste à créer (comme ${r.dn})`;
      case 'dn': { const sg = SEGOF[r.dn]; return `${DN[r.dn] ? DN[r.dn].kind : 'Élément'} ${r.dn} ${dnName(r.dn)} (${sg && sg[0] !== '@' ? 'magasin ' + segShort(sg) + ', existant' : 'commun, inchangé'})`.replace(/\s+/g, ' '); }
      case 'new': { const b = byId(r.id); return b ? `${b.kind} « ${nm(b.x)} »${num[r.id] ? ` (n° ${num[r.id]})` : ''}` : 'élément retiré (à corriger)'; }
      default: return TO_FR[r.to] || r.to || '—'; } };
  // ---------- différences avec le modèle ----------
  const LBL = {name: 'nom', nameEd: 'nom', hours: 'horaires', brk: 'pause', 'routes.office': 'destination pendant les heures', 'routes.outOfOffice': 'destination hors heures', 'routes.holidays': 'destination les fériés', 'routes.break': 'destination pendant la pause', prompts: 'messages', prompt: 'message', timeout: 'délai sans choix', tAct: 'action sans choix', invalid: 'touche invalide', options: 'touches', strategy: 'stratégie', ring: 'sonnerie par agent', maxWait: 'attente maximale', overflow: 'débordement', intro: "message d'accueil", announce: 'annonce de la position', agents: "nombre d'agents", ringTime: 'temps de sonnerie', members: 'nombre de membres', dest: 'destination', number: 'numéro', line: 'trunk', office: 'destination', ooo: 'destination hors heures'};
  const get = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const changed = (x, b, keys) => keys.filter(k => JSON.stringify(get(x, k) ?? null) !== JSON.stringify(get(b, k) ?? null) && !(k === 'nameEd' && (x.nameEd == null || x.nameEd === '' || x.nameEd === rn(b.name))));
  const KEYS = {depts: ['nameEd', 'hours', 'brk', 'routes.office', 'routes.outOfOffice', 'routes.holidays', 'routes.break', 'prompts'], ivrs: ['nameEd', 'prompt', 'timeout', 'tAct', 'invalid', 'options'], queues: ['nameEd', 'strategy', 'ring', 'maxWait', 'overflow', 'intro', 'announce', 'agents'], rgs: ['nameEd', 'strategy', 'ringTime', 'members', 'dest'], dids: ['number', 'line', 'office', 'ooo']};
  const SEC_L = {depts: 'Départements', ivrs: 'Menus IVR', queues: "Files d'attente", rgs: 'Groupes de sonnerie', dids: 'SDA'};
  const statusOf = (sec, x) => { if(!x.from && sec !== 'dids') return 'nouveau'; const b = (B[sec] || []).find(y => y.id === x.id); if(!b) return 'nouveau'; return changed(x, b, KEYS[sec]).length ? 'personnalisé' : ''; };
  const diffs = []; Object.keys(SEC_L).forEach(sec => { const add = P[sec].filter(x => !(B[sec] || []).some(b => b.id === x.id)), del = (B[sec] || []).filter(b => !P[sec].some(x => x.id === b.id));
    const mod = P[sec].map(x => { const b = (B[sec] || []).find(y => y.id === x.id); return b ? [x, changed(x, b, KEYS[sec])] : null; }).filter(z => z && z[1].length);
    if(add.length) diffs.push(`${SEC_L[sec]} : ${add.length} ajouté(s) — ${add.map(x => sec === 'dids' ? (phone(x.number) || x.number || 'SDA à obtenir') : '« ' + nm(x) + ' »').join(', ')}`);
    if(del.length) diffs.push(`${SEC_L[sec]} : ${del.length} retiré(s) — ${del.map(x => sec === 'dids' ? (phone(x.from) || x.from) : '« ' + rn(x.name) + ' »').join(', ')}`);
    mod.forEach(([x, ks]) => diffs.push(`${SEC_L[sec]} « ${sec === 'dids' ? (phone(x.number) || x.number || phone(x.from) || x.from) : nm(x)} » : ${[...new Set(ks.map(k => LBL[k] || k))].join(', ')}`)); });
  if(+P.exts.count !== +B.exts.count) diffs.push(`Postes : ${P.exts.count} au lieu de ${B.exts.count}`);
  if(JSON.stringify(P.exts.phones) !== JSON.stringify(B.exts.phones)) diffs.push('Téléphones : modèles ou quantités modifiés');
  if(+P.parks !== +B.parks) diffs.push(`Parkings partagés : ${P.parks} au lieu de ${B.parks}`);
  const holOff = P.hols.filter(h => !h.on).length; if(holOff || P.holsCustom.length) diffs.push(`Jours fériés : ${holOff} retiré(s), ${P.holsCustom.length} ajouté(s)`);
  if(P.out.cid) diffs.push(`Caller ID sortant : ${phone(P.out.cid) || P.out.cid}`);
  // ---------- liste à cocher (à partir du plan) ----------
  const tag = (sec, x) => { const s = statusOf(sec, x); return s ? ` (${s})` : ''; };
  const hrs = h => (hoursSummary(h).join(' · ') || 'fermé tous les jours');
  const pr = ['office', 'outOfOffice', 'holidays', 'break'], PRL = {office: "heures d'ouverture", outOfOffice: 'hors heures', holidays: 'fériés', break: 'pause'};
  const steps = M ? [
    ['Départements', 'Console 3CX → Départements (Groups) → Ajouter', P.depts.length ? P.depts.flatMap(d => [
      `Créer « ${nm(d)} »${d.from ? ` (modèle : ${d.from})` : d.copyOf ? ` (copie de ${d.copyOf} ${d.name})` : ''}${tag('depts', d)} — numéro attribué par 3CX`,
      `↳ Heures d'ouverture : ${hrs(d.hours)}${d.brk && (d.brk.days || []).length ? ` · pause : ${hrs(d.brk)}` : ''}`,
      `↳ Pendant les heures : ${descRef(d.routes.office)} · hors heures : ${descRef(d.routes.outOfOffice)}${d.routes.holidays.t !== 'none' ? ` · fériés : ${descRef(d.routes.holidays)}` : ''}${d.routes.break.t !== 'none' ? ` · pause : ${descRef(d.routes.break)}` : ''}`,
      ...pr.filter(k => d.prompts[k]).map(k => `↳ Message ${PRL[k]} : ${d.prompts[k]}`)]) : ['Aucun département']],
    ['Standards IVR (menus)', 'Console 3CX → Standards numériques (Digital Receptionists) → Ajouter', P.ivrs.length ? P.ivrs.flatMap(i => [
      `Créer « ${nm(i)} » — numéro ${num[i.id]}${tag('ivrs', i)}${i.prompt ? ` · message : ${i.prompt}` : ''}`,
      ...i.options.map(o => `↳ Touche ${o.key} : ${descRef(o.dest)}`),
      `↳ Sans choix après ${i.timeout || '—'} s : ${descRef(i.tAct)}${i.invalid.t !== 'none' ? ` · touche invalide : ${descRef(i.invalid)}` : ''}`]) : ['Aucun menu']],
    ["Files d'attente", "Console 3CX → Files d'attente (Call Queues) → Ajouter", P.queues.length ? P.queues.flatMap(q => [
      `Créer « ${nm(q)} » — numéro ${num[q.id]}${tag('queues', q)} · stratégie ${q.strategy || '—'} · ${q.ring || '—'} s par agent · attente max ${q.maxWait || '—'} s`,
      `↳ Débordement : ${descRef(q.overflow)}${q.intro ? ` · message d'accueil : ${q.intro}` : ''}${q.announce ? ' · annonce de la position' : ''}`,
      `↳ Agents prévus : ${q.agents}`]) : ['Aucune file']],
    ['Groupes de sonnerie', 'Console 3CX → Groupes de sonnerie (Ring Groups) → Ajouter', P.rgs.length ? P.rgs.map(r => `Créer « ${nm(r)} » — numéro ${num[r.id]}${tag('rgs', r)} · ${r.strategy || '—'} · ${r.ringTime || '—'} s · ${r.members} membre(s) prévu(s) · ensuite : ${descRef(r.dest)}`) : ['Aucun groupe de sonnerie']],
    ['SDA et règles entrantes', 'Console 3CX → Trunks (SIP Trunks) → trunk → Règles entrantes (Inbound Rules)', P.dids.length ? P.dids.map(d => `SDA ${d.number ? phone(d.number) || d.number : 'à obtenir'} sur ${lineName(d.line)}${tag('dids', d)} → ${descRef(d.office)}${d.ooo.t !== 'same' ? ` · hors heures : ${descRef(d.ooo)}` : ''}`) : ['Aucun SDA : prévoir au moins un numéro principal']],
    ['Jours fériés', 'Console 3CX → Départements → département → Jours fériés (Holidays)', [...P.hols.filter(h => h.on).map(h => `${h.name} — ${h.date}${FER_FIXED.has(h.name) ? ' (récurrent)' : ''}`), ...P.holsCustom.filter(h => h.name || h.date).map(h => `${h.name || 'Férié'} — ${h.date || 'date à préciser'} (propre au magasin)`)].concat(P.hols.some(h => h.on) || P.holsCustom.length ? [] : ['Aucun férié retenu'])],
    ['Postes et téléphones', 'Console 3CX → Utilisateurs (Users) et Téléphones (Phones)', [
      `Créer ${P.exts.count} poste${P.exts.count > 1 ? 's' : ''}${num.exts.length ? ` : numéros ${num.exts[0]} à ${num.exts[num.exts.length - 1]}` : ''} — avec l'onglet Nouvel employé (collègue modèle du magasin modèle)`,
      ...Object.entries(P.exts.phones).filter(([, n]) => +n > 0).map(([m, n]) => `Téléphone ${m} × ${n} — sélectionner le firmware recommandé (onglet Téléphones)`),
      P.exts.blf ? "Programmer les touches BLF avec l'onglet Modèle de touches" : 'Touches BLF : à définir',
      ...(P.parks ? [`Parkings partagés réservés au magasin : ${pkFmt(num.parks)} — libres : aucun téléphone, aucun magasin du Plan des parkings ni appel récent ne les utilise`,
        ...(num.parksNew.length ? [`Créer dans 3CX les parkings ${pkFmt(num.parksNew)} (pas assez de parkings libres existants)`] : []),
        `Programmer sur chaque téléphone du magasin les touches de parking ${pkFmt(num.parks)} (type « Parking partagé »)`,
        `Ajouter ${pkFmt(num.parks)} au magasin ${NEW || 'nouveau'} dans l'onglet Plan des parkings`] : ['Aucun parking partagé'])]],
    ['Appels sortants', 'Console 3CX → Utilisateurs → Caller ID ; Règles sortantes (Outbound Rules)', [
      `Caller ID sortant des postes : ${P.out.cid ? phone(P.out.cid) || P.out.cid : (P.out.modelCid ? `à définir (le modèle utilise ${phone(P.out.modelCid) || P.out.modelCid})` : 'celui du trunk')}`,
      `Trunk des appels sortants : ${lineName(P.out.line)}`]],
    ['Vérifications', 'Après la mise en service', [
      "Appeler chaque nouveau SDA pendant et hors des heures d'ouverture",
      "Au prochain backup : onglets Contrôle des SDA, Pièges d'acheminement et Simulateur d'appel",
      "Ajouter le nouveau magasin dans l'onglet Magasins si son code n'est pas reconnu automatiquement"]]] : [];
  // ---------- tableau de numérotation ----------
  const numRows = [...P.depts.map(d => ['Département', nm(d), 'attribué par 3CX', d.from || '—']), ...P.ivrs.map(x => ['Standard (IVR)', nm(x), num[x.id], x.from || '—']), ...P.queues.map(x => ["File d'attente", nm(x), num[x.id], x.from || '—']),
    ...P.rgs.map(x => ['Groupe de sonnerie', nm(x), num[x.id], x.from || '—']), ...(num.exts.length ? [['Postes', `${num.exts.length} poste(s)`, `${num.exts[0]} – ${num.exts[num.exts.length - 1]}`, '—']] : []), ...num.parks.map((n, i) => ['Parking partagé', `Parking ${i + 1}${num.parksNew.includes(n) ? ' (à créer)' : ''}`, n, '—'])];
  // ---------- diagramme du flux d'appel (construit à partir du plan) ----------
  if(!P.dids.some(d => d.id === S.did)) S.did = (P.dids[0] || {}).id || '';
  const flow = (() => { const D0 = P.dids.find(d => d.id === S.did); if(!D0) return null;
    const nodes = new Map(), edges = []; let uid = 0;
    const addNode = n => { nodes.set(n.id, n); return n.id; };
    const addEdge = (from, to, label) => { const e = edges.find(x => x.from === from && x.to === to); if(e){ if(label && !e.labels.includes(label)) e.labels.push(label); return; } edges.push({from, to, labels: label ? [label] : []}); };
    const target = r => { if(!r || r.t === 'none' || r.t === 'same') return null;
      if(r.t === 'new'){ const b = byId(r.id); if(!b) return null; const id = 'n:' + r.id; if(nodes.has(id)) return id; const x = b.x, node = {id, kind: b.kind, title: nm(x), sub: num[r.id] ? 'n° ' + num[r.id] : (x.from ? 'remplace ' + x.from : 'nouveau'), lines: []}; addNode(node);
        if(b.kind === 'Département'){ node.lines = hoursSummary(x.hours); [['office', 'Ouvert'], ['outOfOffice', 'Fermé'], ['break', 'Pause'], ['holidays', 'Fériés']].forEach(([k, l]) => { const t = target(x.routes[k]); if(t) addEdge(id, t, l); }); }
        else if(b.kind === 'Standard (IVR)'){ if(x.prompt) node.lines.push('♪ ' + x.prompt); x.options.forEach(o => { const t = target(o.dest); if(t) addEdge(id, t, 'Touche ' + o.key); });
          if(x.tAct.t === 'repeat') node.lines.push(`Sans choix (${x.timeout}s) : répète le message`); else { const t = target(x.tAct); if(t) addEdge(id, t, `Sans choix (${x.timeout}s)`); } const iv = target(x.invalid); if(iv) addEdge(id, iv, 'Touche invalide'); }
        else if(b.kind === "File d'attente"){ node.lines.push(`${x.strategy} · ${x.ring}s/agent`, `Agents prévus : ${x.agents}`); if(x.intro) node.lines.push('♪ ' + x.intro); const t = target(x.overflow); if(t) addEdge(id, t, `Délai max (${x.maxWait}s)`); }
        else if(b.kind === 'Groupe de sonnerie'){ node.lines.push(`${x.strategy} · ${x.ringTime}s`, `Membres prévus : ${x.members}`); const t = target(x.dest); if(t) addEdge(id, t, `Sans réponse (${x.ringTime}s)`); }
        return id; }
      if(r.t === 'dn') return addNode({id: 'dn:' + r.dn, kind: DN[r.dn] ? DN[r.dn].kind : 'other', title: dnName(r.dn) || r.dn, sub: r.dn + ' · commun', lines: []});
      if(r.t === 'post') return addNode({id: 'p:' + r.dn, kind: 'Poste', title: 'Poste à créer', sub: 'comme ' + r.dn, lines: []});
      if(r.t === 'vm') return addNode({id: 'vm:' + (r.dn || uid++), kind: 'vm', title: 'Messagerie vocale', sub: r.dn || '', lines: []});
      if(r.t === 'ext') return addNode({id: 'ext:' + (r.num || uid++), kind: 'ext', title: phone(r.num) || r.num || 'Numéro externe', sub: 'Numéro externe', lines: []});
      if(r.t === 'end') return addNode({id: 'end:' + (uid++), kind: 'end', title: 'Raccrocher', sub: '', lines: []});
      return addNode({id: 'o:' + (uid++), kind: 'other', title: descRef(r), sub: '', lines: []}); };
    addNode({id: 'did', kind: 'did', title: D0.number ? phone(D0.number) || D0.number : 'Nouveau SDA', sub: lineName(D0.line), lines: []});
    addNode({id: 'rule', kind: 'rule', title: 'Règle entrante', sub: 'Selon le SDA', lines: []}); addEdge('did', 'rule', '');
    const o = target(D0.office); if(o) addEdge('rule', o, D0.ooo.t !== 'same' ? 'Ouvert' : 'Toujours'); else addEdge('rule', addNode({id: 'none', kind: 'end', title: 'Aucune destination', sub: '', lines: ["L'appel n'est pas acheminé"]}), 'Toujours');
    if(D0.ooo.t !== 'same'){ const f = target(D0.ooo); if(f) addEdge('rule', f, 'Fermé'); }
    return renderFlow({nodes, edges}); })();
  // ---------- éditeurs (personnalisation) ----------
  const commons = [...FULL.groups.filter(g => !isSysGroup(g)), ...FULL.ivrs, ...FULL.queues, ...FULL.ringGroups].filter(x => !SEGOF[x.number] || SEGOF[x.number] === SEG_COMMON);
  const encR = r => r.t === 'new' ? 'new:' + r.id : r.t === 'dn' ? 'dn:' + r.dn : r.t === 'post' ? 'post:' + r.dn : r.t === 'vm' ? 'vm:' + (r.dn || '') : r.t === 'raw' ? 'raw:' + r.to : r.t;
  const decR = (v, prev) => { const [t, ...rest] = v.split(':'), a = rest.join(':');
    if(t === 'new') return {t, id: a}; if(t === 'dn') return {t, dn: a}; if(t === 'post') return {t, dn: a}; if(t === 'vm') return {t, dn: a}; if(t === 'raw') return {t, to: a};
    if(t === 'ext') return {t, num: prev && prev.t === 'ext' ? prev.num : ''}; return {t}; };
  const destSel = (path, r, opts = {}) => { const cur = encR(r || {t: 'none'});
    const o = [['none', 'Aucune destination'], ...(opts.same ? [['same', 'Comme pendant les heures']] : []), ...(opts.repeat ? [['repeat', 'Répéter le message']] : []), ['end', 'Raccrocher'], ['vm', 'Messagerie vocale'], ['ext', 'Numéro externe…'],
      ...all().map(([k, x]) => ['new:' + x.id, `${k} « ${nm(x)} »`]), ...commons.map(x => ['dn:' + x.number, `Commun : ${x.number} ${x.name}`])];
    if(!o.some(([v]) => v === cur)) o.push([cur, descRef(r)]);
    return `<select data-p="${path}" data-k="dest">${o.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${r && r.t === 'ext' ? ` <input data-p="${path}.num" value="${esc(r.num || '')}" placeholder="numéro" style="width:120px">` : ''}`; };
  const inp = (path, v, ph = '', w = 160, type = 'text') => `<input type="${type}" data-p="${path}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" style="width:${w}px">`;
  const toPer = h => { const d = {}; DAY_ORDER.forEach(day => { const x = ((h && h.days) || []).find(y => y.day === day); d[day] = x ? x.p.map(p => [p[0], p[1]]) : (h && h.type === 'AllHours' && !((h.days || []).length) ? [['00:00', '23:59']] : []); }); return d; };
  const tIn = (cls, v, dis) => `<input type="time" class="${cls}" value="${esc(String(v || '').replace('24:00', '23:59'))}"${dis ? ' disabled' : ''}>`;
  const hoursTable = (path, h) => { const per = toPer(h); return `<table class="omht" data-hours="${path}"><tbody>${DAY_ORDER.map(day => { const p = per[day]; return `<tr data-day="${day}"><th>${DAYS_FR[day]}</th><td><label><input type="checkbox" class="omo"${p.length ? ' checked' : ''}> ouvert</label></td>
    <td>${tIn('omb1', (p[0] || [])[0] || '09:00', !p.length)} – ${tIn('ome1', (p[0] || [])[1] || '17:00', !p.length)}</td>
    <td><label><input type="checkbox" class="om2"${p.length > 1 ? ' checked' : ''}${p.length ? '' : ' disabled'}> 2e plage</label> ${tIn('omb2', (p[1] || [])[0] || '13:00', p.length < 2)} – ${tIn('ome2', (p[1] || [])[1] || '17:00', p.length < 2)}</td></tr>`; }).join('')}</tbody></table>`; };
  const stPill = (sec, x) => { const s = statusOf(sec, x); return s ? ` <span class="pill ${s === 'nouveau' ? 'ok' : 'acc'}">${s}</span>` : ''; };
  const item = (sec, i, title, body) => `<div class="omitem"><div class="omhh"><b>${title}</b>${stPill(sec, P[sec][i])}<span style="flex:1"></span><button class="btn" data-act="del:${sec}.${i}">Retirer</button></div>${body}</div>`;
  const row = (l, h) => `<div class="omrow"><span>${l}</span><div>${h}</div></div>`;
  const sec = (id, title, count, body, addLbl) => `<details class="card omsec" data-sec="${id}"${S.open[id] ? ' open' : ''}><summary><b>${title}</b> <span class="muted">(${count})</span></summary>${body}${addLbl ? `<p><button class="btn" data-act="add:${id}">${addLbl}</button></p>` : ''}</details>`;
  // ajout d'un département : vide, ou copie d'un département existant (tout magasin) avec horaires, pause, destinations et messages
  const deptAdd = () => `<p class="omopt"><span>Ajouter un département :</span> <select id="omdcopy"><option value="">vide</option>${stores.concat([SEG_COMMON]).map(sg => { const gs = FULL.groups.filter(g => !isSysGroup(g) && (SEGOF[g.number] || SEG_COMMON) === sg);
    return gs.length ? `<optgroup label="${esc(segName(sg))}">${gs.map(g => `<option value="${esc(g.number)}">copie de « ${esc(g.name)} »</option>`).join('')}</optgroup>` : ''; }).join('')}</select> <button class="btn" data-act="adddept">Ajouter</button></p>`;
  const editor = () => `<div id="omedit">
    <p class="muted" style="font-size:12.5px">Tout part du magasin modèle : modifiez seulement ce qui change. Les sections se replient ; la liste à cocher, la numérotation et le diagramme se mettent à jour.</p>
    ${sec('depts', 'Départements', P.depts.length, P.depts.map((d, i) => item('depts', i, '« ' + esc(nm(d)) + ' »',
      row('Nom', inp(`depts.${i}.nameEd`, nm(d), '', 240)) + row("Heures d'ouverture", hoursTable(`depts.${i}.hours`, d.hours)) +
      row('Pause', `<label><input type="checkbox" data-p="depts.${i}.brkOn" data-k="bool"${d.brk && (d.brk.days || []).length ? ' checked' : ''}> horaire de pause</label>${d.brk && (d.brk.days || []).length ? hoursTable(`depts.${i}.brk`, d.brk) : ''}`) +
      row('Pendant les heures', destSel(`depts.${i}.routes.office`, d.routes.office)) + row('Hors heures', destSel(`depts.${i}.routes.outOfOffice`, d.routes.outOfOffice)) +
      row('Fériés', destSel(`depts.${i}.routes.holidays`, d.routes.holidays)) + row('Pendant la pause', destSel(`depts.${i}.routes.break`, d.routes.break)) +
      row('Messages', pr.map(k => `<label class="omlbl">${PRL[k]} ${inp(`depts.${i}.prompts.${k}`, d.prompts[k] || '', 'fichier', 200)}</label>`).join('')))).join('') + deptAdd(), '')}
    ${sec('ivrs', 'Menus IVR', P.ivrs.length, P.ivrs.map((x, i) => item('ivrs', i, '« ' + esc(nm(x)) + ' »',
      row('Nom', inp(`ivrs.${i}.nameEd`, nm(x), '', 240)) + row('Message', inp(`ivrs.${i}.prompt`, x.prompt, 'fichier', 240)) +
      row('Touches', x.options.map((o, j) => `<div class="omopt">Touche ${inp(`ivrs.${i}.options.${j}.key`, o.key, '', 40)} → ${destSel(`ivrs.${i}.options.${j}.dest`, o.dest)} <button class="btn" data-act="delopt:ivrs.${i}.${j}" title="Retirer la touche">×</button></div>`).join('') + `<button class="btn" data-act="addopt:ivrs.${i}">Ajouter une touche</button>`) +
      row('Sans choix', `après ${inp(`ivrs.${i}.timeout`, x.timeout, 's', 50, 'number')} s : ${destSel(`ivrs.${i}.tAct`, x.tAct, {repeat: true})}`) + row('Touche invalide', destSel(`ivrs.${i}.invalid`, x.invalid)))).join(''), 'Ajouter un menu')}
    ${sec('queues', "Files d'attente", P.queues.length, P.queues.map((x, i) => item('queues', i, '« ' + esc(nm(x)) + ' »',
      row('Nom', inp(`queues.${i}.nameEd`, nm(x), '', 240)) +
      row('Stratégie', `<select data-p="queues.${i}.strategy">${[...new Set(['RingAll', 'Hunt', 'HuntRandomStart', 'NextAgent', 'LongestWaiting', 'LeastTalkTime', 'FewestAnswered', 'HuntBy3s', 'First3Available', x.strategy].filter(Boolean))].map(v => `<option${v === x.strategy ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`) +
      row('Sonnerie par agent', inp(`queues.${i}.ring`, x.ring, 's', 60, 'number') + ' s') + row('Attente maximale', inp(`queues.${i}.maxWait`, x.maxWait, 's', 70, 'number') + ' s') +
      row('Débordement', destSel(`queues.${i}.overflow`, x.overflow)) + row("Message d'accueil", inp(`queues.${i}.intro`, x.intro, 'fichier (vide : aucun)', 240)) +
      row('Annonce de la position', `<label><input type="checkbox" data-p="queues.${i}.announce" data-k="bool"${x.announce ? ' checked' : ''}> oui</label>`) + row('Agents prévus', inp(`queues.${i}.agents`, x.agents, '', 60, 'number')))).join(''), 'Ajouter une file')}
    ${sec('rgs', 'Groupes de sonnerie', P.rgs.length, P.rgs.map((x, i) => item('rgs', i, '« ' + esc(nm(x)) + ' »',
      row('Nom', inp(`rgs.${i}.nameEd`, nm(x), '', 240)) + row('Stratégie', `<select data-p="rgs.${i}.strategy">${[...new Set(['RingAll', 'Hunt', 'Paging', x.strategy].filter(Boolean))].map(v => `<option${v === x.strategy ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`) +
      row('Temps de sonnerie', inp(`rgs.${i}.ringTime`, x.ringTime, 's', 60, 'number') + ' s') + row('Membres prévus', inp(`rgs.${i}.members`, x.members, '', 60, 'number')) + row('Sans réponse', destSel(`rgs.${i}.dest`, x.dest)))).join(''), 'Ajouter un groupe')}
    ${sec('dids', 'SDA et règles entrantes', P.dids.length, P.dids.map((d, i) => item('dids', i, 'SDA ' + esc(d.number ? phone(d.number) || d.number : (d.from ? 'comme ' + (phone(d.from) || d.from) : 'nouveau')),
      row('Numéro', inp(`dids.${i}.number`, d.number, 'à obtenir', 140)) + row('Trunk', `<select data-p="dids.${i}.line">${FULL.lines.map(l => `<option value="${esc(l.number)}"${l.number === d.line ? ' selected' : ''}>${esc(l.gateway || l.number)}</option>`).join('')}</select>`) +
      row('Pendant les heures', destSel(`dids.${i}.office`, d.office)) + row('Hors heures', destSel(`dids.${i}.ooo`, d.ooo, {same: true})))).join(''), 'Ajouter un SDA')}
    ${sec('hols', 'Jours fériés', P.hols.filter(h => h.on).length + P.holsCustom.length, `<div class="omchk">${P.hols.map((h, i) => `<label><input type="checkbox" data-p="hols.${i}.on" data-k="bool"${h.on ? ' checked' : ''}> ${esc(h.name)} — ${esc(h.date)}</label>`).join('')}</div>` +
      P.holsCustom.map((h, i) => `<div class="omopt">${inp(`holsCustom.${i}.name`, h.name, 'nom du férié', 180)} ${inp(`holsCustom.${i}.date`, h.date, '', 150, 'date')} <button class="btn" data-act="delhol:${i}">×</button></div>`).join(''), 'Ajouter un férié propre au magasin')}
    ${sec('exts', 'Postes, téléphones et parkings', P.exts.count + ' postes', row('Nombre de postes', inp('exts.count', P.exts.count, '', 70, 'number')) + row('Premier numéro de poste', inp('exts.start', P.exts.start, '', 90) + ' <span class="muted">(plage libre proposée)</span>') +
      row('Téléphones', Object.entries(P.exts.phones).map(([m, n]) => `<label class="omlbl">${esc(m)} ${inp('exts.phones.' + m.replace(/\./g, '․'), n, '', 60, 'number')}</label>`).join('') || '<span class="muted">aucun dans le modèle</span>') +
      row('Touches BLF', `<label><input type="checkbox" data-p="exts.blf" data-k="bool"${P.exts.blf ? ' checked' : ''}> appliquer le modèle de touches du département</label>`) +
      row('Parkings partagés', inp('parks', P.parks, '', 60, 'number') + (num.parks.length ? ` <span class="pkchips" style="display:inline-flex;margin-left:6px">${num.parks.map(p => `<span class="pkchip ${num.parksNew.includes(p) ? 'pk-add' : 'pk-own'}" title="${num.parksNew.includes(p) ? 'à créer dans 3CX' : 'parking libre'}">${esc(p)}</span>`).join('')}</span>
        <button class="btn" data-act="pkplan"${NEW ? '' : ' disabled title="Indiquez d\'abord le code du nouveau magasin"'}>Ajouter au Plan des parkings</button><span class="muted" id="ompkmsg" style="font-size:12px;margin-left:6px">${esc(S.pkMsg || '')}</span>` : '')
        + `<div class="muted" style="font-size:12px">Modèle : ${esc(pkFmt(omParksOf(M)) || 'aucun')} — parkings proposés parmi ceux qu'aucun téléphone, aucun magasin du Plan des parkings ni appel récent n'utilise.</div>`) + row('Premier numéro des menus, files et groupes', inp('svcStart', P.svcStart, '', 90) + ' <span class="muted">(plage libre proposée)</span>'), '')}
    ${sec('out', 'Appels sortants', P.out.cid ? 1 : 0, row('Caller ID sortant', inp('out.cid', P.out.cid, P.out.modelCid ? 'modèle : ' + (phone(P.out.modelCid) || P.out.modelCid) : 'numéro', 180)) +
      row('Trunk', `<select data-p="out.line">${FULL.lines.map(l => `<option value="${esc(l.number)}"${l.number === P.out.line ? ' selected' : ''}>${esc(l.gateway || l.number)}</option>`).join('')}</select>`), '')}
    <p><button class="btn" data-act="reset">Revenir au magasin modèle</button></p></div>`;
  // ---------- page ----------
  const dup = NEW && stores.includes(NEW);
  el.innerHTML = `<div id="omwrap"><h2>Ouverture d'un magasin</h2>
    <p class="lead">Choisissez un magasin qui fonctionne comme le futur magasin : l'assistant prépare la liste complète des éléments à créer dans la console 3CX, avec les noms adaptés au nouveau code. Le bouton « Personnaliser le nouveau magasin » permet de tout modifier (départements, horaires, menus, files, groupes, SDA, fériés, postes, appels sortants). Rien n'est envoyé ni modifié dans 3CX.</p>
    <div class="grid two"><div class="card">
      <label class="nvf">Magasin modèle <select id="omseg">${stores.map(s => `<option value="${esc(s)}"${s === M ? ' selected' : ''}>${esc(segName(s))}</option>`).join('')}</select></label>
      <p class="muted" style="font-size:12.5px;margin:6px 0 0">${nf(B.depts.length)} département(s), ${nf(B.ivrs.length)} menu(s), ${nf(B.queues.length)} file(s), ${nf(B.rgs.length)} groupe(s) de sonnerie, ${nf(B.dids.length)} SDA, ${nf(B.exts.count)} poste(s).</p></div>
      <div class="card">
      <label class="nvf">Code du nouveau magasin <input id="omcode" value="${esc(S.code)}" maxlength="4" autocomplete="off" placeholder="ex. AB" style="text-transform:uppercase"></label>
      <label class="nvf">Nom du nouveau magasin <input id="omname" value="${esc(S.name)}" autocomplete="off" placeholder="facultatif"></label>
      ${dup ? '<p><span class="pill warn">Ce code est déjà utilisé par un magasin existant.</span></p>' : ''}</div></div>
    ${M ? `<p class="ombar"><button class="btn${S.custom ? '' : ' primary'}" id="omcust">${S.custom ? 'Masquer la personnalisation' : 'Personnaliser le nouveau magasin'}</button> ${diffs.length ? `<span class="pill acc">${diffs.length} différence(s) avec le modèle</span>` : ''}
      <span style="flex:1"></span><button class="btn" id="omexp">Exporter le paramétrage</button> <label class="btn">Importer un paramétrage<input type="file" id="omimp" accept=".json,application/json" hidden></label> <span class="muted" id="omimpmsg" style="font-size:12.5px"></span></p>` : ''}
    ${M && S.custom ? editor() : ''}
    ${M ? `<div class="nvsheet report" id="omsheet"><header class="rpcover"><div class="rpk">Ouverture d'un magasin · 3CXplore</div><h1>${esc(NEWN || NEW || 'Nouveau magasin')}</h1>
        <div class="rpmeta">Configuré comme <b>${esc(segName(M))}</b> · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      ${diffs.length ? `<section class="rps"><h2>Différences avec le magasin modèle</h2><ul>${diffs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      ${steps.map(([t, path, items], i) => `<section class="rps"><h2>${i + 1}. ${esc(t)}</h2><div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(path)}</div><ul class="nvck">${items.map(x => `<li><label><input type="checkbox"> <span>${esc(x)}</span></label></li>`).join('')}</ul></section>`).join('')}
      <section class="rps"><h2>${steps.length + 1}. Numérotation proposée</h2><div class="muted" style="font-size:12.5px;margin-bottom:6px">Numéros libres d'après le plan de numérotation actuel (vérifiés : aucun n'est déjà utilisé).</div>
        <div class="tw"><table><thead><tr><th>Type</th><th>Nom</th><th>Numéro</th><th>Remplace (modèle)</th></tr></thead><tbody>${numRows.map(r => `<tr>${r.map((c, j) => `<td${j === 2 ? ' class="mono"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
      ${P.dids.length ? `<section class="rps"><h2>${steps.length + 2}. Diagramme du flux d'appel</h2>
        <div class="noprint" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label class="count">SDA</label><select id="omdid">${P.dids.map(d => `<option value="${esc(d.id)}"${d.id === S.did ? ' selected' : ''}>${esc(d.number ? phone(d.number) || d.number : (d.from ? 'comme ' + (phone(d.from) || d.from) : 'nouveau SDA'))}</option>`).join('')}</select><span class="dgzoom"><button class="btn" data-omz="-1" title="Zoom arrière">−</button><button class="btn" data-omz="0" title="Ajuster à la fenêtre">Ajuster</button><button class="btn" data-omz="1" title="Zoom avant">+</button></span><button class="btn" id="omdgdl">Télécharger (SVG)</button></div>
        <div class="muted" style="font-size:12.5px;margin-bottom:6px">Parcours d'un appel sur ce SDA d'après le paramétrage du nouveau magasin.</div>
        <div class="diag omdg">${flow ? flow.svg : '<p class="muted">Aucun SDA.</p>'}</div></section>` : ''}
      <p class="note">Les départements reçoivent leur numéro de 3CX à la création ; les autres numéros sont des propositions libres au moment du backup.</p></div>
      <p><button class="btn primary" id="omprint">Imprimer / PDF</button> <button class="btn" id="omcopy">Copier la liste</button> <span class="muted" id="ommsg" style="font-size:12.5px"></span></p>` : '<p class="muted">Aucun magasin dans ce backup.</p>'}</div>`;
  // ---------- événements ----------
  const re = () => V.ouvmag(el);
  $('#omseg').addEventListener('change', e => { S.model = e.target.value; S.plan = null; re(); });
  $('#omcode').addEventListener('change', e => { S.code = e.target.value.trim().toUpperCase(); re(); });
  $('#omname').addEventListener('change', e => { S.name = e.target.value; re(); });
  const cb = $('#omcust'); if(cb) cb.addEventListener('click', () => { S.custom = !S.custom; re(); });
  el.querySelectorAll('details.omsec').forEach(d => d.addEventListener('toggle', () => { S.open[d.dataset.sec] = d.open; }));
  const setPath = (p, v) => { const ks = p.split('.'), last = ks.pop(); const o = ks.reduce((a, k) => a[k], P); o[last.replace(/․/g, '.')] = v; };
  const E = $('#omedit');
  if(E){
    E.addEventListener('change', e => { const t = e.target;
      const ht = t.closest('[data-hours]');
      if(ht){ const days = [...ht.querySelectorAll('tr[data-day]')].map(tr => { const v = c => tr.querySelector('.' + c).value; if(!tr.querySelector('.omo').checked) return null;
          const p = [[v('omb1'), v('ome1')]]; if(tr.querySelector('.om2').checked) p.push([v('omb2'), v('ome2')]); return {day: tr.dataset.day, p: p.filter(([a, b]) => a && b)}; }).filter(x => x && x.p.length);
        setPath(ht.dataset.hours, {type: '', days}); re(); return; }
      const p = t.dataset.p; if(!p) return;
      if(t.dataset.k === 'dest'){ const prev = p.split('.').reduce((a, k) => a && a[k], P); setPath(p, decR(t.value, prev)); }
      else if(t.dataset.k === 'bool'){ if(/\.brkOn$/.test(p)){ const d = P.depts[+p.split('.')[1]]; d.brk = t.checked ? {type: '', days: DAY_ORDER.slice(0, 5).map(day => ({day, p: [['12:00', '13:00']]}))} : null; } else setPath(p, t.checked); }
      else if(t.type === 'number') setPath(p, t.value === '' ? '' : +t.value);
      else setPath(p, t.value.trim());
      re(); });
    E.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if(!b) return; const [act, arg] = b.dataset.act.split(':'), id = 'n' + Date.now().toString(36);
      if(act === 'adddept'){ const g = FULL.groups.find(x => x.number === (el.querySelector('#omdcopy') || {}).value);
        P.depts.push(g ? {id, from: '', copyOf: g.number, name: g.name, nameEd: '', hours: clone(g.hours) || {type: '', days: []}, brk: clone(g.breakTime),
            routes: {office: ref(g.routes.office), outOfOffice: ref(g.routes.outOfOffice), holidays: ref(g.routes.holidays), break: ref(g.routes.break)}, prompts: {...(g.prompts || {})}}
          : {id, from: '', name: 'Nouveau département', nameEd: '', hours: {type: '', days: DAY_ORDER.slice(0, 5).map(day => ({day, p: [['09:00', '17:00']]}))}, brk: null, routes: {office: {t: 'none'}, outOfOffice: {t: 'vm', dn: ''}, holidays: {t: 'none'}, break: {t: 'none'}}, prompts: {}});
        S.open.depts = true; }
      if(act === 'add'){ const blank = {depts: {id, from: '', name: 'Nouveau département', nameEd: '', hours: {type: '', days: DAY_ORDER.slice(0, 5).map(day => ({day, p: [['09:00', '17:00']]}))}, brk: null, routes: {office: {t: 'none'}, outOfOffice: {t: 'vm', dn: ''}, holidays: {t: 'none'}, break: {t: 'none'}}, prompts: {}},
          ivrs: {id, from: '', name: 'Nouveau menu', nameEd: '', prompt: '', timeout: 10, tAct: {t: 'repeat'}, invalid: {t: 'none'}, options: [{key: '1', dest: {t: 'none'}}]},
          queues: {id, from: '', name: 'Nouvelle file', nameEd: '', strategy: 'RingAll', ring: 20, maxWait: 120, overflow: {t: 'vm', dn: ''}, intro: '', announce: false, agents: 2},
          rgs: {id, from: '', name: 'Nouveau groupe', nameEd: '', strategy: 'RingAll', ringTime: 20, members: 2, dest: {t: 'vm', dn: ''}},
          dids: {id, from: '', number: '', line: (FULL.lines[0] || {}).number || '', office: {t: 'none'}, ooo: {t: 'same'}}, hols: null}[arg];
        if(arg === 'hols') P.holsCustom.push({name: '', date: ''}); else if(blank) P[arg].push(blank); S.open[arg] = true; }
      if(act === 'del'){ const [s, i] = arg.split('.'); const x = P[s][+i];
        // destinations qui visaient l'élément retiré : « aucune destination »
        if(x && x.id){ const fix = o => { if(o && typeof o === 'object'){ if(o.t === 'new' && o.id === x.id){ o.t = 'none'; delete o.id; } Object.values(o).forEach(fix); } }; P[s].splice(+i, 1); fix(P); } }
      if(act === 'addopt'){ const [, i] = arg.split('.'); const opts = P.ivrs[+i].options; const used = new Set(opts.map(o => o.key)); const k = '1234567890*#'.split('').find(c => !used.has(c)) || ''; opts.push({key: k, dest: {t: 'none'}}); }
      if(act === 'delopt'){ const [, i, j] = arg.split('.'); P.ivrs[+i].options.splice(+j, 1); }
      if(act === 'delhol') P.holsCustom.splice(+arg, 1);
      if(act === 'pkplan' && NEW && num.parks.length){ const pl = pkpLoad(); pl[NEW] = pkSort(num.parks); pkpSave(pl); S.pkMsg = `${pkFmt(num.parks)} ajoutés au Plan des parkings pour ${NEW}.`; }
      if(act === 'reset'){ S.plan = baseOf(M); }
      re(); });
  }
  const ex = $('#omexp'); if(ex) ex.addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({type: '3CXplore-ouverture-magasin', version: 1, model: M, code: S.code, name: S.name, plan: P}, null, 1)], {type: 'application/json'})); a.download = 'ouverture-' + ((NEW || 'magasin').toLowerCase()) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  const im = $('#omimp'); if(im) im.addEventListener('change', async e => { const f = e.target.files[0]; if(!f) return; try{ const j = JSON.parse(await f.text());
      if(j.type !== '3CXplore-ouverture-magasin' || !j.plan || !Array.isArray(j.plan.depts)) throw new Error('fichier non reconnu');
      if(j.model && stores.includes(j.model)) S.model = j.model; S.code = j.code || ''; S.name = j.name || ''; S.plan = j.plan; S.planOf = S.model; S.custom = true; re(); }
    catch(er){ $('#omimpmsg').textContent = 'Import impossible : ' + er.message + '.'; } });
  const ds = $('#omdid'); if(ds) ds.addEventListener('change', e => { S.did = e.target.value; re(); });
  const box = el.querySelector('.omdg');
  if(box && flow){ let z = 1; const svgEl = () => box.querySelector('svg');
    const apply = () => { const v = svgEl(); if(v){ v.setAttribute('width', flow.W * z); v.setAttribute('height', flow.Hh * z); } };
    const fit = () => { z = Math.min(1.2, Math.max(.25, (box.clientWidth - 20) / flow.W)); apply(); };
    fit(); el.querySelectorAll('[data-omz]').forEach(b => b.addEventListener('click', () => { const k = +b.dataset.omz; if(!k) fit(); else { z = Math.min(2, Math.max(.2, z * (k > 0 ? 1.25 : .8))); apply(); } })); }
  const dl = $('#omdgdl'); if(dl && flow) dl.addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([flow.svg], {type: 'image/svg+xml'})); a.download = 'flux-' + (NEW || 'nouveau-magasin').toLowerCase() + '.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  const prb = $('#omprint'); if(prb) prb.addEventListener('click', () => printHTML($('#omsheet').outerHTML.replace('id="omsheet"', '')));
  const cp = $('#omcopy'); if(cp) cp.addEventListener('click', async () => {
    const txt = [`Ouverture du magasin ${NEWN || NEW || ''} (modèle : ${segName(M)})`, ...(diffs.length ? ['\nDifférences avec le modèle', ...diffs.map(x => '   • ' + x)] : []), ...steps.map(([t, path, items], i) => `\n${i + 1}. ${t} (${path})\n` + items.map(x => '   [ ] ' + x).join('\n')),
      `\n${steps.length + 1}. Numérotation proposée\n` + numRows.map(r => '   ' + r.join(' · ')).join('\n')].join('\n');
    try{ await navigator.clipboard.writeText(txt); $('#ommsg').textContent = 'Liste copiée.'; }catch(er){ $('#ommsg').textContent = 'Copie impossible.'; } });
};

