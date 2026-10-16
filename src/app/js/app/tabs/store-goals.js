// ---------- Objectifs par magasin ----------
const OBJ_DEF0 = {rate: 85, lostRate: 10, wait: 30, qRate: 85};
const OBJ_META = {rate: {l: 'Taux de réponse', u: '%', dir: 1}, lostRate: {l: 'Appels perdus', u: '%', dir: -1}, wait: {l: 'Attente moyenne en file', u: 's', dir: -1}, qRate: {l: 'Taux de réponse en file (agents)', u: '%', dir: 1}};
const OBJ_KEY = 'objectifs3cx:' + (FULL.info.fqdn || '');
const OBJ = (() => { let c = {}; try{ c = JSON.parse(localStorage.getItem(OBJ_KEY) || '{}'); }catch(e){} return {def: {...OBJ_DEF0, ...(c.def || {})}, seg: c.seg || {}}; })();
const objSave = () => { try{ localStorage.setItem(OBJ_KEY, JSON.stringify(OBJ)); }catch(e){} };
const objNum = v => v === '' || v == null || isNaN(+v) ? null : +v;
// cible d'un indicateur pour un magasin (valeur propre au magasin, sinon valeur par défaut) ; valeurs en % ou en secondes
const objFor = (seg, k) => { const o = seg && OBJ.seg[seg] ? objNum(OBJ.seg[seg][k]) : null; return o != null ? o : objNum(OBJ.def[k]); };
const objOk = (seg, k, v) => { const t = objFor(seg, k); if(t == null || v == null || isNaN(v)) return null; return OBJ_META[k].dir > 0 ? v >= t : v <= t; };
const objCls = (seg, k, v) => { const r = objOk(seg, k, v); return r == null ? '' : r ? 'ok' : 'bad'; };
const objTxt = (seg, k) => { const t = objFor(seg, k); return t == null ? 'aucun objectif' : `objectif ${OBJ_META[k].dir > 0 ? '≥' : '≤'} ${t}${OBJ_META[k].u === '%' ? ' %' : ' s'}`; };
const objPill = (seg, k, v, label) => `<span class="pill ${objCls(seg, k, v)}" title="${esc(objTxt(seg, k))}${objOk(seg, k, v) == null ? '' : objOk(seg, k, v) ? ' — atteint' : ' — non atteint'}">${label}</span>`;
// valeurs actuelles (période donnée) par magasin, pour les quatre indicateurs
function objCurrent(from, to){
  const M = {}, S = k => M[k] ||= {ans: 0, lost: 0, base: 0, qs: 0, qw: 0, pa: 0, pe: 0};
  FULL.calls.forEach(c => { if(c[1] !== 'in') return; const d = localParts(c[0])[0]; if(d < from || d > to) return; const s = callSeg(c);
    [S(''), S(s)].forEach(m => { if(c[10] !== 'bridge') m.base++; if(ANS_ST.has(c[10])) m.ans++; else if(ST_LOST.has(c[10])) m.lost++; }); });
  FULL.queueCalls.forEach(r => { if(!r[6]) return; const d = localParts(r[0])[0]; if(d < from || d > to) return; [S(''), S(SEGOF[r[1]] || SEG_COMMON)].forEach(m => { m.qs++; m.qw += r[4]; }); });
  if(FULL.agentPolls) Object.entries(FULL.agentPolls).forEach(([k, v]) => { const [d, , a] = k.split('|'); if(d < from || d > to) return; [S(''), S(SEGOF[a] || SEG_COMMON)].forEach(m => { m.pa += v[0]; m.pe += v[1]; }); });
  const out = {}; Object.entries(M).forEach(([k, m]) => out[k] = {rate: m.base ? 100 * m.ans / m.base : null, lostRate: m.base ? 100 * m.lost / m.base : null, wait: m.qs ? m.qw / m.qs : null, qRate: (m.pa + m.pe) ? 100 * m.pa / (m.pa + m.pe) : null});
  return out;
}

V.objectifs = el => {
  const all = FULL.calls;
  const lastDay = all.length ? localParts(all[0][0])[0] : '', from = lastDay ? addDaysISO(lastDay, -29) : '';
  const cur = lastDay ? objCurrent(from, lastDay) : {};
  const segs = SEG_LIST.filter(s => s !== SEG_BRIDGE);
  const fmt = (k, v) => v == null ? '–' : OBJ_META[k].u === '%' ? Math.round(v) + ' %' : dur(Math.round(v));
  const inp = (seg, k) => { const own = seg ? (OBJ.seg[seg] || {})[k] : OBJ.def[k]; return `<input type="number" class="objin" data-s="${esc(seg)}" data-k="${k}" value="${own ?? ''}" placeholder="${seg ? esc(String(objNum(OBJ.def[k]) ?? '')) : ''}" min="0" step="1">`; };
  function draw(){
    const rows = ['', ...segs];
    const att = rows.map(s => Object.keys(OBJ_META).map(k => objOk(s, k, cur[s]?.[k])));
    el.innerHTML = `<div id="objwrap"><h2>Objectifs</h2>
      <p class="lead">Fixez des cibles de qualité de service : par défaut pour tous les magasins, et au besoin propres à un magasin (laisser vide = valeur par défaut ; effacer la valeur par défaut = pas d'objectif). Les onglets Statistiques, Agents, Suivi et Rapport indiquent alors « objectif atteint / non atteint » (vert / rouge) au lieu de seuils fixes. Valeurs mémorisées dans ce navigateur.</p>
      <div class="tw"><table class="objt"><thead><tr><th>Magasin</th>${Object.entries(OBJ_META).map(([k, m]) => `<th>${esc(m.l)}<div class="muted" style="font-weight:400">${m.dir > 0 ? 'au moins' : 'au plus'} (${m.u === '%' ? '%' : 'secondes'})</div></th>`).join('')}<th class="num">Atteints (30 j)</th></tr></thead><tbody>
      ${rows.map((s, i) => { const a = att[i].filter(x => x != null), ok = a.filter(Boolean).length;
        return `<tr class="${s ? '' : 'objdef'}"><td><b>${s ? esc(segShort(s)) : 'Tous les magasins (défaut)'}</b></td>
        ${Object.keys(OBJ_META).map(k => `<td>${inp(s, k)}<div class="objcur">${cur[s] ? objPill(s, k, cur[s][k], 'actuel ' + fmt(k, cur[s][k])) : '<span class="muted">–</span>'}</div></td>`).join('')}
        <td class="num">${a.length ? `<span class="pill ${ok === a.length ? 'ok' : ok ? 'warn' : 'bad'}">${ok} / ${a.length}</span>` : '–'}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="note">« Actuel » : 30 derniers jours de l'historique du backup (du ${from} au ${lastDay}). Taux de réponse et appels perdus calculés comme dans l'onglet Statistiques ; taux de réponse en file comme dans l'onglet Agents.</p>
      <p><button class="btn" id="objreset">Revenir aux objectifs par défaut (85 %, 10 %, 30 s, 85 %)</button></p></div>`;
    el.querySelectorAll('.objin').forEach(x => x.addEventListener('change', () => {
      const s = x.dataset.s, k = x.dataset.k, v = x.value.trim();
      if(!s) OBJ.def[k] = v === '' ? '' : +v;
      else { OBJ.seg[s] ||= {}; if(v === '') delete OBJ.seg[s][k]; else OBJ.seg[s][k] = +v; if(!Object.keys(OBJ.seg[s]).length) delete OBJ.seg[s]; }
      objSave(); const y = window.scrollY; draw(); window.scrollTo(0, y);
    }));
    $('#objreset').addEventListener('click', () => { if(!confirm('Effacer tous les objectifs propres aux magasins et revenir aux valeurs par défaut ?')) return; OBJ.def = {...OBJ_DEF0}; OBJ.seg = {}; objSave(); draw(); });
  }
  draw();
};

