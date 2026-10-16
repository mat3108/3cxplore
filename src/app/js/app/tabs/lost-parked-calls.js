// ---------- Appels perdus en parking (section de l'onglet Parkings partagés) ----------
function parkLostHTML(){
  if(!FULL.calls.some(c => c[10] === 'park_ab')) return (FULL.parkCalls || []).some(r => r[3] === 'hangup') ? `<h3>Appels perdus en parking</h3><div class="card" style="border-left:3px solid var(--warn)">Des appels ont été raccrochés en parking : <b>rouvrez le backup</b> pour les retrouver ici et dans la liste des Appels manqués, avec le numéro du client à rappeler.</div>` : '';
  const all = FULL.calls, lastDay = localParts(all[0][0])[0], firstDay = localParts(all[all.length - 1][0])[0];
  const rows = missedAnalysis(firstDay, lastDay).filter(r => r.lost.some(i => FULL.calls[i][10] === 'park_ab') && (!SEG || r.seg === SEG)); // 18.2.33
  const calls = all.filter(c => c[10] === 'park_ab' && (!SEG || callSeg(c) === SEG));
  const days = {}; calls.forEach(c => { const d = localParts(c[0])[0]; (days[d] ||= {n: 0, nums: new Set()}).n++; days[d].nums.add(normNum(c[2])); });
  const todoNums = new Set(rows.filter(r => r.st === 'todo').map(r => r.num));
  const dl = Object.keys(days).sort().reverse().slice(0, 14);
  const mx = Math.max(1, ...dl.map(d => days[d].n));
  return `<h3>Appels perdus en parking</h3>
    <div class="grid kpis">${[['Appels raccrochés en parking', nf(calls.length)], ['Clients concernés', nf(rows.length)], ['Non rappelés', nf(rows.filter(r => r.st === 'todo').length)], ['Rappelés par le magasin', nf(rows.filter(r => r.st === 'back').length)]].map(([l, v], i) => `<div class="card kpi${i === 2 && v !== '0' ? ' bad' : ''}"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="grid two"><div class="card"><div class="ubt">14 derniers jours</div>${dl.map(d => { const t = [...days[d].nums].filter(n => todoNums.has(n)).length;
      return `<div class="stbar"><span class="nm mono">${esc(d)}</span><span class="t" title="${days[d].n} appel(s) raccroché(s) en parking, ${t} client(s) non rappelé(s)"><span style="width:${100 * days[d].n / mx}%;background:var(--bad)"></span></span><span class="muted" style="font-size:12px;min-width:110px">${days[d].n} appel${days[d].n > 1 ? 's' : ''}${t ? ` · <b style="color:var(--bad)">${t} à rappeler</b>` : ''}</span></div>`; }).join('') || '<span class="muted">Aucun</span>'}</div>
    <div class="card"><div class="ubt">À rappeler (${rows.filter(r => r.st === 'todo').length})</div>${rows.filter(r => r.st === 'todo').sort((a, b) => a.last < b.last ? 1 : -1).slice(0, 15).map(r => `<div style="font-size:13px;padding:2px 0"><a class="mono" href="#client/${esc(r.num)}"><b>${esc(phone(r.num))}</b></a>${r.name ? ` <span class="muted">${esc(r.name)}</span>` : ''} <span class="muted">· ${esc(fmtD(r.last))}${r.n > 1 ? ` · ${r.n} tentatives` : ''} · ${esc(segShort(r.seg))}</span></div>`).join('') || '<span class="muted">Tous les clients ont été rappelés ou ont rappelé.</span>'}
      <p style="margin:8px 0 0"><a class="btn" href="#rappels">Ouvrir la liste complète (Appels manqués)</a></p></div></div>`;
}

