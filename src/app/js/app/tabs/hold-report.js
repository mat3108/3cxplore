// ---------- Rapport des mises en attente par employé (17.2.1) : appels mis en parking, perdus, quand et comment ----------
const ATT_KEY = 'attente3cx';
let ATT_CACHE = null;
// chaque mise en parking (hors appels vers un parking vide), reliée à son appel : client, temps de parole avant la mise en attente, rappels refusés, qui a repris
function attRows(){
  if(ATT_CACHE) return ATT_CACHE;
  const idx = new Map();
  FULL.calls.forEach(c => (Array.isArray(c[14]) ? c[14] : []).forEach((s, i) => { if(s[1] === 'shared_parking') idx.set(s[0] + '|' + Math.round(Date.parse(c[0]) / 1000 + s[2]), [c, i]); }));
  return ATT_CACHE = (FULL.parkCalls || []).filter(r => r[3] !== 'direct' && r[4]).map(r => {
    const t = Math.round(Date.parse(r[0]) / 1000); let m = null; for(const d of [0, -1, 1, -2, 2]){ m = idx.get(r[1] + '|' + (t + d)); if(m) break; }
    const [c, i] = m || [null, -1], S = c ? c[14] : [], p = S[i], lp = localParts(r[0]);
    const pv = c ? S.slice(0, i).reverse().find(s => s[1] === 'extension' && s[0] === r[4]) : null;
    const rej = c ? S.filter((s, j) => j > i && s[1] === 'extension' && s[0] === r[4] && s[7] === 'route_to' && s[5] === 'rejected' && s[2] >= p[2] && s[2] <= p[2] + p[3] + 2).length : 0;
    const by = c && r[3] !== 'hangup' ? (S.find((s, j) => j > i && s[4] >= 0 && s[1] !== 'shared_parking') || [])[0] || '' : '';
    return {t: r[0], d: lp[0], h: lp[1], wd: lp[2], ext: r[4], lost: r[3] === 'hangup', wait: r[2], cli: c && c[1] === 'in' ? c[2] : '', talk: pv && pv[4] >= 0 ? pv[3] - pv[4] : null, rej, by};
  });
}
// textes en français ou en anglais selon la langue de l'interface (phrases construites avec des nombres)
const attEN = () => document.documentElement.lang === 'en';
const attWD = () => attEN() ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] : ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const attMOM = () => attEN() ? [['Morning', '(before noon)'], ['Afternoon', '(noon to 5 pm)'], ['Evening', '(after 5 pm)']] : [['Matin', '(avant midi)'], ['Après-midi', '(12 h à 17 h)'], ['Soir', '(après 17 h)']];
const attMom = h => h < 12 ? 0 : h < 17 ? 1 : 2;
// couleur d'une case selon le % d'appels perdus (légende du tableau « Par jour et par moment »)
const attLvl = (l, n) => !n ? '' : l / n < .3 ? 'a0' : l / n < .45 ? 'a1' : l / n < .6 ? 'a2' : 'a3';
V.attente = (el, arg) => {
  const S = window.__att ||= (() => { try{ return JSON.parse(localStorage.getItem(ATT_KEY) || '{}'); }catch(e){ return {}; } })();
  if(arg){ const [x, p] = decodeURIComponent(arg).split('~'); S.ext = x; if(p) S.p = p; history.replaceState(null, '', '#attente'); }
  const en = attEN(), T = (fr, e) => en ? e : fr, loc = en ? 'en-CA' : 'fr-CA', WDN = attWD(), MOM = attMOM();
  const title = T('Rapport des mises en attente', 'Calls put on hold report');
  if(!FULL.parkCalls){ el.innerHTML = `<h2>${title}</h2><div class="card" style="border-left:3px solid var(--warn)">${T("Les mises en attente sont lues à l'ouverture du backup : <b>rouvrez le backup</b> (Fermer le backup, puis le choisir de nouveau) pour afficher ce rapport.", 'Calls put on hold are read when the backup is opened: <b>reopen the backup</b> (Close the backup, then choose it again) to show this report.')}</div>`; return; }
  const A = attRows(), cnt = {}; A.forEach(r => { if(!SEG || SEGOF[r.ext] === SEG) cnt[r.ext] = (cnt[r.ext] || 0) + 1; });
  if(S.ext && EXT_BY[S.ext] && !(S.ext in cnt) && (!SEG || SEGOF[S.ext] === SEG)) cnt[S.ext] = 0;
  const exts = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b, undefined, {numeric: true}));
  if(!exts.length){ el.innerHTML = `<h2>${title}</h2><p class="muted">${T('Aucun appel mis en attente', 'No call put on hold')}${SEG ? T(' dans ce magasin', ' in this store') : ''}.</p>`; return; }
  if(!(S.ext in cnt)) S.ext = exts[0];
  const E = EXT_BY[S.ext] || {number: S.ext, first: dnName(S.ext), last: ''}, nm = ((E.first || '') + ' ' + (E.last || '')).trim() || E.number;
  const days0 = A.map(r => r.d).sort(), first = days0[0], last = days0[days0.length - 1];
  S.p ||= 'all'; const [from, to] = perRange(S.p, first, last);
  const save = () => { try{ localStorage.setItem(ATT_KEY, JSON.stringify({ext: S.ext, p: S.p})); }catch(e){} V.attente(el); };
  const R = A.filter(r => r.ext === S.ext && r.d >= from && r.d <= to), lost = R.filter(r => r.lost);
  const pc = (a, b) => b ? Math.round(100 * a / b) + (en ? '%' : ' %') : '–', pn = (a, b) => b ? Math.round(100 * a / b) : 0, hh = h => en ? (h % 12 || 12) + (h < 12 ? ' am' : ' pm') : h + ' h';
  const dS = d => new Date(d + 'T12:00:00Z').toLocaleDateString(loc, {day: 'numeric', month: 'short', timeZone: 'UTC'});
  const dL = d => new Date(d + 'T12:00:00Z').toLocaleDateString(loc, {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
  const mins = s => Math.max(1, Math.round(s / 60)), sur = (l, n) => `${l} ${T('sur', 'of')} ${n}`;
  const head = `<div class="noprint"><h2>${title}</h2>
    <p class="lead">${T("Les appels qu'un employé met en attente (parking) : combien sont perdus parce que le client raccroche avant qu'on le reprenne, à quels moments de la semaine et comment ça se passe — pour une période au choix, à imprimer ou enregistrer en PDF", 'The calls an employee puts on hold (parking): how many are lost because the caller hangs up before being picked up, at what times of the week and how it happens — for any period, to print or save as PDF')}${SEG ? ` — ${T('magasin', 'store')} <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">${T('Employé', 'Employee')}</label><select id="attsel">${exts.map(n => `<option value="${esc(n)}"${n === S.ext ? ' selected' : ''}>${esc(n)} ${esc(dnName(n))} · ${nf(cnt[n])}</option>`).join('')}</select>
      <label class="count">${T('Période', 'Period')}</label>${perUI('attp', S.p, first, last)}<span style="flex:1"></span><a class="btn" href="#employe/${esc(S.ext)}">${T('Fiche employé', 'Employee sheet')}</a><button class="btn" id="attprint"${R.length ? '' : ' disabled'}>${T('Imprimer / PDF', 'Print / PDF')}</button><button class="btn" id="attxl"${R.length ? '' : ' disabled'}>${T('Exporter en Excel', 'Export to Excel')}</button></div></div>`;
  const wire = () => {
    $('#attsel').addEventListener('change', e => { S.ext = e.target.value; save(); });
    perWire('attp', S.p, first, last, v => { S.p = v; save(); });
  };
  if(!R.length){ el.innerHTML = `<div id="attwrap">${head}<div class="card">${T(`Aucun appel mis en attente par ce poste du ${esc(dL(from))} au ${esc(dL(to))}.`, `No call put on hold by this extension from ${esc(dL(from))} to ${esc(dL(to))}.`)}</div></div>`; wire(); return; }
  // ---- calculs ----
  const N = R.length, L = lost.length, clients = new Set(lost.map(r => r.cli).filter(Boolean)).size, lostWait = lost.reduce((s, r) => s + r.wait, 0);
  const known = R.filter(r => r.talk != null), imm = known.filter(r => r.talk < 5).length;
  const picked = R.filter(r => r.by), self = picked.filter(r => r.by === S.ext).length, rej = R.reduce((s, r) => s + r.rej, 0), quick = lost.filter(r => r.wait < 180).length;
  const longest = lost.slice().sort((a, b) => b.wait - a.wait)[0];
  const grp = key => { const o = {}; R.forEach(r => { const k = key(r), b = o[k] ||= {k, n: 0, l: 0}; b.n++; if(r.lost) b.l++; }); return Object.values(o).sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0); };
  const months = grp(r => r.d.slice(0, 7));
  const rF = R.reduce((x, r) => r.d < x ? r.d : x, R[0].d), rT = R.reduce((x, r) => r.d > x ? r.d : x, R[0].d);
  const mLab = m => { const nmn = new Date(m.k + '-15T12:00:00Z').toLocaleDateString(loc, {month: 'long', timeZone: 'UTC'});
    const startM = m.k + '-01', endM = addDaysISO(addDaysISO(m.k + '-28', 4).slice(0, 7) + '-01', -1), part = (rF > startM || rT < endM);
    const a = +((rF > startM ? rF : startM).slice(8)), b = +((rT < endM ? rT : endM).slice(8));
    return [nmn.charAt(0).toUpperCase() + nmn.slice(1), part ? T(`(${a} au ${b})`, `(${a} to ${b})`) : '']; };
  const monday = d => addDaysISO(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7)); // 18.2.27
  const weeks = grp(r => monday(r.d));
  const byWd = Array.from({length: 7}, () => ({n: 0, l: 0})), byH = Array.from({length: 24}, () => ({n: 0, l: 0}));
  R.forEach(r => { byWd[r.wd].n++; byH[r.h].n++; if(r.lost){ byWd[r.wd].l++; byH[r.h].l++; } });
  const wds = [0, 1, 2, 3, 4, 5, 6].filter(i => byWd[i].n);
  // heures montrées : celles qui regroupent au moins 1 % des mises en attente ; les autres sont comptées dans la première ou la dernière
  const hk = byH.map((x, h) => x.n >= Math.max(1, N * .01) ? h : -1).filter(h => h >= 0), h0 = Math.min(...hk), h1 = Math.max(...hk), clampH = h => Math.min(h1, Math.max(h0, h));
  const hrs = []; for(let h = h0; h <= h1; h++) hrs.push(h);
  const early = R.some(r => r.h < h0), late = R.some(r => r.h > h1);
  const grid = Array.from({length: 7}, () => hrs.map(() => ({n: 0, l: 0}))); R.forEach(r => { const c = grid[r.wd][clampH(r.h) - h0]; c.n++; if(r.lost) c.l++; });
  const hByH = hrs.map(h => R.filter(r => clampH(r.h) === h)).map(a => ({n: a.length, l: a.filter(r => r.lost).length}));
  const mxL = Math.max(1, ...grid.flat().map(c => c.l));
  const worst = []; wds.forEach(w => hrs.forEach((h, j) => { const c = grid[w][j]; if(c.l && c.n >= 3) worst.push({w, h, ...c}); }));
  worst.sort((a, b) => b.l - a.l || b.l / b.n - a.l / a.n);
  const mom = Array.from({length: 7}, () => [0, 1, 2].map(() => ({n: 0, l: 0}))); R.forEach(r => { const c = mom[r.wd][attMom(r.h)]; c.n++; if(r.lost) c.l++; });
  const momT = [0, 1, 2].map(i => wds.reduce((s, w) => ({n: s.n + mom[w][i].n, l: s.l + mom[w][i].l}), {n: 0, l: 0}));
  const dayRows = grp(r => r.d);
  const dMom = {}; R.forEach(r => { const c = (dMom[r.d] ||= [0, 1, 2].map(() => ({n: 0, l: 0})))[attMom(r.h)]; c.n++; if(r.lost) c.l++; });
  const wdOf = d => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7; // 18.2.27
  // ---- textes ----
  const rate = pn(L, N), bad = rate >= 30, wdl = w => en ? WDN[w] : WDN[w].toLowerCase(), at = (w, h) => T(`${WDN[w]} à ${h} h`, `${WDN[w]} at ${hh(h)}`);
  const mTxt = months.length >= 2 ? months.map(m => T(`${pc(m.l, m.n)} en ${mLab(m)[0].toLowerCase()}`, `${pc(m.l, m.n)} in ${mLab(m)[0]}`)) : [];
  const mF = months[0], mLst = months[months.length - 1], trend = months.length >= 2 && mF.n >= 10 && mLst.n >= 10 ? pn(mLst.l, mLst.n) - pn(mF.l, mF.n) : 0;
  const wdOk = wds.filter(w => byWd[w].n >= 10), wWorst = wdOk.slice().sort((a, b) => byWd[b].l / byWd[b].n - byWd[a].l / byWd[a].n)[0];
  const wBest = wdOk.filter(w => w < 5).sort((a, b) => byWd[a].l / byWd[a].n - byWd[b].l / byWd[b].n)[0];
  const hOk = hrs.filter((h, j) => hByH[j].n >= 10), hWorst = hOk.slice().sort((a, b) => hByH[b - h0].l / hByH[b - h0].n - hByH[a - h0].l / hByH[a - h0].n)[0];
  const top3 = worst.slice(0, 3).map(x => en ? at(x.w, x.h) : at(x.w, x.h).toLowerCase());
  const evOk = momT[2].n >= 5 && momT[2].l / momT[2].n < rate / 100 * .6;
  const brief = [T(`<b>${esc(nm)}</b> a mis <b>${nf(N)} appels</b> en attente.`, `<b>${esc(nm)}</b> put <b>${nf(N)} calls</b> on hold.`),
    T(`<b>${nf(L)} appels ont été perdus (${pc(L, N)})</b> : le client a raccroché avant qu'on lui réponde.`, `<b>${nf(L)} calls were lost (${pc(L, N)})</b>: the caller hung up before anyone answered.`),
    clients ? T(`Ça touche <b>${nf(clients)} clients différents</b>.`, `This affects <b>${nf(clients)} different callers</b>.`) : '',
    mTxt.length ? `<b>${trend >= 10 ? T('Ça empire', 'Getting worse') : trend <= -10 ? T("Ça s'améliore", 'Improving') : T('Selon le mois', 'By month')}${T(' :', ':')}</b> ${mTxt.join(', ')}.` : '',
    top3.length && L ? `<b>${T('Les pires moments :', 'Worst times:')}</b> ${top3.join(', ')}.${evOk ? T(' Les soirs vont bien.', ' Evenings are fine.') : ''}` : ''].filter(Boolean);
  const how = [known.length ? T(`${esc(nm)} met le client en attente <b>tout de suite</b>, sans lui parler, dans ${pc(imm, known.length)} des cas (moins de 5 secondes de conversation avant la mise en attente).`, `${esc(nm)} puts the caller on hold <b>right away</b>, without talking to them, in ${pc(imm, known.length)} of cases (less than 5 seconds of conversation before the hold).`) : '',
    picked.length ? T(`Quand le client est repris, c'est par ce même poste ${nf(self)} fois sur ${nf(picked.length)}${picked.length - self ? ` ; un collègue l'a repris ${nf(picked.length - self)} fois` : ''}.`, `When the caller is picked up, it is by the same extension ${nf(self)} times out of ${nf(picked.length)}${picked.length - self ? `; a colleague picked up ${nf(picked.length - self)} times` : ''}.`) : '',
    rej ? T(`Le téléphone sonne pour rappeler qu'un client attend. Ces rappels ont été <b>refusés ${nf(rej)} fois</b>.`, `The phone rings to remind that a caller is waiting. These reminders were <b>declined ${nf(rej)} times</b>.`) : '',
    L ? T(`${nf(quick)} des ${nf(L)} appels perdus ont raccroché en moins de 3 minutes.`, `${nf(quick)} of the ${nf(L)} lost calls hung up in less than 3 minutes.`) : '',
    longest ? T(`Le plus long : un client a attendu <b>${nf(mins(longest.wait))} minutes</b> le ${esc(dL(longest.d))} avant d'abandonner.`, `The longest: a caller waited <b>${nf(mins(longest.wait))} minutes</b> on ${esc(dL(longest.d))} before giving up.`) : ''].filter(Boolean);
  const obs = [wWorst != null ? T(`Le pire jour est le ${wdl(wWorst)} : ${pc(byWd[wWorst].l, byWd[wWorst].n)} des appels mis en attente sont perdus.`, `The worst day is ${wdl(wWorst)}: ${pc(byWd[wWorst].l, byWd[wWorst].n)} of calls put on hold are lost.`) : '',
    wBest != null && wBest !== wWorst ? T(`Le meilleur jour de semaine est le ${wdl(wBest)} (${pc(byWd[wBest].l, byWd[wBest].n)}).`, `The best weekday is ${wdl(wBest)} (${pc(byWd[wBest].l, byWd[wBest].n)}).`) : '',
    hWorst != null ? T(`L'heure la plus difficile est ${hh(hWorst)} (${pc(hByH[hWorst - h0].l, hByH[hWorst - h0].n)} perdus).`, `The hardest hour is ${hh(hWorst)} (${pc(hByH[hWorst - h0].l, hByH[hWorst - h0].n)} lost).`) : '',
    momT[2].n >= 5 ? (evOk ? T(`Les soirs (après 17 h) vont bien : ${pc(momT[2].l, momT[2].n)} perdus.`, `Evenings (after 5 pm) are fine: ${pc(momT[2].l, momT[2].n)} lost.`) : T(`Les soirs (après 17 h) : ${pc(momT[2].l, momT[2].n)} perdus.`, `Evenings (after 5 pm): ${pc(momT[2].l, momT[2].n)} lost.`)) : ''].filter(Boolean);
  // ---- graphiques (HTML, imprimables) ----
  const vbars = (items, opt) => { const mx = Math.max(1, ...items.map(x => x.v)); return `<div class="attvb${opt && opt.small ? ' sm' : ''}">${items.map(x => `<div><b>${x.t}</b><i style="height:calc((100% - 18px) * ${(Math.max(x.v ? .02 : 0, x.v / mx)).toFixed(3)})" class="${x.hot ? 'hot' : ''}"></i><span>${x.lab}</span></div>`).join('')}</div>`; };
  const hotM = months.reduce((a, m) => !a || m.l / m.n > a.l / a.n ? m : a, null), hotW = wds.reduce((a, w) => a == null || byWd[w].l / byWd[w].n > byWd[a].l / byWd[a].n ? w : a, null);
  const hotH = hrs.reduce((a, h, j) => a == null || (hByH[j].n && hByH[j].l / hByH[j].n > hByH[a - h0].l / (hByH[a - h0].n || 1)) ? h : a, null);
  const wkMx = Math.max(1, ...weeks.map(w => w.n)), wkStep = Math.ceil(weeks.length / 12);
  const wkChart = `<div class="attwk">${weeks.map((w, i) => `<div title="${esc(dS(w.k))} : ${sur(w.l, w.n)}">${weeks.length <= 16 ? `<b>${w.l}/${w.n}</b>` : ''}<i style="height:calc((100% - 16px) * ${(w.n / wkMx).toFixed(3)})"><u style="height:${w.n ? 100 * w.l / w.n : 0}%"></u></i>${i % wkStep ? '' : `<span>${esc(dS(w.k))}</span>`}</div>`).join('')}</div>
    <div class="attleg"><span><i style="background:#cbd5e1"></i>${T('Mis en attente', 'Put on hold')}</span><span><i style="background:#b91c1c"></i>${T('Perdus', 'Lost')}</span><span class="muted">${T('Semaine du', 'Week of')}</span></div>`;
  const wkWorst = weeks.slice().sort((a, b) => b.l - a.l)[0], dWorst = dayRows.slice().sort((a, b) => b.l - a.l)[0];
  const heat = `<table class="attheat"><tbody>${wds.map(w => `<tr><th>${WDN[w]}</th>${hrs.map((h, j) => { const c = grid[w][j], a = c.l / mxL;
      return c.n ? `<td style="background:${c.l ? `rgba(185,28,28,${(.1 + .9 * a).toFixed(2)})` : '#fff'};color:${a > .5 ? '#fff' : 'inherit'}" title="${at(w, h)} : ${sur(c.l, c.n)}"><b>${c.l}</b><small>${T('sur', 'of')} ${c.n}</small></td>` : '<td class="muted">–</td>'; }).join('')}</tr>`).join('')}
    <tr><th></th>${hrs.map(h => `<th class="h">${hh(h)}</th>`).join('')}</tr></tbody></table>`;
  const cellM = c => c.n ? `<td class="${attLvl(c.l, c.n)}"><b>${pc(c.l, c.n)} ${T('perdus', 'lost')}</b><small>${sur(c.l, c.n)}</small></td>` : '<td class="muted">—</td>';
  const cellD = c => c && c.n ? sur(c.l, c.n) : '—';
  const sub = T(`du ${esc(dL(from))} au ${esc(dL(to))}`, `from ${esc(dL(from))} to ${esc(dL(to))}`);
  el.innerHTML = `<div id="attwrap">${head}
    <div class="report attrep" id="attsheet"><header class="rpcover"><div class="rpk">${title} · 3CXplore</div><h1>${esc(nm)} <span class="muted mono" style="font-size:.6em">${esc(E.number)}</span></h1>
      <div class="attsub">${T('Appels mis en attente (parking)', 'Calls put on hold (parking)')}</div>
      <div class="rpmeta">${esc(segName(SEGOF[E.number] || SEG_COMMON))} · ${sub} · ${T('préparé le', 'prepared on')} ${esc(new Date().toLocaleDateString(loc))}</div></header>
    <div class="attbrief${bad ? ' bad' : ''}"><h3>${T('En bref', 'In short')}</h3>${brief.map(t => `<p>${t}</p>`).join('')}</div>
    <div class="attkpi"><div><span>${T('Appels mis en attente', 'Calls put on hold')}</span><b>${nf(N)}</b></div><div><span>${T('Appels perdus', 'Lost calls')}</span><b>${nf(L)} (${pc(L, N)})</b></div><div><span>${T('Clients différents', 'Different callers')}</span><b>${nf(clients)}</b></div><div><span>${T('Attente totale perdue', 'Total time lost waiting')}</span><b>≈ ${lostWait >= 3600 ? `${nf(Math.round(lostWait / 3600))} h` : `${nf(mins(lostWait))} min`}</b></div></div>
    <section class="rps"><h2>${T('Comment ça se passe', 'How it happens')}</h2><ul class="attul">${how.map(t => `<li>${t}</li>`).join('')}</ul></section>
    ${months.length >= 2 ? `<section class="rps attkeep"><h2>${T('Mois par mois', 'Month by month')}</h2><p class="muted">${T('% des appels mis en attente qui ont été perdus', '% of calls put on hold that were lost')}</p>${vbars(months.map(m => ({v: pn(m.l, m.n), t: pc(m.l, m.n), lab: mLab(m).filter(Boolean).join('<br>'), hot: m === hotM && trend >= 10})))}</section>` : ''}
    <section class="rps attkeep"><h2>${T('Semaine par semaine', 'Week by week')}</h2>${wkChart}
      ${wkWorst && wkWorst.l ? `<p>${T(`La partie rouge montre les appels perdus. La pire semaine est celle du ${esc(dS(wkWorst.k))} : ${nf(wkWorst.l)} appels perdus sur ${nf(wkWorst.n)}`, `The red part shows lost calls. The worst week is the week of ${esc(dS(wkWorst.k))}: ${nf(wkWorst.l)} lost calls out of ${nf(wkWorst.n)}`)}${dWorst && dWorst.l >= 5 ? T(` ; la pire journée est le ${esc(dL(dWorst.k))} (${nf(dWorst.l)} perdus sur ${nf(dWorst.n)})`, `; the worst day is ${esc(dL(dWorst.k))} (${nf(dWorst.l)} lost out of ${nf(dWorst.n)})`) : ''}.</p>` : ''}</section>
    <section class="rps attkeep"><h2>${T("% des appels perdus selon le jour et l'heure", '% of lost calls by day and hour')}</h2><div class="att2"><div><h3>${T('Selon le jour', 'By day')}</h3>${vbars(wds.map(w => ({v: pn(byWd[w].l, byWd[w].n), t: pc(byWd[w].l, byWd[w].n), lab: WDN[w].slice(0, 3), hot: w === hotW})))}</div>
      <div><h3>${T("Selon l'heure", 'By hour')}</h3>${vbars(hrs.map((h, j) => ({v: pn(hByH[j].l, hByH[j].n), t: hByH[j].n ? pn(hByH[j].l, hByH[j].n) : '', lab: en ? h % 12 || 12 : h, hot: h === hotH})), {small: true})}</div></div></section>
    <section class="rps attkeep attbrk"><h2>${T('Les pires moments de la semaine', 'The worst times of the week')}</h2><p>${T("En comparant ces moments avec les horaires, on peut voir si le problème vient d'un moment de la journée ou d'un horaire en particulier.", 'Comparing these times with the schedules shows whether the problem comes from a time of day or from a particular schedule.')}${(EXT_BY[E.number] || {}).first ? '' : T(' Si plusieurs personnes utilisent ce poste, le système ne sait pas qui y était assis.', ' If several people use this extension, the system does not know who was at the phone.')}</p>
      <h3>${T("Nombre d'appels perdus, par jour et par heure", 'Number of lost calls, by day and hour')}</h3><div class="attsc">${heat}</div>
      <p class="rpnote">${T("Gros chiffre = appels perdus. Petit chiffre = appels mis en attente à ce moment-là. Plus la case est foncée, plus il y a d'appels perdus.", 'Large number = lost calls. Small number = calls put on hold at that time. The darker the cell, the more calls were lost.')}${early ? T(` Les appels avant ${h0} h sont comptés dans ${h0} h.`, ` Calls before ${hh(h0)} are counted in ${hh(h0)}.`) : ''}${late ? T(` Les appels après ${h1} h sont comptés dans ${h1} h.`, ` Calls after ${hh(h1)} are counted in ${hh(h1)}.`) : ''}</p>
      ${worst.length ? `<h3>${T(`Les ${Math.min(6, worst.length)} pires moments`, `The ${Math.min(6, worst.length)} worst times`)}</h3><ul class="attul">${worst.slice(0, 6).map(x => `<li><b>${at(x.w, x.h)}</b>${T(' :', ':')} ${T(`${nf(x.l)} appels perdus sur ${nf(x.n)}`, `${nf(x.l)} lost calls out of ${nf(x.n)}`)}</li>`).join('')}</ul>` : ''}</section>
    <section class="rps attkeep attbrk"><h2>${T('Par jour et par moment de la journée', 'By day and time of day')}</h2><p>${T("Ce tableau peut être comparé directement avec l'horaire de l'employé.", "This table can be compared directly with the employee's schedule.")}</p>
      <div class="attsc"><table class="attmom"><thead><tr><th>${T('Jour', 'Day')}</th>${MOM.map(([a, b]) => `<th>${a}<br><small>${b}</small></th>`).join('')}</tr></thead><tbody>${wds.map(w => `<tr><th>${WDN[w]}</th>${mom[w].map(cellM).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="attleg"><span><i class="a0"></i>${T('Moins de 30 %', 'Under 30%')}</span><span><i class="a1"></i>${T('30 à 44 %', '30 to 44%')}</span><span><i class="a2"></i>${T('45 à 59 %', '45 to 59%')}</span><span><i class="a3"></i>${T('60 % et plus', '60% and over')}</span></div>
      ${obs.length ? `<h3>${T("Ce qu'on remarque", 'What stands out')}</h3><ul class="attul">${obs.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}</section>
    <section class="rps attbrk"><h2>${T('Annexe — Détail par journée', 'Appendix — Day by day')}</h2><p class="rpnote">${T("Chaque case montre les appels perdus sur les appels mis en attente. Les journées en rouge ont 50 % ou plus d'appels perdus.", 'Each cell shows lost calls out of calls put on hold. Days in red have 50% or more lost calls.')}</p>
      <table class="rpt attday"><thead><tr><th>Date</th><th>${T('Jour', 'Day')}</th>${MOM.map(([a]) => `<th class="num">${a}</th>`).join('')}<th class="num">${T('Total perdus', 'Total lost')}</th><th class="num">%</th></tr></thead><tbody>
      ${dayRows.map(x => `<tr${x.n >= 2 && x.l / x.n >= .5 ? ' class="hot"' : ''}><td class="nw">${esc(dS(x.k))}</td><td>${WDN[wdOf(x.k)].slice(0, 3)}</td>${dMom[x.k].map(c => `<td class="num nw">${cellD(c)}</td>`).join('')}<td class="num nw">${sur(x.l, x.n)}</td><td class="num">${pc(x.l, x.n)}</td></tr>`).join('')}</tbody></table></section>
    <div class="rpfoot">${esc(nm)} (${esc(E.number)}) — ${T('Appels mis en attente', 'Calls put on hold')} — ${sub}. ${T("Un appel perdu : le client a raccroché pendant qu'il était en attente, avant d'être repris.", 'A lost call: the caller hung up while on hold, before being picked up.')}</div>
    </div></div>`;
  wire();
  $('#attprint').addEventListener('click', () => printHTML($('#attsheet').outerHTML.replace('id="attsheet"', '')));
  $('#attxl').addEventListener('click', () => {
    const sh = [{name: T('Résumé', 'Summary'), rows: [[T('Rubrique', 'Item'), T('Valeur', 'Value')], [T('Poste', 'Extension'), E.number], [T('Nom', 'Name'), nm], [T('Période', 'Period'), `${from} → ${to}`], [T('Appels mis en attente', 'Calls put on hold'), N], [T('Appels perdus', 'Lost calls'), L], [T('% perdus', '% lost'), pc(L, N)], [T('Clients différents', 'Different callers'), clients],
        [T('Attente totale perdue (min)', 'Total time lost waiting (min)'), Math.round(lostWait / 60)], [T('Mis en attente sans parler (< 5 s)', 'Put on hold without talking (< 5 s)'), known.length ? pc(imm, known.length) : ''], [T('Repris par le même poste', 'Picked up by the same extension'), `${self} / ${picked.length}`], [T('Rappels refusés', 'Reminders declined'), rej], [T('Perdus en moins de 3 minutes', 'Lost in less than 3 minutes'), quick]]},
      {name: T('Par jour', 'By day'), rows: [['Date', T('Jour', 'Day'), ...MOM.map(([a]) => a + T(' (perdus / mis en attente)', ' (lost / on hold)')), T('Perdus', 'Lost'), T('Mis en attente', 'Put on hold'), T('% perdus', '% lost')]].concat(dayRows.map(x => [x.k, WDN[wdOf(x.k)], ...dMom[x.k].map(c => c.n ? `${c.l} / ${c.n}` : ''), x.l, x.n, pc(x.l, x.n)]))},
      {name: T('Jour et heure', 'Day and hour'), rows: [[T('Jour', 'Day'), ...hrs.map(hh)]].concat(wds.map(w => [WDN[w], ...grid[w].map(c => c.n ? `${c.l} / ${c.n}` : '')]))},
      {name: T('Mises en attente', 'Calls on hold'), rows: [['Date', T('Heure', 'Hour'), T('Attente (s)', 'Wait (s)'), T('Issue', 'Outcome'), T('Repris par', 'Picked up by'), T('Conversation avant (s)', 'Talk before (s)'), T('Rappels refusés', 'Reminders declined')]].concat(R.slice().sort((a, b) => a.t < b.t ? -1 : 1).map(r => [r.d, hh(r.h), r.wait, r.lost ? T('Perdu (raccroché)', 'Lost (hung up)') : r.by ? T('Repris', 'Picked up') : T('Autre', 'Other'), r.by ? `${r.by} ${dnName(r.by)}` : '', r.talk ?? '', r.rej]))}];
    const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build(sh).blob); a.download = `${T('mises-en-attente', 'on-hold')}-${E.number}-${from}-${to}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
};
