// ---------- Coût des appels sortants (15.21) : tarifs saisis par destination, coût par magasin, poste, mois et numéro ----------
// tarifs gardés dans ce navigateur (clé couts3cx:<système>), inclus dans la Sauvegarde des réglages
const CST_KEY = 'couts3cx:' + (FULL.info.fqdn || '');
const CST_REGS = DST_REG.filter(([k]) => k !== 'incomplet');
const cstLoad = () => { let c = {}; try{ c = JSON.parse(localStorage.getItem(CST_KEY) || '{}'); }catch(e){} c.t ||= {}; c.inc ||= 60; c.p ||= '30'; return c; };
const cstSave = c => { try{ localStorage.setItem(CST_KEY, JSON.stringify(c)); }catch(e){} };
const cstNum = v => { const x = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')); return isFinite(x) ? x : 0; };
const money = v => (+v || 0).toLocaleString('fr-CA', {style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2});
V.couts = el => {
  const all = FULL.calls, C = cstLoad();
  if(!all.length){ el.innerHTML = '<h2>Coût des appels sortants</h2><p class="muted">Aucun appel dans ce backup.</p>'; return; }
  const last = localParts(all[0][0])[0], first = callHist().first;
  const [from, to] = perRange(C.p, first, last), days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
  const rate = k => cstNum((C.t[k] || {}).m), fee = k => cstNum((C.t[k] || {}).a);
  // durée facturée : à la seconde, par tranche de 6 s ou à la minute entamée
  const billed = s => s > 0 ? Math.ceil(s / C.inc) * C.inc : 0;
  const rows = [];
  for(const c of all){ if(c[1] !== 'out') continue; const lp = localParts(c[0]); if(lp[0] < from) break; if(lp[0] > to) continue; const s = callSeg(c); if(SEG && s !== SEG) continue;
    if(c[10] !== 'ans' || !(c[8] > 0)) continue; const [r] = dstOf(c[4]); if(r === 'incomplet') continue;
    const sec = billed(c[8]); rows.push({c, s, r, ext: c[2], m: lp[0].slice(0, 7), sec, cost: sec / 60 * rate(r) + fee(r)}); }
  const sum = (l, f) => l.reduce((a, x) => a + f(x), 0), tot = sum(rows, x => x.cost), mins = sum(rows, x => x.sec) / 60, perMonth = tot * 30.4 / days;
  const agg = key => { const m = {}; rows.forEach(x => { const k = key(x); const g = m[k] ||= {k, n: 0, sec: 0, cost: 0, intl: 0}; g.n++; g.sec += x.sec; g.cost += x.cost; if(x.r === 'intl') g.intl += x.cost; }); return Object.values(m); };
  const byR = Object.fromEntries(agg(x => x.r).map(g => [g.k, g])), bySeg = agg(x => x.s).sort((a, b) => b.cost - a.cost || b.sec - a.sec);
  const byExt = agg(x => x.ext).sort((a, b) => b.cost - a.cost || b.sec - a.sec), byM = agg(x => x.m).sort((a, b) => a.k < b.k ? -1 : 1);
  const byNum = agg(x => normNum(x.c[4]) || String(x.c[4])).sort((a, b) => b.cost - a.cost || b.sec - a.sec);
  const hasRates = CST_REGS.some(([k]) => rate(k) || fee(k)), mxM = Math.max(0.01, ...byM.map(g => hasRates ? g.cost : g.sec));
  const min = s => nf(Math.round(s / 60));
  el.innerHTML = `<div id="cstwrap"><h2>Coût des appels sortants</h2>
    <p class="lead">Estimation du coût des appels sortants d'après vos tarifs par destination : seuls les appels aboutis comptent, avec leur durée de conversation arrondie selon la facturation de votre opérateur${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}.</p>
    <div class="bar"><label class="count">Période</label>${perUI('cstp', C.p, first, last)}
      <label class="count">Facturation</label><select id="cstinc">${[[1, 'à la seconde'], [6, 'par tranche de 6 s'], [60, 'à la minute entamée']].map(([v, l]) => `<option value="${v}"${+C.inc === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <span class="count">du ${esc(from)} au ${esc(to)} (${nf(days)} jours)</span></div>
    <details class="card" id="csttar"${!hasRates || window.__cstOpen ? ' open' : ''}><summary><b>Vos tarifs</b> <span class="muted">${hasRates ? '(modifier)' : '— à saisir d\'après votre facture d\'opérateur'}</span></summary>
      <p class="muted" style="font-size:12.5px">Prix par minute et frais par appel, par destination (en dollars, taxes en sus). Laissez 0 pour une destination incluse dans votre forfait. Les tarifs restent dans ce navigateur et font partie de la Sauvegarde des réglages.</p>
      <div class="tw"><table><thead><tr><th>Destination</th><th class="num">$ par minute</th><th class="num">$ par appel</th><th class="num">Appels</th><th class="num">Minutes</th></tr></thead><tbody>
      ${CST_REGS.map(([k, l]) => `<tr><td><span class="sw" style="background:${DST_COL[k]}"></span>${esc(l)}</td>
        <td class="num"><input class="cstin" data-k="${k}" data-f="m" inputmode="decimal" value="${esc((C.t[k] || {}).m || '')}" placeholder="0,00" style="width:80px;text-align:right"></td>
        <td class="num"><input class="cstin" data-k="${k}" data-f="a" inputmode="decimal" value="${esc((C.t[k] || {}).a || '')}" placeholder="0,00" style="width:80px;text-align:right"></td>
        <td class="num">${nf(byR[k] ? byR[k].n : 0)}</td><td class="num">${byR[k] ? min(byR[k].sec) : '0'}</td></tr>`).join('')}</tbody></table></div></details>
    <div class="grid kpis">${[['Coût sur la période', hasRates ? money(tot) : '–', ''], ['Coût par mois (estimé)', hasRates ? money(perMonth) : '–', ''], ['Appels aboutis', nf(rows.length), ''], ['Minutes facturées', nf(Math.round(mins)), ''], ['Part de l\'international', hasRates && tot ? pct(byR.intl ? byR.intl.cost : 0, tot) : '–', '']]
      .map(([l, v, c]) => `<div class="card kpi ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
    ${hasRates ? '' : '<p class="muted">Saisissez vos tarifs ci-dessus pour obtenir les coûts ; en attendant, les minutes par destination, magasin et poste sont affichées.</p>'}
    <div class="grid two" style="margin-top:14px">
      <div class="card"><h3 style="margin-top:0">Par destination</h3>${CST_REGS.filter(([k]) => byR[k]).sort((a, b) => (hasRates ? byR[b[0]].cost - byR[a[0]].cost : byR[b[0]].sec - byR[a[0]].sec)).map(([k, l]) => { const g = byR[k], v = hasRates ? g.cost : g.sec, mx = Math.max(0.01, ...Object.values(byR).map(x => hasRates ? x.cost : x.sec));
        return `<div class="stbar"><span class="nm">${esc(l)}</span><span class="t"><span style="width:${100 * v / mx}%;background:${DST_COL[k]}"></span></span><span class="num">${hasRates ? money(g.cost) : min(g.sec) + ' min'}</span></div>`; }).join('') || '<p class="muted">Aucun appel sortant abouti sur la période.</p>'}</div>
      <div class="card"><h3 style="margin-top:0">Par mois</h3>${byM.map(g => `<div class="stbar"><span class="nm">${esc(g.k)}</span><span class="t"><span style="width:${100 * (hasRates ? g.cost : g.sec) / mxM}%;background:var(--accent)"></span></span><span class="num">${hasRates ? money(g.cost) : min(g.sec) + ' min'}</span></div>`).join('')}
        <p class="muted" style="font-size:12px">Le premier et le dernier mois peuvent être incomplets.</p></div></div>
    ${SEG ? '' : `<h3>Par magasin</h3><div class="tw"><table><thead><tr><th>Magasin</th><th class="num">Appels</th><th class="num">Minutes</th><th class="num">Coût</th><th class="num">Par mois</th><th class="num">dont international</th></tr></thead><tbody>
      ${bySeg.map(g => `<tr><td>${esc(segName(g.k))}</td><td class="num">${nf(g.n)}</td><td class="num">${min(g.sec)}</td><td class="num">${hasRates ? money(g.cost) : '–'}</td><td class="num">${hasRates ? money(g.cost * 30.4 / days) : '–'}</td><td class="num">${hasRates && g.intl ? money(g.intl) : '–'}</td></tr>`).join('')}</tbody></table></div>`}
    <h3>Par poste</h3><div id="cstt"></div>
    <h3>Numéros les plus coûteux</h3><div class="tw"><table><thead><tr><th>Numéro</th><th>Destination</th><th class="num">Appels</th><th class="num">Minutes</th><th class="num">Coût</th></tr></thead><tbody>
      ${byNum.slice(0, 15).map(g => { const r = dstOf(g.k)[0]; return `<tr><td class="mono">${esc(phone(g.k) || g.k)}</td><td><span class="sw" style="background:${DST_COL[r] || 'var(--line)'}"></span>${esc((DST_REG.find(x => x[0] === r) || [, r])[1])}</td><td class="num">${nf(g.n)}</td><td class="num">${min(g.sec)}</td><td class="num">${hasRates ? money(g.cost) : '–'}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="note">Estimation : seuls les appels sortants aboutis sont comptés, avec la durée de conversation de l'historique 3CX arrondie selon la facturation choisie, puis multipliée par le tarif de la destination (région d'après l'indicatif) et augmentée des frais par appel. Les renvois d'appels entrants vers des numéros externes, les forfaits mensuels, les SDA et les taxes ne sont pas inclus. Comparez avec votre facture d'opérateur pour ajuster les tarifs.</p></div>`;
  table($('#cstt'), {rows: byExt, pageSize: 25, sort: [hasRates ? 3 : 2, -1], state: (window.__cstT ||= {}),
    search: g => [g.k, dnName(g.k), segShort(SEGOF[g.k] || SEG_COMMON)].join(' '),
    cols: [{h: 'Poste', v: g => g.k, f: g => DN[g.k] ? dnLink(g.k) : esc(g.k)}, {h: 'Appels', num: 1, v: g => g.n, f: g => nf(g.n)}, {h: 'Minutes', num: 1, v: g => g.sec, f: g => min(g.sec)},
      {h: 'Coût', num: 1, v: g => g.cost, f: g => hasRates ? money(g.cost) : '–'}, {h: 'Par mois', num: 1, v: g => g.cost, f: g => hasRates ? money(g.cost * 30.4 / days) : '–'}, {h: 'dont international', num: 1, v: g => g.intl, f: g => hasRates && g.intl ? money(g.intl) : '–'}]});
  $('#cstt .bar').insertAdjacentHTML('beforeend', '<button class="btn" id="cstexp" style="margin-left:auto">Exporter (CSV)</button>');
  const re = () => { cstSave(C); V.couts(el); };
  $('#csttar').addEventListener('toggle', e => { window.__cstOpen = e.target.open; });
  perWire('cstp', C.p, first, last, v => { C.p = v; re(); });
  $('#cstinc').addEventListener('change', e => { C.inc = +e.target.value; re(); });
  el.querySelectorAll('.cstin').forEach(i => i.addEventListener('change', () => { const t = C.t[i.dataset.k] ||= {}; t[i.dataset.f] = i.value.trim(); re(); }));
  $('#cstexp').addEventListener('click', () => { const q = v => '"' + csvSafe(v) + '"', f2 = v => (+v || 0).toFixed(2).replace('.', ',');
    const out = [['Poste', 'Nom', 'Magasin', 'Appels', 'Minutes', 'Coût ($)', 'Par mois ($)', 'dont international ($)']].concat(byExt.map(g => [g.k, dnName(g.k), segShort(SEGOF[g.k] || SEG_COMMON), g.n, Math.round(g.sec / 60), f2(g.cost), f2(g.cost * 30.4 / days), f2(g.intl)]));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(r => r.map(q).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'})); a.download = 'couts-appels-sortants.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
};
