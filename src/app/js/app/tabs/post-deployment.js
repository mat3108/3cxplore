// ---------- Suivi après implantation (20.10) : un seul document à imprimer pour fermer l'implantation d'un magasin :
// tous les SDA avec leur destination, les lignes de fax à ne pas oublier, puis le parcours des appels (diagramme) de chaque SDA ----------
const IMP_FAX_RE = /\b(fax|t[ée]l[ée]cop)/i;
const IMP_PERIODS = ['office', 'outOfOffice', 'holidays'];
// numéros du serveur de fax 3CX : lus dans le backup (D.faxServers) ; pour un backup lu par une version antérieure, repérés dans l'historique des appels
const impFaxServers = () => { const s = new Set(FULL.faxServers || []); FULL.calls.forEach(c => (c[9] || []).forEach(p => { if(p[1] === 'fax' && p[0]) s.add(p[0]); })); return s; };
const impDest = d => { if(!d || !d.to || d.to === 'None') return '—'; const t = TO_FR[d.to] || d.to; if(d.to === 'External') return `${t} ${phone(d.ext)}`; if(d.dn) return `${t} ${d.dn} ${dnName(d.dn)}`.trim(); return t; };
function impData(seg){
  const inSeg = did => !seg || (DIDSEG[did] || SEG_COMMON) === seg;
  const faxSrv = impFaxServers();
  const faxExt = new Set(FULL.extensions.filter(e => IMP_FAX_RE.test(`${e.first} ${e.last} ${e.email}`)).map(e => e.number));
  const isFaxDest = d => !!d && !!d.to && (d.to === 'Fax' || (!!d.dn && (faxSrv.has(d.dn) || faxExt.has(d.dn))));
  const ruleFax = r => !!r.rule && IMP_PERIODS.some(k => isFaxDest(r.rule[k]));
  // fax arrivés dans l'historique, par SDA : détectés sur la ligne (3CX les envoie au serveur de fax) ou transférés à la main par un employé
  const faxCalls = {};
  FULL.calls.forEach(c => { if(c[1] !== 'in') return; const steps = (c[14] || []).filter(s => s[1] === 'fax');
    const auto = steps.length ? steps.some(s => s[7] !== 'transfer') : (c[9] || []).some(p => p[1] === 'fax') || faxSrv.has(c[6]), xfer = steps.length ? steps.every(s => s[7] === 'transfer') : false;
    if(!auto && !xfer) return; const x = faxCalls[c[5] || ''] ||= {n: 0, xfer: 0, last: ''}; if(xfer) x.xfer++; else x.n++; if(c[0] > x.last) x.last = c[0]; });
  const rows = allDIDs.filter(r => inSeg(r.did)).map(r => { const fc = faxCalls[r.did], why = [];
    if(ruleFax(r)) why.push('rule'); if(fc && fc.n) why.push('cdr'); if(fc && fc.xfer) why.push('xfer');
    return {r, did: r.did, seg: DIDSEG[r.did] || SEG_COMMON, calls: lineCalls[r.did] || 0, fax: why, faxN: fc ? fc.n : 0, faxXfer: fc ? fc.xfer : 0, faxLast: fc ? fc.last : ''}; });
  const segOrder = s => { const i = SEG_LIST.indexOf(s); return i < 0 ? SEG_LIST.length : i; };
  rows.sort((a, b) => segOrder(a.seg) - segOrder(b.seg) || b.calls - a.calls || a.did.localeCompare(b.did));
  // postes « fax » du magasin (télécopieur sur un adaptateur, ou boîte fax vers un courriel), avec les SDA qui y mènent
  const exts = FULL.extensions.filter(e => faxExt.has(e.number) && (!seg || (SEGOF[e.number] || SEG_COMMON) === seg))
    .map(e => ({e, dids: rows.filter(x => x.r.rule && IMP_PERIODS.some(k => x.r.rule[k] && x.r.rule[k].dn === e.number)).map(x => x.did)}));
  // fax arrivés sur un numéro qui n'est pas dans la liste des SDA du trunk : à ajouter dans la console (vus seulement avec « Tous les magasins »)
  const known = new Set(allDIDs.map(r => r.did));
  const orphans = Object.entries(faxCalls).filter(([d]) => d && !known.has(d)).map(([d, fc]) => ({did: d, fax: [...(fc.n ? ['cdr'] : []), ...(fc.xfer ? ['xfer'] : [])], faxN: fc.n, faxXfer: fc.xfer, faxLast: fc.last})).sort((a, b) => b.faxN - a.faxN);
  const hidden = seg ? allDIDs.filter(r => !inSeg(r.did) && (ruleFax(r) || faxCalls[r.did])).length + orphans.length : 0;
  return {rows, exts, faxSrv, faxExt, hidden, orphans: seg ? [] : orphans};
}
// SDA qui suivent exactement le même parcours : un seul diagramme pour tous (le nom de la règle propre à chaque SDA n'entre pas en compte)
function impFlowGroups(rows){
  const sigOf = g => { const d = id => { const n = g.nodes.get(id); if(!n) return id; if(id === 'did') return 'did'; if(n.kind === 'rule') return `rule|${n.sub}|${n.lines.join('/')}`; return `${n.kind}|${n.title}|${n.sub}|${n.lines.join('/')}`; };
    return g.edges.map(e => `${d(e.from)}>${d(e.to)}:${e.labels.join('|')}`).sort().join('\n'); };
  const groups = new Map();
  rows.forEach(x => { const g = buildFlow(x.r), s = sigOf(g); if(!groups.has(s)) groups.set(s, {g, rows: []}); groups.get(s).rows.push(x); });
  const tot = grp => grp.rows.reduce((t, x) => t + x.calls, 0);
  return [...groups.values()].sort((a, b) => tot(b) - tot(a));
}
function impFlowHTML(grp, o2){ // o2 (20.11.3) : options ajoutées au diagramme, par exemple {horiz}
  const n = grp.rows.length, g = grp.g, first = grp.rows[0], calls = grp.rows.reduce((t, x) => t + x.calls, 0);
  if(n > 1){
    const did = g.nodes.get('did'); did.title = `${n} SDA`; did.sub = [...new Set(grp.rows.map(x => x.r.line.gateway || x.r.line.number))].join(', '); did.lines = calls ? [`${nf(calls)} appels reçus dans le backup`] : [];
    const ru = g.nodes.get('rule'); if(ru && !grp.rows.every(x => x.r.isDefault)) ru.title = 'Règle entrante de chaque SDA';
  }
  const segs = [...new Set(grp.rows.map(x => x.seg))];
  const meta = n > 1 ? `${segs.map(s => esc(segName(s))).join(', ')} · ${nf(g.nodes.size)} éléments${calls ? ` · ${nf(calls)} appels reçus dans le backup` : ''} · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}` : null;
  const extra = n > 1 ? `<p class="imp-dids"><b>Ces SDA suivent le même parcours :</b> ${grp.rows.map(x => `<span class="mono">${esc(phone(x.did))}</span>`).join(', ')}</p>` : '';
  return renderFlowPortrait(g, first.r, {title: n > 1 ? `${n} SDA avec le même parcours` : phone(first.did), meta, extra, ...(o2 || {})}).replace(' id="dgpsheet"', '').replace('class="report dgp"', 'class="report dgp imp-page"');
}
V.implantation = el => {
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  const S = window.__imp ||= {seg: '', flows: true, group: true};
  if(SEG) S.seg = SEG; else if(S.seg && !SEG_LIST.includes(S.seg)) S.seg = '';
  const seg = S.seg, X = impData(seg), rows = X.rows;
  const own = rows.filter(x => x.r.rule && !x.r.isDefault).length, faxRows = rows.filter(x => x.fax.length), calls = rows.reduce((t, x) => t + x.calls, 0);
  const nFax = faxRows.length + X.orphans.length + X.exts.filter(x => !x.dids.length).length;
  const groups = S.flows && rows.length ? impFlowGroups(rows) : [];
  const same = (a, b) => !!a && !!b && a.to === b.to && (a.dn || '') === (b.dn || '') && (a.ext || '') === (b.ext || '');
  const per = (ru, k) => !ru ? '—' : k === 'office' ? impDest(ru.office) : (k === 'outOfOffice' ? ru.altOOO : ru.altHol) && !same(ru[k], ru.office) ? impDest(ru[k]) : 'idem';
  const faxWhy = x => x.fax.map(w => w === 'rule' ? 'La règle entrante mène au fax' : w === 'cdr' ? `${nf(x.faxN)} fax reçu${x.faxN > 1 ? 's' : ''} dans l'historique` : `${nf(x.faxXfer)} fax transféré${x.faxXfer > 1 ? 's' : ''} à la main vers le serveur de fax`).join(' · ');
  const faxWhere = x => { const ru = x.r.rule, d = ru && IMP_PERIODS.map(k => ru[k]).find(dd => dd && dd.dn && (X.faxSrv.has(dd.dn) || X.faxExt.has(dd.dn)));
    if(d && X.faxExt.has(d.dn)){ const e = EXT_BY[d.dn]; return `Poste ${esc(d.dn)} ${esc(dnName(d.dn))}${e && e.email ? ` · ${esc(e.email)}` : ''}${e && e.devices.length ? ` · ${e.devices.map(v => esc(v.model || v.template)).join(', ')}` : ''}`; }
    if(d) return `Serveur de fax 3CX (${esc(d.dn)})`;
    return x.fax.includes('cdr') ? `Serveur de fax 3CX${X.faxSrv.size ? ` (${[...X.faxSrv].map(esc).join(', ')})` : ''}, après détection du fax sur la ligne` : esc(impDest(ru && ru.office)); };
  const kpi = (l, v, c) => `<div class="card kpi ${c || ''}"><div class="v" style="font-size:20px">${v}</div><div class="l">${esc(l)}</div></div>`;
  const all = !seg;
  el.innerHTML = `<div id="impwrap"><div class="noprint"><h2>Suivi après implantation</h2>
    <p class="lead">Le document à imprimer quand l'implantation d'un magasin est terminée : tous les numéros entrants (SDA) avec leur destination selon le moment, les lignes de fax à tester pour ne pas les oublier, puis le parcours des appels de chaque SDA en diagramme. Les SDA qui suivent le même parcours partagent un seul diagramme.</p>
    <div class="bar">${SEG ? '' : `<label class="count">Magasin</label><select id="impseg"><option value=""${seg ? '' : ' selected'}>Tous les magasins</option>${stores.map(x => `<option value="${esc(x)}"${x === seg ? ' selected' : ''}>${esc(segName(x))}</option>`).join('')}</select>`}
      <label class="tourtgl"><input type="checkbox" id="impflows"${S.flows ? ' checked' : ''}> Parcours des appels (diagrammes)</label>
      <span style="flex:1"></span><button class="btn primary" id="impprint">Imprimer / PDF</button><button class="btn" id="impcsv">Exporter la liste (CSV)</button></div></div>
    <div id="impsheet"><div class="report imp-main"><header class="rpcover"><div class="rpk">Suivi après implantation · 3CXplore</div><h1>${esc(seg ? segName(seg) : 'Tous les magasins')}</h1>
      <div class="rpmeta">${nf(rows.length)} SDA · ${nf(own)} avec une règle propre · ${nf(nFax)} ligne${nFax > 1 ? 's' : ''} de fax · ${S.flows ? `${nf(groups.length)} parcours différent${groups.length > 1 ? 's' : ''} · ` : ''}${nf(calls)} appels reçus dans le backup · backup du ${esc(bkDate(FULL.info.date))} · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      <section class="rps"><h2>Numéros entrants (SDA) et leur destination</h2>
        ${rows.length ? `<div class="tw"><table class="imp-t"><thead><tr><th>SDA</th><th>Trunk</th>${all ? '<th>Magasin</th>' : ''}<th>Règle</th><th>Ouvert</th><th>Fermé</th><th>Fériés</th><th class="num">Appels</th></tr></thead><tbody>
        ${rows.map(x => { const ru = x.r.rule; return `<tr${x.fax.length ? ' class="imp-fax"' : ''}><td class="mono nw">${esc(phone(x.did))}${x.fax.length ? ' <span class="pill warn">fax</span>' : ''}</td><td>${esc(x.r.line.gateway || x.r.line.number)}</td>${all ? `<td>${esc(segShort(x.seg))}</td>` : ''}<td class="muted">${esc(ruleLabel(x.r))}</td><td>${esc(per(ru, 'office'))}</td><td${per(ru, 'outOfOffice') === 'idem' ? ' class="muted"' : ''}>${esc(per(ru, 'outOfOffice'))}</td><td${per(ru, 'holidays') === 'idem' ? ' class="muted"' : ''}>${esc(per(ru, 'holidays'))}</td><td class="num">${nf(x.calls)}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="muted imp-note">« idem » : la règle entrante ne change pas de destination à ce moment ; ce sont les horaires du département qui s'appliquent ensuite. « Règle par défaut du trunk » : le SDA n'a pas de règle propre.</p>` : '<p class="muted">Aucun SDA rattaché à ce magasin.</p>'}</section>
      <section class="rps imp-faxsec"><h2>Fax — à ne pas oublier</h2>
        <p>Avant de fermer l'implantation, tester la réception d'un fax sur chaque ligne ci-dessous, et l'envoi s'il y a un télécopieur. Cochez quand c'est fait.</p>
        ${nFax || X.exts.length ? `<div class="tw"><table class="imp-t"><thead><tr><th>Numéro</th><th>Comment on le sait</th><th>Où il arrive</th><th>Dernier fax</th><th class="imp-chk">Testé</th></tr></thead><tbody>
          ${faxRows.map(x => `<tr><td class="mono nw">${esc(phone(x.did))}</td><td>${esc(faxWhy(x))}</td><td>${faxWhere(x)}</td><td class="nw">${x.faxLast ? esc(fmtD(x.faxLast)) : '<span class="muted">—</span>'}</td><td class="imp-chk"><input type="checkbox" aria-label="Testé"></td></tr>`).join('')}
          ${X.orphans.map(x => `<tr><td class="mono nw">${esc(phone(x.did))}</td><td><span>${esc(faxWhy(x))}</span> · <b>numéro absent de la liste des SDA du trunk</b></td><td>Serveur de fax 3CX${X.faxSrv.size ? ` (${[...X.faxSrv].map(esc).join(', ')})` : ''}, après détection du fax sur la ligne</td><td class="nw">${x.faxLast ? esc(fmtD(x.faxLast)) : '<span class="muted">—</span>'}</td><td class="imp-chk"><input type="checkbox" aria-label="Testé"></td></tr>`).join('')}
          ${X.exts.filter(x => !x.dids.length).map(({e}) => `<tr><td class="mono nw">Poste ${esc(e.number)}</td><td>Poste nommé « ${esc((e.first + ' ' + e.last).trim())} »${e.devices.length ? ` · ${e.devices.map(v => esc(v.model || v.template)).join(', ')}` : ''}</td><td>${e.email ? esc(e.email) : '<span class="muted">—</span>'} <span class="muted">· aucun SDA ne mène directement à ce poste</span></td><td class="muted">—</td><td class="imp-chk"><input type="checkbox" aria-label="Testé"></td></tr>`).join('')}
        </tbody></table></div>` : `<p><span class="pill ok">Aucun fax repéré</span> Aucune règle entrante ne mène au fax, aucun poste ne s'appelle fax et aucun fax n'est arrivé dans l'historique${seg ? ' pour ce magasin' : ''}. Vérifiez quand même auprès du magasin s'il a un télécopieur.</p>`}
        ${X.hidden ? `<p class="muted imp-note">${nf(X.hidden)} autre${X.hidden > 1 ? 's' : ''} ligne${X.hidden > 1 ? 's' : ''} de fax dans le reste du système : choisir « Tous les magasins » pour les voir.</p>` : ''}
        <p class="muted imp-note">Repérage : règle entrante vers le serveur de fax 3CX ou vers un poste dont le nom ou le courriel contient « fax » ; fax détectés par 3CX sur la ligne dans l'historique des appels ; fax transférés à la main par un employé.</p></section>
      ${S.flows ? `<section class="rps"><h2>Parcours des appels</h2><p class="muted imp-note">${groups.length ? `${nf(groups.length)} diagramme${groups.length > 1 ? 's' : ''} pour ${nf(rows.length)} SDA, un par page, du plus appelé au moins appelé.` : 'Aucun SDA.'}</p></section>` : ''}
    </div>${groups.map(impFlowHTML).join('')}</div></div>`;
  if($('#impseg')) $('#impseg').addEventListener('change', e => { S.seg = e.target.value; V.implantation(el); });
  $('#impflows').addEventListener('change', e => { S.flows = e.target.checked; V.implantation(el); });
  $('#impprint').addEventListener('click', () => printHTML('<style>@page{size:letter portrait;margin:12mm}</style>' + $('#impsheet').innerHTML));
  $('#impcsv').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['SDA', 'Trunk', 'Magasin', 'Règle', 'Ouvert', 'Fermé', 'Fériés', 'Appels', 'Fax']].concat(rows.map(x => [phone(x.did), x.r.line.gateway || x.r.line.number, segShort(x.seg), ruleLabel(x.r), per(x.r.rule, 'office'), per(x.r.rule, 'outOfOffice'), per(x.r.rule, 'holidays'), x.calls, x.fax.length ? faxWhy(x) : '']));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = `suivi-implantation${seg ? '-' + segShort(seg).replace(/[^\w-]+/g, '_') : ''}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
