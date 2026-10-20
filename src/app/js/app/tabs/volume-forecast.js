// ---------- Prévision du volume (15.6) : appels entrants attendus la semaine suivant le backup ----------
// méthode : pour chaque jour de semaine et chaque heure, moyenne pondérée des N dernières semaines (les plus récentes comptent plus),
// corrigée par la tendance (4 dernières semaines contre les 4 précédentes, limitée à ±20 %) ; jour férié : ratio observé les fériés passés
const PRV2_KEY = 'prevision3cx';
const FC_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
V.prevision = el => {
  let S = {w: 8}; try{ S = {...S, ...JSON.parse(localStorage.getItem(PRV2_KEY) || '{}')}; }catch(e){}
  const all = FULL.calls, W = +S.w;
  if(!all.length){ el.innerHTML = '<h2>Prévision du volume</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const wdOf = d => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const last = localParts(all[0][0])[0], first = callHist().first;
  // dernier jour complet : si le backup a été pris en cours de journée, on s'arrête la veille
  const lastFull = localParts(all[0][0])[1] < 20 ? addD(last, -1) : last;
  const from = addD(lastFull, -(W * 7) + 1);
  const hol = new Set(); [0, 1].forEach(o => { const y = +lastFull.slice(0, 4) + o - 1; qcHolidays(y).concat(qcHolidays(y + 1)).forEach(h => hol.add(h[1])); });
  const holName = {}; [+lastFull.slice(0, 4), +lastFull.slice(0, 4) + 1].forEach(y => qcHolidays(y).forEach(h => holName[h[1]] = h[0]));
  // appels entrants par jour et par heure
  const day = {}; // 'AAAA-MM-JJ' -> [24]
  const oldest = addD(from, -400);
  for(const c of all){ if(c[1] !== 'in') continue; const lp = localParts(c[0]); if(lp[0] > lastFull) continue; if(lp[0] < oldest) break; const s = callSeg(c); if(SEG && s !== SEG) continue; if(s === SEG_BRIDGE) continue;
    (day[lp[0]] ||= Array(24).fill(0))[lp[1]]++; }
  const dTot = d => (day[d] || []).reduce((a, v) => a + v, 0);
  const weeks = [...Array(W).keys()]; // 0 = semaine la plus récente
  const dOld = Object.keys(day).sort()[0], histDays = dOld ? Math.max(0, Math.round((Date.parse(lastFull) - Date.parse(dOld)) / 864e5) + 1) : 0; // 18.1.13 : historique réellement disponible
  // tendance : 4 dernières semaines contre les 4 précédentes (jours non fériés)
  const sumRange = (a, b) => { let t = 0; for(let i = a; i < b; i++){ const d = addD(lastFull, -i); if(!hol.has(d)) t += dTot(d); } return t; };
  const r1 = sumRange(0, 28), r0 = sumRange(28, 56), trend = r0 > 0 && histDays >= 56 ? Math.max(.8, Math.min(1.2, r1 / r0)) : 1;
  // ratio des jours fériés passés (volume du férié / moyenne du même jour de semaine)
  const holRatios = []; Object.keys(day).forEach(d => { if(!hol.has(d)) return; const ref = [1, 2, 3, 4].map(k => dTot(addD(d, -7 * k))).filter(v => v > 0); if(ref.length) holRatios.push(dTot(d) / (ref.reduce((a, v) => a + v, 0) / ref.length)); });
  const holRatio = holRatios.length ? holRatios.reduce((a, v) => a + v, 0) / holRatios.length : .25;
  // prévision : 7 jours suivant le dernier jour complet
  const next = [...Array(7).keys()].map(i => addD(lastFull, i + 1)).map(d => {
    const wd = wdOf(d), past = weeks.map(k => { let x = addD(lastFull, -((7 + wdOf(lastFull) - wd) % 7) - 7 * k); return x; }).filter(x => x >= first && !hol.has(x));
    const wts = past.map((x, i) => W - i), wsum = wts.reduce((a, v) => a + v, 0) || 1;
    const hours = Array(24).fill(0).map((_, h) => past.reduce((a, x, i) => a + (day[x] ? day[x][h] : 0) * wts[i], 0) / wsum * trend * (hol.has(d) ? holRatio : 1));
    const totals = past.map(x => dTot(x)), tot = hours.reduce((a, v) => a + v, 0);
    return {d, wd, hours, tot, min: totals.length ? Math.min(...totals) : 0, max: totals.length ? Math.max(...totals) : 0, n: past.length, hol: hol.has(d) ? holName[d] || 'Jour férié' : ''};
  });
  const prevWeek = [...Array(7).keys()].reduce((a, i) => a + dTot(addD(lastFull, -i)), 0), fcWeek = next.reduce((a, x) => a + x.tot, 0);
  const busiest = next.slice().sort((a, b) => b.tot - a.tot)[0];
  const hSum = Array(24).fill(0); next.forEach(x => x.hours.forEach((v, h) => hSum[h] += v)); const peakH = hSum.indexOf(Math.max(...hSum));
  const hrs = [...Array(24).keys()].filter(h => hSum[h] >= 0.5), cmax = Math.max(1, ...next.flatMap(x => hrs.map(h => x.hours[h]))), dmax = Math.max(1, ...next.map(x => Math.max(x.max, x.tot)));
  const r0f = v => Math.round(v);
  el.innerHTML = `<div id="fcwrap"><h2>Prévision du volume</h2>
    <p class="lead">Appels entrants attendus pour les 7 jours suivant la fin de l'historique, jour par jour et heure par heure, d'après les semaines précédentes et les jours fériés à venir${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. Pour planifier les horaires, utilisez ensuite l'onglet Effectif selon l'achalandage.</p>
    <div class="bar"><label class="count">Calculée sur</label><select id="fcw">${[4, 8, 12].map(v => `<option value="${v}"${W === v ? ' selected' : ''}>les ${v} dernières semaines</option>`).join('')}</select><span class="count">semaine du ${next[0].d} au ${next[6].d}</span></div>
    ${histDays < W * 7 ? `<div class="card" style="border-left:3px solid var(--warn);margin-bottom:12px;font-size:13px">L'historique du backup ne couvre que ${nf(histDays)} jours : la prévision s'appuie sur moins de semaines que demandé.</div>` : ''}
    <div class="grid kpis">${[['Appels attendus sur 7 jours', nf(r0f(fcWeek)), ''], ['Par rapport aux 7 derniers jours', prevWeek ? (fcWeek >= prevWeek ? '+' : '') + Math.round(100 * (fcWeek - prevWeek) / prevWeek) + ' %' : '–', ''], ['Jour le plus chargé', busiest ? `${FC_DAYS[busiest.wd]} ${busiest.d.slice(5)}` : '–', ''], ['Heure de pointe attendue', `${peakH} h`, ''], ['Tendance récente', (trend >= 1 ? '+' : '') + Math.round((trend - 1) * 100) + ' %', '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    <div class="card" style="margin-top:14px"><h3 style="margin-top:0">Appels attendus par jour</h3>
      ${next.map(x => `<div class="stbar"><span class="nm">${FC_DAYS[x.wd]} ${x.d.slice(5)}${x.hol ? ` <span class="pill warn" title="${esc(x.hol)}">férié</span>` : ''}</span><span class="t" style="position:relative"><span style="position:absolute;left:${100 * x.min / dmax}%;width:${100 * Math.max(0, x.max - x.min) / dmax}%;top:0;bottom:0;background:var(--accent);opacity:.18;border-radius:3px"></span><span style="position:relative;width:${100 * x.tot / dmax}%;background:var(--accent)"></span></span><span class="num">${nf(r0f(x.tot))} <span class="muted">${x.n ? `${nf(x.min)}–${nf(x.max)}` : ''}</span></span></div>`).join('')}
      <p class="note">Barre foncée : prévision. Bande claire : plus bas et plus haut volume du même jour de semaine dans les semaines utilisées.${next.some(x => x.hol) ? ` Jour férié : volume ramené à ${Math.round(holRatio * 100)} % d'un jour normal (${holRatios.length ? "moyenne des fériés de l'historique" : "valeur par défaut, aucun férié dans l'historique"}).` : ''}</p></div>
    <h3>Appels attendus par heure</h3>
    <div class="card" style="overflow:auto"><table class="fcgrid"><thead><tr><th></th>${hrs.map(h => `<th>${h} h</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
      ${next.map(x => `<tr><th>${FC_DAYS[x.wd].slice(0, 3)} ${x.d.slice(5)}</th>${hrs.map(h => { const v = x.hours[h]; return `<td style="background:color-mix(in srgb,var(--accent) ${Math.round(70 * v / cmax)}%,transparent)" title="${FC_DAYS[x.wd]} ${h} h : ${v.toFixed(1)} appel(s) attendu(s)">${v >= .5 ? r0f(v) : ''}</td>`; }).join('')}<td class="num"><b>${nf(r0f(x.tot))}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="note">Méthode : pour chaque jour de semaine et chaque heure, moyenne des ${W} dernières semaines, les plus récentes comptant davantage, puis correction par la tendance (4 dernières semaines contre les 4 précédentes, limitée à ±20 %). Les jours fériés passés sont exclus du calcul ; un férié à venir est réduit selon les fériés observés. C'est un ordre de grandeur : une promotion, une panne ou la météo peuvent changer le volume réel.</p></div>`;
  $('#fcw').addEventListener('change', e => { S.w = +e.target.value; try{ localStorage.setItem(PRV2_KEY, JSON.stringify(S)); }catch(er){} V.prevision(el); });
};

