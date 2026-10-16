// ---------- Délai avant réponse (15.3) : temps d'attente du client avant qu'une personne décroche ----------
// mesure exacte : secondes entre l'arrivée de l'appel et le premier décroché d'un poste (champ ajouté au chargement depuis 15.3) ;
// backup chargé avec une version plus ancienne : estimation = durée de l'appel − durée de conversation (appels sans transfert)
const DLY_KEY = 'delai3cx';
const dlyPct = (arr, p) => { if(!arr.length) return null; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))]; };
const dlyFmt = v => v == null ? '–' : v < 60 ? v + ' s' : Math.floor(v / 60) + ' min ' + String(v % 60).padStart(2, '0') + ' s';
const DLY_BK = [[0, 10, 'Moins de 10 s'], [10, 20, '10 à 20 s'], [20, 30, '20 à 30 s'], [30, 60, '30 s à 1 min'], [60, 120, '1 à 2 min'], [120, 300, '2 à 5 min'], [300, 1e9, 'Plus de 5 min']];
V.delai = el => {
  let S = {p: '30', t: 20}; try{ S = {...S, ...JSON.parse(localStorage.getItem(DLY_KEY) || '{}')}; }catch(e){}
  const all = FULL.calls;
  if(!all.length){ el.innerHTML = '<h2>Délai avant réponse</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const last = localParts(all[0][0])[0], first = localParts(all[all.length - 1][0])[0];
  const [from, to] = perRange(S.p, first, last);
  const T = +S.t;
  const rows = []; let exact = 0, skipped = 0; // [délai, magasin, heure, jour de semaine, poste qui a répondu, appel]
  for(const c of all){
    if(c[1] !== 'in') continue; const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue;
    if(c[10] !== 'ans' || !c[6] || c[6] === 'VM' || !EXT_BY[c[6]]) continue; // 18.2.10 : répondu par un poste (pas un fax)
    const s = callSeg(c); if(SEG && s !== SEG) continue;
    let w = null;
    if(c.length > 12 && c[12] != null){ w = c[12]; exact++; }
    else if(!Array.isArray(c[11]) || c[11].length <= 1) w = Math.max(0, (c[7] || 0) - (c[8] || 0));
    if(w == null){ skipped++; continue; }
    rows.push([w, s, lp[1], lp[2], c[13] || c[6], c]);
  }
  const W = rows.map(r => r[0]), n = W.length, under = W.filter(v => v < T).length;
  const stat = list => { const v = list.map(r => r[0]); return {n: v.length, med: dlyPct(v, .5), p90: dlyPct(v, .9), under: v.filter(x => x < T).length}; };
  const grp = key => { const g = {}; rows.forEach(r => (g[key(r)] ||= []).push(r)); return g; };
  const byH = grp(r => r[2]), bySeg = grp(r => r[1]), byExt = grp(r => r[4]);
  const hours = [...Array(24).keys()].filter(h => (byH[h] || []).length >= 5), hst = Object.fromEntries(hours.map(h => [h, stat(byH[h])])), hmax = Math.max(1, ...hours.map(h => hst[h].med));
  const bk = DLY_BK.map(([a, b, l]) => [l, W.filter(v => v >= a && v < b).length]), bmax = Math.max(1, ...bk.map(x => x[1]));
  const cls = v => v == null ? '' : v < T ? 'ok' : v < 2 * T ? 'warn' : 'bad';
  const estimated = n - exact;
  el.innerHTML = `<div id="dlywrap"><h2>Délai avant réponse</h2>
    <p class="lead">Combien de temps un client attend avant qu'une personne décroche, depuis l'arrivée de son appel (menu, file d'attente et sonnerie compris), pour les appels entrants répondus par un poste${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('dlyp', S.p, first, last)}
      <label class="count">Objectif</label><select id="dlyt">${[10, 20, 30, 60].map(v => `<option value="${v}"${T === v ? ' selected' : ''}>répondre en moins de ${v} s</option>`).join('')}</select><span class="count">du ${from} au ${to}</span></div>
    ${estimated && n ? `<div class="card" style="border-left:3px solid var(--warn);margin-bottom:12px;font-size:13px">${exact ? `${pct(estimated, n)} des délais sont estimés` : 'Les délais sont estimés'} (durée de l'appel moins durée de conversation) : ce backup a été chargé avec une version précédente. Rouvrez le fichier .zip du backup pour obtenir la mesure exacte.</div>` : ''}
    <div class="grid kpis">${[['Appels répondus mesurés', nf(n), ''], ['Délai médian', dlyFmt(dlyPct(W, .5)), cls(dlyPct(W, .5))], ['90 % répondus en moins de', dlyFmt(dlyPct(W, .9)), cls(dlyPct(W, .9))], [`Répondus en moins de ${T} s`, pct(under, n), n && under / n >= .8 ? 'ok' : n && under / n >= .6 ? 'warn' : 'bad'], ['Attente la plus longue', dlyFmt(n ? Math.max(...W) : null), '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Répartition des délais</h3>
        ${bk.map(([l, v], i) => `<div class="stbar"><span class="nm">${esc(l)}</span><span class="t"><span style="width:${100 * v / bmax}%;background:var(--${DLY_BK[i][1] <= T ? 'ok' : DLY_BK[i][0] >= 2 * T ? 'bad' : 'warn'})"></span></span><span class="num">${nf(v)} <span class="muted">${pct(v, n)}</span></span></div>`).join('')}</div>
      <div class="card"><h3 style="margin-top:0">Délai médian par heure</h3>
        ${hours.map(h => `<div class="stbar"><span class="nm">${h} h</span><span class="t"><span style="width:${100 * hst[h].med / hmax}%;background:var(--${cls(hst[h].med) || 'accent'})"></span></span><span class="num">${dlyFmt(hst[h].med)} <span class="muted">${nf(hst[h].n)} app.</span></span></div>`).join('') || '<p class="muted">Pas assez d&#39;appels.</p>'}
        <p class="note">Heures avec au moins 5 appels répondus ; heure de l'Est.</p></div>
    </div>
    ${SEG ? '' : `<h3>Par magasin</h3><div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Appels répondus</th><th class="num">Délai médian</th><th class="num">90 % en moins de</th><th class="num">En moins de ${T} s</th><th class="num">Heure la plus lente</th></tr></thead><tbody>
      ${Object.entries(bySeg).map(([s, l]) => [s, stat(l), l]).sort((a, b) => b[1].n - a[1].n).map(([s, x, l]) => { const hh = (() => { const g = {}; l.forEach(r => (g[r[2]] ||= []).push(r[0])); const c = Object.entries(g).filter(([, v]) => v.length >= 5).map(([h, v]) => [h, dlyPct(v, .5)]).sort((a, b) => b[1] - a[1])[0]; return c; })();
        return `<tr><td><b>${esc(segShort(s))}</b></td><td class="num">${nf(x.n)}</td><td class="num"><span class="pill ${cls(x.med)}">${dlyFmt(x.med)}</span></td><td class="num">${dlyFmt(x.p90)}</td><td class="num">${pct(x.under, x.n)}</td><td class="num">${hh ? `${hh[0]} h · ${dlyFmt(hh[1])}` : '–'}</td></tr>`; }).join('')}</tbody></table></div>`}
    <h3>Par personne qui a répondu</h3><div id="dlyx"></div>
    <p class="note">Délai : de l'arrivée de l'appel entrant jusqu'au premier décroché d'un poste (menu, file et sonnerie compris). Ne sont pas comptés : les appels pris par la messagerie, renvoyés vers l'extérieur, perdus ou transférés vers un autre 3CX. La personne est celle qui a décroché en premier.</p></div>`;
  table($('#dlyx'), {rows: Object.entries(byExt).map(([e, l]) => ({e, seg: SEGOF[e] || SEG_COMMON, ...stat(l)})), pageSize: 25, sort: [3, -1], state: (window.__dlyT ||= {}),
    search: r => r.e + ' ' + dnName(r.e) + ' ' + segShort(r.seg),
    cols: [{h: 'Poste', v: r => r.e, f: r => dnLink(r.e)}, {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'}, {h: 'Appels répondus', num: 1, v: r => r.n, f: r => nf(r.n)},
      {h: 'Délai médian', num: 1, v: r => r.med, f: r => `<span class="pill ${cls(r.med)}">${dlyFmt(r.med)}</span>`}, {h: '90 % en moins de', num: 1, v: r => r.p90, f: r => dlyFmt(r.p90)}, {h: `En moins de ${T} s`, num: 1, v: r => r.under / r.n, f: r => pct(r.under, r.n)}]});
  const save = () => { try{ localStorage.setItem(DLY_KEY, JSON.stringify(S)); }catch(e){} V.delai(el); };
  perWire('dlyp', S.p, first, last, v => { S.p = v; save(); });
  $('#dlyt').addEventListener('change', e => { S.t = +e.target.value; save(); });
};

