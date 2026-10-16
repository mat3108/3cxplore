// ---------- Parcours dans les menus (IVR) ----------
const ANS_ST = new Set(['ans', 'fwd_ok']);
function ivrAnalysis(from, to){
  const all = FULL.calls, ivrSet = new Set(D.ivrs.map(i => i.number)), R = {};
  D.ivrs.forEach(i => {
    const keysOf = {}; i.options.forEach(o => { const k = o.dn || ('ext:' + o.data) || o.type; (keysOf[k] ||= []).push(o.key); });
    R[i.number] = {ivr: i, keysOf, n: 0, hang: 0, hangDur: [], timeout: 0, choices: {}, other: 0};
  });
  const loss = {};
  all.forEach(c => {
    if(c[1] !== 'in') return; const day = localParts(c[0])[0]; if(day < from || day > to) return;
    const p = c[9];
    p.forEach((x, k) => {
      if(x[1] !== 'ivr' || !ivrSet.has(x[0])) return;
      const r = R[x[0]]; r.n++;
      const next = p[k + 1];
      if(!next){ if(c[10] === 'ivr_ab' || c[10] === 'miss'){ r.hang++; r.hangDur.push(c[7]); } else r.other++; return; }
      const dest = next[0], keys = r.keysOf[dest];
      if(keys){ const ch = r.choices[dest] ||= {dest, keys, n: 0, ans: 0, lost: 0, vm: 0}; ch.n++; if(ANS_ST.has(c[10])) ch.ans++; else if(ST_LOST.has(c[10])) ch.lost++; else if(c[10] === 'vm') ch.vm++; }
      else if(dest === r.ivr.timeoutDN){ r.timeout++; const ch = r.choices['__to'] ||= {dest, keys: ['sans choix'], n: 0, ans: 0, lost: 0, vm: 0, timeout: true}; ch.n++; if(ANS_ST.has(c[10])) ch.ans++; else if(ST_LOST.has(c[10])) ch.lost++; }
      else r.other++;
    });
    // point de perte : dernier élément du parcours d'un appel perdu
    if(ST_LOST.has(c[10]) && (!SEG || callSeg(c) === SEG)){ const last = p[p.length - 1]; const k = last ? last[0] : '(avant tout élément)'; const L = loss[k] ||= {dn: k, type: last ? last[1] : '', n: 0, cause: {}}; L.n++; L.cause[c[10]] = (L.cause[c[10]] || 0) + 1; }
  });
  return {ivrs: Object.values(R).filter(r => r.n).sort((a, b) => b.n - a.n), loss: Object.values(loss).sort((a, b) => b.n - a.n)};
}
const median = a => { if(!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

V.menus = el => {
  const all = FULL.calls;
  if(!all.length){ el.innerHTML = '<h2>Parcours dans les menus</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const lastDay = localParts(all[0][0])[0], firstDay = localParts(all[all.length - 1][0])[0];
  const P = statsPeriod();
  const range = () => P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDaysISO(lastDay, -(+P.mode) + 1), lastDay];
  el.innerHTML = `<div id="mnwrap"><h2>Parcours dans les menus (IVR)</h2>
    <p class="lead">Pour chaque standard automatique : combien d'appels y entrent, quelles touches les appelants choisissent, combien raccrochent sans choisir ou laissent passer le délai, et ce que devient l'appel après chaque choix. En bas, les endroits du parcours où l'on perd le plus d'appels.</p>
    <div class="bar"><label class="count">Période</label>
      <select id="mnpm">${[['7','7 derniers jours'],['30','30 derniers jours'],['90','90 derniers jours'],['all','Tout l\'historique'],['custom','Dates au choix']].map(([v,l]) => `<option value="${v}"${P.mode===v?' selected':''}>${l}</option>`).join('')}</select>
      <span class="count" id="mnrange"></span></div><div id="mnbody"></div></div>`;
  let res = null;
  function draw(){
    const [from, to] = range(); $('#mnrange').textContent = `du ${from} au ${to}`;
    res = ivrAnalysis(from, to);
    const tot = res.ivrs.reduce((a, r) => ({n: a.n + r.n, hang: a.hang + r.hang, to: a.to + r.timeout}), {n: 0, hang: 0, to: 0});
    const top = r => Object.values(r.choices).filter(c => !c.timeout).sort((a, b) => b.n - a.n)[0];
    $('#mnbody').innerHTML = `
      <div class="grid kpis">${[['Menus utilisés', res.ivrs.length], ['Passages dans un menu', nf(tot.n)], ['Raccrochés dans un menu', `${nf(tot.hang)} (${pct(tot.hang, tot.n)})`], ['Sans choix (délai écoulé)', `${nf(tot.to)} (${pct(tot.to, tot.n)})`]]
        .map(([l, v]) => `<div class="card kpi"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
      <h3>Par menu</h3>
      <div class="tw"><table><thead><tr><th>Menu</th><th class="num">Passages</th><th class="num">Raccrochés</th><th class="num">Durée avant raccrochage</th><th class="num">Sans choix</th><th>Choix le plus fréquent</th><th>Message</th></tr></thead><tbody>
      ${res.ivrs.map((r, i) => { const t = top(r), hr = r.n ? r.hang / r.n : 0; return `<tr class="click" data-i="${i}"><td>${dnLink(r.ivr.number)}<div class="muted" style="font-size:11.5px">${esc(segShort(SEGOF[r.ivr.number]))}</div></td>
        <td class="num">${nf(r.n)}</td><td class="num"><span class="pill ${hr > 0.25 ? 'bad' : hr > 0.12 ? 'warn' : 'ok'}">${pct(r.hang, r.n)}</span> <span class="muted">${nf(r.hang)}</span></td>
        <td class="num">${median(r.hangDur) == null ? '–' : dur(median(r.hangDur))}</td><td class="num">${r.timeout ? `${pct(r.timeout, r.n)} <span class="muted">${nf(r.timeout)}</span>` : '–'}</td>
        <td>${t ? `<span class="pill">Touche ${esc(t.keys.join(' / '))}</span> ${esc(dnName(t.dest) || t.dest)} <span class="muted">${pct(t.n, r.n)}</span>` : '–'}</td>
        <td class="muted" style="font-size:12px">${esc(r.ivr.prompt || '—')}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">« Raccrochés » : l'appel s'est terminé dans le menu, sans choix. « Durée avant raccrochage » : durée médiane de ces appels — si elle est proche de la longueur du message, les appelants raccrochent pendant le message. Une touche invalide n'est pas visible dans le backup (3CX rejoue le message), sauf si une destination « touche invalide » est configurée. Cliquez sur un menu pour le détail.</p>
      <h3>Où perd-on le plus d'appels ?</h3>
      <div class="tw"><table><thead><tr><th>Dernier élément du parcours</th><th>Type</th><th class="num">Appels perdus</th><th>Causes</th></tr></thead><tbody>
      ${res.loss.slice(0, 15).map(L => `<tr><td>${DN[L.dn] ? dnLink(L.dn) : `<span class="mono">${esc(L.dn)}</span>`}</td><td class="muted">${esc({ivr: 'Menu', queue: 'File', group: 'Département', extension: 'Poste', ring_group_ring_all: 'Groupe de sonnerie', ring_group_hunt: 'Groupe de sonnerie'}[L.type] || L.type)}</td>
        <td class="num">${nf(L.n)}</td><td style="font-size:12px">${Object.entries(L.cause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="pill">${esc(LOST_WHERE[k] || k)} ${nf(v)}</span>`).join('')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucun appel perdu.</td></tr>'}</tbody></table></div>`;
    $('#mnbody').querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', e => { if(!e.target.closest('a')) showMenu(res.ivrs[+tr.dataset.i], from, to); }));
  }
  function showMenu(r, from, to){
    const rows = Object.values(r.choices).sort((a, b) => b.n - a.n), mx = Math.max(1, r.n);
    const bar = (label, n, ans, lost, extra) => `<div class="mnrow"><div class="mnl">${label}</div><div class="mnb"><span style="width:${100 * n / mx}%"></span></div><div class="mnn">${nf(n)} <span class="muted">${pct(n, r.n)}</span></div>
      <div class="mno">${ans != null ? `<span class="pill ok">répondus ${pct(ans, n)}</span><span class="pill bad">perdus ${pct(lost, n)}</span>` : ''}${extra || ''}</div></div>`;
    const unused = r.ivr.options.filter(o => !rows.some(c => c.keys.includes(o.key)));
    openDrawer(`Menu ${esc(r.ivr.number)} ${esc(r.ivr.name)}`, `
      <p class="muted" style="font-size:12.5px">Du ${from} au ${to} · ${nf(r.n)} passages · message : ${esc(r.ivr.prompt || '—')}</p>
      ${r.ivr.prompt && promptPath(r.ivr.prompt) ? audio(promptPath(r.ivr.prompt)) : ''}
      <h3>Ce que font les appelants</h3>
      ${rows.map(c => bar(c.timeout ? 'Sans choix (délai)' : `Touche ${esc(c.keys.join(' / '))} → ${esc(dnName(c.dest) || c.dest)}`, c.n, c.ans, c.lost)).join('')}
      ${bar('Raccroché dans le menu', r.hang, null, null, median(r.hangDur) != null ? `<span class="muted" style="font-size:12px">après ${dur(median(r.hangDur))} (médiane)</span>` : '')}
      ${r.other ? bar('Autre (transfert, parcours non reconnu)', r.other, null, null) : ''}
      ${unused.length ? `<h3>Touches jamais utilisées sur la période</h3><p>${unused.map(o => `<span class="pill">Touche ${esc(o.key)} → ${esc(dnName(o.dn) || o.dn)}</span>`).join('')}</p>` : ''}
      <p class="note">Quand plusieurs touches mènent à la même destination, elles ne peuvent pas être distinguées (« Touche 0 / 1 »). « Répondus / perdus » : devenir de l'appel après le choix.</p>`);
  }
  $('#mnpm').addEventListener('change', e => { P.mode = e.target.value; try{ localStorage.setItem(STATS_KEY, JSON.stringify(P)); }catch(er){} draw(); });
  draw();
};

