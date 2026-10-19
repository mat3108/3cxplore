// ---------- Effectif selon l'achalandage (files d'attente) ----------
// Erlang C : probabilité d'attendre avec N agents pour A erlangs de trafic
function erlangC(N, A){ if(N <= A) return 1; let sum = 0, term = 1; for(let k = 0; k < N; k++){ if(k) term *= A / k; sum += term; } const pN = term * A / N * N / (N - A); return pN / (sum + pN); }
// nombre d'agents pour répondre à 80 % des appels en moins de T secondes
function erlangNeed(cph, aht, T, SL = 0.8){ if(cph <= 0) return 0; const A = cph * aht / 3600; for(let N = Math.max(1, Math.ceil(A)); N < 60; N++){ if(1 - erlangC(N, A) * Math.exp(-(N - A) * T / aht) >= SL) return N; } return 60; }
// agents connectés en moyenne par créneau (jour × heure), reconstitués d'après les connexions / déconnexions ; un agent connecté à plusieurs files de la sélection compte une fois
function effConnected(qset, first, last, nWd){
  if(!FULL.agentStatus) return null;
  const t0 = Date.parse(addDaysISO(first, -1) + 'T00:00:00Z'), t1 = Date.parse(addDaysISO(last, 2) + 'T00:00:00Z');
  const hours = []; for(let t = t0; t < t1; t += 3600e3){ const [d, h, wd] = localParts(new Date(t).toISOString()); if(d >= first && d <= last) hours.push([t, h, wd]); }
  const ev = {}; FULL.agentStatus.forEach(r => { if(qset.has(r[1])) (ev[r[2] + '|' + r[1]] ||= []).push([Date.parse(r[0]), r[3]]); });
  FULL.queues.filter(q => qset.has(q.number)).forEach(q => q.members.forEach(m => { ev[m.dn + '|' + q.number] ||= []; ev[m.dn + '|' + q.number].cur = !m.status || m.status === 'LoggedIn' ? 1 : 0; }));
  const byAg = {};
  Object.entries(ev).forEach(([k, list]) => { const ag = k.split('|')[0], iv = byAg[ag] ||= [];
    // état avant le premier changement : l'inverse du premier changement ; sans changement : état au moment du backup
    let st = list.length ? 1 - list[0][1] : (list.cur || 0), from = t0;
    list.forEach(([t, v]) => { if(st && !v) iv.push([from, t]); if(!st && v) from = t; st = v; });
    if(st) iv.push([list.length ? from : t0, t1]); });
  const G = Array.from({length: 7}, () => Array(24).fill(0));
  Object.values(byAg).forEach(iv => { iv.sort((a, b) => a[0] - b[0]); const u = []; iv.forEach(x => { const l = u[u.length - 1]; if(l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else u.push([...x]); });
    let j = 0; hours.forEach(([t, h, wd]) => { const e = t + 3600e3; while(j < u.length && u[j][1] <= t) j++; let ov = 0; for(let k = j; k < u.length && u[k][0] < e; k++) ov += Math.min(e, u[k][1]) - Math.max(t, u[k][0]); if(ov > 0) G[wd][h] += ov / 3600e3; }); });
  return G.map((r, wd) => r.map(v => v / (nWd[wd] || 1)));
}
const EFF_OBJ = [['80|20', '80 % en 20 s'], ['80|30', '80 % en 30 s'], ['90|30', '90 % en 30 s'], ['80|60', '80 % en 60 s'], ['90|60', '90 % en 60 s'], ['95|20', '95 % en 20 s']];
const EFF_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
function effAnalysis(qset, weeks, obj){
  const end = FULL.queueCalls.length ? FULL.queueCalls[0][0] : new Date().toISOString();
  const last = localParts(end)[0], oldest = FULL.queueCalls.length ? localParts(FULL.queueCalls[FULL.queueCalls.length - 1][0])[0] : last;
  let first = weeks ? addDaysISO(last, -7 * weeks + 1) : oldest; if(first < oldest) first = oldest; // 18.1.8 : pas de jours sans données
  const nWd = Array(7).fill(0); for(let d = first; d <= last; d = addDaysISO(d, 1)) nWd[simWd(d)]++;
  const G = Array.from({length: 7}, () => Array.from({length: 24}, () => ({n: 0, served: 0, ab: 0, ov: 0, wait: 0, ag: {}, agSet: {}})));
  let talk = 0, served = 0, n = 0;
  FULL.queueCalls.forEach(r => { if(!qset.has(r[1])) return; const [d, h, wd] = localParts(r[0]); if(d < first || d > last) return;
    const c = G[wd][h]; c.n++; n++;
    if(!r[6]){ if(/MaxWait|NoAgents/i.test(r[8] || '')) c.ov++; else c.ab++; }
    if(r[6]){ c.served++; served++; c.wait += r[4]; talk += r[5]; if(r[7]){ c.ag[r[7]] = (c.ag[r[7]] || 0) + 1; (c.agSet[d] ||= new Set()).add(r[7]); } } });
  const aht = Math.max(30, served ? talk / served : 120), T = obj ? +obj.split('|')[1] : objFor(SEG, 'wait') || 30, SL = obj ? +obj.split('|')[0] / 100 : 0.8;
  const CN = effConnected(qset, first, last, nWd);
  G.forEach((row, wd) => row.forEach((c, h) => { const k = nWd[wd] || 1;
    c.cph = c.n / k; c.lost = c.ab; c.lostRate = c.n ? c.ab / c.n : 0; c.ovRate = c.n ? c.ov / c.n : 0; c.agents = Object.values(c.agSet).reduce((a, s) => a + s.size, 0) / k;
    c.need = erlangNeed(c.cph, aht, T, SL); c.avgWait = c.served ? c.wait / c.served : 0; c.conn = CN ? CN[wd][h] : null;
    const miss = c.lostRate + c.ovRate;
    c.st = c.cph < 0.5 ? 'idle' : (c.lostRate >= 0.15 && c.ab >= 2) || (miss >= 0.35 && c.ab + c.ov >= 3) || (c.need - c.agents >= 1) || (c.conn != null && c.need - c.conn >= 1) ? (c.lostRate >= 0.3 || c.need - c.agents >= 2 || (c.conn != null && c.need - c.conn >= 2) ? 'bad' : 'warn') : 'ok'; }));
  return {G, first, last, nWd, aht, T, SL, n, served, hasConn: !!CN};
}
function effSched(A, H){
  return `<div class="tw"><table class="efgrid efsched"><thead><tr><th></th>${H.map(h => `<th>${h} h</th>`).join('')}</tr></thead><tbody>${A.G.map((r, wd) => `<tr><th>${EFF_DAYS[wd]}</th>${H.map(h => { const c = r[h], short = c.conn != null && c.need - c.conn >= 0.5;
    return `<td class="${short ? 'efshort' : ''}" title="${EFF_DAYS[wd]} ${h} h : ${c.need} agent(s) nécessaire(s)${c.conn != null ? ', ' + c.conn.toFixed(1).replace('.', ',') + ' connecté(s) en moyenne' : ''}">${c.need || ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
V.effectif = el => {
  const S = window.__eff ||= {q: '', weeks: 8, obj: ''};
  if(!S.obj) S.obj = '80|' + (objFor(SEG, 'wait') || 30);
  const qs = FULL.queues.filter(q => !SEG || SEGOF[q.number] === SEG), cnt = {}; FULL.queueCalls.forEach(r => cnt[r[1]] = (cnt[r[1]] || 0) + 1);
  qs.sort((a, b) => (cnt[b.number] || 0) - (cnt[a.number] || 0));
  if(!qs.length || !FULL.queueCalls.length){ el.innerHTML = '<h2>Effectif selon l\'achalandage</h2><p class="muted">Aucune file d\'attente avec des appels dans ce backup.</p>'; return; }
  if(S.q !== '*' && !qs.some(q => q.number === S.q)) S.q = qs[0].number;
  const qset = new Set(S.q === '*' ? qs.map(q => q.number) : [S.q]), qo = qs.find(q => q.number === S.q);
  const A = effAnalysis(qset, S.weeks, S.obj), G = A.G, f1 = v => v == null ? '—' : v.toFixed(1).replace('.', ',');
  const hrs = [...Array(24).keys()].filter(h => G.some(r => r[h].n)), h0 = Math.min(...hrs, 8), h1 = Math.max(...hrs, 17), H = [...Array(h1 - h0 + 1).keys()].map(i => h0 + i);
  const slots = G.flatMap((r, wd) => r.map((c, h) => ({...c, wd, h}))).filter(c => c.st === 'bad' || c.st === 'warn').sort((a, b) => b.lost - a.lost || b.need - b.agents - (a.need - a.agents));
  const col = {idle: 'var(--panel2)', ok: 'var(--ok-soft)', warn: 'var(--warn-soft)', bad: 'var(--bad-soft)'};
  // résumé de toutes les files du magasin
  const summary = qs.filter(q => cnt[q.number]).slice(0, 40).map(q => { const X = effAnalysis(new Set([q.number]), S.weeks, S.obj), all = X.G.flat();
    const under = all.filter(c => c.st === 'bad' || c.st === 'warn'), worst = all.map((c, i) => ({...c, wd: Math.floor(i / 24), h: i % 24})).filter(c => c.st !== 'idle' && c.st !== 'ok').sort((a, b) => b.lost - a.lost)[0];
    return {q, n: X.n, served: X.served, aht: X.aht, under: under.length, worst, members: q.members.length, on: q.members.filter(m => !m.status || m.status === 'LoggedIn').length}; }).filter(x => x.n);
  el.innerHTML = `<div id="efwrap"><h2>Effectif selon l'achalandage</h2>
    <p class="lead">Pour chaque créneau (jour × heure) : appels reçus en moyenne, appels abandonnés ou débordés, nombre d'agents qui ont réellement répondu, agents réellement connectés à la file${A.hasConn ? '' : ' (rouvrez le backup pour les voir)'}, et estimation des agents nécessaires pour répondre à ${Math.round(A.SL * 100)} % des appels en moins de ${A.T} s (méthode Erlang C, durée moyenne d'appel ${dur(Math.round(A.aht))}). Du ${A.first} au ${A.last}${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">File</label><select id="efq"><option value="*"${S.q === '*' ? ' selected' : ''}>Toutes les files${SEG ? ' du magasin' : ''} (cumul)</option>${qs.filter(q => cnt[q.number]).map(q => `<option value="${esc(q.number)}"${q.number === S.q ? ' selected' : ''}>${esc(q.number + ' ' + q.name)} (${nf(cnt[q.number])} appels)</option>`).join('')}</select>
      <label class="count">Période</label><select id="efw">${[[4, '4 dernières semaines'], [8, '8 dernières semaines'], [13, '13 dernières semaines'], [0, 'Tout l\'historique']].map(([v, l]) => `<option value="${v}"${S.weeks === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <label class="count">Objectif</label><select id="efo">${(EFF_OBJ.some(([v]) => v === S.obj) ? EFF_OBJ : [[S.obj, S.obj.replace('|', ' % en ') + ' s'], ...EFF_OBJ]).map(([v, l]) => `<option value="${v}"${S.obj === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="grid kpis">${[['Appels en file', nf(A.n), ''], ['Servis', `${nf(A.served)} (${pct(A.served, A.n)})`, A.n && A.served / A.n < 0.8 ? 'warn' : 'ok'], ['Durée moyenne', dur(Math.round(A.aht)), ''], ['Créneaux sous-dotés', nf(slots.length), slots.length ? 'warn' : 'ok'], ...(qo ? [['Membres (connectés)', `${qo.members.length} (${qo.members.filter(m => !m.status || m.status === 'LoggedIn').length})`, '']] : [])]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <h3>Appels par heure et couverture</h3>
    <div class="tw"><table class="efgrid"><thead><tr><th></th>${H.map(h => `<th>${h} h</th>`).join('')}</tr></thead><tbody>${G.map((r, wd) => `<tr><th>${EFF_DAYS[wd]}</th>${H.map(h => { const c = r[h];
      return `<td data-wd="${wd}" data-h="${h}" style="background:${col[c.st]}" title="${EFF_DAYS[wd]} ${h} h : ${c.cph.toFixed(1).replace('.', ',')} appel(s)/h, ${Math.round(100 * c.lostRate)} % abandonnés, ${Math.round(100 * c.ovRate)} % débordés, ${f1(c.agents)} agent(s) actif(s), ${f1(c.conn)} connecté(s), ${c.need} nécessaire(s)">${c.n ? `<b>${c.cph < 10 ? c.cph.toFixed(1).replace('.', ',') : Math.round(c.cph)}</b><span>${A.hasConn ? f1(c.conn) : f1(c.agents)}/${c.need}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="legend"><span><i style="background:${col.ok}"></i>Couvert</span><span><i style="background:${col.warn}"></i>Juste</span><span><i style="background:${col.bad}"></i>Sous-doté</span><span><i style="background:${col.idle}"></i>Calme</span><span>En gras : appels par heure · dessous : agents ${A.hasConn ? 'connectés' : 'actifs'} / nécessaires</span></div>
    <div id="efdet"></div>
    <h3>Créneaux sous-dotés (${slots.length})</h3>
    ${slots.length ? `<div class="tw"><table><thead><tr><th>Créneau</th><th class="num">Appels / h</th><th class="num">Abandonnés</th><th class="num">Débordés</th><th class="num">Attente moy. (servis)</th><th class="num">Agents actifs</th><th class="num">Connectés</th><th class="num">Nécessaires</th><th>Suggestion</th></tr></thead><tbody>
      ${slots.slice(0, 30).map(c => `<tr><td><b>${EFF_DAYS[c.wd]} ${c.h} h – ${c.h + 1} h</b></td><td class="num">${c.cph.toFixed(1).replace('.', ',')}</td><td class="num">${c.ab ? `<span class="pill ${c.lostRate >= 0.15 ? (c.st === 'bad' ? 'bad' : 'warn') : ''}">${Math.round(100 * c.lostRate)} %</span> <span class="muted">(${nf(c.ab)})</span>` : '0'}</td><td class="num">${c.ov ? `${Math.round(100 * c.ovRate)} % <span class="muted">(${nf(c.ov)})</span>` : '0'}</td><td class="num">${dur(Math.round(c.avgWait))}</td>
        <td class="num">${f1(c.agents)}</td><td class="num">${f1(c.conn)}</td><td class="num">${c.need}</td><td style="font-size:12.5px">${c.conn != null && c.need - c.conn >= 0.5 ? `+${Math.ceil(c.need - c.conn)} agent${Math.ceil(c.need - c.conn) > 1 ? 's' : ''} connecté${Math.ceil(c.need - c.conn) > 1 ? 's' : ''} sur ce créneau` : c.need - c.agents >= 0.5 ? `+${Math.ceil(c.need - c.agents)} agent${Math.ceil(c.need - c.agents) > 1 ? 's' : ''} sur ce créneau` : 'Assez d\'agents en théorie, mais ils ne répondent pas à temps : probablement occupés ailleurs (autres files, appels directs) ; prévoir une relève sur ce créneau'}</td></tr>`).join('')}</tbody></table></div>` : '<p><span class="pill ok">Aucun</span> Tous les créneaux actifs sont couverts.</p>'}
    <h3>Horaire recommandé</h3>
    <div class="bar"><span class="count">Agents à prévoir par jour et par heure pour l'objectif ${Math.round(A.SL * 100)} % en ${A.T} s${A.hasConn ? ' — en rouge : moins d\'agents connectés que nécessaire' : ''}</span><span style="flex:1"></span><button class="btn primary" id="efprint">Imprimer l'horaire${S.q === '*' ? ' (toutes les files)' : ''}</button></div>
    ${effSched(A, H)}
    ${summary.length > 1 ? `<h3>Toutes les files${SEG ? ' du magasin' : ''}</h3><div class="tw"><table><thead><tr><th>File</th><th class="num">Appels</th><th class="num">Servis</th><th class="num">Durée moy.</th><th class="num">Membres (connectés)</th><th class="num">Créneaux sous-dotés</th><th>Pire créneau</th></tr></thead><tbody>
      ${summary.sort((a, b) => b.under - a.under || b.n - a.n).map(x => `<tr><td><a class="dlink" href="#" data-efq="${esc(x.q.number)}">${esc(x.q.number + ' ' + x.q.name)}</a></td><td class="num">${nf(x.n)}</td><td class="num">${pct(x.served, x.n)}</td><td class="num">${dur(Math.round(x.aht))}</td><td class="num">${x.members} (${x.on})</td>
        <td class="num">${x.under ? `<span class="pill warn">${x.under}</span>` : 0}</td><td style="font-size:12.5px">${x.worst ? `${EFF_DAYS[x.worst.wd]} ${x.worst.h} h · ${Math.round(100 * x.worst.lostRate)} % abandonnés, ${Math.round(100 * x.worst.ovRate)} % débordés` : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="note">« Agents actifs » : agents différents qui ont répondu à au moins un appel de la file dans ce créneau, en moyenne par semaine ; un agent présent mais sans appel n'est pas compté. « Nécessaires » : estimation Erlang C pour l'objectif d'attente du magasin (onglet Objectifs) et 80 % des appels. « Abandonnés » : le client a raccroché en attente. « Débordés » : délai d'attente maximal atteint ou aucun agent disponible, l'appel part vers la destination suivante de la file (autre file, menu, messagerie). Un créneau est sous-doté si 15 % ou plus des appels sont abandonnés, si 35 % ou plus ne sont pas servis par la file, ou s'il manque au moins un agent.</p></div>`;
  const W = $('#efwrap');
  W.addEventListener('change', e => { if(e.target.id === 'efq'){ S.q = e.target.value; V.effectif(el); } if(e.target.id === 'efw'){ S.weeks = +e.target.value; V.effectif(el); } if(e.target.id === 'efo'){ S.obj = e.target.value; V.effectif(el); } });
  $('#efprint').addEventListener('click', () => {
    const list = S.q === '*' ? qs.filter(q => cnt[q.number]).slice(0, 20) : [qo];
    const secs = list.map(q => { const X = effAnalysis(new Set([q.number]), S.weeks, S.obj); const hh = [...Array(24).keys()].filter(h => X.G.some(r => r[h].n)); if(!hh.length) return '';
      const a = Math.min(...hh), b = Math.max(...hh); return `<section class="rps"><h2>${esc(q.number + ' ' + q.name)}</h2><div class="muted" style="font-size:12px;margin-bottom:4px">${nf(X.n)} appels · durée moyenne ${dur(Math.round(X.aht))} · membres ${q.members.length}</div>${effSched(X, [...Array(b - a + 1).keys()].map(i => a + i))}</section>`; }).join('');
    const p = document.createElement('div'); p.id = 'secprint';
    p.innerHTML = `<div class="report"><header class="rpcover"><div class="rpk">Horaire recommandé · 3CXplore</div><h1>Agents à prévoir${SEG ? ' — ' + esc(segName(SEG)) : ''}</h1><div class="rpmeta">Objectif : ${Math.round(A.SL * 100)} % des appels répondus en moins de ${A.T} s · période du ${esc(A.first)} au ${esc(A.last)} · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>${secs}</div>`;
    document.body.appendChild(p); document.body.classList.add('printing-sec'); window.print(); setTimeout(() => { p.remove(); document.body.classList.remove('printing-sec'); }, 800); });
  W.addEventListener('click', e => {
    const a = e.target.closest('[data-efq]'); if(a){ e.preventDefault(); S.q = a.dataset.efq; V.effectif(el); window.scrollTo(0, 0); return; }
    const td = e.target.closest('td[data-wd]'); if(!td) return; const c = G[+td.dataset.wd][+td.dataset.h], wd = +td.dataset.wd, h = +td.dataset.h;
    const ag = Object.entries(c.ag).sort((x, y) => y[1] - x[1]);
    $('#efdet').innerHTML = `<div class="card" style="margin-top:10px"><b>${EFF_DAYS[wd]} ${h} h – ${h + 1} h</b> · ${A.nWd[wd]} ${EFF_DAYS[wd].toLowerCase()}. dans la période
      ${kv([['Agents connectés (moyenne)', f1(c.conn)], ['Agents nécessaires', String(c.need)], ['Appels reçus', `${nf(c.n)} (${c.cph.toFixed(1).replace('.', ',')} par semaine)`], ['Servis', `${nf(c.served)} (${pct(c.served, c.n)})`], ['Abandonnés (le client raccroche)', nf(c.ab)], ['Débordés (délai max. ou aucun agent)', nf(c.ov)], ['Attente moyenne (servis)', dur(Math.round(c.avgWait))], ['Agents actifs (moyenne)', c.agents.toFixed(1).replace('.', ',')], ['Agents nécessaires (estimation)', String(c.need)]])}
      ${ag.length ? `<div style="font-size:12.5px"><b>Ont répondu :</b> ${ag.slice(0, 12).map(([x, n]) => `${dnLink(x)} <span class="muted">(${n})</span>`).join(', ')}</div>` : ''}</div>`;
  });
};

