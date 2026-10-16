// ---------- Doublons et incohérences de configuration (15.14) ----------
// constat : [libellé, gravité, famille]
const DBL_K = {
  didtwice: ['Même SDA sur plusieurs trunks', 'bad', 'SDA'], macdup: ['Même téléphone (MAC) sur plusieurs postes', 'bad', 'Téléphones'],
  samemail: ['Même courriel sur plusieurs postes', 'warn', 'Postes'], samename: ['Même nom sur plusieurs postes', 'warn', 'Postes'],
  cidother: ["Numéro présenté d'un autre magasin", 'warn', 'Postes'], dupname: ['Même nom pour plusieurs éléments du même type', 'warn', 'Structure'],
  twin: ['Éléments jumeaux', 'warn', 'Structure'], didxstore: ['SDA dirigé vers un autre magasin', '', 'SDA'],
  samemobile: ['Même cellulaire sur plusieurs postes', '', 'Postes'], cidnone: ["Numéro présenté inconnu du serveur", '', 'Postes'],
  xmember: ["Membre d'un autre magasin", '', 'Structure']};
const DBL_ORD = Object.keys(DBL_K);
const DBL_PL = {'Département': 'départements', "File d'attente": "files d'attente", 'Standard (IVR)': 'standards (IVR)', 'Groupe de sonnerie': 'groupes de sonnerie'};
const DBL_SEV = {bad: 'À corriger', warn: 'À vérifier', '': 'Pour information'};
function dblAnalysis(){
  const out = [], push = (k, items, detail) => out.push({k, items, detail, segs: [...new Set(items.map(n => SEGOF[n] || DIDSEG[n] || SEG_COMMON))]});
  const key = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const groupBy = (list, kf) => { const m = {}; list.forEach(x => { const k = kf(x); if(k) (m[k] ||= []).push(x); }); return Object.values(m).filter(l => l.length > 1); };
  const exts = FULL.extensions, nmE = e => (e.first + ' ' + e.last).trim();
  // postes
  groupBy(exts.filter(e => !/vacant/i.test(nmE(e))), e => key(nmE(e))).forEach(l => push('samename', l.map(e => e.number), `« ${nmE(l[0])} » sur ${l.length} postes`));
  groupBy(exts, e => (e.email || '').trim().toLowerCase()).forEach(l => push('samemail', l.map(e => e.number), `${l[0].email.trim()} sur ${l.length} postes`));
  groupBy(exts, e => normNum(e.mobile)).forEach(l => push('samemobile', l.map(e => e.number), `${phone(l[0].mobile) || l[0].mobile} sur ${l.length} postes`));
  const macs = {}; exts.forEach(e => e.devices.forEach(d => { if(d.mac) (macs[d.mac.toUpperCase()] ||= new Set()).add(e.number); }));
  Object.entries(macs).filter(([, s]) => s.size > 1).forEach(([m, s]) => push('macdup', [...s], `MAC ${m} provisionnée sur ${s.size} postes`));
  // numéro présenté : SDA d'un autre magasin, ou numéro qui n'est pas un SDA du serveur
  const didSeg = {}; FULL.lines.forEach(l => l.dids.forEach(d => { const k = normNum(d); if(k) didSeg[k] = DIDSEG[d] || SEG_COMMON; })); // 18.2.22 : tous les SDA du système
  const cidO = {}, cidN = {};
  exts.forEach(e => { const k = normNum(e.callerId); if(!k) return; const es = SEGOF[e.number] || SEG_COMMON, ds = didSeg[k];
    if(ds === undefined) (cidN[k] ||= []).push(e.number);
    else if(ds[0] !== '@' && es[0] !== '@' && ds !== es) (cidO[k + '|' + ds] ||= []).push(e.number); });
  Object.entries(cidO).forEach(([kk, l]) => { const [k, ds] = kk.split('|'); push('cidother', l, `présente ${phone(k) || k}, SDA du magasin ${segShort(ds)} (${l.length} poste${l.length > 1 ? 's' : ''})`); });
  Object.entries(cidN).forEach(([k, l]) => push('cidnone', l, `présente ${phone(k) || k}, qui n'est aucun SDA du serveur (${l.length} poste${l.length > 1 ? 's' : ''})`));
  // structure : même nom, jumeaux, membres d'un autre magasin
  const els = [...FULL.groups.filter(g => !isSysGroup(g)).map(g => ['Département', g]), ...FULL.queues.map(q => ["File d'attente", q]), ...FULL.ivrs.map(i => ['Standard (IVR)', i]), ...FULL.ringGroups.map(r => ['Groupe de sonnerie', r])];
  groupBy(els, ([k, x]) => key(x.name) && k + '|' + key(x.name)).forEach(l => push('dupname', l.map(([, x]) => x.number), `« ${l[0][1].name} » : ${l.length} ${DBL_PL[l[0][0]]}`));
  const rk = d => d ? `${d.to}:${d.dn || d.ext || ''}` : '';
  const gm = g => g.members.map(m => m.dn).sort().join(',');
  groupBy(FULL.groups.filter(g => !isSysGroup(g) && g.members.length >= 2), g => gm(g) + '|' + ['office', 'outOfOffice', 'holidays', 'break'].map(k => rk(g.routes[k])).join('|') + '|' + JSON.stringify(g.hours || ''))
    .forEach(l => push('twin', l.map(g => g.number), `${l.length} départements avec les mêmes ${l[0].members.length} membres, les mêmes horaires et le même acheminement`));
  groupBy(FULL.queues.filter(q => q.members.length >= 2), q => q.members.map(m => m.dn).sort().join(',') + '|' + rk(q.dest))
    .forEach(l => push('twin', l.map(q => q.number), `${l.length} files avec les mêmes ${l[0].members.length} agents et le même débordement`));
  groupBy(FULL.ringGroups.filter(r => r.members.length >= 2), r => r.members.slice().sort().join(',') + '|' + rk(r.dest))
    .forEach(l => push('twin', l.map(r => r.number), `${l.length} groupes de sonnerie avec les mêmes ${l[0].members.length} membres et la même destination`));
  const xm = {}; const real = s => s && s[0] !== '@';
  FULL.groups.filter(g => !isSysGroup(g)).forEach(g => g.members.forEach(m => { const a = SEGOF[g.number], b = SEGOF[m.dn]; if(real(a) && real(b) && a !== b && DN[m.dn]) (xm[g.number] ||= []).push(m.dn); }));
  FULL.queues.forEach(q => q.members.forEach(m => { const a = SEGOF[q.number], b = SEGOF[m.dn]; if(real(a) && real(b) && a !== b && DN[m.dn]) (xm[q.number] ||= []).push(m.dn); }));
  Object.entries(xm).forEach(([n, l]) => push('xmember', [n, ...l], `${l.length} membre${l.length > 1 ? 's' : ''} rattaché${l.length > 1 ? 's' : ''} à un autre magasin (${[...new Set(l.map(x => segShort(SEGOF[x])))].join(', ')})`));
  // SDA : sur plusieurs trunks, dirigé vers un autre magasin
  const dl = {}; FULL.lines.forEach(l => l.dids.forEach(d => { const k = normNum(d); if(k) (dl[k] ||= new Set()).add(l.number); }));
  Object.entries(dl).filter(([, s]) => s.size > 1).forEach(([k, s]) => { const r = allDIDs.find(x => normNum(x.did) === k); push('didtwice', [r ? r.did : k], `${phone(k) || k} déclaré sur ${s.size} trunks (${[...s].join(', ')})`); });
  // 18.2.23 : contrôle « SDA dirigé vers un autre magasin » retiré (le magasin d'un SDA est déduit de sa destination : il ne pouvait pas se déclencher)
  return out.map(x => ({...x, sev: DBL_K[x.k][1], fam: DBL_K[x.k][2]}));
}
V.doublons = el => {
  const all = dblAnalysis(), rows = all.filter(x => !SEG || x.segs.includes(SEG));
  const cnt = k => rows.filter(x => x.k === k).length, sevN = s => rows.filter(x => x.sev === s).length;
  const item = n => DN[n] ? dnLink(n) : `<span class="mono">${esc(phone(n) || n)}</span>`;
  el.innerHTML = `<div id="dblwrap"><h2>Doublons et incohérences</h2>
    <p class="lead">Ce qui est configuré deux fois ou de façon contradictoire : même nom, même courriel ou même téléphone sur plusieurs postes, numéro présenté d'un autre magasin, éléments jumeaux, SDA en double ou dirigés vers un autre magasin${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="grid kpis">${[['À corriger', nf(sevN('bad')), sevN('bad') ? 'bad' : ''], ['À vérifier', nf(sevN('warn')), sevN('warn') ? 'warn' : ''], ['Pour information', nf(sevN('')), '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="tw"><table><thead><tr><th>Constat</th><th>Famille</th><th class="num">Cas</th></tr></thead><tbody>
      ${DBL_ORD.filter(k => cnt(k)).map(k => `<tr class="click" data-k="${k}"><td><span class="pill ${DBL_K[k][1]}">${esc(DBL_K[k][0])}</span></td><td>${esc(DBL_K[k][2])}</td><td class="num">${nf(cnt(k))}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucun doublon ni incohérence trouvé.</td></tr>'}</tbody></table></div>
    <h3>Détail</h3><div id="dblt"></div>
    <p class="note">« Numéro présenté d'un autre magasin » : le numéro affiché chez le client quand le poste appelle (Caller ID) est un SDA d'un autre magasin — le client rappellera le mauvais magasin. « Éléments jumeaux » : mêmes membres et même acheminement ; souvent un ancien élément oublié, parfois voulu. « Membre d'un autre magasin » et « SDA dirigé vers un autre magasin » sont souvent voulus (personnel partagé, centre d'appels) : à vérifier seulement s'ils surprennent. Le classement par magasin vient de l'onglet Magasins.</p></div>`;
  const T = window.__dblT ||= {};
  table($('#dblt'), {rows, pageSize: 50, sort: [0, 1], state: T,
    search: x => [DBL_K[x.k][0], x.fam, x.detail, ...x.items, ...x.items.map(n => dnName(n)), ...x.segs.map(segShort)].join(' '),
    filters: [{label: 'Tous les constats', options: DBL_ORD.map(k => [k, DBL_K[k][0]]), test: (x, v) => x.k === v}, {label: 'Toutes les gravités', options: Object.entries(DBL_SEV), test: (x, v) => x.sev === v}],
    cols: [{h: 'Constat', v: x => DBL_ORD.indexOf(x.k), f: x => `<span class="pill ${x.sev}">${esc(DBL_K[x.k][0])}</span>`}, {h: 'Détail', v: x => x.detail},
      {h: 'Éléments', v: x => x.items.length, f: x => x.items.map(item).join(' · ')}, {h: 'Magasin', v: x => x.segs.map(segShort).join(', ')}]});
  el.querySelectorAll('tr[data-k]').forEach(tr => tr.addEventListener('click', () => { const s = $('#dblt select[data-f="0"]'); s.value = tr.dataset.k; s.dispatchEvent(new Event('change')); $('#dblt').scrollIntoView({behavior: 'smooth'}); }));
  $('#dblt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="dblexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#dblexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Constat', 'Gravité', 'Famille', 'Détail', 'Éléments', 'Magasins']].concat(rows.map(x => [DBL_K[x.k][0], DBL_SEV[x.sev], x.fam, x.detail, x.items.map(n => DN[n] ? `${n} ${dnName(n)}` : n).join(' | '), x.segs.map(segShort).join(', ')]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'doublons-incoherences.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
