// ---------- « Quoi de neuf » : ce qui a changé depuis le backup précédent (carte du tableau de bord) ----------
const WN_KEY = 'quoideneuf3cx:' + (FULL.info.fqdn || '');
const WN_METRICS = [['rate', 'Taux de réponse', '%', 1], ['lostRate', 'Appels perdus', '%', -1], ['wait', 'Attente moy. en file', 's', -1], ['qRate', 'Réponse en file (agents)', '%', 1],
  ['unrouted', 'SDA non acheminés', '', -1], ['holMissing', 'Départements sans les fériés à venir', '', -1], ['phOld', 'Téléphones à mettre à jour', '', -1], ['phUnk', 'Téléphones de version inconnue', '', -1]];
function whatsNew(){
  const pts = suiviLoad(FULL.info.fqdn), curId = (FULL.info.fqdn || '') + '|' + FULL.info.date, cur = pts.find(p => p.id === curId);
  if(!cur) return null;
  const prev = pts.filter(p => (p.iso || '') < (cur.iso || '') && p.id !== curId).pop() || null;
  const until = cur.iso || (FULL.calls[0] || [])[0] || new Date().toISOString();
  const since = prev ? prev.iso : new Date(Date.parse(until) - 7 * 864e5).toISOString();
  const k = SEG || '', a = cur.m[k] || {}, b = prev ? prev.m[k] || {} : {};
  // indicateurs : évolution par rapport au backup précédent
  const deltas = WN_METRICS.map(([key, l, u, dir]) => { const v = a[key], p = b[key]; if(v == null) return null;
    const dlt = p == null ? null : Math.round((v - p) * 10) / 10, good = dlt == null || !dir || !dlt ? null : dlt * dir > 0;
    return {key, l, u, dir, v, p, dlt, good}; }).filter(Boolean);
  // magasins en recul (taux de réponse -3 pts ou plus, ou appels perdus +3 pts ou plus)
  const stores = SEG ? [] : SEG_LIST.filter(s => s[0] !== '@').map(s => { const x = cur.m[s], y = prev && prev.m[s]; if(!x || !y) return null;
    const dr = x.rate != null && y.rate != null ? x.rate - y.rate : 0, dl = x.lostRate != null && y.lostRate != null ? x.lostRate - y.lostRate : 0;
    return dr <= -3 || dl >= 3 ? {s, x, y, dr: Math.round(dr * 10) / 10, dl: Math.round(dl * 10) / 10} : null; }).filter(Boolean);
  // objectifs non atteints (nouveaux depuis le backup précédent signalés)
  const objMiss = [];
  (SEG ? [SEG] : SEG_LIST.filter(s => s[0] !== '@')).forEach(s => { const x = cur.m[s], y = prev && prev.m[s]; if(!x) return;
    Object.keys(OBJ_META).forEach(key => { if(objOk(s, key, x[key]) === false) objMiss.push({s, key, v: x[key], t: objFor(s, key), isNew: !!(y && objOk(s, key, y[key]) === true)}); }); });
  // modifications de configuration et firmwares effacés depuis le backup précédent
  const mods = modEntries().filter(r => r.a[0] > since && r.a[0] <= until && (!SEG || r.segs.has(SEG)));
  const modBy = {}; mods.forEach(r => r.segs.forEach(s => { if(!SEG || s === SEG) modBy[s] = (modBy[s] || 0) + 1; }));
  const modUsers = {}; mods.forEach(r => { modUsers[r.a[3] || '—'] = (modUsers[r.a[3] || '—'] || 0) + 1; });
  const fw = (FULL.fwErased || []).filter(f => f[2] > since && f[2] <= until && (!SEG || SEGOF[f[4]] === SEG));
  return {cur, prev, since, until, deltas, stores, objMiss, mods, modBy, modUsers, fw};
}
function whatsNewCard(){
  let W; try{ W = whatsNew(); }catch(e){ console.warn('Quoi de neuf :', e); return ''; }
  if(!W) return '';
  let hidden = null; try{ hidden = localStorage.getItem(WN_KEY); }catch(e){}
  if(hidden === W.cur.id) return `<p style="margin:10px 0 0"><a class="dlink" href="#" data-wn="show">▸ Afficher « Quoi de neuf depuis le backup précédent »</a></p>`;
  const fx = (v, u) => v == null ? '–' : u === 's' ? dur(v) : String(v).replace('.', ',') + (u === '%' ? ' %' : '');
  const arrow = d => d.dlt == null ? '<span class="muted">nouveau</span>' : !d.dlt ? '<span class="muted">=</span>' : `<span class="pill ${d.good == null ? '' : d.good ? 'ok' : 'bad'}">${d.dlt > 0 ? '▲ +' : '▼ '}${fx(d.dlt, d.u === 's' ? '' : d.u).replace(' %', ' pt' + (Math.abs(d.dlt) >= 2 ? 's' : ''))}${d.u === 's' ? ' s' : ''}</span>`;
  const days = W.prev ? Math.max(1, Math.round((Date.parse(W.until) - Date.parse(W.since)) / 864e5)) : 7;
  const users = Object.entries(W.modUsers).sort((x, y) => y[1] - x[1]);
  return `<div class="card wncard" id="wncard"><div class="wnhead"><div><div class="bkt">Quoi de neuf</div>
      <div style="font-size:17px;font-weight:600">${W.prev ? `Depuis le backup précédent du ${esc(dayKey(W.prev.iso))} (${days} jour${days > 1 ? 's' : ''})` : 'Premier backup suivi : changements des 7 derniers jours'}${SEG ? ` · ${esc(segShort(SEG))}` : ''}</div></div>
      <button class="btn" data-wn="hide" title="Masquer jusqu'au prochain backup">Masquer</button></div>
    <div class="wngrid">
      <div><h4>Indicateurs <span class="muted" style="font-weight:400">(30 derniers jours de chaque backup)</span></h4>
        ${W.deltas.length ? `<table class="wnt"><tbody>${W.deltas.map(d => `<tr><td>${esc(d.l)}</td><td class="num"><b>${fx(d.v, d.u)}</b></td><td class="num">${W.prev ? arrow(d) : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aucun indicateur.</p>'}
        ${W.stores.length ? `<div style="margin-top:6px"><b>Magasins en recul</b> : ${W.stores.map(x => `<span class="pill bad" title="Taux de réponse ${fx(x.y.rate, '%')} → ${fx(x.x.rate, '%')} ; perdus ${fx(x.y.lostRate, '%')} → ${fx(x.x.lostRate, '%')}">${esc(segShort(x.s))} ${x.dr <= -3 ? `réponse ${String(x.dr).replace('.', ',')} pts` : `perdus +${String(x.dl).replace('.', ',')} pts`}</span>`).join('')}</div>` : ''}</div>
      <div><h4>Objectifs non atteints (${W.objMiss.length})</h4>
        ${W.objMiss.length ? `<div class="wnlist">${W.objMiss.sort((x, y) => (y.isNew - x.isNew)).slice(0, 12).map(o => `<div>${o.isNew ? '<span class="pill bad">nouveau</span> ' : ''}<b>${esc(segShort(o.s))}</b> · ${esc(OBJ_META[o.key].l)} ${fx(o.v, OBJ_META[o.key].u)} <span class="muted">(objectif ${fx(o.t, OBJ_META[o.key].u)})</span></div>`).join('')}${W.objMiss.length > 12 ? `<div class="muted">+${W.objMiss.length - 12} autres</div>` : ''}</div>` : '<p><span class="pill ok">Tous les objectifs sont atteints</span></p>'}
        <a class="dlink" href="#objectifs" style="font-size:12.5px">Voir les objectifs ▸</a></div>
      <div><h4>Modifications de la configuration (${nf(W.mods.length)})</h4>
        ${W.mods.length ? `<div class="wnlist">${Object.entries(W.modBy).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([s, n]) => `<span class="pill">${esc(segShort(s))} · ${nf(n)}</span>`).join('')}</div>
          <div class="muted" style="font-size:12.5px;margin-top:4px">Par ${esc(users.slice(0, 3).map(([u, n]) => `${u} (${n})`).join(', '))}${users.length > 3 ? '…' : ''}</div>` : '<p class="muted">Aucune modification.</p>'}
        ${W.fw.length ? `<div style="margin-top:6px"><span class="pill warn">${W.fw.length} firmware${W.fw.length > 1 ? 's' : ''} effacé${W.fw.length > 1 ? 's' : ''}</span> <span class="muted" style="font-size:12.5px">postes ${esc([...new Set(W.fw.map(f => f[4]))].slice(0, 6).join(', '))}${W.fw.length > 6 ? '…' : ''} : relancer « Mettre à jour le firmware »</span></div>` : ''}
        ${W.mods.length ? `<a class="dlink" href="#" data-wn="mods" style="font-size:12.5px">Voir le détail des modifications ▸</a>` : ''}
        ${window.REF_D ? ` · <a class="dlink" href="#comparaison" style="font-size:12.5px">Comparer avec le backup de référence ▸</a>` : ''}</div>
    </div>
    ${W.prev ? '' : '<p class="note">Chargez le prochain backup (sur ce même navigateur) pour voir l\'évolution des indicateurs d\'un backup à l\'autre.</p>'}</div>`;
}
if(!window.__wnWired){ window.__wnWired = true;
  document.addEventListener('click', e => { const a = e.target.closest('[data-wn]'); if(!a || !window.__wn) return; e.preventDefault(); window.__wn(a.dataset.wn); }); }
window.__wn = act => {
  const curId = (FULL.info.fqdn || '') + '|' + FULL.info.date;
  if(act === 'hide'){ try{ localStorage.setItem(WN_KEY, curId); }catch(e){} route(); }
  if(act === 'show'){ try{ localStorage.removeItem(WN_KEY); }catch(e){} route(); }
  if(act === 'mods'){ const W = whatsNew(); if(!W) return;
    try{ localStorage.setItem(MOD_KEY, JSON.stringify({mode: 'custom', from: dayKey(W.since), to: dayKey(W.until), common: false})); }catch(e){}
    window.__modSeg = SEG; window.__modTable = {}; location.hash = '#modifs'; }
};

