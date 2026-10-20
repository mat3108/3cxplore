// ---------- Appels internes (15.7) : qui appelle qui dans l'entreprise, entre postes et entre magasins ----------
const INT_KEY = 'internes3cx-periode';
V.internes = el => {
  const all = FULL.calls; let P = '30'; try{ P = localStorage.getItem(INT_KEY) || '30'; }catch(e){}
  if(!all.length){ el.innerHTML = '<h2>Appels internes</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const last = localParts(all[0][0])[0], first = callHist().first;
  const [from, to] = perRange(P, first, last);
  const kindOf = n => DN[n] ? DN[n].kind : 'Poste';
  const rows = []; // {c, a: appelant, b: appelé, sa, sb, ok}
  for(const c of all){ if(c[1] !== 'int') continue; const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue;
    const a = c[2], b = c[4], sa = SEGOF[a] || SEG_COMMON, sb = SEGOF[b] || SEGOF[c[6]] || SEG_COMMON;
    if(SEG && sa !== SEG && sb !== SEG) continue;
    rows.push({c, a, b, sa, sb, ok: c[10] === 'ans', kind: kindOf(b)}); }
  const tot = rows.length, ok = rows.filter(x => x.ok).length, cross = rows.filter(x => x.sa !== x.sb && x.sa !== SEG_COMMON && x.sb !== SEG_COMMON).length;
  const talk = rows.filter(x => x.ok).reduce((s, x) => s + (x.c[8] || 0), 0);
  const inc = {}, outg = {}, pairs = {}, mat = {}, kinds = {};
  rows.forEach(x => { const i = inc[x.b] ||= {n: x.b, k: 0, ok: 0, from: new Set(), segs: new Set()}; i.k++; if(x.ok) i.ok++; i.from.add(x.a); i.segs.add(x.sa);
    const o = outg[x.a] ||= {n: x.a, k: 0, ok: 0, to: new Set()}; o.k++; if(x.ok) o.ok++; o.to.add(x.b);
    const p = pairs[x.a + '→' + x.b] ||= {a: x.a, b: x.b, k: 0, ok: 0}; p.k++; if(x.ok) p.ok++;
    (mat[x.sa] ||= {})[x.sb] = (mat[x.sa][x.sb] || 0) + 1;
    const kd = kinds[x.kind] ||= {k: 0, ok: 0}; kd.k++; if(x.ok) kd.ok++; });
  const stores = [...new Set(rows.flatMap(x => [x.sa, x.sb]))].filter(s => s !== SEG_BRIDGE).sort((a, b) => rows.filter(x => x.sa === b || x.sb === b).length - rows.filter(x => x.sa === a || x.sb === a).length).slice(0, 14);
  const mmax = Math.max(1, ...stores.flatMap(a => stores.map(b => a === b ? 0 : (mat[a] || {})[b] || 0)));
  el.innerHTML = `<div id="intwrap"><h2>Appels internes</h2>
    <p class="lead">Qui appelle qui à l'intérieur de l'entreprise : postes très sollicités par les collègues, collègues difficiles à joindre, et appels entre magasins${SEG ? ` — magasin <b>${esc(segName(SEG))}</b> (appels passés ou reçus par ses postes)` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('intp', P, first, last)}<span class="count">du ${from} au ${to}</span></div>
    <div class="grid kpis">${[['Appels internes', nf(tot), ''], ['Répondus', pct(ok, tot), tot && ok / tot < .7 ? 'warn' : ''], ['Entre deux magasins', pct(cross, tot), ''], ['Postes qui appellent', nf(Object.keys(outg).length), ''], ['Conversation moyenne', ok ? dur(Math.round(talk / ok)) : '–', '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Vers quoi</h3>
        <div class="tw"><table><thead><tr><th>Destination</th><th class="num">Appels</th><th class="num">Répondus</th></tr></thead><tbody>
        ${Object.entries(kinds).sort((a, b) => b[1].k - a[1].k).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${nf(v.k)}</td><td class="num">${pct(v.ok, v.k)}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="card"><h3 style="margin-top:0">Paires les plus fréquentes</h3>
        <div class="tw"><table><thead><tr><th>Appelant</th><th>Appelé</th><th class="num">Appels</th><th class="num">Répondus</th></tr></thead><tbody>
        ${Object.values(pairs).sort((a, b) => b.k - a.k).slice(0, 10).map(p => `<tr><td>${dnLink(p.a)}</td><td>${dnLink(p.b)}</td><td class="num">${nf(p.k)}</td><td class="num">${pct(p.ok, p.k)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    ${stores.length > 1 ? `<h3>Entre magasins</h3><div class="tw"><table class="intmat"><thead><tr><th>Appelant ↓ / appelé →</th>${stores.map(s => `<th class="num">${esc(segShort(s))}</th>`).join('')}</tr></thead><tbody>
      ${stores.map(a => `<tr><th>${esc(segShort(a))}</th>${stores.map(b => { const v = (mat[a] || {})[b] || 0; return a === b ? `<td class="num muted">${v ? nf(v) : '–'}</td>` : `<td class="num" style="background:color-mix(in srgb,var(--accent) ${Math.round(60 * v / mmax)}%,transparent)">${v ? nf(v) : '<span class="muted">–</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">Nombre d'appels internes d'un magasin (ligne) vers un autre (colonne) ; la diagonale grise compte les appels à l'intérieur d'un même magasin. Plus la case est colorée, plus il y a d'appels.</p>` : ''}
    <h3>Postes les plus sollicités par les collègues</h3><div id="intin"></div>
    <h3>Postes qui appellent le plus leurs collègues</h3><div id="intout"></div>
    <p class="note">Appel interne : appel d'un poste vers un autre poste, une file, un groupe de sonnerie ou un menu de l'entreprise. « Répondus » : quelqu'un a décroché. Un poste très appelé mais peu répondu est difficile à joindre pour ses collègues : un renvoi ou une file peut aider.</p></div>`;
  table($('#intin'), {rows: Object.values(inc), pageSize: 15, sort: [2, -1], state: (window.__intI ||= {}),
    search: r => r.n + ' ' + dnName(r.n), cols: [{h: 'Appelé', v: r => r.n, f: r => dnLink(r.n)}, {h: 'Type', v: r => kindOf(r.n), cls: 'muted'}, {h: 'Appels reçus', num: 1, v: r => r.k, f: r => nf(r.k)},
      {h: 'Répondus', num: 1, v: r => r.ok / r.k, f: r => r.k >= 10 && r.ok / r.k < .6 ? `<span class="pill warn">${pct(r.ok, r.k)}</span>` : pct(r.ok, r.k)}, {h: 'Collègues différents', num: 1, v: r => r.from.size, f: r => nf(r.from.size)}, {h: 'Magasins appelants', num: 1, v: r => r.segs.size, f: r => nf(r.segs.size)}]});
  table($('#intout'), {rows: Object.values(outg), pageSize: 15, sort: [1, -1], state: (window.__intO ||= {}),
    search: r => r.n + ' ' + dnName(r.n), cols: [{h: 'Appelant', v: r => r.n, f: r => dnLink(r.n)}, {h: 'Appels passés', num: 1, v: r => r.k, f: r => nf(r.k)}, {h: 'Répondus', num: 1, v: r => r.ok / r.k, f: r => pct(r.ok, r.k)}, {h: 'Destinataires différents', num: 1, v: r => r.to.size, f: r => nf(r.to.size)}]});
  perWire('intp', P, first, last, v => { try{ localStorage.setItem(INT_KEY, v); }catch(er){} V.internes(el); });
};

