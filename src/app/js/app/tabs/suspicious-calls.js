// ---------- Appels suspects (15.8) : démarchage, robots, appels répétés anormaux ----------
// signaux par numéro appelant : rafale (5 appels ou plus en 15 min), plusieurs SDA en 1 h, appels très courts répétés, appels de nuit répétés
const SUS_KEY = 'suspects3cx-periode';
const SUS_FLAG = {burst: ['Rafale', 'bad', '5 appels ou plus en 15 minutes'], multi: ['Plusieurs numéros appelés', 'bad', '3 SDA différents ou plus en moins d\'une heure'],
  short: ['Appels très courts', 'warn', '5 appels ou plus, durée médiane sous 15 s'], night: ['Appels de nuit', 'warn', '2 appels ou plus entre 22 h et 6 h']};
V.suspects = el => {
  const all = FULL.calls; let P = '30'; try{ P = localStorage.getItem(SUS_KEY) || '30'; }catch(e){}
  if(!all.length){ el.innerHTML = '<h2>Appels suspects</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const last = localParts(all[0][0])[0], first = localParts(all[all.length - 1][0])[0];
  const [from, to] = perRange(P, first, last);
  const byNum = {}, masked = Array(24).fill(0); let inTot = 0, maskTot = 0;
  for(const c of all){ if(c[1] !== 'in') continue; const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue; const s = callSeg(c); if(SEG && s !== SEG) continue; inTot++;
    const k = normNum(c[2]);
    if(!k){ maskTot++; masked[lp[1]]++; continue; }
    (byNum[k] ||= {k, raw: c[2], calls: []}).calls.push({c, t: Date.parse(c[0]), h: lp[1], s}); }
  const sus = [];
  Object.values(byNum).forEach(x => { const L = x.calls.slice().sort((a, b) => a.t - b.t), n = L.length; if(n < 2) return;
    const flags = [];
    for(let i = 0; i + 4 < n; i++) if(L[i + 4].t - L[i].t <= 900000){ flags.push('burst'); break; }
    for(let i = 0, j = 0; i < n; i++){ while(L[i].t - L[j].t > 3600000) j++; if(new Set(L.slice(j, i + 1).map(y => y.c[5])).size >= 3){ flags.push('multi'); break; } }
    const durs = L.map(y => y.c[7] || 0).sort((a, b) => a - b), med = durs[Math.floor((n - 1) / 2)];
    if(n >= 5 && med < 15) flags.push('short');
    if(L.filter(y => y.h >= 22 || y.h < 6).length >= 2) flags.push('night');
    if(!flags.length) return;
    sus.push({k: x.k, raw: x.raw, n, flags, med, ans: L.filter(y => ST_ANS.has(y.c[10])).length, dids: new Set(L.map(y => y.c[5])).size, segs: new Set(L.map(y => y.s)), first: L[0].c[0], last: L[n - 1].c[0], L, score: flags.length * 10 + Math.min(n, 50)}); });
  sus.sort((a, b) => b.score - a.score);
  const cnt = f => sus.filter(x => x.flags.includes(f)).length, susCalls = sus.reduce((a, x) => a + x.n, 0);
  const mmax = Math.max(1, ...masked), mPeak = masked.indexOf(Math.max(...masked));
  el.innerHTML = `<div id="suswrap"><h2>Appels suspects</h2>
    <p class="lead">Numéros dont le comportement ressemble à du démarchage, à un robot ou à un appel anormal : rafales d'appels, plusieurs numéros de l'entreprise appelés en moins d'une heure, appels très courts répétés, appels de nuit répétés, et numéros masqués${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Ce sont des signaux à vérifier : un client pressé peut aussi rappeler plusieurs fois.</p>
    <div class="bar"><label class="count">Période</label>${perUI('susp', P, first, last)}<span class="count">du ${from} au ${to}</span><span style="flex:1"></span><button class="btn" id="susexp">Exporter (CSV)</button></div>
    <div class="grid kpis">${[['Numéros suspects', nf(sus.length), sus.length ? 'warn' : ''], ['Appels de ces numéros', nf(susCalls), ''], ['Rafales', nf(cnt('burst')), cnt('burst') ? 'bad' : ''], ['Plusieurs numéros appelés', nf(cnt('multi')), cnt('multi') ? 'bad' : ''], ['Appels masqués', `${nf(maskTot)} (${pct(maskTot, inTot)})`, maskTot / Math.max(1, inTot) > .15 ? 'warn' : '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Signaux</h3>
        ${Object.entries(SUS_FLAG).map(([k, [l, c, d]]) => `<div style="display:flex;gap:8px;align-items:baseline;margin:6px 0"><span class="pill ${c}">${esc(l)}</span><span class="muted" style="font-size:12.5px;flex:1">${esc(d)}</span><b>${nf(cnt(k))}</b></div>`).join('')}
        <p class="note">Pour bloquer un numéro : liste des numéros bloqués de la console 3CX (Blacklist). Vérifiez d'abord qu'il ne s'agit pas d'un client.</p></div>
      <div class="card"><h3 style="margin-top:0">Appels masqués par heure</h3>
        ${[...Array(24).keys()].filter(h => masked[h]).map(h => `<div class="stbar"><span class="nm">${h} h</span><span class="t"><span style="width:${100 * masked[h] / mmax}%;background:var(--warn)"></span></span><span class="num">${nf(masked[h])}</span></div>`).join('') || '<p class="muted">Aucun appel masqué sur la période.</p>'}
        ${maskTot ? `<p class="note">Heure avec le plus d'appels masqués : ${mPeak} h (heure de l'Est).</p>` : ''}</div>
    </div>
    <h3>Numéros suspects (${nf(sus.length)})</h3><div id="sust"></div>
    <p class="note">Seuls les appels entrants avec un numéro visible sont analysés numéro par numéro. Rafale : 5 appels ou plus en 15 minutes. Plusieurs numéros appelés : le même numéro appelle 3 SDA différents ou plus en moins d'une heure (typique d'un robot qui compose une liste). Appels très courts : 5 appels ou plus avec une durée médiane sous 15 secondes. Appels de nuit : 2 appels ou plus entre 22 h et 6 h (heure de l'Est).</p></div>`;
  table($('#sust'), {rows: sus, pageSize: 25, sort: [6, -1], state: (window.__susT ||= {}),
    search: x => x.k + ' ' + phone(x.raw) + ' ' + x.flags.map(f => SUS_FLAG[f][0]).join(' '),
    filters: [{label: 'Tous les signaux', options: Object.entries(SUS_FLAG).map(([k, v]) => [k, v[0]]), test: (x, v) => x.flags.includes(v)}],
    cols: [{h: 'Numéro', v: x => x.k, f: x => `<span class="mono">${esc(phone(x.raw) || x.raw)}</span>${vipStar(x.raw)}`}, {h: 'Appels', num: 1, v: x => x.n, f: x => nf(x.n)}, {h: 'SDA appelés', num: 1, v: x => x.dids, f: x => nf(x.dids)},
      {h: 'Magasins', num: 1, v: x => x.segs.size, f: x => nf(x.segs.size)}, {h: 'Durée médiane', num: 1, v: x => x.med, f: x => dur(x.med)}, {h: 'Répondus', num: 1, v: x => x.ans / x.n, f: x => pct(x.ans, x.n)},
      {h: 'Signaux', v: x => x.score, f: x => x.flags.map(f => `<span class="pill ${SUS_FLAG[f][1]}">${esc(SUS_FLAG[f][0])}</span>`).join(' ')}, {h: 'Dernier appel', v: x => x.last, f: x => esc(fmtD(x.last))}],
    onRow: x => openDrawer(`Numéro <span class="mono">${esc(phone(x.raw) || x.raw)}</span>`, kv([['Appels', nf(x.n)], ['Premier / dernier', `${esc(fmtD(x.first))} → ${esc(fmtD(x.last))}`], ['SDA appelés', nf(x.dids)], ['Magasins', esc([...x.segs].map(segShort).join(', '))], ['Signaux', x.flags.map(f => `<span class="pill ${SUS_FLAG[f][1]}">${esc(SUS_FLAG[f][0])}</span>`).join(' ')]]) +
      `<div class="tw"><table><thead><tr><th>Date</th><th>SDA appelé</th><th>Issue</th><th class="num">Durée</th></tr></thead><tbody>${x.L.slice().reverse().slice(0, 200).map(y => `<tr style="white-space:nowrap"><td>${esc(fmtD(y.c[0]))}</td><td class="mono">${esc(phone(y.c[5]) || y.c[5] || '')}</td><td>${stHTML(y.c)}</td><td class="num">${dur(y.c[7])}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:12.5px">Historique complet du numéro : onglet Historique client.</p>`)});
  perWire('susp', P, first, last, v => { try{ localStorage.setItem(SUS_KEY, v); }catch(er){} V.suspects(el); });
  $('#susexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"';
    const out = [['Numéro', 'Appels', 'SDA appelés', 'Magasins', 'Durée médiane (s)', 'Répondus', 'Signaux', 'Premier appel', 'Dernier appel']].concat(sus.map(x => [phone(x.raw) || x.raw, x.n, x.dids, [...x.segs].map(segShort).join(' '), x.med, x.ans, x.flags.map(f => SUS_FLAG[f][0]).join(' | '), fmtD(x.first), fmtD(x.last)]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'appels-suspects.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};

