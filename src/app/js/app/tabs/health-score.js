// ---------- Note de santé par magasin (sur 100) ----------
// quatre volets : service (35 %), configuration (25 %), sécurité (20 %), téléphones (20 %)
const HS_W = {service: 35, config: 25, secu: 20, tel: 20};
const HS_L = {service: 'Service', config: 'Configuration', secu: 'Sécurité', tel: 'Téléphones'};
const hsGrade = n => n == null ? ['–', ''] : n >= 85 ? ['A', 'ok'] : n >= 70 ? ['B', 'ok'] : n >= 55 ? ['C', 'warn'] : ['D', 'bad'];
const hsClamp = v => Math.max(0, Math.min(100, Math.round(v)));
// volets calculables à partir d'un point du suivi (pour l'évolution)
function hsService(seg, m){
  if(!m || !m.inc) return null;
  const parts = [], pen = [];
  const o = k => objFor(seg, k);
  if(m.rate != null){ const t = o('rate') || 85, sc = hsClamp(100 * m.rate / t); parts.push(sc); if(sc < 100) pen.push([Math.round((100 - sc) / 4), `Taux de réponse ${String(m.rate).replace('.', ',')} % (objectif ${t} %)`, 'stats']); }
  if(m.lostRate != null){ const t = o('lostRate') || 10, sc = m.lostRate <= t ? 100 : hsClamp(100 - (m.lostRate - t) * 5); parts.push(sc); if(sc < 100) pen.push([Math.round((100 - sc) / 4), `Appels perdus ${String(m.lostRate).replace('.', ',')} % (objectif ${t} %)`, 'rappels']); }
  if(m.wait != null){ const t = o('wait') || 30, sc = m.wait <= t ? 100 : hsClamp(100 - (m.wait - t) * 2); parts.push(sc); if(sc < 100) pen.push([Math.round((100 - sc) / 4), `Attente moyenne en file (appels servis) ${m.wait} s (objectif ${t} s)`, 'statsfiles']); }
  if(m.qRate != null){ const t = o('qRate') || 85, sc = hsClamp(100 * m.qRate / t); parts.push(sc); if(sc < 100) pen.push([Math.round((100 - sc) / 4), `Réponse en file des agents ${String(m.qRate).replace('.', ',')} % (objectif ${t} %)`, 'agents']); }
  return parts.length ? {score: hsClamp(parts.reduce((a, b) => a + b, 0) / parts.length), pen} : null;
}
function hsTel(m){
  if(!m || !m.tels) return null;
  const ok = m.phOk + (m.phNt || 0) + 0.5 * (m.phProb || 0) + 0.5 * (m.phUnk || 0), sc = hsClamp(100 * ok / m.tels), pen = [];
  if(m.phOld) pen.push([Math.round(25 * m.phOld / m.tels), `${m.phOld} téléphone${m.phOld > 1 ? 's' : ''} à mettre à jour`, 'telephones']);
  if(m.phUnk) pen.push([Math.round(12.5 * m.phUnk / m.tels), `${m.phUnk} téléphone${m.phUnk > 1 ? 's' : ''} de version inconnue`, 'telephones']);
  return {score: sc, pen};
}
let HS_CACHE = null;
function healthScores(){
  if(HS_CACHE) return HS_CACHE;
  const snap = computeSnapshot(FULL), pts = suiviLoad(FULL.info.fqdn), curId = (FULL.info.fqdn || '') + '|' + FULL.info.date;
  const prev = pts.filter(p => p.id !== curId && (p.iso || '') < (snap.iso || '')).pop() || null;
  // contrôle des SDA de tout le système (moments clés, sans choix dans les menus)
  const ctx = simCtx(FULL), M = ctlMoments(), lostBy = {}, hangBy = {}; ctx.cur = true; // 18.1.27 : backup ouvert (historique des pauses utilisable)
  ctx.dids.forEach(e => { const s = DIDSEG[e.did] || SEG_COMMON;
    const res = M.map(([, , day, t]) => { const [h, mi] = t.split(':').map(Number); return simulate(e.did, day, h * 60 + mi, {}, ctx); });
    if(res.some(R => R.end === 'lost' && !(R.steps.filter(x => !x.soft).slice(-2)[0] || {}).branch?.startsWith('Sans choix'))) lostBy[s] = (lostBy[s] || 0) + 1; });
  const SA = secAnalysis();
  const rows = ['', ...SEG_LIST.filter(s => s[0] !== '@')].map(seg => {
    const m = snap.m[seg] || null, inS = n => !seg || SEGOF[n] === seg;
    const service = hsService(seg, m), tel = hsTel(m);
    // configuration
    const cpen = [], qNoAgent = FULL.queues.filter(q => inS(q.number) && q.members.length && !q.members.some(x => !x.status || x.status === 'LoggedIn'));
    const nLost = seg ? (lostBy[seg] || 0) : Object.values(lostBy).reduce((a, b) => a + b, 0);
    if(m && m.unrouted) cpen.push([Math.min(40, 10 * m.unrouted), `${m.unrouted} SDA non acheminé${m.unrouted > 1 ? 's' : ''}`, 'controle']);
    if(nLost) cpen.push([Math.min(30, 5 * nLost), `${nLost} SDA avec un appel perdu à un moment clé`, 'controle']);
    if(m && m.holMissing) cpen.push([Math.min(25, 5 * m.holMissing), `${m.holMissing} département${m.holMissing > 1 ? 's' : ''} sans les jours fériés à venir`, 'feries']);
    if(qNoAgent.length) cpen.push([Math.min(30, 10 * qNoAgent.length), `${qNoAgent.length} file${qNoAgent.length > 1 ? 's' : ''} sans agent connecté`, 'indisp']);
    const config = m ? {score: hsClamp(100 - cpen.reduce((a, p) => a + p[0], 0)), pen: cpen} : null;
    // sécurité
    const exts = FULL.extensions.filter(e => inS(e.number)), named = exts.filter(e => e.email), spen = [];
    const withMfa = named.filter(e => ['on', 'ms'].includes(mfaOf(e).k)).length, elevNo = SA.elevated.filter(r => (!seg || r.seg === seg) && r.rank >= 3 && !['on', 'ms'].includes(r.fa)).length;
    const fwdOn = SA.fwd.filter(r => (!seg || r.seg === seg) && r.active).length;
    let secu = null;
    if(exts.length){ let sc = named.length ? 100 * withMfa / named.length : 100;
      if(named.length && withMfa < named.length) spen.push([Math.round(100 - 100 * withMfa / named.length), `${named.length - withMfa} poste${named.length - withMfa > 1 ? 's' : ''} nominatif${named.length - withMfa > 1 ? 's' : ''} sans MFA`, 'securite']);
      if(elevNo){ sc -= 20 * elevNo; spen.push([20 * elevNo, `${elevNo} compte${elevNo > 1 ? 's' : ''} à droits élevés sans MFA`, 'securite']); }
      if(fwdOn){ sc -= Math.min(15, 3 * fwdOn); spen.push([Math.min(15, 3 * fwdOn), `${fwdOn} renvoi${fwdOn > 1 ? 's' : ''} externe${fwdOn > 1 ? 's' : ''} actif${fwdOn > 1 ? 's' : ''}`, 'securite']); }
      secu = {score: hsClamp(sc), pen: spen}; }
    const comp = {service, config, secu, tel}, have = Object.entries(comp).filter(([, v]) => v);
    const wsum = have.reduce((a, [k]) => a + HS_W[k], 0), total = wsum ? hsClamp(have.reduce((a, [k, v]) => a + v.score * HS_W[k], 0) / wsum) : null;
    // évolution des volets calculables à partir du point précédent du suivi
    const pm = prev && prev.m[seg], ps = hsService(seg, pm), pt = hsTel(pm);
    return {seg, total, comp, m, prevDate: prev ? prev.iso : null, dService: service && ps ? service.score - ps.score : null, dTel: tel && pt ? tel.score - pt.score : null,
      pen: have.flatMap(([k, v]) => v.pen.map(p => [p[0] * HS_W[k] / 100, p[1], p[2], k])).sort((a, b) => b[0] - a[0])};
  }).filter(r => r.total != null);
  // tout le système : moyenne des magasins, pondérée par les appels (service) ou les postes (autres volets)
  const sys = rows.find(r => !r.seg), st = rows.filter(r => r.seg);
  if(sys && st.length){
    Object.keys(HS_W).forEach(k => { const it = st.filter(r => r.comp[k]), w = r => Math.max(1, k === 'service' ? (r.m && r.m.inc) || 0 : (r.m && r.m.postes) || 0);
      if(it.length) sys.comp[k] = {score: hsClamp(it.reduce((a, r) => a + r.comp[k].score * w(r), 0) / it.reduce((a, r) => a + w(r), 0)), pen: sys.comp[k] ? sys.comp[k].pen : []}; });
    const have = Object.entries(sys.comp).filter(([, v]) => v), ws = have.reduce((a, [k]) => a + HS_W[k], 0);
    sys.total = hsClamp(have.reduce((a, [k, v]) => a + v.score * HS_W[k], 0) / ws);
    sys.avg = true;
  }
  return HS_CACHE = {rows, prev};
}
function hsBadge(n, big){ const [g, c] = hsGrade(n); return `<span class="hsb ${c}${big ? ' big' : ''}"><b>${n == null ? '–' : n}</b><small>/100</small><i>${g}</i></span>`; }
function hsCard(r, open){
  const dl = d => d == null || !d ? '' : `<span class="pill ${d > 0 ? 'ok' : 'bad'}" title="Depuis le backup du ${r.prevDate ? dayKey(r.prevDate) : ''}">${d > 0 ? '▲ +' : '▼ '}${d}</span>`;
  return `<div class="card hscard">
    <div class="hshead">${hsBadge(r.total, true)}<div><div style="font-size:16px;font-weight:650">${esc(r.seg ? segName(r.seg) : 'Tout le système')}</div>
      <div class="muted" style="font-size:12.5px">${r.m ? `${nf(r.m.inc)} appels entrants (30 j) · ${nf(r.m.postes)} postes · ${nf(r.m.tels)} téléphones` : ''}${r.avg ? ' · moyenne des magasins, pondérée par leur taille' : ''}</div></div></div>
    <div class="hsparts">${Object.keys(HS_W).map(k => { const v = r.comp[k]; return `<div><span>${HS_L[k]} <small class="muted">${HS_W[k]} %</small></span><div class="hsbar"><i style="width:${v ? v.score : 0}%;background:var(--${hsGrade(v && v.score)[1] || 'muted'})"></i></div><b>${v ? v.score : '–'}</b>${k === 'service' ? dl(r.dService) : k === 'tel' ? dl(r.dTel) : ''}</div>`; }).join('')}</div>
    ${r.pen.length ? `<details${open ? ' open' : ''}><summary class="muted" style="font-size:12.5px;cursor:pointer">Ce qui coûte le plus de points</summary><ul class="hspen">${r.pen.slice(0, 6).map(p => `<li><b>−${Math.max(1, Math.round(p[0]))}</b> ${esc(p[1])} <a class="dlink" href="#${p[2]}">voir ▸</a></li>`).join('')}</ul></details>` : '<p class="muted" style="font-size:12.5px">Aucun point perdu.</p>'}
  </div>`;
}
V.sante = el => {
  const H = healthScores(), sys = H.rows.find(r => !r.seg), stores = H.rows.filter(r => r.seg).sort((a, b) => b.total - a.total);
  const focus = SEG ? H.rows.find(r => r.seg === SEG) : null;
  el.innerHTML = `<div id="hswrap"><h2>Note de santé</h2>
    <p class="lead">Une note sur 100 par magasin, qui résume quatre volets : <b>service</b> (taux de réponse, appels perdus, attente, réponse des agents, comparés aux objectifs), <b>configuration</b> (SDA non acheminés ou qui perdent des appels, jours fériés manquants, files sans agent), <b>sécurité</b> (MFA des postes nominatifs, comptes à droits élevés, renvois externes) et <b>téléphones</b> (firmwares à jour). A : 85 et plus · B : 70 à 84 · C : 55 à 69 · D : moins de 55.${H.prev ? ` Évolution du service et des téléphones depuis le backup du ${esc(dayKey(H.prev.iso))}.` : ''}</p>
    ${focus ? hsCard(focus, true) : ''}
    ${sys && !SEG ? hsCard(sys, false) : ''}
    ${SEG ? '' : `<h3>Par magasin (${stores.length})</h3><div class="hsgrid">${stores.map(r => `<div class="card hsmini" data-hs="${esc(r.seg)}">${hsBadge(r.total)}<div><b>${esc(segShort(r.seg))}</b><div class="hsdots">${Object.keys(HS_W).map(k => `<span title="${HS_L[k]} : ${r.comp[k] ? r.comp[k].score : '–'}" class="${hsGrade(r.comp[k] && r.comp[k].score)[1]}">${HS_L[k][0]}</span>`).join('')}</div></div></div>`).join('')}</div>
      <p class="muted" style="font-size:12.5px">Cliquez un magasin pour voir le détail de sa note.</p>`}
    <p class="note">Service : 30 derniers jours de l'historique, comparés aux objectifs du magasin (onglet Objectifs). Configuration : retenues de 10 points par SDA non acheminé (max. 40), 5 par SDA perdant un appel à un moment clé (max. 30), 5 par département sans les fériés à venir (max. 25), 10 par file sans agent connecté (max. 30). Sécurité : part des postes nominatifs (avec courriel) protégés par un MFA (Microsoft 365 ou 3CX), moins 20 points par compte à droits élevés sans MFA et jusqu'à 15 pour les renvois externes actifs. Téléphones : part des téléphones à jour (moitié pour « probablement à jour » et pour les versions inconnues, qui ne peuvent pas être vérifiées).</p></div>`;
  $('#hswrap').addEventListener('click', e => { const c = e.target.closest('[data-hs]'); if(c) window.__app.setSeg(c.dataset.hs); });
};
// carte du tableau de bord
function hsDashCard(){
  try{
    const H = healthScores(), r = H.rows.find(x => x.seg === (SEG || '')); if(!r) return '';
    const worst = SEG ? [] : H.rows.filter(x => x.seg).sort((a, b) => a.total - b.total).slice(0, 3);
    return `<a class="card hsdash" href="#sante">${hsBadge(r.total)}<div style="flex:1"><b>Note de santé${SEG ? ' · ' + esc(segShort(SEG)) : ' du système'}</b>
      <div class="muted" style="font-size:12.5px">${Object.keys(HS_W).map(k => `${HS_L[k]} ${r.comp[k] ? r.comp[k].score : '–'}`).join(' · ')}</div>
      ${worst.length ? `<div class="muted" style="font-size:12.5px">Les plus faibles : ${worst.map(x => `${esc(segShort(x.seg))} ${x.total}`).join(', ')}</div>` : r.pen[0] ? `<div class="muted" style="font-size:12.5px">Principal point : ${esc(r.pen[0][1])}</div>` : ''}</div><span class="muted">▸</span></a>`;
  }catch(e){ console.warn('Note de santé :', e); return ''; }
}

