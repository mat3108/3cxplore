// ---------- Plan des parkings (16.0) : parkings attribués à chaque magasin, comparés aux touches des téléphones et à l'usage réel ----------
// plan gardé dans ce navigateur (clé pkplan3cx:<système>), inclus dans la Sauvegarde des réglages
const PKP_KEY = 'pkplan3cx:' + (FULL.info.fqdn || '');
const pkpLoad = () => { try{ const j = JSON.parse(localStorage.getItem(PKP_KEY) || '{}'); return j.plan && typeof j.plan === 'object' ? j.plan : {}; }catch(e){ return {}; } };
const pkpSave = plan => { try{ localStorage.setItem(PKP_KEY, JSON.stringify({plan})); }catch(e){} };
const pkNum = s => +String(s).replace(/\D/g, '');
const pkSort = l => [...new Set(l)].sort((a, b) => pkNum(a) - pkNum(b));
// « SP10-SP14, SP20 » ou « 10-14 20 » -> ['SP10', …, 'SP14', 'SP20']
function pkParse(txt){ const out = []; String(txt || '').toUpperCase().split(/[,;\s]+/).filter(Boolean).forEach(tok => {
  const m = tok.match(/^(?:SP)?(\d+)(?:-(?:SP)?(\d+))?$/); if(!m) return; let a = +m[1], b = m[2] != null ? +m[2] : a; if(a > b) [a, b] = [b, a];
  for(let i = a; i <= b && out.length < 500; i++) out.push('SP' + i); }); return pkSort(out); }
// ['SP10', 'SP11', 'SP12', 'SP20'] -> « SP10-SP12, SP20 »
function pkFmt(l){ const n = pkSort(l).map(pkNum), out = []; for(let i = 0; i < n.length;){ let j = i; while(j + 1 < n.length && n[j + 1] === n[j] + 1) j++; out.push(j > i ? `SP${n[i]}-SP${n[j]}` : `SP${n[i]}`); i = j + 1; } return out.join(', '); }
const PKP_K = {conflit: ['Parking prévu pour plusieurs magasins', 'bad'], inexistant: ["Parking prévu qui n'existe pas dans 3CX", 'bad'], autre: ["Touche d'un parking d'un autre magasin", 'bad'],
  usage: ["Appels parqués sur un parking d'un autre magasin", 'warn'], horsplan: ['Touche d\'un parking hors plan', 'warn'], manque: ['Touches de parking manquantes', 'warn'],
  absent: ['Aucun téléphone ne montre les parkings du magasin', 'warn'], sature: ['Parkings saturés aux heures de pointe', 'warn'], nonplan: ['Parking utilisé mais attribué à aucun magasin', ''], vide: ['Magasin sans parkings prévus', '']};
function pkpAnalysis(plan){
  const info = FULL.parkInfo || (FULL.parks || []).map(n => ({number: n})), exist = new Set(info.map(p => p.number).filter(n => /^SP\d+$/.test(n)));
  const stores = SEG_LIST.filter(s => s[0] !== '@');
  const keys = {}; // poste -> parkings affichés
  FULL.extensions.forEach(e => (e.blfs || []).forEach(b => { if(b.type === 'SharedParking' && /^SP\d+$/.test(b.v || '')) (keys[e.number] ||= new Set()).add(b.v); }));
  const P = FULL.parkCalls || [], end = P.length ? P.reduce((a, r) => r[0] > a ? r[0] : a, '') : '', lim = end ? new Date(Date.parse(end) - 90 * 864e5).toISOString() : '';
  const use = {}; P.forEach(r => { if(r[3] === 'direct' || !r[4] || r[0] < lim) return; const s = SEGOF[r[4]]; if(!s || s[0] === '@') return; ((use[r[1]] ||= {})[s] = (use[r[1]][s] || 0) + 1); });
  const owner = {}; stores.forEach(s => (plan[s] || []).forEach(p => (owner[p] ||= []).push(s)));
  const out = [], add = (k, seg, items, detail) => out.push({k, seg, items, detail, sev: PKP_K[k][1]});
  Object.entries(owner).filter(([, ss]) => ss.length > 1).forEach(([p, ss]) => ss.forEach(s => add('conflit', s, [], `${p} est prévu pour ${ss.map(segShort).join(' et ')}`)));
  stores.forEach(s => { const miss = (plan[s] || []).filter(p => exist.size && !exist.has(p)); if(miss.length) add('inexistant', s, [], `${pkFmt(miss)} : à créer dans 3CX ou à retirer du plan`); });
  // touches des téléphones
  Object.entries(keys).forEach(([n, set]) => { const s = SEGOF[n]; if(!s || s[0] === '@') return; const mine = plan[s] || [];
    const other = [...set].filter(p => owner[p] && !owner[p].includes(s)), off = [...set].filter(p => !owner[p]);
    if(other.length) add('autre', s, [n], `${pkFmt(other)} (${[...new Set(other.flatMap(p => owner[p]))].map(segShort).join(', ')})`);
    if(off.length && Object.keys(owner).length) add('horsplan', s, [n], pkFmt(off));
    const lack = mine.filter(p => !set.has(p)); if(mine.length && lack.length && [...set].some(p => mine.includes(p))) add('manque', s, [n], pkFmt(lack)); });
  stores.forEach(s => { const mine = plan[s] || []; if(mine.length && !Object.entries(keys).some(([n, set]) => SEGOF[n] === s && mine.some(p => set.has(p)))) add('absent', s, [], `${pkFmt(mine)} : aucune touche sur les téléphones du magasin`); });
  // usage réel (90 derniers jours de l'historique des parkings)
  Object.entries(use).forEach(([p, by]) => Object.entries(by).forEach(([s, n]) => { if(owner[p] && !owner[p].includes(s)) add('usage', s, [], `${nf(n)} appel${n > 1 ? 's' : ''} sur ${p} (${owner[p].map(segShort).join(', ')})`); }));
  const used = new Set([...Object.keys(use), ...Object.values(keys).flatMap(x => [...x])]);
  [...used].filter(p => !owner[p] && Object.keys(owner).length).forEach(p => { const by = use[p] || {}, ss = Object.keys(by); add('nonplan', ss.length === 1 ? ss[0] : SEG_COMMON, [], `${p}${ss.length ? ` — utilisé par ${ss.map(segShort).join(', ')}` : ' — sur des téléphones'}`); });
  stores.forEach(s => { if(!(plan[s] || []).length && (Object.entries(keys).some(([n]) => SEGOF[n] === s) || Object.values(use).some(by => by[s]))) add('vide', s, [], 'des employés utilisent des parkings, mais aucun n\'est prévu pour ce magasin'); });
  // 16.4 : parkings prévus tous occupés en même temps au moins un jour (90 jours)
  const need = pkNeed(); stores.forEach(s => { const n = (plan[s] || []).length, x = need[s]; if(!n || !x) return; const full = Object.values(x.day).filter(v => v >= n).length;
    if(x.max > n || full >= 5) add('sature', s, [], `pic de ${x.max} appel${x.max > 1 ? 's' : ''} en parking en même temps pour ${n} parking${n > 1 ? 's' : ''} prévu${n > 1 ? 's' : ''} (${full} jour${full > 1 ? 's' : ''} saturé${full > 1 ? 's' : ''}) — recommandé : ${x.rec}`); });
  // fiche des changements par téléphone : touches à ajouter (parkings du magasin) et à retirer (autres magasins)
  const sheet = Object.entries(keys).map(([n, set]) => { const s = SEGOF[n], mine = (s && plan[s]) || [];
    return {n, s, rem: [...set].filter(p => owner[p] && !owner[p].includes(s)), addk: mine.length && [...set].some(p => mine.includes(p)) ? mine.filter(p => !set.has(p)) : []}; }).filter(x => x.rem.length || x.addk.length);
  return {out, exist, stores, keys, use, owner, sheet, need};
}
function pkpPropose(A){
  // par magasin : téléphones qui affichent chaque parking, et appels parqués (90 jours)
  const ph = {}, nPh = {}, calls = {};
  Object.entries(A.keys).forEach(([n, set]) => { const s = SEGOF[n]; if(!s || s[0] === '@') return; nPh[s] = (nPh[s] || 0) + 1; set.forEach(p => ((ph[p] ||= {})[s] = (ph[p][s] || 0) + 1)); });
  Object.entries(A.use).forEach(([p, by]) => Object.entries(by).forEach(([s, n]) => ((calls[p] ||= {})[s] = n)));
  // un parking va au magasin qui l'utilise le plus, s'il y sert vraiment : sur au moins un quart des téléphones du magasin qui ont des touches de parking (et au moins 2), ou 6 appels parqués
  const plan = {};
  new Set([...Object.keys(ph), ...Object.keys(calls)]).forEach(p => {
    const cand = [...new Set([...Object.keys(ph[p] || {}), ...Object.keys(calls[p] || {})])].map(s => { const k = (ph[p] || {})[s] || 0, c = (calls[p] || {})[s] || 0; return {s, k, c, sc: 3 * k + c, ok: (k >= 2 && k >= nPh[s] / 4) || c >= 6}; })
      .filter(x => x.ok).sort((a, b) => b.sc - a.sc);
    if(cand.length) (plan[cand[0].s] ||= []).push(p); });
  Object.keys(plan).forEach(s => plan[s] = pkSort(plan[s])); return plan;
}
