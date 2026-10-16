// ---------- Plan de numérotation : numéros utilisés, plages par magasin, numéros libres ----------
let NP_CACHE = null;
function numPlan(){
  if(NP_CACHE) return NP_CACHE;
  const used = {}; // numéro -> {kind, dn}
  const put = (n, kind) => { if(/^\d{2,6}$/.test(String(n || ''))) used[n] ||= {kind, n: String(n)}; };
  FULL.extensions.forEach(e => put(e.number, 'Poste')); FULL.queues.forEach(q => put(q.number, "File d'attente")); FULL.ivrs.forEach(i => put(i.number, 'Menu (IVR)'));
  FULL.ringGroups.forEach(r => put(r.number, 'Groupe de sonnerie')); (FULL.parks || []).forEach(p => put(p, 'Parking')); FULL.lines.forEach(l => put(l.number, 'Trunk'));
  // plages : blocs de 100 numéros où un magasin détient la majorité des postes
  const blocks = {};
  Object.values(used).forEach(u => { const b = Math.floor(+u.n / 100) * 100, len = u.n.length; const k = len + ':' + b; const x = blocks[k] ||= {k, b, len, items: [], segs: {}};
    x.items.push(u); if(u.kind === 'Poste'){ const s = SEGOF[u.n] || SEG_COMMON; x.segs[s] = (x.segs[s] || 0) + 1; } });
  Object.values(blocks).forEach(x => { const e = Object.entries(x.segs).sort((a, b) => b[1] - a[1])[0], tot = Object.values(x.segs).reduce((a, b) => a + b, 0);
    x.owner = e && e[1] * 2 > tot ? e[0] : (tot ? null : (() => { const o = {}; x.items.forEach(u => { const s = SEGOF[u.n]; if(s) o[s] = (o[s] || 0) + 1; }); const t = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return t ? t[0] : null; })());
    x.free = []; const pad = n => String(n).padStart(x.len, '0'); for(let i = Math.max(x.b, x.len === 4 ? 1000 : x.b); i < x.b + 100; i++){ const s = pad(i); if(s.length === x.len && !used[s]) x.free.push(s); } });
  const bySeg = {};
  // plages de postes d'un magasin : blocs qui contiennent au moins un poste (les blocs de files et menus n'en font pas partie)
  Object.values(blocks).forEach(x => { if(x.owner && x.items.some(u => u.kind === 'Poste')) (bySeg[x.owner] ||= []).push(x); });
  Object.values(bySeg).forEach(a => a.sort((x, y) => y.items.filter(u => u.kind === 'Poste').length - x.items.filter(u => u.kind === 'Poste').length || x.b - y.b));
  return NP_CACHE = {used, blocks: Object.values(blocks).sort((a, b) => a.len - b.len || a.b - b.b), bySeg};
}
// numéros libres proposés pour un magasin : d'abord dans son bloc principal, à la suite des postes existants
function freeNumbers(seg, max = 30){
  const P = numPlan(), bl = P.bySeg[seg] || [];
  const out = [];
  bl.forEach(x => { const last = Math.max(...x.items.filter(u => u.kind === 'Poste').map(u => +u.n), x.b); const after = x.free.filter(n => +n > last), before = x.free.filter(n => +n <= last);
    [...after, ...before].forEach(n => out.length < max && out.push({n, block: x})); });
  return out;
}

