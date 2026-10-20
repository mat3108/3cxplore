// ---------- Fiche employé (17.2) : tout ce que le backup sait d'une personne, sur une page imprimable ----------
const EMP_KEY = 'employe3cx';
function empStats(E, from, to){
  const n = E.number, all = FULL.calls, R = {inAns: 0, inTalk: 0, rings: 0, ringAns: 0, ringMiss: 0, ringCanc: 0, pick: [], out: 0, outAns: 0, outTalk: 0, intOut: 0, intIn: 0, intInAns: 0,
    day: {}, heat: Array.from({length: 7}, () => Array(24).fill(0)), dest: {}, mates: {}, outCalls: []};
  const D_ = d => R.day[d] ||= {in: 0, out: 0, int: 0};
  for(const c of all){ const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue;
    const mine = Array.isArray(c[11]) ? c[11].find(([x]) => x === n) : null;
    if(c[1] === 'in'){
      if(mine || (c[10] === 'ans' && c[6] === n)){ R.inAns++; R.inTalk += mine ? mine[1] : c[8] || 0; D_(lp[0]).in++; R.heat[lp[2]][lp[1]]++; }
      if(c[13] === n && c[12] != null) R.pick.push(c[12]);
      (Array.isArray(c[14]) ? c[14] : []).forEach(s => { if(s[1] === 'extension' && s[0] === n){ R.rings++; if(s[4] >= 0) R.ringAns++; else if(s[5] === 'cancelled') R.ringCanc++; else R.ringMiss++; } }); }
    else if(c[1] === 'out' && c[2] === n){ R.out++; D_(lp[0]).out++; R.heat[lp[2]][lp[1]]++; if(c[10] === 'ans' && c[8] > 0){ R.outAns++; R.outTalk += c[8]; } R.outCalls.push(c);
      const [r] = dstOf(c[4]); R.dest[r] = (R.dest[r] || 0) + 1; }
    else if(c[1] === 'int'){
      if(c[2] === n){ R.intOut++; D_(lp[0]).int++; if(DN[c[4]]) R.mates[c[4]] = (R.mates[c[4]] || 0) + 1; }
      else if(c[4] === n || c[6] === n){ R.intIn++; if(c[10] === 'ans') R.intInAns++; if(DN[c[2]]) R.mates[c[2]] = (R.mates[c[2]] || 0) + 1; } } }
  // files d'attente : sonneries des agents et appels servis
  R.q = {}; if(typeof HAS_POLLS !== 'undefined' && HAS_POLLS) Object.entries(FULL.agentPolls || {}).forEach(([k, v]) => { const [d, q, ag] = k.split('|'); if(ag !== n || d < from || d > to) return; const x = R.q[q] ||= {ans: 0, exp: 0, served: 0}; x.ans += v[0]; x.exp += v[1]; });
  (FULL.queueCalls || []).forEach(r => { if(r[7] !== n || !r[6]) return; const d = localParts(r[0])[0]; if(d < from || d > to) return; (R.q[r[1]] ||= {ans: 0, exp: 0, served: 0}).served++; });
  // temps connecté aux files (journal des connexions) et part passée en conversation
  let oc = {}; try{ oc = JSON.parse(localStorage.getItem('occupation3cx') || '{}'); }catch(e){}
  const O = occAgent(n, dayStartTs(from), dayStartTs(addDaysISO(to, 1)), (oc.h || 'aff') === 'aff'); // 18.1.15 : même calcul que l'onglet Taux d'occupation
  R.onH = O ? O.on / 3600 : 0; R.occ = O && O.on ? O.occ : null;
  return R;
}
// 18.1.15 : taux d'occupation d'un agent, même calcul que l'onglet Taux d'occupation des agents
function occAgent(a, pStart, pEnd, biz){
  const E = FULL.agentStatus || [], ev = E.filter(r => r[2] === a), all = FULL.calls; if(!ev.length) return null;
  const evStart = Date.parse(E[0][0]), end = Math.max(all.length ? Date.parse(all[0][0]) : 0, Date.parse(E[E.length - 1][0]));
  const inBiz = t => { if(!biz) return true; const lp = localParts(new Date(t).toISOString()); return lp[2] < 6 && lp[1] >= 7 && lp[1] < 20; };
  const span = (x, y) => { let s = 0; for(let t = x; t < y;){ const nx = Math.min(y, (Math.floor(t / 3600000) + 1) * 3600000); if(inBiz(t)) s += nx - t; t = nx; } return s / 1000; };
  const q = new Set(), firstOn = {}, spans = []; let since = null;
  ev.forEach(([, qq, , on]) => { if(!(qq in firstOn)) firstOn[qq] = on; });
  Object.entries(firstOn).forEach(([qq, on]) => { if(on === 0){ q.add(qq); since = evStart; } }); // déjà connecté avant le début du journal
  ev.forEach(([t, qq, , on]) => { const ms = Date.parse(t), was = q.size > 0; if(on) q.add(qq); else q.delete(qq); if(!was && q.size) since = ms; else if(was && !q.size){ spans.push([since, ms]); since = null; } });
  if(q.size && since != null) spans.push([since, end]);
  const sp = spans.map(([s, e]) => [Math.max(s, pStart), Math.min(e, pEnd)]).filter(([s, e]) => e > s), on = sp.reduce((t, [s, e]) => t + span(s, e), 0);
  if(!on) return {on: 0, talk: 0, occ: null};
  const inSp = t => sp.some(([s, e]) => t >= s && t < e); let talk = 0;
  for(const c of all){ const t = Date.parse(c[0]); if(t < pStart) break; if(t >= pEnd || !inBiz(t) || !inSp(t)) continue;
    if(Array.isArray(c[11])) c[11].forEach(([x, s]) => { if(x === a) talk += s || 0; });
    if(c[1] === 'out' && ST_ANS.has(c[10]) && c[2] === a) talk += c[8] || 0;
    else if(c[1] === 'int' && c[10] === 'ans' && c[2] === a && !(c[11] || []).some(([x]) => x === a)) talk += c[8] || 0; }
  return {on, talk, occ: Math.min(1, talk / on)};
}
V.employe = (el, arg) => {
  const S = window.__emp ||= (() => { try{ return JSON.parse(localStorage.getItem(EMP_KEY) || '{}'); }catch(e){ return {}; } })();
  const exts = FULL.extensions.filter(e => !SEG || SEGOF[e.number] === SEG).slice().sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  if(arg) S.ext = decodeURIComponent(arg);
  if(!exts.some(e => e.number === S.ext)) S.ext = (exts.find(e => (e.first || e.last)) || exts[0] || {}).number || '';
  const E = EXT_BY[S.ext];
  if(!E){ el.innerHTML = '<h2>Fiche employé</h2><p class="muted">Aucun poste.</p>'; return; }
  const all = FULL.calls, first = all.length ? callHist().first : '', last = all.length ? localParts(all[0][0])[0] : '';
  S.p ||= '30'; const [from, to] = all.length ? perRange(S.p, first, last) : ['', ''], days = from ? Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1) : 1;
  const save = () => { try{ localStorage.setItem(EMP_KEY, JSON.stringify({ext: S.ext, p: S.p})); }catch(e){} V.employe(el); };
  const nm = e => (e.first + ' ' + e.last).trim() || e.number, seg = SEGOF[E.number] || SEG_COMMON, R = empStats(E, from, to);
  const med = l => { if(!l.length) return null; const x = l.slice().sort((a, b) => a - b); return x[Math.floor(x.length / 2)]; };
  const avg = (s, n) => n ? Math.round(s / n) : 0, pc = (a, b) => b ? Math.round(100 * a / b) + ' %' : '–';
  // qualité du service : clients qui rappellent après l'avoir eue (48 h, sans rappels de moins de 10 min)
  let rep = null; try{ const A = repAnalysis(from, to, 48), mine = A.served.filter(x => x.who === E.number); rep = {n: mine.length, r: mine.filter(x => x.slow).length}; }catch(e){}
  // coût de ses appels sortants (tarifs de l'onglet Coût des appels sortants)
  let cost = null; try{ const C = cstLoad(), rate = k => cstNum((C.t[k] || {}).m), fee = k => cstNum((C.t[k] || {}).a);
    if(CST_REGS.some(([k]) => rate(k) || fee(k))) cost = R.outCalls.filter(c => c[10] === 'ans' && c[8] > 0).reduce((s, c) => { const [r] = dstOf(c[4]); const sec = Math.ceil(c[8] / C.inc) * C.inc; return s + sec / 60 * rate(r) + fee(r); }, 0); }catch(e){}
  // ce qui dépend d'elle et ce qu'il faut corriger sur son poste
  const issues = empIssues(E).map(x => [x.cat, x.text, x.sev, x.href]); /* 18.4 : liste commune avec Corrections par usager */
  let indisp = null; try{ indisp = indispAnalysis().people.find(p => p.a === E.number) || null; }catch(e){}
  let abs = []; try{ const t = absToday(); abs = absLoad().filter(a => a.ext === E.number && a.to >= t); }catch(e){}
  let hx = []; try{ hx = hxEvents(E.number).slice().sort((a, b) => a.t < b.t ? 1 : -1); }catch(e){}
  const refs = (dnRefs()[E.number] || []).filter(r => r.cat !== 'member');
  // série par jour et carte de chaleur
  const dlist = from ? absDays(from, to) : [], mxd = Math.max(1, ...dlist.map(d => R.day[d] ? R.day[d].in + R.day[d].out : 0)), mxh = Math.max(1, ...R.heat.flat());
  const qrows = Object.entries(R.q).map(([q, x]) => ({q, ...x})).sort((a, b) => (b.ans + b.served) - (a.ans + a.served));
  const mates = Object.entries(R.mates).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const destT = Object.values(R.dest).reduce((a, b) => a + b, 0), destTop = Object.entries(R.dest).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const kp = (l, v, c) => `<div class="${c || ''}"><b>${v}</b><span>${esc(l)}</span></div>`;
  el.innerHTML = `<div id="empwrap"><div class="noprint"><h2>Fiche employé</h2>
    <p class="lead">Tout ce que le backup sait d'une personne, sur une seule page : son poste, ses appels, son travail en file d'attente, la qualité du service, ce qui dépend d'elle et ce qu'il faut corriger sur son poste${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Employé</label><select id="empsel">${exts.map(e => `<option value="${esc(e.number)}"${e.number === E.number ? ' selected' : ''}>${esc(e.number)} ${esc(nm(e))}${SEG ? '' : ' · ' + esc(segShort(SEGOF[e.number] || SEG_COMMON))}</option>`).join('')}</select>
      <label class="count">Période</label>${perUI('empp', S.p, first, last)}<span style="flex:1"></span><a class="btn" href="#attente/${esc(E.number)}~${esc(S.p)}">Mises en attente</a><button class="btn" id="empprint">Imprimer / PDF</button><button class="btn" id="empxl">Exporter en Excel</button></div></div>
    <div class="report" id="empsheet"><header class="rpcover"><div class="rpk">Fiche employé · 3CXplore</div><h1>${esc(nm(E))} <span class="muted mono" style="font-size:.6em">${esc(E.number)}</span></h1>
      <div class="rpmeta">${esc(segName(seg))} · ${E.enabled ? 'poste actif' : 'poste désactivé'} · du ${esc(from)} au ${esc(to)} (${nf(days)} jours) · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
    <section class="rps"><h2>Identité et poste</h2>${kv([['Courriel', esc(E.email || '')], ['Cellulaire', esc(phone(E.mobile) || E.mobile || '')], ['Numéro présenté', esc(phone(E.callerId) || E.callerId || '')], ['Profil actuel', esc(E.profile || '')],
        ['Téléphones', E.devices.map(d => `${esc(d.model || d.template || '?')} <span class="muted mono">${esc(d.mac || '')}</span>${d.firmware ? ` <span class="muted">fw ${esc(d.firmware)}</span>` : ''}`).join('<br>') || 'application seulement'],
        ['Départements', (E.groups || []).filter(g => !/^(__|SYSTEM$)/.test(g.g)).map(g => esc(g.g) + (g.role && g.role !== 'users' ? ` <span class="muted">(${esc(VROLE_FR[g.role] || g.role)})</span>` : '')).join(', ')], ["Files d'attente", (E.queues || []).map(q => dnLink(q)).join(', ')], ['Groupes de sonnerie', (E.ringGroups || []).map(r => dnLink(r)).join(', ')],
        ['Messagerie vocale', E.vm ? 'activée' : 'désactivée'], ['Enregistrement des appels', E.record ? 'oui' : 'non']])}<p class="noprint"><a href="#" data-dn="${esc(E.number)}" class="dn btn">Fiche complète du poste</a> <a class="btn" href="#historique/${esc(E.number)}">Historique des modifications (${nf(hx.length)})</a></p></section>
    <section class="rps"><h2>Appels</h2><div class="rpkpis">${kp('Entrants répondus', nf(R.inAns))}${kp('Conversation moyenne (entrants)', dur(avg(R.inTalk, R.inAns)))}${kp('Sonneries reçues', R.rings ? nf(R.rings) : '–')}
      ${kp('Sonneries sans réponse', R.rings ? `${nf(R.ringMiss)} (${pc(R.ringMiss, R.rings)})` : '–', R.rings && R.ringMiss / R.rings > .2 ? 'warn' : '')}${kp('Sonneries arrêtées (un collègue a répondu)', R.rings ? nf(R.ringCanc) : '–')}${kp('Délai de décroché (médiane)', med(R.pick) != null ? dur(med(R.pick)) : '–')}
      ${kp('Sortants', nf(R.out))}${kp('Sortants aboutis', `${nf(R.outAns)} (${pc(R.outAns, R.out)})`)}${kp('Conversation moyenne (sortants)', dur(avg(R.outTalk, R.outAns)))}${kp('Internes passés / reçus', `${nf(R.intOut)} / ${nf(R.intIn)}`)}
      ${kp('Temps au téléphone', dur(R.inTalk + R.outTalk))}${kp('Appels par jour', (Math.round((R.inAns + R.out) / days * 10) / 10).toString().replace('.', ','))}${kp('Taux d\'occupation (files)', R.occ != null ? Math.round(100 * R.occ) + ' %' : '–')}</div>
      ${dlist.length ? `<h3>Jour par jour</h3><div class="empbars">${dlist.map(d => { const x = R.day[d] || {in: 0, out: 0}; return `<i title="${d} : ${x.in} entrants répondus, ${x.out} sortants"><span style="height:${100 * x.in / mxd}%;background:var(--c-in, #2563eb)"></span><span style="height:${100 * x.out / mxd}%;background:var(--c-out, #0d9488)"></span></i>`; }).join('')}</div>
        <div class="muted" style="font-size:11.5px;display:flex;justify-content:space-between"><span>${esc(from)}</span><span><i class="empsq" style="background:var(--c-in, #2563eb)"></i> entrants répondus <i class="empsq" style="background:var(--c-out, #0d9488)"></i> sortants</span><span>${esc(to)}</span></div>` : ''}
      <h3>Carte de chaleur : jour × heure</h3><div class="tw"><table class="rcheat empheat"><thead><tr><th></th>${Array.from({length: 24}, (_, h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${R.heat.map((row, wd) => `<tr><th>${WD[wd]}</th>${row.map((v, h) => `<td title="${WD[wd]} ${h} h : ${v} appel(s)" style="background:${v ? `rgba(37,99,235,${(0.12 + 0.88 * v / mxh).toFixed(2)})` : 'transparent'};color:${v / mxh > .55 ? '#fff' : 'inherit'}">${v || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:12px">Carte : appels entrants répondus et appels sortants, par jour de semaine et par heure. Sonneries sans réponse : le poste a sonné sans que la personne réponde (délai dépassé, appel renvoyé) ; les sonneries arrêtées parce qu'un collègue a répondu ou que l'appelant a raccroché sont comptées à part. Taux d'occupation : part du temps connecté aux files passée en conversation.</p></section>
    ${qrows.length ? `<section class="rps"><h2>Files d'attente</h2><table class="rpt"><thead><tr><th>File</th><th class="num">Sonneries répondues</th><th class="num">Sonneries expirées</th><th class="num">Taux de réponse</th><th class="num">Appels servis</th></tr></thead><tbody>${qrows.map(x => `<tr><td>${dnLink(x.q)}</td><td class="num">${nf(x.ans)}</td><td class="num">${nf(x.exp)}</td><td class="num">${pc(x.ans, x.ans + x.exp)}</td><td class="num">${nf(x.served)}</td></tr>`).join('')}</tbody></table>
      <p class="muted" style="font-size:12px">Temps connecté aux files sur la période : ${R.onH ? (Math.round(R.onH * 10) / 10).toString().replace('.', ',') + ' h' : '–'}.</p></section>` : ''}
    <section class="rps"><h2>Qualité et coûts</h2>${kv([['Clients qui rappellent (48 h)', rep && rep.n ? `${pc(rep.r, rep.n)} <span class="muted">(${nf(rep.r)} sur ${nf(rep.n)} appels servis)</span>` : '–'],
        ['Destinations des appels sortants', destT ? destTop.map(([k, v]) => `${esc((DST_REG.find(x => x[0] === k) || [, k])[1])} ${pc(v, destT)}`).join(' · ') : '–'],
        ['Coût des appels sortants', cost != null ? `${money(cost)} <span class="muted">(≈ ${money(cost * 30.4 / days)} par mois)</span>` : '<span class="muted">tarifs à saisir dans l\'onglet Coût des appels sortants</span>'],
        ['Collègues les plus en contact (internes)', mates.length ? mates.map(([m, v]) => `${dnLink(m)} <span class="muted">${nf(v)}</span>`).join(', ') : '–']])}</section>
    <section class="rps"><h2>Ce qui dépend de cette personne</h2>${kv([['Mène directement à son poste', refs.length ? refs.slice(0, 8).map(r => `<div>${refLine(r)}</div>`).join('') + (refs.length > 8 ? `<div class="muted">… et ${refs.length - 8} autre(s)</div>` : '') : 'rien'],
        ['Personne indispensable', indisp ? indisp.items.map(i => `${dnLink(i.x.dn)}${i.solo ? ' — seule personne connectée' : ''}${i.share ? ` — ${Math.round(100 * i.share)} % des réponses` : ''}`).join('<br>') : 'non'],
        ['Absences prévues', abs.length ? abs.map(a => `du ${esc(a.from)} au ${esc(a.to)}${a.note ? ' (' + esc(a.note) + ')' : ''}`).join('<br>') : 'aucune']])}</section>
    <section class="rps"><h2>À corriger sur son poste (${nf(issues.length)})</h2>${issues.length ? `<table class="rpt"><thead><tr><th>Sujet</th><th>Constat</th></tr></thead><tbody>${issues.map(([t, d, sev, href]) => `<tr><td><a href="${href}">${esc(t)}</a></td><td><span class="pill ${sev}" style="white-space:normal">${esc(d)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Rien à corriger.</p>'}</section>
    ${hx.length ? `<section class="rps"><h2>Dernières modifications</h2><ul>${hx.slice(0, 8).map(h => `<li>${esc(fmtD(h.t))} — ${esc(h.txt || '')}${h.who ? ` <span class="muted">(${esc(h.who)})</span>` : ''}</li>`).join('')}</ul></section>` : ''}
    </div></div>`;
  $('#empsel').addEventListener('change', e => { S.ext = e.target.value; save(); });
  perWire('empp', S.p, first, last, v => { S.p = v; save(); });
  $('#empprint').addEventListener('click', () => printHTML($('#empsheet').outerHTML.replace('id="empsheet"', '')));
  $('#empxl').addEventListener('click', () => {
    const sh = [{name: 'Fiche', rows: [['Rubrique', 'Valeur'], ['Poste', E.number], ['Nom', nm(E)], ['Magasin', segName(seg)], ['Période', `${from} au ${to}`], ['Entrants répondus', R.inAns], ['Conversation moyenne entrants (s)', avg(R.inTalk, R.inAns)],
      ['Sonneries reçues', R.rings], ['Sonneries sans réponse', R.ringMiss], ['Sonneries arrêtées (un collègue a répondu)', R.ringCanc], ['Délai de décroché médian (s)', med(R.pick) ?? ''], ['Sortants', R.out], ['Sortants aboutis', R.outAns], ['Conversation moyenne sortants (s)', avg(R.outTalk, R.outAns)],
      ['Internes passés', R.intOut], ['Internes reçus', R.intIn], ['Temps au téléphone (s)', R.inTalk + R.outTalk], ["Taux d'occupation (files)", R.occ != null ? Math.round(100 * R.occ) + ' %' : ''],
      ['Clients qui rappellent (48 h)', rep && rep.n ? `${rep.r} / ${rep.n}` : ''], ['Coût des appels sortants', cost != null ? cost.toFixed(2) : '']]},
      {name: 'Par jour', rows: [['Jour', 'Entrants répondus', 'Sortants', 'Internes passés']].concat(dlist.map(d => { const x = R.day[d] || {in: 0, out: 0, int: 0}; return [d, x.in, x.out, x.int]; }))},
      {name: "Files d'attente", rows: [['File', 'Sonneries répondues', 'Sonneries expirées', 'Appels servis']].concat(qrows.map(x => [`${x.q} ${dnName(x.q)}`, x.ans, x.exp, x.served]))},
      {name: 'À corriger', rows: [['Sujet', 'Constat']].concat(issues.map(([t, d]) => [t, d]))}];
    const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build(sh).blob); a.download = `fiche-employe-${E.number}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
};
