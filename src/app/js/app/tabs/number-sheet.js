// ---------- Fiche numéro (18.3) : tout ce que le backup sait d'un numéro — SDA du système, client, poste ou numéro d'un employé ----------
const NUM_KEY = 'numero3cx';
// ce qu'est le numéro : élément du système (poste, file…), SDA, cellulaire ou numéro présenté d'un employé
function numInfo(raw){
  const s = String(raw || '').trim(), digits = s.replace(/\D/g, ''), n = normNum(s);
  const dn = DN[s] ? s : digits && DN[digits] ? digits : '';
  const dids = []; FULL.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(d => { if((n && normNum(d) === n) || (digits && d.replace(/\D/g, '') === digits)) dids.push({did: d, line: l, rule: by[d] || def, isDefault: !by[d] && !!def}); }); });
  return {s, n, dn, dids, mobiles: n ? FULL.extensions.filter(e => normNum(e.mobile) === n) : [], cids: n ? FULL.extensions.filter(e => normNum(e.callerId) === n) : []};
}
V.numero = (el, arg) => {
  const S = window.__num ||= (() => { try{ return JSON.parse(localStorage.getItem(NUM_KEY) || '{}'); }catch(e){ return {}; } })();
  if(arg) S.q = decodeURIComponent(arg);
  const all = FULL.calls, first = all.length ? callHist().first : '', last = all.length ? localParts(all[0][0])[0] : '';
  S.p ||= 'all'; const [from, to] = all.length ? perRange(S.p, first, last) : ['', ''];
  const save = () => { try{ localStorage.setItem(NUM_KEY, JSON.stringify({q: S.q || '', p: S.p})); }catch(e){} V.numero(el); };
  const inP = c => { const d = localParts(c[0])[0]; return d >= from && d <= to; };
  const pc = (a, b) => b ? Math.round(100 * a / b) + ' %' : '–', med = a => { if(!a.length) return null; const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
  const kpi = (l, v, c) => `<div class="card kpi${c ? ' ' + c : ''}"><div class="v" style="font-size:20px">${v}</div><div class="l">${esc(l)}</div></div>`;
  const nm = e => ((e.first || '') + ' ' + (e.last || '')).trim() || e.number;
  const head = `<h2>Fiche numéro</h2>
    <p class="lead">Tout ce que le backup sait d'un numéro, sur une page : un numéro entrant (SDA) du système, un client, un poste ou le cellulaire d'un employé. Saisissez le numéro dans n'importe quel format.</p>
    <div class="bar"><input type="search" id="numq" placeholder="Numéro, ex. (555) 123-4567 ou un poste" value="${esc(S.q || '')}" autocomplete="off"><button class="btn primary" id="numgo">Afficher</button>
      <label class="count">Période</label>${all.length ? perUI('nump', S.p, first, last) : ''}</div>`;
  const wire = () => { const go = () => { S.q = $('#numq').value.trim(); save(); }; $('#numgo').addEventListener('click', go); $('#numq').addEventListener('keydown', e => { if(e.key === 'Enter') go(); });
    if(all.length) perWire('nump', S.p, first, last, v => { S.p = v; save(); }); };
  if(!S.q){ el.innerHTML = head; wire(); return; }
  const I = numInfo(S.q), secs = [];
  // ---- élément du système (poste, file, menu…) ----
  if(I.dn){ const d = DN[I.dn], E = EXT_BY[I.dn];
    secs.push(`<h3>${esc(d.kind)} du système</h3><div class="card">${dnLink(I.dn)} — <b>${esc(d.name || '')}</b> <span class="muted">${esc(segName(SEGOF[I.dn] || SEG_COMMON))}</span>
      <p style="margin:8px 0 0"><a href="#" data-dn="${esc(I.dn)}" class="dn btn">Fiche complète</a>${E ? ` <a class="btn" href="#employe/${esc(I.dn)}">Fiche employé</a> <a class="btn" href="#historique/${esc(I.dn)}">Historique du poste</a>` : ''}</p></div>`); }
  // ---- numéro d'un employé ----
  if(I.mobiles.length || I.cids.length) secs.push(`<h3>Numéro d'un employé</h3><div class="card">${I.mobiles.map(e => `<div>Cellulaire de ${dnLink(e.number)} — ${esc(nm(e))} <a href="#employe/${esc(e.number)}">Fiche employé</a></div>`).join('')}
    ${I.cids.length ? `<div>Numéro présenté par ${nf(I.cids.length)} poste${I.cids.length > 1 ? 's' : ''} : ${I.cids.slice(0, 20).map(e => dnLink(e.number)).join(', ')}${I.cids.length > 20 ? ' …' : ''}</div>` : ''}</div>`);
  // ---- SDA du système ----
  I.dids.forEach(r => {
    const ru = r.rule, k = normNum(r.did), C = all.filter(c => c[1] === 'in' && (normNum(c[5]) === k || c[5] === r.did) && inP(c));
    const ans = C.filter(c => ST_ANS.has(c[10])).length, vm = C.filter(c => c[10] === 'vm').length, lost = C.filter(c => ST_LOST.has(c[10])).length, br = C.filter(c => c[10] === 'bridge').length;
    const base = C.length - br, cli = new Set(C.map(c => normNum(c[2])).filter(Boolean)).size, wait = med(C.filter(c => ST_ANS.has(c[10]) && c[12] != null).map(c => c[12]));
    const hrs = Array(24).fill(0); C.forEach(c => hrs[localParts(c[0])[1]]++); const peak = C.length ? hrs.indexOf(Math.max(...hrs)) : null;
    const months = {}; C.forEach(c => { const m = localParts(c[0])[0].slice(0, 7), x = months[m] ||= {n: 0, l: 0}; x.n++; if(ST_LOST.has(c[10])) x.l++; });
    const who = {}; C.forEach(c => (Array.isArray(c[11]) ? c[11] : []).forEach(([x]) => { if(EXT_BY[x]) who[x] = (who[x] || 0) + 1; }));
    let miss = []; try{ miss = missedAnalysis(from, to).filter(m => m.st === 'todo' && m.lost.some(i => normNum(all[i][5]) === k)); }catch(e){}
    const dest = [['Heures d\'ouverture', ru && ru.office], ...(ru && ru.altOOO ? [['Hors heures', ru.outOfOffice]] : []), ...(ru && ru.altHol ? [['Jours fériés', ru.holidays]] : [])];
    secs.push(`<h3>Numéro entrant (SDA) du système</h3><div class="card">${kv([['Numéro', `<b class="mono">${esc(phone(r.did) || r.did)}</b>`], ['Magasin', esc(segName(DIDSEG[r.did] || SEG_COMMON))], ['Trunk', `${dnLink(r.line.number)} <span class="muted">${esc(r.line.gateway || '')}</span>`],
        ['Règle entrante', esc(ruleLabel(r))], ...dest.map(([l, d]) => [l, d ? destHTML(d) : '<span class="muted">—</span>'])])}
      <p style="margin:8px 0 0"><a class="btn" href="#diagramme/${esc(r.did)}">Diagramme du parcours</a> <a class="btn" href="#simulateur/${esc(r.did)}">Simuler un appel</a></p></div>
      <div class="grid kpis">${kpi('Appels reçus', nf(C.length))}${kpi('Répondus', pc(ans, base))}${kpi('Messagerie', nf(vm))}${kpi('Perdus', `${nf(lost)} (${pc(lost, base)})`, lost && lost / (base || 1) > .2 ? 'bad' : '')}${kpi('Appelants différents', nf(cli))}${kpi('Délai avant réponse (médiane)', wait != null ? dur(wait) : '–')}${kpi('Heure de pointe', peak != null ? peak + ' h' : '–')}${kpi('Transférés vers un autre 3CX', nf(br))}</div>
      <p class="muted" style="font-size:12px">Du ${esc(from)} au ${esc(to)}. Répondus et perdus : sur les appels reçus hors transferts vers un autre 3CX, comme dans les Statistiques.</p>
      ${Object.keys(months).length > 1 ? `<div class="tw"><table><thead><tr><th>Mois</th><th class="num">Appels</th><th class="num">Perdus</th></tr></thead><tbody>${Object.entries(months).sort().map(([m, x]) => `<tr><td>${esc(m)}</td><td class="num">${nf(x.n)}</td><td class="num">${nf(x.l)} (${pc(x.l, x.n)})</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${Object.keys(who).length ? `<h3>Qui répond</h3><div>${Object.entries(who).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([x, v]) => `<span class="pill">${dnLink(x)} · ${nf(v)}</span>`).join(' ')}</div>` : ''}
      ${miss.length ? `<h3>Clients à rappeler sur ce numéro (${nf(miss.length)})</h3><div class="tw"><table><thead><tr><th>Client</th><th>Dernier appel perdu</th><th class="num">Tentatives</th></tr></thead><tbody>${miss.sort((a, b) => a.last < b.last ? 1 : -1).slice(0, 25).map(m => `<tr><td><a href="#numero/${esc(m.num)}" class="mono">${esc(phone(m.num))}</a>${m.name ? ` <span class="muted">${esc(m.name)}</span>` : ''}</td><td>${esc(fmtD(m.last))}</td><td class="num">${nf(m.n)}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
  });
  // ---- client (numéro externe) ----
  if(I.n && !I.dids.length){
    const H = clientHistory(I.n), C = H.calls.filter(inP), inc = C.filter(c => c[1] === 'in'), out = C.filter(c => c[1] === 'out');
    if(C.length || H.contacts.length || H.vms.length){
      const ans = inc.filter(c => ST_ANS.has(c[10])).length, lost = inc.filter(c => ST_LOST.has(c[10])).length, vm = inc.filter(c => c[10] === 'vm').length, outOk = out.filter(c => c[10] === 'ans' && c[8] > 0).length;
      const br = inc.filter(c => c[10] === 'bridge').length, base = inc.length - br; // comme les Statistiques : hors transferts vers un autre 3CX
      const segs = {}; C.forEach(c => { const s = callSeg(c); segs[s] = (segs[s] || 0) + 1; });
      let vip = null; try{ vip = vipNums(vipLoad())[I.n] || null; }catch(e){}
      let miss = []; try{ miss = missedAnalysis(first, last).filter(m => m.num === I.n); }catch(e){}
      const talk = C.reduce((a, c) => a + (c[8] || 0), 0), dates = C.map(c => c[0]).sort();
      secs.push(`<h3>Client</h3><div class="card">${kv([['Numéro', `<b class="mono">${esc(phone(I.n))}</b>${vipStar(I.n)}`], ['Nom', H.contacts.map(p => esc([(p.first + ' ' + p.last).trim(), p.company].filter(Boolean).join(' — ')) + ' <span class="pill">annuaire</span>').join('<br>') || esc(H.names.slice(0, 3).join(' · ')) || '<span class="muted">inconnu</span>'],
          ['Numéro important', vip ? `${esc(vip.name || '')} <span class="pill">${esc(VIP_CATS[vip.cat] || vip.cat)}</span>${vip.seg ? ' · ' + esc(segShort(vip.seg)) : ''}` : 'non'],
          ['Magasins contactés', Object.entries(segs).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<span class="pill">${esc(segShort(s))} · ${nf(v)}</span>`).join('') || '–'],
          ['Premier / dernier échange', dates.length ? `${esc(fmtD(dates[0]))} → ${esc(fmtD(dates[dates.length - 1]))}` : '–']])}
        <p style="margin:8px 0 0"><a class="btn" href="#client/${esc(I.n)}">Historique complet du client</a></p></div>
        <div class="grid kpis">${kpi('Appels du client', nf(inc.length))}${kpi('Répondus', pc(ans, base))}${kpi('Perdus', `${nf(lost)} (${pc(lost, base)})`, lost ? 'bad' : '')}${kpi('Messages laissés', nf(vm))}${kpi('Appels vers le client', nf(out.length))}${kpi('Aboutis', nf(outOk))}${kpi('Temps de conversation', dur(talk))}${kpi('Transférés vers un autre 3CX', nf(br))}</div>
        <p class="muted" style="font-size:12px">Du ${esc(from)} au ${esc(to)}, tous magasins. Répondus et perdus : sur les appels du client hors transferts vers un autre 3CX, comme dans les Statistiques.</p>
        ${miss.length ? `<h3>Appels manqués</h3><div class="tw"><table><thead><tr><th>Magasin</th><th>Dernier appel perdu</th><th class="num">Tentatives</th><th>Statut</th><th>Rappelé le</th></tr></thead><tbody>${miss.map(m => `<tr><td>${esc(segShort(m.seg))}</td><td>${esc(fmtD(m.last))}</td><td class="num">${nf(m.n)}</td><td><span class="pill ${RAP_ST[m.st].c}">${esc(RAP_ST[m.st].l)}</span></td><td>${m.when ? esc(fmtD(m.when)) : '–'}</td></tr>`).join('')}</tbody></table></div><p class="muted" style="font-size:12px">Sur tout l'historique : un appel manqué est réglé par un rappel abouti ou un appel servi du même magasin.</p>` : ''}`);
    }
  }
  if(!secs.length) secs.push(`<div class="card"><span class="pill">Inconnu</span> Ce numéro n'apparaît nulle part dans le backup (ni SDA, ni poste, ni employé, ni appel${S.p !== 'all' ? ' sur la période' : ''}).</div>`);
  el.innerHTML = `<div id="numwrap">${head}${secs.join('')}</div>`;
  wire();
};
