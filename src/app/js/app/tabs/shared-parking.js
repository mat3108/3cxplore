// ---------- Parkings partagés (onglet) ----------
// FULL.parkCalls : [date ISO, parking, secondes, issue, poste qui a parqué, poste qui a repris, 'ext'|'int', SDA]
const PK_OUT = {pickup: ['Repris', 'ok'], back: ['Revenu au poste (délai)', 'warn'], timeout: ['Délai dépassé → autre destination', 'warn'], transfer: ['Transféré', ''], hangup: ['Raccroché en attente', 'bad'], direct: ['Appel direct (parking vide)', ''], other: ['Autre', '']};
const PK_DEST = {PO: 'Retour au poste qui a parqué', OP: 'Opérateur', VM: 'Messagerie vocale', EC: 'Raccrocher'};
const BLF_OF = e => e.blfs || [];
V.parkings = el => {
  const S = window.__pk ||= {};
  const info = FULL.parkInfo || FULL.parks.map(n => ({number: n})), P = FULL.parkCalls;
  const slots = info.filter(p => /^SP\d+$/.test(p.number)).sort((a, b) => +a.number.slice(2) - +b.number.slice(2)), codes = info.filter(p => !/^SP\d+$/.test(p.number));
  const prm = n => (FULL.params || []).find(p => p.name === n)?.value || '';
  // touches de parking sur les téléphones : parking -> postes qui l'affichent
  const onBlf = {}; FULL.extensions.forEach(e => BLF_OF(e).forEach(b => { if(b.type === 'SharedParking' && b.v) (onBlf[b.v] ||= new Set()).add(e.number); }));
  const hasBlf = FULL.extensions.some(e => e.blfs);
  const segOk = n => !SEG || SEGOF[n] === SEG;
  const rows = (P || []).filter(r => r[3] !== 'direct' && segOk(r[4])), direct = (P || []).filter(r => r[3] === 'direct' && segOk(r[4]));
  const cnt = k => rows.filter(r => r[3] === k).length, pc = (a, b) => b ? Math.round(100 * a / b) + ' %' : '—';
  const waits = rows.map(r => r[2]).sort((a, b) => a - b), med = waits.length ? waits[Math.floor(waits.length / 2)] : 0;
  const picked = rows.filter(r => r[3] === 'pickup'), byOther = picked.filter(r => r[5] && r[5] !== r[4]).length;
  const hours = Array(24).fill(0).map(() => ({n: 0, h: 0})); rows.forEach(r => { const h = localParts(r[0])[1]; hours[h].n++; if(r[3] === 'hangup') hours[h].h++; });
  const mx = Math.max(1, ...hours.map(h => h.n));
  const bySeg = {}; rows.forEach(r => { const s = SEGOF[r[4]] || SEG_COMMON, b = bySeg[s] ||= {s, n: 0, pick: 0, other: 0, back: 0, hang: 0, w: 0}; b.n++; b.w += r[2];
    if(r[3] === 'pickup'){ b.pick++; if(r[5] && r[5] !== r[4]) b.other++; } else if(r[3] === 'back' || r[3] === 'timeout') b.back++; else if(r[3] === 'hangup') b.hang++; });
  const byExt = {}; rows.forEach(r => { if(!r[4]) return; const b = byExt[r[4]] ||= {n: 0, hang: 0, back: 0}; b.n++; if(r[3] === 'hangup') b.hang++; if(r[3] === 'back' || r[3] === 'timeout') b.back++; });
  const use = {}; (P || []).forEach(r => { if(r[3] === 'direct') return; const u = use[r[1]] ||= {n: 0, last: ''}; u.n++; if(r[0] > u.last) u.last = r[0]; });
  const visSlots = slots.filter(p => !SEG || [...(onBlf[p.number] || [])].some(n => SEGOF[n] === SEG) || rows.some(r => r[1] === p.number));
  const unused = visSlots.filter(p => !use[p.number]), noBlf = visSlots.filter(p => use[p.number] && !(onBlf[p.number] || []).size), idle = visSlots.filter(p => !use[p.number] && !(onBlf[p.number] || []).size);
  // réglages : valeur la plus fréquente et parkings différents
  const mode = k => { const c = {}; slots.forEach(p => { if(p[k] != null && p[k] !== '') c[p[k]] = (c[p[k]] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || ''; };
  const mT = mode('timeout'), mD = mode('dest'), mA = mode('auto');
  const odd = slots.filter(p => (p.timeout && p.timeout !== mT) || (p.dest && p.dest !== mD) || (p.auto && p.auto !== mA));
  const first = P && P.length ? P.reduce((a, r) => r[0] < a ? r[0] : a, P[0][0]) : '', last = P && P.length ? P.reduce((a, r) => r[0] > a ? r[0] : a, P[0][0]) : '';
  const day = s => s ? FMT_DAY.format(new Date(s)) : '—'; // 18.1.18 : fuseau du système 3CX
  // ---- problèmes détectés (gravité, catégorie, constat, détail, quoi faire, éléments) ----
  const probs = [], addP = (sev, cat, title, detail, fix, items) => probs.push({sev, cat, title, detail, fix, items: items || []});
  const sgs = n => segShort(SEGOF[n] || SEG_COMMON), who = n => n ? `${n} ${dnName(n)}` : '—';
  if(P){
    // parking affiché dans plusieurs magasins, et appels repris par un autre magasin
    const multi = visSlots.map(p => ({p, st: [...new Set([...(onBlf[p.number] || [])].map(n => SEGOF[n]).filter(s => s && s[0] !== '@'))]})).filter(x => x.st.length > 1);
    const cross = rows.filter(r => r[3] === 'pickup' && r[5] && r[4] && SEGOF[r[5]] && SEGOF[r[4]] && SEGOF[r[5]] !== SEGOF[r[4]] && SEGOF[r[5]][0] !== '@' && SEGOF[r[4]][0] !== '@');
    if(multi.length) addP(cross.length ? 'bad' : 'warn', 'Partage', `${multi.length} parking${multi.length > 1 ? 's' : ''} affiché${multi.length > 1 ? 's' : ''} sur des téléphones de plusieurs magasins`,
      cross.length ? `${nf(cross.length)} appel${cross.length > 1 ? 's' : ''} mis en parking par un magasin ont été repris par un autre magasin.` : "Un employé peut reprendre par erreur l'appel d'un autre magasin.",
      'Donner à chaque magasin ses propres parkings (par exemple SP40 à SP44 pour un seul magasin) et retirer les touches des autres magasins.',
      multi.map(x => `${x.p.number} : ${x.st.map(s => segShort(s)).join(', ')} (${(onBlf[x.p.number] || new Set()).size} téléphones)`));
    // attentes bien plus longues que le délai configuré
    const lim = p => (+((info.find(x => x.number === p) || {}).timeout || mT || 180)) * 1.5 + 30;
    const long = rows.filter(r => r[2] > lim(r[1]));
    if(long.length) addP(long.length / rows.length > .02 ? 'warn' : 'info', 'Attente', `${nf(long.length)} appel${long.length > 1 ? 's sont restés' : ' est resté'} en parking bien plus longtemps que le délai (${mT || 180} s)`,
      `Attente maximale ${dur(Math.max(...long.map(r => r[2])))}. Le client attend sans que l'appel revienne au poste comme prévu.`,
      "Vérifier le délai et la destination « si personne ne reprend » de ces parkings, et que la reprise automatique fonctionne sur les téléphones concernés.",
      long.slice().sort((a, b) => b[2] - a[2]).slice(0, 15).map(r => `${fmtD(r[0])} · ${r[1]} · ${who(r[4])} · ${dur(r[2])} · ${PK_OUT[r[3]][0]}`));
    // taux de raccrochés en parking élevé
    const hs = Object.values(bySeg).filter(b => b.n >= 20 && b.hang / b.n > .2), he = Object.entries(byExt).filter(([, b]) => b.n >= 20 && b.hang / b.n > .2);
    if(hs.length || he.length) addP('bad', 'Appels perdus', 'Beaucoup de clients raccrochent pendant qu\'ils attendent en parking',
      `Plus de 20 % des appels mis en parking se terminent par un raccroché pour ${[hs.length ? hs.length + ' magasin' + (hs.length > 1 ? 's' : '') : '', he.length ? he.length + ' poste' + (he.length > 1 ? 's' : '') : ''].filter(Boolean).join(' et ')}.`,
      'Reprendre les appels plus vite (touches de parking visibles chez les collègues), réduire le délai, ou transférer vers une file plutôt que de mettre en parking. Rappeler les clients concernés (section « Appels perdus en parking »).',
      [...hs.map(b => `Magasin ${segShort(b.s)} : ${nf(b.hang)} sur ${nf(b.n)} (${pc(b.hang, b.n)})`), ...he.sort((a, b) => b[1].hang - a[1].hang).map(([n, b]) => `${who(n)} : ${nf(b.hang)} sur ${nf(b.n)} (${pc(b.hang, b.n)})`)]);
    // appels souvent revenus au poste
    const bk = Object.entries(byExt).filter(([, b]) => b.n >= 20 && b.back / b.n > .25);
    if(bk.length) addP('warn', 'Reprise', `${bk.length} poste${bk.length > 1 ? 's voient souvent revenir leurs' : ' voit souvent revenir ses'} appels mis en parking`,
      "Plus de 25 % de leurs appels mis en parking ne sont repris par personne avant le délai.", "Vérifier que les collègues ont les touches de ces parkings et qu'ils sont prévenus (interphone, messagerie), ou transférer directement.",
      bk.sort((a, b) => b[1].back - a[1].back).map(([n, b]) => `${who(n)} : ${nf(b.back)} sur ${nf(b.n)} (${pc(b.back, b.n)})`));
    // postes qui mettent en parking sans touche de parking
    if(hasBlf){ const nk = Object.entries(byExt).filter(([n, b]) => b.n >= 10 && EXT_BY[n] && EXT_BY[n].blfs && !EXT_BY[n].blfs.some(x => x.type === 'SharedParking'));
      if(nk.length) addP('warn', 'Touches', `${nk.length} poste${nk.length > 1 ? 's mettent' : ' met'} des appels en parking sans touche de parking sur le téléphone`,
        "Ils utilisent le code de parking sans voir si le parking est libre ou occupé, et les collègues ne voient pas toujours l'appel en attente.",
        "Ajouter les touches de parking du magasin sur ces téléphones (voir l'onglet Modèle de touches).", nk.sort((a, b) => b[1].n - a[1].n).map(([n, b]) => `${who(n)} : ${nf(b.n)} mise(s) en parking`)); }
    // appels vers un parking vide
    if(direct.length >= 20){ const dp = {}; direct.forEach(r => { if(r[4]) dp[r[4]] = (dp[r[4]] || 0) + 1; });
      addP('info', 'Utilisation', `${nf(direct.length)} appels vers un parking vide`, "Un poste compose un parking alors qu'aucun appel n'y attend (touche mal comprise, appel déjà repris par un collègue).",
        'Rappeler aux employés concernés le fonctionnement des touches de parking (voyant allumé = appel en attente).', Object.entries(dp).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n, k]) => `${who(n)} : ${nf(k)}`)); }
  }
  // parkings inutiles, utilisés sans touche, réglages
  if(P && idle.length) addP('info', 'Nettoyage', `${idle.length} parking${idle.length > 1 ? 's' : ''} jamais utilisé${idle.length > 1 ? 's' : ''} et affiché${idle.length > 1 ? 's' : ''} sur aucun téléphone`,
    'Ils encombrent la configuration sans servir.', 'Les retirer dans la console 3CX, ou réduire le nombre de parkings partagés.', [idle.map(p => p.number).join(', ')]);
  if(hasBlf && noBlf.length) addP('info', 'Touches', `${noBlf.length} parking${noBlf.length > 1 ? 's utilisés' : ' utilisé'} mais affiché${noBlf.length > 1 ? 's' : ''} sur aucun téléphone`,
    'Ils ne sont repris que par code : personne ne voit de voyant quand un appel y attend.', 'Ajouter une touche de ces parkings sur les téléphones qui les utilisent.', noBlf.map(p => `${p.number} : ${nf(use[p.number].n)} mise(s) en parking`));
  if(odd.length) addP('warn', 'Réglages', `${odd.length} parking${odd.length > 1 ? 's ont' : ' a'} des réglages différents des autres`, `Réglage habituel : ${mT || '—'} s, ${PK_DEST[mD] || mD || '—'}.`,
    'Uniformiser le délai et la destination dans la console 3CX, sauf exception voulue.', odd.map(p => `${p.number} : ${p.timeout || '—'} s, ${PK_DEST[p.dest] || p.dest || '—'}`));
  const spc = +prm('SHAREDPARKINGCOUNT'); if(spc && slots.length > spc) addP('info', 'Réglages', `${slots.length} parkings partagés configurés pour un paramètre système de ${spc}`,
    'Le nombre de parkings dépasse la valeur du paramètre SHAREDPARKINGCOUNT.', 'Vérifier lequel des deux est à jour ; supprimer les parkings en trop si besoin.', []);
  const SEVO = {bad: 0, warn: 1, info: 2}; probs.sort((a, b) => SEVO[a.sev] - SEVO[b.sev]);
  // ---- exports ----
  const pkSheets = () => {
    const fd = s => s ? fmtD(s) : '';
    const sh = [{name: 'Problèmes', rows: [['Gravité', 'Catégorie', 'Constat', 'Détail', 'À faire', 'Éléments']].concat(probs.map(p => [({bad: 'Important', warn: 'À vérifier', info: 'Information'})[p.sev], p.cat, p.title, p.detail, p.fix, p.items.join(' | ')]))},
      {name: 'Parkings', rows: [['Parking', 'Mises en parking', 'Dernière utilisation', 'Téléphones', 'Magasins des téléphones', 'Postes qui l\'affichent', 'Délai (s)', 'Si personne ne reprend', 'Reprise automatique']]
        .concat(visSlots.map(p => { const s = [...(onBlf[p.number] || [])].sort(); return [p.number, use[p.number]?.n || 0, fd(use[p.number]?.last), s.length, [...new Set(s.map(sgs))].join(', '), s.join(', '), +p.timeout || '', PK_DEST[p.dest] || p.dest || '', p.auto === '1' ? 'oui' : p.auto === '0' ? 'non' : '']; }))}];
    if(P){
      sh.push({name: 'Mises en parking', rows: [['Date', 'Parking', 'Poste', 'Nom', 'Magasin', 'Attente (s)', 'Issue', 'Repris par', 'Appel']].concat(rows.slice().sort((a, b) => a[0] < b[0] ? 1 : -1).map(r => [fd(r[0]), r[1], r[4], dnName(r[4]), r[4] ? sgs(r[4]) : '', r[2], PK_OUT[r[3]][0], r[3] === 'pickup' ? (r[5] === r[4] ? 'lui-même' : who(r[5])) : '', r[6] === 'ext' ? 'Externe' : 'Interne']))});
      sh.push({name: 'Par magasin', rows: [['Magasin', 'Mises en parking', 'Reprises', 'dont par un collègue', 'Revenues (délai)', 'Raccrochés', 'Attente moy. (s)']].concat(Object.values(bySeg).sort((a, b) => b.n - a.n).map(b => [segShort(b.s), b.n, b.pick, b.other, b.back, b.hang, Math.round(b.w / b.n)]))});
      sh.push({name: 'Par employé', rows: [['Poste', 'Nom', 'Magasin', 'Mises en parking', 'Raccrochés en attente', 'Revenues (délai)']].concat(Object.entries(byExt).sort((a, b) => b[1].n - a[1].n).map(([n, b]) => [n, dnName(n), sgs(n), b.n, b.hang, b.back]))});
      if(FULL.calls.some(c => c[10] === 'park_ab')){ const all = FULL.calls, lastDay = localParts(all[0][0])[0], firstDay = localParts(all[all.length - 1][0])[0];
        const lr = missedAnalysis(firstDay, lastDay).filter(r => r.where === LOST_WHERE.park_ab && (!SEG || r.seg === SEG));
        sh.push({name: 'À rappeler', rows: [['Client', 'Nom affiché', 'Magasin', 'Dernier appel perdu', 'Tentatives', 'Statut', 'Rappelé le']].concat(lr.sort((a, b) => a.last < b.last ? 1 : -1).map(r => [phone(r.num), r.name, segShort(r.seg), fd(r.last), r.n, RAP_ST[r.st].l, r.when ? fd(r.when) : '']))}); }
    }
    return sh;
  };
  const pkDl = (blob, ext) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `parkings-${SEG ? segShort(SEG).replace(/[^\w-]+/g, '_') + '-' : ''}${new Date().toLocaleDateString('fr-CA')}.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const pkCsv = () => { const sh = pkSheets().find(s => s.name === 'Mises en parking') || pkSheets()[1], q = v => '"' + csvSafe(v) + '"';
    pkDl(new Blob(['﻿' + sh.rows.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'}), 'csv'); };
  const SEVL = {bad: ['Important', 'bad'], warn: ['À vérifier', 'warn'], info: ['Information', '']};
  const probHTML = `<h3>À corriger (${probs.length})</h3>${probs.length ? probs.map((p, i) => `<details class="card ccat"${i < 2 && p.sev !== 'info' ? ' open' : ''}><summary><span class="pill ${SEVL[p.sev][1]}">${SEVL[p.sev][0]}</span> <span class="muted" style="font-size:12px">${esc(p.cat)}</span> <b>${esc(p.title)}</b></summary>
      <div style="padding:0 12px 12px;font-size:13px"><div class="muted" style="margin-bottom:4px">${esc(p.detail)}</div><div style="margin-bottom:6px"><b>À faire :</b> ${esc(p.fix)}</div>${p.items.length ? `<ul class="hspen">${p.items.slice(0, 30).map(t => `<li>${esc(t)}</li>`).join('')}${p.items.length > 30 ? `<li class="muted">… et ${p.items.length - 30} autre(s) (voir l'export Excel)</li>` : ''}</ul>` : ''}</div></details>`).join('')
    : '<div class="card"><span class="pill ok">Aucun</span> Aucun problème détecté sur les parkings.</div>'}`;
  el.innerHTML = `<div id="pkwrap"><h2>Parkings partagés</h2>
    <p class="lead">Les parkings d'appels (SP0, SP1…) : problèmes détectés, réglages, utilisation réelle d'après l'historique des appels${first ? ` (du ${day(first)} au ${day(last)})` : ''}, parkings affichés sur les téléphones et appels perdus en attente${SEG ? ` — magasin <b>${esc(segName(SEG))}</b> (poste qui a mis l'appel en parking)` : ''}.</p>
    ${P ? '' : `<div class="card" style="border-left:3px solid var(--warn)">L'utilisation des parkings est lue à l'ouverture du backup : <b>rouvrez le backup</b> (Fermer le backup, puis le choisir de nouveau) pour afficher les statistiques. Les réglages ci-dessous sont déjà disponibles.</div>`}
    ${P ? `<div class="grid kpis">${[['Mises en parking', nf(rows.length)], ['Reprises', pc(picked.length, rows.length)], ['Reprises par un collègue', pc(byOther, picked.length)], ['Revenues au poste (délai)', pc(cnt('back') + cnt('timeout'), rows.length)], ['Raccrochés en attente', pc(cnt('hangup'), rows.length)], ['Attente médiane', dur(med)], ['Attente maximale', dur(waits[waits.length - 1] || 0)], ['Appels directs (parking vide)', nf(direct.length)]].map(([l, v]) => `<div class="card kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>` : ''}
    <div class="bar"><span class="count">Exporter</span><button class="btn" id="pkxls">Excel (toutes les données)</button>${P ? '<button class="btn" id="pkcsv">CSV des mises en parking</button><a class="btn" href="#attente">Rapport des mises en attente par employé (PDF)</a>' : ''}</div>
    ${probHTML}
    ${P ? parkLostHTML() : ''}
    <h3>Réglages</h3>
    <div class="card">${kv([['Code pour mettre en parking', esc(prm('PARK') || '*0')], ['Code pour reprendre', esc(prm('UNPARK') || '*1')], ['Nombre de parkings partagés', `${nf(slots.length)}${prm('SHAREDPARKINGCOUNT') ? ` <span class="muted">(paramètre système : ${esc(prm('SHAREDPARKINGCOUNT'))})</span>` : ''}`],
      ['Délai avant retour', mT ? esc(mT) + ' s' : '—'], ['Si personne ne reprend', esc(PK_DEST[mD] || mD || '—')], ['Reprise automatique', mA === '1' ? 'Oui' : mA === '0' ? 'Non' : '—'],
      ['Musique d\'attente', esc((prm('PARK_MOH_SOURCE') || '').split('/').pop() || 'par défaut')]])}
      ${odd.length ? `<div class="ubw" style="margin-top:8px">${odd.length} parking${odd.length > 1 ? 's ont' : ' a'} des réglages différents : ${odd.slice(0, 20).map(p => `<b>${esc(p.number)}</b> (${esc(p.timeout || '—')} s, ${esc(PK_DEST[p.dest] || p.dest || '—')})`).join(', ')}</div>` : '<p class="muted" style="margin:8px 0 0;font-size:12.5px">Tous les parkings partagés ont les mêmes réglages.</p>'}</div>
    ${P && rows.length ? `<h3>Mises en parking par heure</h3><div class="card"><div style="display:flex;align-items:flex-end;gap:3px;height:90px">${hours.map((h, i) => `<div title="${i} h : ${h.n} mise(s) en parking, ${h.h} raccroché(s) en attente" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%"><div style="background:var(--bad);height:${100 * h.h / mx}%"></div><div style="background:var(--accent);height:${100 * (h.n - h.h) / mx}%;min-height:${h.n ? 2 : 0}px;border-radius:2px 2px 0 0"></div></div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px" class="muted"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div><div class="legend"><span><i style="background:var(--accent)"></i>Repris ou revenu</span><span><i style="background:var(--bad)"></i>Raccroché en attente</span></div></div>
    <h3>Par magasin</h3><div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Mises en parking</th><th class="num">Reprises</th><th class="num">dont par un collègue</th><th class="num">Revenues (délai)</th><th class="num">Raccrochés</th><th class="num">Attente moy.</th></tr></thead><tbody>
      ${Object.values(bySeg).sort((a, b) => b.n - a.n).map(b => `<tr><td><b>${esc(segShort(b.s))}</b></td><td class="num">${nf(b.n)}</td><td class="num">${pc(b.pick, b.n)}</td><td class="num">${pc(b.other, b.pick)}</td><td class="num">${pc(b.back, b.n)}</td><td class="num">${b.hang ? `<span class="pill ${b.hang / b.n > .2 ? 'bad' : 'warn'}">${pc(b.hang, b.n)}</span>` : '0 %'}</td><td class="num">${dur(Math.round(b.w / b.n))}</td></tr>`).join('')}</tbody></table></div>
    <h3>Employés qui mettent le plus en parking</h3><div class="tw"><table><thead><tr><th>Poste</th><th class="num">Mises en parking</th><th class="num">Raccrochés en attente</th><th class="num">Revenues (délai)</th><th></th></tr></thead><tbody>
      ${Object.entries(byExt).sort((a, b) => b[1].n - a[1].n).slice(0, 15).map(([n, b]) => `<tr><td>${dnLink(n)}</td><td class="num">${nf(b.n)}</td><td class="num">${b.hang ? `<span class="pill ${b.hang / b.n > .2 ? 'bad' : 'warn'}">${nf(b.hang)} (${pc(b.hang, b.n)})</span>` : 0}</td><td class="num">${nf(b.back)}</td><td><a href="#attente/${esc(n)}">Rapport</a></td></tr>`).join('')}</tbody></table></div>` : ''}
    <h3>Parkings (${visSlots.length})</h3>
    ${hasBlf ? '' : '<p class="muted" style="font-size:12.5px">Rouvrez le backup pour voir sur quels téléphones chaque parking est affiché.</p>'}
    ${P ? `<p class="muted" style="font-size:12.5px">${unused.length} parking${unused.length > 1 ? 's' : ''} jamais utilisé${unused.length > 1 ? 's' : ''} sur la période${hasBlf ? `, dont ${idle.length} affiché${idle.length > 1 ? 's' : ''} sur aucun téléphone ; ${noBlf.length} parking${noBlf.length > 1 ? 's' : ''} utilisé${noBlf.length > 1 ? 's' : ''} mais affiché${noBlf.length > 1 ? 's' : ''} sur aucun téléphone (repris seulement par code)` : ''}.</p>` : ''}
    <div id="pkt"></div>
    ${P && rows.length ? `<h3>Dernières mises en parking</h3><div id="pkl"></div>` : ''}
    <p class="note">Une mise en parking = un appel transféré vers un parking partagé. « Revenu au poste » : personne ne l'a repris avant le délai, l'appel est retourné à l'employé qui l'avait mis en parking. « Appel direct » : un poste a composé le parking alors qu'il était vide. Le magasin est celui du poste qui a mis l'appel en parking.</p></div>`;
  table($('#pkt'), {rows: visSlots, sort: [0, 1], pageSize: 50, state: S.t ||= {},
    search: p => [p.number, ...[...(onBlf[p.number] || [])].map(n => n + ' ' + dnName(n))].join(' '),
    cols: [{h: 'Parking', v: p => +p.number.slice(2), f: p => `<b class="mono">${esc(p.number)}</b>`},
      {h: 'Mises en parking', num: 1, v: p => use[p.number]?.n || 0, f: p => use[p.number] ? nf(use[p.number].n) : (P ? '<span class="pill">jamais</span>' : '—')},
      {h: 'Dernière utilisation', v: p => use[p.number]?.last || '', f: p => use[p.number] ? day(use[p.number].last) : '—'},
      {h: 'Affiché sur', num: 1, v: p => (onBlf[p.number] || []).size, f: p => { const s = [...(onBlf[p.number] || [])]; return s.length ? `<span title="${esc(s.map(n => n + ' ' + dnName(n)).join(', '))}">${s.length} téléphone${s.length > 1 ? 's' : ''}</span> <span class="muted">${esc([...new Set(s.map(n => segShort(SEGOF[n] || SEG_COMMON)))].join(', '))}</span>` : (hasBlf ? '<span class="muted">aucun</span>' : '—'); }},
      {h: 'Délai', v: p => +p.timeout || 0, f: p => p.timeout ? esc(p.timeout) + ' s' : '—'},
      {h: 'Si personne ne reprend', v: p => p.dest || '', f: p => esc(PK_DEST[p.dest] || p.dest || '—')}],
    onRow: p => { const s = [...(onBlf[p.number] || [])].sort(); const last = (P || []).filter(r => r[1] === p.number && r[3] !== 'direct').sort((a, b) => a[0] < b[0] ? 1 : -1).slice(0, 20);
      openDrawer(`Parking <span class="mono">${esc(p.number)}</span>`, kv([['Délai avant retour', p.timeout ? esc(p.timeout) + ' s' : '—'], ['Si personne ne reprend', esc(PK_DEST[p.dest] || p.dest || '—')], ['Reprise automatique', p.auto === '1' ? 'Oui' : p.auto === '0' ? 'Non' : '—'], ['Mises en parking', nf(use[p.number]?.n || 0)]]) +
        `<h3>Affiché sur ${s.length} téléphone${s.length > 1 ? 's' : ''}</h3>${s.map(n => `<div>${dnLink(n)}</div>`).join('') || '<span class="muted">Aucun</span>'}` +
        (last.length ? `<h3>Dernières mises en parking</h3>${last.map(r => `<div><span class="mono">${esc(fmtD(r[0]))}</span> ${dnLink(r[4])} <span class="muted">· ${dur(r[2])}</span> <span class="pill ${PK_OUT[r[3]][1]}">${esc(PK_OUT[r[3]][0])}</span></div>`).join('')}` : '')); }});
  if($('#pkl')) table($('#pkl'), {rows: rows.slice().sort((a, b) => a[0] < b[0] ? 1 : -1), pageSize: 25, state: S.l ||= {},
    search: r => [r[1], r[4], dnName(r[4]), r[5], dnName(r[5]), PK_OUT[r[3]][0]].join(' '),
    filters: [{label: 'Issue', options: Object.entries(PK_OUT).filter(([k]) => k !== 'direct').map(([k, [l]]) => [k, l]), test: (r, v) => r[3] === v}],
    cols: [{h: 'Date', v: r => r[0], f: r => `<span class="mono">${esc(fmtD(r[0]))}</span>`}, {h: 'Parking', v: r => r[1], cls: 'mono'},
      {h: 'Mis en parking par', v: r => r[4], f: r => r[4] ? dnLink(r[4]) : '—'}, {h: 'Attente', num: 1, v: r => r[2], f: r => dur(r[2])},
      {h: 'Issue', v: r => r[3], f: r => `<span class="pill ${PK_OUT[r[3]][1]}">${esc(PK_OUT[r[3]][0])}</span>`},
      {h: 'Repris par', v: r => r[5], f: r => r[3] === 'pickup' && r[5] ? (r[5] === r[4] ? '<span class="muted">lui-même</span>' : dnLink(r[5])) : '—'},
      {h: 'Appel', v: r => r[6], f: r => r[6] === 'ext' ? 'Externe' : 'Interne'}]});
  $('#pkxls').addEventListener('click', () => pkDl(XL.build(pkSheets()).blob, 'xlsx'));
  if($('#pkcsv')) $('#pkcsv').addEventListener('click', pkCsv);
};

