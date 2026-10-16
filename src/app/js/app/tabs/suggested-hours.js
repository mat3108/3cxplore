// ---------- Ajustements d'horaires suggérés (15.18) : une ligne par département et par changement, jours identiques regroupés ----------
const ADJ_SLOT = 2, ADJ_DAY = 3; // appels par semaine : par demi-heure avant l'ouverture ou après la fermeture ; pendant la pause ou un jour fermé
function hoursAdjust(R){
  const w = R.weeks, G = {}, add4 = (a, b) => a.forEach((x, i) => { x.n += b[i].n; x.l += b[i].l; }), z4 = () => Array.from({length: 4}, () => ({n: 0, l: 0}));
  // jours qui ouvrent (ou ferment) à la même heure : la demande est additionnée avant d'appliquer le seuil
  for(let wd = 0; wd < 7; wd++){ const ps = R.sch.per(wd);
    if(ps.length){ const bm = toMin(ps[0][0]), em = toMin(ps[ps.length - 1][1]);
      add4((G['open|' + bm] ||= {type: 'open', cur: bm, wds: [], s: z4()}).s, R.pre[wd]); G['open|' + bm].wds.push(wd);
      add4((G['close|' + em] ||= {type: 'close', cur: em, wds: [], s: z4()}).s, R.post[wd]); G['close|' + em].wds.push(wd); }
    else if(R.off[wd].n){ const g = G.day ||= {type: 'day', wds: [], n: 0, l: 0}; g.wds.push(wd); g.n += R.off[wd].n; g.l += R.off[wd].l; }
    if(R.brk[wd].n){ const g = G.break ||= {type: 'break', wds: [], n: 0, l: 0}; g.wds.push(wd); g.n += R.brk[wd].n; g.l += R.brk[wd].l; } }
  const out = [];
  Object.values(G).forEach(g => {
    if(g.s){ let k = -1; while(k + 1 < 4 && g.s[k + 1].n / w >= ADJ_SLOT) k++; if(k < 0) return; const xs = g.s.slice(0, k + 1);
      out.push({...g, to: g.type === 'open' ? g.cur - 30 * (k + 1) : g.cur + 30 * (k + 1), n: xs.reduce((a, x) => a + x.n, 0), l: xs.reduce((a, x) => a + x.l, 0)}); }
    else if(g.n / w >= ADJ_DAY && (g.type === 'day' || g.l / g.n >= 0.25)) out.push(g); });
  return out.map(x => ({...x, g: R.g, R, perW: x.n / w}));
}
const adjDays = wds => wds.length > 2 && wds.every((d, i) => !i || d === wds[i - 1] + 1) ? `${WD[wds[0]]}–${WD[wds[wds.length - 1]]}` : wds.map(d => WD[d]).join(', ');
const adjTxt = x => x.type === 'open' ? `Ouvrir à ${fmtMin(x.to)} au lieu de ${fmtMin(x.cur)}` : x.type === 'close' ? `Fermer à ${fmtMin(x.to)} au lieu de ${fmtMin(x.cur)}` : x.type === 'day' ? 'Ouvrir ce jour-là, ou y mettre un message adapté' : 'Revoir la pause (décaler, raccourcir ou faire couvrir)';


V.horaires = el => {
  const all = FULL.calls;
  if(!all.length){ el.innerHTML = '<h2>Contrôle des horaires</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const m0 = localParts(all[0][0]), m1 = localParts(all[all.length - 1][0]), lastDay = m0[0], firstDay = m1[0];
  const P = statsPeriod();
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const range = () => P.mode === 'all' ? [firstDay, lastDay] : P.mode === 'custom' ? [P.from || firstDay, P.to || lastDay] : [addDays(lastDay, -(+P.mode) + 1), lastDay];
  el.innerHTML = `<div id="hwrap"><h2>Contrôle des horaires</h2>
  <p class="lead">Pour chaque département, la branche réellement prise par les appels entrants (menu ouvert, fermé, pause) est comparée aux horaires configurés à l'heure de l'appel. On repère ainsi les appels tombés au menu fermé pendant les heures d'ouverture (et l'inverse), la demande juste avant l'ouverture ou après la fermeture, et les jours fériés à venir non configurés.</p>
  ${HAS_HOURS_DETAIL ? '' : '<p class="segbar">Ce backup a été chargé avec une version antérieure de l\'interface : les pauses et les jours fériés configurés ne sont pas lus. Rechargez le .zip pour une analyse complète.</p>'}
  <div class="bar"><label class="count">Période</label>
    <select id="hpm">${[['7','7 derniers jours'],['30','30 derniers jours'],['90','90 derniers jours'],['all','Tout l\'historique'],['custom','Dates au choix']].map(([v,l]) => `<option value="${v}"${P.mode===v?' selected':''}>${l}</option>`).join('')}</select>
    <span id="hpc" ${P.mode==='custom'?'':'hidden'}><input type="date" id="hpf" value="${esc(P.from)}" min="${firstDay}" max="${lastDay}"> → <input type="date" id="hpt" value="${esc(P.to)}" min="${firstDay}" max="${lastDay}"></span>
    <span class="count" id="hprange"></span></div>
  <div id="hbody"></div></div>`;
  const save = () => { try{ localStorage.setItem(STATS_KEY, JSON.stringify(P)); }catch(e){} };
  let res = [];
  function draw(){
    const [from, to] = range(); $('#hprange').textContent = `du ${from} au ${to}`;
    res = hoursAnalysis(from, to);
    const sum = k => res.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : r[k].length), 0);
    $('#hbody').innerHTML = `
    <div class="grid kpis">${[['Départements analysés', res.length, ''], ['Appels entrants analysés', nf(sum('total')), ''], ['Fermé pendant les heures d\'ouverture', nf(sum('closedWhileOpen')), 'bad'], ['Ouvert hors horaires', nf(sum('openWhileClosed')), 'warn'], ['Fériés à venir non configurés', nf(res.reduce((a, r) => a + r.missingHol.length, 0)), 'warn']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    ${(() => { const adj = res.flatMap((r, i) => hoursAdjust(r).map(x => ({...x, i}))).sort((a, b) => b.perW - a.perW);
      return `<h3>Ajustements suggérés (${adj.length})</h3>${adj.length ? `<div class="tw"><table><thead><tr><th>Département</th><th>Jours</th><th>Suggestion</th><th class="num">Appels / sem.</th><th class="num">Perdus</th></tr></thead><tbody>
      ${adj.slice(0, 60).map(x => `<tr class="click" data-i="${x.i}"><td>${dnLink(x.g.number)}<div class="muted" style="font-size:11.5px">${esc(segShort(SEGOF[x.g.number]))}</div></td><td>${esc(adjDays(x.wds))}</td>
        <td><span class="pill ${x.type === 'break' ? 'warn' : 'acc'}">${esc(adjTxt(x))}</span></td><td class="num">${x.perW.toFixed(1).replace('.', ',')}</td><td class="num">${x.n ? `<span class="pill ${x.l / x.n >= 0.5 ? 'bad' : x.l ? 'warn' : 'ok'}">${pct(x.l, x.n)}</span>` : '–'}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:12px">Ouverture ou fermeture : au moins ${ADJ_SLOT} appels par semaine dans chaque demi-heure ajoutée (jusqu'à 2 h), en additionnant les jours qui ouvrent ou ferment à la même heure. Jour fermé : au moins ${ADJ_DAY} appels par semaine. Pause : au moins ${ADJ_DAY} appels par semaine, dont au moins 25 % perdus. « Perdus » : appels qui ont raccroché au menu, abandonné en file ou sont restés sans réponse (les messages laissés en messagerie ne comptent pas). Jours identiques regroupés.</p>`
        : '<p class="muted">Aucun ajustement suggéré : peu d\'appels arrivent en dehors des horaires configurés.</p>'}`; })()}
    <h3>Par département</h3>
    <div class="tw"><table><thead><tr><th>Département</th><th>Horaires configurés</th><th class="num">Appels</th><th>Branche prise</th><th class="num">Fermé pendant l'ouverture</th><th class="num">Ouvert hors horaires</th><th class="num">Avant ouverture /sem.</th><th class="num">Après fermeture /sem.</th><th>Fériés à venir manquants</th></tr></thead><tbody>
    ${res.map((r, i) => { const pc = k => r.total ? Math.round(100 * r.obs[k] / r.total) : 0;
      return `<tr class="click" data-i="${i}"><td>${dnLink(r.g.number)}<div class="muted" style="font-size:11.5px">${esc(segShort(SEGOF[r.g.number]))} · <a href="#deptrap/${esc(r.g.number)}~c:${from}:${to}">Rapport</a></div></td>
      <td style="font-size:12px">${hoursSummary(r.g.hours).map(esc).join('<br>') || '<span class="muted">—</span>'}${r.g.breakTime?.days?.length ? `<div class="muted">Pause : ${hoursSummary(r.g.breakTime).map(esc).join(', ')}</div>` : ''}</td>
      <td class="num">${nf(r.total)}</td>
      <td style="font-size:12px">${Object.keys(BR_FR).filter(k => r.obs[k]).map(k => `<span class="pill ${BR_CLS[k]}">${BR_FR[k]} ${pc(k)} %</span>`).join('')}</td>
      <td class="num">${r.closedWhileOpen.length ? `<span class="pill bad">${nf(r.closedWhileOpen.length)}</span>` : '0'}</td>
      <td class="num">${r.openWhileClosed.length ? `<span class="pill warn">${nf(r.openWhileClosed.length)}</span>` : '0'}</td>
      <td class="num">${(r.before.reduce((a, b) => a + b, 0) / r.weeks).toFixed(1)}</td><td class="num">${(r.after.reduce((a, b) => a + b, 0) / r.weeks).toFixed(1)}</td>
      <td style="font-size:12px">${r.missingHol.map(([n, d]) => `<span class="pill warn">${esc(n)} ${d.slice(5)}</span>`).join('') || '<span class="muted">—</span>'}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="note">« Fermé pendant l'ouverture » : appels arrivés dans la branche fermée (ou pause) alors que l'horaire configuré indiquait ouvert — cause probable : horaire modifié pendant la période, mode forcé (fermé manuellement) ou jour férié. « Avant ouverture / après fermeture » : moyenne par semaine des appels reçus dans l'heure qui précède l'ouverture ou suit la fermeture. Cliquez sur un département pour le détail.</p>`;
    $('#hbody').querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', e => { if(!e.target.closest('a')) showDept(res[+tr.dataset.i], from, to); }));
  }
  function showDept(r, from, to){
    const slots = Array.from({length: 48}, (_, i) => i).filter(i => i >= 12 && i < 44); // 6 h à 22 h
    const cellCls = (wd, s) => { const ex = r.sch.expected('2000-01-03', s * 30 + 15, wd); return ex === 'office' ? 'op' : ex === 'break' ? 'br' : ''; };
    const mx = Math.max(1, ...r.grid.flat().map(c => c.n));
    const sugg = [];
    const wdNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    r.before.forEach((n, wd) => { const v = n / r.weeks; if(v >= 3 && r.sch.per(wd).length) sugg.push(`Le ${wdNames[wd]}, ${v.toFixed(1)} appels par semaine arrivent dans l'heure avant l'ouverture (${r.sch.per(wd).map(p => p[0]).join(', ')}) : envisager d'ouvrir plus tôt ou d'y mettre un message adapté.`); });
    r.after.forEach((n, wd) => { const v = n / r.weeks; if(v >= 3 && r.sch.per(wd).length) sugg.push(`Le ${wdNames[wd]}, ${v.toFixed(1)} appels par semaine arrivent dans l'heure après la fermeture (${r.sch.per(wd).map(p => p[1]).join(', ')}) : envisager de fermer plus tard.`); });
    const days = r.grid.map(row => row.reduce((a, c) => a + c.n, 0));
    r.sch.per(5).length || days[5] < 3 * r.weeks || sugg.push(`${(days[5] / r.weeks).toFixed(1)} appels par samedi alors que le département est fermé le samedi.`);
    r.sch.per(6).length || days[6] < 3 * r.weeks || sugg.push(`${(days[6] / r.weeks).toFixed(1)} appels par dimanche alors que le département est fermé le dimanche.`);
    if(r.closedWhileOpen.length) sugg.unshift(`${r.closedWhileOpen.length} appel(s) sont arrivés au menu fermé pendant les heures d'ouverture configurées : vérifier les horaires, un éventuel mode « fermé » forcé manuellement, ou un jour férié non configuré.`);
    if(r.missingHol.length) sugg.push(`Jours fériés à venir non configurés : ${r.missingHol.map(([n, d]) => `${n} (${d})`).join(', ')}.`);
    hoursAdjust(r).sort((a, b) => b.perW - a.perW).reverse().forEach(x => sugg.unshift(`${adjDays(x.wds)} · ${adjTxt(x)} : ${x.perW.toFixed(1).replace('.', ',')} appels par semaine, dont ${pct(x.l, x.n)} perdus.`));
    const list = arr => arr.slice(0, 60).map(x => `<tr><td>${esc(x.day)}</td><td>${fmtMin(x.min)}</td><td class="mono">${esc(phone(x.c[5]))}</td><td>${esc(phone(x.c[2]))}</td><td>${x.exp ? `<span class="pill">${BR_FR[x.exp]} attendu</span>` : x.poss.map(p => `<span class="pill">${BR_FR[p]}</span>`).join('')}</td></tr>`).join('');
    openDrawer(`Horaires — ${esc(r.g.name)}`, `
      <p class="muted" style="font-size:12.5px">Période du ${from} au ${to} · ${nf(r.total)} appels entrants passés par ce département.</p><p><a class="btn" href="#deptrap/${esc(r.g.number)}~c:${from}:${to}">Rapport du département</a></p>
      <h3>Horaires configurés</h3>${hoursHTML(r.g.hours)}${r.g.breakTime?.days?.length ? `<h3>Pauses</h3>${hoursHTML(r.g.breakTime)}` : ''}
      <h3>Appels par demi-heure (6 h – 22 h)</h3>
      <div class="hgrid"><span></span>${slots.map(s => `<span class="hh">${s % 2 === 0 ? s / 2 : ''}</span>`).join('')}
      ${r.grid.map((row, wd) => `<span class="hd">${WD[wd]}</span>` + slots.map(s => { const c = row[s]; return `<span class="hc2 ${cellCls(wd, s)}${c.bad ? ' bad' : ''}" title="${WD[wd]} ${fmtMin(s * 30)}–${fmtMin(s * 30 + 30)} : ${c.n} appel(s)${Object.entries(c.st).map(([k, v]) => ` · ${BR_FR[k]} ${v}`).join('')}${c.bad ? ` · ${c.bad} anomalie(s)` : ''}"><i style="opacity:${c.n ? 0.25 + 0.75 * c.n / mx : 0}"></i></span>`; }).join('')).join('')}</div>
      <div class="legend"><span><i style="background:var(--ok-soft);border:1px solid var(--ok)"></i>Ouvert (configuré)</span><span><i style="background:var(--warn-soft);border:1px solid var(--warn)"></i>Pause (configurée)</span><span><i style="background:var(--accent)"></i>Volume d'appels</span><span><i style="border:2px solid var(--bad)"></i>Anomalie</span></div>
      <h3>Constats et suggestions</h3>${sugg.length ? `<ul>${sugg.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="muted">Les appels réels correspondent aux horaires configurés.</p>'}
      ${r.closedWhileOpen.length ? `<h3>Appels au menu fermé pendant l'ouverture (${r.closedWhileOpen.length})</h3><div class="tw"><table><thead><tr><th>Jour</th><th>Heure</th><th>SDA</th><th>Appelant</th><th>Branche prise</th></tr></thead><tbody>${list(r.closedWhileOpen)}</tbody></table></div>` : ''}
      ${r.openWhileClosed.length ? `<h3>Appels traités « ouvert » hors horaires (${r.openWhileClosed.length})</h3><div class="tw"><table><thead><tr><th>Jour</th><th>Heure</th><th>SDA</th><th>Appelant</th><th>Attendu</th></tr></thead><tbody>${list(r.openWhileClosed)}</tbody></table></div>` : ''}`);
  }
  $('#hpm').addEventListener('change', e => { P.mode = e.target.value; $('#hpc').hidden = P.mode !== 'custom'; if(P.mode === 'custom'){ P.from ||= firstDay; P.to ||= lastDay; $('#hpf').value = P.from; $('#hpt').value = P.to; } save(); draw(); });
  $('#hpf').addEventListener('change', e => { P.from = e.target.value; save(); draw(); });
  $('#hpt').addEventListener('change', e => { P.to = e.target.value; save(); draw(); });
  draw();
};

