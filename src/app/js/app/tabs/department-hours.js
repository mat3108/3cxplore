// ---------- Heures du département d'une file, d'un menu ou d'un groupe de sonnerie (17.4.1) ----------
// Dans 3CX V20, chaque file, menu (IVR) et groupe de sonnerie appartient à un département (membre « system »).
// Quand un appel y arrive sans être passé par ce département, 3CX applique les heures de ce département :
// fermé ou férié → destination « en dehors des heures » propre à la file ou au menu (ou suite normale si « continuer ») ;
// pause → destination « pause » du département, ou suite normale, selon ce que montrent les appels réels.
const OWNER_CACHE = new WeakMap();
function ownerMap(DNX){
  let m = OWNER_CACHE.get(DNX); if(m) return m; m = {};
  Object.values(DNX).forEach(x => { if(x.kind === 'Département' && !isSysGroup(x.obj)) (x.obj.members || []).forEach(mb => { if(mb.role === 'system') m[mb.dn] = x.obj; }); });
  OWNER_CACHE.set(DNX, m); return m;
}
const ownRoute = o => { const r = o && o.routes && o.routes.outOfOffice; return r && r.to && r.to !== 'ProceedWithNoExceptions' && r.to !== 'None' ? r : null; };
const deptBreakRoute = g => { const r = g && g.routes && g.routes.break; return r && r.to && r.to !== 'None' ? r : null; };
let BRK_HIST = null;
// appels réels arrivés à une file ou un menu pendant la pause de son département : combien ont suivi la destination « pause »
function brkHist(dn){
  if(!BRK_HIST){ BRK_HIST = {}; const OW = ownerMap(DN);
    FULL.calls.forEach(c => { if(c[1] !== 'in') return; c[9].forEach((p, k) => { const g = OW[p[0]]; if(!g || !g.breakTime || !(g.breakTime.days || []).length) return;
      const br = deptBreakRoute(g); if(!br || br.dn === p[0] || c[9].slice(0, k).some(x => x[0] === g.number)) return;
      const [day, min, wd] = localFull(c[0]); if(deptSchedule(g).expected(day, min, wd) !== 'break') return;
      const nx = c[9][k + 1], h = BRK_HIST[p[0]] ||= {n: 0, f: 0}; h.n++; if(nx && nx[0] === br.dn) h.f++; }); }); }
  return BRK_HIST[dn] || null;
}
// ce que 3CX fait à l'arrivée sur une file, un menu ou un groupe de sonnerie : null (heures d'ouverture, ou département déjà traversé)
// ou {k: état du département, g, d: destination (null = suite normale), h: historique (pause), sure}
function ownerHours(dn, obj, day, min, wd, inPath, DNX, hist){
  const g = ownerMap(DNX || DN)[dn]; if(!g || inPath(g.number)) return null;
  const k = deptSchedule(g).expected(day, min, wd); if(k === 'office') return null;
  if(k === 'break'){ const br = deptBreakRoute(g); if(!br || br.dn === dn) return null;
    const h = hist ? brkHist(dn) : null;
    if(h && h.n >= 3) return {k, g, d: h.f / h.n >= .5 ? br : null, h, sure: true};
    return {k, g, d: br, h, sure: false}; }
  return {k, g, d: ownRoute(obj), sure: true};
}
// pour le diagramme et l'arbre : destinations « fermé » et « pause » qui s'appliquent quand l'appel arrive sans passer par le département
function ownerBranches(dn, obj){
  const g = ownerMap(DN)[dn]; if(!g || (g.hours && g.hours.type === 'AllHours')) return [];
  const out = [], own = ownRoute(obj), br = deptBreakRoute(g), h = brkHist(dn);
  const hs = x => hoursSummary(x).filter(t => !/fermé$/.test(t)).join(', ');
  if(own) out.push([`Fermé (${g.name}${hs(g.hours) ? ' : hors ' + hs(g.hours) : ''})`, own]);
  if(br && br.dn !== dn && (g.breakTime && (g.breakTime.days || []).length) && (!h || h.n < 3 || h.f / h.n >= .5)) out.push([`Pause (${g.name}${hs(g.breakTime) ? ' : ' + hs(g.breakTime) : ''})`, br]);
  return out;
}
