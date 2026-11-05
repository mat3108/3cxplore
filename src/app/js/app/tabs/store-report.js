// ---------- Rapport par magasin (imprimable / PDF) ----------
const RPT_SECTIONS = [['synthese', 'Synthèse'], ['sante', 'Note de santé'], ['suivi', 'Évolution (suivi dans le temps)'], ['reco', 'Recommandations'], ['erreurs', 'Erreurs et incohérences à corriger'], ['sda', 'SDA et acheminement'], ['diag', 'Parcours des appels de tous les SDA'], ['horaires', 'Horaires et jours fériés'],
  ['files', "Files d'attente"], ['agents', 'Performance des agents'], ['postes', 'Postes'], ['tel', 'Téléphones à mettre à jour'], ['audit', "Modifications de la configuration (journal d'audit)"]];
const RPT_KEY = 'rapport3cx-sections';
function rptSections(){ try{ const v = JSON.parse(localStorage.getItem(RPT_KEY) || 'null');
  if(Array.isArray(v)){ // une section ajoutée depuis le dernier choix est cochée par défaut
    if(!localStorage.getItem(RPT_KEY + '-v510') && !v.includes('suivi')){ v.splice(1, 0, 'suivi'); localStorage.setItem(RPT_KEY, JSON.stringify(v)); }
    if(!localStorage.getItem(RPT_KEY + '-v616') && !v.includes('sante')){ v.splice(1, 0, 'sante'); localStorage.setItem(RPT_KEY, JSON.stringify(v)); }
    if(!localStorage.getItem(RPT_KEY + '-v20103')){ ['erreurs', 'audit'].forEach(k => { if(!v.includes(k)) v.push(k); }); localStorage.setItem(RPT_KEY, JSON.stringify(v)); } // 20.10.3 : nouvelles sections cochées
    localStorage.setItem(RPT_KEY + '-v510', '1'); localStorage.setItem(RPT_KEY + '-v616', '1'); localStorage.setItem(RPT_KEY + '-v20103', '1'); return new Set(v); } }catch(e){} return new Set(RPT_SECTIONS.map(s => s[0])); }
const rptAll = () => { try{ localStorage.setItem(RPT_KEY, JSON.stringify(RPT_SECTIONS.map(s => s[0]))); }catch(e){} };
// 20.10.3 : diagramme en portrait d'un groupe de SDA (suivi après implantation), sans sa page de garde, pour s'insérer dans le rapport
const rptFlowHTML = grp => impFlowHTML(grp, {horiz: rptHoriz()}).replace('class="report dgp imp-page"', 'class="dgp rpflow"')
  .replace(/<header class="rpcover"><div class="rpk">[^<]*<\/div><h1>([\s\S]*?)<\/h1>/, '<header class="rpflowh"><h3>$1</h3>').replace(/<div class="rpfoot">[\s\S]*?<\/div><\/div>$/, '</div>');

V.rapport = el => {
  const all = FULL.calls, sec = rptSections();
  const meta = all.map(c => localParts(c[0]));
  const lastDay = meta.length ? meta[0][0] : '', firstDay = meta.length ? callHist().first : '';
  const P = statsPeriod();
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const [from, to] = !lastDay ? ['', ''] : P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDays(lastDay, -(+P.mode) + 1), lastDay];
  const S = SEG; // le rapport porte sur le magasin sélectionné dans le bandeau (ou tout le système)
  const title = S ? segName(S) : 'Tous les magasins';
  el.innerHTML = `<div id="rpwrap"><div class="noprint">
    <h2>Rapport par magasin</h2>
    <p class="lead">Rapport prêt à imprimer ou à enregistrer en PDF (Imprimer → Enregistrer au format PDF) pour un magasin : synthèse, recommandations, erreurs et incohérences à corriger, acheminement et parcours des appels de tous les SDA, horaires, files, agents, postes, téléphones et modifications faites dans la console. « Rapport complet » coche toutes les sections.</p>
    <div class="card rpctl">
      <label class="count">Magasin <select id="rpseg"><option value="">Tous les magasins</option>${SEG_LIST.map(c => `<option value="${esc(c)}"${c === S ? ' selected' : ''}>${esc(segShort(c))}</option>`).join('')}</select></label>
      <label class="count">Période ${perUI('rppm', perOfStats(P), firstDay, lastDay)}</label>
      <div class="rpsec">${RPT_SECTIONS.map(([k, l]) => `<label><input type="checkbox" data-s="${k}"${sec.has(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>
      <div><button class="btn" id="rpfull" title="Coche toutes les sections">Rapport complet</button> ${rptDirUI()} ${rptOrientUI()} <button class="btn primary" id="rpprint">Imprimer / PDF</button></div>
    </div>
    <div class="card rpctl" id="rpbatch">
      <div style="flex:1;min-width:260px"><b>Tous les magasins en une fois</b><div class="muted" style="font-size:12.5px">Génère un rapport par magasin (mêmes sections et même période), réunis dans un seul document à imprimer ou enregistrer en PDF : chaque magasin commence sur une nouvelle page.</div>
        ${window.__batchResult ? `<div style="margin-top:6px"><span class="pill ok">${window.__batchResult.items.length} rapports prêts</span> <span class="muted" style="font-size:12px">générés le ${esc(fmtD(window.__batchResult.at))} · ${esc(window.__batchResult.items.map(x => x.name).join(', '))}</span></div>` : ''}</div>
      <div><button class="btn" id="rpball">Générer tous les rapports</button> <button class="btn" id="rpbfull" title="Coche toutes les sections, puis génère un rapport par magasin">Tous les rapports complets</button>${window.__batchResult ? ' <button class="btn primary" id="rpbprint">Imprimer / PDF (tous)</button>' : ''}</div>
    </div>
    <div class="card rpctl" id="rpxlsx">
      <div style="flex:1;min-width:260px"><b>Export Excel complet</b><div class="muted" style="font-size:12.5px">Un fichier .xlsx avec une feuille par sujet : postes, téléphones, files d'attente, SDA et leur issue à des moments clés, jours fériés à saisir, comptes à droits élevés, renvois externes, personnes indispensables, créneaux sous-dotés et recommandations${S ? ` — magasin ${esc(segShort(S))}` : ''}. Créé dans le navigateur, rien n'est envoyé.</div><div id="rpxmsg" class="muted" style="font-size:12px;margin-top:4px"></div></div>
      <div><button class="btn primary" id="rpx">Exporter en Excel</button></div>
    </div></div>
    <article class="report" id="report"></article></div>`;
  $('#rpseg').addEventListener('change', e => window.__app.setSeg(e.target.value));
  perWire('rppm', perOfStats(P), firstDay, lastDay, v => { perToStats(P, v); V.rapport(el); });
  el.querySelectorAll('.rpsec input').forEach(cb => cb.addEventListener('change', () => { const v = [...el.querySelectorAll('.rpsec input:checked')].map(x => x.dataset.s); try{ localStorage.setItem(RPT_KEY, JSON.stringify(v)); }catch(er){} V.rapport(el); }));
  $('#rpx').addEventListener('click', () => { const b = $('#rpx'); b.disabled = true; b.textContent = 'Préparation…';
    setTimeout(() => { try{ const r = exportXlsx(); $('#rpxmsg').textContent = `Fichier créé : ${r.sheets.length} feuilles, ${(r.size / 1048576).toFixed(1).replace('.', ',')} Mo — ${r.sheets.map(x => x[0] + ' (' + nf(x[1]) + ')').join(', ')}.`; }
      catch(er){ console.error(er); $('#rpxmsg').textContent = 'Erreur pendant l\'export : ' + er.message; } b.disabled = false; b.textContent = 'Exporter en Excel'; }, 30); });
  const runAll = full => {
    const stores = SEG_LIST.filter(x => x[0] !== '@');
    if(!confirm(`Générer ${stores.length} rapports${full ? ' complets' : ''} (un par magasin) ? Comptez environ ${full ? 'deux secondes' : 'une seconde'} par magasin.`)) return;
    if(full) rptAll();
    window.__runBatch(stores, SEG);
  };
  $('#rpball').addEventListener('click', () => runAll(false));
  $('#rpbfull').addEventListener('click', () => runAll(true));
  $('#rpfull').addEventListener('click', () => { rptAll(); V.rapport(el); });
  const bp = $('#rpbprint'); if(bp) bp.addEventListener('click', () => window.__printBatch());
  $('#rpprint').addEventListener('click', () => rptPrintPage('printing-report'));
  rptOrientWire(el); // 20.11.2 : portrait / paysage
  rptDirWire(el, () => V.rapport(el)); // 20.11.3 : diagrammes verticaux / horizontaux

  // ----- données de la période pour le magasin -----
  const inS = c => !S || callSeg(c) === S;
  const st = {inc: 0, ans: 0, fwd: 0, lost: 0, vm: 0, bridge: 0, out: 0, hours: Array(24).fill(0), didCalls: {}};
  meta.forEach((m, i) => { if(m[0] < from || m[0] > to) return; const c = all[i]; if(!inS(c)) return;
    if(c[1] === 'in'){ st.inc++; const s = c[10]; if(s === 'ans') st.ans++; else if(s === 'fwd_ok') st.fwd++; else if(s === 'vm') st.vm++; else if(s === 'bridge') st.bridge++; else if(ST_LOST.has(s)) st.lost++;
      st.hours[m[1]]++; if(c[5]) st.didCalls[c[5]] = (st.didCalls[c[5]] || 0) + 1; }
    else if(c[1] === 'out') st.out++; });
  const base = st.inc - st.bridge, rate = base ? (st.ans + st.fwd) / base : null, peak = st.inc ? st.hours.indexOf(Math.max(...st.hours)) : null;
  const qmeta = FULL.queueCalls.map(r => localParts(r[0])[0]);
  const qset = new Set(D.queues.map(q => q.number));
  const qs = {}; FULL.queueCalls.forEach((r, i) => { if(qmeta[i] < from || qmeta[i] > to || !qset.has(r[1])) return; const x = qs[r[1]] ||= {n: 0, served: 0, wait: 0, ab: 0, waitAb: 0}; x.n++; if(r[6]){ x.served++; x.wait += r[4]; } else { x.ab++; x.waitAb += r[4]; } });
  const qTot = Object.values(qs).reduce((a, x) => ({n: a.n + x.n, served: a.served + x.served, wait: a.wait + x.wait, ab: a.ab + x.ab, waitAb: a.waitAb + x.waitAb}), {n: 0, served: 0, wait: 0, ab: 0, waitAb: 0});
  const F = analyse(), nCrit = F.filter(f => f.sev === 'crit').length, nFix = F.filter(f => f.sev === 'fix').length;
  const ph = phoneRows(), phTodo = ph.filter(r => r.st === 'old' || r.st === 'unk');
  const H = from ? hoursAnalysis(from, to) : [];
  const pc = v => v == null ? '–' : Math.round(v * 100) + ' %';
  const now = new Date().toLocaleString('fr-CA', {timeZone: TZ, dateStyle: 'long', timeStyle: 'short'});
  const sect = (k, h, body) => sec.has(k) ? `<section class="rps"><h2>${esc(h)}</h2>${body}</section>` : '';
  const T = (head, rows) => `<table class="rpt"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Aucun élément</td></tr>`}</tbody></table>`;

  // agents (période)
  const agents = new Set(D.extensions.map(e => e.number)), ag = {};
  meta.forEach((m, i) => { if(m[0] < from || m[0] > to) return; const c = all[i]; if(c[1] !== 'in') return;
    (Array.isArray(c[11]) ? c[11] : (c[10] === 'ans' ? [[c[6], c[8]]] : [])).forEach(([x, t]) => { if(agents.has(x)){ const a = ag[x] ||= {n: 0, t: 0, pa: 0, pe: 0}; a.n++; a.t += t; } }); });
  if(FULL.agentPolls) Object.entries(FULL.agentPolls).forEach(([k, v]) => { const [d, , x] = k.split('|'); if(d < from || d > to || !agents.has(x)) return; const a = ag[x] ||= {n: 0, t: 0, pa: 0, pe: 0}; a.pa += v[0]; a.pe += v[1]; });
  const agRows = Object.entries(ag).filter(([, a]) => a.n || a.pa || a.pe).sort((a, b) => b[1].n - a[1].n);

  // SDA du magasin
  const dids = allDIDs.slice().sort((a, b) => (st.didCalls[b.did] || 0) - (st.didCalls[a.did] || 0));
  // 20.10.3 : parcours de tous les SDA du magasin, un diagramme par parcours différent
  const flowRows = sec.has('diag') ? impData(S).rows : [], flowGroups = flowRows.length ? impFlowGroups(flowRows) : [];

  // 20.10.3 : erreurs et incohérences — pièges d'acheminement (configuration) et contrôle des SDA à des moments clés (simulation)
  const SVL = {bad: ['Appel perdu', 'bad'], warn: ['À vérifier', 'warn'], info: ['Information', '']}, SVO = {bad: 0, warn: 1, info: 2};
  // SDA déclaré sur plusieurs trunks : l'appel suit la règle du trunk par lequel il arrive, donc deux acheminements possibles pour un même numéro
  const dupDids = () => { const by = {}, all = []; // tous les trunks du backup (en vue magasin, allDIDs ne contient que ceux du magasin)
    FULL.lines.forEach(l => { const rb = {}; l.rules.forEach(r => rb[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll'); l.dids.forEach(d => all.push({did: d, line: l, rule: rb[d] || def})); });
    all.forEach(r => (by[phone(r.did)] ||= []).push(r)); // même numéro écrit de deux façons (avec ou sans le 1) : regroupé sur le numéro affiché
    return Object.entries(by).filter(([, l]) => l.length > 1 && (!S || l.some(r => (DIDSEG[r.did] || SEG_COMMON) === S))).map(([num, l]) => { const dest = [...new Set(l.map(r => cmpDest(r.rule?.office)))], sms = l.some(r => /\bsms\b/i.test(r.line.gateway || ''));
      return {cat: 'dupdid', sev: sms ? 'info' : 'warn', el: num, title: `SDA déclaré sur ${l.length} trunks${dest.length > 1 ? ', avec des destinations différentes' : ''}`,
        detail: l.map(r => `${r.did} sur le trunk ${r.line.number} ${r.line.gateway || ''} → ${cmpDest(r.rule?.office)}`).join(' ; '), fix: sms ? "Normal si l'un des trunks ne sert qu'aux SMS ; sinon, garder le SDA sur un seul trunk." : "Garder le SDA sur un seul trunk (celui de l'opérateur qui l'achemine) et le retirer des autres."}; }); };
  const traps = sec.has('erreurs') ? trapAnalysis().filter(t => !S || (SEGOF[t.el] || SEG_COMMON) === S).concat(dupDids()).sort((a, b) => SVO[a.sev] - SVO[b.sev] || a.cat.localeCompare(b.cat)) : [];
  const ctl = sec.has('erreurs') && allDIDs.length ? ctlRun() : null;
  const errHTML = () => {
    const nB = traps.filter(t => t.sev === 'bad').length + (ctl ? ctl.causes.filter(c => c.sev === 'bad').length : 0), nW = traps.filter(t => t.sev === 'warn').length + (ctl ? ctl.causes.filter(c => c.sev === 'warn').length : 0);
    const nInfo = traps.filter(t => t.sev === 'info').length + (ctl ? ctl.causes.filter(c => c.sev === 'info').length : 0);
    const pill = s => `<span class="rpsev rpsev-${s}">${esc(SVL[s][0])}</span>`;
    const el2 = n => esc(n + (dnName(n) ? ' ' + dnName(n) : ''));
    const head = `<div class="rpkpis">${[['Appels perdus possibles', nB], ['À vérifier', nW], ['Information', nInfo], ['SDA simulés', ctl ? nf(ctl.rows.length) : '–']].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
    const t1 = `<h3>Pièges d'acheminement (configuration)</h3>` + T(['Gravité', 'Catégorie', 'Élément', 'Problème', 'À faire'], traps.map(t => `<tr><td>${pill(t.sev)}</td><td>${esc((TRAP_CAT[t.cat] || ['SDA en double'])[0])}</td><td>${el2(t.el)}</td>
      <td>${esc(t.title)}${t.detail ? `<div class="muted">${esc(t.detail)}</div>` : ''}</td><td>${esc(t.fix)}</td></tr>`));
    const t2 = !ctl ? '' : `<h3>Contrôle des SDA à des moments clés (simulation)</h3><p class="rpnote">Chaque SDA est simulé sans choix du client dans les menus : ${ctl.M.map(m => esc(`${m[1]} (${m[2]})`)).join(', ')}. Les problèmes sont regroupés par cause.</p>` +
      T(['Gravité', 'Problème', 'Où', 'Moments touchés', 'SDA touchés', 'Appels (backup)'], ctl.causes.map(c => `<tr><td>${pill(c.sev)}</td><td>${esc(c.title)}</td><td>${esc(c.detail || [...c.items].join(', '))}</td><td>${esc([...c.moments].join(', '))}</td>
        <td class="rpdids">${[...c.dids].slice(0, 30).map(d => esc(phone(d))).join(', ')}${c.dids.size > 30 ? ` … (+${c.dids.size - 30})` : ''}</td><td class="num">${nf(c.calls)}</td></tr>`));
    return (nB + nW + nInfo ? head : '<p><b>Aucune erreur ni incohérence détectée.</b> Toutes les destinations existent, aucune boucle, et chaque SDA mène à une personne, une messagerie ou un renvoi aux moments contrôlés.</p>') + t1 + t2 +
      `<p class="rpnote">Pièges : boucles où l'appel tourne sans aboutir, destinations qui n'existent plus, postes désactivés, files, groupes et menus sans issue, SDA qui ne mènent qu'à une messagerie, SDA déclarés sur plusieurs trunks. « Aucun agent connecté » reflète le moment du backup. Les jours fériés non configurés sont dans la section Horaires ; les autres points de configuration dans Recommandations.</p>`;
  };

  // 20.10.3 : modifications faites dans la console pour ce magasin sur la période (journal d'audit)
  const auditHTML = () => {
    const allM = modEntries(); if(!allM.length) return "<p>Le journal d'audit de ce backup ne contient aucune modification.</p>";
    const aFrom = from || allM[allM.length - 1].day, aTo = to || allM[0].day;
    const rows = allM.filter(r => r.day >= aFrom && r.day <= aTo && (!S || r.segs.has(S)));
    const nCom = S && S !== SEG_COMMON ? allM.filter(r => r.day >= aFrom && r.day <= aTo && !r.segs.has(S) && r.segs.has(SEG_COMMON)).length : 0;
    const by = f => { const o = {}; rows.forEach(r => { const k = f(r) || '—'; o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} (${nf(v)})`).join(', ') || '–'; };
    const cnt = k => rows.filter(r => r.a[1] === k).length, nFw = rows.filter(r => r.fwErased).length, nOther = rows.length - cnt('Création') - cnt('Modification') - cnt('Suppression'), MAX = 300, cut = v => { v = String(v ?? ''); return v.length > 80 ? v.slice(0, 80) + '…' : v; };
    return `<p>${nf(rows.length)} changement${rows.length > 1 ? 's' : ''} du ${aFrom} au ${aTo} : ${nf(cnt('Création'))} création${cnt('Création') > 1 ? 's' : ''}, ${nf(cnt('Modification'))} modification${cnt('Modification') > 1 ? 's' : ''}, ${nf(cnt('Suppression'))} suppression${cnt('Suppression') > 1 ? 's' : ''}${nOther ? `, ${nf(nOther)} autre${nOther > 1 ? 's' : ''} action${nOther > 1 ? 's' : ''}` : ''}${nFw ? `, dont ${nf(nFw)} firmware${nFw > 1 ? 's' : ''} effacé${nFw > 1 ? 's' : ''}` : ''}.</p>
      ${rows.length ? `<p><b>Par qui :</b> ${by(r => r.a[3])}<br><b>Quoi :</b> ${by(r => r.type)}</p>` : ''}
      ${rows.length ? T(['Date', 'Action', 'Type', 'Élément', 'Par', 'Changements (avant → après)'], rows.slice(0, MAX).map(r => `<tr><td class="nw">${esc(fmtD(r.a[0]))}</td><td>${esc(r.a[1])}</td><td>${esc(r.type)}</td><td>${esc(cut(r.a[4] || '—'))}</td><td>${esc(r.a[3] || '—')}</td>
        <td>${r.fwErased ? `<b>Firmware effacé : ${esc(r.fwErased)} → aucun</b><br>` : ''}${r.a[1] === 'Création' ? `Élément créé${r.a[6].length ? ` (${nf(r.a[6].length)} champs réglés)` : ''}` : r.a[6].slice(0, 8).map(c => `<b>${esc(c[0])}</b> : ${esc(cut(c[1]))} → ${esc(cut(c[2]))}`).join('<br>') + (r.a[6].length > 8 ? `<br>… (+${r.a[6].length - 8} champs)` : '')}</td></tr>`)) : ''}
      <p class="rpnote">${rows.length > MAX ? `Les ${MAX} changements les plus récents sont listés sur ${nf(rows.length)} ; le détail complet, champ par champ, est dans l'onglet Modifications (export CSV). ` : ''}Le magasin d'un changement est déduit du numéro ou du nom de l'élément.${nCom ? ` ${nf(nCom)} changement${nCom > 1 ? 's' : ''} commun${nCom > 1 ? 's' : ''} à tout le système (trunks, paramètres…) sur la même période ne sont pas listés ici.` : ''} Les connexions à la console et les actions sur les enregistrements ne sont pas comptées ; les valeurs sensibles ne sont jamais affichées.</p>`;
  };

  $('#report').innerHTML = `
  <header class="rpcover">
    <div class="rpk" style="display:flex;align-items:center;gap:8px"><svg class="brandlogo" style="border-radius:7px" viewBox="0 0 56 56" width="28" height="28" aria-hidden="true"><rect width="56" height="56" rx="14" fill="#042C53"/><text x="4" y="9.8" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="4" y="16.8" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="4" y="23.8" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="4" y="30.8" fill="#0C447C" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="4" y="37.8" fill="#0C447C" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="9" y="8.1" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="9" y="15.1" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="9" y="22.1" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="44" y="11.4" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="44" y="18.4" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="44" y="25.4" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="49" y="10.1" fill="#85B7EB" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="49" y="17.1" fill="#378ADD" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><text x="49" y="24.1" fill="#185FA5" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">1</text><text x="49" y="31.1" fill="#0C447C" font-size="6" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">0</text><circle cx="28" cy="28" r="12" fill="#E6F1FB" stroke="#85B7EB" stroke-width="2"/><path d="M14 28 a14 14 0 0 1 28 0" stroke="#444441" stroke-width="2.5" fill="none"/><rect x="11" y="25" width="5" height="8" rx="2.5" fill="#444441"/><rect x="40" y="25" width="5" height="8" rx="2.5" fill="#444441"/><path d="M42.5 33 q0 5 -6 5" stroke="#444441" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="35.5" cy="38" r="1.6" fill="#5DCAA5"/><path d="M19 25 h18 v3 a3 3 0 0 1 -3 3 h-3 a3 3 0 0 1 -3 -3 a3 3 0 0 1 -3 3 h-3 a3 3 0 0 1 -3 -3 z" fill="#042C53"/><path d="M21 26.5 h3 M30 26.5 h3" stroke="#5DCAA5" stroke-width="1.2" stroke-linecap="round"/><path d="M25 34.5 q3 1.5 7 -0.5" stroke="#444441" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>Rapport téléphonique · 3CXplore</span></div><h1>${esc(title)}</h1>
    <div class="rpmeta">${esc(FULL.info.company)} · ${esc(FULL.info.fqdn)} · 3CX ${esc(FULL.info.version)}<br>
      Backup du ${esc(bkDate(FULL.info.date))} · période analysée du ${from || '–'} au ${to || '–'} · rapport généré le ${esc(now)}</div>
  </header>
  ${sect('synthese', 'Synthèse', `
    <div class="rpkpis">${[['Postes', D.extensions.length], ['Téléphones', ph.length], ['SDA', allDIDs.length], ["Files d'attente", D.queues.length],
      ['Appels entrants', nf(st.inc)], ['Taux de réponse', pc(rate)], ['Appels perdus', `${nf(st.lost)} (${pc(base ? st.lost / base : null)})`], ['Attente moy. en file (servis)', qTot.served ? dur(Math.round(qTot.wait / qTot.served)) : '–'],
      ['Heure de pointe', peak == null ? '–' : peak + ' h'], ['Appels sortants', nf(st.out)], ['Points critiques', nCrit], ['Points à corriger', nFix]]
      .map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    ${(() => { const v = {rate: rate == null ? null : rate * 100, lostRate: base ? 100 * st.lost / base : null, wait: qTot.served ? qTot.wait / qTot.served : null};
      const lines = Object.keys(v).filter(k => objFor(S, k) != null && v[k] != null).map(k => `<li>${esc(OBJ_META[k].l)} : ${OBJ_META[k].u === '%' ? Math.round(v[k]) + ' %' : dur(Math.round(v[k]))} — ${esc(objTxt(S, k))} : <b class="${objOk(S, k, v[k]) ? 'rpok' : 'rpko'}">${objOk(S, k, v[k]) ? 'atteint ✓' : 'non atteint ✗'}</b></li>`);
      return lines.length ? `<h3>Objectifs</h3><ul class="rpobj">${lines.join('')}</ul>` : ''; })()}
    <p class="rpnote">Taux de réponse : appels entrants répondus (localement ou par renvoi externe) sur les appels entrants hors transferts vers un autre 3CX. Appels perdus : abandon en file, raccroché au menu, renvoi sans réponse, non répondu, raccroché en parking. <span>Attente moyenne en file : appels servis par un agent seulement${qTot.ab ? ` ; les appels non servis ont attendu ${dur(Math.round(qTot.waitAb / qTot.ab))} en moyenne avant de quitter la file` : ''}.</span></p>`)}
  ${sect('sante', 'Note de santé', (() => { try{ const r = healthScores().rows.find(x => x.seg === (S || '')); return r ? hsCard(r, true) : '<p>Note non disponible.</p>'; }catch(e){ return ''; } })())}
  ${sect('suivi', 'Évolution (suivi dans le temps)', (() => {
    const pts = suiviLoad(FULL.info.fqdn).filter(p => p.m[S || '']);
    if(!pts.length) return '<p>Aucun point de suivi enregistré pour l\'instant.</p>';
    const k = S || '', ks = [['rate', 'Taux de réponse', '%'], ['lostRate', 'Appels perdus', '%'], ['wait', 'Attente moy. en file (servis)', 's'], ['qRate', 'Réponse en file (agents)', '%'], ['phUnk', 'Téléphones de version inconnue', ''], ['unrouted', 'SDA non acheminés', '']];
    const fv = (v, u) => v == null ? '–' : u === '%' ? String(v).replace('.', ',') + ' %' : u === 's' ? dur(v) : nf(v);
    const W = 640, H = 150, pad = 30, vals = pts.map(p => p.m[k].rate), ob = objFor(S, 'rate'), nums = vals.filter(v => v != null).concat(ob != null ? [ob] : []);
    const mx = Math.min(100, Math.max(...nums, 1) + 5), mn = Math.max(0, Math.min(...nums) - 5), X = i => pts.length === 1 ? W / 2 : pad + i * (W - 2 * pad) / (pts.length - 1), Y = v => H - 18 - (H - 36) * (v - mn) / (mx - mn || 1);
    const chart = pts.length > 1 ? `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto">${ob != null ? `<line x1="${pad}" x2="${W - pad}" y1="${Y(ob)}" y2="${Y(ob)}" stroke="#15803d" stroke-dasharray="4 3"/><text x="${W - pad}" y="${Y(ob) - 4}" text-anchor="end" font-size="10" fill="#15803d">objectif ${ob} %</text>` : ''}
      <polyline points="${vals.map((v, i) => v == null ? '' : X(i) + ',' + Y(v)).join(' ')}" fill="none" stroke="#2563eb" stroke-width="2"/>
      ${vals.map((v, i) => v == null ? '' : `<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" fill="#2563eb"/><text x="${X(i)}" y="${Y(v) - 7}" text-anchor="middle" font-size="10">${fv(v, '%')}</text>`).join('')}
      ${pts.map((p, i) => `<text x="${X(i)}" y="${H - 3}" text-anchor="middle" font-size="9.5" fill="#5b6573">${esc((p.iso || '').slice(0, 10))}</text>`).join('')}</svg><p class="rpnote">Taux de réponse à chaque backup (30 derniers jours de chaque backup)${ob != null ? ' et objectif du magasin' : ''}.</p>` : '';
    return chart + `<table class="rpt"><thead><tr><th>Backup du</th>${ks.map(x => `<th>${esc(x[1])}</th>`).join('')}</tr></thead><tbody>${pts.map(p => `<tr><td class="nw">${esc((p.iso || p.date).slice(0, 10))}</td>${ks.map(([kk, , u]) => `<td class="num">${fv(p.m[k][kk], u)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  })())}
  ${sect('reco', 'Recommandations', F.filter(f => f.sev !== 'obs').length || F.length ? F.map(f => `<div class="rpreco ${f.sev}"><div><span class="rpsev">${SEV[f.sev].l}</span> <b>${esc(f.title)}</b></div><p>${esc(f.detail)}</p><p><i>Recommandation :</i> ${esc(f.reco)}</p>
      ${f.items.length ? `<p class="rpitems">${f.items.slice(0, 40).map(i => esc(i.text)).join(' · ')}${f.items.length > 40 ? ` · … (+${f.items.length - 40})` : ''}</p>` : ''}</div>`).join('') : '<p>Aucune recommandation.</p>')}
  ${sect('erreurs', 'Erreurs et incohérences à corriger', errHTML())}
  ${sect('sda', 'SDA et acheminement', T(['SDA', 'Règle', 'Heures d\'ouverture', 'Hors heures', 'Appels (période)'], dids.map(r => `<tr><td class="mono">${esc(phone(r.did))}</td><td>${esc(r.rule ? (r.rule.name || (r.isDefault ? 'règle par défaut du trunk' : 'règle du SDA')) : 'aucune')}</td>
      <td>${esc(cmpDest(r.rule?.office))}</td><td>${r.rule?.altOOO ? esc(cmpDest(r.rule.outOfOffice)) : '(idem)'}</td><td class="num">${nf(st.didCalls[r.did] || 0)}</td></tr>`)))}
  ${sect('diag', 'Parcours des appels de tous les SDA', flowGroups.length ? `<p class="rpnote">${rptRead(`${nf(flowRows.length)} SDA, ${nf(flowGroups.length)} parcours différent${flowGroups.length > 1 ? 's' : ''} : les SDA qui suivent exactement le même parcours partagent un seul diagramme, du plus appelé au moins appelé (appels reçus dans tout le backup). Lecture : de haut en bas, l'appel passe d'un élément au suivant ; le texte sur la flèche indique le choix ou le moment (touche du menu, ouvert / fermé, délai). Un élément déjà affiché est rappelé par son numéro.`)}</p>` + flowGroups.map(rptFlowHTML).join('') : '<p>Aucun SDA.</p>')}
  ${sect('horaires', 'Horaires et jours fériés', T(['Département', 'Horaires', 'Pauses', 'Fermé pendant l\'ouverture', 'Avant ouverture /sem.', 'Après fermeture /sem.', 'Fériés à venir non configurés'], H.map(r => `<tr><td>${esc(r.g.number + ' ' + r.g.name)}</td>
      <td>${hoursSummary(r.g.hours).map(esc).join('<br>')}</td><td>${r.g.breakTime?.days?.length ? hoursSummary(r.g.breakTime).map(esc).join('<br>') : '—'}</td><td class="num">${r.closedWhileOpen.length}</td>
      <td class="num">${(r.before.reduce((a, b) => a + b, 0) / r.weeks).toFixed(1)}</td><td class="num">${(r.after.reduce((a, b) => a + b, 0) / r.weeks).toFixed(1)}</td><td>${r.missingHol.map(([n, d]) => esc(n) + ' (' + d + ')').join(', ') || '—'}</td></tr>`)))}
  ${sect('files', "Files d'attente", T(['File', 'Stratégie', 'Agents', 'Appels (période)', 'Servis', 'Attente moy. (servis)', 'Attente avant abandon', 'Débordement'], D.queues.slice().sort((a, b) => (qs[b.number]?.n || 0) - (qs[a.number]?.n || 0)).map(q => { const x = qs[q.number] || {n: 0, served: 0, wait: 0, ab: 0, waitAb: 0};
      return `<tr><td>${esc(q.number + ' ' + q.name)}</td><td>${esc(q.strategy)}</td><td class="num">${q.members.length}</td><td class="num">${nf(x.n)}</td><td class="num">${x.n ? pc(x.served / x.n) : '–'}</td><td class="num">${x.served ? dur(Math.round(x.wait / x.served)) : '–'}</td><td class="num">${x.ab ? dur(Math.round(x.waitAb / x.ab)) : '–'}</td><td>${esc(cmpDest(q.dest))}</td></tr>`; })))}
  ${sect('agents', 'Performance des agents', T(['Poste', 'Entrants répondus', 'Conversation moy.', 'Taux de réponse en file', 'Sonneries manquées'], agRows.map(([x, a]) => `<tr><td>${esc(x + ' ' + dnName(x))}</td><td class="num">${nf(a.n)}</td><td class="num">${a.n ? dur(Math.round(a.t / a.n)) : '–'}</td>
      <td class="num">${(a.pa + a.pe) ? pc(a.pa / (a.pa + a.pe)) : '–'}</td><td class="num">${nf(a.pe)}</td></tr>`)))}
  ${sect('postes', 'Postes', T(['Poste', 'Nom', 'Courriel', 'Téléphone', 'Files'], D.extensions.slice().sort((a, b) => a.number.localeCompare(b.number)).map(e => `<tr><td class="mono">${esc(e.number)}</td><td>${esc((e.first + ' ' + e.last).trim())}</td><td>${esc(e.email)}</td>
      <td>${esc(e.devices.map(d => d.model || d.template).join(', ') || '—')}</td><td>${esc(e.queues.join(', '))}</td></tr>`)))}
  ${sect('tel', 'Téléphones à mettre à jour', `<p>${phTodo.length} téléphone${phTodo.length > 1 ? 's' : ''} sur ${ph.length} : firmware plus ancien que la version recommandée par 3CX, ou version inconnue (aucun firmware assigné et aucun indice). À traiter depuis la console 3CX : Téléphones → Mettre à jour le firmware.</p>` +
      T(['Poste', 'Modèle', 'MAC', 'État', 'Recommandé 3CX'], phTodo.map(r => `<tr><td>${esc(r.ext + ' ' + r.user)}</td><td>${esc(r.model)}</td><td class="mono">${esc(macFmt(r.mac))}</td><td>${PH_ST[r.st].l}</td><td class="mono">${esc(r.rec || '—')}</td></tr>`)))}
  ${sect('audit', "Modifications de la configuration (journal d'audit)", auditHTML())}
  <footer class="rpfoot">Généré par 3CXplore — données issues du backup du ${esc(bkDate(FULL.info.date))}.</footer>`;
};

