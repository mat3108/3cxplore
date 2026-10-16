// ---------- Numéros importants (15.12) : contacts clés (clients, fournisseurs, siège…) suivis appel par appel ----------
// liste gardée seulement dans ce navigateur (clé vip3cx:<système>), incluse dans la Sauvegarde des réglages
const VIP_KEY = 'vip3cx:' + (FULL.info.fqdn || '');
const VIP_CATS = {client: 'Client important', fournisseur: 'Fournisseur', siege: 'Siège / direction', partenaire: 'Partenaire', autre: 'Autre'};
const VIP_GOAL0 = {client: 2, fournisseur: 24, siege: 4, partenaire: 24, autre: 24}; // objectif de rappel (heures)
function vipLoad(){ let v = {}; try{ v = JSON.parse(localStorage.getItem(VIP_KEY) || '{}'); }catch(e){} v.contacts ||= []; v.goals = {...VIP_GOAL0, ...(v.goals || {})}; v.p ||= '30'; return v; }
const vipSave = v => { try{ localStorage.setItem(VIP_KEY, JSON.stringify(v)); }catch(e){} };
const vipNums = v => { const m = {}; v.contacts.forEach(c => (c.nums || []).forEach(n => { const k = normNum(n); if(k) m[k] = c; })); return m; };
// étoile à côté d'un numéro (Appels, Appels manqués, Historique client, Provenance, Appels suspects)
let VIP_MEMO = {t: 0, m: {}}; // liste relue au plus une fois par seconde pendant l'affichage d'un tableau
function vipStar(num){ const k = normNum(num); if(!k) return ''; if(Date.now() - VIP_MEMO.t > 1000) VIP_MEMO = {t: Date.now(), m: vipNums(vipLoad())}; const on = !!VIP_MEMO.m[k];
  return ` <button type="button" class="vipst${on ? ' on' : ''}" data-vip="${esc(k)}" title="${on ? 'Numéro important (cliquer pour retirer)' : 'Ajouter aux numéros importants'}">${on ? '★' : '☆'}</button>`; }
// 18.1.30 : le clic (branché une seule fois) passe par la fonction de l'affichage en cours (magasin et système à jour)
window.__app.vipToggle = b => {
    const k = b.dataset.vip, v = vipLoad(), cur = vipNums(v)[k];
    if(cur){ cur.nums = cur.nums.filter(n => normNum(n) !== k); if(!cur.nums.length) v.contacts = v.contacts.filter(c => c !== cur); }
    else v.contacts.push({id: 'c' + Date.now().toString(36), name: '', nums: [k], cat: 'client', seg: SEG && SEG[0] !== '@' ? SEG : '', note: ''});
    vipSave(v); VIP_MEMO.t = 0; const on = !cur;
    document.querySelectorAll(`[data-vip="${k}"]`).forEach(x => { x.classList.toggle('on', on); x.textContent = on ? '★' : '☆'; x.title = on ? 'Numéro important (cliquer pour retirer)' : 'Ajouter aux numéros importants'; }); };
if(!window.__vipWired){ window.__vipWired = true;
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-vip]'); if(!b) return; e.preventDefault(); e.stopPropagation(); window.__app.vipToggle(b);
    if(location.hash.startsWith('#vip')) window.__app.route(); }, true); }
// analyse : appels reçus, répondus, manqués, rappels, délais, sur la période ; rappel cherché jusqu'à la fin de l'historique
function vipAnalysis(v){
  const all = FULL.calls, idx = vipNums(v), end = all.length ? Date.parse(all[0][0]) : Date.now();
  const vF = all.length ? localParts(all[all.length - 1][0])[0] : '', vL = all.length ? localParts(all[0][0])[0] : '', vR = perIsC(v.p) ? perRange(v.p, vF, vL) : null;
  const from = v.p === 'all' ? 0 : vR ? dayStartTs(vR[0]) : end - (+v.p) * 864e5, toTs = vR ? dayStartTs(addDaysISO(vR[1], 1)) : Infinity;
  const R = {}, served = {}; v.contacts.forEach(c => R[c.id] = {c, inc: [], out: [], ans: 0, lost: 0, waits: [], missed: [], talk: {}});
  for(const c of all){ const t = Date.parse(c[0]);
    if(c[1] === 'in'){ const k = normNum(c[2]), ct = idx[k]; if(!ct) continue; const r = R[ct.id]; if(ST_ANS.has(c[10]) && (!ct.seg || callSeg(c) === ct.seg)) (served[ct.id] ||= []).push(t); // 18.2.9 : servi par le magasin du contact
      if(t >= from && t < toTs){ r.inc.push(c); if(ST_ANS.has(c[10])){ r.ans++; const by = c[13] || c[6]; if(by && by !== 'VM') r.talk[by] = (r.talk[by] || 0) + 1; if(c.length > 12 && c[12] != null) r.waits.push(c[12]); } else if(ST_LOST.has(c[10])){ r.lost++; r.missed.push(c); } } }
    else if(c[1] === 'out'){ const k = normNum(c[4]), ct = idx[k]; if(!ct) continue; const r = R[ct.id]; r.out.push(c); if(t >= from && t < toTs) r.talk[c[2]] = (r.talk[c[2]] || 0) + 1; } }
  const med = a => { if(!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
  Object.values(R).forEach(r => { const goal = (v.goals[r.c.cat] || 24) * 3600e3;
    // rappel d'un appel manqué : appel sortant vers le contact, ou appel du contact servi, après l'appel manqué
    const events = [...r.out.filter(c => c[10] === 'ans' && c[8] > 0 && (!r.c.seg || callSeg(c) === r.c.seg)).map(c => Date.parse(c[0])), ...(served[r.c.id] || [])].sort((a, b) => a - b); // 18.2.9 : rappel abouti, du magasin du contact
    r.missedInfo = r.missed.map(c => { const t = Date.parse(c[0]), back = events.find(x => x > t); return {c, t, back: back || null, delay: back ? (back - t) / 1000 : null, late: back ? back - t > goal : end - t > goal}; });
    r.open = r.missedInfo.filter(m => !m.back); r.late = r.missedInfo.filter(m => m.late && !m.back);
    r.oldest = r.open.length ? Math.min(...r.open.map(m => m.t)) : null;
    r.medWait = med(r.waits); r.medBack = med(r.missedInfo.filter(m => m.delay != null).map(m => m.delay));
    const all2 = [...r.inc, ...r.out.filter(c => Date.parse(c[0]) >= from && Date.parse(c[0]) < toTs)]; r.last = all2.length ? all2.map(c => c[0]).sort().pop() : null;
    r.top = Object.entries(r.talk).sort((a, b) => b[1] - a[1])[0] || null; });
  return {R, end, from, toTs, vF, vL};
}
function vipSummary(){ const v = vipLoad(); if(!v.contacts.length) return null; const A = vipAnalysis({...v, p: '30'}); const rs = Object.values(A.R).filter(r => !SEG || !r.c.seg || r.c.seg === SEG);
  return {open: rs.reduce((s, r) => s + r.open.length, 0), late: rs.reduce((s, r) => s + r.late.length, 0), who: rs.filter(r => r.late.length).map(r => r.c.name || phone(r.c.nums[0]) || r.c.nums[0])}; }
const vipBanner = () => { const s = vipSummary(); if(!s || !s.open) return '';
  return `<a class="card rbanner vipban" href="#vip" style="display:flex;gap:10px;align-items:center;border-left:3px solid var(--${s.late ? 'bad' : 'warn'});margin:0 0 12px"><span style="font-size:20px">★</span><span><b>Numéros importants : ${nf(s.open)} appel${s.open > 1 ? 's' : ''} manqué${s.open > 1 ? 's' : ''} non rappelé${s.open > 1 ? 's' : ''}${s.late ? `, dont ${nf(s.late)} en retard` : ''}</b>${s.who.length ? `<br><span class="muted" style="font-size:12.5px">${esc(s.who.slice(0, 5).join(', '))}${s.who.length > 5 ? '…' : ''}</span>` : ''}</span></a>`; };
// encadré d'alerte sur le tableau de bord et dans Priorités
['dashboard', 'priorites'].forEach(k => { const f = V[k]; if(f) V[k] = function(el, ...a){ const r = f.call(this, el, ...a); try{ const b = vipBanner(); if(b){ const h = el.querySelector('h2'); if(h) h.insertAdjacentHTML('afterend', b); else el.insertAdjacentHTML('afterbegin', b); } }catch(e){} return r; }; });
const vipFmtDelay = s => s == null ? '–' : s < 3600 ? Math.round(s / 60) + ' min' : s < 86400 ? (s / 3600).toFixed(1).replace('.', ',') + ' h' : (s / 86400).toFixed(1).replace('.', ',') + ' j';
const vipWait = s => s == null ? '–' : s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
V.vip = el => {
  const v = vipLoad(), A = vipAnalysis(v), S = window.__vipUi ||= {add: false, goals: false};
  const rows = Object.values(A.R).filter(r => !SEG || !r.c.seg || r.c.seg === SEG);
  const sum = k => rows.reduce((s, r) => s + (typeof k === 'function' ? k(r) : r[k]), 0);
  const waits = rows.flatMap(r => r.waits), backs = rows.flatMap(r => r.missedInfo.filter(m => m.delay != null).map(m => m.delay));
  const med = a => { if(!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  const fromDay = A.from ? localParts(new Date(A.from).toISOString())[0] : '', toDay = localParts(new Date(isFinite(A.toTs) ? A.toTs - 1 : A.end).toISOString())[0];
  const catSel = (id, cur) => `<select id="${id}">${Object.entries(VIP_CATS).map(([k, l]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const segSel = (id, cur) => `<select id="${id}"><option value="">Tous les magasins</option>${stores.map(s => `<option value="${esc(s)}"${s === cur ? ' selected' : ''}>${esc(segName(s))}</option>`).join('')}</select>`;
  el.innerHTML = `<div id="vipwrap"><h2>Numéros importants</h2>
    <p class="lead">Vos contacts clés (gros clients, fournisseurs, siège, partenaires) suivis appel par appel : appels manqués, rappels en retard, délai de réponse et qui leur parle${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. La liste reste dans ce navigateur (incluse dans la Sauvegarde des réglages) ; ajoutez des numéros ici, avec l'étoile ☆ dans les onglets d'appels, depuis l'annuaire 3CX ou par un fichier CSV.</p>
    <div class="bar"><label class="count">Période</label>${perUI('vipp', v.p, A.vF, A.vL)}${fromDay ? `<span class="count">du ${fromDay} au ${toDay}</span>` : ''}<span style="flex:1"></span>
      <button class="btn primary" id="vipadd">Ajouter un contact</button><button class="btn" id="vippb">Depuis l'annuaire 3CX</button><label class="btn">Importer (CSV)<input type="file" id="vipimp" accept=".csv,.txt,text/csv" hidden></label><button class="btn" id="vipgoal">Objectifs de rappel</button></div>
    <span class="muted" id="vipmsg" style="font-size:12.5px"></span>
    ${S.add ? `<div class="card vipform"><h3 style="margin-top:0">Nouveau contact</h3><div class="omrow"><span>Nom</span><div><input id="vfname" placeholder="ex. Fournisseur pièces" style="width:260px"></div></div>
      <div class="omrow"><span>Numéros</span><div><input id="vfnums" placeholder="un ou plusieurs, séparés par des virgules" style="width:320px"></div></div>
      <div class="omrow"><span>Catégorie</span><div>${catSel('vfcat', 'client')}</div></div><div class="omrow"><span>Magasin</span><div>${segSel('vfseg', SEG && SEG[0] !== '@' ? SEG : '')}</div></div>
      <div class="omrow"><span>Note</span><div><input id="vfnote" style="width:320px"></div></div><p><button class="btn primary" id="vfsave">Ajouter</button> <button class="btn" id="vfcancel">Annuler</button></p></div>` : ''}
    ${S.goals ? `<div class="card"><h3 style="margin-top:0">Objectifs de rappel</h3><p class="muted" style="font-size:12.5px;margin-top:0">Délai maximal pour rappeler un appel manqué ; au-delà, l'appel est « en retard ».</p>${Object.entries(VIP_CATS).map(([k, l]) => `<div class="omrow"><span>${esc(l)}</span><div><input type="number" min="1" data-goal="${k}" value="${v.goals[k]}" style="width:70px"> h</div></div>`).join('')}</div>` : ''}
    ${v.contacts.length ? `<div class="grid kpis">${[['Contacts suivis', nf(rows.length), ''], ['Appels reçus', nf(sum(r => r.inc.length)), ''], ['Appels manqués', nf(sum('lost')), sum('lost') ? 'warn' : ''], ['Manqués non rappelés', nf(sum(r => r.open.length)), sum(r => r.open.length) ? 'bad' : ''], ['En retard sur l\'objectif', nf(sum(r => r.late.length)), sum(r => r.late.length) ? 'bad' : ''], ['Délai de réponse médian', vipWait(med(waits)), ''], ['Délai de rappel médian', vipFmtDelay(med(backs)), '']]
      .map(([l, x, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${x}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <h3>Contacts</h3><div id="vipt"></div>
    <p><button class="btn" id="vipexp">Exporter (CSV)</button> <button class="btn" id="vipprint">Imprimer les rappels en retard</button></p>
    <p class="note">Appel manqué : abandon en file, raccroché au menu, non répondu, renvoi sans réponse ou raccroché en parking. Il est « rappelé » si un appel sortant a été fait vers le contact, ou si le contact a rappelé et a été servi, après l'appel manqué (cherché jusqu'à la fin de l'historique du backup). « En retard » : non rappelé, ou rappelé, au-delà de l'objectif de sa catégorie. Délai de réponse : comme l'onglet Délai avant réponse (backup rouvert avec la 15.3 ou plus récente).</p>`
    : '<div class="card"><p class="muted" style="margin:0">Aucun numéro important pour l\'instant. Ajoutez un contact, cliquez sur une étoile ☆ dans les onglets Appels, Appels manqués, Historique client, Provenance ou Appels suspects, ou importez une liste.</p></div>'}</div>`;
  const re = () => V.vip(el), save = () => { vipSave(v); re(); }, msg = t => { const m = $('#vipmsg'); if(m) m.textContent = t; };
  perWire('vipp', v.p, A.vF, A.vL, x => { v.p = x; save(); });
  $('#vipadd').addEventListener('click', () => { S.add = !S.add; re(); });
  $('#vipgoal').addEventListener('click', () => { S.goals = !S.goals; re(); });
  el.querySelectorAll('[data-goal]').forEach(i => i.addEventListener('change', () => { v.goals[i.dataset.goal] = Math.max(1, +i.value || 1); save(); }));
  const fs = $('#vfsave'); if(fs) fs.addEventListener('click', () => { const nums = $('#vfnums').value.split(/[,;\/|]+/).map(x => normNum(x)).filter(Boolean);
    if(!nums.length){ msg('Indiquez au moins un numéro de 10 chiffres.'); return; }
    v.contacts.push({id: 'c' + Date.now().toString(36), name: $('#vfname').value.trim(), nums, cat: $('#vfcat').value, seg: $('#vfseg').value, note: $('#vfnote').value.trim()}); S.add = false; save(); });
  const fc = $('#vfcancel'); if(fc) fc.addEventListener('click', () => { S.add = false; re(); });
  // annuaire 3CX : cocher des contacts à suivre
  $('#vippb').addEventListener('click', () => { const pb = (FULL.phonebook || []).map((p, i) => ({i, name: [p.first, p.last].filter(Boolean).join(' ') || p.company || '', company: p.company || '', nums: [p.phone, ...(p.other || [])].map(normNum).filter(Boolean)})).filter(p => p.nums.length);
    openDrawer('Ajouter depuis l\'annuaire 3CX', pb.length ? `<p class="muted" style="font-size:12.5px;margin-top:0">${nf(pb.length)} contact(s) avec un numéro. Cochez ceux à suivre.</p><input type="search" id="vippbq" placeholder="Rechercher…" style="width:100%;margin-bottom:8px">
      <div id="vippbl" style="max-height:55vh;overflow:auto">${pb.map(p => `<label class="vippbi" style="display:flex;gap:8px;padding:3px 0"><input type="checkbox" value="${p.i}"> <span>${esc(p.name)}${p.company && p.company !== p.name ? ` <span class="muted">${esc(p.company)}</span>` : ''} <span class="mono muted">${esc(p.nums.map(phone).join(', '))}</span></span></label>`).join('')}</div>
      <p><button class="btn primary" id="vippbok">Ajouter les contacts cochés</button></p>` : '<p class="muted">L\'annuaire 3CX de ce backup ne contient aucun numéro.</p>');
    const q = document.getElementById('vippbq'); if(q) q.addEventListener('input', () => { const t = q.value.toLowerCase(); document.querySelectorAll('.vippbi').forEach(l => { l.style.display = l.textContent.toLowerCase().includes(t) ? '' : 'none'; }); });
    const ok = document.getElementById('vippbok'); if(ok) ok.addEventListener('click', () => { const have = vipNums(v); let n = 0;
      document.querySelectorAll('#vippbl input:checked').forEach(c => { const p = pb[+c.value]; const nums = p.nums.filter(x => !have[x]); if(!nums.length) return; v.contacts.push({id: 'c' + Date.now().toString(36) + n, name: p.name, nums, cat: 'client', seg: '', note: p.company && p.company !== p.name ? p.company : ''}); n++; });
      vipSave(v); closeDrawer(); re(); msg(`${n} contact(s) ajouté(s) depuis l'annuaire.`); }); });
  // import CSV : nom ; numéro(s) ; catégorie ; magasin (ordre libre, séparateurs ; , ou tabulation)
  $('#vipimp').addEventListener('change', async e => { const f = e.target.files[0]; if(!f) return; const txt = await f.text(), have = vipNums(v); let n = 0;
    const catOf = s => Object.entries(VIP_CATS).find(([k, l]) => s && (s.toLowerCase() === k || s.toLowerCase() === l.toLowerCase()))?.[0];
    txt.split(/\r?\n/).forEach(line => { const cells = line.split(/[;\t,]/).map(x => x.trim().replace(/^"|"$/g, '')).filter(Boolean); if(!cells.length) return;
      const nums = cells.map(normNum).filter(x => x && !have[x]); if(!nums.length) return;
      const name = cells.find(x => !normNum(x) && !catOf(x) && !stores.includes(x)) || '', cat = cells.map(catOf).find(Boolean) || 'client', seg = cells.find(x => stores.includes(x)) || '';
      nums.forEach(x => have[x] = true); v.contacts.push({id: 'c' + Date.now().toString(36) + n, name, nums, cat, seg, note: ''}); n++; });
    vipSave(v); re(); msg(`${n} contact(s) importé(s).`); });
  if(!v.contacts.length) return;
  table($('#vipt'), {rows, pageSize: 50, sort: [5, -1], state: (window.__vipT ||= {}),
    search: r => [r.c.name, ...(r.c.nums || []), ...(r.c.nums || []).map(phone), VIP_CATS[r.c.cat], r.c.seg && segShort(r.c.seg), r.c.note].join(' '),
    filters: [{label: 'Toutes les catégories', options: Object.entries(VIP_CATS), test: (r, x) => r.c.cat === x}, {label: 'Tous les contacts', options: [['late', 'En retard seulement'], ['open', 'Non rappelés seulement']], test: (r, x) => x === 'late' ? r.late.length > 0 : r.open.length > 0}],
    cols: [{h: 'Contact', v: r => r.c.name || r.c.nums[0], f: r => `<b>${esc(r.c.name || phone(r.c.nums[0]) || r.c.nums[0])}</b> <span class="pill">${esc(VIP_CATS[r.c.cat] || r.c.cat)}</span><div class="mono muted" style="font-size:11.5px">${esc((r.c.nums || []).map(phone).join(', '))}</div>`},
      {h: 'Magasin', v: r => r.c.seg ? segShort(r.c.seg) : '', cls: 'muted'}, {h: 'Reçus', num: 1, v: r => r.inc.length, f: r => nf(r.inc.length)}, {h: 'Répondus', num: 1, v: r => r.inc.length ? r.ans / r.inc.length : -1, f: r => pct(r.ans, r.inc.length)},
      {h: 'Manqués', num: 1, v: r => r.lost, f: r => r.lost ? nf(r.lost) : '<span class="muted">0</span>'},
      {h: 'Non rappelés', num: 1, v: r => r.late.length * 1000 + r.open.length, f: r => r.open.length ? `<span class="pill ${r.late.length ? 'bad' : 'warn'}">${nf(r.open.length)}</span> <span class="muted" style="font-size:11.5px">depuis ${vipFmtDelay((A.end - r.oldest) / 1000)}</span>` : '<span class="muted">0</span>'},
      {h: 'Délai de réponse', num: 1, v: r => r.medWait ?? -1, f: r => vipWait(r.medWait)}, {h: 'Délai de rappel', num: 1, v: r => r.medBack ?? -1, f: r => vipFmtDelay(r.medBack)},
      {h: 'Dernier appel', v: r => r.last || '', f: r => r.last ? esc(fmtD(r.last)) : '<span class="muted">—</span>'}, {h: 'Lui parle le plus', v: r => r.top ? r.top[0] : '', f: r => r.top ? `${dnLink(r.top[0])} <span class="muted">(${r.top[1]})</span>` : '<span class="muted">—</span>'}],
    onRow: r => { const c = r.c, hist = [...r.inc.map(x => ['in', x]), ...r.out.filter(x => (!A.from || Date.parse(x[0]) >= A.from) && Date.parse(x[0]) < A.toTs).map(x => ['out', x])].sort((a, b) => a[1][0] < b[1][0] ? 1 : -1).slice(0, 150);
      const mi = new Map(r.missedInfo.map(m => [m.c, m]));
      openDrawer(`★ ${esc(c.name || phone(c.nums[0]) || c.nums[0])}`, `<div class="vipedit"><div class="omrow"><span>Nom</span><div><input id="veName" value="${esc(c.name)}" style="width:100%"></div></div>
        <div class="omrow"><span>Numéros</span><div><input id="veNums" value="${esc(c.nums.join(', '))}" style="width:100%"></div></div><div class="omrow"><span>Catégorie</span><div>${catSel('veCat', c.cat)}</div></div>
        <div class="omrow"><span>Magasin</span><div>${segSel('veSeg', c.seg)}</div></div><div class="omrow"><span>Note</span><div><input id="veNote" value="${esc(c.note || '')}" style="width:100%"></div></div>
        <p><button class="btn primary" id="veSave">Enregistrer</button> <button class="btn" id="veDel">Retirer ce contact</button> <a class="btn" href="#client/${esc(c.nums[0])}">Historique client</a></p></div>
        <h3>Appels (${nf(hist.length)})</h3><div class="tw"><table><thead><tr><th>Date</th><th>Sens</th><th>SDA / poste</th><th>Issue</th><th>Rappel</th></tr></thead><tbody>${hist.map(([d, x]) => { const m = mi.get(x);
          return `<tr style="white-space:nowrap"><td>${esc(fmtD(x[0]))}</td><td>${d === 'in' ? 'Reçu' : 'Passé'}</td><td>${d === 'in' ? `<span class="mono">${esc(phone(x[5]) || x[5] || '')}</span>` : dnLink(x[2])}</td><td>${d === 'in' ? stHTML(x) : (ST_ANS.has(x[10]) ? 'Abouti' : 'Sans réponse')}</td><td>${m ? (m.back ? `<span class="pill ${m.late ? 'warn' : 'ok'}">après ${vipFmtDelay(m.delay)}</span>` : `<span class="pill ${m.late ? 'bad' : 'warn'}">non rappelé</span>`) : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Aucun appel sur la période.</td></tr>'}</tbody></table></div>`);
      document.getElementById('veSave').addEventListener('click', () => { const nums = document.getElementById('veNums').value.split(/[,;\/|]+/).map(x => normNum(x)).filter(Boolean); if(!nums.length) return;
        Object.assign(c, {name: document.getElementById('veName').value.trim(), nums, cat: document.getElementById('veCat').value, seg: document.getElementById('veSeg').value, note: document.getElementById('veNote').value.trim()}); vipSave(v); closeDrawer(); re(); });
      document.getElementById('veDel').addEventListener('click', () => { v.contacts = v.contacts.filter(x => x !== c); vipSave(v); closeDrawer(); re(); }); }});
  $('#vipexp').addEventListener('click', () => { const q = x => '"' + csvSafe(x) + '"';
    const out = [['Contact', 'Numéros', 'Catégorie', 'Magasin', 'Reçus', 'Répondus', 'Manqués', 'Non rappelés', 'En retard', 'Délai de réponse médian (s)', 'Délai de rappel médian (min)', 'Dernier appel', 'Note']]
      .concat(rows.map(r => [r.c.name, r.c.nums.map(phone).join(' / '), VIP_CATS[r.c.cat], r.c.seg ? segShort(r.c.seg) : '', r.inc.length, r.ans, r.lost, r.open.length, r.late.length, r.medWait ?? '', r.medBack != null ? Math.round(r.medBack / 60) : '', r.last ? fmtD(r.last) : '', r.c.note || '']));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(x => x.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'numeros-importants.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  $('#vipprint').addEventListener('click', () => { const late = rows.flatMap(r => r.open.map(m => [r, m])).sort((a, b) => a[1].t - b[1].t);
    printHTML(`<div class="report"><header class="rpcover"><div class="rpk">Numéros importants · 3CXplore</div><h1>Rappels à faire</h1><div class="rpmeta">${nf(late.length)} appel(s) manqué(s) non rappelé(s) · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      <table><thead><tr><th>Contact</th><th>Numéro</th><th>Appel manqué</th><th>Depuis</th><th>Magasin</th><th>Fait</th></tr></thead><tbody>${late.map(([r, m]) => `<tr><td>${esc(r.c.name || '')}${m.late ? ' <b>(en retard)</b>' : ''}</td><td>${esc(phone(m.c[2]) || m.c[2])}</td><td>${esc(fmtD(m.c[0]))}</td><td>${vipFmtDelay((A.end - m.t) / 1000)}</td><td>${esc(r.c.seg ? segShort(r.c.seg) : segShort(callSeg(m.c)))}</td><td>☐</td></tr>`).join('') || '<tr><td colspan="6">Aucun rappel en attente.</td></tr>'}</tbody></table></div>`); });
};

