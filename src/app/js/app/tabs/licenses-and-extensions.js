// ---------- Licences et postes : postes inutilisés, téléphones à récupérer (13.4) ----------
const LIC2 = {never: {l: 'Jamais utilisé', c: 'bad'}, idle: {l: 'Inactif', c: 'warn'}, used: {l: 'Encore dans un acheminement', c: 'bad'},
  noPhone: {l: 'Aucun téléphone', c: ''}, unseen: {l: 'Téléphone jamais vu', c: 'warn'},
  dupName: LIC_REASONS.dupName, dupMail: LIC_REASONS.dupMail, vacant: LIC_REASONS.vacant, disabled: LIC_REASONS.disabled};
const LIC_DAYS = [30, 60, 90, 180];
let LIC2_BASE = null;
function lic2Base(){
  if(LIC2_BASE) return LIC2_BASE;
  const L = licAnalysis();
  // téléphones vus : adresse MAC annoncée dans les rapports de qualité d'appel (dernière date)
  const seen = {}; (FULL.phoneUA || []).forEach(([mac, , , t]) => { if(!seen[mac] || t > seen[mac]) seen[mac] = t; });
  // touches BLF des collègues qui surveillent ce poste
  const blfBy = {}; FULL.extensions.forEach(e => (e.blfs || []).forEach(b => { if(b.type === 'BLF' && b.v && b.v !== e.number) (blfBy[b.v] ||= new Set()).add(e.number); }));
  const refs = dnRefs();
  L.rows.forEach(r => { const rf = refs[r.ext] || [];
    r.route = rf.filter(x => x.cat !== 'member').length; r.member = rf.filter(x => x.cat === 'member').length; r.blfBy = [...(blfBy[r.ext] || [])];
    r.devs = r.e.devices.map(d => { const mac = (d.mac || '').toUpperCase(); return {d, mac, seen: seen[mac] || null}; }); });
  return LIC2_BASE = {L, quality: Object.keys(seen).length > 0};
}
function lic2Rows(days){
  const {L, quality} = lic2Base(), lim = new Date(Date.parse(L.histEnd) - days * 864e5).toISOString();
  return L.rows.map(r => {
    const rs = [], inactive = !r.last || r.last < lim;
    if(!r.last) rs.push('never'); else if(r.last < lim) rs.push('idle');
    if((inactive || !r.e.enabled) && (r.route || r.e.queues.length || r.e.ringGroups.length || r.blfBy.length)) rs.push('used'); // l'appartenance à un département seule ne compte pas
    if(r.e.enabled && !r.devs.length) rs.push('noPhone');
    if(quality && r.devs.length && r.devs.every(x => !x.seen)) rs.push('unseen');
    r.reasons.filter(k => !['never', 'idle'].includes(k)).forEach(k => rs.push(k));
    return {...r, inactive, why: rs};
  });
}
V.licences = el => {
  const S = window.__lic2 ||= {days: 60, t: {}, d: {}};
  const {L, quality} = lic2Base(), all = lic2Rows(S.days), rows = all.filter(r => !SEG || r.seg === SEG);
  const cand = rows.filter(r => r.why.some(k => k !== 'noPhone')), cnt = k => rows.filter(r => r.why.includes(k)).length;
  const lim30 = new Date(Date.parse(L.histEnd) - 30 * 864e5).toISOString();
  // téléphones de bureau rattachés à un poste inutilisé ou désactivé : matériel à récupérer
  const devs = []; rows.filter(r => r.inactive || !r.e.enabled).forEach(r => r.devs.forEach(x => devs.push({r, ...x})));
  const bySeg = {}; rows.forEach(r => { const b = bySeg[r.seg] ||= {seg: r.seg, n: 0, act30: 0, never: 0, idle: 0, used: 0, dup: 0, vacant: 0, devs: 0};
    b.n++; if(r.last && r.last >= lim30) b.act30++; ['never', 'idle', 'used', 'vacant'].forEach(k => { if(r.why.includes(k)) b[k]++; });
    if(r.why.includes('dupName') || r.why.includes('dupMail')) b.dup++; });
  devs.forEach(x => { if(bySeg[x.r.seg]) bySeg[x.r.seg].devs++; });
  const pl = k => `<span class="pill ${LIC2[k].c}">${LIC2[k].l}${k === 'idle' ? ' (' + S.days + ' j)' : ''}</span>`;
  el.innerHTML = `<div id="licwrap"><h2>Licences et postes</h2>
    <p class="lead">Postes qui pourraient être supprimés ou réattribués (jamais utilisés, inactifs, en double, « vacant » ou « test », désactivés), téléphones de bureau à récupérer, et pic d'appels simultanés${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. 3CX V20 est licencié par nombre d'appels simultanés (et non par poste) : supprimer des postes inutiles simplifie la gestion et libère des comptes Microsoft 365 éventuels, mais c'est le pic d'appels simultanés qui détermine la taille de licence. Historique analysé : du ${dayKey(L.histStart)} au ${dayKey(L.histEnd)}.</p>
    <div class="bar"><label>Inactif après <select id="licdays">${LIC_DAYS.map(d => `<option value="${d}"${d === S.days ? ' selected' : ''}>${d} jours</option>`).join('')}</select> sans appel</label></div>
    <div class="grid kpis">${[['Postes', nf(rows.length), ''], ['Jamais utilisés', nf(cnt('never')), 'bad'], [`Inactifs > ${S.days} jours`, nf(cnt('idle')), 'warn'], ['Inutilisés mais encore dans un acheminement', nf(cnt('used')), cnt('used') ? 'bad' : ''],
      ['Téléphones à récupérer', nf(devs.length), devs.length ? 'warn' : ''], ['En double (nom ou courriel)', nf(rows.filter(r => r.why.includes('dupName') || r.why.includes('dupMail')).length), 'warn'], ['« Vacant », « test »…', nf(cnt('vacant')), ''], ['Désactivés', nf(cnt('disabled')), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Appels simultanés (externes, tout le système)</h3>
      <div class="grid kpis">${[['Pic sur tout l\'historique', nf(L.sc.max)], ['Atteint le', L.sc.at ? fmtD(L.sc.at) : '–'], ['Pic des 30 derniers jours', nf(L.sc30.max)], ['Pic quotidien habituel (95 %)', nf(L.sc.p95)]]
        .map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:19px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      <p class="note">Calculé à partir de la durée de chaque appel externe (entrant ou sortant). À comparer au nombre d'appels simultanés de votre licence 3CX (la clé n'est pas lisible dans le backup) : une licence nettement au-dessus du pic habituel peut être réduite au renouvellement ; un pic proche de la limite expose à des appels refusés.</p></div>
    ${SEG ? '' : `<h3>Par magasin</h3><div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Postes</th><th class="num">Actifs (30 j)</th><th class="num">Jamais utilisés</th><th class="num">Inactifs > ${S.days} j</th><th class="num">Encore acheminés</th><th class="num">Téléphones à récupérer</th><th class="num">En double</th><th class="num">« Vacant »/« test »</th></tr></thead><tbody>
      ${Object.values(bySeg).sort((a, b) => (b.never + b.idle) - (a.never + a.idle)).map(b => `<tr><td><b>${esc(segShort(b.seg))}</b></td><td class="num">${nf(b.n)}</td><td class="num">${nf(b.act30)} <span class="muted">${pct(b.act30, b.n)}</span></td><td class="num">${b.never ? `<span class="pill bad">${b.never}</span>` : 0}</td><td class="num">${b.idle ? `<span class="pill warn">${b.idle}</span>` : 0}</td><td class="num">${b.used ? `<span class="pill bad">${b.used}</span>` : 0}</td><td class="num">${b.devs ? `<span class="pill warn">${b.devs}</span>` : 0}</td><td class="num">${b.dup}</td><td class="num">${b.vacant}</td></tr>`).join('')}</tbody></table></div>`}
    <h3>Postes à examiner (${nf(cand.length)})</h3><div id="lict"></div>
    <h3>Téléphones à récupérer (${nf(devs.length)})</h3>
    <p class="muted" style="font-size:13px;margin-top:-4px">Téléphones de bureau rattachés à un poste jamais utilisé, inactif depuis plus de ${S.days} jours ou désactivé : ils peuvent être récupérés ou donnés à un autre employé.</p><div id="licdev"></div>
    <p class="note">« Jamais utilisé » : aucun appel passé, reçu ou répondu sur toute la période de l'historique. « Encore dans un acheminement » : le poste est inutilisé ou désactivé, mais un menu, une file, un groupe de sonnerie, une SDA, un renvoi ou une touche BLF d'un collègue le vise encore (l'appartenance à un département seule ne compte pas) : les appels risquent de s'y perdre. « Téléphone jamais vu » : l'adresse MAC du téléphone n'apparaît dans aucun rapport de qualité d'appel${quality ? '' : ' (non vérifié : aucun rapport de qualité dans ce backup)'} ; il est peut-être débranché ou jamais installé. Vérifiez avant de supprimer : un poste peut servir rarement (remplaçant, salle de réunion, portier) ou avoir été créé récemment.</p></div>`;
  const csvDl = (name, out) => { const q = v => '"' + csvSafe(v) + '"';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const wh = r => r.why.map(k => LIC2[k].l + (k === 'idle' ? ' (' + S.days + ' j)' : '')).join(' | ');
  table($('#lict'), {rows: cand, pageSize: 100, sort: [4, 1], state: S.t,
    search: r => [r.ext, r.name, r.e.email, segShort(r.seg), ...r.why.map(k => LIC2[k].l), ...r.devs.map(x => x.mac)].join(' '),
    filters: [{label: 'Tous les motifs', options: Object.entries(LIC2).map(([k, v]) => [k, v.l]), test: (r, v) => r.why.includes(v)},
              {label: 'Tous les magasins', options: [...new Set(cand.map(r => r.seg))].map(s => [s, segShort(s)]), test: (r, v) => r.seg === v}],
    cols: [{h: 'Poste', v: r => r.ext, f: r => dnLink(r.ext)}, {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'}, {h: 'Courriel', v: r => r.e.email, cls: 'muted'},
      {h: 'Téléphone', v: r => r.devs.length, f: r => r.devs.map(x => esc(x.d.model || x.d.template) + (quality && !x.seen ? ' <span class="pill warn" title="jamais vu dans les rapports de qualité">?</span>' : '')).join(', ') || '<span class="muted">aucun</span>'},
      {h: 'Dernière activité', v: r => r.last || '', f: r => r.last ? fmtD(r.last) : '<span class="pill bad">jamais</span>'},
      {h: 'Acheminements', num: 1, v: r => r.route + r.blfBy.length, f: r => r.route + r.blfBy.length ? `${nf(r.route)}${r.blfBy.length ? ` <span class="muted">+ ${r.blfBy.length} BLF</span>` : ''}` : '<span class="muted">0</span>'},
      {h: 'Motifs', v: r => r.why.length, f: r => r.why.map(pl).join('') + (r.twins.length ? `<div class="muted" style="font-size:11.5px">avec ${r.twins.map(x => dnLink(x)).join(', ')}</div>` : '')}],
    onRow: r => { UB_DN = r.ext; try{ openDrawer(`Poste <span class="mono">${esc(r.ext)}</span> ${esc(r.name)}`, kv([['Magasin', esc(segName(r.seg))], ['Statut du poste', r.e.enabled ? 'activé' : '<span class="pill">désactivé</span>'],
      ['Dernière activité', r.last ? fmtD(r.last) : '<span class="pill bad">jamais sur toute la période</span>'], ['Motifs', r.why.map(pl).join(' ')],
      ['Téléphones', r.devs.map(x => `${esc(x.d.model || x.d.template)} <span class="mono muted">${esc(x.mac)}</span> — ${x.seen ? 'vu le ' + fmtD(x.seen) : quality ? '<span class="pill warn">jamais vu</span>' : 'non vérifiable'}`).join('<br>') || '<span class="muted">aucun</span>'],
      ['Files / groupes / départements', esc([...r.e.queues, ...r.e.ringGroups].join(', ')) || '<span class="muted">aucun</span>'],
      ['Surveillé par (touches BLF)', r.blfBy.map(x => dnLink(x)).join(', ') || '<span class="muted">personne</span>']]) +
      `<p class="muted" style="font-size:12.5px">Avant de supprimer le poste : retirer les acheminements ci-dessous, puis les touches BLF des collègues (onglet Touches BLF). La fiche de départ liste toutes les étapes.</p>`); }finally{ UB_DN = null; } }});
  $('#lict .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="licexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#licexp').addEventListener('click', () => csvDl('postes-a-examiner.csv', [['Poste', 'Nom', 'Magasin', 'Courriel', 'Téléphones', 'Dernière activité', 'Acheminements', 'Touches BLF de collègues', 'Motifs', 'Postes liés']]
    .concat(cand.map(r => [r.ext, r.name, segShort(r.seg), r.e.email, r.devs.map(x => x.d.model).join(', '), r.last ? fmtD(r.last) : 'jamais', r.route, r.blfBy.join(' '), wh(r), r.twins.join(' ')]))));
  table($('#licdev'), {rows: devs, pageSize: 50, sort: [4, 1], state: S.d,
    search: x => [x.mac, x.d.model, x.d.template, x.r.ext, x.r.name, segShort(x.r.seg)].join(' '),
    filters: [{label: 'Tous les magasins', options: [...new Set(devs.map(x => x.r.seg))].map(s => [s, segShort(s)]), test: (x, v) => x.r.seg === v}],
    cols: [{h: 'Modèle', v: x => x.d.model || x.d.template}, {h: 'Adresse MAC', v: x => x.mac, cls: 'mono'}, {h: 'Poste', v: x => x.r.ext, f: x => dnLink(x.r.ext)}, {h: 'Magasin', v: x => segShort(x.r.seg), cls: 'muted'},
      {h: 'Dernière activité du poste', v: x => x.r.last || '', f: x => x.r.last ? fmtD(x.r.last) : '<span class="pill bad">jamais</span>'},
      {h: 'Téléphone vu', v: x => x.seen || '', f: x => x.seen ? fmtD(x.seen) : quality ? '<span class="pill warn">jamais</span>' : '<span class="muted">non vérifiable</span>'},
      {h: 'Motif', v: x => !x.r.e.enabled ? 'disabled' : x.r.why[0], f: x => pl(!x.r.e.enabled ? 'disabled' : x.r.why.includes('never') ? 'never' : 'idle')}]});
  $('#licdev .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="licdexp" style="margin-left:auto">Exporter (CSV)</button>');
  $('#licdexp').addEventListener('click', () => csvDl('telephones-a-recuperer.csv', [['Modèle', 'Adresse MAC', 'Poste', 'Nom', 'Magasin', 'Dernière activité du poste', 'Téléphone vu le']]
    .concat(devs.map(x => [x.d.model || x.d.template, x.mac, x.r.ext, x.r.name, segShort(x.r.seg), x.r.last ? fmtD(x.r.last) : 'jamais', x.seen ? fmtD(x.seen) : quality ? 'jamais' : '']))));
  $('#licdays').addEventListener('change', e => { S.days = +e.target.value; V.licences(el); });
};

