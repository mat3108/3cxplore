// ---------- Période « Dates au choix » (15.23) : liste commune + calendrier du / au ----------
// valeur d'une période : '7' | '30' | '90' | 'all' | 'c:AAAA-MM-JJ:AAAA-MM-JJ' (dates au choix)
const PER_OPTS = [['7', '7 derniers jours'], ['30', '30 derniers jours'], ['90', '90 derniers jours'], ['all', "Tout l'historique"], ['custom', 'Dates au choix']];
const perIsC = p => typeof p === 'string' && p.startsWith('c:');
function perRange(p, first, last){
  if(!first || !last) return [first || '', last || ''];
  if(perIsC(p)){ let [, a, b] = p.split(':'); a = a || first; b = b || last; if(a > b) [a, b] = [b, a]; return [a < first ? first : a, b > last ? last : b]; }
  return p === 'all' ? [first, last] : [addDaysISO(last, -(+p || 30) + 1), last];
}
// début d'un jour local (fuseau du système 3CX) en millisecondes
const dayStartTs = d => { const t = Date.parse(d + 'T12:00:00Z'); let c = t - localParts(new Date(t).toISOString())[1] * 3600e3;
  // 18.1.22 : jour de changement d'heure : l'écart de midi n'est pas celui de minuit, on corrige jusqu'à tomber sur 0 h du bon jour
  for(let k = 0; k < 3; k++){ const [d2, h2] = localParts(new Date(c).toISOString()); if(d2 < d) c += (24 - h2) * 3600e3; else if(h2 > 0) c -= h2 * 3600e3; else break; }
  return c; };
function perUI(id, p, first, last, opts){
  const c = perIsC(p), [f, t] = perRange(p, first, last);
  return `<select id="${id}">${(opts || PER_OPTS).map(([v, l]) => `<option value="${v}"${(c ? 'custom' : p) === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`
    + `<span class="perc" id="${id}c"${c ? '' : ' hidden'}><input type="date" id="${id}f" value="${f}" min="${first}" max="${last}" aria-label="Du"> → <input type="date" id="${id}t" value="${t}" min="${first}" max="${last}" aria-label="Au"></span>`;
}
// set(valeur) : enregistre la période et réaffiche l'onglet
function perWire(id, p, first, last, set){
  const sel = document.getElementById(id), f = document.getElementById(id + 'f'), t = document.getElementById(id + 't');
  if(!sel) return;
  sel.addEventListener('change', () => { if(sel.value === 'custom'){ const [a, b] = perRange(p, first, last); set(`c:${a}:${b}`); } else set(sel.value); });
  [f, t].forEach(i => i && i.addEventListener('change', () => { if(f.value && t.value) set(`c:${f.value}:${t.value}`); }));
}
// période des onglets qui partagent statsPeriod() ({mode, from, to})
const perOfStats = P => P.mode === 'custom' ? `c:${P.from || ''}:${P.to || ''}` : P.mode;
const perToStats = (P, v) => { if(perIsC(v)){ const [, a, b] = v.split(':'); P.mode = 'custom'; P.from = a; P.to = b; } else P.mode = v; try{ localStorage.setItem(STATS_KEY, JSON.stringify(P)); }catch(e){} };
const addDaysISO = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// calcul d'un point à partir de n'importe quel backup (le rattachement aux magasins suit l'attribution actuelle)
function computeSnapshot(X){
  const segX = n => SEGOF[n] || SEG_COMMON;
  const didSeg = {}, unrouted = [];
  X.lines.forEach(l => { const by = {}; l.rules.forEach(r => by[r.data] = r); const def = l.rules.find(r => r.cond === 'ForwardAll');
    l.dids.forEach(d => { const r = by[d] || def, dn = r?.office?.dn;
      didSeg[d] = dn && SEGOF[dn] ? SEGOF[dn] : (r?.office?.to === 'External' ? SEG_BRIDGE : SEG_COMMON);
      if(!r || !r.office || ['None', 'ProceedWithNoExceptions'].includes(r.office.to)) unrouted.push(d); }); });
  const M = {}, S = k => M[k] ||= {postes: 0, tels: 0, files: 0, sda: 0, inc: 0, ans: 0, lost: 0, base: 0, qs: 0, qw: 0, pa: 0, pe: 0, phOk: 0, phUnk: 0, phOld: 0, phProb: 0, phNt: 0, unrouted: 0, holMissing: 0};
  const both = (s, f) => { f(S('')); if(s) f(S(s)); };
  // téléphones : même logique que l'onglet Téléphones (firmware assigné, version vue, firmware effacé)
  const ua = {}; (X.phoneUA || []).forEach(u => ua[u[0]] = u); const er = {}; (X.fwErased || []).forEach(e => er[e[0]] = e);
  const phSt = d => { const rec = recFor(d.model), srv = serverFor(d.model), t = rec ? rec.version : srv ? fwVersion(srv) : null, mac = (d.mac || '').toUpperCase(), cmp = v => t ? verCmp(v, t) : 0;
    if(!t) return 'Nt'; // 18.1.42 / 18.2.16 : modèle sans référence = hors liste, comme l'onglet Téléphones
    if(d.firmware) return cmp(fwVersion(d.firmware)) < 0 ? 'Old' : 'Ok';
    if(ua[mac]) return cmp(ua[mac][2]) < 0 ? 'Old' : 'Ok';
    if(er[mac]) return cmp(fwVersion(er[mac][1])) < 0 ? 'Old' : 'Prob';
    return 'Unk'; };
  X.extensions.forEach(e => { const s = segX(e.number); both(s, m => m.postes++);
    e.devices.forEach(d => { const st = phSt(d); both(s, m => { m.tels++; m['ph' + st]++; }); }); });
  X.queues.forEach(q => both(segX(q.number), m => m.files++));
  Object.entries(didSeg).forEach(([d, s]) => both(s, m => m.sda++)); unrouted.forEach(d => both(didSeg[d], m => m.unrouted++));
  // service : 30 derniers jours de l'historique de ce backup
  let from = '', to = '';
  if(X.calls.length){
    to = localParts(X.calls[0][0])[0]; from = addDaysISO(to, -29);
    X.calls.forEach(c => { if(c[1] !== 'in') return; const day = localParts(c[0])[0]; if(day < from) return;
      let s = didSeg[c[5]]; if(!s || s === SEG_COMMON){ const p = c[9].find(x => SEGOF[x[0]] && SEGOF[x[0]] !== SEG_COMMON); s = p ? SEGOF[p[0]] : (s || SEG_COMMON); }
      both(s, m => { m.inc++; if(c[10] !== 'bridge') m.base++; if(c[10] === 'ans' || c[10] === 'fwd_ok') m.ans++; else if(ST_LOST.has(c[10])) m.lost++; }); });
    (X.queueCalls || []).forEach(r => { if(!r[6] || localParts(r[0])[0] < from) return; both(segX(r[1]), m => { m.qs++; m.qw += r[4]; }); });
    if(X.agentPolls) Object.entries(X.agentPolls).forEach(([k, v]) => { const [d, , a] = k.split('|'); if(d < from) return; both(segX(a), m => { m.pa += v[0]; m.pe += v[1]; }); });
  }
  // jours fériés du Québec des 90 jours suivant la date du backup, absents des départements
  const bIso = backupDateISO(X.info.date), bDay = (bIso || new Date().toISOString()).slice(0, 10), lim = addDaysISO(bDay, 90), y = +bDay.slice(0, 4);
  const upcoming = [...qcHolidays(y), ...qcHolidays(y + 1)].filter(([, d]) => d >= bDay && d <= lim).map(x => x[1]);
  const hasDetail = X.groups.some(g => Array.isArray(g.holidayDates));
  if(hasDetail) X.groups.filter(g => !isSysGroup(g) && g.members.length && g.hours?.type !== 'AllHours' && g.routes && g.routes.office && g.routes.office.to !== 'None').forEach(g => {
    const hol = g.holidayDates || [];
    const isHol = day => hol.some(h => { const [yy, mm, dd] = day.split('-').map(Number); const key = h.recurrent ? mm * 100 + dd : yy * 10000 + mm * 100 + dd;
      const a = h.recurrent ? h.m * 100 + h.d : h.y * 10000 + h.m * 100 + h.d, b = h.recurrent ? h.me * 100 + h.de : h.ye * 10000 + h.me * 100 + h.de; return a <= b ? key >= a && key <= b : key >= a || key <= b; });
    if(upcoming.some(d => !isHol(d))) both(segX(g.number), m => m.holMissing++); });
  const out = {};
  Object.entries(M).forEach(([k, m]) => out[k] = {postes: m.postes, tels: m.tels, files: m.files, sda: m.sda, inc: m.inc,
    rate: m.base ? Math.round(1000 * m.ans / m.base) / 10 : null, lost: m.lost, lostRate: m.base ? Math.round(1000 * m.lost / m.base) / 10 : null,
    wait: m.qs ? Math.round(m.qw / m.qs) : null, qRate: (m.pa + m.pe) ? Math.round(1000 * m.pa / (m.pa + m.pe)) / 10 : null,
    phOk: m.phOk, phUnk: m.phUnk, phOld: m.phOld, phProb: m.phProb, phNt: m.phNt, unrouted: m.unrouted, holMissing: hasDetail ? m.holMissing : null});
  return {v: SUIVI_V, id: (X.info.fqdn || '') + '|' + X.info.date, fqdn: X.info.fqdn || '', company: X.info.company, date: X.info.date, iso: bIso,
    name: X.source?.name || '', savedAt: new Date().toISOString(), period: [from, to], m: out};
}
// points automatiques : backup actuel et backup de référence (une seule fois par backup et par version du calcul)
{ const have = suiviLoad(FULL.info.fqdn), need = X => { const id = (X.info.fqdn || '') + '|' + X.info.date; return !suiviLoad(X.info.fqdn).some(s => s.id === id && s.v === SUIVI_V); };
  try{ if(need(FULL)) suiviUpsert(computeSnapshot(FULL)); if(window.REF_D && need(window.REF_D)) suiviUpsert(computeSnapshot(window.REF_D)); }catch(e){ console.warn('Suivi :', e); } }

const SUIVI_METRICS = [
  ['Qualité de service (30 derniers jours de chaque backup)', [['rate', 'Taux de réponse', '%', 1], ['lostRate', 'Appels perdus', '%', -1], ['wait', 'Attente moyenne en file', 's', -1], ['qRate', 'Taux de réponse en file (agents)', '%', 1], ['inc', 'Appels entrants', '', 0]]],
  ['Problèmes à corriger', [['unrouted', 'SDA non acheminés', '', -1], ['holMissing', 'Départements sans les fériés à venir', '', -1]]],
  ['Téléphones', [['phOk', 'À jour', '', 1], ['phUnk', 'Version inconnue', '', -1], ['phProb', 'Probablement à jour (firmware effacé)', '', -1], ['phOld', 'À mettre à jour', '', -1]]],
  ['Taille du parc', [['postes', 'Postes', '', 0], ['tels', 'Téléphones', '', 0], ['files', "Files d'attente", '', 0], ['sda', 'SDA', '', 0]]],
];

V.suivi = el => {
  let pts = suiviLoad(FULL.info.fqdn);
  const scopes = ['', ...new Set([...SEG_LIST, ...pts.flatMap(p => Object.keys(p.m))].filter(Boolean))];
  let scope = (window.__suiviScope !== undefined ? window.__suiviScope : SEG) || '';
  if(!scopes.includes(scope)) scope = '';
  el.innerHTML = `<div id="suwrap"><h2>Suivi dans le temps</h2>
    <p class="lead">À chaque backup chargé, un résumé chiffré est enregistré dans ce navigateur. Les courbes montrent l'évolution d'un backup à l'autre : qualité de service, problèmes à corriger, téléphones et taille du parc, pour tout le système ou un magasin. Chargez un backup régulièrement (par exemple chaque semaine) pour obtenir des tendances.</p>
    <div class="bar"><label class="count">Portée <select id="susc">${scopes.map(c => `<option value="${esc(c)}"${c === scope ? ' selected' : ''}>${c ? esc(segShort(c)) : 'Tout le système'}</option>`).join('')}</select></label>
      <span style="flex:1"></span>
      <label class="btn">Ajouter un backup (.zip)<input type="file" id="suadd" accept=".zip,application/zip" hidden></label>
      <button class="btn" id="suexp">Exporter l'historique</button><label class="btn">Importer<input type="file" id="suimp" accept=".json,application/json" hidden></label></div>
    <div id="sust" class="bkst"></div><div id="subody"></div></div>`;
  const stEl = $('#sust');
  function draw(){
    pts = suiviLoad(FULL.info.fqdn);
    const P = pts.filter(p => p.m[scope]);
    if(!P.length){ $('#subody').innerHTML = '<p class="muted">Aucun point pour cette portée.</p>'; return; }
    const fmtV = (v, u) => v == null ? '–' : (u === '%' ? esc(String(v)).replace('.', ',') + ' %' : u === 's' ? dur(v) : nf(v));
    const card = ([k, label, unit, dir]) => {
      const vals = P.map(p => p.m[scope][k]), last = vals[vals.length - 1], prev = vals.length > 1 ? vals[vals.length - 2] : null;
      const d = last != null && prev != null ? Math.round((last - prev) * 10) / 10 : null;
      const good = d == null || d === 0 || dir === 0 ? '' : (d > 0) === (dir > 0) ? 'ok' : 'bad';
      const ob = OBJ_META[k] ? objFor(scope, k) : null, nums = vals.filter(v => v != null).concat(ob != null ? [ob] : []), mx = Math.max(1, ...nums), mn = Math.min(0, ...nums);
      const W = 300, H = 90, pad = 8, X = i => P.length === 1 ? W / 2 : pad + i * (W - 2 * pad) / (P.length - 1), Y = v => H - 14 - (H - 28) * (v - mn) / (mx - mn || 1);
      const pl = vals.map((v, i) => v == null ? null : `${X(i)},${Y(v)}`).filter(Boolean).join(' ');
      return `<div class="card sucard"><div class="sut">${esc(label)}</div>
        <div class="suv">${fmtV(last, unit)} ${d != null && d !== 0 ? `<span class="pill ${good}">${d > 0 ? '+' : ''}${unit === '%' ? String(d).replace('.', ',') + ' pt' : unit === 's' ? d + ' s' : nf(d)}</span>` : ''}${ob != null && last != null ? `<span class="pill ${objCls(scope, k, last)}" title="${esc(objTxt(scope, k))}">${objOk(scope, k, last) ? 'objectif atteint' : 'objectif non atteint'}</span>` : ''}</div>
        <svg viewBox="0 0 ${W} ${H}" class="suchart" role="img" aria-label="${esc(label)}">
          ${ob != null ? `<line x1="0" x2="${W}" y1="${Y(ob)}" y2="${Y(ob)}" stroke="var(--ok)" stroke-width="1.2" stroke-dasharray="4 3"><title>${esc(objTxt(scope, k))}</title></line>` : ''}
          <polyline points="${pl}" fill="none" stroke="var(--accent)" stroke-width="2"/>
          ${vals.map((v, i) => v == null ? '' : `<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" fill="var(--accent)"><title>${esc(P[i].date)} : ${fmtV(v, unit)}</title></circle><text x="${X(i)}" y="${Y(v) - 7}" text-anchor="middle" class="sulbl">${fmtV(v, unit)}</text>`).join('')}
          ${P.map((p, i) => `<text x="${X(i)}" y="${H - 2}" text-anchor="middle" class="ax">${esc((p.iso || '').slice(5, 10))}</text>`).join('')}</svg></div>`;
    };
    $('#subody').innerHTML = (P.length === 1 ? '<p class="segbar">Un seul point pour l\'instant : chargez un autre backup (ou ajoutez-en un avec « Ajouter un backup ») pour voir une évolution.</p>' : '') +
      SUIVI_METRICS.map(([g, ms]) => `<h3>${esc(g)}</h3><div class="sugrid">${ms.map(card).join('')}</div>`).join('') +
      `<h3>Points enregistrés (${pts.length})</h3><div class="tw"><table><thead><tr><th>Backup du</th><th>Fichier</th><th>Période de service</th><th class="num">Taux de réponse</th><th class="num">Version inconnue</th><th>Ajouté le</th><th></th></tr></thead><tbody>
      ${pts.slice().reverse().map(p => `<tr><td>${esc(bkDate(p.date))}${p.id === (FULL.info.fqdn + '|' + FULL.info.date) ? ' <span class="pill acc">actuel</span>' : ''}</td><td class="muted">${esc(p.name)}</td><td class="muted">${p.period[0] ? esc(p.period[0] + ' → ' + p.period[1]) : '–'}</td>
        <td class="num">${p.m[scope] ? fmtV(p.m[scope].rate, '%') : '–'}</td><td class="num">${p.m[scope] ? nf(p.m[scope].phUnk) : '–'}</td><td class="muted">${fmtD(p.savedAt)}</td>
        <td><button class="btn sudel" data-id="${esc(p.id)}" title="Retirer ce point">×</button></td></tr>`).join('')}</tbody></table></div>
      <p class="note">L'historique est conservé dans ce navigateur ; exportez-le pour le sauvegarder ou le transférer sur un autre poste. Les magasins sont rattachés selon l'attribution actuelle (onglet Magasins).</p>`;
  }
  draw();
  $('#susc').addEventListener('change', e => { scope = window.__suiviScope = e.target.value; draw(); });
  $('#subody').addEventListener('click', e => { const b = e.target.closest('.sudel'); if(!b) return; if(confirm('Retirer ce point de l\'historique ?')){ suiviSave(FULL.info.fqdn, suiviLoad(FULL.info.fqdn).filter(p => p.id !== b.dataset.id)); draw(); } });
  $('#suadd').addEventListener('change', async e => { const f = e.target.files[0]; if(!f) return; stEl.className = 'bkst'; stEl.textContent = 'Démarrage…';
    try{ const X = await BK.parseOnly(f, m => { stEl.textContent = m; }); stEl.textContent = 'Calcul du résumé…'; const sn = computeSnapshot(X);
      if(sn.fqdn !== FULL.info.fqdn){ stEl.className = 'bkst err'; stEl.textContent = `Ce backup vient d'un autre système (${sn.fqdn}) : il n'a pas été ajouté.`; return; }
      suiviUpsert(sn); stEl.textContent = `Point du ${sn.date} ajouté.`; draw(); }
    catch(er){ stEl.className = 'bkst err'; stEl.textContent = 'Erreur : ' + er.message; } e.target.value = ''; });
  $('#suexp').addEventListener('click', () => { const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({type: 'suivi-3cx', fqdn: FULL.info.fqdn, exported: new Date().toISOString(), points: suiviLoad(FULL.info.fqdn)}, null, 1)], {type: 'application/json'}));
    a.download = `suivi-3cx-${FULL.info.fqdn}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  $('#suimp').addEventListener('change', async e => { const f = e.target.files[0]; if(!f) return;
    try{ const j = JSON.parse(await f.text()); if(j.type !== 'suivi-3cx' || !Array.isArray(j.points)) throw new Error('fichier non reconnu');
      // 18.2.31 : valeurs numériques seulement, période et textes vérifiés
      const num = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([, x]) => x === null || typeof x === 'number'));
      let n = 0; j.points.forEach(p => { if(p && typeof p.id === 'string' && p.m && typeof p.m === 'object' && p.fqdn === FULL.info.fqdn){
        const q = {...p, date: String(p.date || ''), name: String(p.name || ''), period: Array.isArray(p.period) && p.period.length === 2 ? p.period.map(x => String(x || '')) : ['', ''], m: Object.fromEntries(Object.entries(p.m).map(([s, o]) => [s, num(o)]))};
        suiviUpsert(q); n++; } });
      stEl.className = 'bkst'; stEl.textContent = `${n} point(s) importé(s).`; draw(); }
    catch(er){ stEl.className = 'bkst err'; stEl.textContent = 'Import impossible : ' + er.message; } e.target.value = ''; });
};

