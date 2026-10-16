// ---------- Appels très courts (15.5) : appels répondus qui durent quelques secondes (coupures, ligne, mauvaise manipulation) ----------
// « rappel dans les 2 minutes » : le même correspondant rappelle (ou est rappelé) juste après — signe fort d'une coupure
const SHT_KEY = 'courts3cx';
V.courts = el => {
  let S = {p: '30', t: 5}; try{ S = {...S, ...JSON.parse(localStorage.getItem(SHT_KEY) || '{}')}; }catch(e){}
  const all = FULL.calls, T = +S.t;
  if(!all.length){ el.innerHTML = '<h2>Appels très courts</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const last = localParts(all[0][0])[0], first = localParts(all[all.length - 1][0])[0];
  const [from, to] = perRange(S.p, first, last);
  // ligne (trunk) d'un appel entrant, d'après son SDA
  const didLine = {}; FULL.lines.forEach(l => (l.dids || []).forEach(d => { const k = normNum(d); if(k) didLine[k] = l; }));
  const lineName = l => l ? (l.gateway || l.number) : '—';
  const keyOf = c => c[1] === 'in' ? normNum(c[2]) : c[1] === 'out' ? normNum(c[4]) : [c[2], c[4]].sort().join('-');
  const who = c => c[1] === 'out' ? c[2] : (c[13] || c[6]);
  // appels de la période, du plus ancien au plus récent (pour chercher un rappel juste après)
  const per = []; for(const c of all){ const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue; const s = callSeg(c); if(SEG && s !== SEG) continue; per.push({c, lp, s, t: Date.parse(c[0])}); }
  per.reverse();
  const byKey = {}; per.forEach((x, i) => { const k = keyOf(x.c); if(k) (byKey[k] ||= []).push(i); });
  const answered = per.filter(x => x.c[10] === 'ans' && x.c[6] !== 'VM' && EXT_BY[x.c[6]]); // 18.2.11 : pas les fax
  const shorts = [];
  answered.forEach(x => { const talk = x.c[8] || 0; if(talk >= T) return; const k = keyOf(x.c), end = x.t + (x.c[7] || 0) * 1000;
    const again = k ? (byKey[k] || []).some(j => per[j].t > x.t && per[j].t - end <= 120000 && per[j] !== x) : false;
    shorts.push({...x, talk, again, ext: who(x.c), line: x.c[1] === 'in' ? didLine[normNum(x.c[5])] : null}); });
  const n = answered.length, k = shorts.length, again = shorts.filter(x => x.again).length;
  const grp = (list, f) => { const g = {}; list.forEach(x => { const v = f(x); if(v != null && v !== '') (g[v] ||= []).push(x); }); return g; };
  const baseExt = grp(answered, x => who(x.c)), shExt = grp(shorts, x => x.ext);
  const baseLine = grp(answered.filter(x => x.c[1] === 'in'), x => lineName(didLine[normNum(x.c[5])])), shLine = grp(shorts.filter(x => x.c[1] === 'in'), x => lineName(x.line));
  const baseH = grp(answered, x => x.lp[1]), shH = grp(shorts, x => x.lp[1]);
  const DIR = {in: 'Entrants', out: 'Sortants', int: 'Internes'};
  const hours = [...Array(24).keys()].filter(h => (baseH[h] || []).length >= 20), hr = h => (shH[h] || []).length / baseH[h].length, hmax = Math.max(.01, ...hours.map(hr));
  const worstH = hours.slice().sort((a, b) => hr(b) - hr(a))[0];
  const rate = (a, b) => b ? a / b : 0;
  el.innerHTML = `<div id="shtwrap"><h2>Appels très courts</h2>
    <p class="lead">Appels répondus qui ne durent que quelques secondes : souvent une coupure, un problème de ligne ou de téléphone, ou une mauvaise manipulation au transfert. Quand le même correspondant rappelle (ou est rappelé) dans les 2 minutes, il s'agit très probablement d'une coupure${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('shtp', S.p, first, last)}
      <label class="count">Seuil</label><select id="shtt">${[3, 5, 10].map(v => `<option value="${v}"${T === v ? ' selected' : ''}>moins de ${v} s de conversation</option>`).join('')}</select><span class="count">du ${from} au ${to}</span></div>
    <div class="grid kpis">${[['Appels répondus', nf(n), ''], ['Appels très courts', nf(k), ''], ['Part des appels répondus', pct(k, n), rate(k, n) > .05 ? 'warn' : ''], ['Rappel dans les 2 minutes', nf(again), again ? 'bad' : ''], ['Postes concernés', nf(Object.keys(shExt).length), ''], ['Heure la plus touchée', worstH != null ? `${worstH} h` : '–', '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Par type d'appel</h3>
        <div class="tw"><table><thead><tr><th>Type</th><th class="num">Répondus</th><th class="num">Très courts</th><th class="num">Part</th><th class="num">Rappel &lt; 2 min</th></tr></thead><tbody>
        ${['in', 'out', 'int'].map(d => { const b = answered.filter(x => x.c[1] === d).length, s = shorts.filter(x => x.c[1] === d); return b ? `<tr><td>${DIR[d]}</td><td class="num">${nf(b)}</td><td class="num">${nf(s.length)}</td><td class="num">${pct(s.length, b)}</td><td class="num">${nf(s.filter(x => x.again).length)}</td></tr>` : ''; }).join('')}</tbody></table></div>
        <h3>Par ligne (appels entrants)</h3>
        <div class="tw"><table><thead><tr><th>Ligne</th><th class="num">Répondus</th><th class="num">Très courts</th><th class="num">Part</th></tr></thead><tbody>
        ${Object.entries(baseLine).sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([l, b]) => { const s = (shLine[l] || []).length; return `<tr><td>${esc(l)}</td><td class="num">${nf(b.length)}</td><td class="num">${nf(s)}</td><td class="num">${rate(s, b.length) > .08 && s >= 10 ? `<span class="pill warn">${pct(s, b.length)}</span>` : pct(s, b.length)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Aucun appel entrant.</td></tr>'}</tbody></table></div></div>
      <div class="card"><h3 style="margin-top:0">Part d'appels très courts par heure</h3>
        ${hours.map(h => `<div class="stbar"><span class="nm">${h} h</span><span class="t"><span style="width:${100 * hr(h) / hmax}%;background:var(--warn)"></span></span><span class="num">${pct((shH[h] || []).length, baseH[h].length)} <span class="muted">${nf((shH[h] || []).length)}</span></span></div>`).join('') || '<p class="muted">Pas assez d&#39;appels.</p>'}
        <p class="note">Heures avec au moins 20 appels répondus ; heure de l'Est.</p></div>
    </div>
    <h3>Par poste</h3><div id="shtx"></div>
    <p class="note">Appel très court : appel répondu (par une personne ou par le correspondant pour un appel sortant) dont la conversation dure moins que le seuil. Les appels pris par la messagerie ne sont pas comptés. Un poste avec beaucoup d'appels très courts et de rappels mérite une vérification du téléphone, du câble ou du Wi-Fi (voir aussi l'onglet Qualité des appels). Poste : celui qui a décroché pour les appels reçus, celui qui a appelé pour les appels sortants.</p></div>`;
  table($('#shtx'), {rows: Object.entries(shExt).map(([e, l]) => ({e, seg: SEGOF[e] || SEG_COMMON, n: l.length, base: (baseExt[e] || []).length, again: l.filter(x => x.again).length, list: l})), pageSize: 25, sort: [3, -1], state: (window.__shtT ||= {}),
    search: r => r.e + ' ' + dnName(r.e) + ' ' + segShort(r.seg),
    cols: [{h: 'Poste', v: r => r.e, f: r => dnLink(r.e)}, {h: 'Magasin', v: r => segShort(r.seg), cls: 'muted'}, {h: 'Appels répondus', num: 1, v: r => r.base, f: r => nf(r.base)},
      {h: 'Très courts', num: 1, v: r => r.n, f: r => nf(r.n)}, {h: 'Part', num: 1, v: r => rate(r.n, r.base), f: r => r.base >= 20 && rate(r.n, r.base) > .1 ? `<span class="pill warn">${pct(r.n, r.base)}</span>` : pct(r.n, r.base)},
      {h: 'Rappel < 2 min', num: 1, v: r => r.again, f: r => r.again ? `<span class="pill bad">${nf(r.again)}</span>` : '<span class="muted">0</span>'}],
    onRow: r => openDrawer(`Appels très courts — ${esc(r.e)} ${esc(dnName(r.e))}`, `<p class="muted" style="font-size:12.5px;margin-top:0">${nf(r.n)} appel${r.n > 1 ? 's' : ''} de moins de ${T} s sur ${nf(r.base)} répondu${r.base > 1 ? 's' : ''} ; les 200 plus récents.</p>
      <div class="tw"><table><thead><tr><th>Date</th><th>Type</th><th>Correspondant</th><th class="num">Conversation</th><th>Rappel &lt; 2 min</th></tr></thead><tbody>${r.list.slice().reverse().slice(0, 200).map(x => `<tr style="white-space:nowrap"><td>${esc(fmtD(x.c[0]))}</td><td>${DIR[x.c[1]]}</td><td class="mono">${esc(x.c[1] === 'in' ? phone(x.c[2]) || x.c[2] : x.c[1] === 'out' ? phone(x.c[4]) || x.c[4] : x.c[2] === r.e ? x.c[4] : x.c[2])}</td><td class="num">${x.talk} s</td><td>${x.again ? '<span class="pill bad">oui</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`)});
  const save = () => { try{ localStorage.setItem(SHT_KEY, JSON.stringify(S)); }catch(e){} V.courts(el); };
  perWire('shtp', S.p, first, last, v => { S.p = v; save(); });
  $('#shtt').addEventListener('change', e => { S.t = +e.target.value; save(); });
};

