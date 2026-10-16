// ---------- Plan des parkings : usagers en problème et fichier de correction (16.1) ----------
// un usager par poste : touches de parking actuelles (avec leur position), à retirer, hors plan, à ajouter, positions libres, appels parqués chez un autre magasin
function pkpUsers(A, plan){
  const P = FULL.parkCalls || [], end = P.length ? P.reduce((a, r) => r[0] > a ? r[0] : a, '') : '', lim = end ? new Date(Date.parse(end) - 90 * 864e5).toISOString() : '';
  const usage = {}; P.forEach(r => { if(r[3] === 'direct' || !r[4] || r[0] < lim) return; const s = SEGOF[r[4]], own = A.owner[r[1]]; if(!s || s[0] === '@' || !own || own.includes(s)) return; ((usage[r[4]] ||= {})[r[1]] = (usage[r[4]][r[1]] || 0) + 1); });
  const out = [];
  FULL.extensions.forEach(e => { const s = SEGOF[e.number]; if(!s || s[0] === '@') return; const mine = plan[s] || [], bl = e.blfs || [];
    const cur = bl.filter(b => b.type === 'SharedParking' && /^SP\d+$/.test(b.v || '')).map(b => ({no: b.no, v: b.v})), have = new Set(cur.map(k => k.v));
    const rem = cur.filter(k => A.owner[k.v] && !A.owner[k.v].includes(s)), hors = Object.keys(A.owner).length ? cur.filter(k => !A.owner[k.v]) : [];
    const addk = mine.length && cur.some(k => mine.includes(k.v)) ? mine.filter(p => !have.has(p)) : [];
    const us = usage[e.number] || {};
    if(!rem.length && !hors.length && !addk.length && !Object.keys(us).length) return;
    const free = bl.filter(b => b.type === 'None').map(b => b.no).sort((a, b) => a - b);
    const probs = [rem.length ? 'autre' : '', Object.keys(us).length ? 'usage' : '', hors.length ? 'horsplan' : '', addk.length ? 'manque' : ''].filter(Boolean);
    out.push({n: e.number, e, s, cur, rem, hors, addk, free: free.slice(0, addk.length), us, probs}); });
  return out.sort((a, b) => (b.rem.length - a.rem.length) || (Object.keys(b.us).length - Object.keys(a.us).length) || a.n.localeCompare(b.n, undefined, {numeric: true}));
}
const pkKeys = l => l.map(k => `touche ${k.no} : ${k.v}`).join(' ; ');
function pkpExport(A, plan, users){
  const nm = e => (e.first + ' ' + e.last).trim(), owner = p => (A.owner[p] || []).map(segShort).join(', ');
  const sh = [];
  sh.push({name: 'Corrections par usager', rows: [['Poste', 'Nom', 'Magasin', 'Courriel', 'Téléphones (modèle et MAC)', 'Touches de parking actuelles', 'À retirer (parking d\'un autre magasin)', 'Hors plan (à vérifier)', 'À ajouter', 'Positions libres suggérées', "Appels parqués chez un autre magasin (90 j)", 'Problèmes', 'Fait']]
    .concat(users.map(u => [u.n, nm(u.e), segShort(u.s), u.e.email || '', u.e.devices.map(d => `${d.model || d.template || '?'} ${d.mac || ''}`.trim()).join(' ; '),
      pkKeys(u.cur), u.rem.map(k => `touche ${k.no} : ${k.v} (${owner(k.v)})`).join(' ; '), pkKeys(u.hors), pkFmt(u.addk), u.addk.length ? u.free.join(', ') : '',
      Object.entries(u.us).map(([p, n]) => `${p} (${owner(p)}) : ${n}`).join(' ; '), u.probs.map(k => PKP_K[k][0]).join(' ; '), '']))});
  const segs = [...new Set(users.map(u => u.s))].sort();
  sh.push({name: 'Par magasin', rows: [['Magasin', 'Parkings prévus', 'Usagers à corriger', 'Touches à retirer', 'Touches à ajouter', 'Touches hors plan', 'Appels chez un autre magasin (90 j)']]
    .concat(A.stores.filter(s => (plan[s] || []).length || segs.includes(s)).map(s => { const us = users.filter(u => u.s === s);
      return [segName(s), pkFmt(plan[s] || []), us.length, us.reduce((a, u) => a + u.rem.length, 0), us.reduce((a, u) => a + u.addk.length, 0), us.reduce((a, u) => a + u.hors.length, 0), us.reduce((a, u) => a + Object.values(u.us).reduce((x, y) => x + y, 0), 0)]; }))});
  sh.push({name: 'Problèmes', rows: [['Constat', 'Gravité', 'Magasin', 'Poste', 'Détail']].concat(A.out.map(x => [PKP_K[x.k][0], DBL_SEV[x.sev], segShort(x.seg), x.items.map(n => `${n} ${dnName(n)}`).join(' | '), x.detail]))});
  sh.push({name: 'Plan', rows: [['Magasin', 'Parkings prévus', 'Nombre']].concat(A.stores.filter(s => (plan[s] || []).length).map(s => [segName(s), pkFmt(plan[s]), plan[s].length]))});
  const a = document.createElement('a'); a.href = URL.createObjectURL(XL.build(sh).blob); a.download = `parkings-corrections-${SEG ? segShort(SEG).replace(/[^\w-]+/g, '_') + '-' : ''}${new Date().toLocaleDateString('fr-CA')}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
