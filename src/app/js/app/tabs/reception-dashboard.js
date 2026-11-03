// ---------- Tableau de bord des réceptions (onglet) ----------
// postes de réception : nom contenant « réception » ou rôle Réceptionniste dans un département ; on peut en ajouter
const recAuto = () => { const rr = new Set(); FULL.groups.forEach(g => g.members.forEach(m => { if(m.role === 'receptionists') rr.add(m.dn); }));
  return FULL.extensions.filter(e => /r[ée]ception/i.test(e.first + ' ' + e.last) || rr.has(e.number)).map(e => e.number); };
const recNumbers = () => { let j = {}; try{ j = JSON.parse(localStorage.getItem('receptions3cx:' + (FULL.info.fqdn || '')) || '{}'); }catch(e){}
  const off = j.off || []; return new Set([...recAuto(), ...(j.extra || [])].filter(n => !off.includes(n) && DN[n])); };
// ---------- Transferts revenus à la réception (20.10.1) ----------
// la personne qui a l'appel le transfère, la destination ne répond pas (sans réponse, occupé, ne pas déranger…) et l'appel sonne de nouveau chez elle ou à une réception ;
// les transferts vers un parking, un menu ou une messagerie sont ignorés (les retours de parking ont leur propre analyse)
const BNC_SKIP = new Set(['shared_parking', 'parking_orbit', 'ivr', 'voicemail', 'vmail_console']);
const BNC_WHY = {no_answer: 'sans réponse', busy: 'occupé', dnd: 'ne pas déranger', custom_dnd: 'statut personnalisé', away: 'absent', not_registered: 'poste non connecté', no_destinations: 'aucun agent disponible'};
function callBounces(c, rec){
  const st = c[14], T = []; if(!Array.isArray(st)) return T;
  let who = null, p = null;
  const took = dn => { who = dn; p = null; T.forEach(x => { if(x.back) x.back.ans = true; }); }; // une personne a répondu : les retours précédents ont abouti
  for(const s of st){ const [dn, k] = s;
    if(s[7] === 'transfer'){ p = null; if(BNC_SKIP.has(k) || !who) continue; p = {from: who, to: dn, t: s[2], why: '', back: null}; T.push(p); if(k === 'extension' && s[4] >= 0) took(dn); continue; }
    if(p && s[7] === 'divert' && !p.why) p.why = s[8];
    if(k !== 'extension') continue;
    if(p && p.why && (dn === p.from || rec.has(dn))){ p.back = {at: dn, wait: s[2] - p.t, ans: false}; p = null; }
    if(s[4] >= 0) took(dn); }
  return T;
}
// par personne qui transfère : appels transférés, transferts revenus, destinations qui renvoient, appels concernés (du plus récent au plus ancien) ;
// « terminés sans réponse » : personne n'a répondu après le dernier retour (l'appelant raccroche, messagerie…)
function bounceAnalysis(from, to, rec){
  const P = {};
  for(const c of FULL.calls){ const d = localParts(c[0])[0]; if(d < from) break; if(d > to || c[1] !== 'in') continue;
    const T = callBounces(c, rec); if(!T.length) continue;
    const by = {}; T.forEach(x => (by[x.from] ||= []).push(x));
    Object.entries(by).forEach(([n, l]) => { const m = P[n] ||= {n, calls: 0, tr: 0, back: 0, backCalls: 0, multiTr: 0, multiBack: 0, lost: 0, dest: {}, list: []}, b = l.filter(x => x.back);
      m.calls++; m.tr += l.length; m.back += b.length; if(!b.length) return;
      b.forEach(x => { const r = m.dest[x.to] ||= {n: 0, why: {}}; r.n++; r.why[x.why] = (r.why[x.why] || 0) + 1; });
      m.backCalls++; if(T.length >= 2) m.multiTr++; if(b.length >= 2) m.multiBack++; const tb = T.filter(x => x.back); if(!tb[tb.length - 1].back.ans) m.lost++; m.list.push({c, T}); }); }
  return P;
}
// destinations qui renvoient le plus et derniers appels concernés ; lignes cliquables (data-bnc = rang dans m.list)
function bounceHTML(m, cls){
  const pc = (a, b) => b ? Math.round(100 * a / b) + ' %' : '—', whyTop = w => Object.entries(w).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(BNC_WHY[k] || k)} ${nf(v)}`).join(', ');
  const dest = Object.entries(m.dest).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  return `<h3>Destinations qui renvoient l'appel</h3><div class="tw"><table class="${cls}"><thead><tr><th>Destination du transfert</th><th class="num">Retours</th><th class="num">Part des retours</th><th>Pourquoi</th></tr></thead><tbody>
      ${dest.map(([d, r]) => `<tr><td>${DN[d] ? dnLink(d) : `<span class="mono">${esc(phone(d) || d)}</span>`}</td><td class="num">${nf(r.n)}</td><td class="num">${pc(r.n, m.back)}</td><td class="muted">${whyTop(r.why)}</td></tr>`).join('')}</tbody></table></div>
    <h3>Derniers appels revenus (${nf(Math.min(20, m.list.length))} sur ${nf(m.list.length)})</h3><div class="tw"><table class="${cls}"><thead><tr><th>Date</th><th>Appelant</th><th>Transferts</th><th class="num">Retours</th><th>Issue</th></tr></thead><tbody>
      ${m.list.slice(0, 20).map(({c, T}, i) => `<tr class="click" data-bnc="${i}"><td>${fmtD(c[0])}</td><td class="mono">${esc(phone(c[2]) || c[2])}</td>
        <td>${T.map(x => `${DN[x.to] ? dnLink(x.to) : esc(phone(x.to) || x.to)}${x.back ? ` <span class="muted">(${esc(BNC_WHY[x.why] || x.why)}, revenu)</span>` : ''}`).join(' → ')}</td><td class="num">${nf(T.filter(x => x.back).length)}</td><td>${stHTML(c)}</td></tr>`).join('')}</tbody></table></div>`;
}
V.receptions = el => {
  const S = window.__rcp ||= {per: '30', extra: [], off: [], sel: ''}, RK = 'receptions3cx:' + (FULL.info.fqdn || '');
  // postes ajoutés ou exclus : mémorisés dans ce navigateur
  if(!S.loaded){ try{ const j = JSON.parse(localStorage.getItem(RK) || '{}'); S.extra = j.extra || []; S.off = j.off || []; }catch(e){} S.loaded = 1; }
  const keep = () => { try{ localStorage.setItem(RK, JSON.stringify({extra: S.extra, off: S.off})); }catch(e){} };
  const all = FULL.calls, lastDay = all.length ? localParts(all[0][0])[0] : new Date().toISOString().slice(0, 10), firstDay = all.length ? callHist().first : lastDay;
  const [from, to] = perRange(S.per, firstDay, lastDay);
  const recs = [...new Set([...recAuto(), ...S.extra])].filter(n => !S.off.includes(n) && DN[n] && (!SEG || SEGOF[n] === SEG));
  const set = new Set(recs), M = {}; recs.forEach(n => M[n] = {n, off: 0, ans: 0, lost: 0, talk: 0, iv: [], heat: Array.from({length: 7}, () => Array.from({length: 24}, () => ({o: 0, l: 0}))), park: 0, phang: 0, pback: 0});
  const days = new Set();
  for(const c of all){ if(c[1] !== 'in') continue; const d = localParts(c[0])[0]; if(d < from || d > to) continue; days.add(d);
    const at = new Set(c[9].filter(p => p[1] === 'extension' && set.has(p[0])).map(p => p[0])); if(!at.size) continue;
    const ansBy = new Map(c[11]), t = new Date(c[0]), lpc = localParts(c[0]), wd = lpc[2], h = lpc[1], lost = ST_LOST.has(c[10]);
    at.forEach(n => { const m = M[n]; m.off++; if(ansBy.has(n)){ m.ans++; m.talk += ansBy.get(n); } else if(lost) m.lost++;
      const hc = m.heat[wd][h]; hc.o++; if(!ansBy.has(n) && lost) hc.l++; const st = Date.parse(c[0]); m.iv.push([st, st + Math.max(1, c[7]) * 1000]); }); }
  (FULL.parkCalls || []).forEach(r => { const m = M[r[4]]; if(!m || r[3] === 'direct') return; const d = localParts(r[0])[0]; if(d < from || d > to) return; m.park++; if(r[3] === 'hangup') m.phang++; if(r[3] === 'back' || r[3] === 'timeout') m.pback++; });
  // appels simultanés : balayage des intervalles
  Object.values(M).forEach(m => { const ev = []; m.iv.forEach(([a, b]) => { ev.push([a, 1]); ev.push([b, -1]); }); ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let cur = 0, mx = 0, t2 = 0, last = 0; ev.forEach(([t, d]) => { if(cur >= 2) t2 += t - last; cur += d; last = t; if(cur > mx) mx = cur; }); m.maxSim = mx; m.sim2 = t2; delete m.iv; });
  const rows = Object.values(M).filter(m => m.off).sort((a, b) => b.off - a.off), nd = days.size || 1;
  const BN = bounceAnalysis(from, to, set), bz = {n: '', calls: 0, tr: 0, back: 0, backCalls: 0, multiTr: 0, multiBack: 0, lost: 0, dest: {}, list: []};
  if(!rows.some(m => m.n === S.sel)) S.sel = rows[0]?.n || '';
  const sel = M[S.sel], pc = (a, b) => b ? Math.round(100 * a / b) + ' %' : '—';
  const tot = rows.reduce((t, m) => ({off: t.off + m.off, ans: t.ans + m.ans, lost: t.lost + m.lost, park: t.park + m.park, phang: t.phang + m.phang, trc: t.trc + (BN[m.n] || bz).calls, bc: t.bc + (BN[m.n] || bz).backCalls}), {off: 0, ans: 0, lost: 0, park: 0, phang: 0, trc: 0, bc: 0});
  const sb = sel ? BN[sel.n] || bz : null;
  // heures de surcharge : créneaux (jour × heure) avec le plus d'appels perdus
  const slots = sel ? sel.heat.flatMap((r, wd) => r.map((x, h) => ({wd, h, ...x}))).filter(x => x.l).sort((a, b) => b.l - a.l || b.o - a.o).slice(0, 6) : [];
  const WD = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const mxO = sel ? Math.max(1, ...sel.heat.flat().map(x => x.o)) : 1;
  const others = FULL.extensions.filter(e => !set.has(e.number) && (!SEG || SEGOF[e.number] === SEG)).sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  el.innerHTML = `<div id="rcwrap"><h2>Réceptions</h2>
    <p class="lead">Les postes de réception (nom contenant « réception » ou rôle Réceptionniste, plus ceux que vous ajoutez) : appels qui leur sont présentés, répondus, perdus, mises en parking et appels raccrochés en parking, appels simultanés et heures de surcharge — pour savoir où ajouter de l'aide${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('rcper', S.per, firstDay, lastDay)}
      <label class="count">Ajouter un poste</label><select id="rcadd"><option value="">—</option>${others.map(e => `<option value="${esc(e.number)}">${esc(e.number + ' ' + (e.first + ' ' + e.last).trim())}</option>`).join('')}</select>
      <span class="count">du ${esc(from)} au ${esc(to)}</span></div>
    <div class="grid kpis">${[['Postes de réception', nf(rows.length)], ['Appels présentés', nf(tot.off)], ['Répondus par la réception', pc(tot.ans, tot.off)], ['Perdus pendant la sonnerie', pc(tot.lost, tot.off)], ['Mises en parking', nf(tot.park)], ['Raccrochés en parking', pc(tot.phang, tot.park)], ['Revenus après un transfert', tot.trc ? `${nf(tot.bc)} (${pc(tot.bc, tot.trc)})` : '—']].map(([l, v]) => `<div class="card kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="tw"><table><thead><tr><th>Poste</th><th>Magasin</th><th class="num">Appels / jour</th><th class="num">Présentés</th><th class="num">Répondus</th><th class="num">Perdus</th><th class="num">Conv. moy.</th><th class="num">Parking</th><th class="num">Raccrochés en parking</th><th class="num">Simultanés max</th><th class="num">Temps à 2+ appels</th><th class="num">Transférés</th><th class="num">Revenus après transfert</th><th></th></tr></thead><tbody>
      ${rows.map(m => { const lr = m.lost / (m.off || 1), hr = m.phang / (m.park || 1), b = BN[m.n] || bz, br = b.backCalls / (b.calls || 1);
        return `<tr class="${m.n === S.sel ? 'sel' : ''}" data-rc="${esc(m.n)}" style="cursor:pointer"><td>${dnLink(m.n)}</td><td>${esc(segShort(SEGOF[m.n] || SEG_COMMON))}</td><td class="num">${nf(Math.round(m.off / nd))}</td><td class="num">${nf(m.off)}</td><td class="num">${pc(m.ans, m.off)}</td>
          <td class="num">${m.lost ? `<span class="pill ${lr > .2 ? 'bad' : lr > .1 ? 'warn' : ''}">${pc(m.lost, m.off)}</span>` : '0 %'}</td><td class="num">${m.ans ? dur(Math.round(m.talk / m.ans)) : '—'}</td><td class="num">${nf(m.park)}</td>
          <td class="num">${m.phang ? `<span class="pill ${hr > .2 ? 'bad' : hr > .1 ? 'warn' : ''}">${nf(m.phang)} (${pc(m.phang, m.park)})</span>` : '0'}</td><td class="num">${m.maxSim}</td><td class="num">${dur(Math.round(m.sim2 / 1000 / nd))} / j</td>
          <td class="num">${nf(b.calls)}</td><td class="num">${b.backCalls ? `<span class="pill ${br > .2 ? 'bad' : br > .1 ? 'warn' : ''}">${nf(b.backCalls)} (${pc(b.backCalls, b.calls)})</span>` : '0'}</td>
          <td>${S.extra.includes(m.n) ? `<button class="btn" data-rcdel="${esc(m.n)}" title="Retirer de la liste">×</button>` : `<button class="btn" data-rcoff="${esc(m.n)}" title="Ne pas considérer comme réception">×</button>`}</td></tr>`; }).join('') || '<tr><td colspan="14" class="muted">Aucun poste de réception trouvé : ajoutez-en un avec « Ajouter un poste ».</td></tr>'}</tbody></table></div>
    ${S.off.length ? `<p class="muted" style="font-size:12.5px">Exclus : ${S.off.map(n => `${esc(n)} <a href="#" data-rcon="${esc(n)}">rétablir</a>`).join(' · ')}</p>` : ''}
    ${sel ? `<h3>${dnLink(sel.n)} — appels présentés par jour et par heure</h3>
      <div class="card" style="overflow:auto"><table class="rcheat"><thead><tr><th></th>${Array.from({length: 24}, (_, h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${sel.heat.map((r, wd) => `<tr><th>${WD[wd]}</th>${r.map((x, h) => { const a = x.o / mxO, lr = x.o ? x.l / x.o : 0;
        return `<td title="${WD[wd]} ${h} h : ${x.o} appel(s) présenté(s), ${x.l} perdu(s)" style="background:${x.o ? `color-mix(in srgb, ${lr > .2 ? 'var(--bad)' : lr > .1 ? 'var(--warn)' : 'var(--accent)'} ${Math.round(15 + 85 * a)}%, var(--panel))` : 'transparent'}">${x.o ? x.o : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
        <div class="legend"><span><i style="background:var(--accent)"></i>Peu de pertes</span><span><i style="background:var(--warn)"></i>Plus de 10 % perdus</span><span><i style="background:var(--bad)"></i>Plus de 20 % perdus</span><span class="muted">Intensité = nombre d'appels sur la période</span></div></div>
      <h3>Heures de surcharge</h3><div class="card" style="font-size:13px">${slots.map(x => `<div><b>${WD[x.wd]} ${x.h} h</b> <span class="muted">— ${x.l} appel${x.l > 1 ? 's' : ''} perdu${x.l > 1 ? 's' : ''} sur ${x.o} présenté${x.o > 1 ? 's' : ''} (${pc(x.l, x.o)})</span></div>`).join('') || '<span class="muted">Aucun appel perdu pendant la sonnerie sur la période.</span>'}
        ${slots.length ? '<p class="muted" style="margin:6px 0 0">Ce sont les créneaux où un renfort (deuxième personne, file avec débordement vers un collègue) aurait le plus d\'effet.</p>' : ''}</div>
      <h3>${dnLink(sel.n)} — transferts revenus à la réception</h3>
      ${sb.backCalls ? `<div class="grid kpis">${[['Appels transférés', nf(sb.calls)], ['Revenus faute de réponse', `${nf(sb.backCalls)} (${pc(sb.backCalls, sb.calls)})`], ['Transférés plusieurs fois', nf(sb.multiTr)], ['Revenus 2 fois ou plus', nf(sb.multiBack)], ['Terminés sans réponse', nf(sb.lost)]].map(([l, v]) => `<div class="card kpi"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
        ${bounceHTML(sb, '')}` : `<p class="muted">${sb.calls ? `Aucun des ${nf(sb.calls)} appels transférés n'est revenu à la réception faute de réponse.` : 'Aucun appel transféré sur la période.'}</p>`}` : ''}
    <p class="note">Appels présentés : appels entrants qui ont sonné à ce poste (directement, par une file ou un groupe). Perdus : appels présentés qui ne se sont terminés par aucune réponse (abandon, raccroché au menu ou en parking, non répondu). Temps à 2+ appels : durée moyenne par jour pendant laquelle au moins deux appels étaient en cours pour ce poste. Revenus après transfert : appels que ce poste a transférés, où la destination n'a pas répondu (sans réponse, occupé, ne pas déranger…) et qui ont sonné de nouveau à ce poste ou à une autre réception ; les transferts vers un parking, un menu ou une messagerie ne sont pas comptés. Terminés sans réponse : personne n'a répondu après le dernier retour.</p></div>`;
  const re = () => { keep(); V.receptions(el); };
  perWire('rcper', S.per, firstDay, lastDay, v => { S.per = v; re(); });
  $('#rcadd').addEventListener('change', e => { if(e.target.value){ S.extra.push(e.target.value); S.off = S.off.filter(n => n !== e.target.value); re(); } });
  $('#rcwrap').addEventListener('click', e => {
    const d = e.target.closest('[data-rcdel]'), o = e.target.closest('[data-rcoff]'), on = e.target.closest('[data-rcon]'), tr = e.target.closest('tr[data-rc]');
    if(d){ S.extra = S.extra.filter(n => n !== d.dataset.rcdel); re(); return; }
    if(o){ S.off.push(o.dataset.rcoff); re(); return; }
    if(on){ e.preventDefault(); S.off = S.off.filter(n => n !== on.dataset.rcon); re(); return; }
    const bc = e.target.closest('tr[data-bnc]'); if(bc && sb && !e.target.closest('a')){ openCall(sb.list[+bc.dataset.bnc].c); return; }
    if(tr && !e.target.closest('a.dn')){ S.sel = tr.dataset.rc; re(); } });
};

