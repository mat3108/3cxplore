// ---------- Qualité des appels (rapports de qualité 3CX) ----------
const QV = {good: ['Bonne', 'ok'], fair: ['Moyenne', 'warn'], bad: ['Mauvaise', 'bad']};
const qModel = ua => { ua = String(ua || ''); let m;
  if((m = ua.match(/^Yealink\s+(?:SIP-)?(\S+)/i))) return 'Yealink ' + m[1];
  if((m = ua.match(/^(Fanvil|Grandstream|Snom|Polycom|Poly|Cisco)\s+(\S+)/i))) return m[1] + ' ' + m[2];
  if((m = ua.match(/3CX\s*Phone for (\w+)/i)) || (m = ua.match(/3CX.*\b(iOS|Android|Windows|Mac)\b/i))) return 'Application 3CX ' + m[1];
  if(/web|chrome|mozilla|safari|edge/i.test(ua)) return 'Client Web 3CX';
  return ua ? ua.split(/\s+/).slice(0, 2).join(' ') : 'Inconnu'; };
const QEXT = new Set(FULL.extensions.map(e => e.number));
function qualityRows(){
  return (FULL.quality || []).map(q => {
    const L = q.legs, ext = L.filter(l => QEXT.has(l.num)), other = L.find(l => !QEXT.has(l.num));
    const mosV = L.flatMap(l => [l.mosTo, l.mosFrom]).filter(v => v > 0), mos = mosV.length ? Math.min(...mosV) : null;
    const loss = Math.max(0, ...L.map(l => l.loss || 0)), jit = Math.max(0, ...L.map(l => l.jit || 0));
    const rttV = L.map(l => l.rtt).filter(v => v > 0 && v < 10000), rtt = rttV.length ? Math.max(...rttV) : null;
    const v = (mos != null && mos < 3.6) || loss > 3 || jit > 50 || (rtt != null && rtt > 500) ? 'bad' : (mos != null && mos < 4) || loss > 1 || jit > 20 || (rtt != null && rtt > 300) ? 'fair' : 'good';
    const why = [mos != null && mos < 4 && `note ${String(mos).replace('.', ',')}`, loss > 1 && `perte ${String(loss).replace('.', ',')} %`, jit > 20 && `gigue ${Math.round(jit)} ms`, rtt != null && rtt > 300 && `délai ${Math.round(rtt)} ms`].filter(Boolean);
    const e0 = ext[0] || null;
    return {q, t: q.t, ext: ext.map(l => l.num), e0, other, mos, loss, jit, rtt, v, why,
      seg: e0 ? SEGOF[e0.num] || SEG_COMMON : SEG_COMMON, model: e0 ? qModel(e0.ua) : '—',
      site: e0 ? (e0.pub || 'Réseau du serveur (sans tunnel)') : '—', trunk: other && !QEXT.has(other.num) && !/^\+?\d{7,}$/.test(other.name || '') ? other.name || '—' : '—',
      remote: other ? other.num : ''};
  }).sort((a, b) => a.t < b.t ? 1 : -1);
}
const Q_NOTE = `<div class="card" style="border-left:3px solid var(--accent);font-size:13px"><b>À savoir :</b> cette section ne contient des données que si la <b>surveillance de la qualité des appels</b> (Call Quality) est activée dans la console d'administration 3CX. Sans cette option, 3CX n'enregistre aucune mesure (MOS, perte de paquets, gigue, délai) et la section reste vide. Une fois l'option activée, seuls les appels passés ensuite sont mesurés : les données apparaissent au backup suivant.</div>`;
V.qualite = el => {
  if(!Array.isArray(FULL.quality)){ el.innerHTML = '<h2>Qualité des appels</h2><p class="lead">Les mesures de qualité sont lues depuis la version 6.3 : rechargez le backup (.zip) depuis le tableau de bord pour les afficher.</p>'; return; }
  const all = qualityRows(), rows = all.filter(r => !SEG || r.seg === SEG);
  if(!all.length){ el.innerHTML = `<h2>Qualité des appels</h2><div class="card" style="border-left:3px solid var(--warn)"><b>Aucune mesure de qualité dans ce backup.</b> C'est presque toujours parce que la <b>surveillance de la qualité des appels</b> (Call Quality) n'est pas activée dans la console d'administration 3CX : sans elle, 3CX n'enregistre ni la note MOS, ni la perte de paquets, ni la gigue, ni le délai. Activez-la, puis chargez un backup pris quelques jours plus tard : seuls les appels passés après l'activation sont mesurés.</div>`; return; }
  const n = k => rows.filter(r => r.v === k).length, avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const fx = (v, d = 2) => v == null ? '–' : String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
  const group = key => { const g = {}; rows.forEach(r => { const k = key(r); if(!k || k === '—') return; const b = g[k] ||= {k, n: 0, good: 0, fair: 0, bad: 0, mos: [], loss: 0, jit: [], rtt: [], segs: {}};
      b.n++; b[r.v]++; if(r.mos != null) b.mos.push(r.mos); b.loss = Math.max(b.loss, r.loss); b.jit.push(r.jit); if(r.rtt != null) b.rtt.push(r.rtt); b.segs[r.seg] = (b.segs[r.seg] || 0) + 1; });
    return Object.values(g).sort((a, b) => (b.bad + b.fair) / b.n - (a.bad + a.fair) / a.n || b.n - a.n); };
  const gTable = (title, key, label, note) => { const G = group(key); if(!G.length) return '';
    return `<h3>${esc(title)}</h3><div class="tw"><table><thead><tr><th>${esc(label)}</th><th class="num">Appels mesurés</th><th>Qualité</th><th class="num">Note moy.</th><th class="num">Note min.</th><th class="num">Perte max.</th><th class="num">Gigue moy.</th><th class="num">Délai moy.</th></tr></thead><tbody>
      ${G.map(b => { const bad = b.bad + b.fair, top = Object.entries(b.segs).sort((x, y) => y[1] - x[1])[0];
        return `<tr><td><b>${esc(b.k)}</b>${note && top ? ` <span class="muted" style="font-size:12px">${esc(segShort(top[0]))}</span>` : ''}</td><td class="num">${nf(b.n)}</td>
        <td><div class="qbar" title="${b.good} bonne(s), ${b.fair} moyenne(s), ${b.bad} mauvaise(s)"><span class="g" style="width:${100 * b.good / b.n}%"></span><span class="f" style="width:${100 * b.fair / b.n}%"></span><span class="b" style="width:${100 * b.bad / b.n}%"></span></div>
          <span class="muted" style="font-size:12px">${bad ? `${pct(bad, b.n)} à surveiller` : 'toutes bonnes'}</span></td>
        <td class="num">${fx(avg(b.mos))}</td><td class="num">${b.mos.length ? `<span class="pill ${Math.min(...b.mos) < 3.6 ? 'bad' : Math.min(...b.mos) < 4 ? 'warn' : ''}">${fx(Math.min(...b.mos))}</span>` : '–'}</td>
        <td class="num">${b.loss > 1 ? `<span class="pill ${b.loss > 3 ? 'bad' : 'warn'}">${fx(b.loss)} %</span>` : fx(b.loss) + ' %'}</td><td class="num">${fx(avg(b.jit), 1)} ms</td><td class="num">${b.rtt.length ? Math.round(avg(b.rtt)) + ' ms' : '–'}</td></tr>`; }).join('')}</tbody></table></div>`; };
  const watch = [['magasin', r => segShort(r.seg)], ['site', r => r.site], ['modèle', r => r.model], ['trunk', r => r.trunk]].flatMap(([lbl, key]) =>
    group(key).filter(b => b.n >= 3 && (b.bad + b.fair) / b.n >= 0.3).map(b => ({lbl, b})));
  const first = all[all.length - 1].t, last = all[0].t;
  // mesures concentrées sur quelques postes : les résultats ne représentent pas tout le système
  const byExt = {}; all.forEach(r => r.ext.forEach(x => byExt[x] = (byExt[x] || 0) + 1));
  const topExt = Object.entries(byExt).sort((a, b) => b[1] - a[1])[0], conc = topExt && topExt[1] / all.length >= 0.6;
  el.innerHTML = `<div id="qwrap"><h2>Qualité des appels</h2>
    <p class="lead">Mesures de qualité de la voix enregistrées par 3CX : note de qualité (MOS, de 1 à 4,5), perte de paquets, gigue et délai aller-retour, par magasin, par site (adresse Internet du tunnel ou du SBC), par modèle de téléphone et par trunk${SEG ? ` — magasin <b>${esc(segName(SEG))}</b>` : ''}. 3CX ne mesure qu'une partie des appels : ${nf(all.length)} rapports du ${dayKey(first)} au ${dayKey(last)}.</p>
    ${Q_NOTE}
    <div class="grid kpis">${[['Appels mesurés', nf(rows.length), ''], ['Bonne qualité', `${nf(n('good'))} (${pct(n('good'), rows.length)})`, 'ok'], ['Moyenne', nf(n('fair')), n('fair') ? 'warn' : ''], ['Mauvaise', nf(n('bad')), n('bad') ? 'bad' : ''],
      ['Note moyenne (MOS)', fx(avg(rows.filter(r => r.mos != null).map(r => r.mos))), ''], ['Note la plus basse', fx(rows.filter(r => r.mos != null).reduce((a, r) => Math.min(a, r.mos), 9) === 9 ? null : rows.filter(r => r.mos != null).reduce((a, r) => Math.min(a, r.mos), 9)), '']]
      .map(([l, v, c]) => `<div class="card kpi ph ${c}"><div class="v" style="font-size:21px">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    ${conc ? `<div class="card" style="margin-top:12px"><span class="pill warn">Mesures peu représentatives</span> ${pct(topExt[1], all.length)} des rapports de qualité concernent un seul poste (${dnLink(topExt[0])}). 3CX n'a enregistré de mesures que pour quelques postes : les résultats ci-dessous ne reflètent pas la qualité de tous les magasins.</div>` : ''}
    ${watch.length ? `<div class="card" style="margin-top:12px"><h3 style="margin-top:0">À surveiller</h3>${watch.map(({lbl, b}) => `<div style="margin:6px 0"><span class="pill warn">${esc(lbl)}</span> <b>${esc(b.k)}</b> : ${pct(b.bad + b.fair, b.n)} des ${b.n} appels mesurés de qualité moyenne ou mauvaise${b.mos.length ? ` (note min. ${fx(Math.min(...b.mos))})` : ''}${b.loss > 1 ? `, perte jusqu'à ${fx(b.loss)} %` : ''}.</div>`).join('')}</div>`
      : `<div class="card" style="margin-top:12px"><span class="pill ok">Aucun groupe à surveiller</span> <span class="muted">Aucun magasin, site, modèle ou trunk n'a 30 % ou plus d'appels mesurés de qualité moyenne ou mauvaise (sur au moins 3 appels).</span></div>`}
    ${SEG ? '' : gTable('Par magasin', r => segShort(r.seg), 'Magasin')}
    ${gTable('Par site', r => r.site, 'Site (adresse Internet)', true)}
    ${gTable('Par modèle de téléphone', r => r.model, 'Modèle')}
    ${gTable('Par trunk', r => r.trunk, 'Trunk')}
    <h3>Appels mesurés (${nf(rows.length)})</h3><div id="qt"></div>
    <p class="note">Bonne : note ≥ 4, perte ≤ 1 %, gigue ≤ 20 ms et délai ≤ 300 ms. Mauvaise : note &lt; 3,6, perte &gt; 3 %, gigue &gt; 50 ms ou délai &gt; 500 ms. Moyenne : entre les deux. Une perte ou une gigue élevée vient en général du réseau du site (Internet, Wi-Fi, cellulaire pour l'application) ; une mauvaise note sur un seul modèle peut venir du codec ou du firmware.</p></div>`;
  table($('#qt'), {rows, pageSize: 50, state: (window.__qTable ||= {}),
    search: r => [r.ext.join(' '), r.ext.map(x => dnName(x)).join(' '), r.remote, segShort(r.seg), r.model, r.site, r.trunk, QV[r.v][0]].join(' '),
    filters: [{label: 'Toutes qualités', options: Object.entries(QV).map(([k, v]) => [k, v[0]]), test: (r, v) => r.v === v},
              {label: 'Tous les modèles', options: [...new Set(rows.map(r => r.model))].sort().map(x => [x, x]), test: (r, v) => r.model === v},
              {label: 'Tous les sites', options: [...new Set(rows.map(r => r.site))].sort().map(x => [x, x]), test: (r, v) => r.site === v}],
    cols: [{h: 'Date', v: r => r.t, f: r => fmtD(r.t)}, {h: 'Poste', v: r => r.ext.join(' '), f: r => r.ext.map(x => dnLink(x)).join('<br>') || '<span class="muted">—</span>'},
      {h: 'Autre partie', v: r => r.remote, f: r => r.other ? (QEXT.has(r.other.num) ? dnLink(r.other.num) : `<span class="mono">${esc(phone(r.other.num))}</span>`) : '—'},
      {h: 'Modèle', v: r => r.model, cls: 'muted'}, {h: 'Site', v: r => r.site, cls: 'mono muted'},
      {h: 'Note', num: 1, v: r => r.mos ?? 9, f: r => fx(r.mos)}, {h: 'Perte', num: 1, v: r => r.loss, f: r => fx(r.loss) + ' %'}, {h: 'Gigue', num: 1, v: r => r.jit, f: r => fx(r.jit, 1) + ' ms'},
      {h: 'Délai', num: 1, v: r => r.rtt ?? 0, f: r => r.rtt != null ? Math.round(r.rtt) + ' ms' : '–'},
      {h: 'Qualité', v: r => ({bad: 0, fair: 1, good: 2})[r.v], f: r => `<span class="pill ${QV[r.v][1]}">${QV[r.v][0]}</span>${r.why.length ? `<div class="muted" style="font-size:11.5px">${esc(r.why.join(', '))}</div>` : ''}`}],
    onRow: r => openDrawer('Qualité · ' + esc(fmtD(r.t)), kv([['Qualité', `<span class="pill ${QV[r.v][1]}">${QV[r.v][0]}</span> ${esc(r.why.join(', '))}`], ['Magasin', esc(segName(r.seg))], ['Durée', dur(Math.max(...r.q.legs.map(l => l.dur || 0)))], ['Transcodage', r.q.tc ? 'oui' : 'non']]) +
      `<h3>Les deux côtés de l'appel</h3><div class="tw"><table><thead><tr><th></th>${r.q.legs.map((l, i) => `<th>${i ? 'Côté B' : 'Côté A'}${l.caller ? ' (appelant)' : ''}</th>`).join('')}</tr></thead><tbody>
      ${[['Numéro', l => QEXT.has(l.num) ? dnLink(l.num) : esc(phone(l.num))], ['Nom', l => esc(l.name)], ['Appareil', l => esc(l.ua || '—')], ['Adresse locale', l => `<span class="mono">${esc(l.addr || '—')}</span>`],
         ['Tunnel / SBC', l => `<span class="mono">${esc(l.pub || '—')}</span>`], ['Codec', l => esc(l.codec || '—')], ['Note vers le serveur', l => fx(l.mosTo)], ['Note depuis le serveur', l => fx(l.mosFrom)],
         ['Perte de paquets', l => fx(l.loss) + ' %'], ['Gigue', l => fx(l.jit, 1) + ' ms'], ['Délai aller-retour', l => l.rtt > 0 && l.rtt < 10000 ? Math.round(l.rtt) + ' ms' : '–']]
        .map(([lbl, f]) => `<tr><th>${lbl}</th>${r.q.legs.map(l => `<td>${f(l)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)});
};

