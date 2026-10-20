// ---------- Fiche magasin d'une page (onglet) ----------
V.fichemag = el => {
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  const S = window.__fm ||= {seg: '', per: '30'};
  if(SEG && SEG[0] !== '@') S.seg = SEG;
  if(!stores.includes(S.seg)) S.seg = stores[0] || '';
  const s = S.seg, all = FULL.calls;
  if(!s){ el.innerHTML = '<h2>Fiche magasin</h2><p class="muted">Aucun magasin.</p>'; return; }
  const lastDay = all.length ? localParts(all[0][0])[0] : new Date().toISOString().slice(0, 10), firstDay = all.length ? callHist().first : lastDay;
  const [from, to] = perRange(S.per, firstDay, lastDay), inP = c => { const d = localParts(c[0])[0]; return d >= from && d <= to; };
  // appels entrants du magasin
  const inc = all.filter(c => c[1] === 'in' && c[10] !== 'bridge' && callSeg(c) === s && inP(c));
  const ans = inc.filter(c => ST_ANS.has(c[10])).length, vm = inc.filter(c => c[10] === 'vm').length, lost = inc.filter(c => ST_LOST.has(c[10])).length;
  const hrs = Array(24).fill(0); inc.forEach(c => hrs[localParts(c[0])[1]]++); const peak = hrs.indexOf(Math.max(...hrs));
  const lostBy = {}; inc.filter(c => ST_LOST.has(c[10])).forEach(c => lostBy[c[10]] = (lostBy[c[10]] || 0) + 1);
  const miss = missedAnalysis(from, to).filter(r => r.seg === s), todo = miss.filter(r => r.st === 'todo').length;
  const pc = (a, b) => b ? Math.round(100 * a / b) + ' %' : '—';
  // SDA du magasin
  const dCalls = {}; inc.forEach(c => { if(c[5]) dCalls[c[5]] = (dCalls[c[5]] || 0) + 1; });
  const dids = []; FULL.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(d => { if(DIDSEG[d] === s){ const r = by[d] || def; dids.push({d, l, r, own: !!by[d]}); } }); });
  dids.sort((a, b) => (dCalls[b.d] || 0) - (dCalls[a.d] || 0));
  const dst = x => !x || !x.to ? '<span class="muted">—</span>' : x.dn ? `${esc(TO_FR[x.to] || x.to)} ${dnLink(x.dn)}` : x.to === 'External' ? `${esc(TO_FR[x.to])} <span class="mono">${esc(phone(x.ext))}</span>` : esc(TO_FR[x.to] || x.to);
  // départements, files, postes, parkings
  const gs = FULL.groups.filter(g => !isSysGroup(g) && SEGOF[g.number] === s), qs = FULL.queues.filter(q => SEGOF[q.number] === s).sort((a, b) => a.number.localeCompare(b.number, undefined, {numeric: true}));
  const exts = FULL.extensions.filter(e => SEGOF[e.number] === s), phones = {}; exts.forEach(e => e.devices.forEach(d => { const m = d.model || d.template || '?'; phones[m] = (phones[m] || 0) + 1; }));
  const pk = (FULL.parkCalls || []).filter(r => r[3] !== 'direct' && SEGOF[r[4]] === s && localParts(r[0])[0] >= from && localParts(r[0])[0] <= to);
  const hoursTxt = h => h && h.days.length ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => { const x = h.days.find(y => y.day === d); return `<span class="pill">${DAYS_FR[d].slice(0, 3)} ${x && x.p.length ? x.p.map(p => p.join('–')).join(', ') : 'fermé'}</span>`; }).join(' ') : '<span class="muted">24 h/24 ou non défini</span>';
  // problèmes à corriger
  let traps = []; try{ traps = trapAnalysis().filter(t => (SEGOF[t.el] || SEG_COMMON) === s && t.sev !== 'info'); }catch(e){}
  let blf = []; try{ if(FULL.extensions.some(e => e.blfs)) blf = blfAnalysis().issues.filter(i => SEGOF[i.e.number] === s && (i.k === 'gone' || i.k === 'dup')); }catch(e){}
  let rx = []; try{ rx = rxAnalysis().rows.filter(r => r.seg === s && (r.flags.includes('inactive') || r.flags.includes('other'))); }catch(e){}
  const probs = [...traps.map(t => [t.sev, `${t.title} — ${t.el} ${dnName(t.el)}`]), ...blf.map(i => ['warn', `Touche : ${i.t} (${i.e.number})`]), ...rx.map(r => ['warn', `Renvoi externe de ${r.e.number} ${dnName(r.e.number)} : ${r.flags.map(k => RX_FLAG[k][0]).join(', ')}`])];
  if(todo) probs.unshift(['bad', `${todo} client${todo > 1 ? 's' : ''} sans réponse non rappelé${todo > 1 ? 's' : ''} sur la période`]);
  const kpi = (l, v, c) => `<div class="card kpi ${c || ''}"><div class="v" style="font-size:20px">${v}</div><div class="l">${esc(l)}</div></div>`;
  el.innerHTML = `<div id="fmwrap"><div class="noprint"><h2>Fiche magasin</h2>
    <p class="lead">Le résumé d'un magasin sur une page, à imprimer pour une rencontre : numéros (SDA) et où ils mènent, horaires, files et agents, parkings, taux de réponse et appels perdus, problèmes à corriger.</p>
    <div class="bar">${SEG ? '' : `<label class="count">Magasin</label><select id="fmseg">${stores.map(x => `<option value="${esc(x)}"${x === s ? ' selected' : ''}>${esc(segName(x))}</option>`).join('')}</select>`}
      <label class="count">Période</label>${perUI('fmper', S.per, firstDay, lastDay)}
      <span style="flex:1"></span><button class="btn primary" id="fmprint">Imprimer / PDF</button></div></div>
    <div class="report" id="fmsheet"><header class="rpcover"><div class="rpk">Fiche magasin · 3CXplore</div><h1>${esc(segName(s))}</h1>
      <div class="rpmeta">Du ${esc(from)} au ${esc(to)} · ${nf(exts.length)} postes · ${nf(gs.length)} département${gs.length > 1 ? 's' : ''} · ${nf(qs.length)} file${qs.length > 1 ? 's' : ''} · ${nf(dids.length)} SDA · préparé le ${esc(new Date().toLocaleDateString('fr-CA'))}</div></header>
      <section class="rps"><h2>Appels entrants</h2><div class="grid kpis">${kpi('Appels entrants', nf(inc.length))}${kpi('Répondus', pc(ans, inc.length), 'ok')}${kpi('Messagerie', pc(vm, inc.length))}${kpi('Perdus', pc(lost, inc.length), lost / (inc.length || 1) > .15 ? 'bad' : '')}${kpi('Clients non rappelés', nf(todo), todo ? 'bad' : '')}${kpi('Heure de pointe', inc.length ? peak + ' h' : '—')}</div>
        ${lost ? `<p class="muted" style="font-size:12.5px;margin:6px 0 0">Appels perdus : ${Object.entries(lostBy).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${esc(LOST_WHERE[k] || k)} ${nf(n)}`).join(' · ')}</p>` : ''}</section>
      <section class="rps"><h2>Numéros entrants (SDA)</h2>${dids.length ? `<div class="tw"><table><thead><tr><th>SDA</th><th class="num">Appels</th><th>Heures d'ouverture</th><th>Hors heures</th></tr></thead><tbody>${dids.map(x => `<tr><td class="mono">${esc(phone(x.d))}${x.own ? '' : ' <span class="muted" style="font-size:11px">(règle par défaut)</span>'}</td><td class="num">${nf(dCalls[x.d] || 0)}</td><td>${dst(x.r && x.r.office)}</td><td>${x.r && x.r.outOfOffice && x.r.outOfOffice.to && (x.r.outOfOffice.to !== x.r.office?.to || x.r.outOfOffice.dn !== x.r.office?.dn) ? dst(x.r.outOfOffice) : '<span class="muted">idem (les horaires du département s\'appliquent)</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun SDA rattaché à ce magasin.</p>'}</section>
      <section class="rps"><h2>Horaires des départements</h2>${gs.map(g => `<div style="margin:4px 0"><b>${esc(g.name)}</b> <span class="muted mono">${esc(g.number)}</span> <a class="noprint" style="font-size:12px" href="#deptrap/${esc(g.number)}~${esc(S.per)}">Rapport du département</a><div style="margin-top:2px">${hoursTxt(g.hours)}</div>${g.breakTime && g.breakTime.days && g.breakTime.days.length ? `<div class="muted" style="font-size:12px">Pause : ${g.breakTime.days.map(d => DAYS_FR[d.day].slice(0, 3) + ' ' + d.p.map(p => p.join('–')).join(', ')).join(' · ')}</div>` : ''}</div>`).join('') || '<p class="muted">Aucun département.</p>'}</section>
      <section class="rps"><h2>Files d'attente</h2>${qs.length ? `<div class="tw"><table><thead><tr><th>File</th><th>Stratégie</th><th class="num">Agents</th><th class="num">Connectés</th><th class="num">Appels (historique)</th><th class="num">Servis</th></tr></thead><tbody>${qs.map(q => { const st = FULL.queueStats[q.number] || {total: 0, served: 0}; const on = q.members.filter(m => !m.status || m.status === 'LoggedIn').length;
        return `<tr><td>${dnLink(q.number)}</td><td>${esc(q.strategy)}</td><td class="num">${q.members.length || '<span class="pill bad">0</span>'}</td><td class="num">${q.members.length && !on ? '<span class="pill warn">0</span>' : on}</td><td class="num">${nf(st.total)}</td><td class="num">${pc(st.served, st.total)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Aucune file.</p>'}</section>
      <section class="rps"><h2>Parkings et postes</h2><div class="grid kpis">${kpi('Mises en parking', FULL.parkCalls ? nf(pk.length) : '—')}${kpi('Reprises', FULL.parkCalls ? pc(pk.filter(r => r[3] === 'pickup').length, pk.length) : '—')}${kpi('Raccrochés en parking', FULL.parkCalls ? pc(pk.filter(r => r[3] === 'hangup').length, pk.length) : '—', pk.length && pk.filter(r => r[3] === 'hangup').length / pk.length > .15 ? 'bad' : '')}${kpi('Postes', nf(exts.length))}</div>
        <p class="muted" style="font-size:12.5px;margin:6px 0 0">Téléphones : ${Object.entries(phones).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${esc(m)} × ${n}`).join(' · ') || 'aucun'}</p></section>
      <section class="rps"><h2>À corriger (${probs.length})</h2>${probs.length ? `<ul class="nvck">${probs.slice(0, 25).map(([sev, t]) => `<li><label><input type="checkbox"> <span><span class="pill ${sev === 'bad' ? 'bad' : 'warn'}">${sev === 'bad' ? 'Important' : 'À vérifier'}</span> ${esc(t)}</span></label></li>`).join('')}</ul>${probs.length > 25 ? `<p class="muted">… et ${probs.length - 25} autre(s) : voir les onglets Pièges d'acheminement, Touches BLF et Renvois externes.</p>` : ''}` : '<p class="muted">Aucun problème détecté.</p>'}</section>
    </div></div>`;
  if($('#fmseg')) $('#fmseg').addEventListener('change', e => { S.seg = e.target.value; V.fichemag(el); });
  perWire('fmper', S.per, firstDay, lastDay, v => { S.per = v; V.fichemag(el); });
  $('#fmprint').addEventListener('click', () => { printHTML($('#fmsheet').outerHTML.replace('id="fmsheet"', '')); });
};

